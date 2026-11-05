/**
 * 어떤 영수증인가 고르는 칸 — 영수증 올리기의 **첫 자리**(대표님 10-03 23:25 「선택하게 해야겠네」).
 *
 * 앱(배민 · 쿠팡 …)을 고르면 부르는 앱이 **그 앱 영수증 팝업**을 연다 — 처음이면 올리는 법 안내부터, 아니면 등록 칸만
 * (대표님 10-04 12:24 「배민 누르면 팝업 뜨고 … 처음 눌렀으면 안내가 나오는 거고 아니면 아래 영수증 등록 하는 안내만」).
 * 예전 [영수증 확인 방법] 켜고 끄기는 뺐다 — 안내는 팝업 위 「안내 다시 보기」로 본다.
 * 지난번에 고른 앱이 있으면 맨 위에 [바로 올리기] — 안내를 건너뛰고 곧장 사진첩.
 * 종이 영수증은 안내가 없다 — 부르는 앱의 촬영 · 스캔 버튼을 `paper` 자리에 그대로 넣는다.
 * 연동 칩이 있으면(대표님 계정) 처음엔 여섯 칸(3열 2줄)만 보이고 「더보기 ∨」로 전부 · 「접기 ∧」로 여섯 칸으로 접는다. 「컬리(네이버페이)」 칸은 「컬리」 칩과 겹쳐 뺀다.
 * 종이 영수증은 그때 「전자 영수증」 아래 따로 카드로 내린다.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GUIDES, accentOf, guideOf, needsTwo } from './data';
import type { GuideApp, ReceiptPlatform } from './types';
import { T, TwoBadge, row, useGuideTheme } from './ui';

export type ChooserProps = {
  /** 지난번에 고른 곳 — 앱이면 [바로 올리기] 를 낸다 */
  remembered: ReceiptPlatform | null;
  /** 앱 칸을 골랐다 — 부르는 앱이 그 앱 영수증 팝업을 연다 */
  onPick: (app: GuideApp) => void;
  /** [바로 올리기] — 안내 없이 사진첩 */
  onQuick: (app: GuideApp) => void;
  /** 지금 못 올린다(캡슐 없음 등) — [바로 올리기] 만 막는다. 앱 칸은 언제나 팝업을 연다 */
  quickDisabled?: boolean;
  /** 종이 영수증 자리 — 부르는 앱의 [촬영하기] · [사진 올리기] */
  paper: React.ReactNode;
  /** 칸에서 뺄 앱 — 서버가 숨기라고 하면 그 앱 칸과 [바로 올리기] 를 뺀다(없으면 전부) */
  hidden?: GuideApp[];
  /** 주문내역 연동 칩 — 칸 맨 앞에 이 순서로 놓고 「연동 / 미연동」을 붙인다. app 의 안내 칸은 이 칩이 대신하고 색을 빌려 온다(없으면 칸은 지금 그대로) */
  linkChips?: LinkChip[];
  /** 연동 칩을 눌렀다 — 부르는 앱이 동의 · 로그인 창 · (연동됨이면) 고르기를 연다. 안내 칸은 onPick 그대로 */
  onLinkPick?: (key: string, connected: boolean) => void;
  /** 종이 영수증 카드 바로 위에 놓을 안내(연동 칩이 있을 때만) — 찍는 법 안내는 전자 영수증과 상관없다(대표님 11-03 09:31) */
  paperHint?: React.ReactNode;
};

/**
 * 연동 칩. stage 가 있으면 그것이 뱃지를 정한다(1.1.1, 대표님 11-05 18:06 「연동으로 뜨는데 실제로는 연동이 안 돼 있다」):
 *  none → 「미연동」 · login(동의만 하고 첫 불러오기 전) → 「로그인 필요」 · linked → 「연동」. 없으면 connected 로 「연동 / 미연동」(옛 앱).
 */
export type LinkStage = 'none' | 'login' | 'linked';
export type LinkChip = { key: string; app: GuideApp; name: string; connected: boolean; stage?: LinkStage };
export const LINK_STAGE_LABEL: Record<LinkStage, string> = { none: '미연동', login: '로그인 필요', linked: '연동' };
const stageOf = (chip: LinkChip): LinkStage => chip.stage ?? (chip.connected ? 'linked' : 'none');

/** 연동 칩이 있을 때 접은 상태에 보이는 칸 수 — 3열 2줄(네이버 · 쿠팡 · 컬리 / 무신사 · 배민 · 쿠팡이츠) */
const LINKED_COLLAPSED = 6;

export function Chooser({ remembered, onPick, onQuick, quickDisabled, paper, hidden = [], linkChips = [], onLinkPick, paperHint }: ChooserProps) {
  const theme = useGuideTheme();
  const [expanded, setExpanded] = useState(false);
  /** 연동 칩이 있으면(대표님 계정) 접어 여섯 칸부터, 종이 영수증은 따로 카드 */
  const linked = linkChips.length > 0;
  const linkApps = new Set(linkChips.map((c) => c.app));
  const shown = GUIDES.filter((g) => !hidden.includes(g.app) && !linkApps.has(g.app) && !(linked && g.app === 'kurly_npay'));
  /** 연동 칩이 앞, 그 뒤가 안내 칸 — 접었을 때도 연동 칩은 다 보인다 */
  const tiles = [...linkChips.map((chip) => ({ chip })), ...shown.map((g) => ({ g }))];
  const visible = expanded ? tiles : tiles.slice(0, linked ? LINKED_COLLAPSED : Math.max(3, linkChips.length));
  const last = remembered && remembered !== 'paper' && !hidden.includes(remembered) ? guideOf(remembered) : null;
  const cardStyle = [s.card, { backgroundColor: theme.card, borderColor: theme.line }];
  const paperTitle = <T size={15} w={900} style={linked ? { marginBottom: 8 } : { marginTop: 14, marginBottom: 8 }}>종이 영수증</T>;

  const electronic = (
    <View style={cardStyle}>
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

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T size={15} w={900}>전자 영수증</T>
        <Pressable
          accessibilityRole="button" accessibilityState={{ expanded }} hitSlop={12}
          onPress={() => setExpanded(value => !value)}
          style={({ pressed }) => [s.toggle, { opacity: pressed ? 0.7 : 1 }]}
        >
          <T size={14.5} w={700} color={theme.sub}>{expanded ? '접기 ∧' : '더보기 ∨'}</T>
        </Pressable>
      </View>
      <View style={s.grid}>
        {visible.map((t) => {
          if ('chip' in t) {
            const { chip } = t;
            const stage = stageOf(chip);
            const on = stage === 'linked';
            return (
              <View key={'link:' + chip.key} style={s.cell}>
                <Pressable
                  accessibilityRole="button" accessibilityLabel={chip.name + (on ? ' 계정 연동됨' : stage === 'login' ? ' 계정 로그인 필요' : ' 계정 미연동')}
                  onPress={() => onLinkPick?.(chip.key, on)}
                  style={({ pressed }) => [s.tile, { borderColor: on || stage === 'login' ? theme.brand : theme.line, backgroundColor: on ? theme.brandSoft : theme.card, opacity: pressed ? 0.8 : 1 }]}
                >
                  <View style={[s.dot, { backgroundColor: accentOf(chip.app) }]} />
                  <T size={15} w={800} lines={linked ? 2 : 1} center={linked} style={{ flexShrink: 1 }}>{chip.name}</T>
                  <View style={s.badge}>
                    {/* 로그인 필요 = 테두리만 브랜드색 · 글자 브랜드색(아직 「연동」 아님) */}
                    <View style={[s.linkBadge, { backgroundColor: on ? theme.brand : stage === 'login' ? theme.card : theme.line, borderWidth: stage === 'login' ? 1 : 0, borderColor: theme.brand }]}>
                      <T size={11} w={900} color={on ? theme.white : stage === 'login' ? theme.brand : theme.sub}>{LINK_STAGE_LABEL[stage]}</T>
                    </View>
                  </View>
                </Pressable>
              </View>
            );
          }
          const g = t.g;
          const on = remembered === g.app;
          return (
            <View key={g.app} style={s.cell}>
              <Pressable
                accessibilityRole="button" accessibilityLabel={g.name + ' 영수증 올리기'}
                onPress={() => onPick(g.app)}
                style={({ pressed }) => [s.tile, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brandSoft : theme.card, opacity: pressed ? 0.8 : 1 }]}
              >
                <View style={[s.dot, { backgroundColor: g.accent }]} />
                <T size={g.name.length > 6 ? 13.5 : 15} w={800} lines={linked ? 2 : 1} center={linked} style={{ flexShrink: 1 }}>{g.name}</T>
                {needsTwo(g.app) ? <View style={s.badge}><TwoBadge /></View> : null}
              </Pressable>
            </View>
          );
        })}
      </View>

      {linked ? null : <>{paperTitle}{paper}</>}
    </View>
  );

  if (!linked) return electronic;
  return (
    <>
      {electronic}
      {paperHint}
      <View style={cardStyle}>
        {paperTitle}
        {paper}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: 20, padding: 16 },
  quick: { marginTop: 12, borderRadius: 14, padding: 12 },
  quickBtn: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -4 },
  toggle: { alignItems: 'center', justifyContent: 'center' },
  cell: { width: '33.33%', padding: 4 },
  tile: { borderWidth: 1.5, borderRadius: 14, minHeight: 44, paddingVertical: 4, paddingHorizontal: 6, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  badge: { position: 'absolute', top: -6, right: -4 },
  linkBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
