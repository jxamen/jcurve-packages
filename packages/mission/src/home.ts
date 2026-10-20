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
      // (0.4.5) 제목이 비어도 줄은 산다 — 빈 title = 「앱 제목 그대로」(서버 home_rows 에서 title 을 비워 둔 줄, 대표님 10-20 「동적 제목은 서버 고정 제목이 덮지 않게」)
      const title = text(x.title, 30);
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

/**
 * (0.4.6) 앱이 넘기는 간단한 저장소 — React Native 의 AsyncStorage 가 그대로 맞는다(새 네이티브 의존 없음).
 * 마지막으로 받은 서버 목록을 저장해 두었다가 **앱을 켤 때 그 값으로 먼저 그린 뒤** 서버 응답으로 갱신한다 — 켤 때 앱 기본 순서로 그렸다가 서버 순서로 바뀌는 것(대표님 10-20 18:54)을 막는다.
 */
export type HomeStorage = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> };
/** 저장 키 기본값 — 앱이 서버 · 계정마다 다른 목록을 쓰면 `storageKey` 로 바꾼다 */
export const HOME_STORAGE_KEY = 'jcurve.mission.home.v1';
/** 저장값을 읽는 데 이만큼(ms)까지만 기다린다 — 저장소가 응답이 없어도 목록이 영영 안 뜨지 않게 */
export const HOME_STORAGE_WAIT_MS = 300;
const STORED_MAX_CHARS = 20_000;

/** 저장해 둔 마지막 서버 목록 — 없음 · 깨짐 · 모르는 판 · 저장소 오류는 null(앱 기본). 읽을 때도 서버 응답처럼 다시 거른다 */
export async function readStoredHome(storage: HomeStorage | undefined, key: string = HOME_STORAGE_KEY): Promise<HomeConfig | null> {
  if (!storage) return null;
  try {
    const raw = await storage.get(key);
    if (typeof raw !== 'string' || raw === '' || raw.length > STORED_MAX_CHARS) return null;
    const saved = JSON.parse(raw) as { v?: unknown; response?: unknown } | null;
    if (!saved || typeof saved !== 'object' || saved.v !== 1) return null;
    const config = parseHomeResponse(saved.response);

    return config === EMPTY_HOME ? null : config;
  } catch {
    return null;
  }
}

/** 서버에서 **정상으로** 받은 목록을 저장한다 — 저장소 오류는 삼킨다(목록은 이미 그려졌다) */
export async function saveStoredHome(storage: HomeStorage | undefined, config: HomeConfig, key: string = HOME_STORAGE_KEY): Promise<void> {
  if (!storage) return;
  try {
    await storage.set(key, JSON.stringify({ v: 1, at: Date.now(), response: { ok: true, rows: config.rows, list: config.list } }));
  } catch { /* 저장 실패는 다음에 다시 */ }
}

/** 마지막으로 받은 설정 — 화면이 다시 그려질 때마다 서버를 부르지 않게(서버도 max-age=60) */
let cache: { at: number; value: HomeConfig } | null = null;
let inflight: Promise<{ value: HomeConfig; ok: boolean }> | null = null;

/**
 * (0.4.6) GET mission/home — 값과 함께 **서버에서 정상으로 받았는가**(`ok`)를 준다. `maxAgeMs`(기본 60초) 안이면 받아 둔 것(ok).
 * 실패(던짐 · 깨진 응답)면 받아 둔 것 또는 EMPTY_HOME 과 ok:false — 저장값을 이미 그렸다면 호출한 쪽이 그것을 지킨다.
 * `storage` 를 주면 **정상 응답일 때만** 저장한다(캐시 적중 · 실패 · 깨진 응답은 저장하지 않는다).
 */
export async function fetchHomeResult(fetchJson: Requester, opts: { maxAgeMs?: number; now?: number; storage?: HomeStorage; storageKey?: string } = {}): Promise<{ value: HomeConfig; ok: boolean }> {
  const now = opts.now ?? Date.now();
  const maxAge = opts.maxAgeMs ?? 60_000;
  if (cache && now - cache.at >= 0 && now - cache.at < maxAge) return { value: cache.value, ok: true };
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const value = parseHomeResponse(await fetchJson('mission/home', { method: 'GET' }));
      cache = { at: now, value };
      // 깨진 응답은 parseHomeResponse 가 EMPTY_HOME 그 자체를 준다 — 서버가 「설정 없음」(rows null)이라고 정상으로 답한 것과 구분된다
      const ok = value !== EMPTY_HOME;
      if (ok) void saveStoredHome(opts.storage, value, opts.storageKey);

      return { value, ok };
    } catch {
      return { value: cache?.value ?? EMPTY_HOME, ok: false };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** GET mission/home — `maxAgeMs`(기본 60초) 안이면 받아 둔 것. 실패하면 받아 둔 것 또는 EMPTY_HOME(앱 기본 목록) */
export async function fetchHomeConfig(fetchJson: Requester, opts: { maxAgeMs?: number; now?: number; storage?: HomeStorage; storageKey?: string } = {}): Promise<HomeConfig> {
  return (await fetchHomeResult(fetchJson, opts)).value;
}

/** 시험용 · 로그아웃 · 앱 전환 */
export function resetHomeConfig(): void { cache = null; inflight = null; }

/**
 * (0.4.6) 화면에 그릴 서버 설정이 정해지는 순서 — 저장값(있으면) → 서버 응답. React 를 쓰지 않는 순수 함수라 시험이 바로 돈다.
 *  - `ready`: 처음 그려도 되는가. 저장소를 쓰면 저장값을 읽을 때까지(최대 HOME_STORAGE_WAIT_MS) false — 앱 기본 순서를 잠깐 그렸다가 바꾸지 않으려고 목록을 늦추지 않고 **그리지 않는다**.
 *    저장소를 안 쓰면 처음부터 true(예전과 같다)
 *  - 서버에서 정상으로 받으면 그것이 이긴다(저장값은 그 뒤에 도착해도 무시). 서버가 실패하면 이미 그린 저장값을 지킨다(앱 기본으로 되돌리면 순서가 또 바뀐다)
 */
export type HomeState = { config: HomeConfig; ready: boolean; fresh: boolean; fromStorage: boolean; storage: boolean };
export type HomeEvent = { type: 'stored'; config: HomeConfig | null } | { type: 'server'; value: HomeConfig; ok: boolean } | { type: 'timeout' };

export function homeInitial(hasStorage: boolean): HomeState {
  return { config: EMPTY_HOME, ready: !hasStorage, fresh: false, fromStorage: false, storage: hasStorage };
}

export function homeReduce(s: HomeState, e: HomeEvent): HomeState {
  switch (e.type) {
    case 'stored':
      if (s.fresh) return s.ready ? s : { ...s, ready: true };          // 서버가 먼저 왔다 — 저장값은 낡은 것
      return { ...s, config: e.config ?? s.config, fromStorage: e.config !== null, ready: true };
    case 'server':
      if (e.ok) return { ...s, config: e.value, fresh: true, ready: true };
      if (s.fromStorage) return s;                                      // 서버 실패 — 저장값을 그대로
      return s.storage ? { ...s, config: e.value } : { ...s, config: e.value, ready: true };
    case 'timeout':
      return s.ready ? s : { ...s, ready: true };
  }
}

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
        // 서버 title 이 비어 있지 않을 때만 덮는다(0.4.5) — 비어 있으면 앱 제목(만보기 「오늘 N걸음」 같은 동적 제목)을 그대로
        ...(r.title ? { title: r.title } : {}),
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

/** 서버 title 이 비어 있는데 앱 items 에 짝이 없어 줄을 새로 만들 때 쓰는 기본 제목(0.4.5) */
const DEFAULT_TITLE: Record<HomeRowKey, string> = {
  quiz1: '쇼핑 태그 퀴즈1', quiz2: '플레이스 · 쇼핑 태그 퀴즈2', checkin: '출석 체크', steps: '만보기', free_item: '무료 아이템 받기',
  today_missions: '오늘의 미션', lucky_chance: '행운 찬스', invite: '친구 초대', recommend: '추천 앱 둘러보기',
};

/**
 * (0.4.4) 앱별 서버 home_rows 를 **그대로 따른다**(대표님 17:14 「목록 순서는 어드민에서 앱별로 · 넣고 빼고 순서랑」):
 *  - **순서**: home_rows 순서대로(설정에 있는 줄이 앞, 서버 key 와 짝이 없는 앱 전용 줄은 그 뒤에 원래 순서로)
 *  - **빼기**: 서버 key 로 맞춰진 앱 줄인데 home_rows 에 없으면 그리지 않는다. 있어도 visible:false 면 숨긴다
 *  - **넣기**: home_rows 에 있는데 앱 items 에 짝이 없는 key 는 그 줄(제목 · 설명 · 버튼 · 배지는 서버 값)을 기본 그림으로 만들어 넣고, 누르면 `onRow(key)` 를 부른다 — `onRow` 가 없으면 그 줄은 만들지 않는다(눌러도 갈 곳이 없다)
 *  - **제목**(0.4.5): 서버 title 이 비어 있으면 앱 제목을 그대로 둔다(동적 제목 보호) — 적혀 있을 때만 덮는다. 새로 만드는 줄은 비었으면 key별 기본 제목
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
        // 서버 title 이 비어 있지 않을 때만 덮는다(0.4.5) — 비어 있으면 앱 제목(만보기 「오늘 N걸음」 · 오늘 미션 보너스 문구 같은 동적 제목)을 그대로
        ...(r.title ? { title: r.title } : {}),
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
      configured.push({ i, item: { key: k, title: r.title || DEFAULT_TITLE[k], subtitle: r.desc, ctaLabel: r.button || '바로가기', ...(r.badge ? { badge: r.badge } : {}), icon: DEFAULT_ICON[k], tint: '#F3F0EB', onPress: () => onRow(k) } });
    }
  }
  configured.sort((a, b) => a.i - b.i);

  return [...configured.map(c => c.item), ...rest];
}

