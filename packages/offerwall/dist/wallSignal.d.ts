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
/**
 * 0.5.1 — the height of the 「찬스1 · 찬스2」 tab row that `OfferwallScreen` draws above the wall (0 when there are no tabs). `ComboEntry` sits beside the screen in the
 * app, positioned from the top of the same box; its chip row, sheet and toast move down by this much so they land under the tab row (on the wall's own header row
 * / the same place on 찬스2) instead of covering the tabs.
 */
type InsetListener = (inset: number) => void;
export declare function setChanceTabInset(px: number): void;
export declare function getChanceTabInset(): number;
/** Calls back whenever the tab row's height changes. Returns the unsubscribe function. */
export declare function onChanceTabInset(listener: InsetListener): () => void;
export {};
