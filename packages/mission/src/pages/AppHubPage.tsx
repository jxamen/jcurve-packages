/**
 * 추천 앱 — 홈 「추천 앱 둘러보기」 줄을 누르면 여는 목록 (0.4.0).
 * 목록 · 열기는 앱이 준다(carrot 은 @jcurve/apphub 시트를 쓴다 — 이 패키지는 그 시트에 기대지 않는다).
 */
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PageFrame, PageButton, resolvePageTheme, type MissionPageTheme } from './PageFrame';

export type AppHubItem = {
  key: string;
  name: string;
  /** 한 줄 설명 — 없으면 생략 */
  desc?: string;
  /** 앱 그림 — 없으면 ⭐ */
  icon?: ReactNode;
  /** 「보러가기」 — 앱이 연다(스토어 · 링크) */
  onOpen: () => void;
};

export type AppHubPageProps = {
  apps: readonly AppHubItem[];
  onBack: () => void;
  title?: string;
  /** 목록이 비었을 때 글 */
  emptyText?: string;
  theme?: Partial<MissionPageTheme>;
  footer?: ReactNode;
};

export function AppHubPage({ apps, onBack, title = '추천 앱', emptyText = '추천 앱을 준비하고 있어요', theme: themeIn, footer }: AppHubPageProps) {
  const theme = resolvePageTheme(themeIn);
  return <PageFrame title={title} onBack={onBack} theme={theme} footer={footer}>
    {apps.length === 0 ? <Text style={[s.empty, { color: theme.sub }]}>{emptyText}</Text> : <View style={[s.card, { backgroundColor: theme.card }]}>
      {apps.map((app, i) => <Pressable key={app.key} accessible={false} onPress={app.onOpen}
        style={({ pressed }) => [s.row, i < apps.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.line }, pressed && { opacity: 0.85 }]}>
        <View style={[s.icon, { backgroundColor: theme.accentSoft }]}><Text style={s.iconText}>{app.icon ?? '⭐'}</Text></View>
        <View style={s.text}>
          <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{app.name}</Text>
          {app.desc ? <Text style={[s.desc, { color: theme.sub }]} numberOfLines={1}>{app.desc}</Text> : null}
        </View>
        <PageButton label="보러가기" theme={theme} on onPress={app.onOpen} />
      </Pressable>)}
    </View>}
  </PageFrame>;
}

const s = StyleSheet.create({
  card: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  empty: { fontSize: 14, textAlign: 'center', marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 15, fontWeight: '700' },
  desc: { fontSize: 12 },
});
