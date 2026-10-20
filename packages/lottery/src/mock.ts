import type { LotteryError, LotteryWinner, Requester } from './lottery';

/**
 * 시험 모드용 가짜 서버 — **서버가 꺼져 있어도 칩 · 시트 · 결과 · 황금 팝업을 시뮬에서 볼 수 있게** 한다(앱관리 · 앱총괄 요청, 감자밭 시뮬 확인).
 * `useLottery(mock.fetchJson)` 처럼 요청 함수 자리에 꽂는다 — 패키지는 아무것도 가로채지 않는다(앱이 시험 모드에서만 꽂는다. 운영 빌드에는 꽂지 않는다).
 * 서버(jcurve-api lottery/*)와 같은 응답 모양 · 오류 이름이고, 규칙도 같다: 단계별 기준 미션 수, 하루에 단계마다 한 장, 황금(기본) 복권은 광고 확인(grantAd)이 있어야 열림,
 * 같은 멱등 키는 저장된 결과를 다시 줌(다른 단계 · src 면 key_conflict). 금액 · 확률은 시험용 값이다 — 실제 값은 서버(어드민 설정)가 정한다.
 */
export type MockLotteryOptions = {
  /** 오늘 참여한 쇼핑 · 플레이스 미션 수(기본 0) */
  participated?: number;
  /** 매일 기본(황금) 복권을 줄지(기본 true) — 마지막 단계 금액의 복권 1장, 광고 확인이 있어야 열린다 */
  golden?: boolean;
  /**
   * 황금 복권을 광고 확인 없이 열지 — **기본 true**(시뮬 · 테스트 광고는 SSV 를 못 받는다). 서버처럼 광고 확인을 요구해 `ad_required` 를 보고 싶으면 false 로 두고 grantAd 로 한 건씩 준다.
   */
  adFree?: boolean;
  /** 100원당 P(기본 160) */
  wonToPoint?: number;
  /** 단계 — 기본 미션 1 · 5 · 10개 → 최대 100 · 500 · 1000원 */
  tiers?: { missions: number; max: number; prizes?: { won: number; weight: number }[] }[];
  winners?: LotteryWinner[];
  /** 추첨을 같게 하려는 시험용 씨앗(없으면 Math.random) */
  seed?: number;
  /** 응답을 이만큼 늦춘다(ms, 기본 0) — 로딩 모양 확인용 */
  latencyMs?: number;
  /** true 면 서버가 꺼진 것처럼 404 off */
  off?: boolean;
};

export type MockLotteryApi = {
  fetchJson: Requester;
  /** 오늘 참여한 미션 수를 바꾼다(기준을 채우면 다음 state 읽기 때 복권이 생긴다) */
  setParticipated: (n: number) => void;
  /** 광고 시청 확인 한 건을 준다(황금 복권을 열 때 소비된다) */
  grantAd: () => void;
  /** 처음 상태로 */
  reset: () => void;
  /** 받은 요청 기록(경로 · 본문) — 시험에서 무엇을 불렀나 확인 */
  calls: { path: string; body?: unknown }[];
};

type Ticket = { src: 'mission' | 'basic'; slot: number; tier: number; max: number; status: 'unopened' | 'opened'; won?: number; points?: number; key?: string; req?: string; result?: Record<string, unknown> };

const DEFAULT_TIERS = [
  { missions: 1, max: 100, prizes: [{ won: 10, weight: 50 }, { won: 20, weight: 25 }, { won: 30, weight: 15 }, { won: 50, weight: 7 }, { won: 100, weight: 3 }] },
  { missions: 5, max: 500, prizes: [{ won: 50, weight: 45 }, { won: 100, weight: 28 }, { won: 150, weight: 15 }, { won: 250, weight: 8 }, { won: 500, weight: 4 }] },
  { missions: 10, max: 1000, prizes: [{ won: 100, weight: 45 }, { won: 200, weight: 28 }, { won: 300, weight: 15 }, { won: 500, weight: 8 }, { won: 1000, weight: 4 }] },
];

function rng(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let a = seed >>> 0;

  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const fail = (error: LotteryError, status: number) => Object.assign(new Error(error), { error, status });

export function createMockLotteryApi(opts: MockLotteryOptions = {}): MockLotteryApi {
  const tiers = (opts.tiers ?? DEFAULT_TIERS).map((t, i) => ({ tier: i + 1, missions: t.missions, max: t.max, prizes: t.prizes ?? DEFAULT_TIERS[Math.min(i, 2)].prizes }));
  const wtp = opts.wonToPoint ?? 160;
  let participated = opts.participated ?? 0;
  let ads = 0;
  let balance = 1000;
  let tickets: Ticket[] = [];
  const calls: MockLotteryApi['calls'] = [];
  let random = rng(opts.seed);
  const golden = opts.golden ?? true;

  const sync = () => {
    for (const t of tiers) {
      if (participated >= t.missions && !tickets.some(x => x.src === 'mission' && x.slot === t.tier)) tickets.push({ src: 'mission', slot: t.tier, tier: t.tier, max: t.max, status: 'unopened' });
    }
    if (golden && !tickets.some(x => x.src === 'basic')) {
      const last = tiers[tiers.length - 1];
      tickets.push({ src: 'basic', slot: 1, tier: last.tier, max: last.max, status: 'unopened' });
    }
  };
  const unopened = () => tickets.filter(x => x.status === 'unopened').length;

  const state = () => {
    sync();

    return {
      ok: true, day: '시험', wonToPoint: wtp, participated, unopened: unopened(),
      tiers: tiers.map(t => {
        const mine = tickets.filter(x => x.tier === t.tier);
        const open = mine.filter(x => x.status === 'unopened').length;
        const mk = mine.find(x => x.src === 'mission');
        const last = [...mine].reverse().find(x => x.status === 'opened');
        return {
          tier: t.tier, missions: t.missions, maxWon: t.max, maxPoints: Math.floor(t.max * wtp / 100),
          state: open > 0 ? 'ready' : mine.length > 0 ? 'opened' : 'locked',
          missionState: mk ? (mk.status === 'opened' ? 'opened' : 'ready') : 'locked',
          missionsLeft: Math.max(0, t.missions - participated), tickets: mine.length, unopened: open,
          basic: mine.filter(x => x.src === 'basic').length, basicUnopened: mine.filter(x => x.src === 'basic' && x.status === 'unopened').length,
          prize: last ? { won: last.won, points: last.points } : null,
        };
      }),
    };
  };

  const open = (body: { tier?: unknown; idempotency_key?: unknown; src?: unknown }) => {
    const key = body.idempotency_key;
    if (key === undefined || key === '') throw fail('key_required', 422);
    if (typeof key !== 'string' || !/^[A-Za-z0-9_.:\-]{1,64}$/.test(key)) throw fail('bad_key', 422);
    const tier = tiers.find(t => t.tier === body.tier);
    if (!tier) throw fail('bad_tier', 422);
    if (body.src !== undefined && body.src !== '' && body.src !== 'basic' && body.src !== 'mission') throw fail('bad_src', 422);
    const src = body.src === 'basic' || body.src === 'mission' ? body.src : undefined;
    const req = tier.tier + ':' + (src ?? '');
    const byKey = tickets.find(x => x.key === key);
    if (byKey) {
      if (byKey.req !== req) throw fail('key_conflict', 409);
      return { ...byKey.result, replayed: true, unopened: unopened() };
    }
    sync();
    const mine = tickets.filter(x => x.tier === tier.tier && (!src || x.src === src)).sort((a, b) => (a.src < b.src ? 1 : a.src > b.src ? -1 : a.slot - b.slot));
    if (mine.length === 0) throw fail('not_reached', 409);
    const tk = mine.find(x => x.status === 'unopened');
    if (!tk) throw fail('already_opened', 409);
    if (tk.src === 'basic' && opts.adFree === false) {
      if (ads <= 0) throw fail('ad_required', 409);
      ads--;
    }
    const total = tier.prizes.reduce((s, p) => s + p.weight, 0);
    let r = random() * total;
    let prize = tier.prizes[tier.prizes.length - 1];
    for (const p of tier.prizes) { r -= p.weight; if (r <= 0 && p.weight > 0) { prize = p; break; } }
    const points = Math.floor(prize.won * wtp / 100);
    balance += points;
    const result = { ok: true, tier: tier.tier, maxWon: tier.max, won: prize.won, points, balance, replayed: false };
    Object.assign(tk, { status: 'opened', won: prize.won, points, key, req, result });

    return { ...result, unopened: unopened() };
  };

  const fetchJson: Requester = async (path, options) => {
    calls.push({ path, body: options?.body });
    if (opts.latencyMs) await new Promise(r => setTimeout(r, opts.latencyMs));
    if (opts.off) throw fail('off', 404);
    if (path === 'lottery/state') return state();
    if (path === 'lottery/open') return open((options?.body ?? {}) as Record<string, unknown>);
    if (path === 'lottery/winners') {
      return { ok: true, items: opts.winners ?? [{ nick: '김철****', tierMax: 500, won: 250 }, { nick: '푸른소****', tierMax: 100, won: 30 }] };
    }
    throw fail('off', 404);
  };

  return {
    fetchJson,
    setParticipated: n => { participated = Math.max(0, Math.floor(n)); },
    grantAd: () => { ads++; },
    reset: () => { participated = opts.participated ?? 0; ads = 0; balance = 1000; tickets = []; calls.length = 0; random = rng(opts.seed); },
    calls,
  };
}
