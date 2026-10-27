/** Daily point combos for the Chance tab. Pure JS (OTA-safe); it only shows server data and never grants points. */
import type { ReactElement } from 'react';
import { openOfferwall } from './index';

export type ComboLevel = 'easy' | 'normal' | 'hard';
export type ComboMission = { id: string; name: string; points: number; todo: string; level: ComboLevel; minutes?: number };
export type ComboBundle = { goal: number; missions: ComboMission[]; total: number };
/** Server switches. chance: the entry shown in the Chance tab; home: the optional banner on Home. */
export type ComboDisplay = { chance: 'card' | 'banner' | 'off'; home: 'banner' | 'off' };
export type TodayCombos = { date?: string; display: ComboDisplay; bundles: ComboBundle[] };

const LEVELS: readonly ComboLevel[] = ['easy', 'normal', 'hard'];
export const COMBO_LEVEL_LABEL: Record<ComboLevel, string> = { easy: '쉬움', normal: '보통', hard: '조금 걸려요' };

const text = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '';
const whole = (v: unknown): number => {
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : 0;
};

/** Keeps only well-formed rows; totals are recomputed so the screen never shows a sum the rows do not add up to. */
export function normalizeTodayCombos(raw: unknown): TodayCombos | null {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, any>) : null;
  if (!data || !Array.isArray(data.bundles)) return null;
  const bundles: ComboBundle[] = [];
  const goals = new Set<number>();
  for (const item of data.bundles.slice(0, 6)) {
    const goal = whole(item?.goal);
    if (!goal || goals.has(goal) || !Array.isArray(item.missions)) continue;
    const ids = new Set<string>();
    const missions: ComboMission[] = [];
    for (const m of item.missions.slice(0, 12)) {
      const id = text(typeof m?.id === 'number' ? String(m.id) : m?.id, 64);
      const name = text(m?.name, 40);
      const points = whole(m?.points);
      if (!id || !name || !points || ids.has(id)) continue;
      ids.add(id);
      const minutes = whole(m.minutes);
      missions.push({
        id, name, points, todo: text(m.todo, 80),
        level: LEVELS.includes(m.level) ? m.level : 'normal',
        ...(minutes && minutes <= 120 ? { minutes } : {}),
      });
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
  // Unknown or missing switches fall back to: card in the Chance tab, nothing on Home.
  const chance = data.display?.chance;
  const home = data.display?.home;
  const display: ComboDisplay = {
    chance: chance === 'banner' || chance === 'off' ? chance : 'card',
    home: home === 'banner' ? 'banner' : 'off',
  };
  return date ? { date, display, bundles } : { display, bundles };
}

/** Calendar date in Korea (the daily reset), YYYY-MM-DD. */
export function kstDate(now: number = Date.now()): string {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
/** Yesterday's combos must not be shown as today's. A missing date is treated as fresh. */
export function isTodayCombos(combos: TodayCombos, now: number = Date.now()): boolean {
  return !combos.date || combos.date === kstDate(now);
}

export function formatPoints(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}P`;
}
/** 1000 → 1천, 5000 → 5천, 10000 → 1만, anything else → 1,500P */
export function formatGoal(goal: number): string {
  if (goal >= 10000 && goal % 10000 === 0) return `${goal / 10000}만P`;
  if (goal >= 1000 && goal < 10000 && goal % 1000 === 0) return `${goal / 1000}천P`;
  return formatPoints(goal);
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
    const body = await response.json();
    if (!body || typeof body !== 'object' || body.ok === false) return { ok: false, reason: 'bad_response' };
    const combos = normalizeTodayCombos(body.combos ?? body.data ?? body);
    if (!combos) return { ok: false, reason: 'bad_response' };
    return isTodayCombos(combos, now) ? { ok: true, combos } : { ok: false, reason: 'stale' };
  } catch { return { ok: false, reason: 'network' }; }
  finally { clearTimeout(timer); }
}

/** Fixed data for building the screen before the API exists. Only `sample: true` ever shows it. */
export const TODAY_COMBOS_SAMPLE: TodayCombos = {
  display: { chance: 'card', home: 'banner' },
  bundles: [
    { goal: 1000, total: 1050, missions: [
      { id: 's1', name: '쇼핑몰 둘러보기', points: 300, todo: '상품 3개 눌러서 구경하기', level: 'easy', minutes: 1 },
      { id: 's2', name: '간단한 설문 하나', points: 450, todo: '질문 5개에 답하기', level: 'easy', minutes: 3 },
      { id: 's3', name: '새 앱 열어 보기', points: 300, todo: '앱을 설치하고 한 번 열기', level: 'normal', minutes: 2 },
    ] },
    { goal: 5000, total: 5200, missions: [
      { id: 's4', name: '여행 앱 가입', points: 1800, todo: '가입하고 첫 화면까지 들어가기', level: 'normal', minutes: 5 },
      { id: 's5', name: '게임 3단계까지', points: 2200, todo: '게임을 설치하고 3단계 깨기', level: 'hard', minutes: 20 },
      { id: 's6', name: '간단한 설문 하나', points: 450, todo: '질문 5개에 답하기', level: 'easy', minutes: 3 },
      { id: 's7', name: '쇼핑몰 둘러보기', points: 300, todo: '상품 3개 눌러서 구경하기', level: 'easy', minutes: 1 },
      { id: 's8', name: '새 앱 열어 보기', points: 450, todo: '앱을 설치하고 한 번 열기', level: 'normal', minutes: 2 },
    ] },
    { goal: 10000, total: 10100, missions: [
      { id: 's9', name: '금융 앱 가입', points: 4000, todo: '가입하고 본인 확인까지 마치기', level: 'hard', minutes: 10 },
      { id: 's10', name: '게임 5단계까지', points: 3600, todo: '게임을 설치하고 5단계 깨기', level: 'hard', minutes: 30 },
      { id: 's11', name: '여행 앱 가입', points: 1800, todo: '가입하고 첫 화면까지 들어가기', level: 'normal', minutes: 5 },
      { id: 's12', name: '간단한 설문 하나', points: 450, todo: '질문 5개에 답하기', level: 'easy', minutes: 3 },
      { id: 's13', name: '쇼핑몰 둘러보기', points: 250, todo: '상품 3개 눌러서 구경하기', level: 'easy', minutes: 1 },
    ] },
  ],
};

export type TodayCombosState = { status: 'loading' | 'ready' | 'empty'; combos: TodayCombos | null; reload(): void };
/**
 * Loads today's combos. Without `url` nothing is shown unless `sample` is true (screen work only),
 * so users never see example rows as if they were real.
 */
export function useTodayCombos({ url, headers, sample = false }: { url?: string; headers?: Record<string, string>; sample?: boolean }): TodayCombosState {
  const React = require('react') as typeof import('react');
  const [state, setState] = React.useState<{ status: TodayCombosState['status']; combos: TodayCombos | null }>(
    () => (sample && !url ? { status: 'ready', combos: TODAY_COMBOS_SAMPLE } : { status: url ? 'loading' : 'empty', combos: null }));
  const [tick, setTick] = React.useState(0);
  const headersKey = JSON.stringify(headers ?? {});
  React.useEffect(() => {
    if (!url) { setState(sample ? { status: 'ready', combos: TODAY_COMBOS_SAMPLE } : { status: 'empty', combos: null }); return; }
    let live = true;
    fetchTodayCombos({ url, headers: JSON.parse(headersKey) }).then(result => {
      if (live) setState(result.ok ? { status: 'ready', combos: result.combos } : { status: 'empty', combos: null });
    });
    return () => { live = false; };
  }, [url, headersKey, sample, tick]);
  const reload = () => { setState(prev => ({ status: 'loading', combos: prev.combos })); setTick(n => n + 1); };
  // The app can stay open past midnight; re-check on every render so yesterday's rows disappear.
  const fresh = state.combos && isTodayCombos(state.combos) ? state.combos : null;
  return { status: fresh ? state.status : state.status === 'loading' ? 'loading' : 'empty', combos: fresh, reload };
}

export type TodayComboCardProps = { combos: TodayCombos; onPress: () => void; accentColor?: string };
/** Entry card above the wall list. Tapping it opens the guide screen. */
export function TodayComboCard({ combos, onPress, accentColor = '#3478f6' }: TodayComboCardProps): ReactElement {
  const React = require('react') as typeof import('react');
  const { View, Text, Pressable } = require('react-native') as typeof import('react-native');
  const h = React.createElement;
  const goals = combos.bundles.map(b => formatGoal(b.goal));
  return h(Pressable, {
    accessibilityRole: 'button',
    accessibilityLabel: `오늘의 포인트 조합, ${goals.join(', ')} 목표별로 보기`,
    onPress,
    style: ({ pressed }: { pressed: boolean }) => ({
      marginHorizontal: 16, marginTop: 12, marginBottom: 4, padding: 16, borderRadius: 16,
      backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e8ec', opacity: pressed ? 0.85 : 1,
    }),
  },
    h(View, { style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } },
      h(Text, { style: { fontSize: 17, fontWeight: '700', color: '#111' } }, '오늘의 포인트 조합'),
      h(Text, { style: { fontSize: 20, color: '#9aa0a6' } }, '›')),
    h(Text, { style: { marginTop: 4, fontSize: 13, color: '#6b7280' } }, '쉬운 것부터 골라 목표 포인트를 채워 보세요'),
    h(View, { style: { flexDirection: 'row', marginTop: 12, gap: 8 } },
      goals.map(label => h(View, { key: label, style: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: accentColor + '1a' } },
        h(Text, { style: { fontSize: 13, fontWeight: '700', color: accentColor } }, label)))));
}

export type TodayComboScreenProps = {
  /** null while loading or when there is nothing for today; the screen then shows a short message. */
  combos: TodayCombos | null;
  loading?: boolean;
  onClose: () => void;
  /** Opens the matching item. Without it, `usn` opens the whole list instead (the SDK cannot jump to one item). */
  onPressMission?: (mission: ComboMission, bundle: ComboBundle) => void;
  usn?: string | null;
  accentColor?: string;
  showHeader?: boolean;
  topInset?: number;
};
export function TodayComboScreen({ combos, loading = false, onClose, onPressMission, usn, accentColor = '#3478f6', showHeader = true, topInset = 0 }: TodayComboScreenProps): ReactElement {
  const React = require('react') as typeof import('react');
  const { View, Text, Pressable, ScrollView, BackHandler } = require('react-native') as typeof import('react-native');
  const h = React.createElement;
  const [notice, setNotice] = React.useState('');
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [onClose]);
  const press = (mission: ComboMission, bundle: ComboBundle) => {
    if (onPressMission) { onPressMission(mission, bundle); return; }
    if (!usn) return;
    const result = openOfferwall({ usn });
    setNotice(result.ok ? '' : result.message);
  };
  const levelColor: Record<ComboLevel, string> = { easy: '#16a34a', normal: '#d97706', hard: '#dc2626' };
  const bundles = combos?.bundles ?? [];
  return h(View, { style: { flex: 1, backgroundColor: '#f5f6f8', paddingTop: Math.max(0, topInset) } },
    showHeader ? h(View, { style: { height: 52, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 8 } },
      h(Pressable, { accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: onClose, hitSlop: 12, style: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' } },
        h(Text, { style: { fontSize: 28, color: '#111' } }, '‹')),
      h(Text, { style: { fontSize: 17, fontWeight: '700', color: '#111' } }, '오늘의 포인트 조합')) : null,
    h(ScrollView, { contentContainerStyle: { padding: 16, paddingBottom: 40, gap: 16 } },
      bundles.length
        ? h(Text, { style: { fontSize: 14, lineHeight: 21, color: '#4b5563' } }, '하나씩 끝낼 때마다 포인트가 쌓여요. 원하는 목표에 맞는 묶음을 골라 보세요.')
        : h(Text, { style: { fontSize: 14, lineHeight: 21, color: '#4b5563', textAlign: 'center', marginTop: 48 } },
          loading ? '오늘의 조합을 불러오고 있어요' : '오늘의 조합을 준비하고 있어요.\n잠시 뒤에 다시 확인해 주세요.'),
      bundles.map(bundle => h(View, { key: String(bundle.goal), style: { backgroundColor: '#fff', borderRadius: 16, padding: 16 } },
        h(Text, { style: { fontSize: 18, fontWeight: '800', color: '#111' } }, `${formatGoal(bundle.goal)} 채우기`),
        bundle.missions.map((mission, i) => h(Pressable, {
          key: mission.id,
          accessibilityRole: 'button',
          accessibilityLabel: `${mission.name}, ${formatPoints(mission.points)}, ${COMBO_LEVEL_LABEL[mission.level]}`,
          disabled: !onPressMission && !usn,
          onPress: () => press(mission, bundle),
          style: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#eef0f3', marginTop: i === 0 ? 8 : 0 },
        },
          h(View, { style: { flex: 1, paddingRight: 12 } },
            h(Text, { style: { fontSize: 15, fontWeight: '700', color: '#111' } }, mission.name),
            mission.todo ? h(Text, { style: { marginTop: 2, fontSize: 13, color: '#6b7280' } }, mission.todo) : null,
            h(View, { style: { flexDirection: 'row', marginTop: 6, gap: 8, alignItems: 'center' } },
              h(Text, { style: { fontSize: 12, fontWeight: '700', color: levelColor[mission.level] } }, COMBO_LEVEL_LABEL[mission.level]),
              mission.minutes ? h(Text, { style: { fontSize: 12, color: '#9aa0a6' } }, `약 ${mission.minutes}분`) : null)),
          h(Text, { style: { fontSize: 16, fontWeight: '800', color: accentColor } }, `+${formatPoints(mission.points)}`))),
        h(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e6e8ec' } },
          h(Text, { style: { fontSize: 14, color: '#4b5563' } }, '합계'),
          h(Text, { style: { fontSize: 18, fontWeight: '800', color: '#111' } }, formatPoints(bundle.total))))),
      bundles.length ? h(Text, { style: { fontSize: 12, lineHeight: 18, color: '#9aa0a6' } }, '오늘 하루 기준이에요. 내일은 새로 바뀌어요.\n항목마다 참여 조건이 달라요. 눌러서 안내를 꼭 확인해 주세요.') : null,
      notice ? h(Text, { style: { fontSize: 13, color: '#dc2626' } }, notice) : null));
}
