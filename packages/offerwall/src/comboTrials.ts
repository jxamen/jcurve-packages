/**
 * 무료체험 (대표님 10/27 22:11~22:29): a cancel-notice consent popup before a free-trial campaign's detail opens, the member's own list
 * 「무료체험 확인」 (what they joined, when the trial ends, whether they cancelled), and the request channel a push uses to open that list.
 * The server (앱보조5) decides everything about status and dates; this file only shows it.
 */
import type { ReactElement } from 'react';
import { ComboMissionIcon, DEFAULT_COMBO_THEME, formatWon, type ComboTheme } from './combos';

export const COMBO_TRIALS_NAME = '무료체험 확인';
export const COMBO_TRIAL_STATUSES = ['체험 중', '지금 해지 가능', '결제 시작됨'] as const;
export type MyTrialStatus = (typeof COMBO_TRIAL_STATUSES)[number];

/** One row of `GET offerwall/trials`: a free trial this member joined (consented to cancel notices, or was paid for). */
export type MyTrial = {
  campaignKey: string; name: string;
  points?: number; icon?: string;
  /** ISO time with +09:00 (the server's own); `joinedVia`: 'reward' = the real credit time, 'consent' = when they agreed (before any credit) */
  joinedAt?: string; joinedVia?: 'reward' | 'consent'; agreed?: boolean;
  trialDays?: number; trialHours?: number; cancelAfterHours?: number; chargeAmount?: number;
  /** from when the trial can be cancelled, and when the first charge happens (ISO, +09:00) */
  cancelFrom?: string; chargeAt?: string;
  /** computed by the server against its own `now` */
  status?: MyTrialStatus;
  /** null = not marked yet, true = 해지했어요, false = 아직 안 했어요 */
  cancelled?: boolean | null;
};

const text = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '';
const whole = (v: unknown, max: number): number | undefined => {
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= max ? n : undefined;
};
const isoTime = (v: unknown): string | undefined => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? v.slice(0, 40) : undefined);

/** At most this many rows of the member's list are kept. */
const MAX_MY_TRIALS = 200;

/**
 * The body of `GET offerwall/trials`: `{ ok, trials: [...], now }`. Returns the checked rows in the server's order (newest first), or null when
 * the body is not that shape (so the screen can say it could not load instead of showing nothing). A row needs a campaign key; every other
 * value is optional and a bad one is simply left out.
 */
export function parseMyTrials(body: unknown): MyTrial[] | null {
  const root = body && typeof body === 'object' ? (body as Record<string, any>) : null;
  if (!root || root.ok === false || !Array.isArray(root.trials)) return null;
  const seen = new Set<string>();
  const out: MyTrial[] = [];
  for (const item of root.trials.slice(0, MAX_MY_TRIALS * 2)) {
    if (out.length >= MAX_MY_TRIALS) break;
    const campaignKey = text(typeof item?.campaignKey === 'number' ? String(item.campaignKey) : item?.campaignKey, 64);
    if (!campaignKey || seen.has(campaignKey)) continue;
    seen.add(campaignKey);
    const iconUrl = text(item.icon, 500);
    const status = (COMBO_TRIAL_STATUSES as readonly unknown[]).includes(item.status) ? (item.status as MyTrialStatus) : undefined;
    const joinedAt = isoTime(item.joined_at), cancelFrom = isoTime(item.cancel_from), chargeAt = isoTime(item.charge_at);
    const points = whole(item.points, 10_000_000), trialDays = whole(item.trial_days, 365), trialHours = whole(item.trial_hours, 8760);
    const cancelAfterHours = whole(item.cancel_after_hours, 8760), chargeAmount = whole(item.charge_amount, 10_000_000);
    out.push({
      campaignKey, name: text(item.name, 40) || '무료체험',
      ...(points ? { points } : {}), ...(/^https:\/\/\S+$/i.test(iconUrl) ? { icon: iconUrl } : {}),
      ...(joinedAt ? { joinedAt } : {}), ...(item.joined_via === 'reward' || item.joined_via === 'consent' ? { joinedVia: item.joined_via as 'reward' | 'consent' } : {}),
      ...(typeof item.agreed === 'boolean' ? { agreed: item.agreed } : {}),
      ...(trialDays ? { trialDays } : {}), ...(trialHours ? { trialHours } : {}), ...(cancelAfterHours ? { cancelAfterHours } : {}), ...(chargeAmount ? { chargeAmount } : {}),
      ...(cancelFrom ? { cancelFrom } : {}), ...(chargeAt ? { chargeAt } : {}),
      ...(status ? { status } : {}),
      ...(item.cancelled === true || item.cancelled === false || item.cancelled === null ? { cancelled: item.cancelled as boolean | null } : {}),
    });
  }
  return out;
}

/** 「2026-10-30T22:32:24+09:00」 → 「10/30」 (the date as the server wrote it, Korean time). */
export function monthDay(iso: string | undefined): string {
  const m = iso ? /^\d{4}-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${Number(m[1])}/${Number(m[2])}` : '';
}

/** Does this row still have to ask 「해지했나요?」: the cancel time has come (or the first charge has started) and the member has not said yes. */
export function asksCancelled(trial: Pick<MyTrial, 'status' | 'cancelled'>): boolean {
  return (trial.status === '지금 해지 가능' || trial.status === '결제 시작됨') && trial.cancelled !== true;
}

/** The small grey line under a row's name: 「10/27 참여 · 11/3 결제 예정 · 월 29,900원」 (parts the server did not give are left out). */
export function myTrialLine(trial: MyTrial): string {
  const parts: string[] = [];
  const joined = monthDay(trial.joinedAt);
  if (joined) parts.push(`${joined} 참여`);
  const charge = monthDay(trial.chargeAt);
  if (charge) parts.push(trial.status === '결제 시작됨' ? `${charge} 결제 시작` : `${charge} 결제 예정`);
  if (trial.chargeAmount) parts.push(`월 ${formatWon(trial.chargeAmount)}`);
  return parts.join(' · ');
}

// ---- opening the list from a push or a link ------------------------------------------------------------------------

type TrialsOpener = { priority: number; open(focusKey?: string): void };
const trialOpeners = new Set<TrialsOpener>();
let trialsWaiting: { since: number; focusKey?: string } | null = null;
const TRIALS_WAIT_MS = 10000;

/**
 * Opens the member's free-trial list from anywhere (a cancel-notice push). `focusKey` is the campaign to highlight. Like `requestOpenCombos`:
 * with no entry mounted yet (the app is switching to the Chance tab) the request waits up to 10 seconds for the first one that mounts.
 */
export function requestOpenTrials(focusKey?: string, now: number = Date.now()): boolean {
  let target: TrialsOpener | undefined;
  for (const opener of trialOpeners) if (!target || opener.priority >= target.priority) target = opener;
  if (!target) { trialsWaiting = { since: now, ...(focusKey ? { focusKey } : {}) }; return false; }
  trialsWaiting = null;
  target.open(focusKey);
  return true;
}
export function listenForTrialRequests(opener: TrialsOpener, now: number = Date.now()): () => void {
  trialOpeners.add(opener);
  const waiting = trialsWaiting && now - trialsWaiting.since <= TRIALS_WAIT_MS ? trialsWaiting : null;
  trialsWaiting = null;
  if (waiting) opener.open(waiting.focusKey);
  return () => { trialOpeners.delete(opener); };
}

// ---- the consent popup -----------------------------------------------------------------------------------------------

export const COMBO_CONSENT_TITLE = '무료체험이 끝나기 전에 해지 안내를 받으시겠어요?';
export const COMBO_CONSENT_BODY = '기간이 끝나기 전에 해지하지 않으면 자동으로 결제될 수 있어요. 안내를 받으면 해지할 때가 되었을 때 알림으로 알려 드려요.';
export type ConsentAnswer = 'agree' | 'decline' | 'cancel';

/**
 * Asked before a free-trial campaign's detail page opens. 「안내 받기」 and 「괜찮아요」 both go on to the campaign (the caller records the
 * answer); tapping the dimmed area or going back answers nothing ('cancel': the campaign does not open and the question comes again next time).
 */
export function TrialConsentPopup({ name, theme = DEFAULT_COMBO_THEME, onAnswer }: { name: string; theme?: ComboTheme; onAnswer: (answer: ConsentAnswer) => void }): ReactElement {
  const React = require('react') as typeof import('react');
  const { View, Text, Pressable, BackHandler } = require('react-native') as typeof import('react-native');
  const h = React.createElement;
  const t = theme;
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onAnswer('cancel'); return true; });
    return () => subscription.remove();
  }, [onAnswer]);
  return h(View, { key: 'consent', style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, elevation: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 } },
    h(Pressable, { accessibilityRole: 'button', accessibilityLabel: '팝업 닫기', onPress: () => onAnswer('cancel'), style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' } }),
    h(View, { accessibilityViewIsModal: true, style: { width: '100%', maxWidth: 320, borderRadius: 20, backgroundColor: t.card, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 18, ...t.shadow } },
      h(Text, { accessibilityRole: 'header', style: { fontSize: 17, lineHeight: 24, fontWeight: '800', color: t.text, textAlign: 'center' } }, COMBO_CONSENT_TITLE),
      name ? h(Text, { numberOfLines: 1, style: { marginTop: 8, fontSize: 14, fontWeight: '700', color: t.accentText, textAlign: 'center' } }, name) : null,
      h(Text, { style: { marginTop: 8, fontSize: 13, lineHeight: 19, color: t.sub, textAlign: 'center' } }, COMBO_CONSENT_BODY),
      h(Pressable, {
        accessibilityRole: 'button', accessibilityLabel: '안내 받기', onPress: () => onAnswer('agree'),
        style: ({ pressed }: { pressed: boolean }): import('react-native').ViewStyle => ({ marginTop: 18, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent, opacity: pressed ? 0.85 : 1 }),
      }, h(Text, { style: { fontSize: 16, fontWeight: '800', color: t.text } }, '안내 받기')),
      h(Pressable, {
        accessibilityRole: 'button', accessibilityLabel: '괜찮아요', onPress: () => onAnswer('decline'),
        style: ({ pressed }: { pressed: boolean }): import('react-native').ViewStyle => ({ marginTop: 8, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.chipBg ?? '#F2F4F6', opacity: pressed ? 0.85 : 1 }),
      }, h(Text, { style: { fontSize: 15, fontWeight: '700', color: t.sub } }, '괜찮아요'))));
}

// ---- the member's own list ------------------------------------------------------------------------------------------

export type ComboTrialsScreenProps = {
  items: MyTrial[] | null;
  loading?: boolean;
  /** true when the list could not be loaded (a network or body problem) */
  failed?: boolean;
  theme?: ComboTheme;
  /** a campaign to put first and highlight (the push's `campaignKey`) */
  focusKey?: string;
  onClose: () => void;
  /** a row was tapped: open that campaign's detail page */
  onOpen: (trial: MyTrial) => void;
  /** 「했어요」 (true) or 「아직」 (false) was tapped on a row */
  onCancelled: (trial: MyTrial, cancelled: boolean) => void;
  onRetry?: () => void;
};

const BADGE: Record<MyTrialStatus, { bg: string; fg: string }> = {
  '체험 중': { bg: '#FFF0C7', fg: '#9A5B0E' },
  '지금 해지 가능': { bg: '#FFE4D6', fg: '#C2410C' },
  '결제 시작됨': { bg: '#F2F4F6', fg: '#6B7684' },
};

/** 「무료체험 확인」: the member's free trials, one row each, newest first (the pushed one first, highlighted). */
export function ComboTrialsScreen({ items, loading = false, failed = false, theme = DEFAULT_COMBO_THEME, focusKey, onClose, onOpen, onCancelled, onRetry }: ComboTrialsScreenProps): ReactElement {
  const React = require('react') as typeof import('react');
  const { View, Text, Pressable, ScrollView, BackHandler } = require('react-native') as typeof import('react-native');
  const h = React.createElement;
  const t = theme;
  const side = 20;
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [onClose]);
  const list = items ?? [];
  const focus = focusKey ? focusKey.toLowerCase() : '';
  const rows = focus ? [...list.filter(x => x.campaignKey.toLowerCase() === focus), ...list.filter(x => x.campaignKey.toLowerCase() !== focus)] : list;
  const pill = (label: string, onPress: () => void, strong = false) => h(Pressable, {
    key: label, accessibilityRole: 'button', accessibilityLabel: label, onPress, hitSlop: 6,
    style: { height: 30, paddingHorizontal: 14, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: strong ? t.accent : (t.chipBg ?? '#F2F4F6') },
  }, h(Text, { style: { fontSize: 13, fontWeight: '800', color: strong ? t.text : t.sub } }, label));
  const row = (trial: MyTrial, index: number): ReactElement => {
    const focused = !!focus && trial.campaignKey.toLowerCase() === focus;
    const line = myTrialLine(trial);
    const badge = trial.status ? BADGE[trial.status] : null;
    return h(Pressable, {
      key: trial.campaignKey, accessibilityRole: 'button',
      accessibilityLabel: `${trial.name}, ${trial.status ?? '무료체험'}${line ? `, ${line}` : ''}${trial.cancelled === true ? ', 해지 완료' : ''}`,
      onPress: () => onOpen(trial),
      style: ({ pressed }: { pressed: boolean }): import('react-native').ViewStyle => ({
        paddingVertical: 14, paddingHorizontal: side, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: t.line,
        backgroundColor: focused ? t.accentSoft : pressed ? '#F7F8FA' : 'transparent',
      }),
    },
      h(View, { style: { flexDirection: 'row', alignItems: 'center' } },
        h(ComboMissionIcon, { name: trial.name, uri: trial.icon, size: 40, theme: t }),
        h(View, { style: { flex: 1, minWidth: 0, marginLeft: 12 } },
          h(Text, { numberOfLines: 1, ellipsizeMode: 'tail', style: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: t.text } }, trial.name),
          line ? h(Text, { numberOfLines: 1, ellipsizeMode: 'tail', style: { marginTop: 1, fontSize: 12.5, lineHeight: 18, color: t.sub } }, line) : null),
        badge ? h(View, { style: { marginLeft: 8, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: badge.bg } },
          h(Text, { style: { fontSize: 12, fontWeight: '800', color: badge.fg } }, trial.status)) : null),
      trial.cancelled === true
        ? h(Text, { style: { marginTop: 10, fontSize: 13, fontWeight: '800', color: t.accentText } }, '해지 완료 ✓')
        : asksCancelled(trial)
          ? h(View, { style: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 } },
            h(Text, { style: { flex: 1, fontSize: 13, fontWeight: '700', color: t.text } }, trial.cancelled === false ? '해지했나요? (아직이라고 하셨어요)' : '해지했나요?'),
            pill('했어요', () => onCancelled(trial, true), true), pill('아직', () => onCancelled(trial, false)))
          : trial.status === '체험 중' && trial.cancelFrom
            ? h(Text, { style: { marginTop: 8, fontSize: 12.5, color: t.sub } }, `${monthDay(trial.cancelFrom)}부터 해지할 수 있어요`)
            : null);
  };
  return h(View, { style: { flex: 1, backgroundColor: t.bg } },
    h(View, { style: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: side } },
      h(Text, { accessibilityRole: 'header', style: { fontSize: 18, fontWeight: '700', color: t.text } }, COMBO_TRIALS_NAME),
      h(Pressable, { accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: onClose, hitSlop: 12, style: { paddingVertical: 8, paddingLeft: 8 } },
        h(Text, { style: { fontSize: 14, fontWeight: '600', color: t.sub } }, '닫기'))),
    h(ScrollView, { contentContainerStyle: { paddingBottom: 32 } },
      h(Text, { style: { paddingHorizontal: side, paddingTop: 4, paddingBottom: 10, fontSize: 13, lineHeight: 19, color: t.sub } },
        '참여한 무료체험이에요. 해지할 수 있는 때가 지나면 해지했는지 물어봐요.'),
      loading && !rows.length ? h(Text, { style: { marginTop: 40, fontSize: 15, textAlign: 'center', color: t.sub } }, '불러오고 있어요') : null,
      !loading && failed && !rows.length ? h(View, { style: { marginTop: 40, alignItems: 'center' } },
        h(Text, { style: { fontSize: 15, lineHeight: 22, textAlign: 'center', color: t.sub } }, '목록을 불러오지 못했어요.\n잠시 뒤에 다시 해 주세요.'),
        onRetry ? h(View, { style: { marginTop: 14 } }, pill('다시 불러오기', onRetry)) : null) : null,
      !loading && !failed && !rows.length ? h(Text, { style: { marginTop: 40, paddingHorizontal: side, fontSize: 15, lineHeight: 22, textAlign: 'center', color: t.sub } },
        '아직 참여한 무료체험이 없어요.\n「포인트 빨리 모으기」의 「무료체험」 탭에서 골라 보세요.') : null,
      rows.map(row)));
}
