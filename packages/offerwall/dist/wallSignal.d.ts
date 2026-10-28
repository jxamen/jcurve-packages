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
/**
 * 0.6.2 — which 「찬스」 tab is up (`'adpopcorn'` = 찬스1, `'snapplay'` = 찬스2). `OfferwallScreen` sets it when the member picks a tab (and back to `'adpopcorn'` when there are no tabs or the
 * screen goes away); `ComboEntry` follows it, so 「포인트 빨리 모으기」 shows each tab's own list.
 */
type TabListener = (id: string) => void;
export declare function setChanceTab(id: string): void;
export declare function getChanceTab(): string;
/** Calls back whenever the picked 찬스 tab changes. Returns the unsubscribe function. */
export declare function onChanceTab(listener: TabListener): () => void;
/**
 * 0.6.6 — whether a 「포인트 빨리 모으기」 sheet is open **and** the 찬스2 embedded SnapPlay view should be shielded from touches meanwhile. `ComboEntry` sets it (it is the one that knows the
 * sheet is open and what the server's `display.sheet_embed_block` says); `OfferwallScreen` follows it and gives the 찬스2 panel `pointerEvents="none"` while it is true. Subscribers should
 * read the current value right after subscribing (`getChanceSheetOpen`), as with the other signals here.
 */
type SheetListener = (open: boolean) => void;
export declare function setChanceSheetOpen(open: boolean): void;
export declare function getChanceSheetOpen(): boolean;
/** Calls back whenever the value changes. Returns the unsubscribe function. */
export declare function onChanceSheetOpen(listener: SheetListener): () => void;
export {};
