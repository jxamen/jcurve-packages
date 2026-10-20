"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATIVE_REFRESH_MS = exports.NATIVE_RETRY_MS = exports.NATIVE_SLOT_HEIGHT = void 0;
exports.bannerSlotHeight = bannerSlotHeight;
exports.TabBarBanner = TabBarBanner;
exports.nativeCtaLabel = nativeCtaLabel;
const react_1 = __importStar(require("react"));
const i18n_1 = require("./i18n");
/** Outer height of a native slot (dp). Reserved from the first render. */
exports.NATIVE_SLOT_HEIGHT = 40;
/**
 * Estimated height (dp) of an anchored adaptive banner for a window, used to reserve the slot **before** the ad loads (1.9.8).
 * Google documents only the limits — at least 50 and at most 15% of the device height (the Unity guide adds a 90 dp cap) — not the formula.
 * So: the standard 320x50 ratio scaled to the width, `ceil(width * 50 / 320)`, clamped to [50, min(90, 15% of height)].
 * e.g. 360 -> 57, 390 -> 61, 412 -> 65, tablets -> 90. It is an estimate: the SDK's real height can differ by a few dp, which is why the slot
 * centers and clips the ad instead of resizing (the outer height must never move the tab row).
 */
function bannerSlotHeight(windowWidth, windowHeight) {
    const width = Number.isFinite(windowWidth) && windowWidth > 0 ? windowWidth : 320;
    const byWidth = Math.ceil(width * 50 / 320);
    const cap = typeof windowHeight === 'number' && Number.isFinite(windowHeight) && windowHeight > 0 ? Math.min(90, Math.floor(windowHeight * 0.15)) : 90;
    return Math.max(50, Math.min(byWidth, Math.max(50, cap)));
}
/**
 * Mount below the tabs, above the caller's safe-area inset.
 * (1.9.8) The slot is **reserved from the first render** with a fixed outer height, so the tab row never jumps when the ad arrives:
 * before load, no fill, exhausted retries, video filtered out and creative swaps all keep the same height (empty slot = `backgroundColor`).
 * Only `enabled=false`, a missing unit, web, or no ads SDK reserve nothing (0 height).
 */
function TabBarBanner({ unitId, enabled, format = 'banner', backgroundColor = '#fff', bannerHeight, lang, onState }) {
    if (!enabled || !unitId)
        return null;
    // Optional native peers: importing this package must remain safe on web/Expo Go.
    let sdk;
    let rn;
    try {
        sdk = require('react-native-google-mobile-ads');
        rn = require('react-native');
    }
    catch {
        return null;
    }
    if (rn.Platform.OS === 'web')
        return null;
    return react_1.default.createElement(LoadedBanner, { key: `${format}:${unitId}`, sdk, rn, unitId, format, backgroundColor, bannerHeight, lang, onState });
}
/** Retry delays after no fill / video creative (ms). After the last one the slot stays reserved but empty. */
exports.NATIVE_RETRY_MS = [3000, 10000, 30000, 60000];
/** Swap the creative while it stays on screen. */
exports.NATIVE_REFRESH_MS = 60000;
/**
 * (1.9.10) Label of the native row's call-to-action button: the ad's own `callToAction` text, or "설치" (en: "Install") when the ad has none.
 * AdMob lists "Call to action" as a required element of a native ad (policy table), so the row always shows one.
 */
function nativeCtaLabel(callToAction, lang) {
    const text = typeof callToAction === 'string' ? callToAction.trim() : '';
    return text || (0, i18n_1.t)('설치', lang);
}
/** Small filled button, right end of the 40dp row. `flexShrink: 0` keeps it whole — the headline is what shrinks. */
const CTA_STYLE = {
    flexShrink: 0, maxWidth: 96, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, overflow: 'hidden',
    backgroundColor: '#555', color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center',
};
/** Short, single-line description of an SDK error for `TabBarBannerState.error` (never throws). */
function describeError(e) {
    if (e == null)
        return undefined;
    try {
        const text = typeof e === 'string' ? e : [e.code, e.message].filter(Boolean).join(': ') || String(e);
        return text.slice(0, 200);
    }
    catch {
        return undefined;
    }
}
function LoadedBanner({ sdk, rn, unitId, format, backgroundColor, bannerHeight, lang, onState }) {
    const [ready, setReady] = (0, react_1.useState)(false);
    const [failed, setFailed] = (0, react_1.useState)(false);
    const [ad, setAd] = (0, react_1.useState)(null);
    // Always call the latest callback without restarting the loader (it is not an effect dependency).
    const callback = (0, react_1.useRef)(onState);
    callback.current = onState;
    const report = (state, tries, error) => {
        const fn = callback.current;
        if (!fn)
            return;
        const text = describeError(error);
        try {
            fn(text ? { state, tries, error: text } : { state, tries });
        }
        catch { /* diagnostics must never break the slot */ }
    };
    (0, react_1.useEffect)(() => {
        let alive = true;
        let shown = null;
        let timer = null;
        let tries = 0; // retries used (picks the next delay)
        let requests = 0; // requests since the last loaded (reported as `tries`)
        const later = (ms) => { timer = setTimeout(() => { void load(); }, ms); };
        // A one-line native slot cannot display mandatory video media: drop video and ask again
        // (2026-10-19 owner: 「배너 광고가 하나도 안 나와」 — one video creative used to leave the slot empty for the whole session).
        const load = async () => {
            let next = null;
            let error;
            requests++;
            report('requesting', requests);
            try {
                next = await sdk.NativeAd.createForAdRequest(unitId, { startVideoMuted: true });
            }
            catch (e) {
                next = null;
                error = e;
            }
            if (!alive) {
                next?.destroy();
                return;
            }
            if (next && !next.mediaContent?.hasVideoContent) {
                const old = shown;
                shown = next;
                setAd(next);
                old?.destroy();
                report('loaded', requests);
                tries = 0;
                requests = 0;
                later(exports.NATIVE_REFRESH_MS);
                return;
            }
            next?.destroy();
            report(next ? 'video-dropped' : 'no-fill', requests, error);
            if (shown) {
                requests = 0;
                later(exports.NATIVE_REFRESH_MS);
                return;
            } // keep the current creative
            if (tries < exports.NATIVE_RETRY_MS.length)
                later(exports.NATIVE_RETRY_MS[tries++]);
            else
                report('retries-exhausted', requests);
        };
        void Promise.resolve().then(() => sdk.default().initialize()).then(() => {
            if (!alive)
                return;
            if (format === 'banner') {
                setReady(true);
                report('requesting', 1);
                return;
            }
            return load();
        }).catch((e) => { if (alive) {
            setFailed(true);
            report('init-failed', requests, e);
        } });
        return () => { alive = false; if (timer)
            clearTimeout(timer); shown?.destroy(); };
    }, [sdk, unitId, format]);
    const h = react_1.default.createElement;
    // One outer View for every state — its height is decided here, once, and nothing below can change it.
    const win = rn.Dimensions?.get?.('window');
    const slotHeight = format === 'native' ? exports.NATIVE_SLOT_HEIGHT : (typeof bannerHeight === 'number' && bannerHeight > 0 ? bannerHeight : bannerSlotHeight(win?.width, win?.height));
    const slot = (child) => h(rn.View, { style: { height: slotHeight, width: '100%', overflow: 'hidden', backgroundColor, alignItems: 'center', justifyContent: 'center' } }, child);
    if (format === 'banner') {
        // The BannerAd renders nothing (0x0) until it loads; a failed request just leaves the empty slot.
        return slot(ready && !failed ? h(sdk.BannerAd, { unitId, size: sdk.BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
            onAdLoaded: () => report('loaded', 1), onAdFailedToLoad: (e) => { setFailed(true); report('no-fill', 1, e); } }) : null);
    }
    if (!ad || failed)
        return slot(null);
    // NativeAdView supplies AdChoices. Native attribution is required separately by AdMob.
    // Centered row (2026-10-19 owner 「가운데 정렬로」); side padding keeps clear of the AdChoices corner (top right by default).
    // (1.9.10) Only the registered assets — icon, headline, call to action — take taps: the badge, the row and the NativeAdView carry no
    // handlers and are not registered, so the background is not clickable (AdMob: "The background of the ad must be not clickable").
    // Video creatives never get here (dropped in load), so no MediaView is needed.
    return slot(h(sdk.NativeAdView, { nativeAd: ad, style: { height: exports.NATIVE_SLOT_HEIGHT, width: '100%', backgroundColor } }, h(rn.View, { collapsable: false, style: { height: exports.NATIVE_SLOT_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 8 } }, h(rn.Text, { style: { fontSize: 11, color: '#666', backgroundColor: '#eee', paddingHorizontal: 4 } }, 'AD'), ad.icon ? h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.ICON }, h(rn.Image, { source: { uri: ad.icon.url }, style: { width: 28, height: 28 } })) : null, h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.HEADLINE }, h(rn.Text, { numberOfLines: 1, style: { flexShrink: 1, fontSize: 13, color: '#555' } }, ad.headline)), h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.CALL_TO_ACTION }, h(rn.Text, { numberOfLines: 1, style: CTA_STYLE }, nativeCtaLabel(ad.callToAction, lang))))));
}
