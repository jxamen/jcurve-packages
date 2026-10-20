"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lotteryChipCount = exports.lotteryWinnerLine = exports.lotteryResultTitle = exports.lotteryTierTitle = void 0;
exports.parseLotteryState = parseLotteryState;
exports.parseWinners = parseWinners;
exports.fetchLotteryState = fetchLotteryState;
exports.fetchLotteryWinners = fetchLotteryWinners;
exports.newLotteryKey = newLotteryKey;
exports.openLottery = openLottery;
exports.createLotteryOpener = createLotteryOpener;
exports.lotteryTierHint = lotteryTierHint;
exports.lotteryTierButton = lotteryTierButton;
exports.nextTierToEarn = nextTierToEarn;
exports.lotteryMoreLabel = lotteryMoreLabel;
exports.lotteryMoreMissionLabel = lotteryMoreMissionLabel;
exports.goldenTier = goldenTier;
exports.readyTiers = readyTiers;
const STATES = ['locked', 'ready', 'opened', 'capped'];
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const state = (v, fallback) => STATES.includes(v) ? v : fallback;
/** 서버 응답을 믿지 않고 다시 읽는다 — 꺼진 앱(ok 아님) · 깨진 응답은 null(칩이 안 보인다) */
function parseLotteryState(response) {
    const r = response;
    if (!r || typeof r !== 'object' || r.ok !== true || !Array.isArray(r.tiers))
        return null;
    const tiers = [];
    for (const raw of r.tiers) {
        const t = raw;
        if (!t || typeof t !== 'object' || !Number.isInteger(t.tier) || t.tier < 1)
            continue;
        const st = state(t.state, 'locked');
        const prize = t.prize;
        tiers.push({
            tier: t.tier, missions: num(t.missions), maxWon: num(t.maxWon), maxPoints: num(t.maxPoints), state: st, missionState: state(t.missionState, st),
            missionsLeft: Math.max(0, num(t.missionsLeft)), tickets: Math.max(0, num(t.tickets)), unopened: Math.max(0, num(t.unopened)),
            basic: Math.max(0, num(t.basic)), basicUnopened: Math.max(0, num(t.basicUnopened)),
            prize: prize && typeof prize === 'object' ? { won: num(prize.won), points: num(prize.points) } : null,
        });
    }
    if (tiers.length === 0)
        return null;
    tiers.sort((a, b) => a.tier - b.tier);
    return { day: typeof r.day === 'string' ? r.day : '', wonToPoint: num(r.wonToPoint), participated: Math.max(0, num(r.participated)), tiers, unopened: Math.max(0, num(r.unopened)) };
}
function parseWinners(response) {
    const r = response;
    if (!r || r.ok !== true || !Array.isArray(r.items))
        return [];
    const out = [];
    for (const raw of r.items.slice(0, 20)) {
        const w = raw;
        if (w && typeof w.nick === 'string' && w.nick !== '')
            out.push({ nick: w.nick, tierMax: num(w.tierMax), won: num(w.won) });
    }
    return out;
}
/** 던져진 오류 · 응답 본문에서 서버 오류 이름을 읽는다(entry.ts 와 같은 규칙) */
function errorOf(e) {
    const x = e;
    const name = String(x?.error ?? x?.data?.error ?? x?.body?.error ?? '');
    const known = ['off', 'not_ready', 'not_reached', 'already_opened', 'key_conflict', 'ad_required', 'key_required', 'bad_key', 'bad_tier', 'bad_src'];
    if (known.includes(name))
        return name;
    if (x?.status === 404)
        return 'off';
    if (x?.status === 503)
        return 'not_ready';
    return 'network';
}
/** GET lottery/state — 꺼졌거나 실패하면 null(복권 칩을 그리지 않는다). 읽는 순간 서버가 오늘 줄 복권을 만든다 */
async function fetchLotteryState(fetchJson) {
    try {
        return parseLotteryState(await fetchJson('lottery/state', { method: 'GET' }));
    }
    catch {
        return null;
    }
}
async function fetchLotteryWinners(fetchJson) {
    try {
        return parseWinners(await fetchJson('lottery/winners', { method: 'GET' }));
    }
    catch {
        return [];
    }
}
/** 열기 요청마다 새 멱등 키 — 같은 시도를 다시 보낼 때만 같은 키를 쓴다(createLotteryOpener) */
function newLotteryKey() {
    return 'lot-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}
/** POST lottery/open — `src: 'basic'` 는 황금(기본) 복권(서버가 광고 시청 확인을 소비한다), 안 주면 미션 복권을 먼저 연다 */
async function openLottery(fetchJson, args) {
    let r;
    try {
        r = await fetchJson('lottery/open', { method: 'POST', body: { tier: args.tier, idempotency_key: args.key, ...(args.src ? { src: args.src } : {}) } });
    }
    catch (e) {
        return { ok: false, error: errorOf(e) };
    }
    const j = r;
    if (j?.ok === true && typeof j.won === 'number' && typeof j.points === 'number') {
        return { ok: true, result: { tier: num(j.tier), maxWon: num(j.maxWon), won: j.won, points: j.points, balance: num(j.balance), replayed: j.replayed === true, unopened: Math.max(0, num(j.unopened)) } };
    }
    return { ok: false, error: j?.ok === false ? errorOf(j) : 'invalid' };
}
/**
 * 열기 함수 — **한 번에 하나만**, 네트워크가 끊겨 다시 보낼 때는 같은 키(서버가 저장된 결과를 다시 준다), 서버가 답을 준 뒤에는 키를 버린다.
 * 잠금(busy)은 끝나면 반드시 풀린다(finally) — 이동 · 실패 · 취소를 기다리지 않는다(0.4.3 와 같은 규칙).
 */
function createLotteryOpener(fetchJson) {
    const keys = new Map();
    let busy = false;
    return async (tier, src) => {
        if (busy)
            return { ok: false, error: 'busy' };
        busy = true;
        try {
            const slot = tier + ':' + (src ?? '');
            const key = keys.get(slot) ?? newLotteryKey();
            keys.set(slot, key);
            const out = await openLottery(fetchJson, { tier, key, src });
            if (out.ok || out.error !== 'network')
                keys.delete(slot);
            return out;
        }
        finally {
            busy = false;
        }
    };
}
// ── 문구 ──────────────────────────────────────────────────────────────
const lotteryTierTitle = (t) => '최대 ' + t.maxWon.toLocaleString('ko-KR') + '원 복권';
exports.lotteryTierTitle = lotteryTierTitle;
/** 단계 줄 설명 — 황금(기본) 복권이 있는 단계는 그 안내, 아니면 미션 기준 */
function lotteryTierHint(t) {
    if (t.basic > 0 && t.missionState === 'locked' && t.missionsLeft <= 0)
        return '황금 복권을 이용해서 얻을 수 있어요';
    if (t.missionState === 'ready' || t.missionState === 'opened')
        return '쇼핑 · 플레이스 미션 ' + t.missions + '개 참여로 받았어요';
    if (t.missionState === 'capped')
        return '오늘 받을 수 있는 복권을 모두 받았어요';
    const base = t.missionsLeft > 0 && t.missionsLeft < t.missions ? '미션 ' + t.missionsLeft + '개 더 하면 받아요' : '쇼핑 · 플레이스 미션 ' + t.missions + '개 참여하면 받아요';
    return t.basic > 0 ? '황금 복권이나 ' + base : base;
}
/** 단계 줄 버튼 — ready 면 「열기」, 다 열었으면 「획득 완료」, 못 받은 단계는 「받기」(미션으로 가기), 하루 한도에 막힌 단계는 「내일 받아요」 */
function lotteryTierButton(t) {
    if (t.state === 'ready')
        return { label: '열기', kind: 'open' };
    if (t.state === 'opened')
        return { label: '획득 완료', kind: 'done' };
    if (t.state === 'capped')
        return { label: '내일 받아요', kind: 'wait' };
    return { label: '받기', kind: 'earn' };
}
/** 아직 못 받은 가장 가까운 단계 — 「한 번 더! ○원 복권 받기」 · 「미션 N개 더 하면」 */
function nextTierToEarn(s) {
    return s.tiers.find(t => t.missionState === 'locked') ?? null;
}
function lotteryMoreLabel(s) {
    const t = nextTierToEarn(s);
    return t ? '한 번 더! ' + t.maxWon.toLocaleString('ko-KR') + '원 복권 받기' : null;
}
/** 결과 창 제목 — 「축하해요 보상 ○P 당첨!」 */
const lotteryResultTitle = (points) => '축하해요 보상 ' + points.toLocaleString('ko-KR') + 'P 당첨!';
exports.lotteryResultTitle = lotteryResultTitle;
/** 결과 창에서 남은 복권이 없을 때 잇는 버튼 — 「미션 하고 복권 더 받기」(다음 단계까지 남은 미션 수) */
function lotteryMoreMissionLabel(s) {
    const t = nextTierToEarn(s);
    if (!t)
        return null;
    return t.missionsLeft > 0 ? '미션 ' + t.missionsLeft + '개 더 하고 ' + t.maxWon.toLocaleString('ko-KR') + '원 복권 받기' : '미션 하고 복권 더 받기';
}
const lotteryWinnerLine = (w) => w.nick + '님이 ' + w.tierMax.toLocaleString('ko-KR') + '원 복권에 당첨됐어요!';
exports.lotteryWinnerLine = lotteryWinnerLine;
/** 안 연 복권이 있을 때만 칩을 그린다 — 다 열면 사라진다 */
const lotteryChipCount = (s) => (s ? s.unopened : 0);
exports.lotteryChipCount = lotteryChipCount;
/** 황금(기본) 복권 팝업 대상 — 안 연 기본 복권이 있는 단계(없으면 null) */
function goldenTier(s) {
    return s?.tiers.find(t => t.basicUnopened > 0) ?? null;
}
/** 열 수 있는 단계 — 이 단계의 복권이 하나라도 안 열렸다 */
function readyTiers(s) {
    return s ? s.tiers.filter(t => t.unopened > 0) : [];
}
