import { type AdsEnv, type AdUnits } from './ads';
import { type RequestPolicy } from './runtime';
export type InterstitialOptions = RequestPolicy & {
    units: {
        interstitial: AdUnits;
    };
};
export type InterstitialShowOptions = {
    onOpened?: () => void;
    onClosed?: () => void;
    onFail: (message: string, noAd: boolean) => void;
    onAbort?: () => void;
};
/** Normal interstitial has no earned result, SSV payload or reward callbacks. */
export type InterstitialResult = {
    opened: boolean;
    busy: boolean;
    /** true only when absence is confirmed; in-flight native presentation is false even without OPENED. */
    noAd: boolean;
    cancelled: boolean;
    message?: string;
};
export type Interstitial = {
    available: boolean;
    show: (options: InterstitialShowOptions) => Promise<boolean>;
    play: (options?: {
        onOpened?: () => void;
    }) => Promise<InterstitialResult>;
    cancel: () => void;
    warm: () => void;
    warmReady: () => boolean;
};
export declare function createInterstitial(options: InterstitialOptions, env?: AdsEnv): Interstitial;
