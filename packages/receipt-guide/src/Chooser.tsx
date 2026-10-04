/**
 * 어떤 영수증인가 고르는 칸 — 영수증 올리기의 **첫 자리**(대표님 10-03 23:25 「선택하게 해야겠네」).
 *
 * 앱(배민 · 쿠팡 …)을 고르면 **바로 그 앱 영수증 올리기(사진첩)** — 대표님 10-04 11:52 「이 화면에선 해당 플랫폼별 바로 영수증 등록하게 해줘」.
 * 올리는 법 안내는 [영수증 확인 방법] 을 누른 뒤 앱을 고를 때만(「영수증 확인 방법 버튼 넣고 누르면 안내가 나오게」).
 * 지난번에 고른 앱이 있으면 맨 위에 [바로 올리기] — 안내를 건너뛰고 곧장 사진첩.
 * 종이 영수증은 안내가 없다 — 부르는 앱의 촬영 · 스캔 버튼을 `paper` 자리에 그대로 넣는다.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GUIDES, guideOf, needsTwo } from './data';
import type { GuideApp, ReceiptPlatform } from './types';
import { T, TwoBadge, row, useGuideTheme } from './ui';

export type ChooserProps = {
  /** 지난번에 고른 곳 — 앱이면 [바로 올리기] 를 낸다 */
  remembered: ReceiptPlatform | null;
  /** [영수증 확인 방법] 을 켠 뒤 앱을 골랐다 — 안내를 연다 */
  onGuide: (app: GuideApp) => void;
  /**
   * 앱을 골랐다 — 바로 올리기(사진첩 · 캡슐이 없으면 부르는 앱이 캡슐 받기부터).
   * (0.3.0) **주지 않으면 예전처럼** 앱 칸이 곧장 안내(onGuide)를 열고 [영수증 확인 방법] 버튼도 없다 — 다른 앱이 깨지지 않게.
   */
  onPick?: (app: GuideApp) => void;
  /** [바로 올리기] — 안내 없이 사진첩 */
  onQuick: (app: GuideApp) => void;
  /** 지금 못 올린다(캡슐 없음 등) — [바로 올리기] 만 막는다. 안내는 언제나 볼 수 있다 */
  quickDisabled?: boolean;
  /** 종이 영수증 자리 — 부르는 앱의 [촬영하기] · [사진 올리기] */
  paper: React.ReactNode;
};

export function Chooser({ remembered, onGuide, onPick, onQuick, quickDisabled, paper }: ChooserProps) {
  const theme = useGuideTheme();
  // 「영수증 확인 방법」을 켜면 앱 칸을 누를 때 올리는 법 안내가 열린다(끄면 바로 올리기)
  const [howToOn, setHowTo] = React.useState(false);
  const howTo = howToOn || !onPick;   // onPick 이 없으면 언제나 안내
  const last = remembered && remembered !== 'paper' ? guideOf(remembered) : null;

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <T size={18} w={900}>어떤 영수증을 올리나요?</T>
      <T size={14.5} w={700} color={theme.sub} lh={21} style={{ marginTop: 2 }}>
        {!onPick ? '앱 영수증은 고르면 올리는 법을 먼저 보여 줘요. 「2장」은 캡처 2장을 함께 올려야 해요'
          : howTo ? '올리는 법을 볼 앱을 골라 주세요' : '앱을 고르면 바로 그 영수증을 올려요. 「2장」은 캡처 2장을 함께 올려야 해요'}
      </T>
      {onPick ? <Pressable
        accessibilityRole="button" accessibilityState={{ selected: howTo }} onPress={() => setHowTo(v => !v)}
        style={({ pressed }) => [s.howTo, { borderColor: howTo ? theme.brand : theme.line, backgroundColor: howTo ? theme.brandSoft : theme.card, opacity: pressed ? 0.8 : 1 }]}
      >
        <T size={14} w={800} color={theme.brand}>{howTo ? '안내 닫기 · 바로 올리기로' : '영수증 확인 방법'}</T>
      </Pressable> : null}

      {last ? (
        <View style={[s.quick, { backgroundColor: theme.brandSoft }]}>
          <View style={[row, { gap: 8 }]}>
            <View style={[s.dot, { backgroundColor: last.accent }]} />
            <T size={15} w={800} style={{ flexShrink: 1 }}>지난번 {last.name}</T>
            {needsTwo(last.app) ? <TwoBadge /> : null}
            <View style={{ flex: 1 }} />
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
                accessibilityRole="button" accessibilityLabel={g.name + (howTo ? ' 영수증 확인 방법' : ' 영수증 바로 올리기')}
                onPress={() => (howTo || !onPick ? onGuide(g.app) : onPick(g.app))}
                style={({ pressed }) => [s.tile, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brandSoft : theme.card, opacity: pressed ? 0.8 : 1 }]}
              >
                <View style={[s.dot, { backgroundColor: g.accent }]} />
                <T size={g.name.length > 6 ? 13.5 : 15} w={800} lines={1}>{g.name}</T>
                {needsTwo(g.app) ? <View style={s.badge}><TwoBadge /></View> : null}
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
  howTo: { alignSelf: 'flex-start', marginTop: 10, borderWidth: 1.5, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  quickBtn: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -4 },
  cell: { width: '33.33%', padding: 4 },
  tile: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 6 },
  badge: { position: 'absolute', top: -6, right: -4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
