"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyWallLoaded = notifyWallLoaded;
exports.notifyWallGone = notifyWallGone;
exports.isWallLoaded = isWallLoaded;
exports.onWallState = onWallState;
exports.setChanceTabInset = setChanceTabInset;
exports.getChanceTabInset = getChanceTabInset;
exports.onChanceTabInset = onChanceTabInset;
exports.setChanceTab = setChanceTab;
exports.getChanceTab = getChanceTab;
exports.onChanceTab = onChanceTab;
exports.setChanceSheetOpen = setChanceSheetOpen;
exports.getChanceSheetOpen = getChanceSheetOpen;
exports.onChanceSheetOpen = onChanceSheetOpen;
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
const insetListeners = new Set();
let tabInset = 0;
function setChanceTabInset(px) {
    const next = Number.isFinite(px) && px > 0 ? Math.round(px) : 0;
    if (next === tabInset)
        return;
    tabInset = next;
    for (const listener of [...insetListeners]) {
        try {
            listener(next);
        }
        catch { /* one bad listener must not stop the rest */ }
    }
}
function getChanceTabInset() { return tabInset; }
/** Calls back whenever the tab row's height changes. Returns the unsubscribe function. */
function onChanceTabInset(listener) {
    insetListeners.add(listener);
    return () => { insetListeners.delete(listener); };
}
const tabListeners = new Set();
let chanceTab = 'adpopcorn';
function setChanceTab(id) {
    const next = typeof id === 'string' && id ? id : 'adpopcorn';
    if (next === chanceTab)
        return;
    chanceTab = next;
    for (const listener of [...tabListeners]) {
        try {
            listener(next);
        }
        catch { /* one bad listener must not stop the rest */ }
    }
}
function getChanceTab() { return chanceTab; }
/** Calls back whenever the picked 찬스 tab changes. Returns the unsubscribe function. */
function onChanceTab(listener) {
    tabListeners.add(listener);
    return () => { tabListeners.delete(listener); };
}
const sheetListeners = new Set();
let sheetOpen = false;
function setChanceSheetOpen(open) {
    const next = open === true;
    if (next === sheetOpen)
        return;
    sheetOpen = next;
    for (const listener of [...sheetListeners]) {
        try {
            listener(next);
        }
        catch { /* one bad listener must not stop the rest */ }
    }
}
function getChanceSheetOpen() { return sheetOpen; }
/** Calls back whenever the value changes. Returns the unsubscribe function. */
function onChanceSheetOpen(listener) {
    sheetListeners.add(listener);
    return () => { sheetListeners.delete(listener); };
}
