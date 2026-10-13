import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, Platform, View } from 'react-native';
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import { openAppTarget, parseBridgeMessage, type BridgeMessage } from './bridge';
import { isAllowedOrigin, isEntryUrl } from './entry';
import { isWebUrl, resolveTarget } from './policy';
import { bridgeShim } from './shim';
import { DEFAULT_THEME, MissionLoading, MissionState, type MissionTheme, type StateKind } from './states';
import type { Lang } from './i18n';

export type MissionEvent = 'mission_open' | 'mission_loaded' | 'mission_error' | 'mission_target_open' | 'mission_target_blocked' | 'mission_overlay_request' | 'mission_floating_popup' | 'mission_external_link';

export type MissionWebViewProps = {
  /** 서버 apihub/entry 가 준 웹뷰 주소(fetchEntry 결과) — 승인된 APIHUB 주소가 아니면 열지 않고 오류 화면 */
  url: string;
  /** 화면 머리글용 웹 히스토리 상태와 뒤로가기 동작 */
  onNavigationChange?: (navigation: MissionNavigation) => void;
  theme?: MissionTheme;
  onClose?: () => void;
  /** 계측 — 패키지는 아무 데도 보내지 않는다(앱이 자기 track 으로) */
  onEvent?: (name: MissionEvent, props?: Record<string, unknown>) => void;
  /** 페이지가 showFloatingPopup 을 불렀을 때(오버레이는 네이티브 빌드에서만 — 이 판은 알리기만) */
  onFloatingPopup?: (params: Extract<BridgeMessage, { method: 'showFloatingPopup' }>['params']) => void;
  /** 페이지가 「다른 앱 위에 표시」 권한을 요청했을 때 */
  onOverlayRequest?: () => void;
  /** 네이티브 오버레이가 들어간 빌드면 true(hasOverlayPermission 응답) */
  overlayReady?: boolean;
  /** (0.2.1) 오류 · 점검 · 로딩 화면 문구 언어 — 앱이 넘긴다(패키지는 기기 언어를 읽지 않는다). 없거나 'ko' 면 한국어. 웹 페이지 안 글은 APIHUB 것 */
  lang?: Lang;
};

export type MissionNavigation = { canGoBack: boolean; goBack: () => void };

// react-native-webview 의 클래스 타입이 React 19 타입에서 JSX 로 안 받아진다 — 모양만 맞춰 준다
type WebViewHandle = { reload: () => void; goBack: () => void };
const WebView = RNWebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebViewHandle> }>;

/** 웹뷰가 이 시간 안에 첫 화면을 못 띄우면 에러 화면 */
const LOAD_TIMEOUT_MS = 20000;
/** 렌더러가 죽어 다시 만든 횟수가 이를 넘으면 오류 화면 */
const MAX_RECOVER = 2;

const nonceOf = () => Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);

/** 주소가 바뀌었거나 다시 시도할 때마다 상태를 처음부터 */
export function MissionWebView({ url, theme = DEFAULT_THEME, onClose, onEvent, onFloatingPopup, onOverlayRequest, overlayReady = false, onNavigationChange, lang }: MissionWebViewProps) {
  const valid = isEntryUrl(url);
  const [state, setState] = useState<'loading' | 'ok' | StateKind>('loading');
  const [retryKey, setRetryKey] = useState(0);     // 사용자가 다시 시도(처음부터)
  const [rebuild, setRebuild] = useState(0);       // 렌더러가 죽어 웹뷰만 다시 만듦(실패 횟수는 이어서 센다)
  const secret = useMemo(nonceOf, [url, retryKey, rebuild]);   // 이 로드의 비밀 값 — shim 안에만 있다
  const handle = useRef<WebViewHandle>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recovered = useRef(0);
  const failedRef = useRef(false);
  const stateRef = useRef<'loading' | 'ok' | StateKind>('loading');
  const canGoBack = useRef(false);
  const navigationCallback = useRef(onNavigationChange);
  navigationCallback.current = onNavigationChange;
  const updateNavigation = useCallback((back: boolean) => {
    canGoBack.current = back;
    navigationCallback.current?.({ canGoBack: back, goBack: () => { if (canGoBack.current) handle.current?.goBack(); } });
  }, []);
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const shim = useMemo(() => bridgeShim(platform, overlayReady, secret), [platform, overlayReady, secret]);

  const setSt = useCallback((v: 'loading' | 'ok' | StateKind) => { stateRef.current = v; setState(v); }, []);
  const disarm = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (loadedTimer.current) { clearTimeout(loadedTimer.current); loadedTimer.current = null; }
  }, []);
  const fail = useCallback((kind: StateKind, why: Record<string, unknown>) => {
    failedRef.current = true;
    disarm();
    updateNavigation(false);   // 오류 화면에서는 웹 히스토리로 뒤로 가지 않는다 — 뒤로 가기는 닫기
    setSt(kind);
    onEvent?.('mission_error', { kind, ...why });
  }, [disarm, onEvent, setSt, updateNavigation]);
  // 로드(첫 로드 · 웹뷰 안 이동 · reload)가 시작될 때마다 시간 제한을 다시 건다
  const arm = useCallback(() => {
    if (loadedTimer.current) { clearTimeout(loadedTimer.current); loadedTimer.current = null; }   // 새 로드가 시작되면 이전 로드의 「성공 확인」은 취소
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fail('error', { why: 'timeout' }), LOAD_TIMEOUT_MS);
  }, [fail]);

  // 주소 · 다시 시도가 바뀌면 처음부터(렌더러 복구는 여기 안 든다 — 반복 실패 횟수를 이어서 세려고)
  useEffect(() => {
    recovered.current = 0;
    failedRef.current = false;
    updateNavigation(false);
    setSt('loading');
    if (!valid) { fail('error', { why: 'bad_url' }); return disarm; }
    onEvent?.('mission_open');
    arm();
    return disarm;
  }, [url, retryKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Android 뒤로 가기 — 정상 화면에서 웹 히스토리가 있으면 먼저, 아니면(첫 페이지 · 오류 화면) 닫기
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const normal = stateRef.current === 'loading' || stateRef.current === 'ok';
      if (normal && canGoBack.current) { handle.current?.goBack(); return true; }
      if (onClose) { onClose(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [onClose]);

  const retry = () => setRetryKey(n => n + 1);
  const recoverRenderer = (reload: boolean) => {
    recovered.current += 1;
    if (recovered.current > MAX_RECOVER) { fail('error', { why: 'renderer' }); return; }
    failedRef.current = false;
    updateNavigation(false);
    arm();
    if (reload) handle.current?.reload(); else setRebuild(n => n + 1);
  };

  const openExternal = (u: string) => { onEvent?.('mission_external_link'); void Linking.openURL(u).catch(() => undefined); };

  const onMessage = (e: WebViewMessageEvent) => {
    // 보낸 쪽 화면이 승인된 origin 이고, 최상위 프레임이며, 이 로드의 비밀 값을 아는 글만 받는다
    if (!isAllowedOrigin(e.nativeEvent.url)) return;
    const m = parseBridgeMessage(e.nativeEvent.data, secret);
    if (!m) return;
    if (m.method === 'openAppTarget') {
      if (!resolveTarget(m.params.url, m.params.fallbackUrl)) { onEvent?.('mission_target_blocked'); return; }
      void openAppTarget(m.params, u => Linking.openURL(u)).then(opened => onEvent?.('mission_target_open', { opened }));
    } else if (m.method === 'showFloatingPopup') {
      onEvent?.('mission_floating_popup');
      onFloatingPopup?.(m.params);
    } else if (m.method === 'requestOverlayPermission') {
      onEvent?.('mission_overlay_request');
      onOverlayRequest?.();
    }
    // hasOverlayPermission 은 shim 이 바로 답한다(동기) — 여기는 올 일이 없다
  };

  if (state !== 'loading' && state !== 'ok') return <MissionState kind={state} theme={theme} onRetry={retry} onClose={onClose} lang={lang} />;
  if (!valid) return <MissionState kind="error" theme={theme} onClose={onClose} lang={lang} />;

  return <View style={{ flex: 1, backgroundColor: theme.bg }}>
    <WebView
      key={`${retryKey}-${rebuild}`}
      ref={handle}
      source={{ uri: url }}
      // 모든 요청이 onShouldStartLoadWithRequest 를 거치게 한다(비 https 가 라이브러리 기본 처리로 빠져 우리 규칙을 건너뛰지 않게) — 거르는 건 아래 규칙
      originWhitelist={['*']}
      injectedJavaScriptBeforeContentLoaded={shim}
      injectedJavaScriptBeforeContentLoadedForMainFrameOnly
      injectedJavaScriptForMainFrameOnly
      onMessage={onMessage}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      allowFileAccess={false}
      allowsInlineMediaPlayback
      javaScriptCanOpenWindowsAutomatically={false}
      setSupportMultipleWindows={false}
      setBuiltInZoomControls={false}
      allowsBackForwardNavigationGestures
      onNavigationStateChange={s => { updateNavigation(s.canGoBack && !failedRef.current); }}
      onLoadStart={() => { failedRef.current = false; if (stateRef.current === 'loading' || stateRef.current === 'ok') arm(); }}
      // Android 는 네트워크 오류에서도 onLoad 를 먼저 보내고 onError 가 뒤따른다 — 짧게 기다려 오류가 안 왔을 때만 성공으로 센다
      onLoad={() => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        if (loadedTimer.current) clearTimeout(loadedTimer.current);
        loadedTimer.current = setTimeout(() => {
          loadedTimer.current = null;
          if (failedRef.current) return;
          setSt('ok'); onEvent?.('mission_loaded');
        }, 600);
      }}
      onError={() => fail('error', { why: 'load' })}
      onHttpError={e => {
        const code = e.nativeEvent.statusCode;
        if (code === 503) fail('maintenance', { why: 'http', status: code });
        else if (code === 401 || code === 403 || code === 410 || code === 419) fail('session', { why: 'http', status: code });
        else if (code >= 400) fail('error', { why: 'http', status: code });
      }}
      // 렌더러가 죽으면 웹뷰를 새로 만든다(reload 는 죽은 렌더러에 소용없다). 반복하면 오류 화면
      onRenderProcessGone={() => recoverRenderer(false)}
      onContentProcessDidTerminate={() => recoverRenderer(true)}
      // 승인된 APIHUB origin 안에서만 웹뷰가 움직인다. 다른 https 주소는 기본 브라우저로, 앱 스킴 · intent 는 openAppTarget 규칙으로 열고, 웹뷰는 그대로
      onShouldStartLoadWithRequest={req => {
        if (req.url === 'about:blank') return true;
        if (isWebUrl(req.url)) {
          if (isAllowedOrigin(req.url)) return true;
          if (req.isTopFrame !== false && req.url.toLowerCase().startsWith('https://')) openExternal(req.url);
          return false;
        }
        if (req.isTopFrame !== false) {
          if (resolveTarget(req.url)) void openAppTarget({ url: req.url }, u => Linking.openURL(u)).then(opened => onEvent?.('mission_target_open', { opened }));
          else onEvent?.('mission_target_blocked');
        }
        return false;
      }}
    />
    {state === 'loading' ? <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="none"><MissionLoading theme={theme} lang={lang} /></View> : null}
  </View>;
}
