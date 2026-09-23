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

function setup(o: { os?: string; test?: boolean; noSdk?: boolean; units?: AdsOptions['units']; testDevices?: string[]; device?: () => string } = {}) {
  const made: FakeAd[] = [];
  let inits = 0;
  const order: string[] = [];
  const appListeners = new Set<(s: string) => void>();
  const app = {
    currentState: 'active',
    addEventListener: (_t: 'change', fn: (s: string) => void) => { appListeners.add(fn); return { remove: () => appListeners.delete(fn) }; },
  };
  const att = {
    asked: 0, status: 'undetermined', skip: false, id: 'AAAA-1111' as string | null,
    getTrackingPermissionsAsync: async () => ({ status: att.status, granted: att.status === 'granted' }),
    // skip 이면 창을 띄우지 못하고 미정 그대로 — 앞에 오기 전·다른 시스템 창과 겹쳤을 때
    requestTrackingPermissionsAsync: async () => { att.asked++; if (!att.skip) att.status = 'granted'; return { status: att.status, granted: att.status === 'granted' }; },
    getAdvertisingId: () => att.id,
  };
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
    device: o.device,
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

  /*
   | 기기 ID(1.3) — 광고 기록에 회원번호밖에 없어 「한 사람이 많이 보는가, 계정이 여럿인가」를 가릴 수 없었다.
   | 앱이 이미 만들어 둔 값을 받아 SSV 에 함께 싣는다(새로 걷는 것 없음, 광고 식별자 아님).
   */
  it('기기 ID 를 주면 SSV 값에 dev 로 함께 싣는다', async () => {
    const s = setup({ device: () => 'mudgmogx-6ol1hvkhe7' });
    void s.ads.show({ userId: 'm7', customData: '{"kind":"feed","stage":"hen"}', ...s.cb });
    await flush();
    expect(JSON.parse(s.made[0].reqOpts.serverSideVerificationOptions.customData))
      .toEqual({ kind: 'feed', stage: 'hen', dev: 'mudgmogx-6ol1hvkhe7' });
  });

  it('아직 못 읽었으면(빈 문자열) 그 광고는 그냥 나간다', async () => {
    const s = setup({ device: () => '' });
    void s.ads.show({ userId: 'm7', customData: '{"kind":"feed"}', ...s.cb });
    await flush();
    expect(s.made[0].reqOpts.serverSideVerificationOptions.customData).toBe('{"kind":"feed"}');
  });

  it('맨 문자열로 보내는 앱의 값은 건드리지 않는다 — 뜻이 바뀌면 서버 판정이 어긋난다', async () => {
    const s = setup({ device: () => 'dev-1' });
    void s.ads.show({ userId: 'm7', customData: 'stamp_main', ...s.cb });
    await flush();
    expect(s.made[0].reqOpts.serverSideVerificationOptions.customData).toBe('stamp_main');
  });

  it('앱이 이미 dev 를 넣었으면 그대로 둔다', async () => {
    const s = setup({ device: () => '내값' });
    void s.ads.show({ userId: 'm7', customData: '{"kind":"feed","dev":"앱이넣음"}', ...s.cb });
    await flush();
    expect(JSON.parse(s.made[0].reqOpts.serverSideVerificationOptions.customData).dev).toBe('앱이넣음');
  });

  it('기기 ID 를 안 주는 앱은 예전 그대로다', async () => {
    const s = setup();
    void s.ads.show({ userId: 'm7', customData: '{"kind":"feed"}', ...s.cb });
    await flush();
    expect(s.made[0].reqOpts.serverSideVerificationOptions.customData).toBe('{"kind":"feed"}');
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

  it('(1.2) 미리 받지 않는다 — warm 은 아무 광고도 만들거나 받지 않고, warmReady 는 늘 거짓', async () => {
    const s = setup();
    s.ads.warm('m1', 'feed');
    s.ads.warm('m1', 'feed', true);
    await flush();
    vi.advanceTimersByTime(5000);
    expect(s.made).toHaveLength(0);
    expect(s.inits(), '미리 받으려고 SDK 를 깨우지도 않는다').toBe(0);
    expect(s.ads.warmReady('m1', 'feed')).toBe(false);
  });

  it('(1.2) 광고를 닫은 뒤 다음 것을 스스로 받아 두지 않는다 — 안 보여 줄 광고가 요청으로만 쌓였다', async () => {
    const s = setup();
    void s.ads.show({ userId: 'm1', customData: 'feed', ...s.cb });
    await flush();
    const ad = s.made[0];
    ad.emit(EV.LOADED); ad.emit(EV.OPENED); ad.emit(EV.EARNED_REWARD); ad.emit(EV.CLOSED);
    await flush();
    vi.advanceTimersByTime(10_000);
    await flush();
    expect(s.made).toHaveLength(1);
    expect(ad.loads).toBe(1);
  });

  it('보여 줄 때마다 새로 받아 연다 — 받으면(LOADED) 연다', async () => {
    const s = setup();
    void s.ads.show({ userId: 'm1', customData: 'feed', ...s.cb });
    await flush();
    expect(s.made[0].loads).toBe(1);
    expect(s.made[0].shows).toBe(0);
    s.made[0].emit(EV.LOADED);
    expect(s.made[0].shows).toBe(1);
  });

  const tracked = async (s: ReturnType<typeof setup>): Promise<void> => {
    const p = s.ads.requestTracking();
    await flush(); vi.advanceTimersByTime(600); await flush();
    await p;
  };

  it('iOS 추적 허용은 답을 받으면 다시 묻지 않는다', async () => {
    const s = setup({ os: 'ios' });
    await tracked(s);
    s.att.status = 'granted';
    await tracked(s);
    expect(s.att.asked).toBe(1);
  });

  it('(1.3) 앱이 앞에 올라오기 전에는 묻지 않고, 올라온 뒤 0.6초에 묻는다 — 그 전에 물으면 iOS 가 창 없이 넘긴다', async () => {
    const s = setup({ os: 'ios' });
    s.toBg();
    const p = s.ads.requestTracking();
    await flush(); vi.advanceTimersByTime(5000); await flush();
    expect(s.att.asked, '뒤에 있는 동안은 묻지 않는다').toBe(0);
    s.toFg();
    await flush(); vi.advanceTimersByTime(599); await flush();
    expect(s.att.asked).toBe(0);
    vi.advanceTimersByTime(1); await flush();
    await p;
    expect(s.att.asked).toBe(1);
  });

  it('(1.3) 물었는데 창 없이 넘어가 미정으로 남으면 다음 호출에 다시 묻는다', async () => {
    const s = setup({ os: 'ios' });
    s.att.skip = true;   // 창을 못 띄우고 undetermined 그대로
    await tracked(s);
    expect(s.att.asked).toBe(1);
    s.att.skip = false;
    await tracked(s);
    expect(s.att.asked).toBe(2);
    await tracked(s);
    expect(s.att.asked, '답을 받은 뒤로는 묻지 않는다').toBe(2);
  });

  it('(1.4) 광고 식별자는 읽기만 — iOS 는 허용 전이면 null 이고 ATT 를 묻지 않는다, 허용 뒤엔 값', async () => {
    const s = setup({ os: 'ios' });
    expect(await s.ads.advertisingId()).toBeNull();
    expect(s.att.asked, '식별자를 읽으려고 ATT 창을 띄우지 않는다').toBe(0);
    s.att.status = 'granted';
    expect(await s.ads.advertisingId()).toBe('AAAA-1111');
  });

  it('(1.4) 초기화된 식별자(0000-…)는 없는 것으로 · 안드로이드는 허용 확인 없이 읽는다', async () => {
    const a = setup({ os: 'android' });
    expect(await a.ads.advertisingId()).toBe('AAAA-1111');
    const z = setup({ os: 'android' });
    z.att.id = '00000000-0000-0000-0000-000000000000';
    expect(await z.ads.advertisingId()).toBeNull();
  });

  it('안드로이드는 묻지 않는다', async () => {
    const s = setup({ os: 'android' });
    await s.ads.requestTracking();
    expect(s.att.asked).toBe(0);
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
