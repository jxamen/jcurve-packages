/** Single-use fullscreen lifecycle shared by normal and both rewarded formats. */
import type { AdsEnv } from './ads';
export type FullscreenCallbacks = {
    onOpened?: () => void;
    onClosed?: () => void;
    onEarned?: () => void;
    onFail: (message: string, noAd: boolean) => void;
    onAbort?: (noAd?: boolean) => void;
};
export declare function createFullscreen(env: AdsEnv, sdk: any): {
    cancel: () => void;
    show(config: {
        callbacks: FullscreenCallbacks;
        rewarded: boolean;
        prepare: (stillNeeded: () => boolean) => Promise<any>;
        makeAd: (request: any) => any;
        onOpen?: () => void;
        onFailure?: () => void;
    }): Promise<boolean>;
};
