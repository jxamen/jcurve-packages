import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchEntry, type EntryResult, type Requester, traceEntry } from './entry';
import { MissionWebView, type MissionNavigation, type MissionWebViewProps } from './MissionWebView';
import { DEFAULT_THEME, MissionLoading, MissionState } from './states';
import { t } from './i18n';

// Try to load overlay module (optional peer dependency)
let JcurveOverlay: any = null;
try {
  JcurveOverlay = require('@jcurve/overlay');
} catch {
  // Module not available
}

export type ShoppingMissionProps = Omit<MissionWebViewProps, 'url' | 'onClose' | 'onNavigationChange' | 'traceStage'> & {
  fetchJson: Requester;
  onClose: () => void;
  title?: string;
  adId?: string;
  /** 단계 기록 요청 출처 — 기본값 'other' */
  source?: 'popup' | 'push' | 'tab' | 'card' | 'other';
  /** Modal 바깥에서 읽은 useSafeAreaInsets() 값을 전달한다. */
  safeAreaInsets: { top: number; bottom: number; left?: number; right?: number };
};

/** 앱이 Modal 또는 내비게이션 화면 안에 넣는 쇼핑 미션 화면. */
/** (0.3.0) @jcurve/overlay 통합 — AppState 감시로 권한 상태 갱신, 기본 핸들러 제공 */
/** (0.3.1) `source` — 요청 출처('popup'|'push'|'tab'|'card'|'other'), 단계 기록(apihub/trace). `hint` — 「10초 구경하면 포인트」 안내 표시(기본값 true). `hintText` — 안내 문구 */
/** (0.2.1) `lang` — 머리글 · 상태 화면 문구 언어(앱이 넘긴다). 없거나 'ko' 면 지금과 같은 한국어. `title` 을 주면 그 글 그대로 */
export function ShoppingMission({ fetchJson, onClose, title, adId, source = 'other', safeAreaInsets, theme = DEFAULT_THEME, lang, hint = true, hintText, ...webViewProps }: ShoppingMissionProps & { hint?: boolean; hintText?: string }) {
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
  const navigationChanged = useCallback((navigation: MissionNavigation) => {
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
    tracedStages.current = new Set();
    setHintVisible(hint);
    goBack.current = null;
    startTimeRef.current = Date.now();

    // entry 단계 기록
    traceStage('entry');

    void fetchEntry(fetchJson, adId).then(r => { if (live) setResult(r); });
    return () => { live = false; };
  }, [fetchJson, adId, attempt, hint, traceStage]);
  const handleClose = () => {
    const ms = Date.now() - startTimeRef.current;
    traceStage('close', { ms });
    onClose();
  };

  return <View style={[s.screen, { backgroundColor: theme.bg, paddingTop: safeAreaInsets.top, paddingBottom: safeAreaInsets.bottom, paddingLeft: safeAreaInsets.left ?? 0, paddingRight: safeAreaInsets.right ?? 0 }]}>
    <View style={[s.bar, { backgroundColor: theme.bg, borderBottomColor: theme.line }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('닫기', lang)} onPress={handleClose} hitSlop={12} style={s.button}><Text style={[s.buttonText, { color: theme.text }]}>{t('닫기', lang)}</Text></Pressable>
      <Text numberOfLines={1} style={[s.title, { color: theme.text }]}>{heading}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('뒤로가기', lang)} accessibilityState={{ disabled: !canGoBack }} disabled={!canGoBack} onPress={() => goBack.current?.()} hitSlop={12} style={[s.button, { opacity: canGoBack ? 1 : 0.35 }]}><Text style={[s.buttonText, { color: theme.text }]}>{t('뒤로가기', lang)}</Text></Pressable>
    </View>
    <View style={s.body}>
      {result?.ok ? (
        <>
          {hintVisible && <View style={[s.hintBar, { backgroundColor: theme.line }]}>
            <Text style={[s.hintText, { color: theme.text }]}>{hintText ?? t('상품을 10초만 구경하면 포인트가 들어와요', lang)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('닫기', lang)} onPress={() => setHintVisible(false)} hitSlop={8} style={s.hintClose}><Text style={[s.hintCloseText, { color: theme.text }]}>✕</Text></Pressable>
          </View>}
          <MissionWebView {...webViewProps} url={result.url} theme={theme} onClose={handleClose} onNavigationChange={navigationChanged} traceStage={traceStage} overlayReady={webViewProps.overlayReady ?? overlayReady} lang={lang} />
        </>
      ) : result ? (
        <MissionState kind={result.reason === 'off' ? 'off' : result.reason === 'not_ready' ? 'notReady' : 'error'} theme={theme} onClose={handleClose} onRetry={() => setAttempt(n => n + 1)} lang={lang} />
      ) : (
        <MissionLoading theme={theme} lang={lang} />
      )}
    </View>
  </View>;
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
