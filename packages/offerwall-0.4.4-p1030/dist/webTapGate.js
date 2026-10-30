"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAP_REMOUNT_WINDOW_MS = void 0;
exports.tapGateActivated = tapGateActivated;
exports.tapGateDeactivated = tapGateDeactivated;
exports.tapGateState = tapGateState;
exports.subscribeTapGate = subscribeTapGate;
/**
 * 0.4.1 — tells the wall view when the web tap has become active.
 *
 * The tap's script is added to web views created *after* `setWebTap(enabled:true)`. The wall's web view is created at the first layout of
 * `OfferwallView`, long before the combos answer (and with it the server's `list_tap` switch) arrives — so on a normal first visit the wall
 * existed before the tap did and was never read (found on a real iPhone, 10/28). The view therefore listens here and, when the tap turns on
 * shortly after it was mounted, mounts itself once more: the new web view gets the script.
 */
let active = false;
let epoch = 0;
const listeners = new Set();
/** The tap is on (native confirmed). Counts as a new activation only when it was off before. */
function tapGateActivated() {
    if (active)
        return;
    active = true;
    epoch += 1;
    for (const listener of [...listeners]) {
        try {
            listener(epoch);
        }
        catch { /* a view's handler must not break the tap */ }
    }
}
/** The tap is off again (switch off, member change, stop()). */
function tapGateDeactivated() { active = false; }
function tapGateState() { return { active, epoch }; }
/** Called with the new epoch at every activation. Returns the unsubscribe function. */
function subscribeTapGate(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
/** A wall view mounted this recently (ms) before the tap turned on is mounted once more so that its web view gets the script. */
exports.TAP_REMOUNT_WINDOW_MS = 30000;
