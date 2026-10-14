import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchEntry, type EntryResult, type Requester } from './entry';
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

export type ShoppingMissionProps = Omit<MissionWebViewProps, 'url' | 'onClose' | 'onNavigationChange'> & {
  fetchJson: Requester;
  onClose: () => void;
  title?: string;
  adId?: string;
  /** Modal 바깥에서 읽은 useSafeAreaInsets() 값을 전달한다. */
  safeAreaInsets: { top: number; bottom: number; left?: number; right?: number };
};

/** 앱이 Modal 또는 내비게이션 화면 안에 넣는 쇼핑 미션 화면. */
/** (0.3.0) @jcurve/overlay 통합 — AppState 감시로 권한 상태 갱신, 기본 핸들러 제공 */
/** (0.2.1) `lang` — 머리글 · 상태 화면 문구 언어(앱이 넘긴다). 없거나 'ko' 면 지금과 같은 한국어. `title` 을 주면 그 글 그대로 */
export function ShoppingMission({ fetchJson, onClose, title, adId, safeAreaInsets, theme = DEFAULT_THEME, lang, ...webViewProps }: ShoppingMissionProps) {
  const heading = title === undefined ? t('일주일 쇼핑 미션', lang) : title;
  const [result, setResult] = useState<EntryResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [overlayReady, setOverlayReady] = useState(
    JcurveOverlay?.isAvailable?.() ? JcurveOverlay.hasPermission?.() : false
  );
  const goBack = useRef<(() => void) | null>(null);
  const navigationChanged = useCallback((navigation: MissionNavigation) => {
    setCanGoBack(navigation.canGoBack);
    goBack.current = navigation.goBack;
  }, []);

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
    goBack.current = null;
    void fetchEntry(fetchJson, adId).then(r => { if (live) setResult(r); });
    return () => { live = false; };
  }, [fetchJson, adId, attempt]);
  return <View style={[s.screen, { backgroundColor: theme.bg, paddingTop: safeAreaInsets.top, paddingBottom: safeAreaInsets.bottom, paddingLeft: safeAreaInsets.left ?? 0, paddingRight: safeAreaInsets.right ?? 0 }]}>
    <View style={[s.bar, { backgroundColor: theme.bg, borderBottomColor: theme.line }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('닫기', lang)} onPress={onClose} hitSlop={12} style={s.button}><Text style={[s.buttonText, { color: theme.text }]}>{t('닫기', lang)}</Text></Pressable>
      <Text numberOfLines={1} style={[s.title, { color: theme.text }]}>{heading}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('뒤로가기', lang)} accessibilityState={{ disabled: !canGoBack }} disabled={!canGoBack} onPress={() => goBack.current?.()} hitSlop={12} style={[s.button, { opacity: canGoBack ? 1 : 0.35 }]}><Text style={[s.buttonText, { color: theme.text }]}>{t('뒤로가기', lang)}</Text></Pressable>
    </View>
    <View style={s.body}>
      {result?.ok ? <MissionWebView {...webViewProps} url={result.url} theme={theme} onClose={onClose} onNavigationChange={navigationChanged} overlayReady={webViewProps.overlayReady ?? overlayReady} lang={lang} />
        : result ? <MissionState kind={result.reason === 'off' ? 'off' : result.reason === 'not_ready' ? 'notReady' : 'error'} theme={theme} onClose={onClose} onRetry={() => setAttempt(n => n + 1)} lang={lang} />
        : <MissionLoading theme={theme} lang={lang} />}
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
});
