"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMBEDDED_DETAIL_TIMEOUT_MS = void 0;
exports.embeddedDetailSupported = embeddedDetailSupported;
exports.registerEmbeddedWall = registerEmbeddedWall;
exports.embeddedDetailAvailable = embeddedDetailAvailable;
exports.openEmbeddedDetail = openEmbeddedDetail;
exports.embeddedDetailLoaded = embeddedDetailLoaded;
exports.embeddedDetailFailed = embeddedDetailFailed;
/**
 * Showing one campaign's detail INSIDE the Chance tab's embedded wall (iOS `AdPopcornOfferwallViewController.detailPageCampaignKey`,
 * the `detailCampaignKey` view prop that 0.3.0 binaries already have), so the RN chip stays on top of it. The SDK's full-screen
 * detail is a native screen and covers every RN view.
 *
 * `ComboEntry` asks (`openEmbeddedDetail`), the mounted `OfferwallScreen` answers by remounting its wall with the key and
 * telling when it loaded. Pure JS: no native lookup of its own, nothing runs at import time. Without a mounted wall (Home, Android,
 * a binary without the bridge) the answer is simply "no" and the caller uses the SDK's full-screen detail as before.
 */
const native_1 = require("./native");
/** How long the embedded detail may take to report "loaded" before the caller gives up and opens the SDK's full-screen detail. */
exports.EMBEDDED_DETAIL_TIMEOUT_MS = 10000;
const walls = [];
let counter = 0;
let pending = null;
/** iOS with the native bridge: the only place the embedded wall can take a detail key. Never throws. */
function embeddedDetailSupported() {
    try {
        const rn = require('react-native');
        return rn.Platform.OS === 'ios' && (0, native_1.hasNativeBridge)();
    }
    catch {
        return false;
    }
}
/** A mounted wall that can show a detail registers here; the last one registered answers. Returns the unregister function. */
function registerEmbeddedWall(show) {
    walls.push(show);
    return () => {
        const at = walls.indexOf(show);
        if (at >= 0)
            walls.splice(at, 1);
        if (!walls.length && pending)
            settle(pending.nonce, false, false);
    };
}
/** True when a wall is mounted that can open a detail. */
function embeddedDetailAvailable() { return walls.length > 0; }
function settle(nonce, shown, resetWall) {
    if (!pending || pending.nonce !== nonce)
        return;
    const { resolve, timer } = pending;
    clearTimeout(timer);
    pending = null;
    if (!shown && resetWall)
        walls[walls.length - 1]?.(null); // back to the plain list
    resolve(shown);
}
/**
 * Asks the mounted wall to show this campaign's detail. Resolves true once the wall reports it loaded; false when no wall
 * is mounted, the wall fails, or `timeoutMs` passes (the wall is then put back to the list). A newer request replaces an older one.
 */
function openEmbeddedDetail(key, timeoutMs = exports.EMBEDDED_DETAIL_TIMEOUT_MS) {
    const wall = walls[walls.length - 1];
    if (!wall || !key)
        return Promise.resolve(false);
    if (pending)
        settle(pending.nonce, false, false);
    const nonce = ++counter;
    return new Promise(resolve => {
        pending = { nonce, resolve, timer: setTimeout(() => settle(nonce, false, true), timeoutMs) };
        try {
            wall({ key, nonce });
        }
        catch {
            settle(nonce, false, false);
        }
    });
}
/** The wall calls these from its native view's events. */
function embeddedDetailLoaded(nonce) { settle(nonce, true, false); }
function embeddedDetailFailed(nonce) { settle(nonce, false, true); }
