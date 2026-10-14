"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShoppingMission = ShoppingMission;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const entry_1 = require("./entry");
const MissionWebView_1 = require("./MissionWebView");
const states_1 = require("./states");
const i18n_1 = require("./i18n");
// Try to load overlay module (optional peer dependency)
let JcurveOverlay = null;
try {
    JcurveOverlay = require('@jcurve/overlay');
}
catch {
    // Module not available
}
/** 앱이 Modal 또는 내비게이션 화면 안에 넣는 쇼핑 미션 화면. */
/** (0.3.0) @jcurve/overlay 통합 — AppState 감시로 권한 상태 갱신, 기본 핸들러 제공 */
/** (0.3.1) `source` — 요청 출처('popup'|'push'|'tab'|'card'|'other'), 단계 기록(apihub/trace). `hint` — 「10초 구경하면 포인트」 안내 표시(기본값 true). `hintText` — 안내 문구 */
/** (0.2.1) `lang` — 머리글 · 상태 화면 문구 언어(앱이 넘긴다). 없거나 'ko' 면 지금과 같은 한국어. `title` 을 주면 그 글 그대로 */
function ShoppingMission({ fetchJson, onClose, title, adId, source = 'other', safeAreaInsets, theme = states_1.DEFAULT_THEME, lang, hint = true, hintText, ...webViewProps }) {
    const heading = title === undefined ? (0, i18n_1.t)('일주일 쇼핑 미션', lang) : title;
    const [result, setResult] = (0, react_1.useState)(null);
    const [attempt, setAttempt] = (0, react_1.useState)(0);
    const [canGoBack, setCanGoBack] = (0, react_1.useState)(false);
    const [hintVisible, setHintVisible] = (0, react_1.useState)(hint);
    // 같은 단계는 세션당 1회 — state 가 아니라 ref(콜백이 바뀌어 입장 effect 가 다시 돌면 무한 반복)
    const tracedStages = (0, react_1.useRef)(new Set());
    const [overlayReady, setOverlayReady] = (0, react_1.useState)(JcurveOverlay?.isAvailable?.() ? JcurveOverlay.hasPermission?.() : false);
    const goBack = (0, react_1.useRef)(null);
    const startTimeRef = (0, react_1.useRef)(Date.now());
    const navigationChanged = (0, react_1.useCallback)((navigation) => {
        setCanGoBack(navigation.canGoBack);
        goBack.current = navigation.goBack;
    }, []);
    const traceStage = (0, react_1.useCallback)((stage, params) => {
        if (!fetchJson)
            return; // Requester 없으면(옛 앱) 아무것도 안 함
        if (tracedStages.current.has(stage))
            return; // 같은 단계는 세션당 1회
        tracedStages.current.add(stage);
        void (0, entry_1.traceEntry)(fetchJson, { stage, source, ...params });
    }, [fetchJson, source]);
    // Monitor app state to update overlay permission status
    (0, react_1.useEffect)(() => {
        if (!JcurveOverlay?.isAvailable?.())
            return;
        const sub = react_native_1.AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                setOverlayReady(JcurveOverlay.hasPermission?.() ?? false);
            }
        });
        return () => sub.remove();
    }, []);
    (0, react_1.useEffect)(() => {
        let live = true;
        setResult(null);
        setCanGoBack(false);
        tracedStages.current = new Set();
        setHintVisible(hint);
        goBack.current = null;
        startTimeRef.current = Date.now();
        // entry 단계 기록
        traceStage('entry');
        void (0, entry_1.fetchEntry)(fetchJson, adId).then(r => { if (live)
            setResult(r); });
        return () => { live = false; };
    }, [fetchJson, adId, attempt, hint, traceStage]);
    const handleClose = () => {
        const ms = Date.now() - startTimeRef.current;
        traceStage('close', { ms });
        onClose();
    };
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.screen, { backgroundColor: theme.bg, paddingTop: safeAreaInsets.top, paddingBottom: safeAreaInsets.bottom, paddingLeft: safeAreaInsets.left ?? 0, paddingRight: safeAreaInsets.right ?? 0 }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.bar, { backgroundColor: theme.bg, borderBottomColor: theme.line }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: (0, i18n_1.t)('닫기', lang), onPress: handleClose, hitSlop: 12, style: s.button, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.buttonText, { color: theme.text }], children: (0, i18n_1.t)('닫기', lang) }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { numberOfLines: 1, style: [s.title, { color: theme.text }], children: heading }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: (0, i18n_1.t)('뒤로가기', lang), accessibilityState: { disabled: !canGoBack }, disabled: !canGoBack, onPress: () => goBack.current?.(), hitSlop: 12, style: [s.button, { opacity: canGoBack ? 1 : 0.35 }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.buttonText, { color: theme.text }], children: (0, i18n_1.t)('뒤로가기', lang) }) })] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.body, children: result?.ok ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [hintVisible && (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.hintBar, { backgroundColor: theme.line }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.hintText, { color: theme.text }], children: hintText ?? (0, i18n_1.t)('상품을 10초만 구경하면 포인트가 들어와요', lang) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: (0, i18n_1.t)('닫기', lang), onPress: () => setHintVisible(false), hitSlop: 8, style: s.hintClose, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.hintCloseText, { color: theme.text }], children: "\u2715" }) })] }), (0, jsx_runtime_1.jsx)(MissionWebView_1.MissionWebView, { ...webViewProps, url: result.url, theme: theme, onClose: handleClose, onNavigationChange: navigationChanged, traceStage: traceStage, overlayReady: webViewProps.overlayReady ?? overlayReady, lang: lang })] })) : result ? ((0, jsx_runtime_1.jsx)(states_1.MissionState, { kind: result.reason === 'off' ? 'off' : result.reason === 'not_ready' ? 'notReady' : 'error', theme: theme, onClose: handleClose, onRetry: () => setAttempt(n => n + 1), lang: lang })) : ((0, jsx_runtime_1.jsx)(states_1.MissionLoading, { theme: theme, lang: lang })) })] });
}
const s = react_native_1.StyleSheet.create({
    screen: { flex: 1 },
    body: { flex: 1, zIndex: 0 },
    bar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, zIndex: 2, elevation: 2 },
    button: { minWidth: 64, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
    buttonText: { fontSize: 16, fontWeight: '700' },
    title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', marginHorizontal: 12 },
    hintBar: { minHeight: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'space-between', zIndex: 1 },
    hintText: { fontSize: 12, fontWeight: '500', flex: 1, marginRight: 8 },
    hintClose: { padding: 4 },
    hintCloseText: { fontSize: 16, fontWeight: '700' },
});
