"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OFFERWALL_SCREEN_MARK = void 0;
exports.OfferwallScreen = OfferwallScreen;
const index_1 = require("./index");
const embeddedDetail_1 = require("./embeddedDetail");
exports.OFFERWALL_SCREEN_MARK = 'jcurve-offerwall-screen:headerless-v1';
/** Tab content: no host header. The host owns status-bar and bottom-tab safe areas. */
function OfferwallScreen({ usn, onClose, onRetry, loadingColor = '#555', topInset = 0 }) {
    const React = require('react');
    const { View, Text, Pressable, ActivityIndicator, BackHandler, StyleSheet } = require('react-native');
    const h = React.createElement;
    const [loaded, setLoaded] = React.useState(false);
    const [error, setError] = React.useState(false);
    const [attempt, setAttempt] = React.useState(0);
    // A campaign detail asked for by the combos guide: this wall reloads straight into that detail (iOS only, see embeddedDetail.ts).
    const [detail, setDetail] = React.useState(null);
    const detailNonce = detail?.nonce ?? 0;
    React.useEffect(() => ((0, embeddedDetail_1.embeddedDetailSupported)() ? (0, embeddedDetail_1.registerEmbeddedWall)(setDetail) : undefined), []);
    React.useEffect(() => { setLoaded(false); setError(false); }, [usn, attempt, detailNonce]);
    React.useEffect(() => {
        if (loaded)
            return;
        const timer = setTimeout(() => setError(true), 20000);
        return () => clearTimeout(timer);
    }, [loaded, usn, attempt, detailNonce]);
    React.useEffect(() => { if (loaded)
        setError(false); }, [loaded]);
    React.useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
        return () => subscription.remove();
    }, [onClose]);
    const status = { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 16 };
    return h(View, { style: { flex: 1, backgroundColor: '#fff', paddingTop: Math.max(0, topInset) } }, h(View, { style: { flex: 1, overflow: 'hidden' } }, usn && !error ? h(index_1.OfferwallView, {
        key: `${usn}:${attempt}:${detailNonce}`, usn,
        ...(detail ? { detailCampaignKey: detail.key } : {}),
        onLoaded: () => { setLoaded(true); if (detail)
            (0, embeddedDetail_1.embeddedDetailLoaded)(detail.nonce); },
        // a failed detail goes back to the list (the requester then uses the SDK's full-screen detail); only the plain wall shows the error page
        onError: () => { if (detail)
            (0, embeddedDetail_1.embeddedDetailFailed)(detail.nonce);
        else
            setError(true); },
    }) : null, error ? h(View, { style: [status, { backgroundColor: '#fff' }] }, h(Text, null, '찬스를 불러오지 못했어요'), h(Pressable, { accessibilityRole: 'button', onPress: () => { setAttempt(n => n + 1); onRetry(); },
        style: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#f1f1f1', borderRadius: 12 } }, h(Text, null, '다시 시도')))
        : !loaded ? h(View, { style: status, pointerEvents: 'none' }, h(ActivityIndicator, { color: loadingColor })) : null));
}
