/** Ways into the combo guide: Chance-tab card, Home banner, and a route that popups / pushes / deep links can fire. */
import type { ReactElement } from 'react';
import { formatGoal, TodayComboCard, TodayComboScreen, useTodayCombos } from './combos';
import type { ComboBundle, ComboMission, TodayCombos } from './combos';

/** Route name shared by server popups, pushes and links. Apps use in-app actions, not a URL scheme. */
export const COMBOS_ROUTE = 'offerwall/combos';
/** Accepts 'offerwall/combos', '/offerwall/combos?from=push' and 'myapp://offerwall/combos'. */
export function isCombosRoute(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const path = value.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^\/+/, '').split(/[?#]/)[0].replace(/\/+$/, '');
  return path === COMBOS_ROUTE;
}

type Opener = { priority: number; open(): void };
const openers = new Set<Opener>();
let waitingSince = 0;
const WAIT_MS = 10000;

/**
 * Opens the guide from anywhere (popup button, push tap, link). If no entry is mounted yet, for example while the app
 * switches tabs, the request waits up to 10 seconds for the first one that mounts. Returns true when an entry took it.
 */
export function requestOpenCombos(now: number = Date.now()): boolean {
  let target: Opener | undefined;
  // Ties go to the most recently mounted one: a screen that just appeared is the likelier one on display.
  for (const opener of openers) if (!target || opener.priority >= target.priority) target = opener;
  if (!target) { waitingSince = now; return false; }
  waitingSince = 0;
  target.open();
  return true;
}
/** Chance tab (2) wins over Home (1) so one request never opens two screens. */
export function listenForComboRequests(opener: Opener, now: number = Date.now()): () => void {
  openers.add(opener);
  const waiting = waitingSince && now - waitingSince <= WAIT_MS;
  waitingSince = 0;
  if (waiting) opener.open();
  return () => { openers.delete(opener); };
}

export type TodayComboBannerProps = { combos: TodayCombos; onPress: () => void; accentColor?: string };
/** One-line strip for Home or the top of the Chance tab. */
export function TodayComboBanner({ combos, onPress, accentColor = '#3478f6' }: TodayComboBannerProps): ReactElement {
  const React = require('react') as typeof import('react');
  const { View, Text, Pressable } = require('react-native') as typeof import('react-native');
  const h = React.createElement;
  const goals = combos.bundles.map(b => formatGoal(b.goal)).join(' · ');
  return h(Pressable, {
    accessibilityRole: 'button',
    accessibilityLabel: `오늘의 포인트 조합, ${goals} 목표별로 보기`,
    onPress,
    style: ({ pressed }: { pressed: boolean }): import('react-native').ViewStyle => ({
      marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
      flexDirection: 'row', alignItems: 'center', backgroundColor: accentColor + '14', opacity: pressed ? 0.85 : 1,
    }),
  },
    h(View, { style: { flex: 1 } },
      h(Text, { style: { fontSize: 14, fontWeight: '700', color: '#111' } }, '오늘의 포인트 조합'),
      h(Text, { numberOfLines: 1, style: { marginTop: 2, fontSize: 12, color: '#6b7280' } }, `${goals} 목표별로 골라 놨어요`)),
    h(Text, { style: { fontSize: 13, fontWeight: '700', color: accentColor } }, '보기 ›'));
}

export type TodayComboEntryProps = {
  placement: 'chance' | 'home';
  /** Combos API address. Without it nothing shows unless `sample` is true. */
  url?: string;
  headers?: Record<string, string>;
  usn?: string | null;
  accentColor?: string;
  /** Screen work only: shows fixed example rows. Never set this in a release. */
  sample?: boolean;
  /** Opens one item. Without it, `usn` opens the whole list (the SDK cannot jump to one item). */
  onPressMission?: (mission: ComboMission, bundle: ComboBundle) => void;
};
/**
 * Mount once in the Chance tab (above the wall list) and, if wanted, once on Home. The server picks what each shows
 * through `display`. The guide opens over the current screen, so popup / push / link entries work from any tab.
 */
export function TodayComboEntry({ placement, url, headers, usn, accentColor, sample = false, onPressMission }: TodayComboEntryProps): ReactElement | null {
  const React = require('react') as typeof import('react');
  const { Modal, SafeAreaView } = require('react-native') as typeof import('react-native');
  const h = React.createElement;
  const state = useTodayCombos({ url, headers, sample });
  const [open, setOpen] = React.useState(false);
  const mode = placement === 'chance' ? state.combos?.display.chance ?? 'card' : state.combos?.display.home ?? 'off';
  // The Chance tab always listens, so a popup keeps working even if the server hides its card. Home only when its banner is on.
  const listening = placement === 'chance' || mode !== 'off';
  React.useEffect(
    () => listening ? listenForComboRequests({ priority: placement === 'chance' ? 2 : 1, open: () => setOpen(true) }) : undefined,
    [listening, placement]);
  const close = () => setOpen(false);
  const show = () => setOpen(true);
  const entry = state.combos && mode === 'card' ? h(TodayComboCard, { combos: state.combos, onPress: show, accentColor })
    : state.combos && mode === 'banner' ? h(TodayComboBanner, { combos: state.combos, onPress: show, accentColor })
    : null;
  if (!entry && !open) return null;
  return h(React.Fragment, null, entry,
    open ? h(Modal, { visible: true, animationType: 'slide', onRequestClose: close },
      h(SafeAreaView, { style: { flex: 1, backgroundColor: '#f5f6f8' } },
        h(TodayComboScreen, { combos: state.combos, loading: state.status === 'loading', onClose: close, onPressMission, usn, accentColor }))) : null);
}
