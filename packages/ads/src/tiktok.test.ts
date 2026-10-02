/**
 * 틱톡 전환(1.7) — 앱총괄 10개 앱 규약을 가짜 네이티브로 재현한다: 그룹 칸 · 플랫폼별 ID · 안드 전용 시크릿 · ATT 기다림 ·
 * 켜기 전 이벤트 모으기 · 열쇠 교체 · 모듈 없는 빌드 no-op · 보상형 광고 열람 자동 · config plugin JitPack.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRewarded, type AdsEnv } from './ads';
import { createTikTok, type TikTokEnv, type TikTokNative } from './tiktok';
import { tiktokEventFor, tiktokIds, tiktokKeys, tiktokSecret } from './tiktok.map';

/* eslint-disable @typescript-eslint/no-explicit-any */

const G = 'carrot';
const V = {
  'carrot.tiktok_sdk_access': ' sec-ios ',
  'carrot.tiktok_app_id_ios': '7123456789012345678',
  'carrot.tiktok_app_id_android': '7999999999999999999',
};

describe('tiktok.map — 규칙', () => {
  it('칸 이름은 그룹 머리 + 고정 꼬리', () => {
    expect(tiktokKeys('pig')).toEqual({ access: 'pig.tiktok_sdk_access', androidAccess: 'pig.tiktok_android_sdk_access',
      idIos: 'pig.tiktok_app_id_ios', idAndroid: 'pig.tiktok_app_id_android' });
  });
  it('시크릿 — 안드는 안드 칸이 먼저, 없으면 공용 · 비면 빈 글자', () => {
    expect(tiktokSecret(G, 'ios', V)).toBe('sec-ios');
    expect(tiktokSecret(G, 'android', V)).toBe('sec-ios');
    expect(tiktokSecret(G, 'android', { ...V, 'carrot.tiktok_android_sdk_access': 'sec-and' })).toBe('sec-and');
    expect(tiktokSecret(G, 'ios', {})).toBe('');
    expect(tiktokSecret('pig', 'ios', V)).toBe('', );   // 다른 그룹 칸은 안 읽는다
  });
  it('ID — 플랫폼별, 숫자(자릿수 깨짐)는 받지 않는다, 하나라도 비면 null', () => {
    expect(tiktokIds(G, 'ios', { appleAppId: '6740000000' }, V)).toEqual({ appId: '6740000000', tiktokAppId: '7123456789012345678' });
    expect(tiktokIds(G, 'android', { androidPackage: 'kr.co.jcurve.carrotcash' }, V)).toEqual({ appId: 'kr.co.jcurve.carrotcash', tiktokAppId: '7999999999999999999' });
    expect(tiktokIds(G, 'ios', { appleAppId: '6740000000' }, { 'carrot.tiktok_app_id_ios': 7123456789012345678 as any })).toBeNull();
    expect(tiktokIds(G, 'ios', {}, V)).toBeNull();
    expect(tiktokIds(G, 'web', { appleAppId: 'x' }, V)).toBeNull();
  });
  it('이벤트 — 가입 · 로그인은 공용, 앱 것이 먼저', () => {
    expect(tiktokEventFor('signup_done')).toEqual({ standard: 'registration' });
    expect(tiktokEventFor('login_done')).toEqual({ standard: 'login' });
    expect(tiktokEventFor('harvest_done', { daily: true })).toBeNull();
    const own = (n: string, p?: Record<string, unknown>) => (n === 'harvest_done' && p?.daily === true ? { custom: 'WeeklyMission' } : null);
    expect(tiktokEventFor('harvest_done', { daily: true }, own)).toEqual({ custom: 'WeeklyMission' });
    expect(tiktokEventFor('signup_done', undefined, own)).toEqual({ standard: 'registration' });
  });
});

function fake(os = 'ios', has = true) {
  const calls: string[] = [];
  let resolveInit: (c: string | null) => void = () => undefined;
  const native: TikTokNative = {
    initialize: vi.fn((tok: string, appId: string, ttId: string, debug: boolean) => {
      calls.push(`init:${tok}:${appId}:${ttId}:${debug}`);

      return new Promise<string | null>((r) => { resolveInit = r; });
    }),
    trackStandard: (k) => { calls.push('std:' + k); },
    trackCustom: (n) => { calls.push('custom:' + n); },
    identify: (id) => { calls.push('id:' + id); },
    logout: () => { calls.push('logout'); },
    updateAccessToken: (t) => { calls.push('token:' + t); },
  };
  const app = new Set<(s: string) => void>();
  const env: TikTokEnv = {
    native: () => (has ? native : null),
    os: () => os,
    extra: () => ({ appleAppId: '6740000000', androidPackage: 'kr.co.jcurve.carrotcash' }),
    appState: () => ({ addEventListener: (_t: 'change', fn: (s: string) => void) => { app.add(fn); return {}; } }),
    log: () => undefined,
  };

  return { native, env, calls, resolveInit: (c: string | null = null) => resolveInit(c), fg: () => app.forEach((f) => f('active')) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createTikTok', () => {
  beforeEach(() => { vi.useRealTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('iOS 는 ATT 답을 기다린 뒤 켜고, 그 전 이벤트는 모았다가 보낸다', async () => {
    const f = fake('ios');
    let answer: () => void = () => undefined;
    const att = new Promise<void>((r) => { answer = r; });
    const t = createTikTok({ group: G, test: true, waitForTracking: () => att }, f.env);
    t.start(V);
    t.track('signup_done');
    t.identify(42);
    t.adImpression();
    t.track('unknown_event');
    await flush();
    expect(f.calls).toEqual([]);   // ATT 답 전 — 아직 안 켬
    answer();
    await flush();
    expect(f.calls).toEqual(['init:sec-ios:6740000000:7123456789012345678:true']);
    f.resolveInit('TEST123');
    await flush();
    expect(t.isOn()).toBe(true);
    expect(f.calls.slice(1)).toEqual(['std:registration', 'id:42', 'std:ad_impression']);
  });

  it('안드는 기다리지 않고 안드 ID 로 켠다 · 다시 start 는 한 번만 · 열쇠가 바뀌면 바꿔 끼운다', async () => {
    const f = fake('android');
    const t = createTikTok({ group: G, waitForTracking: () => new Promise(() => undefined) }, f.env);
    t.start(V);
    t.start(V);
    await flush();
    expect(f.calls).toEqual(['init:sec-ios:kr.co.jcurve.carrotcash:7999999999999999999:false']);
    f.resolveInit();
    await flush();
    t.start({ ...V, 'carrot.tiktok_android_sdk_access': 'sec-and' });
    t.start({ ...V, 'carrot.tiktok_android_sdk_access': 'sec-and' });
    expect(f.calls.slice(1)).toEqual(['token:sec-and']);
  });

  it('값이 비거나 모듈이 없으면 아무 일도 하지 않는다', async () => {
    const f = fake('ios');
    const t = createTikTok({ group: G }, f.env);
    t.start({});
    t.start({ 'carrot.tiktok_sdk_access': 's' });   // 틱톡 앱 ID 없음
    await flush();
    expect(f.calls).toEqual([]);
    const g = fake('ios', false);
    const u = createTikTok({ group: G }, g.env);
    u.start(V); u.track('signup_done'); u.identify(1); u.logout(); u.adImpression();
    await flush();
    expect(g.calls).toEqual([]);
    expect(u.isOn()).toBe(false);
  });

  it('boot — 켤 때 읽고, 앞으로 올 때 다시 읽는다(열쇠 교체) · 읽기 실패는 조용히', async () => {
    const f = fake('android');
    const t = createTikTok({ group: G }, f.env);
    let n = 0;
    t.boot(async () => { n++; return n === 1 ? V : { ...V, 'carrot.tiktok_sdk_access': 'rotated' }; });
    await flush();
    f.resolveInit();
    await flush();
    f.fg();
    await flush();
    expect(f.calls).toEqual(['init:sec-ios:kr.co.jcurve.carrotcash:7999999999999999999:false', 'token:rotated']);
    const g = fake('android');
    createTikTok({ group: G }, g.env).boot(async () => { throw new Error('offline'); });
    await flush();
    expect(g.calls).toEqual([]);
  });

  it('identify 는 같은 회원을 두 번 보내지 않고, 켜기 전 로그아웃하면 버린다', async () => {
    const f = fake('android');
    const t = createTikTok({ group: G }, f.env);
    t.start(V);
    t.identify('7');
    t.logout();
    await flush();
    f.resolveInit();
    await flush();
    expect(f.calls.slice(1)).toEqual([]);
    t.identify(8); t.identify('8'); t.logout();
    expect(f.calls.slice(1)).toEqual(['id:8', 'logout']);
  });

  it('초기화 실패면 꺼진 채로 — 다음 start 에 다시 켠다', async () => {
    const f = fake('android');
    (f.native.initialize as any).mockImplementationOnce(() => Promise.reject(new Error('bad')));
    const t = createTikTok({ group: G }, f.env);
    t.start(V);
    await flush();
    expect(t.isOn()).toBe(false);
    t.start(V);
    await flush();
    expect((f.native.initialize as any).mock.calls.length).toBe(2);
  });
});

describe('보상형 광고가 열리면 틱톡 광고 열람(InAppADImpr)', () => {
  it('createRewarded({ tiktok }) · setTikTok 둘 다', async () => {
    const listeners = new Map<string, (x?: any) => void>();
    const ad = { addAdEventListener: (t: string, fn: any) => { listeners.set(t, fn); return () => undefined; }, load: () => undefined, show: () => Promise.resolve() };
    const sdk = {
      default: () => ({ initialize: async () => undefined, setRequestConfiguration: async () => undefined }),
      RewardedAd: { createForAdRequest: () => ad },
      TestIds: { REWARDED: 'T' },
      RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned' },
      AdEventType: { OPENED: 'opened', CLOSED: 'closed', ERROR: 'error' },
    };
    const env: AdsEnv = { sdk: () => sdk, tracking: () => null, os: () => 'android', appState: () => null, dev: () => false };
    const seen: string[] = [];
    const ads = createRewarded({ units: { rewarded: { android: 'U' } }, test: false, tiktok: { adImpression: () => { seen.push('a'); } } }, env);
    await ads.show({ onEarned: () => undefined, onFail: () => undefined });
    listeners.get('opened')?.();
    expect(seen).toEqual(['a']);
    ads.setTikTok({ adImpression: () => { seen.push('b'); } });
    listeners.get('closed')?.();
    await new Promise((r) => setTimeout(r, 1300));
    await ads.show({ onEarned: () => undefined, onFail: () => undefined });
    listeners.get('opened')?.();
    expect(seen).toEqual(['a', 'b']);
    // 틱톡이 던져도 광고는 그대로 연다
    ads.setTikTok({ adImpression: () => { throw new Error('x'); } });
    listeners.get('closed')?.();
    await new Promise((r) => setTimeout(r, 1300));
    let opened = 0;
    await ads.show({ onEarned: () => undefined, onFail: () => undefined, onOpened: () => { opened++; } });
    listeners.get('opened')?.();
    expect(opened).toBe(1);
  });
});

describe('config plugin — JitPack', () => {
  it('allprojects.repositories 에 한 번만 넣는다', () => {
    const { addJitpack } = require('../app.plugin.js');
    const base = "buildscript {}\nallprojects {\n  repositories {\n    google()\n  }\n}\n";
    const once = addJitpack(base);
    expect(once).toContain("maven { url 'https://jitpack.io' }");
    expect(addJitpack(once)).toBe(once);
    expect(addJitpack('buildscript {}\n')).toContain('allprojects {');
  });
});
