/**
 * JS side of the native bridge added in 0.3.0 (`JCurveOfferwallModule`, Android Java + iOS ObjC): the AdPopcorn SDK
 * features that react-native-adpopcorn-reward 1.0.0 does not expose. Binaries built before 0.3.0 do not have the module,
 * so every function rejects with `code: 'E_UNSUPPORTED'` there and callers fall back. The module is only looked up as a
 * property of `NativeModules` (never `require`d), which cannot throw on an older binary. See README for the support table.
 */
export type NativeErrorCode = 'E_UNSUPPORTED' | 'E_FAILED' | 'E_LOAD_FAILED' | 'E_NO_ACTIVITY';

/** A campaign of the SDK's custom list. `reward` is a number on iOS and a string on Android. */
export type NativeCampaign = { campaignKey: string; title?: string; description?: string; reward?: string | number; iconImageURL?: string; mainImageURL?: string };
export type NativeCustomNativeAd = { nativeCampaignId: string; title?: string; description?: string; reward?: string | number; cta?: string; iconImageURL?: string; mainImageURL?: string };
export type NativeCpmCampaign = { id: string; title?: string; description?: string; condition?: string; cta?: string; reward?: string | number; imageURL?: string };
/** null when the SDK never answered (timeout). */
export type ParticipateResult = { success: boolean; code: number; message: string; landingUrl: string } | null;
export type TotalRewardInfo = { queryResult: boolean; totalCount: number; totalReward: string; bridgePlacementId?: string } | null;
export type OfferwallNativeCapabilities = { platform: 'android' | 'ios'; sdk: string; bridge: number; methods: string[] };
/** Events the bridge emits: detailOpened (0.4.0) | detailClosed, customNativeClickSuccess | customNativeFailed | customNativeCompleted, customCpmClickSuccess | customCpmClickFailed | customCpmCompleted. */
export type OfferwallNativeEvent = { type: string; [key: string]: unknown };

type Bridge = Record<string, any>;
function bridge(): Bridge | null {
  try {
    const { NativeModules } = require('react-native') as typeof import('react-native');
    const mod = NativeModules?.JCurveOfferwallModule as Bridge | undefined;
    return mod && typeof mod === 'object' ? mod : null;
  } catch { return null; }
}
/** True on binaries built with 0.3.0+. */
export function hasNativeBridge(): boolean { return bridge() !== null; }

function unsupported(name: string): Error & { code: NativeErrorCode } {
  return Object.assign(new Error(`native bridge: ${name} is not available in this build`), { code: 'E_UNSUPPORTED' as const });
}
function call<T>(name: string, ...args: unknown[]): Promise<T> {
  const mod = bridge();
  if (!mod || typeof mod[name] !== 'function') return Promise.reject(unsupported(name));
  try { return Promise.resolve(mod[name](...args)) as Promise<T>; } catch (error) { return Promise.reject(error); }
}

/** What this build can do (platform, SDK version, method names). Rejects E_UNSUPPORTED before 0.3.0. */
export const getOfferwallNativeCapabilities = (): Promise<OfferwallNativeCapabilities> => call('getCapabilities');

// campaign detail / participation
/** Opens one campaign's detail page. true = the SDK took it; false = refused or no answer in time. */
export const openCampaignDetail = (campaignKey: string): Promise<boolean> => call('openCampaignDetail', campaignKey);
/** SDK-side participation attempt for a campaign key. */
export const tryParticipateCampaign = (campaignKey: string): Promise<ParticipateResult> => call('tryParticipateCampaign', campaignKey);

// custom reward lists (our own UI)
export const loadCustomCampaigns = (max = 100): Promise<NativeCampaign[]> => call('loadCustomCampaigns', max);
export const clickCustomCampaign = (campaignKey: string): Promise<boolean> => call('clickCustomCampaign', campaignKey);
export const destroyCustomCampaigns = (): Promise<boolean> => call('destroyCustomCampaigns');
/** Custom native ad of a placement made in the AdPopcorn console. */
export const loadCustomNativeAds = (placementId: string): Promise<NativeCustomNativeAd[]> => call('loadCustomNativeAds', placementId);
export const impressionCustomNativeAd = (nativeCampaignId: string): Promise<boolean> => call('impressionCustomNativeAd', nativeCampaignId);
export const clickCustomNativeAd = (nativeCampaignId: string): Promise<boolean> => call('clickCustomNativeAd', nativeCampaignId);
/** Android only (iOS rejects E_UNSUPPORTED). */
export const completeCustomNativeAd = (): Promise<boolean> => call('completeCustomNativeAd');
export const loadCustomCpm = (max = 100): Promise<NativeCpmCampaign[]> => call('loadCustomCpm', max);
export const impressionCustomCpm = (id: string): Promise<boolean> => call('impressionCustomCpm', id);
export const clickCustomCpm = (id: string): Promise<boolean> => call('clickCustomCpm', id);

// reward totals
export const getEarnableTotalRewardInfo = (): Promise<TotalRewardInfo> => call('getEarnableTotalRewardInfo');
export const getBridgeTotalRewardInfo = (bridgePlacementId: string): Promise<TotalRewardInfo> => call('getBridgeTotalRewardInfo', bridgePlacementId);

// settings and helpers
/** Full-screen offerwall with the user filters of the AdPopcorn contract ({ key: value } strings). */
export const openOfferwallWithFilter = (filters: Record<string, string>): Promise<boolean> => call('openOfferwallWithFilter', filters);
/** iOS only: closes an offerwall that is already open (Android rejects E_UNSUPPORTED). */
export const closeOfferwall = (): Promise<boolean> => call('closeOfferwall');
/** Android only (iOS rejects E_UNSUPPORTED). */
export const setUserAgreement = (agreed: boolean): Promise<boolean> => call('setUserAgreement', agreed);
/** Android only (iOS rejects E_UNSUPPORTED). */
export const useFlagShowWhenLocked = (enabled: boolean): Promise<boolean> => call('useFlagShowWhenLocked', enabled);
/** Puts text on the clipboard without a separate clipboard module. */
export const setClipboard = (text: string): Promise<boolean> => call('setClipboard', text);

/** 0.4.0, iOS only (Android rejects E_UNSUPPORTED): what the native web tap needs — see webTap.ts. `enabled: false` removes the script for web views created from now on. */
export type NativeWebTapOptions = { enabled: boolean; script?: string; handler?: string; hostPattern?: string };
export const setWebTap = (options: NativeWebTapOptions): Promise<boolean> => call('setWebTap', options);

/** Bridge events. Uses NativeEventEmitter, which iOS needs to count listeners. Returns an unsubscribe function. */
export function addOfferwallNativeListener(listener: (event: OfferwallNativeEvent) => void): () => void {
  try {
    const { NativeEventEmitter } = require('react-native') as typeof import('react-native');
    const mod = bridge();
    if (!mod) return () => {};
    const subscription = new NativeEventEmitter(mod as any).addListener('JCurveOfferwallEvent', listener as (event: unknown) => void);
    return () => subscription.remove();
  } catch { return () => {}; }
}

/** 0.4.0, iOS: what the web tap posts (a JSON string or an object; webTap.ts checks it). Returns an unsubscribe function. */
export function addTapListener(listener: (raw: unknown) => void): () => void {
  try {
    const { NativeEventEmitter } = require('react-native') as typeof import('react-native');
    const mod = bridge();
    if (!mod) return () => {};
    const subscription = new NativeEventEmitter(mod as any).addListener('JCurveOfferwallTap', listener);
    return () => subscription.remove();
  } catch { return () => {}; }
}

/** Every method this file wraps, for the capability check in tests and docs. */
export const OFFERWALL_NATIVE_METHODS = [
  'openCampaignDetail', 'tryParticipateCampaign', 'loadCustomCampaigns', 'clickCustomCampaign', 'destroyCustomCampaigns',
  'loadCustomNativeAds', 'impressionCustomNativeAd', 'clickCustomNativeAd', 'completeCustomNativeAd',
  'loadCustomCpm', 'impressionCustomCpm', 'clickCustomCpm', 'getEarnableTotalRewardInfo', 'getBridgeTotalRewardInfo',
  'openOfferwallWithFilter', 'closeOfferwall', 'setUserAgreement', 'useFlagShowWhenLocked', 'setClipboard', 'setWebTap',
] as const;
