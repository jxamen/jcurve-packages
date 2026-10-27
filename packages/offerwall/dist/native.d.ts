/**
 * JS side of the native bridge added in 0.3.0 (`JCurveOfferwallModule`, Android Java + iOS ObjC): the AdPopcorn SDK
 * features that react-native-adpopcorn-reward 1.0.0 does not expose. Binaries built before 0.3.0 do not have the module,
 * so every function rejects with `code: 'E_UNSUPPORTED'` there and callers fall back. The module is only looked up as a
 * property of `NativeModules` (never `require`d), which cannot throw on an older binary. See README for the support table.
 */
export type NativeErrorCode = 'E_UNSUPPORTED' | 'E_FAILED' | 'E_LOAD_FAILED' | 'E_NO_ACTIVITY';
/** A campaign of the SDK's custom list. `reward` is a number on iOS and a string on Android. */
export type NativeCampaign = {
    campaignKey: string;
    title?: string;
    description?: string;
    reward?: string | number;
    iconImageURL?: string;
    mainImageURL?: string;
};
export type NativeCustomNativeAd = {
    nativeCampaignId: string;
    title?: string;
    description?: string;
    reward?: string | number;
    cta?: string;
    iconImageURL?: string;
    mainImageURL?: string;
};
export type NativeCpmCampaign = {
    id: string;
    title?: string;
    description?: string;
    condition?: string;
    cta?: string;
    reward?: string | number;
    imageURL?: string;
};
/** null when the SDK never answered (timeout). */
export type ParticipateResult = {
    success: boolean;
    code: number;
    message: string;
    landingUrl: string;
} | null;
export type TotalRewardInfo = {
    queryResult: boolean;
    totalCount: number;
    totalReward: string;
    bridgePlacementId?: string;
} | null;
export type OfferwallNativeCapabilities = {
    platform: 'android' | 'ios';
    sdk: string;
    bridge: number;
    methods: string[];
};
/** Events the bridge emits: detailClosed, customNativeClickSuccess | customNativeFailed | customNativeCompleted, customCpmClickSuccess | customCpmClickFailed | customCpmCompleted. */
export type OfferwallNativeEvent = {
    type: string;
    [key: string]: unknown;
};
/** True on binaries built with 0.3.0+. */
export declare function hasNativeBridge(): boolean;
/** What this build can do (platform, SDK version, method names). Rejects E_UNSUPPORTED before 0.3.0. */
export declare const getOfferwallNativeCapabilities: () => Promise<OfferwallNativeCapabilities>;
/** Opens one campaign's detail page. true = the SDK took it; false = refused or no answer in time. */
export declare const openCampaignDetail: (campaignKey: string) => Promise<boolean>;
/** SDK-side participation attempt for a campaign key. */
export declare const tryParticipateCampaign: (campaignKey: string) => Promise<ParticipateResult>;
export declare const loadCustomCampaigns: (max?: number) => Promise<NativeCampaign[]>;
export declare const clickCustomCampaign: (campaignKey: string) => Promise<boolean>;
export declare const destroyCustomCampaigns: () => Promise<boolean>;
/** Custom native ad of a placement made in the AdPopcorn console. */
export declare const loadCustomNativeAds: (placementId: string) => Promise<NativeCustomNativeAd[]>;
export declare const impressionCustomNativeAd: (nativeCampaignId: string) => Promise<boolean>;
export declare const clickCustomNativeAd: (nativeCampaignId: string) => Promise<boolean>;
/** Android only (iOS rejects E_UNSUPPORTED). */
export declare const completeCustomNativeAd: () => Promise<boolean>;
export declare const loadCustomCpm: (max?: number) => Promise<NativeCpmCampaign[]>;
export declare const impressionCustomCpm: (id: string) => Promise<boolean>;
export declare const clickCustomCpm: (id: string) => Promise<boolean>;
export declare const getEarnableTotalRewardInfo: () => Promise<TotalRewardInfo>;
export declare const getBridgeTotalRewardInfo: (bridgePlacementId: string) => Promise<TotalRewardInfo>;
/** Full-screen offerwall with the user filters of the AdPopcorn contract ({ key: value } strings). */
export declare const openOfferwallWithFilter: (filters: Record<string, string>) => Promise<boolean>;
/** iOS only: closes an offerwall that is already open (Android rejects E_UNSUPPORTED). */
export declare const closeOfferwall: () => Promise<boolean>;
/** Android only (iOS rejects E_UNSUPPORTED). */
export declare const setUserAgreement: (agreed: boolean) => Promise<boolean>;
/** Android only (iOS rejects E_UNSUPPORTED). */
export declare const useFlagShowWhenLocked: (enabled: boolean) => Promise<boolean>;
/** Puts text on the clipboard without a separate clipboard module. */
export declare const setClipboard: (text: string) => Promise<boolean>;
/** Bridge events. Uses NativeEventEmitter, which iOS needs to count listeners. Returns an unsubscribe function. */
export declare function addOfferwallNativeListener(listener: (event: OfferwallNativeEvent) => void): () => void;
/** Every method this file wraps, for the capability check in tests and docs. */
export declare const OFFERWALL_NATIVE_METHODS: readonly ["openCampaignDetail", "tryParticipateCampaign", "loadCustomCampaigns", "clickCustomCampaign", "destroyCustomCampaigns", "loadCustomNativeAds", "impressionCustomNativeAd", "clickCustomNativeAd", "completeCustomNativeAd", "loadCustomCpm", "impressionCustomCpm", "clickCustomCpm", "getEarnableTotalRewardInfo", "getBridgeTotalRewardInfo", "openOfferwallWithFilter", "closeOfferwall", "setUserAgreement", "useFlagShowWhenLocked", "setClipboard"];
