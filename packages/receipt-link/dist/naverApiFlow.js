"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.latestKnownDay = exports.tailOf = exports.detailOf = void 0;
exports.createNaverApiFlow = createNaverApiFlow;
/**
 * 네이버 영수증 흐름(7차) — **요청만** 쓴다. 영수증 화면을 열거나 단추를 누르거나 막히면 화면 방식으로 되돌아가는 길이 없다(대표님 10-29 09:03).
 * 같은 FlowEvent/FlowOut 규약(naverReceipt.ts)을 따르고, 구동기가 숨은 웹뷰에서 동작을 실행한다.
 *
 *  1) shopping.naver.com/my/order 를 한 번 열어 둔다(같은 출처에서 요청을 부르려고 — 실행당 한 번)
 *  2) GET /my/order/api/npay/order-histories?page=N (대표님 23:12~23:22 요청 형식) 로 최근 1년 주문 목록을 받는다(기존 api 동작)
 *     — 한 주문의 여러 상품 줄은 첫 줄만 올린다(영수증도 적립도 한 주문에 한 번)
 *  3) pay.naver.com/history 를 한 번 열어 둔다(영수증 요청의 출처, 실행당 한 번)
 *  4) 최신 주문부터 RECEIPTS_BATCH 건씩 naverReceiptsScript 가 card-single(B형 · A형) 요청을 몇 건씩 병렬로 부른다
 *  5) 주문마다 결과(가져옴 · 영수증 없음 · 못 가져옴+까닭)를 takeOutcomes 로 알리고, 가져온 영수증은 take 로 낸다
 * 이미 서버에 있는 주문(start.known)은 건너뛰고(영수증 보강된 줄만 — 목록 행은 다시 가져온다), onlyKeys 가 있으면 그 줄들만 가져온다.
 * 막히면(403 · 429) 한 번에 2건 · 하나씩 · 요청 사이를 늘려 이어 가고, 연달아 세 번 막히면 끝낸다. 로그인이 풀리면 로그인 화면을 보이고 풀린 뒤 같은 묶음부터 이어 간다.
 */
const naverReceipt_1 = require("./naverReceipt");
const naverReceiptsScript_1 = require("./naverReceiptsScript");
const runOutcome_1 = require("./runOutcome");
const DAY_MS = 86400000;
/** card-single 영수증 한 장의 원문 칸 전부(대표님 14:15) → 세부 칸. 빈 칸은 싣지 않는다 */
const detailOf = (slip) => {
    const at = (v) => (v === undefined ? undefined : (0, naverReceipt_1.normalizeKst)(v) ?? String(v));
    const all = {
        cardCompany: slip.cardCompany, approvalNo: slip.approvalNo, cardNo: slip.cardNo, tradeType: slip.tradeType, ownerType: slip.ownerType, installmentType: slip.installmentType,
        approvalAt: at(slip.approvalAt), cancelAt: at(slip.cancelAt), productName: slip.productName, productOrderNo: slip.productOrderNo,
        sellerName: slip.sellerName, sellerRepresentative: slip.sellerRepresentative, sellerBusinessNo: slip.businessNo, sellerTel: slip.sellerTel, sellerAddress: slip.sellerAddress,
        merchantName: slip.merchantName, merchantBusinessNo: slip.merchantBusinessNo,
        approvalAmount: slip.amount, cancelAmount: slip.cancelAmount, supplyAmount: slip.supplyAmount, taxAmount: slip.taxAmount, totalAmount: slip.totalAmount,
        cardExpiredYear: slip.expiredYear, cardExpiredMonth: slip.expiredMonth, merchantRepresentative: slip.merchantRepresentative, merchantNo: slip.merchantNo, merchantAddress: slip.merchantAddress,
        serviceCharge: slip.serviceCharge, disposableCupAmount: slip.disposableCupAmount,
    };
    const out = {};
    for (const [k, v] of Object.entries(all))
        if (v !== undefined && v !== '')
            out[k] = v;
    return Object.keys(out).length ? out : undefined;
};
exports.detailOf = detailOf;
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const hostOf = (url) => url.split('/')[0].toLowerCase();
const pathOf = (url) => { const i = url.indexOf('/'); return i < 0 ? '/' : url.slice(i); };
const listKeyOf = (orderedAt, amount) => `${orderedAt.slice(0, 16)}|${amount}`;
/** 서버가 가린 주문번호(뒤 4자리) + 날짜로 「이미 가져온 주문」을 가린다 — 영수증의 결제 시각 · 금액은 목록의 주문 시각 · 상품 금액과 다를 수 있어 쓰지 않는다 */
const tailOf = (orderNo, orderedAt) => `${orderNo.slice(-4)}|${orderedAt.slice(0, 10)}`;
exports.tailOf = tailOf;
/** 서버에 저장된 가장 최근 주문의 날짜(YYYY-MM-DD) — 「뒤4자리|날짜」 · 「날짜 시각|금액」에서. 없으면 undefined. 대표님 11-02 「최종 저장된 주문 건 이후 건만」 */
const latestKnownDay = (known) => {
    let best;
    for (const t of known?.tails ?? []) {
        const d = t.split('|')[1]?.slice(0, 10);
        if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && (!best || d > best))
            best = d;
    }
    for (const k of known?.listKeys ?? []) {
        const d = k.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (!best || d > best))
            best = d;
    }
    return best;
};
exports.latestKnownDay = latestKnownDay;
/** 목록 · 첫 화면 읽기를 다시 해 보는 횟수 */
const MAX_LIST_TRIES = 3;
/** 막힘 · 요청 실패를 한 주문에 다시 해 보는 횟수(처음 포함) */
const MAX_JOB_TRIES = 1; // 원문 밖 재시도 없음(대표님 10-29 13:46 「전달한대로」) — 줄마다 한 번만 부른다(로그인이 풀려 다시 보내는 것만 예외)
/** 연달아 이만큼 막히면 끝낸다 · 연달아 이만큼 시간 초과면 끝낸다 */
const MAX_BLOCKED_RUN = 3;
const MAX_TIMEOUT_RUN = 3;
const FAIL_OF = { blocked: 'blocked', net: 'network', nopair: 'no-pair', shape: 'unreadable', login: 'login' };
function createNaverApiFlow(opts = {}) {
    const now = opts.now ?? (() => Date.now());
    const maxSteps = opts.maxSteps ?? 4000;
    const budgetMs = opts.budgetMs ?? 1500000;
    const maxOrders = opts.maxOrders ?? 800;
    const allowNoSeconds = opts.allowNoSeconds ?? false;
    const only = opts.onlyKeys ? new Set(opts.onlyKeys) : null;
    const refill = opts.refill && opts.refill.length > 0 ? opts.refill : null;
    const npv2 = opts.npv2 === true;
    const refillHit = (o) => {
        const day = Date.parse(`${o.orderedAt.slice(0, 10)}T00:00:00Z`);
        return (refill ?? []).some((t) => {
            const [tail, d] = t.split('|');
            return tail === o.orderNo.slice(-4) && Math.abs(Date.parse(`${d}T00:00:00Z`) - day) <= DAY_MS;
        });
    };
    const startedAt = now();
    let cutoff = ymd(startedAt - (opts.windowDays ?? naverReceipt_1.LOOKBACK_DAYS) * DAY_MS);
    const sinceMs = Date.parse(`${cutoff}T00:00:00+09:00`);
    const untilDate = ymd(startedAt + 9 * 3600000);
    let phase = 'idle';
    let steps = 0;
    let tries = 0;
    let listTries = 0;
    let lastUrl = '';
    let lastText = '';
    let final = null;
    const knownNos = new Set();
    const knownKeys = new Set();
    const knownTails = new Set();
    /** 아직 보내지 않은 주문(최신 먼저) · 지금 보낸 묶음 */
    let queue = [];
    let batch = [];
    const orders = [];
    const pending = [];
    const outcomes = [];
    const stats = { rejected: 0, probes: 0, duplicates: 0, unfetched: [] };
    let total = 0;
    let okN = 0;
    let noneN = 0;
    let failN = 0;
    let blockedRun = 0;
    let timeoutRun = 0;
    let slow = false;
    let ending = null;
    let endQueue = [];
    const READ = { kind: 'read' };
    const drainEnd = () => {
        const w = endQueue.shift();
        if (w !== undefined)
            return { type: 'probe', where: w, shape: (0, naverReceipt_1.pageShape)(lastUrl, lastText) };
        const e = ending;
        if (!final && e)
            final = { type: 'done', reason: e.reason, orders: e.orders, stats: e.stats };
        return final ?? { type: 'done', reason: 'unknown', orders: [], stats: { ...stats } };
    };
    /** 끝: 개수 기록(값 없음) → 끝난 까닭 기록 → done */
    const finish = (reason) => {
        if (final)
            return final;
        if (!ending) {
            // orders 출처에서 아직 못 한 줄 — 조용히 사라지지 않게(주문상세는 예전대로 「영수증 없음」)
            for (const w of [...pinfoBatch, ...pinfoWait])
                missOrders(w, 'no-pair');
            pinfoBatch = [];
            pinfoWait = [];
            const at = phase;
            phase = 'finished';
            ending = { reason, orders: pending.splice(0), stats: { ...stats } };
            endQueue = [`flowc-t${total}-k${okN}-x${noneN}-f${failN}-q${queue.length}`, ...(failCodes.size > 0 ? [`flowf-${[...failCodes].map(([c, n]) => `${c}${n}`).join('-')}`] : []), ...(scanned ? [`flown-p${npFound}-k${npOk}-f${npFail}-r${payRowsN}`, `flowd-cap${drop.cap}-nono${drop.nono}`, `flowd-cut${drop.cut}-known${drop.known}`, `flowd-dup${drop.dup}-cancel${drop.cancel}`, `flowd-merged${shopMerged}`] : []), ...(npv2 && scanned ? [only ? `flowo-${hitPage ? `hit-p${hitPage}` : `miss-last${lastScanPage}`}-of${scanTotal}` : `flowo-pages${lastScanPage}-of${scanTotal}${stopPaging ? '-stop' : ''}`] : []), `flowe-${reason}-${at}`];
        }
        return drainEnd();
    };
    /** 같은 단계를 두 번까지 다시 읽어 보고, 그래도 아니면 끝낸다 */
    const retryOr = (reason) => {
        if (tries < 2) {
            tries++;
            return READ;
        }
        return finish(reason);
    };
    /** 응답 구조 기록을 차례로 내보내고(resume 마다 다음 것) 끝나면 then — 같은 where 는 한 번만 */
    let after = null;
    const structSeen = new Set();
    const structureThen = (items, then) => {
        const now = new Set(); // 이번 묶음 안의 같은 where 도 한 번만
        const todo = items.filter((i) => {
            if (i.lines.length === 0 || structSeen.has(i.where) || now.has(i.where))
                return false;
            now.add(i.where);
            return true;
        });
        const step = () => {
            const i = todo.shift();
            if (!i) {
                after = null;
                return then();
            }
            structSeen.add(i.where);
            after = step;
            return { type: 'structure', where: i.where, host: i.host, path: i.path, lines: i.lines };
        };
        return step();
    };
    /** 끝난 까닭별 실패 개수 — 끝낼 때 한 줄로 남긴다(예 flowf-no-pair9) */
    const failCodes = new Map();
    /** 네이버페이 내역(pay.naver.com/history __NEXT_DATA__) 읽기 — 영수증 큐가 비면 한 번. 찾은 짝 수 · 가져옴 · 못 가져옴 */
    let scanned = false;
    let pinfoWait = [];
    /** orders 출처 화면을 연 횟수 — 간편결제 한 번 + 영수증 단계에서 나온 주문상세 한 번(같은 줄은 한 번만 보낸다) */
    let pinfoRounds = 0;
    const MAX_PINFO_ROUNDS = 3;
    const osheetSent = new Set();
    /** 지금 보낸 pinfo 작업 묶음(8건까지씩) */
    let pinfoBatch = [];
    /** 쇼핑 주문 목록에서 이번에 본 주문번호 — 네이버페이 내역 줄과 겹치면 내역 줄은 건너뛴다 */
    const listedNos = new Set();
    /** 네이버페이 내역 줄에서 만든 작업 수 */
    let payRowsN = 0;
    /** 내역 화면 쪽 — 지금 띄운 쪽 · 다음에 읽을 쪽 · 마지막 쪽(npv2 만 넘긴다, 20쪽까지) */
    let curPayPage = 0;
    let scanNextPage = 1;
    let scanTotal = 1;
    /** 내역 페이지가 셸(__NEXT_DATA__ 없음)이라 0쪽 읽었을 때 pay 페이지를 리로드해 다시 스캔한 횟수 — 최대 2회(대표님 10-30, 순차) */
    let scanTries = 0;
    // 대표님 내역 52쪽(10-29 16:36) — 마지막 쪽까지, 60쪽 안전 상한
    const MAX_SCAN_PAGES = 60;
    /** 개별: 내역 줄을 찾은 쪽 · 마지막으로 읽은 쪽(기록용) */
    let hitPage = 0;
    let lastScanPage = 0;
    /** 바로 앞 스캔에서 실제로 읽힌 쪽(r.page) — 쪽이 안 넘어가는지(SPA) 본다 */
    let prevReadPage = 0;
    /** 전체: 이 쪽의 내역 줄이 모두 이미 받은 것이면 더 넘기지 않는다(다음 실행부터 「마지막으로 받은 날짜까지만」) */
    let stopPaging = false;
    /** 개별 가져오기(npv2)에서 쇼핑 목록에 없던 줄 — 내역 줄의 날짜(분) · 금액으로 찾는다 */
    const pendingOnly = new Set();
    let npFound = 0;
    let npOk = 0;
    let npFail = 0;
    const setOutcome = (key, outcome) => { outcomes.push({ key, outcome }); };
    /** info: 어디서 · 어떤 응답으로 막혔는지(서버 실패 기록으로 간다 — 11-04 대표님 「뭐가 문제인지 알 수가 없으니」. 값은 없고 단계 · 경로 · HTTP · 낱말만) */
    const fail = (j, code, info) => {
        failN++;
        failCodes.set(code, (failCodes.get(code) ?? 0) + 1);
        setOutcome(j.key, { state: 'failed', code, ...(info ? { info } : {}) });
        stats.unfetched = [...(stats.unfetched ?? []), j.order.orderNo];
    };
    /** 영수증이 없는 결제 — 줄은 「영수증 없음」, 서버에는 목록 행을 none 으로 바꾸는 행을 보낸다(「목록만」으로 남지 않게, 11-04). 취소(why cancelled)는 따로 */
    const none = (j, info) => { noneN++; setOutcome(j.key, { state: 'none', ...(info ? { info } : {}) }); pending.push((0, naverReceipt_1.noneOrder)(j.order)); };
    const OSHEET_PATH = '/orderApi/orderSheet/detail';
    const PINFO_PATH = '/orderApi/payment/detail/info';
    /** orders 출처 작업을 못 했을 때 — 주문상세(osheet)는 예전 결과 그대로 「영수증 없음」(대표님 11-02 ④ 실패가 아님), 간편결제(pinfo)는 까닭.
     *  둘 다 서버 실패 기록에는 어느 길 · 어떤 까닭인지 남긴다 — 1.1.0 까지는 「없음」만 남아 까닭이 가려졌다(11-04 회원 1967 66건 중 61건, 대표님 「뭐가 문제인지 알 수가 없으니」) */
    const missOrders = (w, code, http) => {
        const info = { stage: 'request', via: 'fetch', path: w.osheet ? OSHEET_PATH : PINFO_PATH, ...(http !== undefined ? { http } : {}), words: `${w.osheet ? 'osheet' : 'pinfo'}-${code}` };
        if (w.osheet)
            none(w.j, info);
        else
            fail(w.j, code, info);
    };
    const listAction = () => ({ kind: 'api', name: 'shop', maxPages: 40, sinceMs, since: cutoff, until: untilDate });
    const toJob = (j) => {
        const o = j.order;
        return {
            key: j.key, orderNo: o.orderNo,
            ...(o.productOrderNo ? { productOrderNo: o.productOrderNo } : {}),
            ...(o.pay?.tid ? { tid: o.pay.tid } : {}),
            ...(o.pay?.payId ? { payId: o.pay.payId } : o.payIdHint ? { payId: o.payIdHint } : {}),
            ...(o.pay?.paymentId ? { paymentId: o.pay.paymentId } : {}),
        };
    };
    /** 영수증 큐가 비면 이 결제 화면(pay.naver.com/history)의 __NEXT_DATA__ 에서 네이버페이 결제 짝을 읽어 영수증을 받는다 — 한 줄 다시(onlyKeys)에는 하지 않는다 */
    const sendScan = () => {
        scanned = true;
        scanNextPage++;
        batch = [];
        phase = 'receipts';
        return {
            kind: 'receipts', jobs: [], scan: true, ...(npv2 ? { v2: true } : {}),
            skip: [...knownNos].filter((n) => /^[0-9A-Za-z]{8,30}$/.test(n)).slice(-500),
            conc: naverReceiptsScript_1.RECEIPTS_CONC, staggerMs: naverReceiptsScript_1.RECEIPTS_STAGGER_MS, gapMs: 0,
            // npv2 는 내역을 더보기/스크롤로 전부 불러오느라 scan 이 오래 걸린다(scrollAll 최대 32초) — 응답 대기를 넉넉히(40초) 줘야 구동기가 timeout 으로 재시도하지 않는다(rl15k 루프 고침 rl15l, 더보기 로드 대기 rl15o)
            timeoutMs: npv2 ? 40000 : naverReceiptsScript_1.RECEIPTS_TIMEOUT_MS, deadlineMs: npv2 ? 40000 : naverReceiptsScript_1.RECEIPTS_DEADLINE_MS,
        };
    };
    /** 영수증 화면 출처(pay.naver.com)로 돌아간다 — 돌아오면 onPage 가 sendBatch */
    const backToPay = () => { phase = 'pay'; tries = 0; curPayPage = 1; return { type: 'goto', url: (0, naverReceipt_1.payHistoryUrl)(1) }; };
    /** 간편결제 짝 얻기 — orders.pay.naver.com 출처 화면(주문 상태 화면 하나)을 한 번 열고, payment/detail/info 를 HTTP 로 부른다(11-02 대표님 확인 길 — 줄마다 결제 상세 화면을 열지 않는다) */
    const gotoPinfo = () => {
        pinfoRounds++;
        phase = 'pinfoPage';
        tries = 0;
        // 출처 확보용 화면 하나 — 목록에서 본 실제 주문의 상태 화면(대표님 14:22:36 원문 화면). 없으면 이 단계는 못 한다
        const ono = [...listedNos].find((n) => /^\d{16}$/.test(n));
        if (!ono) {
            for (const w of pinfoWait)
                missOrders(w, 'no-pair');
            pinfoWait = [];
            return queue.length > 0 ? backToPay() : finishAll();
        }
        return { type: 'goto', url: `https://orders.pay.naver.com/order/status/${ono}?returnUrl=${encodeURIComponent('https://pay.naver.com/pc/history')}` };
    };
    const sendPinfo = () => {
        phase = 'pinfo';
        pinfoBatch = pinfoWait.splice(0, slow ? naverReceiptsScript_1.RECEIPTS_SLOW.batch : naverReceiptsScript_1.RECEIPTS_BATCH);
        return {
            kind: 'receipts', jobs: pinfoBatch.map((w) => (w.osheet ? { key: w.j.key, orderNo: w.j.order.orderNo, osheet: true } : { key: w.j.key, orderNo: w.j.order.orderNo, pinfo: true, paymentId: w.paymentId })),
            conc: slow ? naverReceiptsScript_1.RECEIPTS_SLOW.conc : naverReceiptsScript_1.RECEIPTS_CONC, staggerMs: slow ? 0 : naverReceiptsScript_1.RECEIPTS_STAGGER_MS, gapMs: slow ? naverReceiptsScript_1.RECEIPTS_SLOW.gapMs : 0,
            timeoutMs: naverReceiptsScript_1.RECEIPTS_TIMEOUT_MS, deadlineMs: naverReceiptsScript_1.RECEIPTS_DEADLINE_MS,
        };
    };
    /** pinfo 결과: tid 를 얻으면 card-single 큐로(A형), 영수증이 원래 없는 결제는 「영수증 없음」, 못 얻으면 까닭. 남은 묶음이 있으면 이어서, 다 끝나면 pay.naver.com 으로 */
    const onPinfo = (results) => {
        timeoutRun = 0;
        const byKey = new Map(results.map((r) => [r.key, r]));
        const items = [];
        let firstOk = false;
        for (const w of pinfoBatch) {
            const r = byKey.get(w.j.key);
            if (r?.st === 'pair' && r.tid && r.paymentId) {
                w.j.order = { ...w.j.order, pay: { tid: r.tid, paymentId: r.paymentId } };
                queue.push(w.j);
                if (!firstOk) {
                    firstOk = true;
                    items.push({ where: 'rcpt-pinfo-s200', host: 'orders.pay.naver.com', path: '/orderApi/payment/detail/info', lines: ['via http'] });
                }
            }
            else if (r?.st === 'ok')
                settleOk(w.j, r.slip); // 카드가 아닌 결제 — 주문상세를 영수증으로
            else if (r?.st === 'none')
                none(w.j, { stage: 'read', via: 'fetch', path: w.osheet ? OSHEET_PATH : PINFO_PATH, ...(r.status !== undefined ? { http: r.status } : {}), words: `${w.osheet ? 'osheet' : 'pinfo'}-none` });
            else
                missOrders(w, FAIL_OF[r?.st ?? 'net'] ?? 'no-pair', r?.status);
        }
        pinfoBatch = [];
        for (const x of results)
            if (x.diag)
                items.push({ where: `rcpt-${x.diag.w}-s${x.diag.status}`, host: 'orders.pay.naver.com', path: x.diag.w === 'osheet' ? '/orderApi/orderSheet/detail' : '/orderApi/payment/detail/info', lines: x.diag.lines });
        const nextStep = () => (pinfoWait.length > 0 ? sendPinfo() : backToPay());
        return items.length > 0 ? structureThen(items, nextStep) : nextStep();
    };
    /** 네이버페이 내역 줄(대표님 15:36 ⓑ) → 작업. 쇼핑 목록에 이미 본 주문 · 서버에 이미 받은 주문은 건너뛴다. 목록 줄은 올리지 않는다(완성본만 — 목록 키로 서버 목록 줄을 채운다) */
    /** 개별 가져오기 키(「뒤4|YYYY-MM-DD HH:mm|금액」)와 내역 줄의 날짜(분) · 금액이 같은가 */
    const onlyHit = (row) => {
        if (row.at === undefined || row.amount === undefined)
            return undefined;
        const at16 = ((0, naverReceipt_1.normalizeKst)(row.at) ?? '').slice(0, 16);
        for (const k of pendingOnly) {
            const [, at, amount] = k.split('|');
            if (at === at16 && Number(amount) === row.amount)
                return k;
        }
        return undefined;
    };
    /** 이 쪽에서 서버에 이미 받은 줄 수(멈춤 판단) */
    let pageKnown = 0;
    /** (끝 기록은 24글자 넘는 토큰을 서버가 「앞 8글자~」로 가리므로 flowd 는 짧은 줄 넷으로 쪼개 남긴다 — 11-02 21:0x 서버 기록에서 flowd-ca~ 로 잘려 까닭을 못 읽었다) */
    /** 내역 줄을 작업으로 만들지 않은 까닭별 개수(11-02 107건 누락 찾기) — 상한 · 번호 없음 · 1년 전 · 이미 받음 · 같은 주문번호 */
    const drop = { cap: 0, nono: 0, cut: 0, known: 0, dup: 0, cancel: 0 };
    /** 쇼핑 목록에서 상품 여러 개를 한 주문으로 합친 수 */
    let shopMerged = 0;
    const addPayRows = (rows) => {
        for (const row of rows) {
            if (queue.length + payRowsN >= maxOrders) {
                drop.cap += rows.length;
                break;
            }
            // 버튼 영수증 주소의 짝만 있는 결제(주문번호 없음) — 주문번호 자리에 tid, 간편결제는 결제번호의 숫자(작업 칸 모양 8~20자리)
            const orderNo = row.orderNo ?? row.tid ?? (row.paymentId ? row.paymentId.replace('NP', '').slice(0, 20) : undefined);
            if (!orderNo) {
                drop.nono++;
                continue;
            }
            if (only) {
                // 개별 가져오기: 기다리는 줄과 날짜 · 금액이 같은 내역 줄 한 건만, 그 줄의 키로
                const k = onlyHit(row);
                if (!k)
                    continue;
                pendingOnly.delete(k);
                hitPage = curPayPage;
                const [, at, amount] = k.split('|');
                const order = {
                    orderNo, orderedAt: `${at}:00`, amount: Number(amount), payment: '카드', kind: 'list', needsReceipt: true, listKey: `${at}|${amount}`,
                    ...(row.productOrderNo ? { productOrderNo: 'PD' + row.productOrderNo.replace(/^PD/, '') } : {}),
                    ...(row.tid ? { pay: { tid: row.tid, ...(row.payId ? { payId: row.payId } : {}), ...(row.paymentId ? { paymentId: row.paymentId } : {}) } } : row.payId ? { payIdHint: row.payId } : {}),
                };
                if (row.instant && !row.tid && row.paymentId)
                    pinfoWait.push({ j: { order, key: k, tries: 0 }, paymentId: row.paymentId }); // 간편결제 — 마지막에 orders 출처에서 payment/detail/info 로 tid(HTTP)
                else
                    queue.push({ order, key: k, tries: 0 });
                setOutcome(k, { state: 'fetching' });
                payRowsN++;
                continue;
            }
            // 시각 · 금액이 없는 줄은 영수증의 결제 시각 · 금액으로 저장한다(서버 목록 줄 잇기만 건너뜀) — 작업 시각은 지금
            const known = row.at !== undefined ? (0, naverReceipt_1.normalizeKst)(row.at) : null;
            const orderedAt = known ?? (0, naverReceipt_1.normalizeKst)(now());
            if (known && known.slice(0, 10) < cutoff) {
                drop.cut++;
                continue;
            }
            // 서버에 이미 영수증까지 받은 줄 — 이 쪽의 멈춤 판단에 센다(실패 · 목록뿐인 줄은 세지 않는다 → 다음 실행에서도 다시)
            if (knownNos.has(orderNo) || (known && knownTails.has((0, exports.tailOf)(orderNo, known)))) {
                pageKnown++;
                drop.known++;
                continue;
            }
            if (listedNos.has(orderNo)) {
                drop.dup++;
                continue;
            }
            listedNos.add(orderNo);
            const order = {
                orderNo, orderedAt, amount: row.amount ?? 0, payment: '카드', kind: 'list', needsReceipt: true,
                ...(known && row.amount !== undefined ? { listKey: `${known.slice(0, 16)}|${row.amount}` } : {}),
                ...(row.productOrderNo ? { productOrderNo: 'PD' + row.productOrderNo.replace(/^PD/, '') } : {}),
                ...(row.tid ? { pay: { tid: row.tid, ...(row.payId ? { payId: row.payId } : {}), ...(row.paymentId ? { paymentId: row.paymentId } : {}) } } : row.payId ? { payIdHint: row.payId } : {}),
            };
            const key = (0, runOutcome_1.outcomeKey)(order.orderNo, order.orderedAt, order.amount);
            // 내역 줄 상태가 취소 · 반품 — 영수증을 받지 않고 「취소된 주문」(적립 없음, 대표님 11-02)
            if (row.cancelled) {
                drop.cancel++;
                setOutcome(key, { state: 'none', why: 'cancelled' });
                total++;
                continue;
            }
            if (row.instant && !row.tid && row.paymentId)
                pinfoWait.push({ j: { order, key, tries: 0 }, paymentId: row.paymentId });
            else
                queue.push({ order, key, tries: 0 });
            setOutcome(key, { state: 'fetching' });
            payRowsN++;
            total++;
        }
    };
    /** 내역을 (더) 읽을 차례인가 — 전체 실행 · 개별(npv2, 기다리는 줄이 있을 때)만. npv2 는 마지막 쪽까지, 아니면 첫 쪽만 */
    // (r3 단일 스캔 가드 되돌림 — 1차 스캔이 셸(buildId 없음)일 때 page=2 리로드 뒤 2차 스캔이 로드된 내역을 읽던 걸 막아 0건이 됐다, 대표님 10-30. 이중 스캔 느림은 「셸이면 __NEXT_DATA__ 기다렸다 읽기」로 따로 고친다)
    const wantScan = () => !refill && !stopPaging && (!only || (npv2 && pendingOnly.size > 0)) && scanNextPage <= Math.min(scanTotal, MAX_SCAN_PAGES);
    const sendBatch = () => {
        if (queue.length === 0 && wantScan()) {
            if (curPayPage === scanNextPage)
                return sendScan();
            // 다음 쪽 — 원문 내역 주소 pay.naver.com/history?page=<n>(실기록 pageParams[].page 와 같은 이름)
            curPayPage = scanNextPage;
            phase = 'pay';
            tries = 0;
            return { type: 'goto', url: (0, naverReceipt_1.payHistoryUrl)(scanNextPage) };
        }
        if (queue.length === 0 && pinfoWait.length > 0 && pinfoRounds < MAX_PINFO_ROUNDS)
            return gotoPinfo();
        // 더 열 수 없으면 남은 orders 작업은 까닭을 남긴다(조용히 사라지지 않게)
        if (queue.length === 0 && pinfoWait.length > 0) {
            for (const w of pinfoWait)
                missOrders(w, 'no-pair');
            pinfoWait = [];
        }
        if (queue.length === 0)
            return finishAll();
        return sendQueue();
    };
    /** 끝 — 개별 가져오기에서 내역 끝까지 못 찾은 줄은 쉬운 말 까닭 */
    const finishAll = () => {
        {
            // 개별 가져오기에서 내역 끝까지 못 찾은 줄 — 쉬운 말 까닭
            for (const k of pendingOnly) {
                failN++;
                failCodes.set('not-in-history', (failCodes.get('not-in-history') ?? 0) + 1);
                setOutcome(k, { state: 'failed', code: 'not-in-history' });
            }
            pendingOnly.clear();
            return finish('all-rows');
        }
    };
    const sendQueue = () => {
        batch = queue.splice(0, slow ? naverReceiptsScript_1.RECEIPTS_SLOW.batch : naverReceiptsScript_1.RECEIPTS_BATCH);
        for (const j of batch)
            setOutcome(j.key, { state: 'fetching' });
        phase = 'receipts';
        return {
            kind: 'receipts',
            jobs: batch.map(toJob),
            conc: slow ? naverReceiptsScript_1.RECEIPTS_SLOW.conc : naverReceiptsScript_1.RECEIPTS_CONC,
            staggerMs: slow ? 0 : naverReceiptsScript_1.RECEIPTS_STAGGER_MS,
            gapMs: slow ? naverReceiptsScript_1.RECEIPTS_SLOW.gapMs : 0,
            timeoutMs: naverReceiptsScript_1.RECEIPTS_TIMEOUT_MS,
            deadlineMs: naverReceiptsScript_1.RECEIPTS_DEADLINE_MS,
        };
    };
    /** 목록 → 가져올 주문(최신 먼저, 한 주문에 한 줄, 이미 가져온 것 제외). 새 목록 행은 서버에 올린다 */
    const onList = (parsed) => {
        const inWindow = parsed.filter((o) => o.orderedAt.slice(0, 10) >= cutoff).sort((a, b) => (a.orderedAt < b.orderedAt ? 1 : a.orderedAt > b.orderedAt ? -1 : 0));
        const seenNo = new Set();
        const matched = new Set();
        const jobs = [];
        for (const o of inWindow) {
            if (!/^\d{16}$/.test(o.orderNo)) {
                stats.rejected++;
                continue;
            }
            if (seenNo.has(o.orderNo)) {
                stats.duplicates++;
                continue;
            }
            seenNo.add(o.orderNo);
            listedNos.add(o.orderNo);
            const key = (0, runOutcome_1.outcomeKey)(o.orderNo, o.orderedAt, o.amount);
            if (only) {
                if (!only.has(key))
                    continue;
                matched.add(key);
            }
            else if (refill) {
                if (!refillHit(o))
                    continue;
            } // 이미 받은 줄이어도 다시 받는다(서버가 빈 세부만 채운다)
            else if (knownNos.has(o.orderNo) || knownTails.has((0, exports.tailOf)(o.orderNo, o.orderedAt)) || (o.listKey !== undefined && knownKeys.has(o.listKey)))
                continue;
            jobs.push({ order: o, key, tries: 0 });
            if (jobs.length >= maxOrders)
                break;
        }
        if (only) {
            // 목록에서 이 줄을 못 찾았다(주문이 사라졌거나 시각이 바뀜) — 조용히 끝내지 않고 그 줄에 까닭을 남긴다
            // npv2: 쇼핑 목록에 없는 줄(네이버페이 내역 줄)은 내역 화면에서 날짜 · 금액으로 찾는다
            for (const k of only)
                if (!matched.has(k)) {
                    if (npv2) {
                        pendingOnly.add(k);
                        setOutcome(k, { state: 'fetching' });
                    }
                    else {
                        failN++;
                        setOutcome(k, { state: 'failed', code: 'no-pair' });
                    }
                }
        }
        else if (!refill)
            pending.push(...jobs.map((j) => j.order));
        queue = jobs;
        total = jobs.length;
        if (jobs.length === 0 && (only || refill) && pendingOnly.size === 0)
            return finish('all-rows');
        phase = 'pay';
        tries = 0;
        curPayPage = 1;
        return { type: 'goto', url: (0, naverReceipt_1.payHistoryUrl)(1) };
    };
    /** 영수증 한 장 → 서버로 보낼 완성 주문. 취소된 결제는 영수증이 없는 것으로 센다 */
    const settleOk = (j, slip) => {
        if (!slip) {
            fail(j, 'unreadable', { stage: 'read', via: 'fetch', words: 'noslip' });
            return;
        }
        const cancelled = !!slip.cancelAt || ((slip.cancelAmount ?? 0) > 0 && (slip.cancelAmount ?? 0) >= (slip.amount ?? j.order.amount));
        if (cancelled) {
            noneN++;
            setOutcome(j.key, { state: 'none', why: 'cancelled' });
            return;
        }
        // 주문상세 영수증(비카드)은 칸 이름이 아직 「미확인」이라 금액 · 시각은 목록(대표님 웹과 같은 내역)에서 이미 본 값을 먼저 쓴다
        const os = slip.orderSheet === true;
        const amount = os && j.order.amount > 0 ? j.order.amount : slip.amount ?? j.order.amount;
        if (os && !(amount > 0)) {
            none(j, { stage: 'read', via: 'fetch', path: OSHEET_PATH, words: 'osheet-noamount' });
            return;
        } // 주문상세 실패는 예전 결과 그대로 「영수증 없음」 — 기록에는 까닭(1.1.1)
        const paidAt = os ? ((0, naverReceipt_1.normalizeKst)(j.order.orderedAt) ?? (0, naverReceipt_1.normalizeKst)(slip.approvalAt)) : (0, naverReceipt_1.normalizeKst)(slip.approvalAt);
        const done = (0, naverReceipt_1.toImportOrder)({ businessNumber: slip.businessNo, approval: slip.approvalNo, paidAt: paidAt ?? undefined, amount, cardIssuer: slip.cardCompany }, { orderNo: j.order.orderNo, seller: slip.sellerName ?? j.order.seller, title: slip.productName ?? j.order.title, amount }, { kind: slip.tradeType === '현금영수증' || os ? 'purchase' : 'card', allowNoSeconds });
        if (!done && os) {
            none(j, { stage: 'read', via: 'fetch', path: OSHEET_PATH, words: 'osheet-import' });
            return;
        }
        if (!done) {
            fail(j, 'unreadable', { stage: 'read', via: 'fetch', words: 'card-import' });
            return;
        }
        if (slip.tradeType === '현금영수증')
            done.payment = '현금영수증'; // 현금영수증도 가져온다(11-02 대표님) — 카드로 적지 않는다
        if (os)
            done.payment = slip.tradeType?.startsWith('네이버페이') ? slip.tradeType.slice(0, 30) : '네이버페이'; // 예: 네이버페이 머니·포인트
        done.detail = (0, exports.detailOf)(slip);
        // 목록 행과 같은 키로 이어 서버가 목록 행을 완성본으로 바꾸게 한다(영수증의 결제 시각이 주문 시각과 달라도)
        if (j.order.listKey)
            done.listKey = j.order.listKey;
        orders.push(done);
        pending.push(done);
        okN++;
        setOutcome(j.key, { state: 'done' });
    };
    /** 네이버페이 결제 영수증 한 장 → 완성 주문(주문번호 자리에 결제 번호). 취소된 결제는 건너뛴다 */
    const settleNp = (id, slip) => {
        if (!slip) {
            npFail++;
            return;
        }
        if (!!slip.cancelAt || ((slip.cancelAmount ?? 0) > 0 && (slip.cancelAmount ?? 0) >= (slip.amount ?? 0)))
            return;
        const paidAt = (0, naverReceipt_1.normalizeKst)(slip.approvalAt);
        const done = (0, naverReceipt_1.toImportOrder)({ businessNumber: slip.businessNo, approval: slip.approvalNo, paidAt: paidAt ?? undefined, amount: slip.amount, cardIssuer: slip.cardCompany }, { orderNo: id, seller: slip.sellerName, title: slip.productName, amount: slip.amount ?? 0 }, { kind: 'card', allowNoSeconds });
        if (!done) {
            npFail++;
            return;
        }
        done.detail = (0, exports.detailOf)(slip);
        orders.push(done);
        pending.push(done);
        npOk++;
    };
    const onReceipts = (results) => {
        if (phase === 'pinfo')
            return onPinfo(results);
        if (phase !== 'receipts')
            return finish('unexpected-event');
        timeoutRun = 0;
        for (const r of results) {
            if (r.key === 'np:scan') {
                npFound += r.found ?? 0;
                lastScanPage = curPayPage;
                // 스크립트가 _next/data 로 모든 쪽을 한 번에 받았다(대표님 10-30) — 흐름은 쪽을 더 넘기지 않는다(한 번의 scan 으로 끝, 무한 재시도 금지)
                if (npv2 && r.full === true)
                    stopPaging = true;
                // 내역 페이지가 셸(__NEXT_DATA__ 없음, full 아님 · 0행)이면 pay 페이지를 리로드해 다시 스캔한다(최대 2회, 순차 — 렌더 전 셸을 읽어 0쪽 되던 문제 대표님 10-30). 리로드는 쪽 번호를 바꿔(page=2·3) 같은 URL 무시로 안 바뀌는 걸 막는다. 동시 스캔은 만들지 않는다(이벤트 구동이라 한 번에 하나)
                else if (npv2 && !only && r.full !== true && (r.rows?.length ?? 0) === 0 && scanTries < 2) {
                    scanTries++;
                    scanned = false;
                    scanNextPage = scanTries + 1;
                    scanTotal = Math.max(scanTotal, scanTries + 1);
                    curPayPage = 0;
                }
                // 쪽을 넘겼는데(curPayPage>1) 읽힌 쪽이 안 커졌다 — URL 로는 안 넘어간다(SPA). 더 안 넘기고 지금까지 모은 줄로 간다
                if (npv2 && typeof r.page === 'number' && curPayPage > 1 && r.page <= prevReadPage)
                    stopPaging = true;
                if (typeof r.page === 'number' && r.page > 0)
                    prevReadPage = r.page;
                if (npv2 && typeof r.pages === 'number' && r.pages > 0)
                    scanTotal = Math.min(r.pages, MAX_SCAN_PAGES);
                pageKnown = 0;
                if (r.rows)
                    addPayRows(r.rows);
                // 간편결제 줄을 모았으면(pinfoWait) 더 쪽을 넘기지 않고 그 줄들의 tid 를 orders 출처에서 받는다 — 내역은 SPA 라 ?page=n 으로 안 넘어간다(실기록 page 1/52 고정)
                if (npv2 && !only && pinfoWait.length > 0)
                    stopPaging = true;
                // 전체(npv2): 이 쪽의 줄이 모두 서버에 이미 받은 것이면 — 받은 날짜까지 왔다, 더 넘기지 않는다(16:50 「pages15-stop」 은 목록 줄 겹침을 받은 줄로 잘못 셌다)
                if (npv2 && !only && (r.rows?.length ?? 0) > 0 && pageKnown === r.rows?.length)
                    stopPaging = true;
                continue;
            }
            if (!r.key.startsWith('np:'))
                continue;
            if (r.st === 'ok')
                settleNp(r.key.slice(3), r.slip);
            else if (r.st !== 'none')
                npFail++;
        }
        const byKey = new Map(results.map((r) => [r.key, r]));
        const again = [];
        let sawLogin = false;
        let blocked = 0;
        for (const j of batch) {
            const r = byKey.get(j.key) ?? { key: j.key, st: 'net' };
            if (r.st === 'ok')
                settleOk(j, r.slip);
            // 카드영수증이 없는 쇼핑 주문 — 버리지 않고 주문상세(orderSheet)를 영수증으로 읽으러 orders 출처로(한 줄 한 번만)
            else if (r.st === 'none' && /^\d{16}$/.test(j.order.orderNo) && !osheetSent.has(j.key)) {
                osheetSent.add(j.key);
                pinfoWait.push({ j, osheet: true });
            }
            else if (r.st === 'none')
                none(j, { stage: 'read', via: 'fetch', ...(r.status !== undefined ? { http: r.status } : {}), words: `card-none${r.diag ? `-${r.diag.w}` : ''}` });
            else if (r.st === 'login') {
                sawLogin = true;
                again.push(j);
            }
            else if (r.st === 'blocked' || r.st === 'net') {
                if (r.st === 'blocked')
                    blocked++;
                if (j.tries + 1 < MAX_JOB_TRIES) {
                    j.tries++;
                    again.push(j);
                }
                else
                    fail(j, FAIL_OF[r.st] ?? 'network', { stage: 'request', via: 'fetch', ...(r.status !== undefined ? { http: r.status } : {}), words: `st-${r.st}${r.diag ? `-${r.diag.w}` : ''}`, tries: j.tries + 1 });
            }
            else
                fail(j, FAIL_OF[r.st] ?? 'unreadable', { stage: 'request', via: 'fetch', ...(r.status !== undefined ? { http: r.status } : {}), words: `st-${r.st}${r.diag ? `-${r.diag.w}` : ''}` });
        }
        batch = [];
        queue = [...again, ...queue];
        const proceed = () => {
            if (sawLogin) {
                phase = 'pay';
                tries = 0;
                return { type: 'login' };
            }
            if (blocked > 0) {
                slow = true;
                blockedRun++;
                if (blockedRun >= MAX_BLOCKED_RUN)
                    return finish('blocked');
            }
            else
                blockedRun = 0;
            return sendBatch();
        };
        // 실패한 줄의 응답 모양(값 없음)을 구조 기록으로 먼저 보낸다 — 줄별 까닭은 앱 화면에만 있어 서버에서 원인을 못 보던 문제(대표님 10-29 12:00)
        const items = [];
        for (const r of results) {
            if (!r.diag)
                continue;
            items.push({ where: `rcpt-${r.diag.w}-s${r.diag.status}`, host: 'pay.naver.com', path: r.diag.w === 'issue' ? '/receipts/issue-history' : r.diag.w === 'order' ? '/web-api/receipts/:n' : r.diag.w === 'offline' ? '/receipts/offline' : '/web-api/receipts/card-single', lines: r.diag.lines });
        }
        return items.length > 0 ? structureThen(items, proceed) : proceed();
    };
    const onTimeout = () => {
        if (phase === 'pinfo') {
            timeoutRun++;
            for (const w of pinfoBatch) {
                if (w.j.tries + 1 < MAX_JOB_TRIES) {
                    w.j.tries++;
                    pinfoWait.unshift(w);
                }
                else
                    missOrders(w, 'network');
            }
            pinfoBatch = [];
            if (timeoutRun >= MAX_TIMEOUT_RUN)
                return finish('timeouts');
            return pinfoWait.length > 0 ? sendPinfo() : backToPay();
        }
        if (phase === 'receipts') {
            timeoutRun++;
            const lost = batch;
            batch = [];
            const again = [];
            for (const j of lost) {
                if (j.tries + 1 < MAX_JOB_TRIES) {
                    j.tries++;
                    again.push(j);
                }
                else
                    fail(j, 'network', { stage: 'request', via: 'fetch', words: 'timeout', tries: j.tries + 1 });
            }
            queue = [...again, ...queue];
            if (timeoutRun >= MAX_TIMEOUT_RUN)
                return finish('timeouts');
            return sendBatch();
        }
        if (phase === 'list')
            return tries < 2 ? (tries++, listAction()) : finish('timeout');
        return retryOr('timeout');
    };
    const onPage = (url, text) => {
        lastUrl = url;
        lastText = text;
        if (phase === 'shop') {
            if ((0, naverReceipt_1.isLoginPage)(url, text))
                return { type: 'login' };
            if (hostOf(url) !== 'shopping.naver.com' || pathOf(url).indexOf('/my/order') !== 0)
                return retryOr('shop-lost');
            phase = 'list';
            tries = 0;
            return listAction();
        }
        if (phase === 'pinfoPage') {
            if (/^nid\.naver\.com/.test(hostOf(url)))
                return { type: 'login' };
            if (hostOf(url) !== 'orders.pay.naver.com') {
                for (const w of [...pinfoBatch, ...pinfoWait])
                    missOrders(w, 'no-pair');
                pinfoWait = [];
                pinfoBatch = [];
                return backToPay();
            }
            tries = 0;
            return sendPinfo();
        }
        if (phase === 'pay') {
            if (/^nid\.naver\.com/.test(hostOf(url)))
                return { type: 'login' };
            if (hostOf(url) !== 'pay.naver.com')
                return retryOr('pay-lost');
            tries = 0;
            return sendBatch();
        }
        return finish('unexpected-page');
    };
    const next = (ev) => {
        if (final)
            return final;
        if (ending)
            return drainEnd();
        steps++;
        if (ev.type !== 'start') {
            if (steps > maxSteps)
                return finish('max-steps');
            if (now() - startedAt > budgetMs)
                return finish('budget');
        }
        switch (ev.type) {
            case 'start':
                for (const n of ev.known?.orderNos ?? [])
                    knownNos.add(n);
                for (const k of ev.known?.listKeys ?? [])
                    knownKeys.add(k);
                for (const t of ev.known?.tails ?? [])
                    knownTails.add(t);
                // 저장된 가장 최근 주문 날짜부터만 읽는다 — 같은 날 주문은 주문번호 · 뒤4자리로 중복만 거른다(대표님 11-02). 처음(저장 없음)은 1년
                {
                    const last = opts.sinceLatest && !only && !refill ? (0, exports.latestKnownDay)(ev.known) : undefined;
                    if (last && last > cutoff)
                        cutoff = last;
                }
                phase = 'shop';
                tries = 0;
                return { type: 'goto', url: naverReceipt_1.SHOP_ORDER_URL };
            case 'page':
                return onPage(ev.url, ev.text);
            case 'api': {
                if (phase !== 'list' || ev.name !== 'shop')
                    return finish('unexpected-api');
                // 상품마다 한 줄 — 같은 주문번호는 한 주문으로 합친다(묶음 결제, 대표님 11-02 더마팩토리 3건 41,000). 취소 · 반품 상품은 금액에서 빼고, 전부 취소 · 반품이면 올리지 않는다
                const byNo = new Map();
                for (const it of ev.failed ? [] : ev.items) {
                    const o = (0, naverReceipt_1.shopItemToOrder)(it);
                    if (!o)
                        continue;
                    const off = (0, naverReceipt_1.shopItemCancelled)(it);
                    const g = byNo.get(o.orderNo) ?? { o, kept: 0, live: 0, n: 0 };
                    g.n++;
                    if (!off) {
                        g.kept += o.amount;
                        g.live++;
                    }
                    byNo.set(o.orderNo, g);
                }
                const parsed = [];
                for (const g of byNo.values()) {
                    if (g.live === 0) {
                        drop.cancel++;
                        listedNos.add(g.o.orderNo);
                        continue;
                    }
                    if (g.n > 1)
                        shopMerged++;
                    parsed.push(g.n > 1 || g.live < g.n ? { ...g.o, amount: g.kept, listKey: `${g.o.orderedAt.slice(0, 16)}|${g.kept}` } : g.o);
                }
                if (parsed.length === 0) {
                    listTries++;
                    return listTries < MAX_LIST_TRIES ? listAction() : finish('list-failed');
                }
                return onList(parsed);
            }
            case 'receipts':
                return onReceipts(ev.results);
            case 'resume':
                return after ? after() : finish('unexpected-event');
            case 'timeout':
                return onTimeout();
            default:
                return finish('unexpected-event');
        }
    };
    return {
        next,
        take: () => pending.splice(0),
        takeOutcomes: () => outcomes.splice(0),
        progress: () => ({ phase, done: okN + noneN + failN, total, orders: orders.length }),
    };
}
