/**
 * 0.6.6 — where the 「포인트 빨리 모으기」 sheet goes when it is drawn inside a React Native `Modal` (a window of its own above the whole app) instead of inside the Chance screen's
 * view tree. On an Android A32 the list inside the tree-drawn sheet did not start a drag; the Modal takes the sheet out of that tree. The sheet must still sit exactly where it sat
 * (under the chip row, down to the app's bottom tab bar), so the Chance screen's container is measured in window coordinates, and so is a 1×1 anchor at the Modal's own origin; the
 * difference is where the container lies inside the Modal (status bar height, edge-to-edge and so on cancel out). Whenever a number is missing or does not make sense the caller
 * draws the sheet in the tree as before.
 */
export type Box = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type SheetFrame = {
    left: number;
    top: number;
    width: number;
    height: number;
};
/** How long a Modal sheet waits for its origin to be measured before it gives up and is drawn in the tree. */
export declare const SHEET_MEASURE_TIMEOUT_MS = 800;
/** A container smaller than this cannot hold the sheet: the measure is not believed. */
export declare const SHEET_MIN_CONTAINER: {
    readonly w: 100;
    readonly h: 200;
};
/**
 * The props every vertical list in a sheet gets (merged into the ScrollView's own props by each screen): nested scrolling allowed (Android) and filling the sheet. On the A32 that showed
 * the swipe problem these were part of the 0.6.5 candidate fix; with the sheet in a Modal (0.6.6) this exact set is the one confirmed to scroll.
 */
export declare function comboListProps(): Record<string, unknown>;
/** `node.measureInWindow` as a callback that is called exactly once with a box, or with null when the node cannot be measured or answers with numbers that are not numbers. Never throws. */
export declare function measureBox(node: unknown, done: (box: Box | null) => void): void;
/**
 * The container's rectangle inside the Modal: its window position minus the position of the Modal's own origin anchor. Null when either is missing, the container is too small to be
 * real, or the result lies further away than a screen (which would mean the two measures were taken in different coordinate systems).
 */
export declare function sheetFrame(container: Box | null | undefined, modalOrigin: Box | null | undefined, win: {
    width: number;
    height: number;
}): SheetFrame | null;
/** Could this box be the Chance container at all? (A zero-size or sliver box is a layout that has not happened yet, or a measure that is not to be believed.) */
export declare function containerBoxOk(box: Box | null | undefined): box is Box;
export type SheetPlacement = {
    /** 'modal': draw the sheet in a Modal (the Modal itself shows at once; the sheet follows when `frame` is known). 'tree': draw it where it always was. */
    mode: 'modal' | 'tree';
    frame: SheetFrame | null;
    /** Props for the invisible view that covers the Chance container (render it whenever the entry is drawn; it only measures). */
    anchorProps: Record<string, unknown>;
    /** Props for the 1×1 view at the Modal's origin (render it first inside the Modal). */
    modalAnchorProps: Record<string, unknown>;
};
/**
 * `enabled` = this entry may use a Modal at all (Chance placement, not switched off by the server). `sheetUp` = a sheet is open. The container is measured when its anchor is laid out
 * and again when a sheet opens; the Modal's origin is measured when the Modal's anchor is laid out and kept for the rest of the session (per window size). A sheet opened with no
 * container measure yet is drawn in the tree. A Modal that cannot be placed within `SHEET_MEASURE_TIMEOUT_MS` is given up for that opening.
 */
export declare function useSheetPlacement({ enabled, sheetUp }: {
    enabled: boolean;
    sheetUp: boolean;
}): SheetPlacement;
