import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { t, type Lang } from './i18n';
import { stateCopy, type StateKind } from './copy';

/** 색만 받는다 — 문구 · 모양은 패키지가 정한다(앱마다 달라지지 않게). 피그마 시안이 오면 이 화면들이 그 모양으로 바뀐다 */
export type MissionTheme = { bg: string; card: string; text: string; sub: string; accent: string; accentText: string; line: string };

export const DEFAULT_THEME: MissionTheme = { bg: '#FFFFFF', card: '#F5F6F8', text: '#191F28', sub: '#6B7684', accent: '#2F6BFF', accentText: '#FFFFFF', line: '#E5E8EB' };

export type { StateKind } from './copy';

export function MissionState({ kind, theme = DEFAULT_THEME, window, onRetry, onClose, lang }: { kind: StateKind; theme?: MissionTheme; /** 점검 시간 글(예 「매일 23:55 ~ 00:10」) — 점검 화면에서만 */ window?: string; onRetry?: () => void; onClose?: () => void; /** (0.2.1) 문구 언어 — 앱이 넘긴다. 없거나 'ko' 면 한국어 */ lang?: Lang }) {
  const c = stateCopy(kind, lang);
  return <View style={[s.wrap, { backgroundColor: theme.bg }]}>
    <Text accessibilityRole="header" style={[s.title, { color: theme.text }]}>{c.title}</Text>
    <Text style={[s.body, { color: theme.sub }]}>{c.body}</Text>
    {c.windowLabel && window ? <View style={[s.box, { borderColor: theme.line }]}><Text style={[s.boxLabel, { color: theme.sub }]}>{c.windowLabel}</Text><Text style={[s.boxText, { color: theme.text }]}>{window}</Text></View> : null}
    {c.button && onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={[s.btn, { backgroundColor: theme.accent }]}><Text style={[s.btnText, { color: theme.accentText }]}>{c.button}</Text></Pressable> : null}
    {onClose ? <Pressable accessibilityRole="button" onPress={onClose} style={s.link}><Text style={[s.linkText, { color: theme.sub }]}>{t('닫기', lang)}</Text></Pressable> : null}
  </View>;
}

export function MissionLoading({ theme = DEFAULT_THEME, lang }: { theme?: MissionTheme; /** (0.2.1) 없거나 'ko' 면 한국어 */ lang?: Lang }) {
  return <View style={[s.wrap, { backgroundColor: theme.bg }]}><ActivityIndicator color={theme.accent} accessibilityLabel={t('불러오는 중', lang)} /></View>;
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 23, textAlign: 'center' },
  btn: { minHeight: 50, minWidth: 160, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 8 },
  btnText: { fontSize: 16, fontWeight: '700' },
  box: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', gap: 2, marginTop: 4 },
  boxLabel: { fontSize: 13 },
  boxText: { fontSize: 16, fontWeight: '700' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 14, textDecorationLine: 'underline' },
});
