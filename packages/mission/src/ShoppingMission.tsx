import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchEntry, type EntryResult, type Requester, traceEntry } from './entry';
import { MissionWebView, type MissionNavigation, type MissionWebViewProps } from './MissionWebView';
import { DEFAULT_THEME, MissionLoading, MissionState } from './states';
import { t } from './i18n';

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
/** (0.3.0) `source` — 요청 출처('popup'|'push'|'tab'|'card'|'other'). `hint` — 「10초 구경하면 포인트」 안내 표시(기본값 true). `hintText` — 안내 문구 커스터마이징 */
export function ShoppingMission({ fetchJson, onClose, title, adId, source = 'other', safeAreaInsets, theme = DEFAULT_THEME, lang, hint = true, hintText, ...webViewProps }: ShoppingMissionProps & { hint?: boolean; hintText?: string }) {
  const heading = title === undefined ? t('일주일 쇼핑 미션', lang) : title;
  const [result, setResult] = useState<EntryResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hintVisible, setHintVisible] = useState(hint);
  const [tracedStages, setTracedStages] = useState<Set<string>>(new Set());
  const goBack = useRef<(() => void) | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const navigationChanged = useCallback((navigation: MissionNavigation) => {
    setCanGoBack(navigation.canGoBack);
    goBack.current = navigation.goBack;
  }, []);

  const traceStage = useCallback((stage: 'entry' | 'load_ok' | 'load_fail' | 'close' | 'reward', params?: { code?: number; url?: string; ms?: number }) => {
    // 같은 단계는 세션당 1회만
    if (tracedStages.has(stage)) return;
    // Requester 없으면 무시
    if (!fetchJson) return;

    const newStages = new Set(tracedStages);
    newStages.add(stage);
    setTracedStages(newStages);

    void traceEntry(fetchJson, { stage, source, ...params });
  }, [fetchJson, tracedStages]);

  useEffect(() => {
    let live = true;
    setResult(null);
    setCanGoBack(false);
    setTracedStages(new Set());
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
          <MissionWebView {...webViewProps} url={result.url} theme={theme} onClose={handleClose} onNavigationChange={navigationChanged} traceStage={traceStage} lang={lang} />
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
