import React from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

/**
 * 쇼핑 화면 머리 제목(0.1.11, 대표님 10-21 「쇼핑 타이틀 가운데로 · 폰트 크기도 동일하게 · 앱별로 타이틀은 조금 수정할 수 있어야」).
 * 우선순위: `title` prop → `theme.title` → 「쇼핑」. 기본은 예전 그대로(왼쪽 · 26 · 800) — `titleAlign` · `titleStyle` 은 앱이 정할 때만 쓴다.
 */
export type ShoppingTitleAlign = 'left' | 'center';

/** 머리 제목 글자 — title(비어 있지 않을 때) → theme.title → 「쇼핑」 */
export function shoppingTitleText(title: string | undefined, themeTitle: string | undefined): string {
  return title !== undefined && title.trim() !== '' ? title : (themeTitle ?? '쇼핑');
}

export function ShoppingHeaderTitle({ text, color, align = 'left', style }: { text: string; color: string; align?: ShoppingTitleAlign; style?: TextStyle }) {
  const base: Array<TextStyle | undefined> = [s.h1, { color }];
  if (align === 'center') {
    // 가운데 — 오른쪽 「누적 혜택」 알약과 겹치지 않게 제목은 머리 줄 전체 폭의 가운데에 띄운다(누르는 것을 막지 않는다)
    return <View pointerEvents="none" style={s.center}><Text accessibilityRole="header" style={[...base, { textAlign: 'center' }, style]}>{text}</Text></View>;
  }

  return <Text accessibilityRole="header" style={style ? [...base, style] : base}>{text}</Text>;
}

/** 머리 줄 — 가운데 제목일 때는 알약이 없어도(수동 목록 제휴처) 줄 높이가 무너지지 않게 최소 높이를 준다 */
export const headCenterStyle = { minHeight: 44, justifyContent: 'flex-end' } as const;

const s = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '800' },
  center: { position: 'absolute', left: 0, right: 0, top: 12, bottom: 6, alignItems: 'center', justifyContent: 'center' },
});
