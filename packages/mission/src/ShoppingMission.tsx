import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Dimensions, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchEntry, type EntryResult, type Requester, traceEntry } from './entry';
import { MissionWebView, type MissionNavigation, type MissionWebViewProps } from './MissionWebView';
import { DEFAULT_THEME, MissionLoading, MissionState } from './states';
import { t } from './i18n';
import { backTarget, edgeBackHandlers, safeTop } from './missionNav';

// Try to load overlay module (optional peer dependency)
let JcurveOverlay: any = null;
try {
  JcurveOverlay = require('@jcurve/overlay');
} catch {
  // Module not available
}

export type ShoppingMissionProps = Omit<MissionWebViewProps, 'url' | 'onClose' | 'onNavigationChange' | 'traceStage' | 'nativeSwipeBack'> & {
  fetchJson: Requester;
  onClose: () => void;
  title?: string;
  adId?: string;
  /** 단계 기록 요청 출처 — 기본값 'other' */
  source?: 'popup' | 'push' | 'tab' | 'card' | 'other';
  /** Modal 바깥에서 읽은 useSafeAreaInsets() 값을 전달한다. */
  safeAreaInsets: { top: number; bottom: number; left?: number; right?: number };
  /** (0.4.3) 이 화면의 뒤로가기(웹 기록 → 없으면 닫기)를 받아 간다 — 앱이 자기 Modal 의 onRequestClose 에 물릴 때 */
  backRef?: { current: (() => void) | null };
};

/** 앱이 Modal 또는 내비게이션 화면 안에 넣는 쇼핑 미션 화면. */
/** (0.3.0) @jcurve/overlay 통합 — AppState 감시로 권한 상태 갱신, 기본 핸들러 제공 */
/** (0.3.1) `source` — 요청 출처('popup'|'push'|'tab'|'card'|'other'), 단계 기록(apihub/trace). `hint` — 「10초 구경하면 포인트」 안내 표시(기본값 true). `hintText` — 안내 문구 */
/** (0.2.1) `lang` — 머리글 · 상태 화면 문구 언어(앱이 넘긴다). 없거나 'ko' 면 지금과 같은 한국어. `title` 을 주면 그 글 그대로 */
export function ShoppingMission({ fetchJson, onClose, title, adId, source = 'other', safeAreaInsets, theme = DEFAULT_THEME, lang, hint = true, hintText, backRef: outerBack, ...webViewProps }: ShoppingMissionProps & { hint?: boolean; hintText?: string }) {
  // 기본 제목은 홈 목록 줄 · 서버 카드 이름과 같게(0.4.2, 대표님 2026-10-20 09:49 「일주일 쇼핑 미션 => 쇼핑 태그 퀴즈1」)
  const heading = title === undefined ? t('쇼핑 태그 퀴즈1', lang) : title;
  const [result, setResult] = useState<EntryResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hintVisible, setHintVisible] = useState(hint);
  // 같은 단계는 세션당 1회 — state 가 아니라 ref(콜백이 바뀌어 입장 effect 가 다시 돌면 무한 반복)
  const tracedStages = useRef<Set<string>>(new Set());
  const [overlayReady, setOverlayReady] = useState(
    JcurveOverlay?.isAvailable?.() ? JcurveOverlay.hasPermission?.() : false
  );
  const goBack = useRef<(() => void) | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const canGoBackRef = useRef(false);
  const navigationChanged = useCallback((navigation: MissionNavigation) => {
    canGoBackRef.current = navigation.canGoBack;
    setCanGoBack(navigation.canGoBack);
    goBack.current = navigation.goBack;
  }, []);

  const traceStage = useCallback((stage: 'entry' | 'load_ok' | 'load_fail' | 'close' | 'reward', params?: { code?: number; url?: string; ms?: number }) => {
    if (!fetchJson) return;                       // Requester 없으면(옛 앱) 아무것도 안 함
    if (tracedStages.current.has(stage)) return;  // 같은 단계는 세션당 1회
    tracedStages.current.add(stage);
    void traceEntry(fetchJson, { stage, source, ...params });
  }, [fetchJson, source]);

  // Monitor app state to update overlay permission status
  useEffect(() => {
    if (!JcurveOverlay?.isAvailable?.()) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setOverlayReady(JcurveOverlay.hasPermission?.() ?? false);
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
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

    void fetchEntry(fetchJson, adId).then(r => { if (live) setResult(r); });
    return () => { live = false; };
  }, [fetchJson, adId, attempt, hint, traceStage]);
  // 닫기는 기록이 실패해도 반드시 닫는다(0.4.3)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const handleClose = useCallback(() => {
    try { traceStage('close', { ms: Date.now() - startTimeRef.current }); } catch { /* 기록 실패는 닫기를 막지 않는다 */ }
    closeRef.current();
  }, [traceStage]);
  /*
   | 뒤로가기 — 웹 기록이 있으면 웹에서 한 칸, 없으면 화면 닫기(0.4.3, 대표님 10-20 11:44 「닫기도 뒤로가기도 안되고」).
   | 전에는 웹 기록이 없으면 단추가 꺼져 있었고, Modal 안 iOS 에는 밀어서 나가는 길도 없어 「닫기」 하나뿐이었다
   */
  const back = useCallback(() => {
    if (backTarget(canGoBackRef.current) === 'web' && goBack.current) goBack.current();
    else handleClose();
  }, [handleClose]);
  const backRef = useRef(back);
  backRef.current = back;
  if (outerBack) outerBack.current = back;
  // 안드로이드 뒤로 — 로딩 · 오류 화면에서도(웹뷰가 아직 없을 때도) 같은 규칙
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { backRef.current(); return true; });
    return () => sub.remove();
  }, []);
  // iOS 왼쪽 가장자리를 오른쪽으로 밀면 뒤로가기(웹 기록 → 없으면 닫기) — 본문에 띠 View 를 덮지 않고 화면 최상위의 캡처 핸들러로 받는다(0.7.12).
  // 띠의 응답자가 놓친 터치 때문에 머리줄 「닫기」 · 「뒤로가기」가 눌림을 못 받던 것(대표님 10-21 00:16 쇼핑 퀴즈 먹통)을 막는다
  const edge = useRef(PanResponder.create(edgeBackHandlers(() => backRef.current()))).current;
  const top = safeTop(Platform.OS, safeAreaInsets.top, Dimensions.get('window').height);

  return <View {...(Platform.OS === 'ios' ? edge.panHandlers : {})} style={[s.screen, { backgroundColor: theme.bg, paddingTop: top, paddingBottom: safeAreaInsets.bottom, paddingLeft: safeAreaInsets.left ?? 0, paddingRight: safeAreaInsets.right ?? 0 }]}>
    <View style={[s.bar, { backgroundColor: theme.bg, borderBottomColor: theme.line }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('닫기', lang)} onPress={handleClose} hitSlop={12} style={s.button}><Text style={[s.buttonText, { color: theme.text }]}>{t('닫기', lang)}</Text></Pressable>
      <Text numberOfLines={1} style={[s.title, { color: theme.text }]}>{heading}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('뒤로가기', lang)} accessibilityHint={canGoBack ? undefined : t('닫기', lang)} onPress={back} hitSlop={12} style={s.button}><Text style={[s.buttonText, { color: theme.text }]}>{t('뒤로가기', lang)}</Text></Pressable>
    </View>
    <View style={s.body}>
      {result?.ok ? (
        <>
          {hintVisible && <View style={[s.hintBar, { backgroundColor: theme.line }]}>
            <Text style={[s.hintText, { color: theme.text }]}>{hintText ?? t('상품을 10초만 구경하면 포인트가 들어와요', lang)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('닫기', lang)} onPress={() => setHintVisible(false)} hitSlop={8} style={s.hintClose}><Text style={[s.hintCloseText, { color: theme.text }]}>✕</Text></Pressable>
          </View>}
          <MissionWebView {...webViewProps} nativeSwipeBack={false} url={result.url} theme={theme} onClose={handleClose} onNavigationChange={navigationChanged} traceStage={traceStage} overlayReady={webViewProps.overlayReady ?? overlayReady} lang={lang} />
        </>
      ) : result ? (
        <MissionState kind={result.reason === 'off' ? 'off' : result.reason === 'not_ready' ? 'notReady' : 'error'} theme={theme} onClose={handleClose} onRetry={() => setAttempt(n => n + 1)} lang={lang} />
      ) : (
        <MissionLoading theme={theme} lang={lang} />
      )}
    </View>
  </View>;
}
/**
 * (0.4.3) 쇼핑 미션을 전체 화면 Modal 로 — 안드로이드 뒤로 버튼은 Modal 안에서 BackHandler 가 아니라 onRequestClose 로 온다.
 * 앱이 `onRequestClose={() => 닫기}` 로 물리면 웹 기록을 건너뛰고 바로 닫혔다. 이 껍데기는 같은 뒤로가기 규칙(웹 기록 → 닫기)을 쓴다
 */
export function ShoppingMissionModal({ visible, ...props }: ShoppingMissionProps & { visible: boolean; hint?: boolean; hintText?: string }) {
  const back = useRef<(() => void) | null>(null);
  const close = props.onClose;
  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (back.current) back.current(); else close(); }}>
    {visible ? <ShoppingMission {...props} backRef={back} /> : null}
  </Modal>;
}
const s = StyleSheet.create({
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
