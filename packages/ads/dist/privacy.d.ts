/** UMP privacy settings. This module never initializes the advertising SDK or requests an ad. */
import { type AdsEnv } from './ads';
export type AdsPrivacyRequirement = 'required' | 'not-required' | 'unknown';
export type AdsPrivacyInfo = {
    requirement: AdsPrivacyRequirement;
    canRequestAds: boolean | null;
};
export type AdsPrivacyStatus = 'checked' | 'shown' | 'not-required' | 'unknown' | 'busy' | 'cancelled' | 'timeout' | 'unavailable' | 'background' | 'error';
export type AdsPrivacyResult = {
    status: AdsPrivacyStatus;
    info: AdsPrivacyInfo;
    message?: string;
};
export type AdsPrivacyOptions = {
    testDevices?: string[];
};
export type AdsPrivacy = {
    available: boolean;
    /** Refresh UMP info and read the SDK's authoritative requirement. Never opens a form. */
    getStatus: () => Promise<AdsPrivacyResult>;
    /** Only REQUIRED opens Google's form; its completion is followed by a fresh SDK info read. */
    show: () => Promise<AdsPrivacyResult>;
    /** Cancels the JS wait; an already-running native operation retains its locks until it ends. */
    cancel: () => void;
};
export declare function createAdsPrivacy(options?: AdsPrivacyOptions, env?: AdsEnv): AdsPrivacy;
