import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRewarded, type AdsEnv } from './ads';
import { createInterstitial } from './interstitial';
import { createBannerSession } from './banner';

const E = { LOADED: 'loaded', OPENED: 'opened', CLOSED: 'closed', ERROR: 'error', EARNED_REWARD: 'earned' };
class FakeAd {
  listeners = new Map<string, Set<(value?: any) => void>>();
  loads = 0; shows = 0;
  constructor(public kind: string, public unit: string, public options: any) {}
  addAdEventListener(event: string, callback: (value?: any) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => { this.listeners.get(event)!.delete(callback); };
  }
  emit(event: string, value?: any) { for (const fn of [...(this.listeners.get(event) ?? [])]) fn(value); }
  load() { this.loads++; }
  show() { this.shows++; return Promise.resolve(); }
}
function setup() {
  const made: FakeAd[] = [];
  const order: string[] = [];
  const listeners = new Set<(state: string) => void>();
  const state = { currentState: 'active', addEventListener: (_: string, fn: (state: string) => void) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } };
  const factory = (kind: string) => ({ createForAdRequest: (unit: string, options: any) => { const ad = new FakeAd(kind, unit, options); made.push(ad); return ad; } });
  const consent = {
    canRequestAds: true,
    gatherConsent: vi.fn(async () => { order.push('consent'); return { canRequestAds: consent.canRequestAds }; }),
    getConsentInfo: vi.fn(async () => ({ canRequestAds: consent.canRequestAds })),
    getUserChoices: vi.fn(async () => ({ storeAndAccessInformationOnDevice: true, createAPersonalisedAdsProfile: true, selectPersonalisedAds: true })),
  };
  const sdk = {
    AdsConsent: consent,
    default: () => ({ initialize: vi.fn(async () => { order.push('init'); }), setRequestConfiguration: vi.fn(async () => { order.push('test-config'); }) }),
    RewardedAd: factory('rewarded'), RewardedInterstitialAd: factory('rewarded-interstitial'), InterstitialAd: factory('interstitial'),
    BannerAd: () => null, BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'adaptive' },
    AdEventType: E, RewardedAdEventType: E,
    TestIds: { REWARDED: 'test-r', REWARDED_INTERSTITIAL: 'test-ri', INTERSTITIAL: 'test-i', BANNER: 'test-b' },
  };
  const env: AdsEnv = { sdk: () => sdk, os: () => 'android', appState: () => state, dev: () => false, tracking: () => null };
  const normal = (test = false, requestNonPersonalizedAdsOnly?: boolean) => createInterstitial({ units: { interstitial: { android: 'unit-i', ios: 'ios-i' } }, test, requestNonPersonalizedAdsOnly }, env);
  const rewarded = () => createRewarded({ units: { rewarded: { android: 'unit-r' }, rewardedInterstitial: { android: 'unit-ri' } }, test: false }, env);
  const change = (next: string) => { state.currentState = next; for (const listener of [...listeners]) listener(next); };
  return { made, env, sdk, consent, state, listeners, order, normal, rewarded, change };
}
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('single common fullscreen owner', () => {
  it.each([false, true])('rewarded format %s blocks normal and a second rewarded instance', async (interstitial) => {
    const s = setup(); const first = s.rewarded();
    const result = first.play({ interstitial }); await flush();
    expect((await s.normal().play()).busy).toBe(true);
    expect((await s.rewarded().play({})).busy).toBe(true);
    expect(s.made).toHaveLength(1);
    s.made[0].emit(E.LOADED); s.made[0].emit(E.OPENED); s.made[0].emit(E.EARNED_REWARD); s.made[0].emit(E.CLOSED);
    expect((await result).earned).toBe(true);
    const normal = s.normal(); const next = normal.play(); await flush();
    expect(s.made).toHaveLength(2); normal.cancel(); await next;
  });
  it('normal locks rewarded synchronously while consent is pending, then releases on cancel', async () => {
    const s = setup(); s.consent.gatherConsent.mockImplementation(() => new Promise(() => {}));
    const ad = s.normal(); const result = ad.play();
    expect((await s.rewarded().play({})).busy).toBe(true);
    ad.cancel(); expect(await result).toMatchObject({ cancelled: true, noAd: true, busy: false });
    expect(s.made).toHaveLength(0); expect(s.listeners.size).toBe(0);
    await flush(); expect(s.made).toHaveLength(0);
  });
  it('cancel during native initialization settles immediately and ignores its late completion', async () => {
    const s = setup(); let release!: () => void;
    s.sdk.default = () => ({ initialize: () => new Promise((resolve) => { release = () => resolve(undefined); }), setRequestConfiguration: async () => {} }) as any;
    const ad = s.normal(); const result = ad.play(); await flush();
    ad.cancel(); expect(await result).toMatchObject({ cancelled: true, noAd: true, busy: false });
    release(); await flush(); expect(s.made).toHaveLength(0); expect(s.listeners.size).toBe(0);
    const next = s.rewarded(); const p = next.play({}); await flush(); expect(s.made).toHaveLength(1); next.cancel(); await p;
  });
  it('cancel after OPENED retains lease until native CLOSED, prevents second fullscreen', async () => {
    const s = setup(); const ad = s.normal(); const result = ad.play(); await flush();
    s.made[0].emit(E.LOADED); s.made[0].emit(E.OPENED); ad.cancel();
    expect(await result).toMatchObject({ opened: true, cancelled: true, noAd: false });
    expect((await s.rewarded().play({})).busy).toBe(true);
    s.made[0].emit(E.CLOSED);
    const next = s.rewarded(); const p = next.play({}); await flush(); expect(s.made).toHaveLength(2); next.cancel(); await p;
  });
  it('duplicate loaded/opened/closed events and saved late callbacks cannot repeat display or final result', async () => {
    const s = setup(); const ad = s.normal(); const onOpened = vi.fn(); const onClosed = vi.fn(); const onFail = vi.fn();
    await ad.show({ onOpened, onClosed, onFail }); const native = s.made[0];
    const lateLoad = [...native.listeners.get(E.LOADED)!][0];
    native.emit(E.LOADED); native.emit(E.LOADED); native.emit(E.OPENED); native.emit(E.OPENED); native.emit(E.CLOSED); native.emit(E.CLOSED);
    lateLoad(); native.emit(E.ERROR, { code: 'no-fill' });
    expect(native.shows).toBe(1); expect(onOpened).toHaveBeenCalledTimes(1); expect(onClosed).toHaveBeenCalledTimes(1); expect(onFail).not.toHaveBeenCalled();
    expect(s.listeners.size).toBe(0); expect([...native.listeners.values()].every((set) => set.size === 0)).toBe(true);
  });
  it('reward callback arrives once, including duplicate late EARNED inside close grace', async () => {
    const s = setup(); const onEarned = vi.fn(); const onClosed = vi.fn(); const onFail = vi.fn();
    await s.rewarded().show({ onEarned, onClosed, onFail }); const ad = s.made[0];
    ad.emit(E.OPENED); ad.emit(E.CLOSED); vi.advanceTimersByTime(800); ad.emit(E.EARNED_REWARD); ad.emit(E.EARNED_REWARD);
    expect(onEarned).toHaveBeenCalledTimes(1); expect(onClosed).toHaveBeenCalledTimes(1); expect(onFail).not.toHaveBeenCalled();
    expect(s.listeners.size).toBe(0);
  });
});

describe('foreground, no-fill and preparation', () => {
  it('no SDK, web, missing unit and initial background return noAd with no request', async () => {
    for (const mode of ['missing-sdk', 'web', 'unit', 'background']) {
      const s = setup();
      if (mode === 'missing-sdk') s.env.sdk = () => null;
      if (mode === 'web') s.env.os = () => 'web';
      if (mode === 'background') s.change('background');
      const ads = mode === 'unit' ? createInterstitial({ units: { interstitial: {} }, test: false }, s.env) : s.normal();
      expect(await ads.play()).toMatchObject({ opened: false, noAd: true, busy: false }); expect(s.made).toHaveLength(0);
    }
  });
  it('background during load cancels once and a saved late LOADED cannot present', async () => {
    const s = setup(); const result = s.normal().play(); await flush();
    const ad = s.made[0]; const late = [...ad.listeners.get(E.LOADED)!][0];
    s.change('background'); late(); s.change('active');
    expect(await result).toMatchObject({ cancelled: true, noAd: true }); expect(ad.shows).toBe(0);
  });
  it('no-fill and timeout settle once, remove listeners and allow another instance', async () => {
    const s = setup(); const result = s.normal().play(); await flush();
    s.made[0].emit(E.ERROR, { code: 'googleMobileAds/no-fill' });
    expect(await result).toMatchObject({ noAd: true, opened: false, busy: false, message: expect.stringContaining('지금은') });
    const next = s.normal().play(); await flush(); vi.advanceTimersByTime(15_000);
    expect(await next).toMatchObject({ noAd: true, busy: false }); expect(s.listeners.size).toBe(0);
  });
  it('constructor and warm do not initialize or request, consent precedes init', async () => {
    const s = setup(); const ad = s.normal(); ad.warm(); expect(ad.warmReady()).toBe(false);
    expect(s.order).toEqual([]); expect(s.made).toHaveLength(0);
    const result = ad.play(); await flush(); expect(s.order).toEqual(['consent', 'init']); ad.cancel(); await result;
  });
  it('missing UMP fails closed and background during consent cancels before a late resolution', async () => {
    const missing = setup(); (missing.sdk as any).AdsConsent = undefined;
    const unavailable = missing.normal().play(); await flush(); expect(await unavailable).toMatchObject({ noAd: true });
    expect(missing.order).toEqual([]); expect(missing.made).toHaveLength(0);
    const s = setup(); let release!: () => void;
    s.consent.gatherConsent.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ canRequestAds: true }); }));
    const result = s.normal().play(); s.change('background');
    expect(await result).toMatchObject({ cancelled: true, noAd: true }); release(); await flush();
    expect(s.made).toHaveLength(0); expect(s.order).toEqual([]); expect(s.listeners.size).toBe(0);
  });
  it('a timed-out UMP form blocks requests and a second tap does not launch another form', async () => {
    const s = setup(); s.consent.gatherConsent.mockImplementation(() => new Promise(() => {}));
    const result = s.normal().play(); await flush(); vi.advanceTimersByTime(45_000); await flush();
    expect(await result).toMatchObject({ noAd: true, busy: false }); expect(s.made).toHaveLength(0);
    const next = s.normal(); const p = next.play(); await flush();
    expect(s.consent.gatherConsent).toHaveBeenCalledTimes(1); next.cancel(); await p;
  });
  it('request factory throw and show promise rejection settle cleanly, callbacks may throw', async () => {
    const s = setup(); s.sdk.InterstitialAd.createForAdRequest = () => { throw new Error('factory failed'); };
    const failed = s.normal().play(); await flush(); expect(await failed).toMatchObject({ noAd: true, busy: false }); expect(s.listeners.size).toBe(0);
    const r = setup(); const result = r.normal().play({ onOpened: () => { throw new Error('consumer'); } }); await flush();
    r.made[0].show = () => Promise.reject(new Error('show failed')); r.made[0].emit(E.LOADED); await flush();
    expect(await result).toMatchObject({ noAd: true, busy: false }); expect(r.listeners.size).toBe(0);
  });
  it('factory instances with different AppState adapters still share one SDK fullscreen lock', async () => {
    const s = setup(); const first = s.normal(); const pending = first.play(); await flush();
    const otherEnv = { ...s.env, appState: () => ({ currentState: 'active', addEventListener: () => ({ remove: () => {} }) }) };
    const other = createRewarded({ units: { rewarded: { android: 'rewarded' } }, test: true }, otherEnv);
    expect((await other.play({})).busy).toBe(true); first.cancel(); await pending;
  });
  it('test device added after another format initialized is registered before its real-unit request', async () => {
    const s = setup(); const first = s.normal(); const p = first.play(); await flush(); first.cancel(); await p;
    const rewarded = createRewarded({ units: { rewarded: { android: 'real-unit' } }, test: false, testDevices: ['device'] }, s.env);
    const next = rewarded.play({}); await flush();
    expect(s.order).toEqual(['consent', 'init', 'test-config']); expect(s.made[1].unit).toBe('real-unit'); rewarded.cancel(); await next;
  });
  it('timed-out test device registration cannot be bypassed by a later format', async () => {
    const s = setup(); const initialize = vi.fn(async () => {});
    s.sdk.default = () => ({ initialize, setRequestConfiguration: vi.fn(() => new Promise(() => {})) }) as any;
    const first = createInterstitial({ units: { interstitial: { android: 'real-unit' } }, test: false, testDevices: ['device'] }, s.env);
    const p = first.play(); await flush(); vi.advanceTimersByTime(5000); await flush();
    expect(await p).toMatchObject({ noAd: true });
    const other = s.rewarded(); const next = other.play({}); await flush(); vi.advanceTimersByTime(5000); await flush();
    expect(await next).toMatchObject({ noAd: true }); expect(initialize).not.toHaveBeenCalled(); expect(s.made).toHaveLength(0);
  });
  it('false or absent canRequestAds blocks initialize and all request formats', async () => {
    for (const mode of ['normal', 'rewarded', 'banner']) {
      const s = setup(); s.consent.canRequestAds = false;
      if (mode === 'banner') { const b = createBannerSession({ units: { android: 'banner' }, test: true, onHeightChange: vi.fn() }, 320, s.env); b.mount(); await flush(); expect(b.getState()).toEqual({ height: 0, request: null }); b.unmount(); }
      else { const result = mode === 'normal' ? s.normal().play() : s.rewarded().play({}); await flush(); expect(await result).toMatchObject({ noAd: true, busy: false }); }
      expect(s.made).toHaveLength(0); expect(s.order).toEqual(['consent']);
    }
  });
  it('UMP refresh error uses genuine cached canRequestAds only', async () => {
    const s = setup(); s.consent.gatherConsent.mockRejectedValue(new Error('network'));
    const ads = s.normal(); const result = ads.play(); await flush(); expect(s.made).toHaveLength(1); ads.cancel(); await result;
    s.consent.canRequestAds = false;
    const rejected = s.normal().play(); await flush(); expect(await rejected).toMatchObject({ noAd: true }); expect(s.made).toHaveLength(1);
  });
  it('NPA default, declined personalization and iOS denied ATT cannot request personalized ads', async () => {
    for (const mode of ['default', 'declined', 'ios-denied', 'allowed']) {
      const s = setup();
      if (mode === 'declined') s.consent.getUserChoices.mockResolvedValue({ storeAndAccessInformationOnDevice: true, createAPersonalisedAdsProfile: false, selectPersonalisedAds: false });
      if (mode === 'ios-denied') { s.env.os = () => 'ios'; s.env.tracking = () => ({ getTrackingPermissionsAsync: async () => ({ status: 'denied' }) }); }
      const ads = s.normal(false, mode === 'default' ? undefined : false); const result = ads.play(); await flush();
      expect(s.made[0].options.requestNonPersonalizedAdsOnly).toBe(mode !== 'allowed'); ads.cancel(); await result;
    }
  });
  it('normal test uses Google test unit and never sends SSV or an earned field', async () => {
    const s = setup(); const ad = s.normal(true); const result = ad.play(); await flush();
    expect(s.made[0].unit).toBe('test-i'); expect(s.made[0].options.serverSideVerificationOptions).toBeUndefined();
    s.made[0].emit(E.OPENED); s.made[0].emit(E.CLOSED); expect(await result).toEqual({ opened: true, busy: false, noAd: false, cancelled: false });
  });
});

describe('presentation committed before SDK OPENED (independent-review regressions)', () => {
  it.each(['interstitial', 'rewarded', 'rewarded-interstitial'])('cancel retains native lease and does not assert noAd: %s', async (format) => {
    const s = setup(); const first = format === 'interstitial' ? s.normal() : s.rewarded();
    const result = first.play({ interstitial: format === 'rewarded-interstitial' }); await flush();
    const ad = s.made[0]; ad.emit(E.LOADED); first.cancel();
    expect(await result).toMatchObject({ opened: false, busy: false, noAd: false });
    expect((await s.normal().play()).busy).toBe(true); expect(s.made).toHaveLength(1);
    ad.emit(E.OPENED); // Late OPENED only updates internal lifecycle, never reopens app callbacks/results.
    ad.emit(E.CLOSED);
    const next = s.normal(); const p = next.play(); await flush(); expect(s.made).toHaveLength(2); next.cancel(); await p;
  });
  it.each(['inactive', 'background'])('iOS retains presentation until foreground recovery without OPENED: %s', async (state) => {
    const s = setup(); s.env.os = () => 'ios'; const first = s.normal(); const result = first.play(); await flush();
    s.made[0].emit(E.LOADED); s.change(state); expect(await result).toMatchObject({ cancelled: true, noAd: false });
    const otherEnv = { ...s.env, appState: () => ({ currentState: 'active', addEventListener: () => ({ remove: () => {} }) }) };
    const other = createInterstitial({ units: { interstitial: { android: 'unit' } }, test: true }, otherEnv);
    expect((await other.play()).busy).toBe(true); expect(s.made).toHaveLength(1);
    s.change('active'); const next = s.normal(); const p = next.play(); await flush(); expect(s.made).toHaveLength(2); next.cancel(); await p;
  });
  it('presentation timeout returns failure without releasing an in-flight native lease', async () => {
    const s = setup(); const result = s.normal().play(); await flush(); s.made[0].emit(E.LOADED);
    vi.advanceTimersByTime(15_000); expect(await result).toMatchObject({ opened: false, noAd: false, busy: false });
    expect((await s.rewarded().play({})).busy).toBe(true); expect(s.made).toHaveLength(1); s.made[0].emit(E.CLOSED); expect(s.listeners.size).toBe(0);
  });
  it('CLOSED without OPENED calls exactly one terminal callback', async () => {
    const s = setup(); const terminal: string[] = [];
    await s.normal().show({ onClosed: () => terminal.push('closed'), onFail: () => terminal.push('fail'), onAbort: () => terminal.push('abort') });
    s.made[0].emit(E.LOADED); s.made[0].emit(E.CLOSED); s.made[0].emit(E.CLOSED);
    expect(terminal).toEqual(['fail']); expect(s.listeners.size).toBe(0);
  });
  it('iOS UMP and ATT complete before SDK initialization or rewarded request', async () => {
    const s = setup(); s.env.os = () => 'ios'; let status = 'undetermined';
    s.env.tracking = () => ({ getTrackingPermissionsAsync: async () => ({ status }), requestTrackingPermissionsAsync: async () => { s.order.push('att'); status = 'denied'; return { status }; } });
    const first = createRewarded({ units: { rewarded: { ios: 'ios-r' } }, test: false }, s.env);
    const result = first.play({}); await flush(); expect(s.order).toEqual(['consent']);
    vi.advanceTimersByTime(600); await flush(); expect(s.order).toEqual(['consent', 'att', 'init']); expect(s.made).toHaveLength(1);
    expect(s.made[0].options.requestNonPersonalizedAdsOnly).toBe(true); first.cancel(); await result;
  });
  it('native show promise rejection after cancel releases lease with no second terminal', async () => {
    const s = setup(); const controller = s.normal(); const abort = vi.fn(); const fail = vi.fn();
    await controller.show({ onAbort: abort, onFail: fail }); let reject!: (error: Error) => void;
    s.made[0].show = () => new Promise((_, r) => { reject = r; });
    s.made[0].emit(E.LOADED); controller.cancel(); expect(abort).toHaveBeenCalledTimes(1);
    reject(new Error('native show rejected'));
    await flush(); expect(fail).not.toHaveBeenCalled(); expect(s.listeners.size).toBe(0);
    const next = s.rewarded(); const p = next.play({}); await flush(); expect(s.made).toHaveLength(2); next.cancel(); await p;
  });
  it('SDK didFailToPresent ERROR before OPENED confirms noAd and permits retry without CLOSED', async () => {
    const s = setup(); const controller = s.normal(); const result = controller.play(); await flush();
    s.made[0].emit(E.LOADED); s.made[0].emit(E.ERROR, { code: 'native' });
    expect(await result).toMatchObject({ opened: false, noAd: true, busy: false }); expect(s.listeners.size).toBe(0);
    const next = s.rewarded(); const p = next.play({}); await flush(); expect(s.made).toHaveLength(2); next.cancel(); await p;
  });
  it('SDK presentation ERROR after cancel releases lease without a second terminal', async () => {
    const s = setup(); const controller = s.normal(); const abort = vi.fn(); const fail = vi.fn();
    await controller.show({ onAbort: abort, onFail: fail }); s.made[0].emit(E.LOADED); controller.cancel(); s.made[0].emit(E.ERROR, { code: 'native' });
    expect(abort).toHaveBeenCalledTimes(1); expect(fail).not.toHaveBeenCalled(); expect(s.listeners.size).toBe(0);
    const next = s.rewarded(); const p = next.play({}); await flush(); expect(s.made).toHaveLength(2); next.cancel(); await p;
  });
});

describe('Android native AdActivity transition (2026-10-13 device regression)', () => {
  it.each(['interstitial', 'rewarded', 'rewarded-interstitial'])('background before OPENED preserves exactly one native display and terminal: %s', async (format) => {
    const s = setup(), first = format === 'interstitial' ? s.normal() : s.rewarded();
    const opened = vi.fn(), closed = vi.fn(), failed = vi.fn(), aborted = vi.fn(), earned = vi.fn();
    await first.show({ interstitial: format === 'rewarded-interstitial', onOpened: opened, onClosed: closed, onFail: failed, onAbort: aborted, onEarned: earned });
    const ad = s.made[0]; ad.emit(E.LOADED);
    s.change('background'); s.change('active'); // AdActivity resume can reach JS before the SDK event.
    expect(aborted).not.toHaveBeenCalled(); expect(failed).not.toHaveBeenCalled(); expect(closed).not.toHaveBeenCalled();
    expect((await s.normal().play()).busy).toBe(true); expect((await s.rewarded().play({})).busy).toBe(true);
    ad.emit(E.OPENED); ad.emit(E.OPENED); expect(opened).toHaveBeenCalledTimes(1);
    s.change('background'); s.change('active');
    expect(closed).not.toHaveBeenCalled(); expect((await s.normal().play()).busy).toBe(true);
    if (format !== 'interstitial') ad.emit(E.EARNED_REWARD);
    ad.emit(E.CLOSED); ad.emit(E.CLOSED);
    expect(closed).toHaveBeenCalledTimes(1); expect(aborted).not.toHaveBeenCalled(); expect(failed).not.toHaveBeenCalled();
    expect(ad.shows).toBe(1); expect(s.made).toHaveLength(1); expect(s.listeners.size).toBe(0);
    const next = s.normal(), p = next.play(); await flush(); expect(s.made).toHaveLength(2); next.cancel(); await p;
  });
  it.each(['interstitial', 'rewarded', 'rewarded-interstitial'])('actual presentation sequence completes play without a fabricated user cancellation: %s', async (format) => {
    const s = setup(), first = format === 'interstitial' ? s.normal() : s.rewarded(), opened = vi.fn();
    const result = first.play({ interstitial: format === 'rewarded-interstitial', onOpened: opened }); let settled = false;
    void result.then(() => { settled = true; }); await flush();
    const ad = s.made[0]; ad.emit(E.LOADED); s.change('background'); await flush();
    expect(settled).toBe(false); ad.emit(E.OPENED); s.change('active'); await flush(); expect(settled).toBe(false);
    if (format !== 'interstitial') ad.emit(E.EARNED_REWARD);
    ad.emit(E.CLOSED); const final = await result;
    expect(final).toMatchObject({ opened: true, noAd: false, busy: false }); expect(opened).toHaveBeenCalledTimes(1);
    if (format === 'interstitial') expect(final).toMatchObject({ cancelled: false });
    else expect(final).toMatchObject({ earned: true });
  });
  it.each(['cancel', 'timeout'])('UI feedback does not release Android presentation on foreground recovery: %s', async (mode) => {
    const s = setup(), first = s.normal(), opened = vi.fn(), result = first.play({ onOpened: opened }); await flush();
    const ad = s.made[0], lateOpen = [...ad.listeners.get(E.OPENED)!][0], lateClose = [...ad.listeners.get(E.CLOSED)!][0];
    ad.emit(E.LOADED); s.change('background');
    if (mode === 'cancel') first.cancel(); else vi.advanceTimersByTime(15_000);
    expect(await result).toMatchObject({ opened: false, noAd: false }); s.change('active');
    expect((await s.rewarded().play({})).busy).toBe(true); lateOpen(); expect(opened).not.toHaveBeenCalled();
    lateClose(); const next = s.normal(), p = next.play(); await flush(); expect(s.made).toHaveLength(2);
    lateOpen(); lateClose(); expect(opened).not.toHaveBeenCalled(); next.cancel(); await p;
  });
  it('SDK ERROR before OPENED releases the Android gate without CLOSED', async () => {
    const s = setup(), first = s.normal(), result = first.play(); await flush();
    s.made[0].emit(E.LOADED); s.change('background'); s.made[0].emit(E.ERROR, { code: 'null-activity' });
    expect(await result).toMatchObject({ opened: false, noAd: true, cancelled: false });
    s.change('active'); const next = s.normal(), p = next.play(); await flush(); expect(s.made).toHaveLength(2); next.cancel(); await p;
  });
  it.each(['consent', 'init', 'load'])('genuine app background before native show still cancels and ignores late SDK events: %s', async (stage) => {
    const s = setup(); let release: () => void = () => {};
    if (stage === 'consent') s.consent.gatherConsent.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ canRequestAds: true }); }));
    if (stage === 'init') s.sdk.default = () => ({ initialize: () => new Promise((resolve) => { release = () => resolve(undefined); }), setRequestConfiguration: async () => {} }) as any;
    const first = s.normal(), opened = vi.fn(), result = first.play({ onOpened: opened }); await flush();
    const ad = s.made[0], late = ad ? [...ad.listeners.values()].flatMap((set) => [...set]) : [];
    s.change('background'); expect(await result).toMatchObject({ cancelled: true, noAd: true, opened: false });
    release(); s.change('active'); for (const fn of late) fn(); await flush();
    expect(opened).not.toHaveBeenCalled(); expect(ad?.shows ?? 0).toBe(0); expect(s.listeners.size).toBe(0);
  });
  it('saved stale OPENED/EARNED/CLOSED callbacks cannot affect a newer rewarded request', async () => {
    const s = setup(), first = s.rewarded(), earned = vi.fn(), result = first.play({}); await flush();
    const ad = s.made[0], callbacks = [...ad.listeners.values()].flatMap((set) => [...set]);
    first.cancel(); await result;
    const next = s.rewarded(), nextResult = next.play({ onOpened: earned }); await flush();
    for (const callback of callbacks) callback();
    expect(earned).not.toHaveBeenCalled(); expect(s.made[0].shows).toBe(0); expect(s.made[1].shows).toBe(0);
    expect((await s.normal().play()).busy).toBe(true); next.cancel(); await nextResult;
  });
});

describe('anchored adaptive banner native lifecycle', () => {
  it('only actual LOADED height expands, duplicate load is ignored and failure collapses', async () => {
    const s = setup(); const heights = vi.fn(); const loaded = vi.fn(); const fail = vi.fn();
    const banner = createBannerSession({ units: { android: 'banner' }, test: true, onHeightChange: heights, onLoaded: loaded, onFail: fail }, 360, s.env);
    banner.mount(); await flush();
    const req = banner.getState().request!;
    expect(req).toMatchObject({ unitId: 'test-b', width: 360, size: 'adaptive', requestOptions: { requestNonPersonalizedAdsOnly: true } });
    expect(banner.getState().height).toBe(0);
    req.onSizeChange({ width: 360, height: 61 }); expect(banner.getState().height).toBe(0);
    req.onAdLoaded({ width: 360, height: 61 }); req.onAdLoaded({ width: 360, height: 90 });
    expect(banner.getState().height).toBe(61); expect(loaded).toHaveBeenCalledTimes(1);
    req.onSizeChange({ width: 360, height: 72 }); expect(banner.getState().height).toBe(72);
    req.onAdFailedToLoad({ code: 'no-fill' }); expect(banner.getState()).toEqual({ height: 0, request: null });
    expect(heights.mock.calls.map(([height]) => height)).toEqual([0, 61, 72, 0]); expect(fail).toHaveBeenCalledTimes(1);
    req.onAdLoaded({ width: 360, height: 61 }); expect(banner.getState().height).toBe(0); banner.unmount();
  });
  it('background removes native request, ignores stale callbacks, resumes only when foreground', async () => {
    const s = setup(); const heights = vi.fn(); const banner = createBannerSession({ units: { android: 'banner' }, test: false, onHeightChange: heights }, 320, s.env);
    banner.mount(); await flush(); const req = banner.getState().request!; req.onAdLoaded({ width: 320, height: 50 });
    s.change('background'); expect(banner.getState()).toEqual({ height: 0, request: null }); req.onAdLoaded({ width: 320, height: 80 });
    s.change('active'); await flush(); const next = banner.getState().request!; expect(next.id).not.toBe(req.id); expect(banner.getState().height).toBe(0);
    banner.unmount(); next.onAdLoaded({ width: 320, height: 50 }); expect(banner.getState().request).toBeNull(); expect(s.listeners.size).toBe(0);
  });
  it('disabled, web, missing SDK, invalid width and no unit never start UMP/request', async () => {
    for (const mode of ['disabled', 'web', 'sdk', 'width', 'unit']) {
      const s = setup(); if (mode === 'web') s.env.os = () => 'web'; if (mode === 'sdk') s.env.sdk = () => null;
      const banner = createBannerSession({ units: mode === 'unit' ? {} : { android: 'banner' }, test: false, enabled: mode !== 'disabled', onHeightChange: vi.fn() }, mode === 'width' ? NaN : 320, s.env);
      banner.mount(); await flush(); expect(banner.getState()).toEqual({ height: 0, request: null }); expect(s.order).toEqual([]); banner.unmount();
    }
  });
  it('unmount during pending consent and invalid/timeout loaded dimensions cannot show fake height', async () => {
    const s = setup(); let release!: () => void;
    s.consent.gatherConsent.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ canRequestAds: true }); }));
    const a = createBannerSession({ units: { android: 'banner' }, test: true, onHeightChange: vi.fn() }, 320, s.env);
    a.mount(); a.unmount(); release(); await flush(); expect(a.getState()).toEqual({ height: 0, request: null });
    const b = createBannerSession({ units: { android: 'banner' }, test: true, onHeightChange: vi.fn() }, 320, s.env);
    b.mount(); await flush(); b.getState().request!.onAdLoaded({ width: 320, height: 0 }); expect(b.getState()).toEqual({ height: 0, request: null }); b.unmount();
    const c = createBannerSession({ units: { android: 'banner' }, test: true, onHeightChange: vi.fn() }, 320, s.env);
    c.mount(); await flush(); vi.advanceTimersByTime(15_000); expect(c.getState()).toEqual({ height: 0, request: null }); c.unmount();
  });
  it('a native fullscreen lease collapses a loaded banner and foreground before CLOSED cannot recreate it', async () => {
    const s = setup(), heights = vi.fn(), banner = createBannerSession({ units: { android: 'banner' }, test: true, onHeightChange: heights }, 320, s.env);
    banner.mount(); await flush(); const old = banner.getState().request!; old.onAdLoaded({ width: 320, height: 64 });
    const normal = s.normal(), result = normal.play(); await flush(); expect(banner.getState()).toEqual({ height: 0, request: null });
    const ad = s.made[0]; ad.emit(E.LOADED); s.change('background'); s.change('active'); await flush();
    expect(banner.getState()).toEqual({ height: 0, request: null }); old.onAdLoaded({ width: 320, height: 100 }); old.onSizeChange({ width: 320, height: 100 });
    expect(banner.getState().height).toBe(0); ad.emit(E.OPENED); ad.emit(E.CLOSED); await result; await flush();
    const next = banner.getState().request!; expect(next).not.toBeNull(); expect(next.id).not.toBe(old.id);
    next.onAdLoaded({ width: 320, height: 50 }); expect(banner.getState().height).toBe(50); banner.unmount(); expect(s.listeners.size).toBe(0);
  });
  it('fullscreen acquisition invalidates pending banner preparation, unmount removes the shared lease observer', async () => {
    const s = setup(); let release!: () => void;
    s.sdk.default = () => ({ initialize: () => new Promise((resolve) => { release = () => resolve(undefined); }), setRequestConfiguration: async () => {} }) as any;
    const heights = vi.fn(), banner = createBannerSession({ units: { android: 'banner' }, test: true, onHeightChange: heights }, 320, s.env);
    banner.mount(); await flush(); const first = s.normal(), result = first.play(); await flush();
    release(); await flush(); expect(banner.getState()).toEqual({ height: 0, request: null });
    s.made[0].emit(E.LOADED); s.change('background'); s.made[0].emit(E.OPENED); s.change('active');
    banner.unmount(); const calls = heights.mock.calls.length; s.made[0].emit(E.CLOSED); await result; await flush();
    expect(heights).toHaveBeenCalledTimes(calls); expect(banner.getState()).toEqual({ height: 0, request: null }); expect(s.listeners.size).toBe(0);
  });
  it('close while truly backgrounded waits for active before restoring the banner', async () => {
    const s = setup(), first = s.normal(), result = first.play(); await flush();
    const banner = createBannerSession({ units: { android: 'banner' }, test: true, onHeightChange: vi.fn() }, 320, s.env); banner.mount(); await flush();
    s.made[0].emit(E.LOADED); s.change('background'); s.made[0].emit(E.OPENED); s.made[0].emit(E.CLOSED); await result; await flush();
    expect(banner.getState()).toEqual({ height: 0, request: null }); s.change('active'); await flush(); expect(banner.getState().request).not.toBeNull(); banner.unmount();
  });
});
