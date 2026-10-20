import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Dimensions, Easing, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, type TextProps } from 'react-native';
import {
  goldenLines, goldenRow, lotteryMissionButton, lotteryMissionHint, lotteryMoreLabel, lotteryMoreMissionLabel, lotteryResultHeadline, lotteryTierTitle, lotteryWinnerParts,
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

/**
 * (0.1.4) 한글 줄바꿈은 **단어(띄어쓰기) 단위로** — iOS 기본은 글자 단위로 끊어 「받아가요!」가 「받아가」 / 「요!」 로 갈라졌다(감자밭 캡처). lineBreakStrategyIOS="hangul-word" 를 모든 글자에 준다(Android 는 무시).
 * 이 패키지의 글자는 모두 이것을 쓴다 — 제목 · 줄 설명은 줄 수 · 너비에 맞춰 줄어들고(adjustsFontSizeToFit) 한 글자만 남는 줄이 없게 한다
 */
function Txt(props: TextProps) {
  return <Text lineBreakStrategyIOS="hangul-word" {...props} />;
}

const th = (t?: Partial<LotteryTheme>): LotteryTheme => ({ ...DEFAULT_LOTTERY_THEME, ...(t ?? {}) });

/**
 * 떠 있는 칩의 위아래 4px 움직임(FloatingRewardChip 과 같다, 앱총괄 「떠 있는 느낌」) — 접근성 「동작 줄이기」를 켜면 멈춘다.
 * 설정을 읽기 전에는 가만히 있는다. active 가 꺼지면(칩이 사라지거나 inline 모양) 멈추고 제자리로
 */
function useBob(active: boolean): Animated.Value {
  const y = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let alive = true;
    let changed = false;
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => { changed = true; setReduceMotion(v); });
    void AccessibilityInfo.isReduceMotionEnabled().then((v: boolean) => { if (alive && !changed) setReduceMotion(v); }).catch(() => undefined);

    return () => { alive = false; sub.remove(); };
  }, []);
  useEffect(() => {
    y.setValue(0);
    if (!active || reduceMotion) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -4, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();

    return () => { loop.stop(); y.setValue(0); };
  }, [active, reduceMotion, y]);

  return y;
}

/**
 * 안 연 복권이 있을 때만 — 다 열면 사라진다(count 0 이면 null).
 * 기본은 **띠 없이 떠 있는 흰 알약**(그림자, FloatingRewardChip 과 같은 모양 · 대표님 「떠 있는 알약」): 안쪽 화면의 탭 바 위에 두고 `bottomOffset`(아래에서 띄울 거리)만 준다.
 * `floating={false}` 면 줄 안에 놓는 작은 색 알약(0.6.0 모양).
 */
export function LotteryChip({ count, onPress, label, bottomOffset = 16, floating = true, icon, theme }: { count: number; onPress: () => void; label?: string; bottomOffset?: number; floating?: boolean; icon?: ReactNode } & ThemeProp) {
  const bob = useBob(count > 0 && floating);   // 훅은 늘 같은 순서로 — 아래에서 null 을 돌려줘도 먼저 부른다
  if (!(count > 0)) return null;
  const c = th(theme);
  const text = label ?? '복권 ' + count + '장';
  if (!floating) {
    return <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress} style={({ pressed }) => [s.chip, { backgroundColor: c.accent }, pressed && { opacity: 0.85 }]}>
      <Txt style={[s.chipText, { color: c.accentText }]}>{text}</Txt>
    </Pressable>;
  }

  return <View pointerEvents="box-none" style={[s.anchor, { bottom: bottomOffset }]}>
    <Animated.View style={{ maxWidth: '100%', transform: [{ translateY: bob }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress} style={({ pressed }) => [s.floating, pressed && { opacity: 0.8 }]}>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {icon ?? <View style={[s.ticket, { borderColor: c.accent }]}><View style={[s.ticketLine, { borderColor: c.accent }]} /></View>}
        </View>
        <Txt style={s.floatingText}>{text}</Txt>
        <Txt accessible={false} style={s.arrow}>›</Txt>
      </Pressable>
    </Animated.View>
  </View>;
}

/**
 * (0.1.2) 「광고」 작은 칩 — 눌렀을 때 **광고가 바로 열리는** 버튼 안 오른쪽에만(앱 홈 「감자 키우기 [광고]」 · 「풍선 더 받기 [광고]」와 같은 모양). 광고 없이 열리는 버튼에는 넣지 않는다.
 * `onColor` 는 칩이 올라가는 바탕에서 읽히는 글자색(채운 버튼 위면 accentText, 연한 버튼 위면 accent)
 */
function AdChip({ label = '광고', onColor, onFilled }: { label?: string; onColor: string; onFilled?: boolean }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[s.adChip, onFilled ? s.adChipOnFilled : { borderColor: onColor }]}><Txt style={[s.adChipText, { color: onColor }]}>{label}</Txt></View>;
}

/**
 * (0.1.2 · 0.1.3 링크 모양) 「🔔 복권 받게 알림 켜기 ›」 — `useLotteryNotify` 가 돌려주는 값을 그대로 넘긴다. visible 이 거짓이면(알림이 이미 켜져 있거나 모르면) 없다.
 * 서버 발송은 이 패키지에 없다 — 버튼과 권한 유도만. 큰 버튼 아래의 글자 링크(참고 캡처 IMG_9331)
 */
export type LotteryNotify = { visible: boolean; busy?: boolean; onPress: () => void; label?: string; hint?: string };

function NotifyRow({ notify, theme }: { notify?: LotteryNotify; theme: LotteryTheme }) {
  if (!notify || !notify.visible) return null;
  const label = notify.label ?? '복권 받게 알림 켜기';

  return <View style={s.notifyBox}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!notify.busy }} disabled={!!notify.busy} onPress={notify.onPress} hitSlop={8} style={[s.notifyLink, notify.busy && { opacity: 0.6 }]}>
      <Txt accessible={false} style={s.notifyBell}>🔔</Txt>
      <Txt style={[s.notifyTitle, { color: theme.accent }]}>{label}</Txt>
      <Txt accessible={false} style={[s.notifyChevron, { color: theme.accent }]}>›</Txt>
    </Pressable>
    <Txt style={[s.notifyHint, { color: theme.sub }]}>{notify.hint ?? '매일 새 복권이 나오면 알려 드릴게요'}</Txt>
  </View>;
}

/**
 * 시트 · 팝업 · 전체 화면이 올라오는 층(0.1.3) — 기본 `overlay` 는 Modal 이 아니라 부모 영역을 덮는 absolute 판(뒤 화면을 어둡게 하는 딤 포함)이다: 보상형 광고가 Modal 뒤에 깔리지 않게
 * (iOS 는 RN Modal 이 떠 있으면 AdMob 이 광고를 못 연다). **앱 루트(탭 메뉴 · 상태줄 바깥)에 그려야** 탭 메뉴까지 덮는다. `presentation="modal"` 이면 RN Modal(탭 · 상태줄 위) —
 * 그때는 광고를 열기 전에 먼저 닫을 것. Android 뒤로 가기는 닫기로 쓴다.
 */
export type LotteryPresentation = 'overlay' | 'modal';

function Layer({ open, onClose, presentation = 'overlay', children }: { open: boolean; onClose: () => void; presentation?: LotteryPresentation; children: ReactNode }) {
  useEffect(() => {
    if (!open) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });

    return () => sub.remove();
  }, [open, onClose]);
  if (!open) return null;
  if (presentation === 'modal') return <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}><View style={s.layerFill}>{children}</View></Modal>;

  return <View style={s.overlay}>{children}</View>;
}

/**
 * 시트가 차지할 수 있는 높이 — 화면 높이에서 위 여백(상태줄 · 노치)과 숨 쉴 자리를 뺀다. 앱이 안전 영역 위 값을 `topInset` 으로 주면 그것을, 안 주면 안드로이드 상태줄 높이 · iOS 는 44 로 짐작한다.
 * 내용이 이보다 길면 시트 안에서 스크롤한다(0.1.1 — 시트 맨 위 줄이 상태줄 밑으로 밀려 잘리던 것, 감자밭 시뮬)
 */
export function sheetMaxHeight(windowHeight: number, topInset?: number, os: string = Platform.OS, statusBar: number | null | undefined = StatusBar.currentHeight): number {
  const top = typeof topInset === 'number' && topInset >= 0 ? topInset : os === 'android' ? (statusBar ?? 24) : 44;

  return Math.max(240, Math.round(windowHeight - top - 24));
}

/**
 * 바텀 시트(0.1.3, 대표님 15:55 「팝업이냐 bottom 시트냐 닫기가 없어」): ① 뒤 화면 어둡게(딤) — 딤을 누르면 닫힘 ② 오른쪽 위 X ③ 위 손잡이 바 ④ 둥근 위 모서리 흰 판,
 * 아래는 안전 영역(`bottomInset`)만큼 더 띄운다. 내용이 길면 시트 안에서 스크롤.
 */
function BottomSheet({ open, onClose, theme, topInset, bottomInset = 0, presentation, children }: { open: boolean; onClose: () => void; theme: LotteryTheme; topInset?: number; bottomInset?: number; presentation?: LotteryPresentation; children: ReactNode }) {
  return <Layer open={open} onClose={onClose} presentation={presentation}>
    <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={s.dim} />
    <View style={[s.bsheet, { backgroundColor: theme.card, maxHeight: sheetMaxHeight(Dimensions.get('window').height, topInset), paddingBottom: SHEET_PAD + Math.max(0, bottomInset) }]}>
      <View accessible={false} style={s.handleWrap}><View style={[s.handle, { backgroundColor: theme.done }]} /></View>
      <View style={s.bsHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={12} onPress={onClose} style={s.bsClose}><Txt style={[s.closeText, { color: theme.sub }]}>✕</Txt></Pressable>
      </View>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={s.bsBody}>{children}</ScrollView>
    </View>
  </Layer>;
}

/** 왼쪽 숫자 카드 아이콘 — 단계마다 다른 색(참고 캡처의 100 · 500 · 1000 카드). 황금 줄은 별 */
function NumberCard({ label, color }: { label: string; color: string }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.cardWrap}>
    <View style={[s.cardBack, { backgroundColor: color }]} />
    <View style={[s.cardFront, { backgroundColor: color }]}><Txt style={s.cardText} numberOfLines={1} adjustsFontSizeToFit>{label}</Txt></View>
  </View>;
}

function CardRow({ icon, color, title, hint, button, ad, adLabel, theme, busy, onPress }: {
  icon: string; color: string; title: string; hint: string; button: { label: string; kind: 'open' | 'earn' | 'done' | 'wait' }; ad?: boolean; adLabel?: string; theme: LotteryTheme; busy?: boolean; onPress: () => void;
}) {
  const active = button.kind === 'open' || button.kind === 'earn';

  return <Pressable accessibilityRole="button" accessibilityLabel={title + ', ' + button.label + (ad ? ', ' + (adLabel ?? '광고') : '')} accessibilityState={{ disabled: !active || !!busy }} disabled={!active || !!busy} onPress={onPress} style={s.row}>
    <NumberCard label={icon} color={color} />
    <View style={s.rowCopy}><Txt style={[s.rowTitle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{title}</Txt><Txt style={[s.rowHint, { color: theme.sub }]} numberOfLines={2}>{hint}</Txt></View>
    <View pointerEvents="none" style={[s.rowButton, { backgroundColor: active ? theme.accentSoft : theme.done }]}>
      <Txt style={[s.rowButtonText, { color: active ? theme.accent : theme.sub }]}>{button.label}</Txt>
      {ad && button.kind === 'open' ? <AdChip label={adLabel} onColor={theme.accent} /> : null}
    </View>
  </Pressable>;
}

/** 단계마다 다른 카드 색 — 첫 색은 앱 강조색, 나머지는 고정 보조색(마지막은 황금) */
const cardColors = (c: LotteryTheme, n: number): string[] => [c.accent, '#8E6CF0', '#F28C28', '#35A7F0', '#2DB77E'].slice(0, Math.max(1, n));
const GOLD_COLOR = '#E8B100';

/**
 * 복권 시트 — 참고 캡처(IMG_9331) 구성: 딤 · 둥근 흰 시트 · X · 손잡이 → 큰 제목 2줄 + 회색 한 줄 → 회색 둥근 당첨 띠(**서버 winners 의 실제 기록이 있을 때만**, 가짜 이름 없음)
 * → 줄 목록(왼쪽 숫자 카드 · 「최대 ○ 복권」 굵게 · 회색 설명 · 오른쪽 「받기」 연한 버튼 / 「받기 완료」 회색) → 맨 아래 큰 「한 번 더! ○ 복권 받기」 + 「🔔 복권 받게 알림 켜기 ›」 링크.
 * 줄: 미션 복권 줄(단계마다, 미션 복권만의 상태) + 하루 기본(황금) 복권 줄(있을 때). 포인트 표 단계는 「최대 1,000P 복권」(unit:'points'), 원 표는 「최대 100원 복권」.
 * 광고가 바로 열리는 줄(황금 복권을 여는 버튼)에만 「광고」 칩. `onOpen(tier, src)` — 미션 줄은 'mission', 황금 줄은 'basic'(앱은 'basic' 일 때 보상형 광고를 먼저 보여 준다).
 */
export function LotterySheet({ open, state, winners, busy, onOpen, onEarn, onMore, onClose, onEnableNotify, notifyLabel, notify, theme, renderNative, topInset, bottomInset, basicAd = true, adLabel, presentation }: {
  open: boolean;
  state: LotteryState | null;
  winners?: LotteryWinner[];
  /** 열기 요청 중 — 줄이 눌리지 않는다 */
  busy?: boolean;
  onOpen: (tier: number, src?: 'basic' | 'mission') => void;
  /** 「받기」 — 아직 못 받은 단계(미션으로 가기) */
  onEarn: (tier: number) => void;
  /** 「한 번 더! ○ 복권 받기」 — 안 주면 onEarn(다음 단계) */
  onMore?: (tier: number) => void;
  onClose: () => void;
  /** (옛 방식) 있으면 늘 보이는 「알림 켜기」 줄 — 새 앱은 `notify`(useLotteryNotify)를 쓴다: 꺼져 있을 때만 보인다 */
  onEnableNotify?: () => void;
  notifyLabel?: string;
  /** (0.1.2) 알림이 꺼져 있을 때만 보이는 「🔔 복권 받게 알림 켜기 ›」 링크 */
  notify?: LotteryNotify;
  renderNative?: () => ReactNode;
  /** 안전 영역 위 여백(`useSafeAreaInsets().top`) — 시트가 이 아래에서 끝난다. 안 주면 짐작한다 */
  topInset?: number;
  /** (0.1.3) 아래 안전 영역(`useSafeAreaInsets().bottom`) — 시트 아래를 그만큼 더 띄운다 */
  bottomInset?: number;
  /** (0.1.2) 황금(기본) 복권을 열 때 광고가 열리나 — 서버 설정 daily_basic.ad(기본 true). */
  basicAd?: boolean;
  adLabel?: string;
  presentation?: LotteryPresentation;
} & ThemeProp) {
  if (!open || !state) return null;
  const c = th(theme);
  const gold = goldenRow(state);
  const next = state.tiers.find(t => t.missionState === 'locked') ?? null;
  const more = next ? lotteryMoreLabel(state) : null;
  const last = winners && winners.length > 0 ? winners[0] : null;
  const colors = cardColors(c, state.tiers.length);
  const parts = last ? lotteryWinnerParts(last) : null;

  return <BottomSheet open={open} onClose={onClose} theme={c} topInset={topInset} bottomInset={bottomInset} presentation={presentation}>
    <Txt accessibilityRole="header" style={[s.sheetTitle, { color: c.text }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{'꽝 없는 복권\n지금 열고 행운 받아가요!'}</Txt>
    <Txt style={[s.sheetSub, { color: c.sub }]}>받은 복권은 매일 자정에 사라져요</Txt>
    {parts ? <View style={[s.ticker, { backgroundColor: c.bg }]}><Txt style={[s.tickerText, { color: c.text }]} numberOfLines={1}>{parts.pre}<Txt style={{ color: c.accent, fontWeight: '800' }}>{parts.amount}</Txt>{parts.post}</Txt></View> : null}
    <View style={s.rows}>
      {state.tiers.map((t, i) => {
        const b = lotteryMissionButton(t);

        return <CardRow key={t.tier} icon={String(t.missions)} color={colors[i % colors.length]} title={lotteryTierTitle(t)} hint={lotteryMissionHint(t)} button={b} theme={c} busy={busy}
          onPress={() => { if (b.kind === 'open') onOpen(t.tier, 'mission'); else if (b.kind === 'earn') onEarn(t.tier); }} />;
      })}
      {gold ? <CardRow icon="★" color={GOLD_COLOR} title={lotteryTierTitle(gold.tier)} hint={basicAd ? '황금 복권을 이용해서 얻을 수 있어요' : '매일 한 번 열 수 있어요'}
        button={gold.unopened > 0 ? { label: '열기', kind: 'open' } : { label: '받기 완료', kind: 'done' }} ad={basicAd && gold.unopened > 0} adLabel={adLabel} theme={c} busy={busy}
        onPress={() => onOpen(gold.tier.tier, 'basic')} /> : null}
    </View>
    {more && next ? <Pressable accessibilityRole="button" accessibilityLabel={more} disabled={!!busy} onPress={() => (onMore ?? onEarn)(next.tier)} style={[s.big, { backgroundColor: c.accent }]}><Txt style={[s.bigText, { color: c.accentText }]}>{more}</Txt></Pressable> : null}
    {notify ? <NotifyRow notify={notify} theme={c} /> : onEnableNotify ? <Pressable accessibilityRole="button" accessibilityLabel={notifyLabel ?? '복권 받게 알림 켜기'} onPress={onEnableNotify} style={s.link}><Txt style={[s.linkText, { color: c.accent }]}>🔔 {notifyLabel ?? '복권 받게 알림 켜기'} ›</Txt></Pressable> : null}
    {renderNative ? <View style={s.native}>{renderNative()}</View> : null}
  </BottomSheet>;
}

/**
 * 기본으로 그리는 황금 복권 그림 — 앱 그림(`icon`)이 없을 때. 금빛 티켓 한 장에 별 하나, 오른쪽은 점선 절취선
 */
function GoldenTicketArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.goldTicket}>
    <Txt style={s.goldStar}>★</Txt>
    <View style={s.goldPerforation} />
    <View style={s.goldStub}><Txt style={s.goldStubText}>GOLD</Txt></View>
  </View>;
}

/**
 * 당첨 결과 — **전체 화면**(0.1.3, 대표님 15:57 「당첨 화면은 전체 화면으로 나오게 해」): 탭 메뉴 · 상태줄까지 덮는다(앱 루트에 그리거나 `presentation="modal"`).
 * 위: X(오른쪽) → 가운데 「축하해요!」 + 큰 「5P 당첨!」 + 복권 그림(`icon` 이 있으면 그것) → 아래: 큰 버튼 + 「확인」 + 알림 켜기 링크 + 네이티브 광고(`renderNative`).
 * 남은 복권이 있으면 「다음 복권 열기 (N장 남았어요)」, 없으면 「한 번 더! ○ 복권 받기」(다음 단계), 둘 다 없으면 「확인」만. 원 표 단계는 「○원 복권」 한 줄이 더 붙고 포인트 표는 P 만 보인다.
 * `topInset`/`bottomInset` 은 안전 영역(상태줄 · 홈 바) 값.
 */
export function LotteryResult({ result, state, onOpenNext, onMore, onClose, renderNative, theme, nextAd, adLabel, notify, icon, topInset = 0, bottomInset = 0, presentation, open = true }: {
  result: Pick<LotteryOpenResult, 'won' | 'points' | 'unopened'> & { unit?: 'won' | 'points' };
  state?: LotteryState | null;
  /** 남은 복권이 있을 때 「다음 복권 열기」 */
  onOpenNext?: () => void;
  /** 남은 복권이 없을 때 「한 번 더! ○ 복권 받기」 */
  onMore?: () => void;
  onClose: () => void;
  renderNative?: () => ReactNode;
  /** (0.1.2) 「다음 복권 열기」가 광고를 여는가 — `nextOpensWithAd(state, basicAd)` 를 넘긴다(안 주면 광고 칩 없음) */
  nextAd?: boolean;
  adLabel?: string;
  /** (0.1.2) 알림이 꺼져 있을 때만 보이는 「🔔 복권 받게 알림 켜기 ›」 링크 */
  notify?: LotteryNotify;
  /** 복권 그림(없으면 기본 황금 티켓) */
  icon?: ReactNode;
  topInset?: number;
  bottomInset?: number;
  presentation?: LotteryPresentation;
  open?: boolean;
} & ThemeProp) {
  const c = th(theme);
  const hasNext = result.unopened > 0;
  const moreLabel = !hasNext && state ? lotteryMoreLabel(state) : null;
  const wonLine = result.unit === 'points' ? null : result.won.toLocaleString('ko-KR') + '원 복권';

  return <Layer open={open} onClose={onClose} presentation={presentation}>
    <View style={[s.full, { backgroundColor: c.card, paddingTop: Math.max(0, topInset) + 8, paddingBottom: Math.max(0, bottomInset) + 20 }]}>
      <View style={s.fullHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={12} onPress={onClose} style={s.bsClose}><Txt style={[s.closeText, { color: c.sub }]}>✕</Txt></Pressable>
      </View>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={s.fullBody}>
        <View style={s.fullCenter}>
          <Txt style={[s.fullKicker, { color: c.sub }]}>축하해요!</Txt>
          <Txt accessibilityRole="header" style={[s.fullHeadline, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{lotteryResultHeadline(result.points)}</Txt>
          {wonLine ? <Txt style={[s.fullSub, { color: c.sub }]}>{wonLine}</Txt> : null}
          <View style={s.fullArt}>{icon ?? <GoldenTicketArt />}</View>
        </View>
        <View style={s.fullActions}>
          {hasNext && onOpenNext ? <Pressable accessibilityRole="button" accessibilityLabel="다음 복권 열기" onPress={onOpenNext} style={[s.big, s.bigRow, { backgroundColor: c.accent }]}><Txt style={[s.bigText, { color: c.accentText }]}>다음 복권 열기 ({result.unopened}장 남았어요)</Txt>{nextAd ? <AdChip label={adLabel} onColor={c.accentText} onFilled /> : null}</Pressable> : null}
          {!hasNext && moreLabel && onMore ? <Pressable accessibilityRole="button" accessibilityLabel={moreLabel} onPress={onMore} style={[s.big, { backgroundColor: c.accent }]}><Txt style={[s.bigText, { color: c.accentText }]}>{moreLabel}</Txt></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="확인" onPress={onClose} style={s.link}><Txt style={[s.linkText, { color: c.sub }]}>확인</Txt></Pressable>
          <NotifyRow notify={notify} theme={c} />
          {renderNative ? <View style={s.native}>{renderNative()}</View> : null}
        </View>
      </ScrollView>
    </View>
  </Layer>;
}

/**
 * 황금 복권 팝업 — 「황금 복권이 나타났어요!」 하루 한 번(0.1.2: 읽기 쉽게, 0.1.3: **바텀 시트**로 — 딤 · X · 손잡이 · 안전 영역). 위에서 아래로: 황금 복권 그림(`icon` 이 있으면 그것) → 제목 → 쉬운 말 3줄 → 작은 글씨 → 버튼 → 「다음에 열기」.
 * 값(최대 금액 · 포인트)은 서버 state 에서 읽어 넘긴다 — `maxWon`(필수) · `maxPoints` · **`unit`**(포인트 표면 'points' → 「최대 1,000P가 바로 들어와요」, 원 병기 없음). 문구는 `lines`/`note` 로 통째로 바꿀 수 있다(다국어).
 * 버튼은 「광고 보고 황금 복권 열기」: 앱이 `onOpen` 에서 **보상형 광고(용도 lottery_basic)를 보여 준 뒤** `useLottery.open(tier, 'basic')` 을 부른다
 * — 광고 시청은 서버가 구글 SSV 로 확인한다(앱 말만 믿지 않는다). 광고가 바로 열리므로 버튼 안 오른쪽에 「광고」 칩(`ad` 가 false 면 칩 · 광고 문구 없음). busy 동안은 다시 눌리지 않는다.
 */
export function GoldenLotteryPopup({ open, maxWon, maxPoints, unit, busy, onOpen, onClose, buttonLabel, icon, theme, ad = true, adLabel, closeLabel, lines, note, topInset, bottomInset = 0, notify, presentation }: {
  open: boolean;
  maxWon: number;
  maxPoints?: number | null;
  unit?: 'won' | 'points';
  busy?: boolean;
  onOpen: () => void;
  onClose: () => void;
  buttonLabel?: string;
  icon?: ReactNode;
  /** 열 때 광고가 열리나(서버 daily_basic.ad, 기본 true) — false 면 「광고」 칩을 빼고 문구도 「바로 열 수 있어요」 */
  ad?: boolean;
  adLabel?: string;
  /** 버튼 아래 글자 버튼(기본 「다음에 열기」) */
  closeLabel?: string;
  /** 설명 줄 · 작은 글씨를 통째로 바꾼다(기본은 goldenLines) */
  lines?: string[];
  note?: string;
  topInset?: number;
  bottomInset?: number;
  /** (0.1.2) 알림이 꺼져 있을 때만 보이는 「🔔 복권 받게 알림 켜기 ›」 링크 — 「다음에 열기」 아래 */
  notify?: LotteryNotify;
  presentation?: LotteryPresentation;
} & ThemeProp) {
  if (!open) return null;
  const c = th(theme);
  const label = buttonLabel ?? (ad ? '광고 보고 황금 복권 열기' : '황금 복권 열기');
  const copy = goldenLines({ maxWon, maxPoints, ad, unit });
  const body = lines ?? copy.lines;
  const small = note ?? copy.note;
  const later = closeLabel ?? '다음에 열기';

  return <BottomSheet open={open} onClose={onClose} theme={c} topInset={topInset} bottomInset={bottomInset} presentation={presentation}>
    <View style={s.goldArt}>{icon ?? <GoldenTicketArt />}</View>
    <Txt accessibilityRole="header" style={[s.goldTitle, { color: c.text }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>황금 복권이 나타났어요!</Txt>
    <View style={s.goldLines}>
      {body.map((line, i) => <Txt key={i} style={[s.goldLine, { color: c.text }]}>{line}</Txt>)}
    </View>
    <Txt style={[s.goldNote, { color: c.sub }]}>{small}</Txt>
    <Pressable accessibilityRole="button" accessibilityLabel={label + (ad && !label.includes(adLabel ?? '광고') ? ', ' + (adLabel ?? '광고') : '')} accessibilityState={{ disabled: !!busy }} disabled={!!busy} onPress={onOpen}
      style={[s.big, s.bigRow, { backgroundColor: c.accent }, busy && { opacity: 0.6 }]}>
      <Txt style={[s.bigText, { color: c.accentText }]}>{label}</Txt>
      {ad ? <AdChip label={adLabel} onColor={c.accentText} onFilled /> : null}
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={later} onPress={onClose} style={s.goldLater}><Txt style={[s.linkText, { color: c.sub }]}>{later}</Txt></Pressable>
    <NotifyRow notify={notify} theme={c} />
  </BottomSheet>;
}

/** 시트의 바깥 여백(좌우 · 아래) */
const SHEET_PAD = 24;

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
  layerFill: { flex: 1, justifyContent: 'flex-end' },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  bsheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: SHEET_PAD, paddingTop: 8 },
  handleWrap: { alignItems: 'center', paddingTop: 4, paddingBottom: 4 },
  handle: { width: 44, height: 5, borderRadius: 3 },
  bsHeader: { height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  bsClose: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  bsBody: { paddingBottom: 4 },
  closeText: { fontSize: 22, fontWeight: '600' },
  sheetTitle: { fontSize: 24, lineHeight: 34, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  sheetSub: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12 },
  ticker: { borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginTop: 24 },
  tickerText: { fontSize: 14, fontWeight: '600' },
  rows: { marginTop: 20, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  rowHint: { fontSize: 14, lineHeight: 20 },
  rowButton: { minWidth: 84, height: 44, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  rowButtonText: { fontSize: 15, fontWeight: '800' },
  cardWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  cardBack: { position: 'absolute', width: 40, height: 40, borderRadius: 11, opacity: 0.35, transform: [{ rotate: '8deg' }], right: 2, top: 2 },
  cardFront: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  cardText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', paddingHorizontal: 4 },
  big: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 20 },
  bigRow: { flexDirection: 'row', gap: 8 },
  bigText: { fontSize: 17, fontWeight: '800' },
  adChip: { height: 20, paddingHorizontal: 7, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  adChipOnFilled: { borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.22)' },
  adChipText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  link: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 4 },
  linkText: { fontSize: 15, fontWeight: '700' },
  native: { marginTop: 12 },
  notifyBox: { alignItems: 'center', marginTop: 8, gap: 2 },
  notifyLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingVertical: 6 },
  notifyBell: { fontSize: 18 },
  notifyTitle: { fontSize: 15, fontWeight: '700' },
  notifyChevron: { fontSize: 22, lineHeight: 22, fontWeight: '600' },
  notifyHint: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  goldArt: { alignItems: 'center', marginTop: 4 },
  goldTicket: { width: 120, height: 72, borderRadius: 14, backgroundColor: '#FFD54A', borderWidth: 2, borderColor: '#E5A400', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', transform: [{ rotate: '-6deg' }] },
  goldStar: { flex: 1, textAlign: 'center', fontSize: 34, lineHeight: 40, color: '#B77900', fontWeight: '800' },
  goldPerforation: { alignSelf: 'stretch', width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: '#E5A400', marginVertical: 6 },
  goldStub: { width: 38, alignItems: 'center', justifyContent: 'center' },
  goldStubText: { fontSize: 10, fontWeight: '900', color: '#B77900', transform: [{ rotate: '90deg' }], width: 40, textAlign: 'center' },
  goldTitle: { marginTop: 20, fontSize: 24, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
  goldLines: { marginTop: 16, gap: 8 },
  goldLine: { fontSize: 16, lineHeight: 26, textAlign: 'center' },
  goldNote: { marginTop: 12, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  goldLater: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 8 },
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: SHEET_PAD },
  fullHeader: { height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  fullBody: { flexGrow: 1, justifyContent: 'space-between' },
  fullCenter: { alignItems: 'center', paddingTop: 24, paddingBottom: 24 },
  fullKicker: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  fullHeadline: { marginTop: 8, fontSize: 48, lineHeight: 58, fontWeight: '900', textAlign: 'center' },
  fullSub: { marginTop: 8, fontSize: 16, lineHeight: 24 },
  fullArt: { marginTop: 32, alignItems: 'center' },
  fullActions: { paddingTop: 8 },
});
