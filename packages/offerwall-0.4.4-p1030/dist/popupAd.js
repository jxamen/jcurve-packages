"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POPUP_AD_RETRY_MS = void 0;
exports.popupAdUnit = popupAdUnit;
exports.popupAdAvailable = popupAdAvailable;
exports.OfferwallPopupAd = OfferwallPopupAd;
const combos_1 = require("./combos");
/** NativeMediaAspectRatio.LANDSCAPE */
const NATIVE_LANDSCAPE = 2;
const IMAGE_TRIES = 5;
exports.POPUP_AD_RETRY_MS = [3000, 10000, 30000];
function loadSdk() {
    try {
        return require('react-native-google-mobile-ads');
    }
    catch {
        return null;
    }
}
/** The ad unit id for this OS from what the app gave ('' when none). */
function popupAdUnit(adUnit, os) {
    if (typeof adUnit === 'string')
        return adUnit.trim();
    let platform = os;
    if (!platform) {
        try {
            platform = require('react-native').Platform.OS;
        }
        catch {
            platform = 'android';
        }
    }
    const unit = platform === 'ios' ? adUnit?.ios : adUnit?.android;
    return typeof unit === 'string' ? unit.trim() : '';
}
/** Is the ad possible at all (an SDK and a unit)? Used to decide whether the popup leaves room for it. */
function popupAdAvailable(options) {
    return !!loadSdk() && (!!options.testMode || !!popupAdUnit(options.adUnit));
}
function OfferwallPopupAd({ adUnit, testMode = false, testDevices = [], theme = combos_1.DEFAULT_COMBO_THEME, style }) {
    const React = require('react');
    const sdk = loadSdk();
    const configured = popupAdUnit(adUnit);
    const unit = sdk ? (testMode ? sdk.TestIds.NATIVE : configured) : '';
    const [width, setWidth] = React.useState(0);
    const [ad, setAd] = React.useState(null);
    const [round, setRound] = React.useState(0);
    const tries = React.useRef(0);
    const devicesKey = testDevices.join(',');
    React.useEffect(() => {
        if (!sdk || !unit)
            return;
        let alive = true;
        let loaded = null;
        let retry = null;
        // test devices first, so a review device does not get a real ad
        void Promise.resolve(sdk.default().setRequestConfiguration({ testDeviceIdentifiers: devicesKey ? devicesKey.split(',') : [] }))
            .catch(() => null)
            .then(() => sdk.default().initialize())
            .then(async () => {
            let video = null;
            for (let i = 0; i < IMAGE_TRIES; i += 1) {
                if (!alive) {
                    video?.destroy();
                    return;
                }
                let a;
                try {
                    a = await sdk.NativeAd.createForAdRequest(unit, { aspectRatio: NATIVE_LANDSCAPE, startVideoMuted: true });
                }
                catch {
                    break;
                }
                if (!alive) {
                    a.destroy();
                    video?.destroy();
                    return;
                }
                if (a.mediaContent?.hasVideoContent) {
                    video?.destroy();
                    video = a;
                    continue;
                }
                video?.destroy();
                loaded = a;
                setAd(a);
                return;
            }
            if (video) {
                loaded = video;
                setAd(video);
                return;
            }
            if (tries.current < exports.POPUP_AD_RETRY_MS.length)
                retry = setTimeout(() => { if (alive)
                    setRound(n => n + 1); }, exports.POPUP_AD_RETRY_MS[tries.current++]);
        })
            .catch(() => null);
        return () => { alive = false; if (retry)
            clearTimeout(retry); loaded?.destroy(); };
    }, [unit, round, devicesKey]);
    if (!sdk || !unit || !ad)
        return null;
    const { View, Text, Image } = require('react-native');
    const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = sdk;
    const h = React.createElement;
    const ratio = ad.mediaContent?.aspectRatio ?? 0;
    const hasMedia = !!ad.mediaContent && (!!ad.mediaContent.hasVideoContent || ratio >= 1 || ratio === 0);
    const grey = theme.chipBg ?? theme.line;
    return h(View, {
        collapsable: false, onLayout: (event) => setWidth(event.nativeEvent.layout.width),
        style: [{ width: '100%', borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, overflow: 'hidden', marginTop: 16 }, style],
    }, h(NativeAdView, { nativeAd: ad, style: { width: '100%', overflow: 'hidden', height: 180 + (hasMedia ? Math.max(0, width - 22) * 9 / 16 + 6 : 0) } }, h(View, { collapsable: false, style: { width: '100%', padding: 10, gap: 6 } }, h(View, { style: { height: 20, flexDirection: 'row', alignItems: 'center', gap: 6 } }, h(View, { style: { borderRadius: 6, backgroundColor: grey, paddingHorizontal: 6, paddingVertical: 2 } }, h(Text, { style: { fontSize: 10, fontWeight: '800', color: theme.sub } }, '광고')), ad.advertiser ? h(NativeAsset, { assetType: NativeAssetType.ADVERTISER }, h(Text, { style: { flexShrink: 1, fontSize: 11, color: theme.sub }, numberOfLines: 1 }, ad.advertiser)) : null), hasMedia ? h(View, { style: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, overflow: 'hidden', backgroundColor: grey } }, h(NativeMediaView, { resizeMode: 'contain', style: { width: '100%', height: '100%', aspectRatio: undefined } })) : null, h(View, { style: { minHeight: 80, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 10 } }, ad.icon ? h(NativeAsset, { assetType: NativeAssetType.ICON }, h(Image, { source: { uri: ad.icon.url }, style: { width: 48, height: 48, borderRadius: 14, backgroundColor: grey } })) : null, h(View, { style: { flex: 1, minWidth: 0, gap: 2 } }, h(NativeAsset, { assetType: NativeAssetType.HEADLINE }, h(Text, { style: { fontSize: theme.font.small, fontWeight: '800', color: theme.text, lineHeight: 20 }, numberOfLines: 2 }, ad.headline)), ad.body ? h(NativeAsset, { assetType: NativeAssetType.BODY }, h(Text, { style: { fontSize: 13, color: theme.sub, lineHeight: 18 }, numberOfLines: 2 }, ad.body)) : null)), ad.callToAction ? h(NativeAsset, { assetType: NativeAssetType.CALL_TO_ACTION }, h(View, { style: { alignSelf: 'stretch', minHeight: 42, paddingVertical: 4, borderRadius: theme.radius.slot, backgroundColor: grey, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 } }, h(Text, { style: { fontSize: theme.font.small, fontWeight: '800', color: theme.text }, numberOfLines: 1 }, ad.callToAction))) : null)));
}
