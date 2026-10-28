"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetComboSheetProbe = resetComboSheetProbe;
exports.comboSheetProbe = comboSheetProbe;
exports.comboListProps = comboListProps;
/**
 * 0.6.5 — the list of 「포인트 빨리 모으기」 inside the sheet (and the 「무료체험 확인」 sheet) must scroll when swiped. On an Android A32 (new architecture, Reanimated, a full-screen
 * gesture detector around the tabs) the taps worked and the swipe did nothing. This file holds
 *   1. `comboListProps` — the props every vertical list in the sheet gets (nested scrolling allowed, fills the sheet), and
 *   2. TEMPORARY DIAGNOSTICS (remove in 0.6.6, together with `resetComboSheetProbe` / `comboSheetProbe` and their callers): one `console.log` line per step, each at most once per
 *      sheet opening, to tell where a swipe stops: `[combos-sheet] container touchStart` (the sheet got the touch) → `list touchStart` (the list did) → `list scrollBeginDrag`
 *      (the list started a drag) → `list scroll y=<n>` (it really moved). No member data, only the step names and an offset.
 */
const said = new Set();
/** TEMP-DIAG 0.6.5: a new sheet opening — every step may be said once again. */
function resetComboSheetProbe() { said.clear(); }
/** TEMP-DIAG 0.6.5: say a step once per opening. Never throws. */
function comboSheetProbe(step, detail) {
    if (said.has(step))
        return;
    said.add(step);
    try {
        console.log('[combos-sheet] ' + step + (detail ? ' ' + detail : ''));
    }
    catch { /* a log line must never break the sheet */ }
}
/** The props of a sheet's vertical list (merged into the ScrollView's own props by each screen). */
function comboListProps() {
    return {
        nestedScrollEnabled: true,
        style: { flex: 1 },
        // TEMP-DIAG 0.6.5 (below)
        scrollEventThrottle: 100,
        onTouchStart: () => comboSheetProbe('list touchStart'),
        onScrollBeginDrag: () => comboSheetProbe('list scrollBeginDrag'),
        onScroll: (event) => {
            const y = Math.round(Number(event?.nativeEvent?.contentOffset?.y ?? 0));
            if (Number.isFinite(y) && y !== 0)
                comboSheetProbe('list scroll', 'y=' + y);
        },
    };
}
