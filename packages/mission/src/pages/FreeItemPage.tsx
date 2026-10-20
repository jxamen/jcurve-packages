/**
 * 무료 아이템 받기 — 하루 3번 들르면 양분(캡슐 · 열매 · 먹이) 받는 화면(0.4.0, carrot FreeHeartScreen · HeartCard visits 그대로).
 * 광고 · 보상 규칙은 앱이 정한다. 패키지는 칸 상태를 그리고 누르면 onClaim(id) 만 부른다.
 * 맨 아래 광고 자리는 footer 로 받는다(carrot 은 네이티브 광고).
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PageFrame, PageButton, resolvePageTheme, PAGE_BUTTON, type MissionPageTheme } from './PageFrame';
import { slotButtonLabel, slotCount, slotStatusLine, slotWindowLabel, type FreeItemSlot } from './logic';

export type FreeItemPageProps = {
  /** 「하루 3번」 칸들 — 앱이 done · missed · claimable 을 정해 준다 */
  slots: readonly FreeItemSlot[];
  /** 칸 받기 — 광고 · 서버 지급은 앱이 한다. Promise 를 주면 그동안 누름을 막지 않는다(앱이 상태로 막는다) */
  onClaim: (slotId: string) => void | Promise<void>;
  onBack: () => void;
  /** (0.4.13) iOS 왼쪽 가장자리를 오른쪽으로 밀면 onBack(기본 true). 안드로이드는 그대로. 이미 앱에서 밀기를 감싼 화면은 false */
  swipeBack?: boolean;
  /** 머리 제목 — 기본 「무료 {아이템} 받기」 */
  title?: string;
  /** 카드 아래 한 줄 — 기본 「하루 {칸 수}번 들르면 {아이템} 받기」 */
  subtitle?: string;
  /** 색 · 아이템 이름(theme.itemName) · 아이템 그림(theme.itemIcon) — 일부만 줘도 된다 */
  theme?: Partial<MissionPageTheme>;
  /** 맨 아래 광고 자리 */
  footer?: ReactNode;
  /** 칸 버튼 크기 — 기본 72x34 */
  buttonWidth?: number;
  buttonHeight?: number;
};

export function FreeItemPage({ slots, onClaim, onBack, swipeBack, title, subtitle, theme: themeIn, footer, buttonWidth = PAGE_BUTTON.width, buttonHeight = PAGE_BUTTON.height }: FreeItemPageProps) {
  const theme = resolvePageTheme(themeIn);
  const item = theme.itemName ?? '아이템';
  const count = slotCount(slots);
  return <PageFrame title={title ?? `무료 ${item} 받기`} onBack={onBack} swipeBack={swipeBack} theme={theme} footer={footer}>
    <View style={[s.card, { backgroundColor: theme.card }]}>
      <View style={s.head}>
        {theme.itemIcon != null ? <View accessible={false} style={s.icon}>{theme.itemIcon}</View> : null}
        <Text style={[s.cardTitle, { color: theme.text }]}>{title ?? `무료 ${item} 받기`}</Text>
      </View>
      <Text style={[s.sub, { color: theme.sub }]}>{subtitle ?? `하루 ${slots.length}번 들르면 ${item} 받기`}</Text>
      <View style={s.sectionHead}>
        <Text style={[s.sectionLabel, { color: theme.sub }]}>{`오늘 ${slots.length}번 들르기`}</Text>
        <Text style={[s.count, { color: theme.accent }]}>{`${count.done}/${count.total}`}</Text>
      </View>
      {slots.map(slot => <View key={slot.id} style={[s.row, { borderTopColor: theme.line }]}>
        <View style={s.left}>
          <Text style={[s.name, { color: theme.text }]}>{slotWindowLabel(slot)}</Text>
          <Text style={[s.status, { color: theme.sub }, slot.missed && !slot.done && s.missed]}>{slotStatusLine(slot, item)}</Text>
        </View>
        <PageButton label={slotButtonLabel(slot)} theme={theme} width={buttonWidth} height={buttonHeight}
          on={slot.claimable} disabled={!slot.claimable} onPress={() => { if (slot.claimable) void onClaim(slot.id); }} />
      </View>)}
    </View>
  </PageFrame>;
}

const s = StyleSheet.create({
  card: { borderRadius: 20, padding: 18, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 19, fontWeight: '800', flexShrink: 1 },
  sub: { fontSize: 13, lineHeight: 19 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '800' },
  count: { fontSize: 13, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10, borderTopWidth: 1 },
  left: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 16, fontWeight: '700' },
  status: { fontSize: 12 },
  missed: { textDecorationLine: 'line-through' },
});
