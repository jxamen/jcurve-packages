"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyWallLoaded = notifyWallLoaded;
exports.notifyWallGone = notifyWallGone;
exports.isWallLoaded = isWallLoaded;
exports.onWallState = onWallState;
const listeners = new Set();
let loaded = false;
function set(value) {
    if (loaded === value)
        return;
    loaded = value;
    for (const listener of [...listeners]) {
        try {
            listener(value);
        }
        catch { /* one bad listener must not stop the rest */ }
    }
}
function notifyWallLoaded() { set(true); }
/** The wall went away (tab left, member changed) or is loading again. */
function notifyWallGone() { set(false); }
function isWallLoaded() { return loaded; }
/** Calls back with `true` when the wall has loaded and `false` when it is gone. Returns the unsubscribe function. */
function onWallState(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
