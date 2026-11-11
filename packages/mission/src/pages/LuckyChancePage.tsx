/**
 * 행운 찬스 — 하루 무료 한 번, 광고를 보면 한 번 더 뽑기 (0.4.0, carrot ChanceScreen · DrawCard 그대로).
 * 상품 · 확률 · 횟수 · 간격은 서버가 정한다. 패키지는 남은 횟수와 대기 시각을 그리고 onDraw(광고 여부) 만 부른다.
 * 참여형 광고(오퍼월)는 `offerwall` 을 줄 때만 그린다 — 주소 · 여는 방법은 앱이 가진다.
 */
import React, { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PageFrame, PageButton, resolvePageTheme, type MissionPageTheme } from './PageFrame';
import { drawLabel, drawSubLine, prizeLine, waitLeftMs, boostLine } from './logic';

export type LuckyChancePageProps = {
  /** 오늘 무료로 남은 뽑기 수 */
  freeLeft: number;
  /** 광고를 보고 더 뽑을 수 있는 남은 수 */
  adLeft: number;
  /** 다음 뽑기 가능 시각(앱 기준 epoch ms). 지나지 않았으면 초읽기를 보여 준다 */
  waitUntil?: number;
  /** 뽑으면 받는 것 목록 — 「꽝 없이 A / B」(carrot 은 서버 칸에서 종류별 최대값) */
  prizes?: readonly string[];
  /** 확률권 수 — 0 보다 크면 한 줄(boostText 가 없으면 「확률권 N장」만) */
  boost?: number;
  /** 확률권 줄 뒤 설명 — 앱마다 말이 달라 앱이 준다(예 「다음에 캘 때 좋은 당근이 잘 나와요」) (0.4.1 앱보조2 10-20) */
  boostText?: string;
  /** 카드 제목 — 기본 「행운 뽑기」(0.4.0 은 「당근 뽑기」가 박혀 있었다) */
  drawTitle?: string;
  /** 뽑기 — ad=false 면 무료, true 면 광고를 보고 뽑는다(광고 · 지급은 앱) */
  onDraw: (ad: boolean) => void | Promise<void>;
  /** 뽑기 중 — 단추를 막는다 */
  busy?: boolean;
  /** 참여형 광고 — 주소가 있을 때만 준다. 누르면 onOpen(앱이 연다) */
  offerwall?: { name: string; onOpen: () => void };
  onBack: () => void;
  title?: string;
  theme?: Partial<MissionPageTheme>;
  footer?: ReactNode;
};

export function LuckyChancePage({ freeLeft, adLeft, waitUntil, prizes = [], boost = 0, boostText, drawTitle = '행운 뽑기', onDraw, busy = false, offerwall, onBack, title = '행운 찬스', theme: themeIn, footer }: LuckyChancePageProps) {
  const theme = resolvePageTheme(themeIn);
  // 초읽기 — 대기 중일 때만 1초마다 다시 그린다(시각은 렌더마다 새로 잰다)
  const [, tick] = useState(0);
  const waitMs = waitLeftMs(waitUntil, Date.now());
  useEffect(() => {
    if (waitMs <= 0) return;
    const timer = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, [waitMs > 0]);
  const free = freeLeft > 0;
  const canFree = free && waitMs <= 0 && !busy;
  const canAd = !free && adLeft > 0 && waitMs <= 0 && !busy;
  const prize = prizeLine(prizes);

  return <PageFrame title={title} onBack={onBack} theme={theme} footer={footer}>
    <View style={[s.card, { backgroundColor: theme.card }]}>
      <Text style={[s.cardTitle, { color: theme.text }]}>{drawTitle}</Text>
      <Text style={[s.cardSub, { color: theme.sub }]}>{drawSubLine({ free: freeLeft, ad: adLeft, waitMs })}</Text>
      {prize ? <Text style={[s.prize, { color: theme.text, backgroundColor: theme.accentSoft }]}>{prize}</Text> : null}
      {boost > 0 ? <View style={[s.boost, { backgroundColor: theme.accentSoft }]}>
        <Text style={[s.boostText, { color: theme.accent }]}>{boostLine(boost, boostText)}</Text>
      </View> : null}
      <PageButton big label={drawLabel({ free, waitMs })} theme={theme}
        on={canFree || canAd} disabled={!(canFree || canAd)} onPress={() => { void onDraw(!free); }} />
    </View>

    {offerwall ? <View style={[s.card, { backgroundColor: theme.card }]}>
      <Text style={[s.cardTitle, { color: theme.text }]}>{offerwall.name}</Text>
      <Text style={[s.cardSub, { color: theme.sub }]}>참여하면 매체 확인이 끝난 뒤 포인트가 자동으로 들어와요</Text>
      <PageButton big label="참여하러 가기" theme={theme} on onPress={offerwall.onOpen} />
    </View> : null}
  </PageFrame>;
}

const s = StyleSheet.create({
  card: { borderRadius: 20, padding: 20, alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 19, fontWeight: '800' },
  cardSub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  prize: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, fontSize: 14, fontWeight: '700', overflow: 'hidden' },
  boost: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'stretch' },
  boostText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
});
