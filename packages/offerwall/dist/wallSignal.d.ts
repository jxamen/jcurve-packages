/**
 * Tells whether the Chance tab's wall (`OfferwallScreen`) has finished loading. `ComboEntry` sits beside the wall, not inside
 * it, and shows its recommendation popup only once the wall is up. Pure JS, nothing runs at import time.
 */
type Listener = (loaded: boolean) => void;
export declare function notifyWallLoaded(): void;
/** The wall went away (tab left, member changed) or is loading again. */
export declare function notifyWallGone(): void;
export declare function isWallLoaded(): boolean;
/** Calls back with `true` when the wall has loaded and `false` when it is gone. Returns the unsubscribe function. */
export declare function onWallState(listener: Listener): () => void;
export {};
