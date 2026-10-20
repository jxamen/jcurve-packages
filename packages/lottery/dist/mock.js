"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockLotteryApi = createMockLotteryApi;
const DEFAULT_TIERS = [
    { missions: 1, max: 100, prizes: [{ won: 10, weight: 50 }, { won: 20, weight: 25 }, { won: 30, weight: 15 }, { won: 50, weight: 7 }, { won: 100, weight: 3 }] },
    { missions: 5, max: 500, prizes: [{ won: 50, weight: 45 }, { won: 100, weight: 28 }, { won: 150, weight: 15 }, { won: 250, weight: 8 }, { won: 500, weight: 4 }] },
    { missions: 10, max: 1000, prizes: [{ won: 100, weight: 45 }, { won: 200, weight: 28 }, { won: 300, weight: 15 }, { won: 500, weight: 8 }, { won: 1000, weight: 4 }] },
];
function rng(seed) {
    if (seed === undefined)
        return Math.random;
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const fail = (error, status) => Object.assign(new Error(error), { error, status });
function createMockLotteryApi(opts = {}) {
    const tiers = (opts.tiers ?? DEFAULT_TIERS).map((t, i) => ({ tier: i + 1, missions: t.missions, max: t.max, prizes: t.prizes ?? DEFAULT_TIERS[Math.min(i, 2)].prizes }));
    const wtp = opts.wonToPoint ?? 160;
    let participated = opts.participated ?? 0;
    let ads = 0;
    let balance = 1000;
    let tickets = [];
    const calls = [];
    let random = rng(opts.seed);
    const golden = opts.golden ?? true;
    const sync = () => {
        for (const t of tiers) {
            if (participated >= t.missions && !tickets.some(x => x.src === 'mission' && x.slot === t.tier))
                tickets.push({ src: 'mission', slot: t.tier, tier: t.tier, max: t.max, status: 'unopened' });
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
    const open = (body) => {
        const key = body.idempotency_key;
        if (key === undefined || key === '')
            throw fail('key_required', 422);
        if (typeof key !== 'string' || !/^[A-Za-z0-9_.:\-]{1,64}$/.test(key))
            throw fail('bad_key', 422);
        const tier = tiers.find(t => t.tier === body.tier);
        if (!tier)
            throw fail('bad_tier', 422);
        if (body.src !== undefined && body.src !== '' && body.src !== 'basic' && body.src !== 'mission')
            throw fail('bad_src', 422);
        const src = body.src === 'basic' || body.src === 'mission' ? body.src : undefined;
        const req = tier.tier + ':' + (src ?? '');
        const byKey = tickets.find(x => x.key === key);
        if (byKey) {
            if (byKey.req !== req)
                throw fail('key_conflict', 409);
            return { ...byKey.result, replayed: true, unopened: unopened() };
        }
        sync();
        const mine = tickets.filter(x => x.tier === tier.tier && (!src || x.src === src)).sort((a, b) => (a.src < b.src ? 1 : a.src > b.src ? -1 : a.slot - b.slot));
        if (mine.length === 0)
            throw fail('not_reached', 409);
        const tk = mine.find(x => x.status === 'unopened');
        if (!tk)
            throw fail('already_opened', 409);
        if (tk.src === 'basic' && !opts.adFree) {
            if (ads <= 0)
                throw fail('ad_required', 409);
            ads--;
        }
        const total = tier.prizes.reduce((s, p) => s + p.weight, 0);
        let r = random() * total;
        let prize = tier.prizes[tier.prizes.length - 1];
        for (const p of tier.prizes) {
            r -= p.weight;
            if (r <= 0 && p.weight > 0) {
                prize = p;
                break;
            }
        }
        const points = Math.floor(prize.won * wtp / 100);
        balance += points;
        const result = { ok: true, tier: tier.tier, maxWon: tier.max, won: prize.won, points, balance, replayed: false };
        Object.assign(tk, { status: 'opened', won: prize.won, points, key, req, result });
        return { ...result, unopened: unopened() };
    };
    const fetchJson = async (path, options) => {
        calls.push({ path, body: options?.body });
        if (opts.latencyMs)
            await new Promise(r => setTimeout(r, opts.latencyMs));
        if (opts.off)
            throw fail('off', 404);
        if (path === 'lottery/state')
            return state();
        if (path === 'lottery/open')
            return open((options?.body ?? {}));
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
