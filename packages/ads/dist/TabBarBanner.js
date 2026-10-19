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
exports.TabBarBanner = TabBarBanner;
const react_1 = __importStar(require("react"));
/** Mount below the tabs, above the caller's safe-area inset. No fill means no space. */
function TabBarBanner({ unitId, enabled, format = 'banner' }) {
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
    return react_1.default.createElement(LoadedBanner, { key: `${format}:${unitId}`, sdk, rn, unitId, format });
}
function LoadedBanner({ sdk, rn, unitId, format }) {
    const [ready, setReady] = (0, react_1.useState)(false);
    const [failed, setFailed] = (0, react_1.useState)(false);
    const [ad, setAd] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let alive = true;
        let loaded;
        void Promise.resolve().then(() => sdk.default().initialize()).then(async () => {
            if (!alive)
                return;
            if (format === 'banner') {
                setReady(true);
                return;
            }
            loaded = await sdk.NativeAd.createForAdRequest(unitId, { startVideoMuted: true });
            // A one-line native slot cannot display mandatory video media. Do not retry/preload.
            if (!alive || loaded.mediaContent?.hasVideoContent) {
                loaded.destroy();
                loaded = null;
                return;
            }
            setAd(loaded);
        }).catch(() => { if (alive)
            setFailed(true); });
        return () => { alive = false; loaded?.destroy(); };
    }, [sdk, unitId, format]);
    if (failed)
        return null;
    const h = react_1.default.createElement;
    if (format === 'banner') {
        if (!ready)
            return null;
        return h(rn.View, { style: { height: ad ? undefined : 0, overflow: 'hidden', width: '100%', alignItems: 'center' } }, h(sdk.BannerAd, { unitId, size: sdk.BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
            onAdLoaded: () => setAd(true), onAdFailedToLoad: () => setFailed(true) }));
    }
    if (!ad)
        return null;
    // NativeAdView supplies AdChoices. Native attribution is required separately by AdMob.
    return h(sdk.NativeAdView, { nativeAd: ad, style: { height: 40, width: '100%', backgroundColor: '#fff' } }, h(rn.View, { collapsable: false, style: { height: 40, flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 28, gap: 8 } }, h(rn.Text, { style: { fontSize: 11, color: '#666', backgroundColor: '#eee', paddingHorizontal: 4 } }, 'AD'), ad.icon ? h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.ICON }, h(rn.Image, { source: { uri: ad.icon.url }, style: { width: 28, height: 28 } })) : null, h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.HEADLINE }, h(rn.Text, { numberOfLines: 1, style: { flex: 1, fontSize: 13, color: '#555' } }, ad.headline))));
}
