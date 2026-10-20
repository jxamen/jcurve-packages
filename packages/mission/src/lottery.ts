/**
 * (0.6.0) 공용 복권 — 대표님 2026-10-20 14:08 「미션 하나 참여하면 최대 100원 · 다섯 개 500원 · 열 개 1000원」 + 14:15 「황금 복권이 기본으로」.
 * 서버(jcurve-api feat/lottery-server)가 장부 · 지급 · 추첨을 모두 하고, 이 파일은 응답을 읽고 문구를 만들고 열기 요청을 보낸다.
 * react-native 를 가져오지 않는다(시험이 바로 돈다). 규칙 · 금액 · 확률은 서버(어드민 설정)가 정한다 — 여기에는 없다.
 */
import type { Requester } from './entry';

export type LotteryTierState = 'locked' | 'ready' | 'opened' | 'capped';

export type LotteryTier = {
  /** 단계 번호(1부터, 서버 설정 순서) — open 에 그대로 넘긴다 */
  tier: number;
  /** 이 단계를 받는 서로 다른 쇼핑 · 플레이스 미션 수 */
  missions: number;
  maxWon: number;
  maxPoints: number;
  /** 이 단계의 복권 상태(미션 · 매일 기본 복권 합쳐서): ready = 열 수 있는 게 있음 · opened = 다 엶 · capped = 기준은 채웠지만 하루 한도로 못 받음 · locked = 아직 */
  state: LotteryTierState;
  /** 미션으로 받는 복권만의 상태 — 황금(기본) 복권이 같은 단계에 있어도 「미션 N개 더」를 따로 보여 준다 */
  missionState: LotteryTierState;
  missionsLeft: number;
  tickets: number;
  unopened: number;
  /** 이 단계의 매일 기본(황금) 복권 수 · 안 연 수 */
  basic: number;
  basicUnopened: number;
  prize: { won: number; points: number } | null;
};

export type LotteryState = {
  day: string;
  /** 100원당 P(160 = 1원 1.6P) */
  wonToPoint: number;
  participated: number;
  tiers: LotteryTier[];
  unopened: number;
};

export type LotteryOpenResult = { tier: number; maxWon: number; won: number; points: number; balance: number; replayed: boolean; unopened: number };
export type LotteryWinner = { nick: string; tierMax: number; won: number };

export type LotteryError =
  | 'off' | 'not_ready' | 'not_reached' | 'already_opened' | 'key_conflict' | 'ad_required' | 'key_required' | 'bad_key' | 'bad_tier' | 'bad_src'
  | 'network' | 'busy' | 'invalid';

const STATES: readonly LotteryTierState[] = ['locked', 'ready', 'opened', 'capped'];
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const state = (v: unknown, fallback: LotteryTierState): LotteryTierState => (STATES as readonly unknown[]).includes(v) ? (v as LotteryTierState) : fallback;

/** 서버 응답을 믿지 않고 다시 읽는다 — 꺼진 앱(ok 아님) · 깨진 응답은 null(칩이 안 보인다) */
export function parseLotteryState(response: unknown): LotteryState | null {
  const r = response as { ok?: unknown; day?: unknown; wonToPoint?: unknown; participated?: unknown; tiers?: unknown; unopened?: unknown } | null;
  if (!r || typeof r !== 'object' || r.ok !== true || !Array.isArray(r.tiers)) return null;
  const tiers: LotteryTier[] = [];
  for (const raw of r.tiers) {
    const t = raw as Record<string, unknown> | null;
    if (!t || typeof t !== 'object' || !Number.isInteger(t.tier) || (t.tier as number) < 1) continue;
    const st = state(t.state, 'locked');
    const prize = t.prize as { won?: unknown; points?: unknown } | null;
    tiers.push({
      tier: t.tier as number, missions: num(t.missions), maxWon: num(t.maxWon), maxPoints: num(t.maxPoints), state: st, missionState: state(t.missionState, st),
      missionsLeft: Math.max(0, num(t.missionsLeft)), tickets: Math.max(0, num(t.tickets)), unopened: Math.max(0, num(t.unopened)),
      basic: Math.max(0, num(t.basic)), basicUnopened: Math.max(0, num(t.basicUnopened)),
      prize: prize && typeof prize === 'object' ? { won: num(prize.won), points: num(prize.points) } : null,
    });
  }
  if (tiers.length === 0) return null;
  tiers.sort((a, b) => a.tier - b.tier);

  return { day: typeof r.day === 'string' ? r.day : '', wonToPoint: num(r.wonToPoint), participated: Math.max(0, num(r.participated)), tiers, unopened: Math.max(0, num(r.unopened)) };
}

export function parseWinners(response: unknown): LotteryWinner[] {
  const r = response as { ok?: unknown; items?: unknown } | null;
  if (!r || r.ok !== true || !Array.isArray(r.items)) return [];
  const out: LotteryWinner[] = [];
  for (const raw of r.items.slice(0, 20)) {
    const w = raw as { nick?: unknown; tierMax?: unknown; won?: unknown } | null;
    if (w && typeof w.nick === 'string' && w.nick !== '') out.push({ nick: w.nick, tierMax: num(w.tierMax), won: num(w.won) });
  }

  return out;
}

/** 던져진 오류 · 응답 본문에서 서버 오류 이름을 읽는다(entry.ts 와 같은 규칙) */
function errorOf(e: unknown): LotteryError {
  const x = e as { status?: unknown; error?: unknown; data?: { error?: unknown }; body?: { error?: unknown } } | null;
  const name = String(x?.error ?? x?.data?.error ?? x?.body?.error ?? '');
  const known: readonly string[] = ['off', 'not_ready', 'not_reached', 'already_opened', 'key_conflict', 'ad_required', 'key_required', 'bad_key', 'bad_tier', 'bad_src'];
  if (known.includes(name)) return name as LotteryError;
  if (x?.status === 404) return 'off';
  if (x?.status === 503) return 'not_ready';

  return 'network';
}

/** GET lottery/state — 꺼졌거나 실패하면 null(복권 칩을 그리지 않는다). 읽는 순간 서버가 오늘 줄 복권을 만든다 */
export async function fetchLotteryState(fetchJson: Requester): Promise<LotteryState | null> {
  try {
    return parseLotteryState(await fetchJson('lottery/state', { method: 'GET' }));
  } catch {
    return null;
  }
}

export async function fetchLotteryWinners(fetchJson: Requester): Promise<LotteryWinner[]> {
  try {
    return parseWinners(await fetchJson('lottery/winners', { method: 'GET' }));
  } catch {
    return [];
  }
}

/** 열기 요청마다 새 멱등 키 — 같은 시도를 다시 보낼 때만 같은 키를 쓴다(createLotteryOpener) */
export function newLotteryKey(): string {
  return 'lot-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export type OpenOutcome = { ok: true; result: LotteryOpenResult } | { ok: false; error: LotteryError };

/** POST lottery/open — `src: 'basic'` 는 황금(기본) 복권(서버가 광고 시청 확인을 소비한다), 안 주면 미션 복권을 먼저 연다 */
export async function openLottery(fetchJson: Requester, args: { tier: number; key: string; src?: 'basic' | 'mission' }): Promise<OpenOutcome> {
  let r: unknown;
  try {
    r = await fetchJson('lottery/open', { method: 'POST', body: { tier: args.tier, idempotency_key: args.key, ...(args.src ? { src: args.src } : {}) } });
  } catch (e) {
    return { ok: false, error: errorOf(e) };
  }
  const j = r as { ok?: unknown; tier?: unknown; maxWon?: unknown; won?: unknown; points?: unknown; balance?: unknown; replayed?: unknown; unopened?: unknown; error?: unknown } | null;
  if (j?.ok === true && typeof j.won === 'number' && typeof j.points === 'number') {
    return { ok: true, result: { tier: num(j.tier), maxWon: num(j.maxWon), won: j.won, points: j.points, balance: num(j.balance), replayed: j.replayed === true, unopened: Math.max(0, num(j.unopened)) } };
  }

  return { ok: false, error: j?.ok === false ? errorOf(j) : 'invalid' };
}

/**
 * 열기 함수 — **한 번에 하나만**, 네트워크가 끊겨 다시 보낼 때는 같은 키(서버가 저장된 결과를 다시 준다), 서버가 답을 준 뒤에는 키를 버린다.
 * 잠금(busy)은 끝나면 반드시 풀린다(finally) — 이동 · 실패 · 취소를 기다리지 않는다(0.4.3 와 같은 규칙).
 */
export function createLotteryOpener(fetchJson: Requester): (tier: number, src?: 'basic' | 'mission') => Promise<OpenOutcome> {
  const keys = new Map<string, string>();
  let busy = false;

  return async (tier, src) => {
    if (busy) return { ok: false, error: 'busy' };
    busy = true;
    try {
      const slot = tier + ':' + (src ?? '');
      const key = keys.get(slot) ?? newLotteryKey();
      keys.set(slot, key);
      const out = await openLottery(fetchJson, { tier, key, src });
      if (out.ok || out.error !== 'network') keys.delete(slot);

      return out;
    } finally {
      busy = false;
    }
  };
}

// ── 문구 ──────────────────────────────────────────────────────────────

export const lotteryTierTitle = (t: Pick<LotteryTier, 'maxWon'>): string => '최대 ' + t.maxWon.toLocaleString('ko-KR') + '원 복권';

/** 단계 줄 설명 — 황금(기본) 복권이 있는 단계는 그 안내, 아니면 미션 기준 */
export function lotteryTierHint(t: LotteryTier): string {
  if (t.basic > 0 && t.missionState === 'locked' && t.missionsLeft <= 0) return '황금 복권을 이용해서 얻을 수 있어요';
  if (t.missionState === 'ready' || t.missionState === 'opened') return '쇼핑 · 플레이스 미션 ' + t.missions + '개 참여로 받았어요';
  if (t.missionState === 'capped') return '오늘 받을 수 있는 복권을 모두 받았어요';
  const base = t.missionsLeft > 0 && t.missionsLeft < t.missions ? '미션 ' + t.missionsLeft + '개 더 하면 받아요' : '쇼핑 · 플레이스 미션 ' + t.missions + '개 참여하면 받아요';

  return t.basic > 0 ? '황금 복권이나 ' + base : base;
}

/** 단계 줄 버튼 — ready 면 「열기」, 다 열었으면 「획득 완료」, 못 받은 단계는 「받기」(미션으로 가기), 하루 한도에 막힌 단계는 「내일 받아요」 */
export function lotteryTierButton(t: Pick<LotteryTier, 'state'>): { label: string; kind: 'open' | 'earn' | 'done' | 'wait' } {
  if (t.state === 'ready') return { label: '열기', kind: 'open' };
  if (t.state === 'opened') return { label: '획득 완료', kind: 'done' };
  if (t.state === 'capped') return { label: '내일 받아요', kind: 'wait' };

  return { label: '받기', kind: 'earn' };
}

/** 아직 못 받은 가장 가까운 단계 — 「한 번 더! ○원 복권 받기」 · 「미션 N개 더 하면」 */
export function nextTierToEarn(s: LotteryState): LotteryTier | null {
  return s.tiers.find(t => t.missionState === 'locked') ?? null;
}

export function lotteryMoreLabel(s: LotteryState): string | null {
  const t = nextTierToEarn(s);

  return t ? '한 번 더! ' + t.maxWon.toLocaleString('ko-KR') + '원 복권 받기' : null;
}

/** 결과 창 제목 — 「축하해요 보상 ○P 당첨!」 */
export const lotteryResultTitle = (points: number): string => '축하해요 보상 ' + points.toLocaleString('ko-KR') + 'P 당첨!';

/** 결과 창에서 남은 복권이 없을 때 잇는 버튼 — 「미션 하고 복권 더 받기」(다음 단계까지 남은 미션 수) */
export function lotteryMoreMissionLabel(s: LotteryState): string | null {
  const t = nextTierToEarn(s);
  if (!t) return null;

  return t.missionsLeft > 0 ? '미션 ' + t.missionsLeft + '개 더 하고 ' + t.maxWon.toLocaleString('ko-KR') + '원 복권 받기' : '미션 하고 복권 더 받기';
}

export const lotteryWinnerLine = (w: LotteryWinner): string => w.nick + '님이 ' + w.tierMax.toLocaleString('ko-KR') + '원 복권에 당첨됐어요!';

/** 안 연 복권이 있을 때만 칩을 그린다 — 다 열면 사라진다 */
export const lotteryChipCount = (s: LotteryState | null): number => (s ? s.unopened : 0);

/** 황금(기본) 복권 팝업 대상 — 안 연 기본 복권이 있는 단계(없으면 null) */
export function goldenTier(s: LotteryState | null): LotteryTier | null {
  return s?.tiers.find(t => t.basicUnopened > 0) ?? null;
}

/** 열 수 있는 단계 — 이 단계의 복권이 하나라도 안 열렸다 */
export function readyTiers(s: LotteryState | null): LotteryTier[] {
  return s ? s.tiers.filter(t => t.unopened > 0) : [];
}
