"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionWebView = MissionWebView;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_webview_1 = require("react-native-webview");
const bridge_1 = require("./bridge");
const entry_1 = require("./entry");
const policy_1 = require("./policy");
const shim_1 = require("./shim");
const states_1 = require("./states");
// Try to load overlay module (optional peer dependency)
let JcurveOverlay = null;
try {
    JcurveOverlay = require('@jcurve/overlay');
}
catch {
    // Module not available
}
const WebView = react_native_webview_1.WebView;
/** 웹뷰가 이 시간 안에 첫 화면을 못 띄우면 에러 화면 */
const LOAD_TIMEOUT_MS = 20000;
/** 렌더러가 죽어 다시 만든 횟수가 이를 넘으면 오류 화면 */
const MAX_RECOVER = 2;
const nonceOf = () => Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
/** 주소가 바뀌었거나 다시 시도할 때마다 상태를 처음부터 */
function MissionWebView({ url, theme = states_1.DEFAULT_THEME, onClose, onEvent, onFloatingPopup, onOverlayRequest, overlayReady: overlayReadyProp, onNavigationChange, traceStage, lang, nativeSwipeBack = true }) {
    const valid = (0, entry_1.isEntryUrl)(url);
    const [state, setState] = (0, react_1.useState)('loading');
    const [retryKey, setRetryKey] = (0, react_1.useState)(0); // 사용자가 다시 시도(처음부터)
    const [rebuild, setRebuild] = (0, react_1.useState)(0); // 렌더러가 죽어 웹뷰만 다시 만듦(실패 횟수는 이어서 센다)
    const secret = (0, react_1.useMemo)(nonceOf, [url, retryKey, rebuild]); // 이 로드의 비밀 값 — shim 안에만 있다
    const handle = (0, react_1.useRef)(null);
    const timer = (0, react_1.useRef)(null);
    const loadedTimer = (0, react_1.useRef)(null);
    const recovered = (0, react_1.useRef)(0);
    const failedRef = (0, react_1.useRef)(false);
    const stateRef = (0, react_1.useRef)('loading');
    const canGoBack = (0, react_1.useRef)(false);
    const navigationCallback = (0, react_1.useRef)(onNavigationChange);
    navigationCallback.current = onNavigationChange;
    const updateNavigation = (0, react_1.useCallback)((back) => {
        canGoBack.current = back;
        navigationCallback.current?.({ canGoBack: back, goBack: () => { if (canGoBack.current)
                handle.current?.goBack(); } });
    }, []);
    const platform = react_native_1.Platform.OS === 'ios' ? 'ios' : 'android';
    // Overlay integration: use prop if provided, otherwise get from module
    const actualOverlayReady = overlayReadyProp !== undefined
        ? overlayReadyProp
        : (JcurveOverlay?.hasPermission?.() ?? false);
    // Default overlay handlers (if not provided in props)
    const handleOverlayRequest = (0, react_1.useCallback)(() => {
        onOverlayRequest?.();
        if (!onOverlayRequest && JcurveOverlay?.requestPermission) {
            JcurveOverlay.requestPermission();
        }
    }, [onOverlayRequest]);
    const handleFloatingPopup = (0, react_1.useCallback)((params) => {
        onFloatingPopup?.(params);
        if (!onFloatingPopup && JcurveOverlay?.show) {
            void JcurveOverlay.show(params);
        }
    }, [onFloatingPopup]);
    const shim = (0, react_1.useMemo)(() => (0, shim_1.bridgeShim)(platform, actualOverlayReady, secret), [platform, actualOverlayReady, secret]);
    const setSt = (0, react_1.useCallback)((v) => { stateRef.current = v; setState(v); }, []);
    const disarm = (0, react_1.useCallback)(() => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
        if (loadedTimer.current) {
            clearTimeout(loadedTimer.current);
            loadedTimer.current = null;
        }
    }, []);
    const fail = (0, react_1.useCallback)((kind, why) => {
        failedRef.current = true;
        disarm();
        updateNavigation(false); // 오류 화면에서는 웹 히스토리로 뒤로 가지 않는다 — 뒤로 가기는 닫기
        setSt(kind);
        onEvent?.('mission_error', { kind, ...why });
    }, [disarm, onEvent, setSt, updateNavigation]);
    // 로드(첫 로드 · 웹뷰 안 이동 · reload)가 시작될 때마다 시간 제한을 다시 건다
    const arm = (0, react_1.useCallback)(() => {
        if (loadedTimer.current) {
            clearTimeout(loadedTimer.current);
            loadedTimer.current = null;
        } // 새 로드가 시작되면 이전 로드의 「성공 확인」은 취소
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = setTimeout(() => fail('error', { why: 'timeout' }), LOAD_TIMEOUT_MS);
    }, [fail]);
    // 주소 · 다시 시도가 바뀌면 처음부터(렌더러 복구는 여기 안 든다 — 반복 실패 횟수를 이어서 세려고)
    (0, react_1.useEffect)(() => {
        recovered.current = 0;
        failedRef.current = false;
        updateNavigation(false);
        setSt('loading');
        if (!valid) {
            fail('error', { why: 'bad_url' });
            return disarm;
        }
        onEvent?.('mission_open');
        arm();
        return disarm;
    }, [url, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps
    // Android 뒤로 가기 — 정상 화면에서 웹 히스토리가 있으면 먼저, 아니면(첫 페이지 · 오류 화면) 닫기
    (0, react_1.useEffect)(() => {
        if (react_native_1.Platform.OS !== 'android')
            return;
        const sub = react_native_1.BackHandler.addEventListener('hardwareBackPress', () => {
            const normal = stateRef.current === 'loading' || stateRef.current === 'ok';
            if (normal && canGoBack.current) {
                handle.current?.goBack();
                return true;
            }
            if (onClose) {
                onClose();
                return true;
            }
            return false;
        });
        return () => sub.remove();
    }, [onClose]);
    const retry = () => setRetryKey(n => n + 1);
    const recoverRenderer = (reload) => {
        recovered.current += 1;
        if (recovered.current > MAX_RECOVER) {
            fail('error', { why: 'renderer' });
            return;
        }
        failedRef.current = false;
        updateNavigation(false);
        arm();
        if (reload)
            handle.current?.reload();
        else
            setRebuild(n => n + 1);
    };
    const openExternal = (u) => { onEvent?.('mission_external_link'); void react_native_1.Linking.openURL(u).catch(() => undefined); };
    const onMessage = (e) => {
        // 보낸 쪽 화면이 승인된 origin 이고, 최상위 프레임이며, 이 로드의 비밀 값을 아는 글만 받는다
        if (!(0, entry_1.isAllowedOrigin)(e.nativeEvent.url))
            return;
        const m = (0, bridge_1.parseBridgeMessage)(e.nativeEvent.data, secret);
        if (!m)
            return;
        if (m.method === 'openAppTarget') {
            if (!(0, policy_1.resolveTarget)(m.params.url, m.params.fallbackUrl)) {
                onEvent?.('mission_target_blocked');
                return;
            }
            void (0, bridge_1.openAppTarget)(m.params, u => react_native_1.Linking.openURL(u)).then(opened => onEvent?.('mission_target_open', { opened }));
        }
        else if (m.method === 'showFloatingPopup') {
            onEvent?.('mission_floating_popup');
            handleFloatingPopup(m.params);
        }
        else if (m.method === 'requestOverlayPermission') {
            onEvent?.('mission_overlay_request');
            handleOverlayRequest();
        }
        // hasOverlayPermission 은 shim 이 바로 답한다(동기) — 여기는 올 일이 없다
    };
    if (state !== 'loading' && state !== 'ok')
        return (0, jsx_runtime_1.jsx)(states_1.MissionState, { kind: state, theme: theme, onRetry: retry, onClose: onClose, lang: lang });
    if (!valid)
        return (0, jsx_runtime_1.jsx)(states_1.MissionState, { kind: "error", theme: theme, onClose: onClose, lang: lang });
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1, backgroundColor: theme.bg }, children: [(0, jsx_runtime_1.jsx)(WebView, { ref: handle, source: { uri: url }, 
                // 모든 요청이 onShouldStartLoadWithRequest 를 거치게 한다(비 https 가 라이브러리 기본 처리로 빠져 우리 규칙을 건너뛰지 않게) — 거르는 건 아래 규칙
                originWhitelist: ['*'], injectedJavaScriptBeforeContentLoaded: shim, injectedJavaScriptBeforeContentLoadedForMainFrameOnly: true, injectedJavaScriptForMainFrameOnly: true, onMessage: onMessage, javaScriptEnabled: true, domStorageEnabled: true, sharedCookiesEnabled: true, thirdPartyCookiesEnabled: true, allowFileAccess: false, allowsInlineMediaPlayback: true, javaScriptCanOpenWindowsAutomatically: false, setSupportMultipleWindows: false, setBuiltInZoomControls: false, allowsBackForwardNavigationGestures: nativeSwipeBack, onNavigationStateChange: s => { updateNavigation(s.canGoBack && !failedRef.current); }, onLoadStart: () => { failedRef.current = false; if (stateRef.current === 'loading' || stateRef.current === 'ok')
                    arm(); }, 
                // Android 는 네트워크 오류에서도 onLoad 를 먼저 보내고 onError 가 뒤따른다 — 짧게 기다려 오류가 안 왔을 때만 성공으로 센다
                onLoad: () => {
                    if (timer.current) {
                        clearTimeout(timer.current);
                        timer.current = null;
                    }
                    if (loadedTimer.current)
                        clearTimeout(loadedTimer.current);
                    loadedTimer.current = setTimeout(() => {
                        loadedTimer.current = null;
                        if (failedRef.current)
                            return;
                        setSt('ok');
                        onEvent?.('mission_loaded');
                        traceStage?.('load_ok');
                    }, 600);
                }, onError: () => {
                    traceStage?.('load_fail', { code: 0 });
                    fail('error', { why: 'load' });
                }, onHttpError: e => {
                    const code = e.nativeEvent.statusCode;
                    traceStage?.('load_fail', { code });
                    if (code === 503)
                        fail('maintenance', { why: 'http', status: code });
                    else if (code === 401 || code === 403 || code === 410 || code === 419)
                        fail('session', { why: 'http', status: code });
                    else if (code >= 400)
                        fail('error', { why: 'http', status: code });
                }, 
                // 렌더러가 죽으면 웹뷰를 새로 만든다(reload 는 죽은 렌더러에 소용없다). 반복하면 오류 화면
                onRenderProcessGone: () => recoverRenderer(false), onContentProcessDidTerminate: () => recoverRenderer(true), 
                // 승인된 APIHUB origin 안에서만 웹뷰가 움직인다. 다른 https 주소는 기본 브라우저로, 앱 스킴 · intent 는 openAppTarget 규칙으로 열고, 웹뷰는 그대로
                onShouldStartLoadWithRequest: req => {
                    if (req.url === 'about:blank')
                        return true;
                    if ((0, policy_1.isWebUrl)(req.url)) {
                        if ((0, entry_1.isAllowedOrigin)(req.url))
                            return true;
                        if (req.isTopFrame !== false && req.url.toLowerCase().startsWith('https://'))
                            openExternal(req.url);
                        return false;
                    }
                    if (req.isTopFrame !== false) {
                        if ((0, policy_1.resolveTarget)(req.url))
                            void (0, bridge_1.openAppTarget)({ url: req.url }, u => react_native_1.Linking.openURL(u)).then(opened => onEvent?.('mission_target_open', { opened }));
                        else
                            onEvent?.('mission_target_blocked');
                    }
                    return false;
                } }, `${retryKey}-${rebuild}`), state === 'loading' ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, pointerEvents: "none", children: (0, jsx_runtime_1.jsx)(states_1.MissionLoading, { theme: theme, lang: lang }) }) : null] });
}
