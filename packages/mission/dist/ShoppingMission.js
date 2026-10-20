"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShoppingMission = ShoppingMission;
exports.ShoppingMissionModal = ShoppingMissionModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const entry_1 = require("./entry");
const MissionWebView_1 = require("./MissionWebView");
const states_1 = require("./states");
const i18n_1 = require("./i18n");
const missionNav_1 = require("./missionNav");
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
function ShoppingMission({ fetchJson, onClose, title, adId, source = 'other', safeAreaInsets, theme = states_1.DEFAULT_THEME, lang, hint = true, hintText, backRef: outerBack, ...webViewProps }) {
    // 기본 제목은 홈 목록 줄 · 서버 카드 이름과 같게(0.4.2, 대표님 2026-10-20 09:49 「일주일 쇼핑 미션 => 쇼핑 태그 퀴즈1」)
    const heading = title === undefined ? (0, i18n_1.t)('쇼핑 태그 퀴즈1', lang) : title;
    const [result, setResult] = (0, react_1.useState)(null);
    const [attempt, setAttempt] = (0, react_1.useState)(0);
    const [canGoBack, setCanGoBack] = (0, react_1.useState)(false);
    const [hintVisible, setHintVisible] = (0, react_1.useState)(hint);
    // 같은 단계는 세션당 1회 — state 가 아니라 ref(콜백이 바뀌어 입장 effect 가 다시 돌면 무한 반복)
    const tracedStages = (0, react_1.useRef)(new Set());
    const [overlayReady, setOverlayReady] = (0, react_1.useState)(JcurveOverlay?.isAvailable?.() ? JcurveOverlay.hasPermission?.() : false);
    const goBack = (0, react_1.useRef)(null);
    const startTimeRef = (0, react_1.useRef)(Date.now());
    const canGoBackRef = (0, react_1.useRef)(false);
    const navigationChanged = (0, react_1.useCallback)((navigation) => {
        canGoBackRef.current = navigation.canGoBack;
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
        canGoBackRef.current = false;
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
    // 닫기는 기록이 실패해도 반드시 닫는다(0.4.3)
    const closeRef = (0, react_1.useRef)(onClose);
    closeRef.current = onClose;
    const handleClose = (0, react_1.useCallback)(() => {
        try {
            traceStage('close', { ms: Date.now() - startTimeRef.current });
        }
        catch { /* 기록 실패는 닫기를 막지 않는다 */ }
        closeRef.current();
    }, [traceStage]);
    /*
     | 뒤로가기 — 웹 기록이 있으면 웹에서 한 칸, 없으면 화면 닫기(0.4.3, 대표님 10-20 11:44 「닫기도 뒤로가기도 안되고」).
     | 전에는 웹 기록이 없으면 단추가 꺼져 있었고, Modal 안 iOS 에는 밀어서 나가는 길도 없어 「닫기」 하나뿐이었다
     */
    const back = (0, react_1.useCallback)(() => {
        if ((0, missionNav_1.backTarget)(canGoBackRef.current) === 'web' && goBack.current)
            goBack.current();
        else
            handleClose();
    }, [handleClose]);
    const backRef = (0, react_1.useRef)(back);
    backRef.current = back;
    if (outerBack)
        outerBack.current = back;
    // 안드로이드 뒤로 — 로딩 · 오류 화면에서도(웹뷰가 아직 없을 때도) 같은 규칙
    (0, react_1.useEffect)(() => {
        if (react_native_1.Platform.OS !== 'android')
            return;
        const sub = react_native_1.BackHandler.addEventListener('hardwareBackPress', () => { backRef.current(); return true; });
        return () => sub.remove();
    }, []);
    // iOS 왼쪽 가장자리를 오른쪽으로 밀면 뒤로가기(웹 기록 → 없으면 닫기)
    const edge = (0, react_1.useRef)(react_native_1.PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => (0, missionNav_1.edgeSwipeStarts)(g.dx, g.dy),
        onPanResponderRelease: (_e, g) => { if ((0, missionNav_1.edgeSwipeDone)(g.dx, g.dy, g.vx))
            backRef.current(); },
        onPanResponderTerminationRequest: () => false,
    })).current;
    const top = (0, missionNav_1.safeTop)(react_native_1.Platform.OS, safeAreaInsets.top, react_native_1.Dimensions.get('window').height);
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.screen, { backgroundColor: theme.bg, paddingTop: top, paddingBottom: safeAreaInsets.bottom, paddingLeft: safeAreaInsets.left ?? 0, paddingRight: safeAreaInsets.right ?? 0 }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.bar, { backgroundColor: theme.bg, borderBottomColor: theme.line }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: (0, i18n_1.t)('닫기', lang), onPress: handleClose, hitSlop: 12, style: s.button, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.buttonText, { color: theme.text }], children: (0, i18n_1.t)('닫기', lang) }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { numberOfLines: 1, style: [s.title, { color: theme.text }], children: heading }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: (0, i18n_1.t)('뒤로가기', lang), accessibilityHint: canGoBack ? undefined : (0, i18n_1.t)('닫기', lang), onPress: back, hitSlop: 12, style: s.button, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.buttonText, { color: theme.text }], children: (0, i18n_1.t)('뒤로가기', lang) }) })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.body, children: [result?.ok ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [hintVisible && (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.hintBar, { backgroundColor: theme.line }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.hintText, { color: theme.text }], children: hintText ?? (0, i18n_1.t)('상품을 10초만 구경하면 포인트가 들어와요', lang) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: (0, i18n_1.t)('닫기', lang), onPress: () => setHintVisible(false), hitSlop: 8, style: s.hintClose, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.hintCloseText, { color: theme.text }], children: "\u2715" }) })] }), (0, jsx_runtime_1.jsx)(MissionWebView_1.MissionWebView, { ...webViewProps, url: result.url, theme: theme, onClose: handleClose, onNavigationChange: navigationChanged, traceStage: traceStage, overlayReady: webViewProps.overlayReady ?? overlayReady, lang: lang })] })) : result ? ((0, jsx_runtime_1.jsx)(states_1.MissionState, { kind: result.reason === 'off' ? 'off' : result.reason === 'not_ready' ? 'notReady' : 'error', theme: theme, onClose: handleClose, onRetry: () => setAttempt(n => n + 1), lang: lang })) : ((0, jsx_runtime_1.jsx)(states_1.MissionLoading, { theme: theme, lang: lang })), react_native_1.Platform.OS === 'ios' ? (0, jsx_runtime_1.jsx)(react_native_1.View, { ...edge.panHandlers, style: s.edge }) : null] })] });
}
/**
 * (0.4.3) 쇼핑 미션을 전체 화면 Modal 로 — 안드로이드 뒤로 버튼은 Modal 안에서 BackHandler 가 아니라 onRequestClose 로 온다.
 * 앱이 `onRequestClose={() => 닫기}` 로 물리면 웹 기록을 건너뛰고 바로 닫혔다. 이 껍데기는 같은 뒤로가기 규칙(웹 기록 → 닫기)을 쓴다
 */
function ShoppingMissionModal({ visible, ...props }) {
    const back = (0, react_1.useRef)(null);
    const close = props.onClose;
    return (0, jsx_runtime_1.jsx)(react_native_1.Modal, { visible: visible, animationType: "slide", presentationStyle: "fullScreen", onRequestClose: () => { if (back.current)
            back.current();
        else
            close(); }, children: visible ? (0, jsx_runtime_1.jsx)(ShoppingMission, { ...props, backRef: back }) : null });
}
const s = react_native_1.StyleSheet.create({
    screen: { flex: 1 },
    body: { flex: 1, zIndex: 0 },
    edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: missionNav_1.EDGE_WIDTH, zIndex: 3 },
    bar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, zIndex: 2, elevation: 2 },
    button: { minWidth: 64, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
    buttonText: { fontSize: 16, fontWeight: '700' },
    title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', marginHorizontal: 12 },
    hintBar: { minHeight: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'space-between', zIndex: 1 },
    hintText: { fontSize: 12, fontWeight: '500', flex: 1, marginRight: 8 },
    hintClose: { padding: 4 },
    hintCloseText: { fontSize: 16, fontWeight: '700' },
});
