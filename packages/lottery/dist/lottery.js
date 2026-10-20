"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lotteryChipCount = exports.lotteryGoldHint = exports.DEFAULT_QUIZ = exports.lotteryWinnerLine = exports.lotteryResultHeadline = exports.lotteryResultTitle = exports.lotteryTierTitle = exports.lotteryTierAmount = void 0;
exports.parseLotteryState = parseLotteryState;
exports.parseWinners = parseWinners;
exports.toLotteryError = toLotteryError;
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
exports.lotteryWinnerParts = lotteryWinnerParts;
exports.lotteryWinnersInPoints = lotteryWinnersInPoints;
exports.lotteryMissionButton = lotteryMissionButton;
exports.lotteryMissionHint = lotteryMissionHint;
exports.lotteryGroupTiers = lotteryGroupTiers;
exports.lotteryTierRow = lotteryTierRow;
exports.goldenRow = goldenRow;
exports.goldenTier = goldenTier;
exports.opensWithAd = opensWithAd;
exports.nextOpensWithAd = nextOpensWithAd;
exports.goldenLines = goldenLines;
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
            unit: t.unit === 'points' ? 'points' : 'won',
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
        if (w && typeof w.nick === 'string' && w.nick !== '') {
            out.push(w.unit === 'points'
                ? { nick: w.nick, tierMax: num(w.tierMax), won: num(w.won), unit: 'points', points: num(w.points), tierMaxPoints: num(w.tierMaxPoints) }
                : { nick: w.nick, tierMax: num(w.tierMax), won: num(w.won), unit: 'won' });
        }
    }
    return out;
}
const KNOWN_ERRORS = ['off', 'not_ready', 'not_reached', 'already_opened', 'key_conflict', 'ad_required', 'key_required', 'bad_key', 'bad_tier', 'bad_src'];
/**
 * 던져진 오류 · 응답 본문에서 서버 오류 이름을 읽는다 — 앱마다 요청 함수가 던지는 꼴이 달라서(ApiError.code · status, {error}, {data:{error}}, {body:{error}}) 모두 읽는다.
 * 앱이 {error, status} 로 바꿔 던질 필요 없이 `openLottery` 가 이것을 쓴다. 서버가 답한 이름이 아니면 404 → off · 503 → not_ready, 그 밖(끊김 · 시간초과 · 모름)은 network
 */
function toLotteryError(e) {
    const x = e;
    for (const v of [x?.error, x?.code, x?.data?.error, x?.data?.code, x?.body?.error, x?.body?.code]) {
        const name = typeof v === 'string' ? v : '';
        if (KNOWN_ERRORS.includes(name))
            return name;
    }
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
        return { ok: false, error: toLotteryError(e) };
    }
    const j = r;
    if (j?.ok === true && typeof j.won === 'number' && typeof j.points === 'number') {
        const points = j.unit === 'points';
        return { ok: true, result: { tier: num(j.tier), maxWon: num(j.maxWon), won: j.won, points: j.points, balance: num(j.balance), replayed: j.replayed === true, unopened: Math.max(0, num(j.unopened)),
                unit: points ? 'points' : 'won', ...(points ? { maxPoints: num(j.maxPoints) } : {}) } };
    }
    return { ok: false, error: j?.ok === false ? toLotteryError(j) : 'invalid' };
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
const ko = (n) => n.toLocaleString('ko-KR');
/** (0.1.3) 단계의 「최대 ○」 — 포인트 표(unit:'points')면 `1,000P`, 원 표면 `100원`. 원 표시는 포인트 표에서 쓰지 않는다 */
const lotteryTierAmount = (t) => (t.unit === 'points' ? ko(t.maxPoints) + 'P' : ko(t.maxWon) + '원');
exports.lotteryTierAmount = lotteryTierAmount;
const lotteryTierTitle = (t) => '최대 ' + (0, exports.lotteryTierAmount)(t) + ' 복권';
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
    if (!t)
        return null;
    return t.unit === 'points' ? '한 번 더! ' + (0, exports.lotteryTierTitle)(t) + ' 받기' : '한 번 더! ' + ko(t.maxWon) + '원 복권 받기';
}
/** 결과 창 제목 — 「축하해요 보상 ○P 당첨!」 */
const lotteryResultTitle = (points) => '축하해요 보상 ' + points.toLocaleString('ko-KR') + 'P 당첨!';
exports.lotteryResultTitle = lotteryResultTitle;
/** (0.1.3) 당첨 전체 화면의 큰 제목 — 「5P 당첨!」 */
const lotteryResultHeadline = (points) => ko(points) + 'P 당첨!';
exports.lotteryResultHeadline = lotteryResultHeadline;
/** 결과 창에서 남은 복권이 없을 때 잇는 버튼 — 「미션 하고 복권 더 받기」(다음 단계까지 남은 미션 수) */
function lotteryMoreMissionLabel(s) {
    const t = nextTierToEarn(s);
    if (!t)
        return null;
    const what = t.unit === 'points' ? (0, exports.lotteryTierTitle)(t) : ko(t.maxWon) + '원 복권';
    return t.missionsLeft > 0 ? '미션 ' + t.missionsLeft + '개 더 하고 ' + what + ' 받기' : '미션 하고 복권 더 받기';
}
/** (0.1.3) 당첨 띠 문구를 세 조각으로 — 가운데(금액)만 강조색으로 그린다. 포인트 표 단계는 「○님이 1,000P 당첨됐어요!」, 원 표는 예전 문구 그대로 */
function lotteryWinnerParts(w) {
    if (w.unit === 'points')
        return { pre: w.nick + '님이 ', amount: ko(w.points ?? 0) + 'P', post: ' 당첨됐어요!' };
    return { pre: w.nick + '님이 ', amount: ko(w.tierMax) + '원', post: ' 복권에 당첨됐어요!' };
}
const lotteryWinnerLine = (w) => { const p = lotteryWinnerParts(w); return p.pre + p.amount + p.post; };
exports.lotteryWinnerLine = lotteryWinnerLine;
/**
 * (0.1.6, 대표님 10-20 16:37 「1,000원 복권에 당첨됐어요」 → P) 당첨 띠에 쓸 당첨 목록 — 원 당첨도 P 로 보여 준다(포인트 표로 가는 중이라 P 로 통일).
 * 서버 winners 가 아직 원 단위(unit 'won')면 **실제 당첨액**(won)에 100원당 P(`state.wonToPoint`, 160 = 1원 1.6P)를 곱해 바꾼다 — 예: 1,000원 → 1,600P.
 * 티켓 단계의 최대액(tierMax)이 아니라 실제 당첨액이다(최대액을 당첨처럼 보이면 사실과 다르다). 서버가 이미 P(unit 'points')로 주면 그대로 통과한다.
 * 환산값을 모르거나(0) 당첨 P 가 0 이하인 줄은 띠에서 뺀다. `LotterySheet` 가 자동으로 쓴다.
 */
function lotteryWinnersInPoints(winners, wonToPoint) {
    const out = [];
    for (const w of winners) {
        if (w.unit === 'points') {
            if ((w.points ?? 0) > 0)
                out.push(w);
            continue;
        }
        if (!(wonToPoint > 0))
            continue;
        const points = Math.round((w.won * wonToPoint) / 100);
        if (points <= 0)
            continue;
        out.push({ nick: w.nick, tierMax: w.tierMax, won: w.won, unit: 'points', points, tierMaxPoints: Math.round((w.tierMax * wonToPoint) / 100) });
    }
    return out;
}
/**
 * (0.1.3) 시트 줄 — 미션 복권 줄(단계마다)과 황금 복권 줄(하루 기본 복권이 있을 때 하나)을 따로 보여 준다. 미션 줄은 미션 복권만의 상태(missionState)로 정한다.
 * 「열기」는 미션 복권이 열린 줄, 「받기」는 아직 못 받은(미션으로 가기), 「받기 완료」는 다 연 줄, 「내일 받아요」는 하루 한도에 막힌 줄
 */
function lotteryMissionButton(t) {
    if (t.missionState === 'ready')
        return { label: '열기', kind: 'open' };
    if (t.missionState === 'opened')
        return { label: '받기 완료', kind: 'done' };
    if (t.missionState === 'capped')
        return { label: '내일 받아요', kind: 'wait' };
    return { label: '받기', kind: 'earn' };
}
/**
 * (0.1.5, 대표님 17:06:56 「미션 말고 쇼핑 · 플레이스 퀴즈로」) 미션 줄 설명의 이름 — 기본 「쇼핑 · 플레이스 퀴즈」. 앱마다 이름이 다르면 `quiz` 로 바꾼다(예: 「미션」).
 */
exports.DEFAULT_QUIZ = '쇼핑 · 플레이스 퀴즈';
const WAIT_HINT = '내일 다시 받을 수 있어요';
/**
 * 미션 줄 설명 — 늘 **받는 방법**으로 말한다(0.1.4, 대표님 16:37 「미션한개 다섯 개를 해서 내가 복권을 받았다는 건가?」: 「미션 1개로 받았어요」는 이미 받은 이유로 읽혔다).
 * 1 · 5 · 10 · 20 · 30 줄이 같은 꼴 — 「쇼핑 · 플레이스 퀴즈 N개 하면 받아요」(받았든 안 받았든 열 수 있든). 일부 했으면 「쇼핑 · 플레이스 퀴즈 M개 더 하면 받아요」.
 * 하루 한도에 막힌 줄은 버튼 「내일 받아요」와 같은 말 — 「내일 다시 받을 수 있어요」. 한 줄에 들어오게 짧다(대표님 16:47). `quiz` 로 이름을 바꿀 수 있다(0.1.5)
 */
function lotteryMissionHint(t, quiz = exports.DEFAULT_QUIZ) {
    if (t.missionState === 'capped')
        return WAIT_HINT;
    if (t.missionState === 'locked' && t.missionsLeft > 0 && t.missionsLeft < t.missions)
        return quiz + ' ' + t.missionsLeft + '개 더 하면 받아요';
    return quiz + ' ' + t.missions + '개 하면 받아요';
}
const stepOfTen = (t) => t.missions >= 10 && t.missions % 10 === 0;
const sameTable = (a, b) => a.maxWon === b.maxWon && a.maxPoints === b.maxPoints && a.unit === b.unit;
/**
 * (0.1.5, 대표님 17:06 「20개 · 30개짜리는 없애고 열 개짜리를 10개마다 받을 수 있다」) 서버는 1 · 5 · 10 · 20 · 30 문턱을 그대로 준다(20 · 30 은 10 과 같은 표).
 * **같은 표(maxWon · maxPoints · unit) + 문턱이 10 의 배수(≥10)** 인 이어진 단계들을 한 묶음으로 — 나머지(1 · 5 · 표가 다른 단계 · 20 · 30 이 없는 3단계)는 한 단계씩.
 */
function lotteryGroupTiers(tiers) {
    const groups = [];
    for (const t of tiers) {
        const head = groups[groups.length - 1]?.[0];
        if (head && stepOfTen(head) && stepOfTen(t) && sameTable(head, t))
            groups[groups.length - 1].push(t);
        else
            groups.push([t]);
    }
    return groups;
}
/**
 * (0.1.5) 묶음 → 한 줄. 한 단계면 예전 그대로(버튼 · 설명), 묶였으면 설명 「쇼핑 · 플레이스 퀴즈 10개마다 받아요」 + 버튼 「열기」 / 열 수 있는 장이 둘 이상이면 「열기 N」
 * (단계마다 미션 복권은 하루 한 장 — 열 수 있는 장 수 = missionState 가 ready 인 단계 수), 누르면 안 연 첫 단계. 못 받은 단계가 남았으면 「받기」, 한도에 막혔으면 「내일 받아요」, 다 열었으면 「받기 완료」
 */
function lotteryTierRow(group, quiz = exports.DEFAULT_QUIZ) {
    const rep = group[0];
    const earnTier = (group.find(t => t.missionState === 'locked') ?? rep).tier;
    if (group.length === 1) {
        const b = lotteryMissionButton(rep);
        return { rep, tiers: group, hint: lotteryMissionHint(rep, quiz), button: b, openTier: b.kind === 'open' ? rep.tier : null, earnTier };
    }
    const every = quiz + ' ' + rep.missions + '개마다 받아요';
    const ready = group.filter(t => t.missionState === 'ready');
    if (ready.length > 0)
        return { rep, tiers: group, hint: every, button: { label: ready.length > 1 ? '열기 ' + ready.length : '열기', kind: 'open' }, openTier: ready[0].tier, earnTier };
    if (group.some(t => t.missionState === 'locked'))
        return { rep, tiers: group, hint: every, button: { label: '받기', kind: 'earn' }, openTier: null, earnTier };
    if (group.some(t => t.missionState === 'capped'))
        return { rep, tiers: group, hint: WAIT_HINT, button: { label: '내일 받아요', kind: 'wait' }, openTier: null, earnTier };
    return { rep, tiers: group, hint: every, button: { label: '받기 완료', kind: 'done' }, openTier: null, earnTier };
}
/** (0.1.4) 황금 복권 줄 설명 — 한 줄: 광고가 열리면 「하루 1번 광고 보고 받아요」, 광고 없이 열리면(`basicAd` false) 「하루 1번 받아요」 */
const lotteryGoldHint = (basicAd) => (basicAd ? '하루 1번 광고 보고 받아요' : '하루 1번 받아요');
exports.lotteryGoldHint = lotteryGoldHint;
/** 황금 복권 줄 — 기본 복권이 있는 단계(없으면 null). `unopened` 가 0 이면 이미 연 것 */
function goldenRow(s) {
    if (!s)
        return null;
    const t = s.tiers.find(x => x.basic > 0);
    return t ? { tier: t, unopened: t.basicUnopened, total: t.basic } : null;
}
/** 안 연 복권이 있을 때만 칩을 그린다 — 다 열면 사라진다 */
const lotteryChipCount = (s) => (s ? s.unopened : 0);
exports.lotteryChipCount = lotteryChipCount;
/** 황금(기본) 복권 팝업 대상 — 안 연 기본 복권이 있는 단계(없으면 null) */
function goldenTier(s) {
    return s?.tiers.find(t => t.basicUnopened > 0) ?? null;
}
/**
 * (0.1.2) 이 단계의 **다음 복권을 열 때 광고가 바로 열리나** — 미션 복권(광고 없이 열림)이 아니라 매일 기본(황금) 복권만 남았을 때.
 * 서버는 미션 복권을 먼저 연다. `basicAd` 는 서버 설정 daily_basic.ad(기본 true = 광고 필요) — 광고 없이 여는 설정이면 false 를 넘긴다.
 * 버튼에 「광고」 칩을 넣을지 이것으로 정한다(광고 없이 열리는 버튼에는 넣지 않는다)
 */
function opensWithAd(t, basicAd = true) {
    return !!t && basicAd && t.unopened > 0 && t.missionState !== 'ready' && t.basicUnopened > 0;
}
/** (0.1.2) 결과 창의 「다음 복권 열기」가 광고를 여는가 — 다음에 열 단계(안 연 첫 단계)가 황금 복권뿐일 때 */
function nextOpensWithAd(s, basicAd = true) {
    return opensWithAd(readyTiers(s)[0], basicAd);
}
/** 황금 복권 시트의 쉬운 말 설명 — 줄마다 한 가지, 값(최대 금액 · 포인트)은 서버 state 에서 온 것을 넘긴다. 광고 없이 열리는 설정이면 두 번째 줄이 바뀐다 */
function goldenLines(o) {
    const won = o.maxWon.toLocaleString('ko-KR') + '원';
    const pts = typeof o.maxPoints === 'number' && o.maxPoints > 0 ? '(' + o.maxPoints.toLocaleString('ko-KR') + 'P)' : '';
    // 포인트 표(unit:'points')는 P 만 — 「최대 1,000P가 바로 들어와요」(원 병기 없음)
    const last = o.unit === 'points' ? '최대 ' + ko(o.maxPoints ?? 0) + 'P가 바로 들어와요' : '최대 ' + won + pts + '이 포인트로 바로 들어와요';
    return {
        lines: ['하루에 한 장, 무료로 드려요', o.ad === false ? '바로 열 수 있어요' : '광고 1번 보면 바로 열 수 있어요', last],
        note: '오늘 자정까지 열 수 있어요',
    };
}
/** 열 수 있는 단계 — 이 단계의 복권이 하나라도 안 열렸다 */
function readyTiers(s) {
    return s ? s.tiers.filter(t => t.unopened > 0) : [];
}
