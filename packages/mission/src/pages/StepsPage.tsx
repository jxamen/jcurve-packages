/**
 * 만보기 — 1,000걸음마다 광고 보고 포인트 (0.4.0, carrot StepsScreen 의 보이는 모양만).
 *
 * (0.4.6, 대표님 10-20 19:00) **신발 그림을 지우고 광고를 위로** — 위에서 아래로: 걸음 수 · 말풍선 → 「남은 횟수」 카드 → **광고(`footer`, 안내사항 위)** → 「만보기 안내사항」.
 * `footer` 는 예전엔 맨 아래였다 — 앱 코드를 바꾸지 않아도 광고가 안내사항 위로 올라온다.
 *
 * **이 패키지는 @jcurve/steps 를 가져오지 않는다.** 걸음 수 · 단계 · 받기는 전부 props 로 받는다.
 * 옛 빌드(걸음 기능 없음)는 `stepsAvailable={false}` 로 두면 화면은 읽기만 되고, 받기 · 단추는
 * 「업데이트하면 걸음 보상을 받을 수 있어요」 안내와 onUpdate() 로 간다(2026-10-20 · 옛 빌드 충돌 방지).
 */
import React, { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PageFrame, PageButton, resolvePageTheme, type MissionPageTheme } from './PageFrame';
import { settleWithin, stepsBubble, stepsSummary, UPDATE_NOTICE, type StepsStage } from './logic';

export type StepsPageProps = {
  /** 오늘 걸음 수 — 앱이 센다 */
  todaySteps: number;
  /** 단계 목록 — 앱이 1,000걸음 · 5P 같은 값을 정해 준다 */
  stages: readonly StepsStage[];
  /** 오늘 받은 포인트 합 — 「오늘 받은 포인트 {n}P」 */
  earnedToday?: number;
  /** 걸음 기능이 켜져 있나(new 빌드). false 면 읽기만 되고 받기는 onUpdate 로 간다 */
  stepsAvailable: boolean;
  /** 업데이트 창 열기 — 앱이 스토어 · 업데이트 안내를 연다 */
  onUpdate: () => void;
  /** 단계 받기 — 광고 · 서버 지급은 앱이 한다. reject 하면 「다시 시도」 안내 */
  onClaim: (stage: StepsStage) => void | Promise<void>;
  onBack: () => void;
  /** (0.4.13) iOS 왼쪽 가장자리를 오른쪽으로 밀면 onBack(기본 true). 안드로이드는 그대로. 이미 앱에서 밀기를 감싼 화면은 false */
  swipeBack?: boolean;
  /** 「1,000걸음마다」 의 걸음 수 — 기본 1000 */
  everySteps?: number;
  /** 안내 줄(목록) — 기본은 carrot 안내 문구 중 기기 중립인 것 */
  guide?: readonly string[];
  title?: string;
  theme?: Partial<MissionPageTheme>;
  /** 광고 자리 — 앱이 네이티브 광고를 넣는다(패키지는 광고를 모른다). 0.4.6 부터 「남은 횟수」 카드 아래 · 「만보기 안내사항」 위 */
  footer?: ReactNode;
  /**
   * (0.7.18 · 0.4.16-mc2, 대표님 10-28 21:26~27 · 전 앱 같은 모양) **기본 true**: 위쪽 큰 걸음 수 · 말풍선을 없애고 「남은 횟수」 카드 한 장 안에 합친다 — 「오늘 걸음 N걸음」 · 「남은 횟수 N번」 · 설명 한 줄 ·
   * (받을 횟수가 0일 때만) 상태 줄(다음 걸음까지 / 다 받음) · 단추. `false` 를 주면 예전 모양(위 큰 걸음 수 + 말풍선, 카드에는 남은 횟수부터)으로 되돌린다.
   */
  mergedCard?: boolean;
};

const DEFAULT_GUIDE = [
  '1,000걸음마다 광고 보기를 완료하면 포인트를 받아요.',
  '걸음 수와 남은 횟수는 매일 자정(한국 시간)에 초기화되고, 받지 않은 횟수는 다음 날로 넘어가지 않아요.',
  '배터리 절약 모드 등에서는 걸음 수가 정확하지 않을 수 있어요.',
  '만보기 보상과 조건은 사정에 따라 바뀔 수 있어요.',
];

export function StepsPage({ todaySteps, stages, earnedToday = 0, stepsAvailable, onUpdate, onClaim, onBack, swipeBack, everySteps = 1000, guide = DEFAULT_GUIDE, title = '만보기', theme: themeIn, footer, mergedCard = true }: StepsPageProps) {
  const theme = resolvePageTheme(themeIn);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const summary = stepsSummary(todaySteps, stages);
  const points = stages[0]?.points ?? 0;
  const first = summary.claimable[0];
  const canClaim = stepsAvailable && !!first && !busy;
  // 합친 카드의 상태 줄: 옛 말풍선 중 「남은 횟수」와 겹치지 않는 것만(받을 횟수가 있으면 없음 · 업데이트 전이면 위 업데이트 안내가 대신함)
  const status = mergedCard && stepsAvailable && summary.claimable.length === 0 ? stepsBubble({ available: stepsAvailable, todaySteps, stages }) : null;

  const claim = async () => {
    // 옛 빌드는 받기 대신 업데이트 창으로(carrot ensureStepsVersion 과 같은 자리)
    if (!stepsAvailable) { onUpdate(); return; }
    if (!first || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await settleWithin(Promise.resolve(onClaim(first)));   // 광고가 안 돌아와도 잠금은 풀린다(0.4.3)
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return <PageFrame title={title} onBack={onBack} swipeBack={swipeBack} theme={theme}>
    {mergedCard ? null : <View style={s.top}>
      <Text style={[s.count, { color: theme.text }]}>{todaySteps.toLocaleString()}<Text style={[s.unit, { color: theme.sub }]}> 걸음</Text></Text>
      <View style={[s.bubble, { backgroundColor: theme.card }]}><Text style={[s.bubbleText, { color: theme.text }]}>{stepsBubble({ available: stepsAvailable, todaySteps, stages })}</Text></View>
    </View>}

    {!stepsAvailable ? <View style={[s.notice, { backgroundColor: theme.card }]}>
      <Text style={[s.noticeTitle, { color: theme.text }]}>{UPDATE_NOTICE}</Text>
      <PageButton big label="업데이트하기" theme={theme} on onPress={onUpdate} />
    </View> : null}

    {failed ? <Text accessibilityLiveRegion="polite" style={[s.message, { color: theme.sub }]}>광고 확인이 늦어지고 있어요. 잠시 후 다시 눌러 주세요</Text> : null}

    <View style={[s.claimCard, { backgroundColor: theme.card }]}>
      {mergedCard ? <Text style={[s.claimLeft, { color: theme.text }]}>오늘 걸음 <Text style={[s.claimNum, { color: theme.accent }]}>{todaySteps.toLocaleString()}</Text>걸음</Text> : null}
      <Text style={[s.claimLeft, { color: theme.text }]}>남은 횟수 <Text style={[s.claimNum, { color: theme.accent }]}>{`${stepsAvailable ? summary.claimable.length : 0}번`}</Text></Text>
      <Text style={[s.claimSub, { color: theme.sub }]}>{`${everySteps.toLocaleString()}걸음마다 광고 보고 ${points}P · 오늘 받은 포인트 ${earnedToday}P`}</Text>
      {status ? <Text style={[s.claimSub, { color: theme.sub }]}>{status}</Text> : null}
      <PageButton big label={busy ? '확인 중…' : `광고 보고 ${points}P 받기`} theme={theme} on={canClaim || !stepsAvailable} disabled={stepsAvailable && !canClaim} onPress={() => { void claim(); }} />
    </View>

    {footer != null ? <View style={s.ad}>{footer}</View> : null}

    <View style={[s.guide, { backgroundColor: theme.card }]}>
      <Text style={[s.guideTitle, { color: theme.text }]}>만보기 안내사항</Text>
      {guide.map(line => <Text key={line} style={[s.guideLine, { color: theme.sub }]}>· {line}</Text>)}
    </View>
  </PageFrame>;
}

const s = StyleSheet.create({
  top: { alignItems: 'center', paddingTop: 8 },
  count: { fontSize: 44, fontWeight: '800' },
  unit: { fontSize: 18, fontWeight: '600' },
  bubble: { marginTop: 14, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 },
  bubbleText: { fontSize: 15 },
  ad: { marginTop: 4 },
  notice: { borderRadius: 16, padding: 16, gap: 10 },
  noticeTitle: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  message: { textAlign: 'center', fontSize: 13 },
  claimCard: { marginTop: 8, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
  claimLeft: { fontSize: 18, fontWeight: '700' },
  claimNum: { fontSize: 22, fontWeight: '800' },
  claimSub: { fontSize: 13 },
  guide: { borderRadius: 16, padding: 20, gap: 6 },
  guideTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  guideLine: { fontSize: 13, lineHeight: 20 },
});
