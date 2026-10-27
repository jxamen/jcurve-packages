import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { yesterdayView, type StepsStage, type StepsState } from './stages';

/** 색 — 앱의 theme 에서 이 일곱 가지만 넘기면 된다(`StepsScreen` 은 자기 theme 을 그대로 넘긴다). */
export type YesterdayTheme = { card: string; text: string; sub: string; primary: string; primaryDeep?: string; primarySoft: string; onPrimary: string; radius: number };
const fallbackTheme: YesterdayTheme = { card: '#FFFFFF', text: '#2B2118', sub: '#8A7A6B', primary: '#F5A3B8', primaryDeep: '#D9738E', primarySoft: '#FFEDF2', onPrimary: '#FFFFFF', radius: 20 };

export type StepsYesterdayCardProps = {
  /** `GET steps/stages?day=어제` 의 응답. 없으면(아직 못 받음 · 실패) 카드가 안 보인다 */
  state: StepsState | null | undefined;
  /** 이 카드의 받기를 눌렀다 — 앱이 어제 날짜(`state.day`)의 광고(`stage.ad_purpose`)를 보여 주고 `claim(stage_id, day=state.day)` 를 부른다 */
  onClaim: (stage: StepsStage) => void;
  /** 다른 청구가 진행 중이거나 광고 확인을 기다리는 중 — 버튼을 잠근다 */
  busy?: boolean;
  theme?: Partial<YesterdayTheme>;
  now?: number;
};

/**
 * 「어제 걸음」 카드 — 오늘 카드 바로 아래에 둔다(대표님 10/28 「어제 걸음도 받게 하기」). 어제 몫이 0 이거나 다 받았으면 아무것도 안 그린다.
 * 어제 걸음은 **오늘 자정(한국 시간)까지만** 받을 수 있다 — 서버가 오늘 · 어제 날짜만 받는다.
 */
export function StepsYesterdayCard({ state, onClaim, busy = false, theme, now }: StepsYesterdayCardProps) {
  const v = yesterdayView(state, now);
  if (!v.show || !v.first) return null;
  const C = { ...fallbackTheme, ...theme };
  const first = v.first;
  const label = busy ? '확인 중…' : `광고 보고 ${v.points}P 받기`;

  return <View style={[styles.card, { backgroundColor: C.card, borderRadius: C.radius }]}>
    <Text style={[styles.head, { color: C.text }]}>어제 걸음 <Text style={[styles.num, { color: C.primaryDeep ?? C.primary }]}>{v.steps.toLocaleString()}</Text>걸음</Text>
    <Text style={[styles.left, { color: C.text }]}>남은 횟수 <Text style={[styles.num, { color: C.primaryDeep ?? C.primary }]}>{v.left}번</Text></Text>
    <Text style={[styles.sub, { color: C.sub }]}>오늘 자정(한국 시간)까지 받을 수 있어요 · 어제 받은 포인트 {v.earned}P</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`어제 걸음 ${label}, 광고가 열려요`} accessibilityState={{ disabled: busy }} disabled={busy}
      onPress={() => onClaim(first)} style={({ pressed }) => [styles.btn, { backgroundColor: busy ? C.primarySoft : C.primary }, pressed && !busy ? { opacity: 0.85 } : null]}>
      <Text style={[styles.btnText, { color: busy ? (C.primaryDeep ?? C.primary) : C.onPrimary }]}>{label}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  card: { marginTop: 16, marginHorizontal: 16, padding: 20, alignItems: 'center', gap: 8 },
  head: { fontSize: 16, fontWeight: '700' },
  left: { fontSize: 18, fontWeight: '700' },
  num: { fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 13, textAlign: 'center' },
  // 큰 글씨(접근성 2.0)에서 글자가 잘리지 않게: 고정 height 대신 minHeight + 위아래 여백, 글자는 줄바꿈을 허용하고 가운데 정렬(0.3.1)
  btn: { minHeight: 48, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
});
