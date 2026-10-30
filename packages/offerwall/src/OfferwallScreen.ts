import type { ReactElement } from 'react';
import { OfferwallView } from './index';
import { getChanceSheetOpen, notifyWallGone, notifyWallLoaded, onChanceSheetOpen, setChanceTab, setChanceTabInset } from './wallSignal';
import { ADPOPCORN_PROVIDER_ID, isClosedProvider as isClosed, useChanceProviders, type ChanceProvider } from './chanceProviders';

/** 「찬스2」 같은 전체 화면 제공자 칸의 글. 앱이 `launcherCopy` 로 일부만 바꿀 수 있다. */
export type LauncherCopy = { title: string; body: string; open: string; retry: string; error: string };
export const DEFAULT_LAUNCHER_COPY: LauncherCopy = {
  title: '참여하고 보상 받기', body: '여러 가지 참여형 광고를 보고 보상을 받아 보세요.', open: '찬스 열기', retry: '다시 열기', error: '잠시 후 다시 시도해 주세요',
};

export type OfferwallScreenProps = {
  usn: string | null;
  onClose: () => void;
  onRetry: () => void;
  loadingColor?: string;
  /** Only pass a top inset when the host has not already applied its safe area. */
  topInset?: number;
  /** 0.5.0 — 쓸 수 있는 제공자가 둘 이상일 때만 위쪽에 「찬스1 · 찬스2」 탭이 생긴다(하나뿐이면 예전 화면 그대로). 선택된 탭 글자 · 밑줄 색. */
  tabColor?: string;
  /** 0.5.0 — 탭 아래 작은 글씨로 제공자 이름을 보인다. 기본 꺼짐(이용자에게는 「찬스1 · 찬스2」만). */
  showProviderNames?: boolean;
  /** 0.5.0 — 전체 화면 제공자 탭을 누르면 바로 연다(기본 true). false 면 칸의 「찬스 열기」 단추를 눌러야 열린다. */
  autoOpenLauncher?: boolean;
  /** 0.5.0 — 제공자에 알려 줄 화면 표시 이름(선택). 닉네임이 드러나면 안 되면 가려서(우리****) 준다. */
  displayName?: string;
  launcherCopy?: Partial<LauncherCopy>;
};

export const OFFERWALL_SCREEN_MARK = 'jcurve-offerwall-screen:headerless-v1';
/** 0.5.0 번들 표식 — 배포 검사가 「찬스1 · 찬스2 탭이 들어 있는 판」인지 문자열로 본다. */
export const OFFERWALL_CHANCE_TABS_MARK = 'jcurve-offerwall-chance-tabs:v1';
/** Until the tab row has been measured, its height is taken as this (44 minHeight + the 1px border + the 2px selected line fits inside the 44). */
export const CHANCE_TAB_FALLBACK_HEIGHT = 45;

/** How long the AdPopcorn wall may take to report that it has loaded before the screen says 「찬스를 불러오지 못했어요」. */
export const CLASSIC_WALL_TIMEOUT_MS = 20000;
/**
 * 0.6.4 — when the 20 s load timer may run: only with a member (`usn`) to load for, only while the wall is on screen (not behind the other 찬스 tab), only while it has neither
 * loaded nor failed. With no member yet, or while the wall is hidden, nothing is wrong with the wall, so the clock is stopped; it starts again from zero when the member arrives
 * or the wall is shown. (Before, the clock ran through both and the error screen could appear before the wall ever had a chance.)
 */
export function wallTimerShouldRun({ usn, hidden, loaded, error }: { usn: string | null; hidden: boolean; loaded: boolean; error: boolean }): boolean {
  return !!usn && !hidden && !loaded && !error;
}
/**
 * 0.6.4 — the wall is shown again and is in the error state (it failed, or its load could not be told while it was hidden): try once on its own. At most one automatic
 * try per error (`retried`: set by it and by the 「다시 시도」 button, cleared by a successful load or a new member); after that only the button retries.
 */
export function wallAutoRetryOnShow({ wasHidden, hidden, error, retried }: { wasHidden: boolean; hidden: boolean; error: boolean; retried: boolean }): boolean {
  return wasHidden && !hidden && error && !retried;
}

type ClassicProps = Pick<OfferwallScreenProps, 'usn' | 'onClose' | 'onRetry' | 'loadingColor' | 'topInset'> & { hidden?: boolean };

/** The 0.2.3 screen (AdPopcorn wall) as it was. `hidden` only keeps it mounted but out of sight while another tab is up. */
function ClassicScreen({ usn, onClose, onRetry, loadingColor = '#555', topInset = 0, hidden = false }: ClassicProps): ReactElement {
  const React = require('react') as typeof import('react');
  const { View, Text, Pressable, ActivityIndicator, BackHandler } = require('react-native') as typeof import('react-native');
  const h = React.createElement;
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const hiddenNow = React.useRef(hidden);
  hiddenNow.current = hidden;
  const wasHidden = React.useRef(hidden);
  const retried = React.useRef(false); // 0.6.4: the one automatic try for this error has been used (or the button was pressed)
  React.useEffect(() => { retried.current = false; }, [usn]);
  React.useEffect(() => { setLoaded(false); setError(false); notifyWallGone(); }, [usn, attempt]);
  React.useEffect(() => () => notifyWallGone(), []);
  // The wall sits beside 「포인트 빨리 모으기」(OfferwallCombos), which follows this signal: while another tab is up, the wall is "gone".
  React.useEffect(() => { if (hidden) notifyWallGone(); else if (loaded) notifyWallLoaded(); }, [hidden, loaded]);
  // 0.6.4: the load timer runs only with a member and while the wall is shown (see wallTimerShouldRun); hiding it or losing the member stops it, showing it starts it over.
  React.useEffect(() => {
    if (!wallTimerShouldRun({ usn, hidden, loaded, error })) return;
    const timer = setTimeout(() => setError(true), CLASSIC_WALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loaded, usn, attempt, hidden, error]);
  React.useEffect(() => { if (loaded) { setError(false); retried.current = false; } }, [loaded]);
  // 0.6.4: back from the other tab onto a failed wall: one automatic try (a loaded wall is left alone: it is never reloaded for being hidden).
  React.useEffect(() => {
    const again = wallAutoRetryOnShow({ wasHidden: wasHidden.current, hidden, error, retried: retried.current });
    wasHidden.current = hidden;
    if (again) { retried.current = true; setAttempt(n => n + 1); }
  }, [hidden]);
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [onClose]);
  const status = { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 16 };
  return h(View, { style: { flex: 1, backgroundColor: '#fff', paddingTop: Math.max(0, topInset), ...(hidden ? { display: 'none' as const } : {}) } },
    h(View, { style: { flex: 1, overflow: 'hidden' } },
      usn && !error ? h(OfferwallView, { key: `${usn}:${attempt}`, usn, onLoaded: () => { setLoaded(true); if (!hiddenNow.current) notifyWallLoaded(); }, onError: () => setError(true) }) : null,
      error ? h(View, { style: [status, { backgroundColor: '#fff' }] },
        h(Text, null, '찬스를 불러오지 못했어요'),
        h(Pressable, { accessibilityRole: 'button', onPress: () => { retried.current = true; setAttempt(n => n + 1); onRetry(); },
          style: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#f1f1f1', borderRadius: 12 } }, h(Text, null, '다시 시도')))
        : !loaded ? h(View, { style: status, pointerEvents: 'none' }, h(ActivityIndicator, { color: loadingColor })) : null));
}

type Launch = { state: 'idle' | 'opening' | 'embedded' | 'error'; message: string };
const IDLE: Launch = { state: 'idle', message: '' };

/**
 * Tab content: no host header. The host owns status-bar and bottom-tab safe areas.
 *
 * 0.5.0 — 찬스 제공자(`chanceProviders()`)가 둘 이상이면 위쪽에 「찬스1 · 찬스2」 탭이 생긴다: 1 = 이 화면(애드팝콘), 2 = 스냅플레이처럼 전체 화면을 여는 SDK(탭을 누르면 열고,
 * 닫고 돌아오면 「다시 열기」 칸이 보인다). 쓸 수 있는 제공자가 하나뿐이면(스냅플레이 모듈이 없는 옛 빌드 · 서버 설정이 아직 없음) 탭도 오류도 없이 예전 화면 그대로다.
 * 애드팝콘 화면은 탭을 오가도 다시 불러오지 않고 그대로 둔다(숨기기만).
 */
export function OfferwallScreen({ usn, onClose, onRetry, loadingColor, topInset = 0, tabColor = '#222', showProviderNames = false, autoOpenLauncher = true, displayName, launcherCopy }: OfferwallScreenProps): ReactElement {
  const React = require('react') as typeof import('react');
  const { View, Text, Pressable, ActivityIndicator } = require('react-native') as typeof import('react-native');
  const h = React.createElement;
  const providers = useChanceProviders();
  const [picked, setPicked] = React.useState<string>(ADPOPCORN_PROVIDER_ID);
  const [launch, setLaunch] = React.useState<Launch>(IDLE);
  const [tabHeight, setTabHeight] = React.useState(0);
  // 0.6.6: while a 「포인트 빨리 모으기」 sheet is open the 찬스2 panel (the embedded SnapPlay view) is shielded from touches. Subscribe, then read what is already there — the entry
  // next to this screen may have set it before this subscription existed.
  const [sheetUp, setSheetUp] = React.useState(getChanceSheetOpen);
  React.useEffect(() => { setSheetUp(getChanceSheetOpen()); return onChanceSheetOpen(setSheetUp); }, []);
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const copy: LauncherCopy = { ...DEFAULT_LAUNCHER_COPY, ...launcherCopy };

  const tabs = providers.length >= 2;
  const current: ChanceProvider | undefined = providers.find((provider) => provider.id === picked) ?? providers[0];
  const launcher = tabs && current?.kind === 'launcher' ? current : undefined;
  const ids = providers.map((provider) => provider.id).join('|');

  // Tell the combos chip how far down the tab row pushes the wall (the chip is drawn by the app beside this screen).
  React.useEffect(() => { setChanceTabInset(tabs ? tabHeight || CHANCE_TAB_FALLBACK_HEIGHT : 0); }, [tabs, tabHeight]);
  React.useEffect(() => () => setChanceTabInset(0), []);
  // 0.6.2: tell 「포인트 빨리 모으기」 (ComboEntry, drawn by the app beside this screen) which tab is up, so each tab shows its own list.
  const tabId = tabs && current ? current.id : ADPOPCORN_PROVIDER_ID;
  React.useEffect(() => { setChanceTab(tabId); }, [tabId]);
  React.useEffect(() => () => setChanceTab(ADPOPCORN_PROVIDER_ID), []);

  // Warm the launchers up (SDK init, member) while the member is still on 찬스1, so 찬스2 opens at once. A failure here changes nothing on screen.
  React.useEffect(() => {
    if (!usn || !tabs) return;
    for (const provider of providers) if (provider.kind === 'launcher' && !isClosed(provider)) Promise.resolve(provider.prepare?.({ usn, displayName })).catch(() => {});
  }, [usn, displayName, ids]);

  const open = (provider: ChanceProvider) => {
    if (!usn || !provider.open) { setLaunch({ state: 'error', message: copy.error }); return; }
    setLaunch({ state: 'opening', message: '' });
    // 0.6.0: a build that has the provider's in-tab view shows it inside the tab (under the tab row, above the app's menu); older builds open the full-screen modal.
    if (provider.embed && provider.canEmbed?.()) {
      Promise.resolve(provider.prepare?.({ usn, displayName }))
        .then((result) => { if (alive.current) setLaunch(result && result.ok === false ? { state: 'error', message: result.message || copy.error } : { state: 'embedded', message: '' }); })
        .catch(() => { if (alive.current) setLaunch({ state: 'error', message: copy.error }); });
      return;
    }
    Promise.resolve(provider.open({ usn, displayName }))
      .then((result) => { if (alive.current) setLaunch(result.ok ? IDLE : { state: 'error', message: result.message || copy.error }); })
      .catch(() => { if (alive.current) setLaunch({ state: 'error', message: copy.error }); });
  };
  const pick = (provider: ChanceProvider) => {
    if (provider.id === current?.id) return;
    setPicked(provider.id);
    setLaunch(IDLE);
    if (provider.kind === 'launcher' && autoOpenLauncher && !isClosed(provider)) open(provider);
  };

  const tabBar = !tabs ? null : h(View, { accessibilityRole: 'tablist', onLayout: (event: { nativeEvent?: { layout?: { height?: number } } }) => { const height = event?.nativeEvent?.layout?.height; if (typeof height === 'number' && height > 0) setTabHeight(Math.round(height)); },
    style: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' } },
    providers.map((provider, index) => {
      const selected = provider.id === current?.id;
      const label = `찬스${index + 1}`;
      return h(Pressable, { key: provider.id, accessibilityRole: 'tab', accessibilityState: { selected }, accessibilityLabel: label, onPress: () => pick(provider),
        style: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: selected ? tabColor : 'transparent' } },
        h(Text, { style: { fontSize: 15, fontWeight: selected ? '700' : '500', color: selected ? tabColor : '#999' } }, label),
        showProviderNames ? h(Text, { style: { fontSize: 11, color: selected ? tabColor : '#aaa' } }, provider.name) : null);
    }));

  const backToFirst = () => { setPicked(ADPOPCORN_PROVIDER_ID); setLaunch(IDLE); };
  const embedded = launcher && launch.state === 'embedded' && launcher.embed ? launcher.embed({ onClose: backToFirst }) : null;
  const shield = sheetUp ? { pointerEvents: 'none' as const } : {};
  // 0.6.8: a closed launcher (찬스2 for a member not on the server's list) shows only 「준비 중입니다」 — nothing is prepared, opened or listed.
  const panel = !launcher ? null : isClosed(launcher) ? h(View, { style: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: '#fff' } },
    h(Text, { accessibilityRole: 'text', style: { fontSize: 16, fontWeight: '700', color: '#666', textAlign: 'center' } }, '찬스2는 우선 준비 중입니다')) : embedded ? h(View, { style: { flex: 1, backgroundColor: '#fff' }, ...shield }, embedded) : h(View, { style: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12, backgroundColor: '#fff' }, ...shield },
    h(Text, { style: { fontSize: 18, fontWeight: '700', color: '#222', textAlign: 'center' } }, copy.title),
    h(Text, { style: { fontSize: 14, color: '#666', textAlign: 'center' } }, copy.body),
    launch.state === 'error' ? h(Text, { style: { fontSize: 13, color: '#c0392b', textAlign: 'center' } }, launch.message) : null,
    launch.state === 'opening' ? h(ActivityIndicator, { color: loadingColor ?? '#555' })
      : h(Pressable, { accessibilityRole: 'button', accessibilityLabel: launch.state === 'error' ? copy.retry : copy.open, onPress: () => open(launcher),
        style: { paddingHorizontal: 28, paddingVertical: 13, backgroundColor: tabColor, borderRadius: 12 } },
        h(Text, { style: { fontSize: 15, fontWeight: '700', color: '#fff' } }, launch.state === 'error' ? copy.retry : copy.open)));

  return h(View, { style: { flex: 1, backgroundColor: '#fff', paddingTop: Math.max(0, topInset) } },
    tabBar,
    h(ClassicScreen, { usn, onClose, onRetry, loadingColor, topInset: 0, hidden: launcher !== undefined }),
    panel);
}
