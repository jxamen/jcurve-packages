/** 「포인트 빨리 모으기」 — daily point combos. Pure JS (OTA-safe); it only shows server data and never grants points. */
import type { ReactElement } from 'react';
import { openOfferwall } from './index';

/** The one place the feature's name lives (chip, Home banner, guide title, labels, popup text). */
export const COMBO_NAME = '포인트 빨리 모으기';

export type ComboLevel = 'easy' | 'normal' | 'hard';
/** One mission row = one real campaign. `campaignKey` is optional: when the server knows it, the app opens that campaign directly. */
export type ComboMission = {
  id: string; name: string; points: number; todo: string; level: ComboLevel; minutes?: number; campaignKey?: string;
  /** The campaign's icon (https URL from the server, `icon`). Without it the row shows the first letter of the name. */
  icon?: string;
};
export type ComboBundle = { goal: number; missions: ComboMission[]; total: number };
/** Missions that reach `goal` on their own ("한 번에 끝내기"), mixed kinds. Several to choose from, any one is enough. */
export type ComboSingles = { goal: number; missions: ComboMission[] };
/** Server switches. chance: the floating chip in the Chance tab; home: the optional banner on Home. */
export type ComboDisplay = {
  chance: 'chip' | 'off'; home: 'banner' | 'off';
  /**
   * `chance_popup` from the server: 'off' turns the recommendation popup off, 'always' shows it on every direct entry to the Chance tab
   * (test accounts: no once-a-day limit, the "guide already opened today" mark is ignored). Absent or 'on' = once a day.
   */
  popup?: 'off' | 'always';
};
/** 「쉽게 모으기」: short, easy missions (follow, subscribe, install and open) with no goal; `total` is the sum of their points. */
export type ComboEasy = { missions: ComboMission[]; total: number };
export type TodayCombos = {
  date?: string; display: ComboDisplay; bundles: ComboBundle[];
  /** absent when the server sent none: the 「한 번에 끝내기」 box is then hidden */
  singles?: ComboSingles[];
  /** absent when the server sent none: the 「쉽게 모으기」 tab is then hidden */
  easy?: ComboEasy;
};
/** Name of the tab that lists only easy missions, before the 1천 → 5천 → 1만P steps. */
export const COMBO_EASY_NAME = '쉽게 모으기';

const LEVELS: readonly ComboLevel[] = ['easy', 'normal', 'hard'];
export const COMBO_LEVEL_LABEL: Record<ComboLevel, string> = { easy: '쉬움', normal: '보통', hard: '조금 걸려요' };

const text = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '';
/** Whole number in 1..max, else 0. The cap keeps hostile values from producing sums that are no longer exact. */
const whole = (v: unknown, max: number = 100_000_000): number => {
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= max ? n : 0;
};
const MAX_POINTS = 10_000_000;

/** One mission row from the server, checked; null when it cannot be shown (no id, name or points). */
function cleanMission(m: any): ComboMission | null {
  const id = text(typeof m?.id === 'number' ? String(m.id) : m?.id, 64);
  const name = text(m?.name, 40);
  const points = whole(m?.points, MAX_POINTS);
  if (!id || !name || !points) return null;
  const minutes = whole(m.minutes);
  const campaignKey = text(m.campaignKey ?? m.campaign_key, 64);
  const iconUrl = text(m.icon ?? m.icon_url ?? m.iconUrl, 500);
  const icon = /^https:\/\/\S+$/i.test(iconUrl) ? iconUrl : ''; // https only: no http, data: or script URLs from the network
  return {
    id, name, points, todo: text(m.todo, 80),
    level: LEVELS.includes(m.level) ? m.level : 'normal',
    ...(minutes && minutes <= 120 ? { minutes } : {}),
    ...(campaignKey ? { campaignKey } : {}),
    ...(icon ? { icon } : {}),
  };
}

/** Keeps only well-formed rows; totals are recomputed so the screen never shows a sum the rows do not add up to. */
export function normalizeTodayCombos(raw: unknown): TodayCombos | null {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, any>) : null;
  if (!data || !Array.isArray(data.bundles)) return null;
  const bundles: ComboBundle[] = [];
  const goals = new Set<number>();
  // Look through the first 40 entries and keep the first valid bundle per goal, at most 4 (the server may send alternatives).
  for (const item of data.bundles.slice(0, 40)) {
    if (bundles.length >= 4) break;
    const goal = whole(item?.goal);
    if (!goal || goals.has(goal) || !Array.isArray(item.missions)) continue;
    const ids = new Set<string>();
    const missions: ComboMission[] = [];
    for (const m of item.missions.slice(0, 40)) {
      if (missions.length >= 12) break;
      const mission = cleanMission(m);
      if (!mission || ids.has(mission.id)) continue;
      ids.add(mission.id);
      missions.push(mission);
    }
    const total = missions.reduce((sum, m) => sum + m.points, 0);
    // A bundle titled by its goal must reach it; a short one would be a wrong promise on screen.
    if (!missions.length || total < goal) continue;
    goals.add(goal);
    bundles.push({ goal, missions, total });
  }
  if (!bundles.length) return null;
  bundles.sort((a, b) => a.goal - b.goal);
  const date = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : undefined;
  // Unknown or missing switches fall back to: chip in the Chance tab, nothing on Home.
  const display: ComboDisplay = {
    chance: data.display?.chance === 'off' ? 'off' : 'chip',
    home: data.display?.home === 'banner' ? 'banner' : 'off',
    // `chance_popup` is the server's spelling; `popup` is what normalizing keeps, so running this twice gives the same result
    ...(() => {
      const mode = data.display?.chance_popup ?? data.display?.popup;
      return mode === 'off' || mode === 'always' ? { popup: mode as 'off' | 'always' } : {};
    })(),
  };
  const singles = cleanSingles(data.singles, goals);
  const easy = cleanEasy(data.easy);
  return { ...(date ? { date } : {}), display, bundles, ...(singles.length ? { singles } : {}), ...(easy ? { easy } : {}) };
}

/**
 * `easy`: { missions: [...], total_points }. Any points count (a follow may give 100P). At most 20 different missions;
 * the total is recomputed from what is kept, the server's own number is never shown.
 */
function cleanEasy(raw: unknown): ComboEasy | null {
  const list = (raw as { missions?: unknown } | null)?.missions;
  if (!Array.isArray(list)) return null;
  const ids = new Set<string>();
  const missions: ComboMission[] = [];
  for (const m of list.slice(0, 60)) {
    if (missions.length >= 20) break;
    const mission = cleanMission(m);
    if (!mission || ids.has(mission.id)) continue;
    ids.add(mission.id);
    missions.push(mission);
  }
  return missions.length ? { missions, total: missions.reduce((sum, m) => sum + m.points, 0) } : null;
}

/**
 * `singles`: missions that reach a goal on their own, grouped by goal. The server sends entries like
 * { goal, missions: [one mission] }, several per goal, in mixed kinds. A single only counts when its own points reach the
 * goal (otherwise "한 번에 끝내기" would be a wrong promise), goals without a bundle step are dropped (nowhere to show them),
 * and each goal keeps at most 6 different missions.
 */
function cleanSingles(raw: unknown, bundleGoals: ReadonlySet<number>): ComboSingles[] {
  if (!Array.isArray(raw)) return [];
  const byGoal = new Map<number, ComboMission[]>();
  for (const entry of raw.slice(0, 60)) {
    const goal = whole(entry?.goal);
    if (!goal || !bundleGoals.has(goal) || !Array.isArray(entry.missions)) continue;
    const list = byGoal.get(goal) ?? [];
    for (const m of entry.missions.slice(0, 12)) {
      const mission = cleanMission(m);
      if (!mission || mission.points < goal || list.length >= 6 || list.some(x => x.id === mission.id)) continue;
      list.push(mission);
    }
    if (list.length) byGoal.set(goal, list);
  }
  return [...byGoal.entries()].sort((a, b) => a[0] - b[0]).map(([goal, missions]) => ({ goal, missions }));
}

/** Calendar date in Korea (the daily reset), YYYY-MM-DD. */
export function kstDate(now: number = Date.now()): string {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
/** Yesterday's combos must not be shown as today's, so a body without a date counts as stale too. */
export function isTodayCombos(combos: TodayCombos, now: number = Date.now()): boolean {
  return combos.date === kstDate(now);
}
/** Milliseconds until the next 00:00 in Korea. */
export function msUntilKstMidnight(now: number = Date.now()): number {
  const day = 24 * 3600 * 1000;
  return day - ((now + 9 * 3600 * 1000) % day);
}

export function formatPoints(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}P`;
}
export type ComboPopupContent = {
  /** headline pieces: `before` + big `amount` + `after`, e.g. 「오늘 」 「+5,965P」 「 모을 수 있어요」 */
  before: string; amount: string; after: string;
  /** one line under it, e.g. 「쉬운 미션 18개 · 하나에 3분이면 끝」 */
  sub: string;
};
/**
 * What the recommendation popup says, from the server's combos: the easy missions' sum as the big number (else the top goal), and
 * how many easy missions there are, with how long one takes when the server gave minutes (the middle value, so one odd mission does not decide it).
 */
export function comboPopupContent(combos: TodayCombos): ComboPopupContent {
  const easy = combos.easy;
  const top = combos.bundles.reduce((max, b) => Math.max(max, b.goal), 0);
  if (easy) {
    const minutes = easy.missions.map(m => m.minutes ?? 0).filter(n => n > 0).sort((a, b) => a - b);
    const typical = minutes.length ? minutes[Math.floor((minutes.length - 1) / 2)] : 0;
    return { before: '오늘 ', amount: `+${formatPoints(easy.total)}`, after: ' 모을 수 있어요', sub: `쉬운 미션 ${easy.missions.length}개${typical ? ` · 하나에 ${typical}분이면 끝` : ''}` };
  }
  const goals = combos.bundles.map(b => formatGoal(b.goal));
  const path = goals.map((g, i) => (i < goals.length - 1 ? g.replace(/P$/, '') : g)).join(' · ');
  return { before: '오늘 ', amount: top ? formatGoal(top) : '', after: '까지 모을 수 있어요', sub: path ? `${path} 길을 차례로 모아 보세요` : '' };
}

/** 1000 → 1천P, 5000 → 5천P, 10000 → 1만P, anything else → 1,500P */
export function formatGoal(goal: number): string {
  if (goal >= 10000 && goal % 10000 === 0) return `${goal / 10000}만P`;
  if (goal >= 1000 && goal < 10000 && goal % 1000 === 0) return `${goal / 1000}천P`;
  return formatPoints(goal);
}

/**
 * Look of the screens. The apps share one token family (`C` colors, `R` radii, `F` font sizes, `shadow`), so a host
 * passes `comboThemeFromTokens({ C, R, F, shadow })` and the pages match its own mission cards. The defaults are that
 * family's values, so an app without tokens still looks like the others.
 */
export type ComboTheme = {
  bg: string; card: string; line: string; divider: string; text: string; sub: string;
  accent: string; accentText: string; accentSoft: string; point: string; pointSoft: string;
  tag: string; tagText: string;
  /** Flat grey behind unselected tabs (default #F2F4F6, as in the shopping tab) and behind a loading icon. */
  chipBg?: string; thumbBg?: string;
  radius: { card: number; slot: number; chip: number };
  font: { title: number; head: number; body: number; small: number; tiny: number };
  shadow: Record<string, any>;
};
export const DEFAULT_COMBO_THEME: ComboTheme = {
  bg: '#FBF4E4', card: '#FFFFFF', line: '#F0E2C4', divider: '#E6D3AA', text: '#3A2A1A', sub: '#6B5842',
  accent: '#FFC23D', accentText: '#9A5B0E', accentSoft: '#FFF0C7', point: '#9A5B0E', pointSoft: '#FFF0C7',
  tag: '#EFF1FA', tagText: '#5B6BA8',
  radius: { card: 20, slot: 14, chip: 999 },
  font: { title: 22, head: 19, body: 16.5, small: 15, tiny: 13.5 },
  shadow: { shadowColor: '#3A2A1A', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
};
type TokenSet = { C?: Record<string, string>; R?: Record<string, number>; F?: Record<string, number>; shadow?: Record<string, any> };
/** Maps the family's `C`/`R`/`F`/`shadow` objects (tree → accent, treeDark → accentText, treeSoft → accentSoft). */
export function comboThemeFromTokens({ C, R, F, shadow }: TokenSet): ComboTheme {
  const d = DEFAULT_COMBO_THEME;
  const color = (key: string, fallback: string) => (typeof C?.[key] === 'string' ? C[key] : fallback);
  const size = (box: Record<string, number> | undefined, key: string, fallback: number) => (typeof box?.[key] === 'number' ? box[key] : fallback);
  return {
    bg: color('bg', d.bg), card: color('card', d.card), line: color('line', d.line), divider: color('divider', d.divider),
    text: color('text', d.text), sub: color('sub', d.sub),
    accent: color('tree', d.accent), accentText: color('treeDark', d.accentText), accentSoft: color('treeSoft', d.accentSoft),
    point: color('point', d.point), pointSoft: color('pointSoft', d.pointSoft),
    tag: d.tag, tagText: d.tagText,
    radius: { card: size(R, 'card', d.radius.card), slot: size(R, 'slot', d.radius.slot), chip: size(R, 'chip', d.radius.chip) },
    font: { title: size(F, 'title', d.font.title), head: size(F, 'head', d.font.head), body: size(F, 'body', d.font.body), small: size(F, 'small', d.font.small), tiny: size(F, 'tiny', d.font.tiny) },
    shadow: shadow ?? d.shadow,
  };
}

export type FetchCombosResult = { ok: true; combos: TodayCombos } | { ok: false; reason: 'network' | 'bad_response' | 'stale' };
type Fetcher = (url: string, init: { headers: Record<string, string>; signal?: any; cache?: any }) => Promise<{ ok: boolean; json(): Promise<any> }>;
export async function fetchTodayCombos({ url, headers = {}, timeoutMs = 8000, now, fetcher }: {
  url: string; headers?: Record<string, string>; timeoutMs?: number; now?: number; fetcher?: Fetcher;
}): Promise<FetchCombosResult> {
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const response = await (fetcher ?? (fetch as unknown as Fetcher))(url, { headers, signal: controller?.signal, cache: 'no-store' });
    if (!response.ok) return { ok: false, reason: 'bad_response' };
    return parseCombosBody(await response.json(), now);
  } catch { return { ok: false, reason: 'network' }; }
  finally { clearTimeout(timer); }
}
/** A response body (`{ok, combos}`, `{ok, data}` or the combos themselves) → checked combos for today. */
export function parseCombosBody(body: unknown, now?: number): FetchCombosResult {
  const data = body && typeof body === 'object' ? (body as Record<string, any>) : null;
  if (!data || data.ok === false) return { ok: false, reason: 'bad_response' };
  const combos = normalizeTodayCombos(data.combos ?? data.data ?? data);
  if (!combos) return { ok: false, reason: 'bad_response' };
  return isTodayCombos(combos, now) ? { ok: true, combos } : { ok: false, reason: 'stale' };
}
/**
 * Same as `fetchTodayCombos` but the app does the request with its own API function (auth, device and OTA headers,
 * 401 handling stay the app's). `load` resolves to the parsed JSON body; a throw counts as a network failure.
 */
export async function loadTodayCombos({ load, timeoutMs = 8000, now }: { load: () => Promise<unknown>; timeoutMs?: number; now?: number }): Promise<FetchCombosResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const body = await Promise.race([load(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); })]);
    return parseCombosBody(body, now);
  } catch { return { ok: false, reason: 'network' }; }
  finally { clearTimeout(timer); }
}

/**
 * Fixed data for building the screen before the API exists, in the shape of a real server response (one row = one
 * campaign, same id in several bundles when the same campaign fits). Only `sample: true` ever shows it.
 */
export const TODAY_COMBOS_SAMPLE: TodayCombos = {
  display: { chance: 'chip', home: 'banner' },
  bundles: [
    { goal: 1000, total: 1008, missions: [
      { id: '6a4b15730e9e', name: '신한 SOL페이 앱', points: 1008, todo: '신규 회원가입하기', level: 'easy', minutes: 5 },
    ] },
    { goal: 5000, total: 5400, missions: [
      { id: 'b35d9413fbe7', name: '짱구 게임 방범대', points: 5400, todo: '스코어 2300 달성하기', level: 'normal', minutes: 10 },
    ] },
    { goal: 10000, total: 10440, missions: [
      { id: '0997f27c39be', name: '스탁매니저', points: 2880, todo: '최초 회원 가입하기', level: 'easy', minutes: 5 },
      { id: 'b35d9413fbe7', name: '짱구 게임 방범대', points: 5400, todo: '스코어 2300 달성하기', level: 'normal', minutes: 10 },
      { id: 'a91005a89f4a', name: 'AnyPop : Zoo Blast', points: 2160, todo: '첫 7000점 달성하기', level: 'normal', minutes: 10 },
    ] },
  ],
  // 「한 번에 끝내기」: one mission is enough, mixed kinds (a signup, a game score, a free lookup, one that needs a payment).
  singles: [
    { goal: 1000, missions: [
      { id: '6a4b15730e9e', name: '신한 SOL페이 앱', points: 1008, todo: '신규 회원가입하기', level: 'easy', minutes: 5 },
      { id: 'db421f2f2671', name: '연말 환급받기', points: 2592, todo: '무료로 조회하기', level: 'normal', minutes: 6 },
      { id: '0997f27c39be', name: '스탁매니저', points: 2880, todo: '최초 회원 가입하기', level: 'easy', minutes: 5 },
    ] },
    { goal: 5000, missions: [
      { id: 'b35d9413fbe7', name: '짱구 게임 방범대', points: 5400, todo: '스코어 2300 달성하기', level: 'normal', minutes: 10 },
      { id: 'c27e61d0aa31', name: '쇼핑몰 첫 구매', points: 6200, todo: '첫 구매하기 · 결제 필요', level: 'hard', minutes: 15 },
    ] },
    { goal: 10000, missions: [
      { id: 'e50b9a1c7d42', name: '증권 계좌 만들기', points: 12000, todo: '계좌 개설하기', level: 'hard', minutes: 20 },
    ] },
  ],
  // 「쉽게 모으기」: small, quick ones (follow, subscribe, install and open); no goal to reach.
  easy: {
    total: 600,
    missions: [
      { id: '7d20c1e4a915', name: '삼성생명 인스타그램', points: 102, todo: '인스타그램 팔로우하기', level: 'easy', minutes: 3 },
      { id: '3f8e5b02c6d7', name: '메디필 공식 채널', points: 150, todo: '채널 구독하기', level: 'easy', minutes: 3 },
      { id: '91ac4d37e0b8', name: '우리WON뱅킹', points: 180, todo: '앱 설치하고 열기', level: 'easy', minutes: 4 },
      { id: '5c06f2a8b3e1', name: '머지 드림홈', points: 168, todo: '앱 설치하고 열기', level: 'easy', minutes: 4 },
    ],
  },
};

export type TodayCombosState = { status: 'loading' | 'ready' | 'empty'; combos: TodayCombos | null; reload(): void };
/**
 * Loads today's combos. Without `url` nothing is shown unless `sample` is true (screen work only),
 * so users never see example rows as if they were real.
 * Data is tied to the url + headers it was fetched with: a new member or address starts empty instead of showing
 * the previous one's rows. After Korean midnight yesterday's rows are dropped and today's are fetched again.
 */
export type CombosSource = {
  /** Either `url` (+ `headers`) or `load`: the app's own request function, resolving to the parsed JSON body. */
  url?: string;
  headers?: Record<string, string>;
  load?: () => Promise<unknown>;
  /** Anything that identifies who/what `load` asks for (member id, token); a change drops the previous rows at once. */
  loadKey?: string | number;
};
export function useTodayCombos({ url, headers, load, loadKey, sample = false }: CombosSource & { sample?: boolean }): TodayCombosState {
  const React = require('react') as typeof import('react');
  const headersKey = JSON.stringify(headers ?? {});
  const enabled = !!url || !!load;
  const key = `${url ?? ''}|${headersKey}|${load ? 'load:' + String(loadKey ?? '') : ''}|${sample ? 1 : 0}`;
  const latestLoad = React.useRef(load);
  latestLoad.current = load;
  const start = (): { status: TodayCombosState['status']; combos: TodayCombos | null } =>
    sample && !enabled ? { status: 'ready', combos: TODAY_COMBOS_SAMPLE } : { status: enabled ? 'loading' : 'empty', combos: null };
  const [state, setState] = React.useState<{ key: string; status: TodayCombosState['status']; combos: TodayCombos | null }>(() => ({ key, ...start() }));
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!enabled) return;
    let live = true;
    const request = latestLoad.current
      ? loadTodayCombos({ load: () => latestLoad.current!() })
      : fetchTodayCombos({ url: url!, headers: JSON.parse(headersKey) });
    request.then(result => {
      if (live) setState({ key, ...(result.ok ? { status: 'ready' as const, combos: result.combos } : { status: 'empty' as const, combos: null }) });
    });
    return () => { live = false; };
  }, [key, tick]);
  React.useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setTick(n => n + 1), msUntilKstMidnight() + 5000);
    return () => clearTimeout(timer);
  }, [enabled, tick]);
  const reload = () => { setState(prev => ({ ...prev, status: 'loading' })); setTick(n => n + 1); };
  const current = state.key === key ? state : { key, ...start() };
  // Re-checked on every render, so a render after midnight never shows yesterday's rows.
  const fresh = current.combos && (current.combos === TODAY_COMBOS_SAMPLE || isTodayCombos(current.combos)) ? current.combos : null;
  return { status: fresh ? current.status : current.status === 'loading' ? 'loading' : 'empty', combos: fresh, reload };
}

export const COMBO_LIST_HINT = '누르면 혜택 목록이 열려요. 같은 이름을 찾아 참여해 주세요.';
export type ComboGuideScreenProps = {
  /** null while loading or when there is nothing for today; the screen then shows a short message. */
  combos: TodayCombos | null;
  loading?: boolean;
  onClose: () => void;
  /** Opens the matching item. Without it, `usn` opens the whole list instead (the SDK cannot jump to one item). */
  onPressMission?: (mission: ComboMission, bundle: ComboBundle) => void;
  usn?: string | null;
  theme?: ComboTheme;
  showHeader?: boolean;
  topInset?: number;
  /** 'page' = full screen with a back arrow; 'sheet' = the panel that rises over the wall, with a 닫기 button. */
  variant?: 'page' | 'sheet';
  /** Shown above the rows when a tap only opens the whole list. Pass '' to hide. */
  hint?: string;
  /** Mission ids the user ticked as done. Done rows sink to the bottom, dim, and leave the remaining sum. */
  done?: ReadonlySet<string>;
  /** Called when the round mark in front of a row is tapped. Without it the marks are not interactive. */
  onToggleDone?: (id: string) => void;
};
const NO_DONE: ReadonlySet<string> = new Set();
/** First character of a name (a whole character even for emoji / surrogate pairs), for the icon fallback. */
const firstChar = (name: string): string => Array.from(name.trim())[0] ?? '·';

/**
 * Left icon of a mission row: the campaign's icon when the server sent one (`mission.icon`, https only), else the first
 * letter of the name on a soft circle. A picture that fails to load falls back to the letter too.
 */
export function ComboMissionIcon({ name, uri, size = 44, theme = DEFAULT_COMBO_THEME }: { name: string; uri?: string; size?: number; theme?: ComboTheme }): ReactElement {
  const React = require('react') as typeof import('react');
  const { View, Text, Image } = require('react-native') as typeof import('react-native');
  const [failed, setFailed] = React.useState(false);
  const t = theme;
  if (uri && !failed) {
    return React.createElement(Image, {
      source: { uri }, accessibilityIgnoresInvertColors: true, resizeMode: 'cover', onError: () => setFailed(true),
      style: { width: size, height: size, borderRadius: 10, backgroundColor: t.thumbBg ?? '#F2F4F6' },
    });
  }
  return React.createElement(View, { accessible: false, style: { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accentSoft } },
    React.createElement(Text, { style: { fontSize: Math.round(size * 0.4), fontWeight: '700', color: t.accentText } }, firstChar(name)));
}

/**
 * The guide page, laid out like the shopping tab: white, a thin title row, small flat tabs (쉽게 모으기 · 1천 · 5천 · 1만P), a
 * one-line total, and a plain list: icon, name + what to do, +points, a small check. The whole row is the button.
 */
export function ComboGuideScreen({ combos, loading = false, onClose, onPressMission, usn, theme = DEFAULT_COMBO_THEME, showHeader = true, topInset = 0, variant = 'page', hint = COMBO_LIST_HINT, done = NO_DONE, onToggleDone }: ComboGuideScreenProps): ReactElement {
  const React = require('react') as typeof import('react');
  const { View, Text, Pressable, ScrollView, BackHandler } = require('react-native') as typeof import('react-native');
  const h = React.createElement;
  const t = theme;
  const chipBg = t.chipBg ?? '#F2F4F6';
  const [notice, setNotice] = React.useState('');
  const [selected, setSelected] = React.useState(0);
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [onClose]);
  const bundles = combos?.bundles ?? [];
  const easy = combos?.easy;
  // Tabs: 「쉽게 모으기」 first when the server sent it (and it is what opens), then the steps. Its list is a bundle with goal 0.
  const tabCount = bundles.length + (easy ? 1 : 0);
  const index = Math.min(selected, Math.max(0, tabCount - 1));
  const onEasy = !!easy && index === 0;
  const stepIndex = index - (easy ? 1 : 0);
  const bundle: ComboBundle | undefined = onEasy && easy ? { goal: 0, missions: easy.missions, total: easy.total } : bundles[stepIndex];
  const actionable = !!onPressMission || !!usn;
  const press = (mission: ComboMission, from: ComboBundle) => {
    if (onPressMission) { onPressMission(mission, from); return; }
    if (!usn) return;
    const result = openOfferwall({ usn });
    setNotice(result.ok ? '' : result.message);
  };
  const todo = bundle ? bundle.missions.filter(m => !done.has(m.id)) : [];
  const rows = bundle ? [...todo, ...bundle.missions.filter(m => done.has(m.id))] : [];
  const remaining = todo.reduce((sum, m) => sum + m.points, 0);
  const allDone = !!bundle && todo.length === 0;
  const anyDone = !!bundle && todo.length < bundle.missions.length;
  // 「한 번에 끝내기」: missions that reach this step's goal on their own (hidden when the server sent none for it).
  const singles = bundle && !onEasy ? (combos?.singles?.find(s => s.goal === bundle.goal)?.missions ?? []) : [];
  const singleRows = [...singles.filter(m => !done.has(m.id)), ...singles.filter(m => done.has(m.id))];
  const side = 20;
  /** One mission row, the same look in the list and in the 「한 번에 끝내기」 list. `no` counts the ones not done yet (screen readers only). */
  const missionRow = (mission: ComboMission, index: number, no: number, forPress: ComboBundle): ReactElement => {
    const isDone = done.has(mission.id);
    return h(Pressable, {
      key: mission.id,
      accessibilityRole: 'button',
      accessibilityLabel: isDone ? `${mission.name}, 완료`
        : `${no}번 ${mission.name}, ${formatPoints(mission.points)}, ${COMBO_LEVEL_LABEL[mission.level]}${actionable ? ', 하러 가기' : ''}`,
      disabled: !actionable || isDone,
      onPress: () => press(mission, forPress),
      style: ({ pressed }: { pressed: boolean }): import('react-native').ViewStyle => ({
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: side,
        borderTopWidth: index === 0 ? 0 : 1, borderTopColor: t.line, backgroundColor: pressed ? '#F7F8FA' : 'transparent', opacity: isDone ? 0.5 : 1,
      }),
    },
      h(ComboMissionIcon, { name: mission.name, uri: mission.icon, theme: t }),
      h(View, { style: { flex: 1, minWidth: 0, marginLeft: 12 } },
        h(Text, { numberOfLines: 1, ellipsizeMode: 'tail', style: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: t.text, textDecorationLine: isDone ? 'line-through' : 'none' } }, mission.name),
        mission.todo ? h(Text, { numberOfLines: 1, ellipsizeMode: 'tail', style: { marginTop: 1, fontSize: 13, lineHeight: 18, color: t.sub } }, mission.todo) : null),
      h(Text, { style: { marginLeft: 8, fontSize: 15, fontWeight: '800', color: t.point } }, `+${formatPoints(mission.points)}`),
      onToggleDone ? h(Pressable, {
        accessibilityRole: 'checkbox', accessibilityState: { checked: isDone }, accessibilityLabel: `${mission.name} 완료 표시`,
        onPress: () => onToggleDone(mission.id), hitSlop: 10,
        style: {
          marginLeft: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
          backgroundColor: isDone ? t.accentText : 'transparent', borderWidth: isDone ? 0 : 1.5, borderColor: '#D1D6DB',
        },
      }, isDone ? h(Text, { style: { fontSize: 13, lineHeight: 16, fontWeight: '900', color: '#FFFFFF' } }, '✓') : null) : null);
  };
  let nextNo = 0;
  let nextSingleNo = 0;
  const closeText = (label: string) => h(Text, { style: { fontSize: 14, fontWeight: '600', color: t.sub } }, label);
  return h(View, { style: { flex: 1, backgroundColor: t.bg, paddingTop: Math.max(0, topInset) } },
    showHeader ? (variant === 'sheet'
      ? h(View, { style: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: side } },
        h(Text, { style: { fontSize: 18, fontWeight: '700', color: t.text } }, COMBO_NAME),
        h(Pressable, { accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: onClose, hitSlop: 12, style: { paddingVertical: 8, paddingLeft: 8 } }, closeText('닫기')))
      : h(View, { style: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 } },
        h(Pressable, { accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: onClose, hitSlop: 12, style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' } },
          h(Text, { style: { fontSize: 28, color: t.text } }, '‹')),
        h(Text, { style: { fontSize: 18, fontWeight: '700', color: t.text } }, COMBO_NAME))) : null,
    h(ScrollView, { contentContainerStyle: { paddingBottom: 32 } },
      tabCount > 1 ? h(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { flexGrow: 0 }, contentContainerStyle: { paddingHorizontal: side, paddingVertical: 4, gap: 8, alignItems: 'center' } },
        [...(easy ? [null] : []), ...bundles].map((b, i) => {
          const on = i === index;
          const isEasyTab = b === null;
          const step = i - (easy ? 1 : 0);
          return h(Pressable, {
            key: isEasyTab ? 'easy' : `step-${b.goal}`, accessibilityRole: 'button', accessibilityState: { selected: on },
            accessibilityLabel: isEasyTab ? COMBO_EASY_NAME : `${step + 1}단계 ${formatGoal(b.goal)}`, onPress: () => setSelected(i),
            style: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.accentSoft : chipBg },
          }, h(Text, { style: { fontSize: 14, fontWeight: '600', color: on ? t.accentText : t.sub } }, isEasyTab ? COMBO_EASY_NAME : formatGoal(b.goal)));
        })) : null,
      // the sum as one line: what is left (or what finishing everything gives)
      bundle ? h(View, { style: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: side, paddingTop: 14, paddingBottom: 6, gap: 6 } },
        h(Text, { style: { fontSize: 13, color: t.sub } }, allDone ? '모두 마쳤어요' : anyDone ? '남은 합계' : onEasy ? '다 하면' : '합계'),
        allDone ? null : h(Text, { style: { fontSize: 16, fontWeight: '800', color: t.point } }, onEasy ? `+${formatPoints(remaining)}` : formatPoints(remaining))) : null,
      actionable && !onPressMission && hint && bundle ? h(Text, { style: { paddingHorizontal: side, paddingBottom: 6, fontSize: 12, lineHeight: 18, color: t.sub } }, hint) : null,
      bundle ? h(View, { key: String(bundle.goal) },
        rows.map((mission, i) => missionRow(mission, i, done.has(mission.id) ? 0 : ++nextNo, bundle))) : null,
      // 「한 번에 끝내기」: a second list under the step's, one mission is enough to reach the goal. Hidden when the server sent none.
      bundle && singleRows.length ? h(View, { key: `singles-${bundle.goal}`, style: { marginTop: 22 } },
        h(View, { style: { paddingHorizontal: side, paddingBottom: 6 } },
          h(Text, { accessibilityRole: 'header', style: { fontSize: 16, fontWeight: '700', color: t.text } }, '한 번에 끝내기'),
          h(Text, { style: { marginTop: 2, fontSize: 13, color: t.sub } }, `아래 중 하나만 해도 ${formatPoints(bundle.goal)}를 채워요`)),
        singleRows.map((mission, i) => missionRow(
          mission, i, done.has(mission.id) ? 0 : ++nextSingleNo,
          { goal: bundle.goal, missions: [mission], total: mission.points }))) : null,
      !bundle ? h(Text, { style: { marginTop: 48, fontSize: 15, lineHeight: 22, textAlign: 'center', color: t.sub } },
        loading ? '불러오고 있어요' : '지금은 준비하고 있어요.\n잠시 뒤에 다시 확인해 주세요.') : null,
      bundle ? h(Text, { style: { paddingHorizontal: side, paddingTop: 18, fontSize: 12, lineHeight: 18, color: t.sub } }, '합계는 표시된 항목을 모두 마쳤을 때 기준이에요. 오늘 하루 기준이고 내일은 새로 바뀌어요. 항목마다 참여 조건이 달라서, 눌러서 안내를 꼭 확인해 주세요.') : null,
      notice ? h(Text, { style: { paddingHorizontal: side, paddingTop: 10, fontSize: 14, fontWeight: '700', color: '#E5484D' } }, notice) : null));
}
