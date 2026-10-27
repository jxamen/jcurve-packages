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
  /** Campaign keys this member was already paid for today (the server's `done`). Rows with such a key are shown as done on their own. */
  done?: string[];
  /** 무료체험 campaigns (the server's `trials`): a list of its own, never part of the sums or the steps. Absent = no 「무료체험」 tab. */
  trials?: ComboTrial[];
  /** Every free-trial campaign key (sold-out and other-OS ones too): opening one of these asks for the cancel-notice consent first. */
  trialKeys?: string[];
  /** The campaigns this member already answered (`trial_consent`): key (lower case) → agreed or not. An answered one is not asked again. */
  trialConsent?: Record<string, boolean>;
  /**
   * 항목별 탭 (the server's `categories`): the tabs of the guide, in the server's order; each with its items and its own total. When there are
   * some, the guide shows these tabs instead of the easy / amount / trial tabs; without them it is the screen it always was.
   */
  categories?: ComboCategory[];
  /**
   * What the recommendation popup says (the server's `popup`, 대표님 10/27 23:09): the points of what costs nothing plus the free trials (games and shopping left out)
   * and how many missions that is. Absent = the popup is worded from `easy`, as before.
   */
  popup?: { points: number; count: number };
};
/** One row of a category: what to do (`line`, one line: for games the goal and its time limit) and what it costs (`cost`, a short phrase, none when it is free). */
export type ComboCategoryItem = {
  campaignKey: string; name: string; points: number;
  icon?: string; line?: string; cost?: string; trialDays?: number; chargeAmount?: number;
  /** this member was already paid for it today */
  done?: boolean;
};
/** One tab: `totalPoints` is the sum of the items that cost nothing (null: the tab has no total, e.g. 무료체험 · 쇼핑); `count` the server's item count. */
export type ComboCategory = { key: string; title: string; totalPoints: number | null; count: number; items: ComboCategoryItem[] };
/**
 * One free-trial campaign. Everything but key, name and points is optional: a value the server could not read is simply missing
 * (e.g. no `chargeAmount` for some), and the line then says less.
 */
export type ComboTrial = {
  campaignKey: string; name: string; points: number;
  icon?: string;
  /** free days / hours, the monthly price after the trial (won), and how many hours after joining the trial can be cancelled */
  trialDays?: number; trialHours?: number; chargeAmount?: number; cancelAfterHours?: number;
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
/** Sanity limit for the easy list (the server sends them all; this only stops a hostile body). */
const MAX_EASY = 300;

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
  // 대표님 10/27 「참여 한도가 소진된 캠페인은 오늘 목록에서 빼기」: the server's `soldout` (campaign keys whose places ran out) leaves no row behind,
  // unless this member was already paid for it today (that row stays as a done one).
  const soldout = new Set(cleanKeys(data.soldout));
  const paid = new Set(cleanKeys(data.done));
  const gone = (m: ComboMission): boolean => {
    const hits = (set: ReadonlySet<string>) => set.has(m.id) || (!!m.campaignKey && set.has(m.campaignKey));
    return soldout.size > 0 && hits(soldout) && !hits(paid);
  };
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
      if (!mission || ids.has(mission.id) || gone(mission)) continue;
      ids.add(mission.id);
      missions.push(mission);
    }
    const total = missions.reduce((sum, m) => sum + m.points, 0);
    // A bundle titled by its goal must reach it; a short one would be a wrong promise on screen (also after sold-out rows left it).
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
  const done = cleanKeys(data.done);
  const singles = cleanSingles(data.singles, goals, gone);
  const easy = cleanEasy(data.easy, gone);
  const trials = cleanTrials(data.trials, soldout, paid);
  const trialKeys = cleanKeys(data.trial_keys ?? data.trialKeys).map(k => k.toLowerCase());
  const trialConsent = cleanConsent(data.trial_consent ?? data.trialConsent);
  const categories = cleanCategories(data.categories, soldout, paid);
  const popupPoints = whole(data.popup?.points, 100_000_000_000);
  const popupCount = whole(data.popup?.count, 100_000);
  return {
    ...(date ? { date } : {}), display, bundles, ...(singles.length ? { singles } : {}), ...(easy ? { easy } : {}), ...(done.length ? { done } : {}),
    ...(trials.length ? { trials } : {}), ...(trialKeys.length ? { trialKeys } : {}), ...(Object.keys(trialConsent).length ? { trialConsent } : {}),
    ...(categories.length ? { categories } : {}),
    ...(popupPoints ? { popup: { points: popupPoints, count: popupCount } } : {}),
  };
}

/** Sanity limits for the category tabs (the server sends about 400 items in all; a game tab can have a few hundred). */
const MAX_CATEGORIES = 20;
const MAX_CATEGORY_ITEMS = 600;
/** Names for the tabs the server names by key only. */
const CATEGORY_TITLES: Record<string, string> = {
  signup: '회원가입', follow: '팔로우·구독', install: '앱 설치', trial: '무료체험', game: '게임', shop: '쇼핑', insurance: '보험', consult: '상담·조회', account: '계좌·카드', etc: '그 밖',
};
/**
 * `categories`: [{ key, title, total_points (null = none), count, items: [{ campaignKey, name, icon, points, line, done, cost, trial_days, charge_amount }] }].
 * Kept in the server's order (it is the tab order). A tab needs a key, a title (the server's, else the known name of the key) and at least one
 * usable item; an item needs a campaign key, a name and points. Sold-out keys (not ones this member was paid for) are left out; one row per key in a tab.
 */
function cleanCategories(raw: unknown, soldout: ReadonlySet<string>, paid: ReadonlySet<string>): ComboCategory[] {
  if (!Array.isArray(raw)) return [];
  const keys = new Set<string>();
  const out: ComboCategory[] = [];
  for (const entry of raw.slice(0, MAX_CATEGORIES * 2)) {
    if (out.length >= MAX_CATEGORIES) break;
    const key = text(entry?.key, 32);
    const title = text(entry?.title ?? entry?.name ?? entry?.label, 20) || CATEGORY_TITLES[key] || '';
    if (!key || !title || keys.has(key) || !Array.isArray(entry.items)) continue;
    const seen = new Set<string>();
    const items: ComboCategoryItem[] = [];
    for (const item of entry.items.slice(0, MAX_CATEGORY_ITEMS * 2)) {
      if (items.length >= MAX_CATEGORY_ITEMS) break;
      const rawKey = typeof item?.campaignKey === 'number' ? String(item.campaignKey) : item?.campaignKey ?? item?.campaign_key;
      const campaignKey = text(rawKey, 64);
      const name = text(item?.name, 60);
      const points = whole(item?.points, MAX_POINTS);
      if (!campaignKey || !name || !points || seen.has(campaignKey)) continue;
      const isDone = item.done === true;
      if (soldout.has(campaignKey) && !isDone && !paid.has(campaignKey)) continue;
      seen.add(campaignKey);
      const iconUrl = text(item.icon ?? item.icon_url, 500);
      const line = text(item.line, 80);
      const cost = text(item.cost, 40);
      const trialDays = optionalWhole(item.trial_days ?? item.trialDays, 365);
      const chargeAmount = optionalWhole(item.charge_amount ?? item.chargeAmount, 10_000_000);
      items.push({
        campaignKey, name, points,
        ...(/^https:\/\/\S+$/i.test(iconUrl) ? { icon: iconUrl } : {}), ...(line ? { line } : {}), ...(cost ? { cost } : {}),
        ...(trialDays ? { trialDays } : {}), ...(chargeAmount ? { chargeAmount } : {}), ...(isDone ? { done: true } : {}),
      });
    }
    if (!items.length) continue;
    keys.add(key);
    const totalPoints = whole(entry.total_points ?? entry.totalPoints, 100_000_000_000) || null;
    out.push({ key, title, totalPoints, count: Math.max(items.length, optionalWhole(entry.count, 100_000) ?? 0), items });
  }
  return out;
}

/** The category rows as mission-shaped rows (id = campaign key), for the check marks and the 「paid today」 mark. A campaign in two tabs is one row here. */
export function categoryMissions(combos: TodayCombos | null | undefined): ComboMission[] {
  const seen = new Set<string>();
  const out: ComboMission[] = [];
  for (const category of combos?.categories ?? []) {
    for (const item of category.items) {
      if (seen.has(item.campaignKey)) continue;
      seen.add(item.campaignKey);
      out.push({
        id: item.campaignKey, name: item.name, points: item.points, todo: item.line ?? '', level: 'easy' as ComboLevel, campaignKey: item.campaignKey,
        ...(item.icon ? { icon: item.icon } : {}),
      });
    }
  }
  return out;
}
/** The terms of a free-trial campaign for the consent popup: from the `trials` list, else from a category row that carries them. Empty when unknown. */
export function trialTerms(combos: TodayCombos | null | undefined, key: string | undefined): string {
  if (!key || !combos) return '';
  const k = key.toLowerCase();
  const trial = combos.trials?.find(x => x.campaignKey.toLowerCase() === k);
  if (trial) return trialLine(trial);
  for (const category of combos.categories ?? []) {
    const item = category.items.find(x => x.campaignKey.toLowerCase() === k);
    if (item && (item.trialDays || item.chargeAmount)) return trialLine(item);
  }
  return '';
}

/** Sanity limit for the free-trial list. */
const MAX_TRIALS = 100;
const optionalWhole = (v: unknown, max: number): number | undefined => { const n = whole(v, max); return n || undefined; };
/**
 * `trials`: [{ campaignKey, name, icon, points, trial_days, trial_hours, charge_amount, cancel_after_hours }]. A row needs a key, a name and points;
 * the rest is kept when it reads as a whole number (icon: https only). One row per key; a sold-out key (not one this member was paid for today) is dropped.
 */
function cleanTrials(raw: unknown, soldout: ReadonlySet<string>, paid: ReadonlySet<string>): ComboTrial[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ComboTrial[] = [];
  for (const item of raw.slice(0, MAX_TRIALS * 2)) {
    if (out.length >= MAX_TRIALS) break;
    const rawKey = typeof item?.campaignKey === 'number' ? String(item.campaignKey) : item?.campaignKey ?? item?.campaign_key;
    const campaignKey = text(typeof rawKey === 'number' ? String(rawKey) : rawKey, 64);
    const name = text(item?.name, 40);
    const points = whole(item?.points, MAX_POINTS);
    if (!campaignKey || !name || !points || seen.has(campaignKey)) continue;
    if (soldout.has(campaignKey) && !paid.has(campaignKey)) continue;
    seen.add(campaignKey);
    const iconUrl = text(item.icon ?? item.icon_url ?? item.iconUrl, 500);
    const trialDays = optionalWhole(item.trial_days ?? item.trialDays, 365);
    const trialHours = optionalWhole(item.trial_hours ?? item.trialHours, 8760);
    const chargeAmount = optionalWhole(item.charge_amount ?? item.chargeAmount, 10_000_000);
    const cancelAfterHours = optionalWhole(item.cancel_after_hours ?? item.cancelAfterHours, 8760);
    out.push({
      campaignKey, name, points,
      ...(/^https:\/\/\S+$/i.test(iconUrl) ? { icon: iconUrl } : {}),
      ...(trialDays ? { trialDays } : {}), ...(trialHours ? { trialHours } : {}),
      ...(chargeAmount ? { chargeAmount } : {}), ...(cancelAfterHours ? { cancelAfterHours } : {}),
    });
  }
  return out;
}
/** `trial_consent`: { "<key>": true | false }. Keys are lower-cased and kept short; only real booleans count. At most 500. */
function cleanConsent(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(0, 1000)) {
    if (Object.keys(out).length >= 500) break;
    if (typeof value !== 'boolean' || key.length > 64) continue;
    const k = text(key, 64).toLowerCase();
    if (k) out[k] = value;
  }
  return out;
}

/** 29900 → 「29,900원」 */
export function formatWon(amount: number): string {
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}
/**
 * The second line of a free-trial row: 「7일 무료 · 이후 월 16,500원」. Days win over hours (whole days are said as days); with neither,
 * just 「무료체험」; the price part is left out when the server gave none.
 */
export function trialLine(trial: Pick<ComboTrial, 'trialDays' | 'trialHours' | 'chargeAmount'>): string {
  const days = trial.trialDays ?? (trial.trialHours && trial.trialHours % 24 === 0 ? trial.trialHours / 24 : 0);
  const free = days ? `${days}일 무료` : trial.trialHours ? `${trial.trialHours}시간 무료` : '무료체험';
  return trial.chargeAmount ? `${free} · 이후 월 ${formatWon(trial.chargeAmount)}` : free;
}
/**
 * The free-trial list as mission rows: id = campaign key, the second line is 「7일 무료 · 이후 월 16,500원」. They are never in a sum; they only
 * share the number circle, the hand check and the 「already paid today」 mark with the other rows.
 */
export function trialMissions(combos: TodayCombos | null | undefined): ComboMission[] {
  return (combos?.trials ?? []).map(x => ({
    id: x.campaignKey, name: x.name, points: x.points, todo: trialLine(x), level: 'easy' as ComboLevel, campaignKey: x.campaignKey, ...(x.icon ? { icon: x.icon } : {}),
  }));
}
/** The tab's one-line note, right where the other tabs show their sum (대표님 10/27 22:29). */
export const COMBO_TRIAL_NOTE = '끝나기 전에 해지하면 무료 · 해지 안내를 받을 수 있어요';
/** Name of the free-trial tab, last in the tab row. */
export const COMBO_TRIAL_NAME = '무료체험';
/** Is this campaign key one of the free-trial campaigns (case does not matter)? */
export function isTrialKey(combos: TodayCombos | null | undefined, key: string | undefined): boolean {
  if (!key || !combos) return false;
  const k = key.toLowerCase();
  return !!combos.trialKeys?.includes(k) || !!combos.trials?.some(x => x.campaignKey.toLowerCase() === k);
}
/**
 * Does opening this campaign's detail page have to ask about cancel notices first? Yes when it is a free-trial campaign and this member
 * has not answered for it yet (neither on the server, `trial_consent`, nor in this visit, `answered`).
 */
export function needsTrialConsent(combos: TodayCombos | null | undefined, key: string | undefined, answered: ReadonlyMap<string, boolean> | Record<string, boolean> = {}): boolean {
  if (!key || !isTrialKey(combos, key)) return false;
  const k = key.toLowerCase();
  const known = answered instanceof Map ? answered.has(k) : Object.prototype.hasOwnProperty.call(answered, k);
  return !known && !(combos?.trialConsent && Object.prototype.hasOwnProperty.call(combos.trialConsent, k));
}


/** `done` (earned today) and `soldout` (places ran out): campaign keys, strings or numbers. Kept as short unique strings, at most 500. */
function cleanKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const item of raw.slice(0, 1000)) {
    if (out.size >= 500) break;
    const raw = typeof item === 'number' ? String(item) : item;
    if (typeof raw !== 'string' || raw.length > 64) continue; // too long to be a campaign key: skipped, not cut
    const key = text(raw, 64);
    if (key) out.add(key);
  }
  return [...out];
}

/**
 * Ids of the missions the server says were already paid today: a mission counts when its `campaignKey` (or, when the server
 * made the id the key, its `id`) is in `combos.done`. The guide shows these rows as done on its own (down the list, out of the
 * remaining sum, numbers counted again); ticking by hand stays for the rest.
 */
export function autoDoneIds(combos: TodayCombos | null | undefined): Set<string> {
  const ids = new Set<string>();
  if (!combos) return ids;
  // a category row the server itself marked `done` counts, even when `combos.done` does not list it
  for (const category of combos.categories ?? []) for (const item of category.items) if (item.done) ids.add(item.campaignKey);
  if (!combos.done?.length) return ids;
  const paid = new Set(combos.done);
  const rows = [...combos.bundles.flatMap(b => b.missions), ...(combos.singles ?? []).flatMap(s => s.missions), ...(combos.easy?.missions ?? []), ...trialMissions(combos), ...categoryMissions(combos)];
  for (const m of rows) if ((m.campaignKey && paid.has(m.campaignKey)) || paid.has(m.id)) ids.add(m.id);
  return ids;
}

/**
 * `easy`: { missions: [...], total_points }. Any points count (a follow may give 100P). Every different mission the server sends is kept
 * (대표님 10/27 「15개로 끊지 말고 전부」; only a sanity limit of 300 against a hostile body), so 「쉬운 미션 n개」 is the server's own count;
 * the total is recomputed from what is kept, the server's own number is never shown.
 */
function cleanEasy(raw: unknown, gone: (m: ComboMission) => boolean): ComboEasy | null {
  const list = (raw as { missions?: unknown } | null)?.missions;
  if (!Array.isArray(list)) return null;
  const ids = new Set<string>();
  const missions: ComboMission[] = [];
  for (const m of list.slice(0, MAX_EASY * 2)) {
    if (missions.length >= MAX_EASY) break;
    const mission = cleanMission(m);
    if (!mission || ids.has(mission.id) || gone(mission)) continue;
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
function cleanSingles(raw: unknown, bundleGoals: ReadonlySet<number>, gone: (m: ComboMission) => boolean): ComboSingles[] {
  if (!Array.isArray(raw)) return [];
  const byGoal = new Map<number, ComboMission[]>();
  for (const entry of raw.slice(0, 60)) {
    const goal = whole(entry?.goal);
    if (!goal || !bundleGoals.has(goal) || !Array.isArray(entry.missions)) continue;
    const list = byGoal.get(goal) ?? [];
    for (const m of entry.missions.slice(0, 12)) {
      const mission = cleanMission(m);
      if (!mission || gone(mission) || mission.points < goal || list.length >= 6 || list.some(x => x.id === mission.id)) continue;
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
/** Is this document today's? A body without a date is not (it cannot be told from yesterday's). */
export function isTodayCombos(combos: TodayCombos, now: number = Date.now()): boolean {
  return combos.date === kstDate(now);
}
/** While only an old document is at hand (the server has not built today's yet, e.g. just after midnight) the app asks again this often. */
export const COMBO_STALE_RETRY_MS = 60_000;
const withoutDoneCache = new WeakMap<TodayCombos, TodayCombos>();
/**
 * The same document with nothing marked done. An old document (the server's answer in the first minutes after midnight) still shows the day's
 * rows — the chip and the sheet must not vanish — but what the member finished *yesterday* must not look finished today, so its `done` marks go.
 * The result is cached per document, so a screen that asks on every render gets the same object back.
 */
export function withoutDone(combos: TodayCombos): TodayCombos {
  const known = withoutDoneCache.get(combos);
  if (known) return known;
  const { done: _paid, ...rest } = combos;
  const out: TodayCombos = combos.categories
    ? { ...rest, categories: combos.categories.map(category => ({ ...category, items: category.items.map(({ done: _item, ...item }) => item) })) }
    : rest;
  withoutDoneCache.set(combos, out);
  return out;
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
  /** first-come notice (always the same sentence): campaigns close when their places run out */
  notice: string;
};
/** 대표님 10/27 「선착순 안내도 추가」 — AdPopcorn campaigns have a limited number of places, so the popup says so. */
export const COMBO_POPUP_NOTICE = '선착순 · 캠페인마다 인원이 차면 끝나요';
/**
 * What the recommendation popup says, from the server's combos: the easy missions' sum as the big number (else the top goal), and
 * how many easy missions there are, with how long one takes when the server gave minutes (the middle value, so one odd mission does not decide it).
 */
export function comboPopupContent(combos: TodayCombos): ComboPopupContent {
  // the server's own sum and count (대표님 10/27 23:09 「계산이 안 맞아」): 「오늘 +N P 모을 수 있어요 · 미션 n개」 — no 「쉬운」, there is no minutes figure
  if (combos.popup) {
    return { before: '오늘 ', amount: `+${formatPoints(combos.popup.points)}`, after: ' 모을 수 있어요', sub: combos.popup.count ? `미션 ${combos.popup.count}개` : '', notice: COMBO_POPUP_NOTICE };
  }
  const easy = combos.easy;
  const top = combos.bundles.reduce((max, b) => Math.max(max, b.goal), 0);
  if (easy) {
    const minutes = easy.missions.map(m => m.minutes ?? 0).filter(n => n > 0).sort((a, b) => a - b);
    const typical = minutes.length ? minutes[Math.floor((minutes.length - 1) / 2)] : 0;
    return { before: '오늘 ', amount: `+${formatPoints(easy.total)}`, after: ' 모을 수 있어요', sub: `쉬운 미션 ${easy.missions.length}개${typical ? ` · 하나에 ${typical}분이면 끝` : ''}`, notice: COMBO_POPUP_NOTICE };
  }
  const goals = combos.bundles.map(b => formatGoal(b.goal));
  const path = goals.map((g, i) => (i < goals.length - 1 ? g.replace(/P$/, '') : g)).join(' · ');
  return { before: '오늘 ', amount: top ? formatGoal(top) : '', after: '까지 모을 수 있어요', sub: path ? `${path} 길을 차례로 모아 보세요` : '', notice: COMBO_POPUP_NOTICE };
}

/** Width the popup's headline has to fit in: a 320 card minus 22 + 22 padding. */
export const COMBO_POPUP_HEADLINE_WIDTH = 276;
/**
 * 대표님 10/27 22:27 「두 줄을 한 줄로」: the popup headline 「오늘 +5,597P 모을 수 있어요」 is one line, the number big. When the words and
 * the number do not fit the card at full size (words 18 · number 34), both shrink by the same factor (at least 0.6) so a long number
 * (6 digits) still fits. The line height is the same for the words and the number and a bit more than the number's size, so the top of the
 * big digits is never cut off (a nested text taller than its parent's line height is clipped on iOS).
 * Widths are estimated per character (Hangul 1 em, digits and letters 0.62, comma / period / space 0.3), the text itself also carries
 * `adjustsFontSizeToFit` as a net.
 */
export function popupHeadlineSizes(content: Pick<ComboPopupContent, 'before' | 'amount' | 'after'>, width: number = COMBO_POPUP_HEADLINE_WIDTH): { words: number; amount: number; line: number } {
  const em = (s: string): number => [...s].reduce((sum, ch) => sum + (/[\uAC00-\uD7A3]/.test(ch) ? 1 : /[ ,.]/.test(ch) ? 0.3 : 0.62), 0);
  const fullWords = 18, fullAmount = 34;
  const natural = em(content.before + content.after) * fullWords + em(content.amount) * fullAmount;
  const scale = natural > width ? Math.max(0.6, width / natural) : 1;
  const amount = Math.round(fullAmount * scale);
  return { words: Math.round(fullWords * scale), amount, line: Math.round(amount * 1.25) };
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

/** `stale: true` = a dated document that is not today's (shown without its done marks until today's arrives); `reason: 'stale'` = no date at all, so it cannot be used. */
export type FetchCombosResult = { ok: true; combos: TodayCombos; stale?: true } | { ok: false; reason: 'network' | 'bad_response' | 'stale' };
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
/**
 * A response body (`{ok, combos}`, `{ok, data}` or the combos themselves) → checked combos. A document of an earlier day is still used (`stale: true`,
 * without its done marks): at 00:00 the server may answer with yesterday's for a few minutes, and an empty chip is worse than yesterday's rows.
 * A body with no date at all is refused.
 */
export function parseCombosBody(body: unknown, now?: number): FetchCombosResult {
  const data = body && typeof body === 'object' ? (body as Record<string, any>) : null;
  if (!data || data.ok === false) return { ok: false, reason: 'bad_response' };
  const combos = normalizeTodayCombos(data.combos ?? data.data ?? data);
  if (!combos) return { ok: false, reason: 'bad_response' };
  if (isTodayCombos(combos, now)) return { ok: true, combos };
  return combos.date ? { ok: true, combos: withoutDone(combos), stale: true } : { ok: false, reason: 'stale' };
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

export type TodayCombosState = { status: 'loading' | 'ready' | 'empty'; combos: TodayCombos | null; reload(): void; /** quiet refetch, keeps the current rows */ refresh(): void };
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
      if (!live) return;
      // A failed refresh keeps what is on screen (a flaky network must not empty the sheet); a first load that fails shows nothing.
      setState(prev => (result.ok ? { key, status: 'ready' as const, combos: result.combos }
        : prev.key === key && prev.combos ? { ...prev, status: 'ready' as const } : { key, status: 'empty' as const, combos: null }));
    });
    return () => { live = false; };
  }, [key, tick]);
  React.useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setTick(n => n + 1), msUntilKstMidnight() + 5000);
    return () => clearTimeout(timer);
  }, [enabled, tick]);
  const reload = () => { setState(prev => ({ ...prev, status: 'loading' })); setTick(n => n + 1); };
  /** Fetches again without showing a loading state; the rows already on screen stay until the new answer arrives. */
  const refresh = () => { setTick(n => n + 1); };
  const current = state.key === key ? state : { key, ...start() };
  // Re-checked on every render. After midnight (or when the server still answers with yesterday's document) the rows stay — the chip and the
  // sheet must not vanish — but without yesterday's done marks, until today's document arrives.
  const old = !!current.combos && current.combos !== TODAY_COMBOS_SAMPLE && !isTodayCombos(current.combos);
  const shown = current.combos && old ? withoutDone(current.combos) : current.combos;
  // Only an old document at hand: ask again every minute until the server has today's (the midnight timer above does the first ask).
  React.useEffect(() => {
    if (!enabled || !old) return;
    const timer = setTimeout(() => setTick(n => n + 1), COMBO_STALE_RETRY_MS);
    return () => clearTimeout(timer);
  }, [enabled, old, tick]);
  return { status: shown ? current.status : current.status === 'loading' ? 'loading' : 'empty', combos: shown, reload, refresh };
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
  /** A row of the 「무료체험」 tab was tapped (the app asks for the cancel-notice consent, then opens the campaign). Without it `onPressMission` gets the row as a mission. */
  onPressTrial?: (trial: ComboTrial) => void;
  /** The member walked into the 무료체험 tab (called each time the tab is entered). The entry asks the cancel-notice question there. */
  onTrialTab?: () => void;
};
const NO_DONE: ReadonlySet<string> = new Set();
/**
 * 대표님 10/27 23:09 「탭이 눌릴 때도 안 눌릴 때도 있음」: a tab is pressed on a bigger area (the finger rarely lands exactly on a 34 high chip), and the sideways row
 * must not hold a touch back to see whether it is a scroll (iOS `delaysContentTouches`), nor let the sheet's own gestures take the tap.
 */
export const COMBO_TAB_HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };
export const COMBO_TAB_ROW_PROPS = { keyboardShouldPersistTaps: 'always', nestedScrollEnabled: true, directionalLockEnabled: true, scrollEventThrottle: 16 } as const;
/** First character of a name (a whole character even for emoji / surrogate pairs), for the icon fallback. */
const firstChar = (name: string): string => Array.from(name.trim())[0] ?? '·';

/**
 * A campaign's icon (`mission.icon`, https only), else the first letter of the name on a soft circle; a picture that fails to load
 * falls back to the letter too. Not used in the list rows now (they show numbers, 대표님 10/27); kept for places that want a picture.
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
 * The guide page. With the server's `categories` it is one tab per category (see comboCategories.ts); without them the steps screen
 * (쉽게 모으기 · 1천 · 5천 · 1만P · 무료체험), exactly as before. No hooks here, so the two can swap when the server's answer changes.
 */
export function ComboGuideScreen(props: ComboGuideScreenProps): ReactElement {
  const React = require('react') as typeof import('react');
  if (props.combos?.categories?.length) {
    const { ComboCategoryScreen } = require('./comboCategories') as typeof import('./comboCategories'); // loaded here: that file imports this one
    return React.createElement(ComboCategoryScreen, props);
  }
  return React.createElement(ComboStepsScreen, props);
}

/**
 * The steps screen, laid out like the shopping tab: white, a thin title row, small flat tabs (쉽게 모으기 · 1천 · 5천 · 1만P), a
 * one-line total, and a plain list: number, name + what to do, +points, a small check. The whole row is the button.
 */
export function ComboStepsScreen({ combos, loading = false, onClose, onPressMission, usn, theme = DEFAULT_COMBO_THEME, showHeader = true, topInset = 0, variant = 'page', hint = COMBO_LIST_HINT, done = NO_DONE, onToggleDone, onPressTrial, onTrialTab }: ComboGuideScreenProps): ReactElement {
  const React = require('react') as typeof import('react');
  const { View, Text, Pressable, ScrollView, BackHandler } = require('react-native') as typeof import('react-native');
  const h = React.createElement;
  const t = theme;
  const chipBg = t.chipBg ?? '#F2F4F6';
  const [notice, setNotice] = React.useState('');
  const [selected, setSelected] = React.useState<string | null>(null); // the tab's key, so a refetch that adds or removes a tab keeps the member where they are
  React.useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [onClose]);
  const bundles = combos?.bundles ?? [];
  const easy = combos?.easy;
  const trials = combos?.trials ?? [];
  const trialRows = trialMissions(combos);
  // Tabs: 「쉽게 모으기」 first when the server sent it (and it is what opens), then the steps, and 「무료체험」 last when the server sent trials.
  // The easy list is a bundle with goal 0; the trial list is not a bundle at all (no sum, nothing counted with the others).
  const tabCount = bundles.length + (easy ? 1 : 0) + (trials.length ? 1 : 0);
  const tabKeys = [...(easy ? ['easy'] : []), ...bundles.map(b => `step-${b.goal}`), ...(trials.length ? ['trials'] : [])];
  const found = selected === null ? -1 : tabKeys.indexOf(selected);
  const index = Math.min(found < 0 ? 0 : found, Math.max(0, tabCount - 1));
  const onTrials = trials.length > 0 && index === tabCount - 1;
  const onEasy = !onTrials && !!easy && index === 0;
  React.useEffect(() => { if (onTrials) onTrialTab?.(); }, [onTrials]);
  const stepIndex = index - (easy ? 1 : 0);
  const bundle: ComboBundle | undefined = onTrials ? undefined : onEasy && easy ? { goal: 0, missions: easy.missions, total: easy.total } : bundles[stepIndex];
  // Rows the server says were paid today are done on their own (their check is filled and not tappable); hand ticks work for the rest.
  const autoDone = autoDoneIds(combos);
  const isDoneId = (id: string) => done.has(id) || autoDone.has(id);
  const actionable = !!onPressMission || !!usn;
  const press = (mission: ComboMission, from: ComboBundle) => {
    if (onPressMission) { onPressMission(mission, from); return; }
    if (!usn) return;
    const result = openOfferwall({ usn });
    setNotice(result.ok ? '' : result.message);
  };
  const pressTrial = (trial: ComboTrial, mission: ComboMission) => {
    if (onPressTrial) { onPressTrial(trial); return; }
    press(mission, { goal: 0, missions: trialRows, total: trialRows.reduce((sum, m) => sum + m.points, 0) });
  };
  const todo = bundle ? bundle.missions.filter(m => !isDoneId(m.id)) : [];
  const rows = bundle ? [...todo, ...bundle.missions.filter(m => isDoneId(m.id))] : [];
  const remaining = todo.reduce((sum, m) => sum + m.points, 0);
  const allDone = !!bundle && todo.length === 0;
  const anyDone = !!bundle && todo.length < bundle.missions.length;
  // 「한 번에 끝내기」: missions that reach this step's goal on their own (hidden when the server sent none for it).
  const singles = bundle && !onEasy ? (combos?.singles?.find(s => s.goal === bundle.goal)?.missions ?? []) : [];
  const singleRows = [...singles.filter(m => !isDoneId(m.id)), ...singles.filter(m => isDoneId(m.id))];
  const side = 20;
  /** One mission row, the same look in the list and in the 「한 번에 끝내기」 list. `no` counts the ones not done yet (screen readers only). */
  const missionRow = (mission: ComboMission, index: number, no: number, forPress: ComboBundle, trial?: ComboTrial): ReactElement => {
    const isDone = isDoneId(mission.id);
    return h(Pressable, {
      key: mission.id,
      accessibilityRole: 'button',
      accessibilityLabel: isDone ? `${mission.name}, 완료`
        : `${no}번 ${mission.name}, ${formatPoints(mission.points)}, ${trial ? trialLine(trial) : COMBO_LEVEL_LABEL[mission.level]}${actionable ? ', 하러 가기' : ''}`,
      disabled: !actionable || isDone,
      onPress: () => (trial ? pressTrial(trial, mission) : press(mission, forPress)),
      style: ({ pressed }: { pressed: boolean }): import('react-native').ViewStyle => ({
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: side,
        borderTopWidth: index === 0 ? 0 : 1, borderTopColor: t.line, backgroundColor: pressed ? '#F7F8FA' : 'transparent', opacity: isDone ? 0.5 : 1,
      }),
    },
      // 대표님 10/27 「리스트 아까처럼 숫자로」: the number the user works through (restarts over the rows not done yet); a done row shows ✓.
      h(View, { accessible: false, style: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: chipBg } },
        h(Text, { style: { fontSize: 14, lineHeight: 18, fontWeight: '700', color: isDone ? t.sub : t.text } }, isDone ? '✓' : String(no))),
      h(View, { style: { flex: 1, minWidth: 0, marginLeft: 12 } },
        h(Text, { numberOfLines: 1, ellipsizeMode: 'tail', style: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: t.text, textDecorationLine: isDone ? 'line-through' : 'none' } }, mission.name),
        mission.todo ? h(Text, { numberOfLines: 1, ellipsizeMode: 'tail', style: { marginTop: 1, fontSize: 13, lineHeight: 18, color: t.sub } }, mission.todo) : null),
      h(Text, { style: { marginLeft: 8, fontSize: 15, fontWeight: '800', color: t.point } }, `+${formatPoints(mission.points)}`),
      onToggleDone ? h(Pressable, {
        accessibilityRole: 'checkbox', accessibilityState: { checked: isDone, disabled: autoDone.has(mission.id) }, accessibilityLabel: `${mission.name} 완료 표시`,
        disabled: autoDone.has(mission.id), onPress: () => onToggleDone(mission.id), hitSlop: 10,
        style: {
          marginLeft: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
          backgroundColor: isDone ? t.accentText : 'transparent', borderWidth: isDone ? 0 : 1.5, borderColor: '#D1D6DB',
        },
      }, isDone ? h(Text, { style: { fontSize: 13, lineHeight: 16, fontWeight: '900', color: '#FFFFFF' } }, '✓') : null) : null);
  };
  let nextNo = 0;
  let nextSingleNo = 0;
  let nextTrialNo = 0;
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
    h(ScrollView, { contentContainerStyle: { paddingBottom: 32 }, keyboardShouldPersistTaps: 'handled' },
      tabCount > 1 ? h(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, ...COMBO_TAB_ROW_PROPS, style: { flexGrow: 0 }, contentContainerStyle: { paddingHorizontal: side, paddingVertical: 4, gap: 8, alignItems: 'center' } },
        [...(easy ? [null] : []), ...bundles, ...(trials.length ? ['trials' as const] : [])].map((b, i) => {
          const on = i === index;
          const isEasyTab = b === null;
          const isTrialTab = b === 'trials';
          const step = i - (easy ? 1 : 0);
          const label = isEasyTab ? COMBO_EASY_NAME : isTrialTab ? COMBO_TRIAL_NAME : formatGoal(b.goal);
          return h(Pressable, {
            key: isEasyTab ? 'easy' : isTrialTab ? 'trials' : `step-${b.goal}`, accessibilityRole: 'button', accessibilityState: { selected: on },
            accessibilityLabel: isEasyTab ? COMBO_EASY_NAME : isTrialTab ? COMBO_TRIAL_NAME : `${step + 1}단계 ${formatGoal(b.goal)}`, onPress: () => setSelected(tabKeys[i] ?? null),
            hitSlop: COMBO_TAB_HIT_SLOP,
            style: ({ pressed }: { pressed: boolean }): import('react-native').ViewStyle => ({ height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? (on ? '#FFE6A8' : '#E4E7EB') : on ? t.accentSoft : chipBg }),
          }, h(Text, { style: { fontSize: 14, fontWeight: '600', color: on ? t.accentText : t.sub } }, label));
        })) : null,
      // 「무료체험」 tab: one line about cancelling, then the rows in the same numbered look; no sum (it is not counted with the steps)
      onTrials ? h(View, { key: 'trials' },
        h(Text, { style: { paddingHorizontal: side, paddingTop: 14, paddingBottom: 6, fontSize: 13, lineHeight: 18, color: t.sub } }, COMBO_TRIAL_NOTE),
        [...trialRows.filter(m => !isDoneId(m.id)), ...trialRows.filter(m => isDoneId(m.id))].map((mission, i) => missionRow(
          mission, i, isDoneId(mission.id) ? 0 : ++nextTrialNo, { goal: 0, missions: [mission], total: mission.points }, trials.find(x => x.campaignKey === mission.id))),
        h(Text, { style: { paddingHorizontal: side, paddingTop: 18, fontSize: 12, lineHeight: 18, color: t.sub } }, '무료체험은 기간이 끝나면 자동으로 결제돼요. 끝나기 전에 꼭 해지해 주세요. 이 목록의 포인트는 위 합계에 들어가지 않고 따로 계산해요.')) : null,
      // the sum as one line: what is left (or what finishing everything gives)
      bundle ? h(View, { style: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: side, paddingTop: 14, paddingBottom: 6, gap: 6 } },
        h(Text, { style: { fontSize: 13, color: t.sub } }, allDone ? '모두 마쳤어요' : anyDone ? '남은 합계' : onEasy ? '다 하면' : '합계'),
        allDone ? null : h(Text, { style: { fontSize: 16, fontWeight: '800', color: t.point } }, onEasy ? `+${formatPoints(remaining)}` : formatPoints(remaining))) : null,
      actionable && !onPressMission && hint && bundle ? h(Text, { style: { paddingHorizontal: side, paddingBottom: 6, fontSize: 12, lineHeight: 18, color: t.sub } }, hint) : null,
      bundle ? h(View, { key: String(bundle.goal) },
        rows.map((mission, i) => missionRow(mission, i, isDoneId(mission.id) ? 0 : ++nextNo, bundle))) : null,
      // 「한 번에 끝내기」: a second list under the step's, one mission is enough to reach the goal. Hidden when the server sent none.
      bundle && singleRows.length ? h(View, { key: `singles-${bundle.goal}`, style: { marginTop: 22 } },
        h(View, { style: { paddingHorizontal: side, paddingBottom: 6 } },
          h(Text, { accessibilityRole: 'header', style: { fontSize: 16, fontWeight: '700', color: t.text } }, '한 번에 끝내기'),
          h(Text, { style: { marginTop: 2, fontSize: 13, color: t.sub } }, `아래 중 하나만 해도 ${formatPoints(bundle.goal)}를 채워요`)),
        singleRows.map((mission, i) => missionRow(
          mission, i, isDoneId(mission.id) ? 0 : ++nextSingleNo,
          { goal: bundle.goal, missions: [mission], total: mission.points }))) : null,
      !bundle && !onTrials ? h(Text, { style: { marginTop: 48, fontSize: 15, lineHeight: 22, textAlign: 'center', color: t.sub } },
        loading ? '불러오고 있어요' : '지금은 준비하고 있어요.\n잠시 뒤에 다시 확인해 주세요.') : null,
      bundle ? h(Text, { style: { paddingHorizontal: side, paddingTop: 18, fontSize: 12, lineHeight: 18, color: t.sub } }, '합계는 표시된 항목을 모두 마쳤을 때 기준이에요. 오늘 하루 기준이고 내일은 새로 바뀌어요. 항목마다 참여 조건이 달라서, 눌러서 안내를 꼭 확인해 주세요.') : null,
      notice ? h(Text, { style: { paddingHorizontal: side, paddingTop: 10, fontSize: 14, fontWeight: '700', color: '#E5484D' } }, notice) : null));
}
