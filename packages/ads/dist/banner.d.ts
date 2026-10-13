import { type AdsEnv, type AdUnits } from './ads';
import { type RequestPolicy } from './runtime';
export type BannerDimensions = {
    width: number;
    height: number;
};
export type AnchoredAdaptiveBannerProps = RequestPolicy & {
    units: AdUnits;
    /** false unmounts the native ad, cancels pending preparation and reports height 0. */
    enabled?: boolean;
    /** Available content width in dp; defaults to React Native window width. */
    width?: number;
    onHeightChange: (height: number) => void;
    onLoaded?: (dimensions: BannerDimensions) => void;
    onFail?: (message: string, noAd: boolean) => void;
};
type BannerRequest = {
    id: number;
    unitId: string;
    size: string;
    width: number;
    requestOptions: {
        requestNonPersonalizedAdsOnly: boolean;
    };
    onAdLoaded: (dimensions: BannerDimensions) => void;
    onSizeChange: (dimensions: BannerDimensions) => void;
    onAdFailedToLoad: (error: any) => void;
};
export type BannerState = {
    height: number;
    request: BannerRequest | null;
};
/** Internal state machine exposed only from this file for fake-SDK producer checks. */
export declare function createBannerSession(props: AnchoredAdaptiveBannerProps, width: number, env?: AdsEnv): {
    available: boolean;
    sdk: any;
    getState: () => BannerState;
    subscribe: (listener: (state: BannerState) => void) => () => void;
    mount: () => void;
    unmount: () => void;
};
/** The app never imports a native advertising SDK or renders a fabricated banner. */
export declare function AnchoredAdaptiveBanner(props: AnchoredAdaptiveBannerProps): any;
export {};
