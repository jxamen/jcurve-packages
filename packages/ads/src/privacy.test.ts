import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdsPrivacy } from './privacy';
import { createInterstitial } from './interstitial';
import { createRewarded, type AdsEnv } from './ads';
import { createBannerSession } from './banner';

const E = { LOADED: 'loaded', OPENED: 'opened', CLOSED: 'closed', ERROR: 'error', EARNED_REWARD: 'earned' };
class Ad {
  callbacks = new Map<string, Set<(value?: any) => void>>();
  addAdEventListener(name: string, fn: (value?: any) => void) {
    if (!this.callbacks.has(name)) this.callbacks.set(name, new Set());
    this.callbacks.get(name)!.add(fn); return () => { this.callbacks.get(name)!.delete(fn); };
  }
  load() {}
  show() { return Promise.resolve(); }
  emit(name: string) { for (const fn of [...(this.callbacks.get(name) ?? [])]) fn(); }
}
function setup(os = 'android') {
  const listeners = new Set<(state: string) => void>();
  const state = { currentState: 'active', addEventListener: (_: string, fn: (state: string) => void) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } };
  const info = { privacyOptionsRequirementStatus: 'REQUIRED', canRequestAds: true };
  const made: Ad[] = [];
  const factory = { createForAdRequest: vi.fn(() => { const ad = new Ad(); made.push(ad); return ad; }) };
  const mobile = { initialize: vi.fn(async () => {}), setRequestConfiguration: vi.fn(async () => {}) };
  const consent = {
    requestInfoUpdate: vi.fn(async (_options: any) => ({ ...info })),
    getConsentInfo: vi.fn(async () => ({ ...info })),
    showPrivacyOptionsForm: vi.fn(async () => ({ ...info })),
    gatherConsent: vi.fn(async (_options: any) => ({ ...info })),
    getUserChoices: vi.fn(async () => ({ storeAndAccessInformationOnDevice: true, createAPersonalisedAdsProfile: true, selectPersonalisedAds: true })),
  };
  const sdk = { AdsConsent: consent, default: vi.fn(() => mobile), InterstitialAd: factory, RewardedAd: factory, RewardedInterstitialAd: factory,
    AdEventType: E, RewardedAdEventType: E, TestIds: { INTERSTITIAL: 'I', REWARDED: 'R', REWARDED_INTERSTITIAL: 'RI', BANNER: 'B' },
    BannerAd: () => null, BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ADAPTIVE' } };
  const env: AdsEnv = { sdk: () => sdk, os: () => os, dev: () => false, appState: () => state, tracking: () => null };
  const privacy = () => createAdsPrivacy({ testDevices: ['DEVICE'] }, env);
  const normal = () => createInterstitial({ units: { interstitial: { android: 'unit', ios: 'unit' } }, test: true }, env);
  const rewarded = () => createRewarded({ units: { rewarded: { android: 'unit', ios: 'unit' } }, test: true }, env);
  const banner = () => createBannerSession({ units: { android: 'unit', ios: 'unit' }, test: true, onHeightChange: vi.fn() }, 320, env);
  const change = (next: string) => { state.currentState = next; for (const fn of [...listeners]) fn(next); };
  const noAds = () => { expect(mobile.initialize).not.toHaveBeenCalled(); expect(mobile.setRequestConfiguration).not.toHaveBeenCalled(); expect(made).toHaveLength(0); };
  return { sdk, env, state, consent, info, made, mobile, listeners, privacy, normal, rewarded, banner, change, noAds };
}
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('authoritative UMP privacy interface without advertising side effects', () => {
  it('ending privacy settings never automatically restores a previously enabled banner request', async () => {
    const s = setup(), banner = s.banner(); banner.mount(); await flush();
    const request = banner.getState().request!; request.onAdLoaded({ width: 320, height: 50 });
    const before = s.consent.gatherConsent.mock.calls.length;
    expect((await s.privacy().show()).status).toBe('shown'); await flush();
    expect(banner.getState()).toEqual({ height: 0, request: null });
    request.onAdLoaded({ width: 320, height: 100 }); expect(banner.getState().height).toBe(0);
    expect(s.consent.gatherConsent).toHaveBeenCalledTimes(before); expect(s.made).toHaveLength(0);
    banner.unmount(); expect(s.listeners.size).toBe(0);
  });
  it.each(['ios', 'android'])('reads SDK requirement and uses only UMP test-device options: %s', async (os) => {
    const s = setup(os); const privacy = s.privacy(); expect(privacy.available).toBe(true);
    expect(s.consent.requestInfoUpdate).not.toHaveBeenCalled(); s.noAds();
    expect(await privacy.getStatus()).toEqual({ status: 'checked', info: { requirement: 'required', canRequestAds: true } });
    expect(s.consent.requestInfoUpdate).toHaveBeenCalledWith({ testDeviceIdentifiers: ['DEVICE'] });
    expect(s.consent.showPrivacyOptionsForm).not.toHaveBeenCalled(); expect(s.consent.gatherConsent).not.toHaveBeenCalled();
    expect(s.sdk.default).not.toHaveBeenCalled(); expect(s.listeners.size).toBe(0); s.noAds();
  });
  it.each(['REQUIRED', 'NOT_REQUIRED', 'UNKNOWN', 'invalid', undefined])('never infers a privacy requirement from canRequestAds: %s', async (requirement) => {
    const s = setup(); (s.info as any).privacyOptionsRequirementStatus = requirement; s.info.canRequestAds = false;
    const result = await s.privacy().getStatus();
    expect(result.info).toEqual({ requirement: requirement === 'REQUIRED' ? 'required' : requirement === 'NOT_REQUIRED' ? 'not-required' : 'unknown', canRequestAds: false });
    expect(result.status).toBe(requirement === 'REQUIRED' || requirement === 'NOT_REQUIRED' ? 'checked' : 'unknown'); s.noAds();
  });
  it.each([undefined, null, 'true', 1])('missing/non-boolean SDK canRequestAds stays unknown: %s', async (value) => {
    const s = setup(); (s.info as any).canRequestAds = value;
    expect((await s.privacy().getStatus()).info.canRequestAds).toBeNull(); s.noAds();
  });
  it('required form reads authoritative updated consent after completion, not the form payload', async () => {
    const s = setup(); s.consent.showPrivacyOptionsForm.mockImplementation(async () => { s.info.canRequestAds = false; return { privacyOptionsRequirementStatus: 'NOT_REQUIRED', canRequestAds: true }; });
    expect(await s.privacy().show()).toEqual({ status: 'shown', info: { requirement: 'required', canRequestAds: false } });
    expect(s.consent.getConsentInfo).toHaveBeenCalledTimes(2); expect(s.consent.showPrivacyOptionsForm).toHaveBeenCalledTimes(1); s.noAds();
  });
  it.each(['NOT_REQUIRED', 'UNKNOWN'])('does not present a form when requirement is %s', async (requirement) => {
    const s = setup(); s.info.privacyOptionsRequirementStatus = requirement;
    expect((await s.privacy().show()).status).toBe(requirement === 'NOT_REQUIRED' ? 'not-required' : 'unknown');
    expect(s.consent.showPrivacyOptionsForm).not.toHaveBeenCalled(); s.noAds();
  });
  it('info update failure uses SDK cached info without inventing a requirement', async () => {
    const s = setup(); s.consent.requestInfoUpdate.mockRejectedValue(new Error('network'));
    expect(await s.privacy().getStatus()).toMatchObject({ status: 'checked', info: { requirement: 'required', canRequestAds: true }, message: expect.stringContaining('SDK') }); s.noAds();
  });
  it.each(['sdk', 'missing-method', 'web'])('SDK absence/unsupported runtime is graceful: %s', async (mode) => {
    const s = setup(); if (mode === 'sdk') s.env.sdk = () => null; if (mode === 'missing-method') (s.consent as any).showPrivacyOptionsForm = undefined; if (mode === 'web') s.env.os = () => 'web';
    const privacy = s.privacy(); expect(privacy.available).toBe(false);
    expect(await privacy.getStatus()).toEqual(expect.objectContaining({ status: 'unavailable', info: { requirement: 'unknown', canRequestAds: null } }));
    expect((await privacy.show()).status).toBe('unavailable'); expect(s.consent.requestInfoUpdate).not.toHaveBeenCalled(); s.noAds();
  });
  it.each(['background', 'inactive', 'null-state'])('never contacts UMP from a non-foreground app: %s', async (mode) => {
    const s = setup(); if (mode === 'null-state') s.env.appState = () => null; else s.state.currentState = mode;
    expect((await s.privacy().getStatus()).status).toBe('background'); expect((await s.privacy().show()).status).toBe('background');
    expect(s.consent.requestInfoUpdate).not.toHaveBeenCalled(); s.noAds();
  });
});

describe('global privacy, UMP form and fullscreen gates', () => {
  it('privacy status refresh blocks banner/new ad preparation; duplicate factories share one operation', async () => {
    const s = setup(); let release!: () => void;
    s.consent.requestInfoUpdate.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ ...s.info }); }));
    const privacy = s.privacy(); const read = privacy.getStatus(); await flush();
    expect((await s.privacy().getStatus()).status).toBe('busy'); expect((await s.privacy().show()).status).toBe('busy');
    const normal = s.normal().play(); await flush(); expect(await normal).toMatchObject({ noAd: true, busy: false });
    const banner = s.banner(); banner.mount(); await flush(); expect(banner.getState()).toEqual({ height: 0, request: null }); banner.unmount();
    expect(s.consent.requestInfoUpdate).toHaveBeenCalledTimes(1); expect(s.consent.gatherConsent).not.toHaveBeenCalled(); s.noAds();
    release(); expect((await read).status).toBe('checked'); expect(s.listeners.size).toBe(0);
  });
  it('privacy form reserves the common fullscreen lease and blocks existing rewarded instances', async () => {
    const s = setup(); let release!: () => void;
    s.consent.showPrivacyOptionsForm.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ ...s.info }); }));
    const read = s.privacy().show(); await flush();
    expect((await s.normal().play()).busy).toBe(true); expect((await s.rewarded().play({})).busy).toBe(true);
    expect((await s.privacy().show()).status).toBe('busy'); expect((await s.privacy().getStatus()).status).toBe('busy'); s.noAds();
    release(); expect((await read).status).toBe('shown'); expect(s.listeners.size).toBe(0);
  });
  it('privacy show cannot interrupt a pending/presented native fullscreen ad', async () => {
    const s = setup(); const normal = s.normal(); const ad = normal.play(); await flush(); s.made[0].emit(E.LOADED);
    expect((await s.privacy().show()).status).toBe('busy'); expect(s.consent.requestInfoUpdate).not.toHaveBeenCalled();
    s.made[0].emit(E.OPENED); s.made[0].emit(E.CLOSED); await ad;
    expect((await s.privacy().show()).status).toBe('shown');
  });
  it('banner gatherConsent form blocks privacy info/show, including after caller unmount', async () => {
    const s = setup(); let release!: () => void;
    s.consent.gatherConsent.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ ...s.info }); }));
    const banner = s.banner(); banner.mount(); await flush(); banner.unmount();
    expect((await s.privacy().getStatus()).status).toBe('busy'); expect((await s.privacy().show()).status).toBe('busy');
    expect(s.consent.requestInfoUpdate).not.toHaveBeenCalled(); expect(s.consent.gatherConsent).toHaveBeenCalledTimes(1);
    release(); await flush(); expect((await s.privacy().getStatus()).status).toBe('checked'); s.noAds();
  });
  it('cancel while refreshing settles immediately, keeps its gate and never opens a late form', async () => {
    const s = setup(); let release!: () => void;
    s.consent.requestInfoUpdate.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ ...s.info }); }));
    const privacy = s.privacy(); const result = privacy.show(); await flush(); privacy.cancel();
    expect(await result).toMatchObject({ status: 'cancelled', info: { requirement: 'unknown', canRequestAds: null } });
    expect((await s.privacy().show()).status).toBe('busy'); expect((await s.normal().play()).busy).toBe(true);
    release(); await flush(); expect(s.consent.showPrivacyOptionsForm).not.toHaveBeenCalled(); expect(s.listeners.size).toBe(0); s.noAds();
  });
  it.each(['cancel', 'timeout', 'background'])('native form remains gated until its real completion after %s', async (mode) => {
    const s = setup(); let release!: () => void;
    s.consent.showPrivacyOptionsForm.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ ...s.info }); }));
    const privacy = s.privacy(); const result = privacy.show(); await flush();
    if (mode === 'cancel') privacy.cancel(); else if (mode === 'timeout') vi.advanceTimersByTime(45_000); else s.change('background');
    expect((await result).status).toBe(mode === 'cancel' ? 'cancelled' : mode);
    if (mode === 'background') s.change('active');
    expect((await s.privacy().getStatus()).status).toBe('busy'); expect((await s.normal().play()).busy).toBe(true);
    const banner = s.banner(); banner.mount(); await flush(); expect(banner.getState().request).toBeNull(); banner.unmount();
    release(); await flush(); expect((await s.privacy().getStatus()).status).toBe('checked'); expect(s.listeners.size).toBe(0); s.noAds();
  });
  it('iOS permission-form inactive state is allowed until normal foreground return/completion', async () => {
    const s = setup('ios'); let release!: () => void;
    s.consent.showPrivacyOptionsForm.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ ...s.info }); }));
    const result = s.privacy().show(); await flush(); s.change('inactive'); await flush();
    let finished = false; void result.then(() => { finished = true; }); await flush(); expect(finished).toBe(false);
    s.change('active'); release(); expect((await result).status).toBe('shown'); s.noAds();
  });
  it('background while checking requirement prevents a later native form', async () => {
    const s = setup(); s.consent.requestInfoUpdate.mockImplementation(async () => { s.change('background'); return { ...s.info }; });
    expect((await s.privacy().show()).status).toBe('background'); await flush(); expect(s.consent.showPrivacyOptionsForm).not.toHaveBeenCalled(); s.noAds();
  });
  it.each(['info', 'form'])('native failure releases gates without initialized SDK/ad requests: %s', async (mode) => {
    const s = setup(); if (mode === 'info') s.consent.getConsentInfo.mockRejectedValueOnce(new Error('info')); else s.consent.showPrivacyOptionsForm.mockRejectedValueOnce(new Error('form'));
    expect(await s.privacy().show()).toMatchObject({ status: 'error', info: { requirement: 'unknown', canRequestAds: null } });
    expect((await s.privacy().show()).status).toBe('shown'); expect(s.listeners.size).toBe(0); s.noAds();
  });
});

describe('privacy changes invalidate pre-existing request preparation and consent memoization', () => {
  it('withdrawal revalidates canRequestAds before the next format; no local reward fields exist', async () => {
    const s = setup(); const first = s.normal(); const initial = first.play(); await flush(); first.cancel(); await initial;
    expect(s.made).toHaveLength(1); s.consent.showPrivacyOptionsForm.mockImplementation(async () => { s.info.canRequestAds = false; return { ...s.info }; });
    const privacy = await s.privacy().show(); expect(privacy).toEqual({ status: 'shown', info: { requirement: 'required', canRequestAds: false } });
    const next = s.rewarded().play({}); await flush(); expect(await next).toMatchObject({ noAd: true, earned: false });
    expect(s.made).toHaveLength(1); expect(s.consent.gatherConsent).toHaveBeenCalledTimes(2); expect(s.mobile.initialize).toHaveBeenCalledTimes(1);
    expect(privacy).not.toHaveProperty('earned'); expect(privacy).not.toHaveProperty('reward'); expect(privacy).not.toHaveProperty('wallet');
  });
  it.each([false, true])('banner preparation cannot cross a privacy operation even after its gate closes: %s', async (resolveDuringPrivacy) => {
    const s = setup(); let initialize!: () => void; let refresh!: () => void;
    s.mobile.initialize.mockImplementation(() => new Promise((resolve) => { initialize = resolve; }));
    s.consent.requestInfoUpdate.mockImplementation(() => new Promise((resolve) => { refresh = () => resolve({ ...s.info }); }));
    const banner = s.banner(); banner.mount(); await flush(); expect(s.mobile.initialize).toHaveBeenCalledTimes(1);
    const privacy = s.privacy().getStatus(); await flush(); s.info.canRequestAds = false;
    if (resolveDuringPrivacy) { initialize(); await flush(); }
    refresh(); expect((await privacy).info.canRequestAds).toBe(false);
    if (!resolveDuringPrivacy) initialize(); await flush();
    expect(banner.getState()).toEqual({ height: 0, request: null }); expect(s.made).toHaveLength(0); banner.unmount(); expect(s.listeners.size).toBe(0);
  });
});

describe('public ATT and UMP privacy share a single native-form gate', () => {
  it('native ATT in progress blocks privacy and advertising without querying/presenting another form', async () => {
    const s = setup('ios'); let status = 'undetermined'; let release!: () => void; const asked = vi.fn(() => new Promise((resolve) => { release = () => { status = 'granted'; resolve({ status }); }; }));
    s.env.tracking = () => ({ getTrackingPermissionsAsync: async () => ({ status }), requestTrackingPermissionsAsync: asked });
    const tracking = s.rewarded().requestTracking(); await flush(); vi.advanceTimersByTime(600); await flush(); expect(asked).toHaveBeenCalledTimes(1);
    expect((await s.privacy().show()).status).toBe('busy'); expect(s.consent.requestInfoUpdate).not.toHaveBeenCalled();
    const ad = s.normal().play(); await flush(); expect(await ad).toMatchObject({ noAd: true }); s.noAds();
    release(); expect(await tracking).toEqual({ status: 'granted', timedOut: false }); expect((await s.privacy().show()).status).toBe('shown');
  });
  it('ATT timeout keeps its form gate until the native response really completes', async () => {
    const s = setup('ios'); let release!: () => void;
    s.env.tracking = () => ({ getTrackingPermissionsAsync: async () => ({ status: 'undetermined' }), requestTrackingPermissionsAsync: () => new Promise((resolve) => { release = () => resolve({ status: 'denied' }); }) });
    const tracking = s.rewarded().requestTracking(); await flush(); vi.advanceTimersByTime(600); await flush(); vi.advanceTimersByTime(20_000); await flush();
    expect(await tracking).toEqual({ status: 'undetermined', timedOut: true }); expect((await s.privacy().getStatus()).status).toBe('busy');
    release(); await flush(); expect((await s.privacy().getStatus()).status).toBe('checked'); s.noAds();
  });
  it('startup ATT waits for an existing privacy form rather than overlapping it', async () => {
    const s = setup('ios'); let release!: () => void; let status = 'undetermined';
    s.consent.showPrivacyOptionsForm.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ ...s.info }); }));
    const asked = vi.fn(async () => { status = 'denied'; return { status }; });
    s.env.tracking = () => ({ getTrackingPermissionsAsync: async () => ({ status }), requestTrackingPermissionsAsync: asked });
    const privacy = s.privacy().show(); await flush(); const tracking = s.rewarded().requestTracking(); await flush(); vi.advanceTimersByTime(600); await flush();
    expect(asked).not.toHaveBeenCalled(); release(); expect((await privacy).status).toBe('shown');
    expect(await tracking).toEqual({ status: 'denied', timedOut: false }); expect(asked).toHaveBeenCalledTimes(1); s.noAds();
  });
  it('different rewarded factories requesting ATT concurrently produce only one native prompt', async () => {
    const s = setup('ios'); let status = 'undetermined'; let release!: () => void;
    const asked = vi.fn(() => new Promise((resolve) => { release = () => { status = 'granted'; resolve({ status }); }; }));
    s.env.tracking = () => ({ getTrackingPermissionsAsync: async () => ({ status }), requestTrackingPermissionsAsync: asked });
    const first = s.rewarded().requestTracking(); const second = s.rewarded().requestTracking(); await flush(); vi.advanceTimersByTime(600); await flush();
    expect(asked).toHaveBeenCalledTimes(1); release(); expect(await first).toEqual({ status: 'granted', timedOut: false }); expect(await second).toEqual({ status: 'granted', timedOut: false }); s.noAds();
  });
});
