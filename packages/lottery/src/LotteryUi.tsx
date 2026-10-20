import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  lotteryMoreLabel, lotteryMoreMissionLabel, lotteryResultTitle, lotteryTierButton, lotteryTierHint, lotteryTierTitle, lotteryWinnerLine,
  type LotteryOpenResult, type LotteryState, type LotteryTier, type LotteryWinner,
} from './lottery';

/** 색 — 앱이 넘기는 값(@jcurve/mission 의 MissionPageTheme 을 그대로 넘겨도 된다, 필요한 칸만 쓴다) */
export type LotteryTheme = { bg: string; card: string; text: string; sub: string; accent: string; accentText: string; accentSoft: string; done: string };
export const DEFAULT_LOTTERY_THEME: LotteryTheme = {
  bg: '#FBF7F2', card: '#FFFFFF', text: '#2B2118', sub: '#6B5E52', accent: '#EE7A33', accentText: '#FFFFFF', accentSoft: '#FDE6D6', done: '#D3D7DD',
};

/**
 * 복권 화면 조각들(mission 0.6.0 에서 옮겨 왔다 — 이름 · props 그대로) — 모두 **상태가 없다**(앱이 useLottery 의 값을 넘긴다). 색만 theme 으로 받고 모양은 패키지가 정한다.
 * Modal 이 아니라 화면 위 덮개다 — 보상형 광고가 Modal 뒤에 깔리지 않게(앱의 TicketSheet 와 같은 이유). 앱이 화면 맨 위(탭 바 위)에 둔다.
 */
type ThemeProp = { theme?: Partial<LotteryTheme> };
const th = (t?: Partial<LotteryTheme>): LotteryTheme => ({ ...DEFAULT_LOTTERY_THEME, ...(t ?? {}) });

/**
 * 안 연 복권이 있을 때만 — 다 열면 사라진다(count 0 이면 null).
 * 기본은 **띠 없이 떠 있는 흰 알약**(그림자, FloatingRewardChip 과 같은 모양 · 대표님 「떠 있는 알약」): 안쪽 화면의 탭 바 위에 두고 `bottomOffset`(아래에서 띄울 거리)만 준다.
 * `floating={false}` 면 줄 안에 놓는 작은 색 알약(0.6.0 모양).
 */
export function LotteryChip({ count, onPress, label, bottomOffset = 16, floating = true, icon, theme }: { count: number; onPress: () => void; label?: string; bottomOffset?: number; floating?: boolean; icon?: ReactNode } & ThemeProp) {
  if (!(count > 0)) return null;
  const c = th(theme);
  const text = label ?? '복권 ' + count + '장';
  if (!floating) {
    return <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress} style={({ pressed }) => [s.chip, { backgroundColor: c.accent }, pressed && { opacity: 0.85 }]}>
      <Text style={[s.chipText, { color: c.accentText }]}>{text}</Text>
    </Pressable>;
  }

  return <View pointerEvents="box-none" style={[s.anchor, { bottom: bottomOffset }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress} style={({ pressed }) => [s.floating, pressed && { opacity: 0.8 }]}>
      <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {icon ?? <View style={[s.ticket, { borderColor: c.accent }]}><View style={[s.ticketLine, { borderColor: c.accent }]} /></View>}
      </View>
      <Text style={s.floatingText}>{text}</Text>
      <Text accessible={false} style={s.arrow}>›</Text>
    </Pressable>
  </View>;
}

function TierRow({ t, theme, busy, onOpen, onEarn }: { t: LotteryTier; theme: LotteryTheme; busy?: boolean; onOpen: (tier: number) => void; onEarn: (tier: number) => void }) {
  const b = lotteryTierButton(t);
  const active = b.kind === 'open' || b.kind === 'earn';
  const press = () => { if (b.kind === 'open') onOpen(t.tier); else if (b.kind === 'earn') onEarn(t.tier); };

  return <Pressable accessibilityRole="button" accessibilityLabel={lotteryTierTitle(t) + ', ' + b.label} accessibilityState={{ disabled: !active || !!busy }} disabled={!active || !!busy} onPress={press} style={s.row}>
    <View style={s.rowCopy}><Text style={[s.rowTitle, { color: theme.text }]}>{lotteryTierTitle(t)}{t.unopened > 1 ? ' × ' + t.unopened : ''}</Text><Text style={[s.rowHint, { color: theme.sub }]}>{lotteryTierHint(t)}</Text></View>
    <View pointerEvents="none" style={[s.rowButton, { backgroundColor: active ? theme.accentSoft : theme.done }]}><Text style={[s.rowButtonText, { color: active ? theme.accent : theme.sub }]}>{b.label}</Text></View>
  </Pressable>;
}

/** 복권 시트 — 3단계 줄 · 받기 / 열기 / 획득 완료 · 당첨 띠 · 「한 번 더! ○원 복권 받기」 · 알림 켜기 */
export function LotterySheet({ open, state, winners, busy, onOpen, onEarn, onMore, onClose, onEnableNotify, notifyLabel, theme, renderNative }: {
  open: boolean;
  state: LotteryState | null;
  winners?: readonly LotteryWinner[];
  busy?: boolean;
  /** 「열기」 — 그 단계 복권을 연다(앱이 useLottery.open 을 부르고 결과 창을 띄운다) */
  onOpen: (tier: number) => void;
  /** 「받기」 — 아직 못 받은 단계: 미션 화면으로 보낸다 */
  onEarn: (tier: number) => void;
  /** 아래 큰 버튼 「한 번 더! ○원 복권 받기」 — 안 주면 onEarn(다음 단계) */
  onMore?: (tier: number) => void;
  onClose: () => void;
  onEnableNotify?: () => void;
  notifyLabel?: string;
  renderNative?: () => ReactNode;
} & ThemeProp) {
  if (!open || !state) return null;
  const c = th(theme);
  const more = lotteryMoreLabel(state);
  const next = state.tiers.find(t => t.missionState === 'locked');
  const last = winners && winners.length > 0 ? winners[0] : null;

  return <View style={s.overlay}>
    <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={s.dim} />
    <View style={[s.sheet, { backgroundColor: c.card }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={12} onPress={onClose} style={s.close}><Text style={[s.closeText, { color: c.sub }]}>✕</Text></Pressable>
      <Text style={[s.sheetTitle, { color: c.text }]}>꽝 없는 복권{'\n'}지금 열고 행운 받아가요!</Text>
      <Text style={[s.sheetSub, { color: c.sub }]}>받은 복권은 매일 자정에 사라져요</Text>
      {last ? <View style={[s.ticker, { backgroundColor: c.bg }]}><Text style={[s.tickerText, { color: c.text }]} numberOfLines={1}>{lotteryWinnerLine(last)}</Text></View> : null}
      {state.tiers.map(t => <TierRow key={t.tier} t={t} theme={c} busy={busy} onOpen={onOpen} onEarn={onEarn} />)}
      {more && next ? <Pressable accessibilityRole="button" accessibilityLabel={more} disabled={!!busy} onPress={() => (onMore ?? onEarn)(next.tier)} style={[s.big, { backgroundColor: c.accent }]}><Text style={[s.bigText, { color: c.accentText }]}>{more}</Text></Pressable> : null}
      {onEnableNotify ? <Pressable accessibilityRole="button" accessibilityLabel={notifyLabel ?? '복권 받게 알림 켜기'} onPress={onEnableNotify} style={s.link}><Text style={[s.linkText, { color: c.accent }]}>🔔 {notifyLabel ?? '복권 받게 알림 켜기'} ›</Text></Pressable> : null}
      {renderNative ? <View style={s.native}>{renderNative()}</View> : null}
    </View>
  </View>;
}

/**
 * 결과 창 — 「축하해요 보상 ○P 당첨!」, **큰 아이콘 없음**(대표님 13:56). 버튼 아래에 앱이 넘기는 네이티브 광고(`renderNative`).
 * 남은 복권이 있으면 「다음 복권 열기」, 없으면 「미션 하고 복권 더 받기」(다음 단계까지 남은 미션 수), 둘 다 「다음에 할게요」로 닫는다.
 */
export function LotteryResult({ result, state, onOpenNext, onMore, onClose, renderNative, theme }: {
  result: Pick<LotteryOpenResult, 'won' | 'points' | 'unopened'>;
  state?: LotteryState | null;
  /** 남은 복권이 있을 때 「다음 복권 열기」 */
  onOpenNext?: () => void;
  /** 남은 복권이 없을 때 「미션 하고 복권 더 받기」 */
  onMore?: () => void;
  onClose: () => void;
  renderNative?: () => ReactNode;
} & ThemeProp) {
  const c = th(theme);
  const hasNext = result.unopened > 0;
  const moreLabel = !hasNext && state ? lotteryMoreMissionLabel(state) : null;

  return <View style={[s.result, { backgroundColor: c.card }]}>
    <Text style={[s.resultTitle, { color: c.text }]}>{lotteryResultTitle(result.points)}</Text>
    <Text style={[s.resultSub, { color: c.sub }]}>{result.won.toLocaleString('ko-KR')}원 복권</Text>
    {renderNative ? <View style={s.native}>{renderNative()}</View> : null}
    {hasNext && onOpenNext ? <Pressable accessibilityRole="button" accessibilityLabel="다음 복권 열기" onPress={onOpenNext} style={[s.big, { backgroundColor: c.accent }]}><Text style={[s.bigText, { color: c.accentText }]}>다음 복권 열기 ({result.unopened}장 남았어요)</Text></Pressable> : null}
    {!hasNext && moreLabel && onMore ? <Pressable accessibilityRole="button" accessibilityLabel={moreLabel} onPress={onMore} style={[s.big, { backgroundColor: c.accent }]}><Text style={[s.bigText, { color: c.accentText }]}>{moreLabel}</Text></Pressable> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="다음에 할게요" onPress={onClose} style={s.link}><Text style={[s.linkText, { color: c.sub }]}>다음에 할게요</Text></Pressable>
  </View>;
}

/**
 * 황금 복권 팝업 — 「황금 복권이 나타났어요!」 하루 한 번. 버튼은 「광고 보고 황금 복권 열기」: 앱이 `onOpen` 에서 **보상형 광고(용도 lottery_basic)를 보여 준 뒤**
 * `useLottery.open(tier, 'basic')` 을 부른다 — 광고 시청은 서버가 구글 SSV 로 확인한다(앱 말만 믿지 않는다).
 * `icon` 은 앱이 넘기는 그림(없으면 글자만). busy 동안은 다시 눌리지 않는다.
 */
export function GoldenLotteryPopup({ open, maxWon, busy, onOpen, onClose, buttonLabel, icon, theme }: {
  open: boolean;
  maxWon: number;
  busy?: boolean;
  onOpen: () => void;
  onClose: () => void;
  buttonLabel?: string;
  icon?: ReactNode;
} & ThemeProp) {
  if (!open) return null;
  const c = th(theme);
  const label = buttonLabel ?? '광고 보고 황금 복권 열기';

  return <View style={s.overlay}>
    <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={s.dim} />
    <View style={[s.sheet, { backgroundColor: c.card }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={12} onPress={onClose} style={s.close}><Text style={[s.closeText, { color: c.sub }]}>✕</Text></Pressable>
      <Text style={[s.sheetTitle, { color: c.text }]}>황금 복권이 나타났어요!</Text>
      <Text style={[s.sheetSub, { color: c.sub }]}>{'하루에 한번만 행운처럼 오는 기회\n최대 ' + maxWon.toLocaleString('ko-KR') + '원을 받을 수 있어요'}</Text>
      {icon ? <View style={s.golden}>{icon}</View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!busy }} disabled={!!busy} onPress={onOpen} style={[s.big, { backgroundColor: c.accent }, busy && { opacity: 0.6 }]}><Text style={[s.bigText, { color: c.accentText }]}>{label}</Text></Pressable>
    </View>
  </View>;
}

const s = StyleSheet.create({
  anchor: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 10 },
  floating: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, backgroundColor: '#FFFFFF',
    shadowColor: '#17212E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 6 },
  floatingText: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: '#26333D' },
  arrow: { fontSize: 24, lineHeight: 24, color: '#77818B' },
  ticket: { width: 22, height: 16, borderWidth: 2, borderRadius: 4, transform: [{ rotate: '-12deg' }] },
  ticketLine: { height: 10, marginLeft: 11, borderLeftWidth: 1, borderStyle: 'dashed' },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: '800' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 60, elevation: 60 },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24, gap: 12 },
  close: { position: 'absolute', top: 14, right: 16, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 20, fontWeight: '700' },
  sheetTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30, marginTop: 8 },
  sheetSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  ticker: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  tickerText: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 17, fontWeight: '800' },
  rowHint: { fontSize: 13 },
  rowButton: { minWidth: 76, height: 38, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowButtonText: { fontSize: 14, fontWeight: '800' },
  big: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  bigText: { fontSize: 16, fontWeight: '800' },
  link: { alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 14, fontWeight: '700' },
  native: { marginTop: 4 },
  golden: { alignItems: 'center', paddingVertical: 12 },
  result: { borderRadius: 24, paddingHorizontal: 20, paddingVertical: 28, gap: 12, alignItems: 'stretch' },
  resultTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
  resultSub: { fontSize: 14, textAlign: 'center' },
});
