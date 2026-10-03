/**
 * 어떤 영수증인가 고르는 칸 — 영수증 올리기의 **첫 자리**(대표님 10-03 23:25 「선택하게 해야겠네」).
 *
 * 앱(배민 · 쿠팡 …)을 고르면 그 앱 안내가 저절로 흘러가고, 끝에서 [지금 올리기] 로 사진첩이 열린다.
 * 지난번에 고른 앱이 있으면 맨 위에 [바로 올리기] — 안내를 건너뛰고 곧장 사진첩.
 * 종이 영수증은 안내가 없다 — 부르는 앱의 촬영 · 스캔 버튼을 `paper` 자리에 그대로 넣는다.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GUIDES, guideOf } from './data';
import type { GuideApp, ReceiptPlatform } from './types';
import { T, row, useGuideTheme } from './ui';

export type ChooserProps = {
  /** 지난번에 고른 곳 — 앱이면 [바로 올리기] 를 낸다 */
  remembered: ReceiptPlatform | null;
  /** 앱을 골랐다 — 안내를 연다 */
  onGuide: (app: GuideApp) => void;
  /** [바로 올리기] — 안내 없이 사진첩 */
  onQuick: (app: GuideApp) => void;
  /** 지금 못 올린다(캡슐 없음 등) — [바로 올리기] 만 막는다. 안내는 언제나 볼 수 있다 */
  quickDisabled?: boolean;
  /** 종이 영수증 자리 — 부르는 앱의 [촬영하기] · [사진 올리기] */
  paper: React.ReactNode;
};

export function Chooser({ remembered, onGuide, onQuick, quickDisabled, paper }: ChooserProps) {
  const theme = useGuideTheme();
  const last = remembered && remembered !== 'paper' ? guideOf(remembered) : null;

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <T size={18} w={900}>어떤 영수증을 올리나요?</T>
      <T size={14.5} w={700} color={theme.sub} lh={21} style={{ marginTop: 2 }}>앱 영수증은 고르면 올리는 법을 먼저 보여 줘요</T>

      {last ? (
        <View style={[s.quick, { backgroundColor: theme.brandSoft }]}>
          <View style={[row, { gap: 8 }]}>
            <View style={[s.dot, { backgroundColor: last.accent }]} />
            <T size={15} w={800} style={{ flex: 1 }}>지난번 {last.name}</T>
            <Pressable
              accessibilityRole="button" accessibilityLabel={last.name + ' 바로 올리기'} disabled={quickDisabled}
              onPress={() => onQuick(last.app)}
              style={({ pressed }) => [s.quickBtn, { backgroundColor: theme.brand, opacity: quickDisabled ? 0.5 : pressed ? 0.85 : 1 }]}
            >
              <T size={15} w={900} color={theme.white}>바로 올리기</T>
            </Pressable>
          </View>
          {last.pickHint ? <T size={13.5} w={700} color={theme.brand} style={{ marginTop: 6 }}>{last.pickHint}</T> : null}
        </View>
      ) : null}

      <View style={s.grid}>
        {GUIDES.map((g) => {
          const on = remembered === g.app;
          return (
            <View key={g.app} style={s.cell}>
              <Pressable
                accessibilityRole="button" accessibilityLabel={g.name + ' 영수증 올리는 법'} onPress={() => onGuide(g.app)}
                style={({ pressed }) => [s.tile, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brandSoft : theme.card, opacity: pressed ? 0.8 : 1 }]}
              >
                <View style={[s.dot, { backgroundColor: g.accent }]} />
                <T size={15} w={800} lines={1}>{g.name}</T>
              </Pressable>
            </View>
          );
        })}
      </View>

      <T size={15} w={900} style={{ marginTop: 14, marginBottom: 8 }}>종이 영수증</T>
      {paper}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: 20, padding: 16 },
  quick: { marginTop: 12, borderRadius: 14, padding: 12 },
  quickBtn: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -4 },
  cell: { width: '33.33%', padding: 4 },
  tile: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
