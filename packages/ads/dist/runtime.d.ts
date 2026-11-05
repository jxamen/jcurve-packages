/** Shared foreground, UMP and initialization policy. No ad is prefetched here. */
import type { AdsEnv } from './ads';
export type RequestPolicy = {
    test: boolean;
    testDevices?: string[];
    /** Conservative default: true. false still requires UMP personalization choices. */
    requestNonPersonalizedAdsOnly?: boolean;
};
export type RequestPrivacy = {
    requestNonPersonalizedAdsOnly: boolean;
};
export type FullscreenLease = {
    release: () => void;
};
type FullscreenObserver = (active: boolean, resumeRequests: boolean) => void;
export declare function isForeground(env: AdsEnv): boolean;
export declare function isFullscreenActive(env: AdsEnv, sdk: any): boolean;
/** Internal request observers never release a native lease or control SDK callbacks. */
export declare function subscribeFullscreen(env: AdsEnv, sdk: any, observer: FullscreenObserver): () => void;
export declare function acquireFullscreen(env: AdsEnv, sdk: any, kind?: 'ad' | 'privacy'): FullscreenLease | null;
/** UMP updates/forms share one gate; privacy operations also block banner/request preparation. */
export declare function acquireConsentForm(env: AdsEnv, sdk: any, kind?: 'consent' | 'privacy' | 'tracking'): FullscreenLease | null;
/** Public ATT may be requested at startup while UMP refreshes; wait instead of overlapping dialogs. */
export declare function waitForTrackingForm(env: AdsEnv, sdk: any): Promise<FullscreenLease | null>;
export declare function invalidateConsent(env: AdsEnv, sdk: any): void;
export declare function bounded<T>(promise: Promise<T>, ms: number, message: string): Promise<T>;
/** Failed UMP refresh may use a still-valid previous consent, never a fabricated one. */
export declare function prepareRequest(env: AdsEnv, sdk: any, policy: RequestPolicy, stillNeeded?: () => boolean, beforeInitialize?: () => Promise<void>): Promise<RequestPrivacy>;
export declare function safeCall(fn: ((...args: any[]) => void) | undefined, ...args: any[]): void;
export declare function adError(error: any): string;
export {};
