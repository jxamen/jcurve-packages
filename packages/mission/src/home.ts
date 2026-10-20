/**
 * (0.5.0) 메인 「바로 받는 혜택」 목록을 **서버 설정으로** — 대표님 10-20 10:56 「메인 패키지 반영도 바로 안되고」.
 * 줄 제목 · 설명 · 버튼 · 배지 · 보임 · 순서를 어드민 앱 설정(mission.home_rows)에서 바꾸면 앱 빌드 · OTA 없이 1분 안에 바뀐다.
 * 서버 GET mission/home → { ok, rows: HomeRow[] | null, list: { adAfter, shoppingFirst } }. rows 가 null(설정 없음) · 실패면 앱의 기본 목록 그대로.
 * react-native 를 가져오지 않는다(시험이 바로 돈다).
 */
import type { BenefitQuickItem } from './BenefitQuickList';
import type { Requester } from './entry';

/** 서버가 아는 줄 행동 — jcurve-api MissionCardsController::HOME_KEYS 와 같다 */
export const HOME_KEYS = ['quiz1', 'quiz2', 'checkin', 'steps', 'free_item', 'today_missions', 'lucky_chance', 'invite', 'recommend'] as const;
export type HomeRowKey = typeof HOME_KEYS[number];

export type HomeRow = { key: HomeRowKey; title: string; desc: string; button: string; badge: string; visible: boolean; order: number };
export type HomeConfig = { rows: HomeRow[] | null; list: { adAfter: number | null; shoppingFirst: boolean | null } };

export const EMPTY_HOME: HomeConfig = { rows: null, list: { adAfter: null, shoppingFirst: null } };

const text = (v: unknown, max: number): string => (typeof v === 'string' ? Array.from(v.trim()).slice(0, max).join('') : '');

/** 서버 응답을 믿지 않고 다시 거른다 — 모르는 key · 빈 제목 · 같은 key 두 번째는 버린다. 깨진 응답은 EMPTY_HOME */
export function parseHomeResponse(response: unknown): HomeConfig {
  const r = response as { ok?: unknown; rows?: unknown; list?: { adAfter?: unknown; shoppingFirst?: unknown } } | null;
  if (!r || typeof r !== 'object' || r.ok !== true) return EMPTY_HOME;
  let rows: HomeRow[] | null = null;
  if (Array.isArray(r.rows)) {
    const seen = new Set<string>();
    rows = [];
    r.rows.forEach((raw, i) => {
      const x = raw as Record<string, unknown> | null;
      if (!x || typeof x !== 'object') return;
      const key = x.key;
      if (typeof key !== 'string' || !(HOME_KEYS as readonly string[]).includes(key) || seen.has(key)) return;
      const title = text(x.title, 30);
      if (title === '') return;
      seen.add(key);
      rows!.push({
        key: key as HomeRowKey, title, desc: text(x.desc, 60), button: text(x.button, 12), badge: text(x.badge, 8),
        visible: x.visible !== false, order: typeof x.order === 'number' && Number.isFinite(x.order) ? x.order : i,
      });
    });
    rows.sort((a, b) => a.order - b.order);
  }
  const ad = r.list?.adAfter;
  const sf = r.list?.shoppingFirst;

  return {
    rows,
    list: {
      adAfter: typeof ad === 'number' && Number.isInteger(ad) && ad >= 0 && ad <= 50 ? ad : null,
      shoppingFirst: typeof sf === 'boolean' ? sf : null,
    },
  };
}

/** 마지막으로 받은 설정 — 화면이 다시 그려질 때마다 서버를 부르지 않게(서버도 max-age=60) */
let cache: { at: number; value: HomeConfig } | null = null;
let inflight: Promise<HomeConfig> | null = null;

/** GET mission/home — `maxAgeMs`(기본 60초) 안이면 받아 둔 것. 실패하면 받아 둔 것 또는 EMPTY_HOME(앱 기본 목록) */
export async function fetchHomeConfig(fetchJson: Requester, opts: { maxAgeMs?: number; now?: number } = {}): Promise<HomeConfig> {
  const now = opts.now ?? Date.now();
  const maxAge = opts.maxAgeMs ?? 60_000;
  if (cache && now - cache.at >= 0 && now - cache.at < maxAge) return cache.value;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const value = parseHomeResponse(await fetchJson('mission/home', { method: 'GET' }));
      cache = { at: now, value };
      return value;
    } catch {
      return cache?.value ?? EMPTY_HOME;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 시험용 · 로그아웃 · 앱 전환 */
export function resetHomeConfig(): void { cache = null; inflight = null; }

/**
 * 앱의 기본 목록에 서버 설정을 얹는다 — `keys` 는 앱 줄 key → 서버 행동 key(예 { bag: 'quiz1', pin: 'quiz2', ticket: 'lucky_chance' }).
 *  - 설정이 있는 줄: 제목은 서버 것, 설명 · 버튼 · 배지는 서버 값이 있을 때만(빈 값이면 앱 것 그대로), visible:false 면 숨김
 *  - 순서: 설정이 있는 줄은 서버 순서대로 앞에, 설정에 없는 줄(앱만의 줄 · 서버가 안 적은 줄)은 그 뒤에 원래 순서대로
 *  - rows 가 null 이면 아무것도 안 바꾼다. 누르는 동작(onPress) · 완료 · 칸 막대는 늘 앱 것
 */
export function applyHomeRows(items: readonly BenefitQuickItem[], rows: readonly HomeRow[] | null, keys: Readonly<Record<string, HomeRowKey>>): BenefitQuickItem[] {
  if (!rows) return [...items];
  const byKey = new Map(rows.map((r, i) => [r.key, { r, i }]));
  const configured: { item: BenefitQuickItem; i: number }[] = [];
  const rest: BenefitQuickItem[] = [];
  for (const item of items) {
    const k = keys[item.key];
    const hit = k ? byKey.get(k) : undefined;
    if (!hit) { rest.push(item); continue; }
    const { r } = hit;
    configured.push({
      i: hit.i,
      item: {
        ...item,
        title: r.title,
        ...(r.desc ? { subtitle: r.desc } : {}),
        ...(r.button ? { ctaLabel: r.button } : {}),
        ...(r.badge ? { badge: r.badge } : {}),
        hidden: item.hidden || !r.visible,
      },
    });
  }
  configured.sort((a, b) => a.i - b.i);

  return [...configured.map(c => c.item), ...rest];
}

/**
 * 목록 사이 광고 자리(list.adAfter) — 앞에서 몇 번째 **보이는** 줄 뒤에 둘지. null 이면 앱 기본, 0 이면 맨 앞, 보이는 줄 수보다 크면 맨 뒤
 */
export function adSlotIndex(items: readonly BenefitQuickItem[], adAfter: number | null, fallback: number | null): number | null {
  const n = adAfter ?? fallback;
  if (n === null) return null;
  const visible = items.filter(i => !i.hidden).length;
  return Math.max(0, Math.min(n, visible));
}

/**
 * (0.4.4) 앱 줄 key → 서버 9개 key 맞춤표를 만든다 — `homeKeys`(앱이 적은 것)가 이기고, 안 적은 줄은 **key 가 서버 key 와 같으면 그대로**.
 * 서버 줄 key 는 9개 고정(HOME_KEYS)이라 모든 앱이 같은 key 로 말해야 어드민 한 곳이 모든 앱 목록이 된다(대표님 17:12 「이 패키지 써」)
 */
export function resolveHomeKeys(items: readonly BenefitQuickItem[], homeKeys?: Readonly<Record<string, HomeRowKey>>): Record<string, HomeRowKey> {
  const out: Record<string, HomeRowKey> = {};
  for (const item of items) {
    if ((HOME_KEYS as readonly string[]).includes(item.key)) out[item.key] = item.key as HomeRowKey;
  }
  for (const [k, v] of Object.entries(homeKeys ?? {})) {
    if ((HOME_KEYS as readonly string[]).includes(v)) out[k] = v;
  }

  return out;
}

/** 기본 「무료 ○○ 받기 · 하루 3번 들르면 ○○ 받기」 줄(key free_item) — 당근과 같은 문구. ○○ 는 앱 아이템 이름 */
export function freeItemHomeRow(itemName: string, onPress: () => void): BenefitQuickItem {
  const name = itemName.trim() === '' ? '아이템' : itemName.trim();

  return { key: 'free_item', title: `무료 ${name} 받기`, subtitle: `하루 3번 들르면 ${name} 받기`, ctaLabel: '받기', icon: '🌱', tint: '#FDE6D6', onPress };
}

/**
 * (0.4.4) free_item 줄은 **패키지 기본**이다 — 앱 items 에 free_item(맞춤표 기준)이 이미 있으면(예: freeItemRow 를 쓰는 에그머니 · 머니트리 · 영테크) 겹치지 않게 그대로 두고,
 * 없고 `onFreeItem` 이 있으면 기본 줄을 맨 뒤에 더한다(자리 · 보임은 서버 home_rows 가 정한다). `onFreeItem` 이 없으면 줄을 만들지 않는다(눌러도 갈 곳이 없다)
 */
export function withFreeItemRow(items: readonly BenefitQuickItem[], homeKeys: Readonly<Record<string, HomeRowKey>> | undefined, itemName: string | undefined, onFreeItem: (() => void) | undefined): BenefitQuickItem[] {
  const keys = resolveHomeKeys(items, homeKeys);
  if (!onFreeItem || items.some(i => keys[i.key] === 'free_item')) return [...items];

  return [...items, freeItemHomeRow(itemName ?? '아이템', onFreeItem)];
}

/** 앱 items 에 없는 서버 줄을 그릴 때 쓰는 기본 그림 · 바탕색(0.4.4) */
const DEFAULT_ICON: Record<HomeRowKey, BenefitQuickItem['icon']> = {
  quiz1: 'bag', quiz2: 'pin', checkin: 'calendar', steps: 'star', free_item: '🌱', today_missions: 'pin', lucky_chance: 'ticket', invite: 'friend', recommend: 'star',
};

/**
 * (0.4.4) 앱별 서버 home_rows 를 **그대로 따른다**(대표님 17:14 「목록 순서는 어드민에서 앱별로 · 넣고 빼고 순서랑」):
 *  - **순서**: home_rows 순서대로(설정에 있는 줄이 앞, 서버 key 와 짝이 없는 앱 전용 줄은 그 뒤에 원래 순서로)
 *  - **빼기**: 서버 key 로 맞춰진 앱 줄인데 home_rows 에 없으면 그리지 않는다. 있어도 visible:false 면 숨긴다
 *  - **넣기**: home_rows 에 있는데 앱 items 에 짝이 없는 key 는 그 줄(제목 · 설명 · 버튼 · 배지는 서버 값)을 기본 그림으로 만들어 넣고, 누르면 `onRow(key)` 를 부른다 — `onRow` 가 없으면 그 줄은 만들지 않는다(눌러도 갈 곳이 없다)
 *  - rows 가 null(설정 없음 · 실패)이면 앱 기본 그대로
 * 누르는 동작 · 완료 · 칸 막대는 늘 앱 것(앱 줄) — 서버 줄이 바꾸는 것은 제목 · 설명 · 버튼 · 배지 · 보임 · 순서뿐
 */
export function composeHomeRows(
  items: readonly BenefitQuickItem[],
  rows: readonly HomeRow[] | null,
  keys: Readonly<Record<string, HomeRowKey>>,
  opts: { onRow?: (key: HomeRowKey) => void } = {},
): BenefitQuickItem[] {
  if (!rows) return [...items];
  const byKey = new Map(rows.map((r, i) => [r.key, { r, i }]));
  const configured: { item: BenefitQuickItem; i: number }[] = [];
  const rest: BenefitQuickItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const k = keys[item.key];
    if (!k) { rest.push(item); continue; }          // 서버 key 와 짝이 없는 앱 전용 줄 — 그대로
    const hit = byKey.get(k);
    if (!hit) continue;                              // 서버가 빼라고 한 줄(목록에 없음)
    seen.add(k);
    const { r } = hit;
    configured.push({
      i: hit.i,
      item: {
        ...item,
        title: r.title,
        ...(r.desc ? { subtitle: r.desc } : {}),
        ...(r.button ? { ctaLabel: r.button } : {}),
        ...(r.badge ? { badge: r.badge } : {}),
        hidden: item.hidden || !r.visible,
      },
    });
  }
  if (opts.onRow) {
    const onRow = opts.onRow;
    for (const [k, { r, i }] of byKey) {
      if (seen.has(k) || !r.visible) continue;
      configured.push({ i, item: { key: k, title: r.title, subtitle: r.desc, ctaLabel: r.button || '바로가기', ...(r.badge ? { badge: r.badge } : {}), icon: DEFAULT_ICON[k], tint: '#F3F0EB', onPress: () => onRow(k) } });
    }
  }
  configured.sort((a, b) => a.i - b.i);

  return [...configured.map(c => c.item), ...rest];
}

