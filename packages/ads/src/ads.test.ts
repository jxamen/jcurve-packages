/**
 * 광고 엔진을 **가짜 SDK** 로 돌려 본다 — 꼬꼬농장 실기기에서 밟은 장면들을 재현한다.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRewarded, type AdsEnv, type AdsOptions } from './ads';

/* eslint-disable @typescript-eslint/no-explicit-any */

const EV = { LOADED: 'loaded', EARNED_REWARD: 'earned', OPENED: 'opened', CLOSED: 'closed', ERROR: 'error' };

class FakeAd {
  listeners = new Map<string, Set<(x?: any) => void>>();
  loads = 0;
  shows = 0;
  constructor(public kind: 'r' | 'ri', public unit: string, public reqOpts: any) {}
  addAdEventListener(t: string, fn: (x?: any) => void) {
    if (!this.listeners.has(t)) this.listeners.set(t, new Set());
    this.listeners.get(t)!.add(fn);

    return () => { this.listeners.get(t)?.delete(fn); };
  }
  emit(t: string, x?: any) { [...(this.listeners.get(t) ?? [])].forEach((f) => f(x)); }
  load() { this.loads++; }
  show() { this.shows++; return Promise.resolve(); }
}

function setup(o: { os?: string; test?: boolean; noSdk?: boolean; units?: AdsOptions['units']; testDevices?: string[] } = {}) {
  const made: FakeAd[] = [];
  let inits = 0;
  const order: string[] = [];
  const appListeners = new Set<(s: string) => void>();
  const app = {
    currentState: 'active',
    addEventListener: (_t: 'change', fn: (s: string) => void) => { appListeners.add(fn); return { remove: () => appListeners.delete(fn) }; },
  };
  const att = { asked: 0, getTrackingPermissionsAsync: async () => ({ status: 'undetermined' }), requestTrackingPermissionsAsync: async () => { att.asked++; return { status: 'granted' }; } };
  const sdk = {
    default: () => ({
      initialize: async () => { inits++; order.push('initialize'); },
      setRequestConfiguration: async (c: any) => { order.push('config:' + (c?.testDeviceIdentifiers ?? []).join(',')); },
    }),
    RewardedAd: { createForAdRequest: (u: string, r: any) => { const a = new FakeAd('r', u, r); made.push(a); return a; } },
    RewardedInterstitialAd: { createForAdRequest: (u: string, r: any) => { const a = new FakeAd('ri', u, r); made.push(a); return a; } },
    TestIds: { REWARDED: 'TEST_R', REWARDED_INTERSTITIAL: 'TEST_RI' },
    RewardedAdEventType: { LOADED: EV.LOADED, EARNED_REWARD: EV.EARNED_REWARD },
    AdEventType: { OPENED: EV.OPENED, CLOSED: EV.CLOSED, ERROR: EV.ERROR },
  };
  const env: AdsEnv = {
    sdk: () => (o.noSdk ? null : sdk),
    tracking: () => att,
    os: () => o.os ?? 'android',
    appState: () => app,
    dev: () => false,
  };
  const ads = createRewarded({
    units: o.units ?? { rewarded: { android: 'AND_R', ios: 'IOS_R' }, rewardedInterstitial: { android: 'AND_RI', ios: 'IOS_RI' } },
    test: o.test ?? false,
    testDevices: o.testDevices,
  }, env);
  const calls = { earned: 0, closed: 0, opened: 0, fail: [] as string[], noAd: [] as boolean[] };
  const cb = {
    onEarned: () => { calls.earned++; },
    onClosed: () => { calls.closed++; },
    onOpened: () => { calls.opened++; },
    onFail: (m: string, noAd: boolean) => { calls.fail.push(m); calls.noAd.push(noAd); },
  };
  const toBg = () => { app.currentState = 'background'; appListeners.forEach((f) => f('background')); };
  const toFg = () => { app.currentState = 'active'; appListeners.forEach((f) => f('active')); };

  return { ads, made, calls, cb, att, inits: () => inits, order, toBg, toFg };
}

/** 대기 중인 약속(초기화 등)을 다 흘려보낸다 */
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('끝까지 봤는가', () => {
  it('받고 → 열리고 → 보상 → 닫힘: 보상 한 번, 실패 없음', async () => {
    const s = setup();
    const p = s.ads.show({ userId: 'm1', customData: 'feed', ...s.cb });
    await flush();
    const ad = s.made[0];
    expect(ad.loads).toBe(1);
    ad.emit(EV.LOADED);
    expect(ad.shows, '받으면 곧바로 띄운다').toBe(1);
    ad.emit(EV.OPENED);
    ad.emit(EV.EARNED_REWARD);
    ad.emit(EV.CLOSED);
    expect(await p).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(s.calls).toMatchObject({ earned: 1, closed: 1, opened: 1, fail: [] });
  });

  it('**보상이 닫힘 뒤에 와도(1.2초 안) 준다** — 끝까지 봤는데 「끝까지 보지 않았어요」가 뜨던 것', async () => {
    const s = setup();
    void s.ads.show({ ...s.cb });
    await flush();
    const ad = s.made[0];
    ad.emit(EV.LOADED); ad.emit(EV.OPENED); ad.emit(EV.CLOSED);
    vi.advanceTimersByTime(800);
    ad.emit(EV.EARNED_REWARD);
    vi.advanceTimersByTime(1000);
    expect(s.calls.earned).toBe(1);
    expect(s.calls.fail).toEqual([]);
  });

  it('보상 없이 닫히면 1.2초 뒤 실패', async () => {
    const s = setup();
    void s.ads.show({ ...s.cb });
    await flush();
    const ad = s.made[0];
    ad.emit(EV.LOADED); ad.emit(EV.OPENED); ad.emit(EV.CLOSED);
    vi.advanceTimersByTime(1199);
    expect(s.calls.fail).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(s.calls.fail).toEqual(['광고를 끝까지 보지 않았어요']);
  });

  it('닫힘 이벤트를 못 받아도 앱이 뒤로 갔다 돌아오면 닫힌 것으로 본다', async () => {
    const s = setup();
    void s.ads.show({ ...s.cb });
    await flush();
    const ad = s.made[0];
    ad.emit(EV.LOADED); ad.emit(EV.OPENED); ad.emit(EV.EARNED_REWARD);
    s.toBg(); s.toFg();
    expect(s.calls.closed).toBe(1);
    expect(s.calls.fail).toEqual([]);
  });
});

describe('광고가 안 채워질 때', () => {
  it('세 번 잇달아 실패하면 30분 접고, 한 번 열리면 되살린다', async () => {
    const s = setup();
    for (let i = 0; i < 3; i++) {
      void s.ads.show({ ...s.cb });
      await flush();
      s.made[s.made.length - 1].emit(EV.ERROR, { code: 'googleMobileAds/no-fill' });
    }
    expect(s.calls.fail[0]).toContain('지금은 볼 수 있는 광고가 없어요');
    expect(s.ads.mutedMs()).toBeGreaterThan(29 * 60 * 1000);
    void s.ads.show({ ...s.cb });
    await flush();
    s.made[s.made.length - 1].emit(EV.OPENED);
    expect(s.ads.mutedMs()).toBe(0);
  });

  it('보상형 전면의 실패는 세지 않는다 — 멀쩡한 보상형까지 30분 접혔다', async () => {
    const s = setup();
    for (let i = 0; i < 3; i++) {
      void s.ads.show({ interstitial: true, ...s.cb });
      await flush();
      s.made[s.made.length - 1].emit(EV.ERROR, { code: 'no-fill' });
    }
    expect(s.ads.mutedMs()).toBe(0);
  });

  it('15초 안에 안 열리면 실패로 끝낸다(멈춘 줄 알았다)', async () => {
    const s = setup();
    void s.ads.show({ ...s.cb });
    await flush();
    vi.advanceTimersByTime(14_999);
    expect(s.calls.fail).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(s.calls.fail[0]).toContain('(load)');
  });

  it('도는 중에 또 부르면 거짓 — 걸린 지 12초가 넘었으면 풀고 새로 시작한다', async () => {
    const s = setup();
    void s.ads.show({ ...s.cb });
    await flush();
    expect(await s.ads.show({ ...s.cb })).toBe(false);
    vi.advanceTimersByTime(12_000);
    expect(await s.ads.show({ ...s.cb })).toBe(true);
  });
});

describe('광고 단위·SSV', () => {
  it('실광고: 플랫폼의 광고 단위, 로그인이면 SSV 를 싣는다', async () => {
    const s = setup({ os: 'ios' });
    void s.ads.show({ userId: 'm6', customData: '{"kind":"water"}', ...s.cb });
    await flush();
    expect(s.made[0].unit).toBe('IOS_R');
    expect(s.made[0].reqOpts.serverSideVerificationOptions).toEqual({ userId: 'm6', customData: '{"kind":"water"}' });
  });

  it('테스트 광고: 구글 테스트 단위, SSV 없음(붙이면 로드가 실패했다)', async () => {
    const s = setup({ test: true });
    void s.ads.show({ userId: 'm6', interstitial: true, ...s.cb });
    await flush();
    expect(s.made[0].unit).toBe('TEST_RI');
    expect(s.made[0].reqOpts.serverSideVerificationOptions).toBeUndefined();
  });

  it('광고 단위가 없으면 available 거짓, SDK 가 없으면 onFail', async () => {
    expect(setup({ units: { rewarded: {} } }).ads.available).toBe(false);
    expect(setup({ units: { rewarded: { android: 'X' } } }).ads.interstitialAvailable).toBe(false);
    const s = setup({ noSdk: true });
    expect(s.ads.available).toBe(false);
    expect(await s.ads.show({ ...s.cb })).toBe(false);
    expect(s.calls.fail).toEqual(['이 빌드에서는 광고를 재생할 수 없어요']);
  });
});

describe('미리 받기·초기화', () => {
  it('**만들 때 SDK 를 초기화하지 않는다** — 광고를 안 봐도 SDK 가 돌아 기기가 더워졌다', async () => {
    const s = setup();
    await flush();
    expect(s.inits()).toBe(0);
    void s.ads.show({ ...s.cb });
    await flush();
    expect(s.inits()).toBe(1);
  });

  it('미리 받은 광고는 같은 조건일 때만 꺼내 바로 연다 — 새로 받지 않는다', async () => {
    const s = setup();
    s.ads.warm('m1', 'feed');
    await flush();
    s.made[0].emit(EV.LOADED);
    expect(s.ads.warmReady('m1', 'feed')).toBe(true);
    expect(s.ads.warmReady('m1', 'water'), 'SSV 데이터가 다르면 못 쓴다').toBe(false);
    void s.ads.show({ userId: 'm1', customData: 'feed', ...s.cb });
    await flush();
    expect(s.made).toHaveLength(1);
    expect(s.made[0].shows).toBe(1);
  });

  it('iOS 추적 허용은 한 번만 묻는다', async () => {
    const s = setup({ os: 'ios' });
    await s.ads.requestTracking();
    await s.ads.requestTracking();
    expect(s.att.asked).toBe(1);
  });
});

describe('Metro 가 빌드 때 찾을 수 있게', () => {
  it('require 안의 이름은 글자 그대로다 — 변수로 주면 실행 때 던지고 모듈이 늘 없는 것처럼 돈다', () => {
    for (const f of ['ads.ts', 'mode.ts']) {
      const src = readFileSync(new URL('./' + f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const calls = [...src.matchAll(/require\(\s*([^)]*)\)/g)].map((m) => m[1].trim());
      expect(calls.length, f).toBeGreaterThan(0);
      for (const c of calls) expect(c, f).toMatch(/^['"][^'"]+['"]$/);
    }
  });
});

describe('1.1 — 당근캐시가 쓰던 것', () => {
  it('noAd: 안 열렸으면 참(재고 없음·시간 초과·SDK 없음), 열렸다가 닫았으면 거짓', async () => {
    const a = setup();
    void a.ads.show({ ...a.cb });
    await flush();
    a.made[0].emit(EV.ERROR, { code: 'no-fill' });
    const b = setup();
    void b.ads.show({ ...b.cb });
    await flush();
    vi.advanceTimersByTime(15_000);
    const c = setup();
    void c.ads.show({ ...c.cb });
    await flush();
    c.made[0].emit(EV.LOADED); c.made[0].emit(EV.OPENED); c.made[0].emit(EV.CLOSED);
    vi.advanceTimersByTime(1200);
    const d = setup({ noSdk: true });
    await d.ads.show({ ...d.cb });
    expect([a.calls.noAd, b.calls.noAd, c.calls.noAd, d.calls.noAd]).toEqual([[true], [true], [false], [true]]);
  });

  it('테스트 기기는 초기화 **전에** 알린다 — 없으면 알리지 않는다', async () => {
    const s = setup({ testDevices: ['75AF01'] });
    void s.ads.show({ ...s.cb });
    await flush();
    expect(s.order).toEqual(['config:75AF01', 'initialize']);
    const n = setup();
    void n.ads.show({ ...n.cb });
    await flush();
    expect(n.order).toEqual(['initialize']);
  });
});
