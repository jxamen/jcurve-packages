"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ksnetDealNumb = exports.ksnetBody = exports.KSNET_JSON_URL = exports.KSNET_VIEW_URL = exports.OY_STORE_DETAIL_URL = exports.OY_STORE_JSON_URL = exports.OY_STORE_HTML_URL = exports.OY_DETAIL_URL = exports.OY_DEAL_URL = exports.OY_ONLINE_URL = exports.OY_LOGIN_PATH = exports.OY_HOME_URL = void 0;
exports.htmlText = htmlText;
exports.oyDealRows = oyDealRows;
exports.oyStoreRows = oyStoreRows;
exports.oyTotal = oyTotal;
exports.readKsnetSlip = readKsnetSlip;
exports.oyGroups = oyGroups;
exports.createOliveyoungApiFlow = createOliveyoungApiFlow;
/**
 * 올리브영 영수증 흐름 — 온라인 주문(거래증빙서류 · KSNET 카드 매출전표) + 매장 구매. **요청만** 쓴다(클릭 · 로그인 정보 입력 없음).
 * 서버 크롬 실측(tools/crawl-test presets.json `_version` 21 · src/flow.cjs runOliveyoung, 2026-11-05 대표님 15:45 「다이소 · 올리브영도 수집」) 순서 그대로:
 *  1) https://www.oliveyoung.co.kr/store/main/main.do 를 한 번 연다(요청 출처 — 클라우드플레어는 화면 밖 요청을 403 으로 막는다). 로그인 화면(/store/login/loginForm.do)이면 로그인
 *  2) 온라인 목록  GET /store/mypage/getOrderListJSON.do?searchMonth=-12&startDate=&endDate=&pageIdx=p  — 상품 줄 배열, 빈 배열 [] 까지. ordNo 로 묶는다
 *     취소(ordPrgsStatCdViewNm 에 취소 · 반품, 또는 모든 줄 realQty 0 + cnclQty/rtgsQty)는 뺀다(대표님 「취소는 빼기」)
 *  3) 거래증빙서류  GET /store/mypage/getDealList.do?pageIdx=p&searchMonth=-12&startDate=&endDate=  — HTML, tr[data-ord-no] 마다 총 결제금액 · #cardReceipt(data-van-cd · data-shop-sys-no) · #cashReceipt(data-cr-conf-no). 새 줄 없을 때까지
 *  4) 온라인 상세  GET /store/mypage/getOrderDetail.do?ordNo=  — HTML 글자 「총 결제금액 N」 · 결제수단 줄 시각(YYYY.MM.DD HH:MM:SS)
 *  5) 매장 목록    GET /store/mypage/getOrderList.do?searchMonth=-12&startDate=&endDate=&searchOrderType=20  — HTML 1년 한 번, a.btnDetail(data-oper-dt · data-deal-sp · data-origin-bizpl-cd · data-pos-no · data-receipt-no · data-frst-receipt-no, onclick goOrderDetail('주문번호','Y'))
 *     + 같은 목록 JSON(searchOrderType=20&pageIdx=p) — ordDtime(밀리초) · strNm · goodsNm · totSalePrc · 상태 · cnclQty · rtgsQty
 *  6) 매장 상세    GET /store/mypage/getOfflineOrderDetail.do?ordNo=<dealSp><주문번호>&operDt=&originBizplCd=&posNo=&receiptNo=&frstReceiptNo=  — HTML 「총 결제금액」 → 구매영수증(purchase)
 *  7) 카드 매출전표(마지막, vanCd 02 = KSNET) — 카드 주문마다 https://ksta.ksnet.co.kr/mint/tsk/pgi01/mad/pgimad19m1.jsp?tr_no=<shopSysNo> 로 이동 →
 *     같은 주소 HTML 원문의 pg_deal_numb : '<숫자>' → POST https://ksta.ksnet.co.kr/kfm/JsonChannelService.do (param=URL 인코딩 JSON, 폼) → response_data(appr_numb · appr_date · appr_time · amount · svos · vat · make_comp_gove_name · shop_name · entr_numb · canc_yn) → 카드영수증(card)
 *     토스 · CJ페이(다른 vanCd) · 현금영수증 화면은 내용 미확인 — 열지 않고 상세의 총 결제금액으로 구매영수증(purchase)
 * 같은 FlowEvent/FlowOut 규약(naverReceipt.ts). 쿠키 · 토큰 · 이름 · 주소 · 전화 · 카드번호는 이 파일 어디에도 없다 — 요청 모양과 응답 키 이름만. 로그에는 건수만.
 */
const naverReceipt_1 = require("./naverReceipt");
const naverApiFlow_1 = require("./naverApiFlow");
const siteFetch_1 = require("./siteFetch");
const runOutcome_1 = require("./runOutcome");
const shapeLines_1 = require("./shapeLines");
exports.OY_HOME_URL = 'https://www.oliveyoung.co.kr/store/main/main.do';
exports.OY_LOGIN_PATH = '/store/login/';
const OY = 'https://www.oliveyoung.co.kr/store/mypage';
const OY_ONLINE_URL = (p, from, to) => `${OY}/getOrderListJSON.do?searchMonth=-12&startDate=${from}&endDate=${to}&pageIdx=${p}`;
exports.OY_ONLINE_URL = OY_ONLINE_URL;
const OY_DEAL_URL = (p, from, to) => `${OY}/getDealList.do?pageIdx=${p}&searchMonth=-12&startDate=${from}&endDate=${to}`;
exports.OY_DEAL_URL = OY_DEAL_URL;
const OY_DETAIL_URL = (ordNo) => `${OY}/getOrderDetail.do?ordNo=${encodeURIComponent(ordNo)}`;
exports.OY_DETAIL_URL = OY_DETAIL_URL;
const OY_STORE_HTML_URL = (from, to) => `${OY}/getOrderList.do?searchMonth=-12&startDate=${from}&endDate=${to}&searchOrderType=20`;
exports.OY_STORE_HTML_URL = OY_STORE_HTML_URL;
const OY_STORE_JSON_URL = (p, from, to) => `${OY}/getOrderListJSON.do?searchMonth=-12&startDate=${from}&endDate=${to}&searchOrderType=20&pageIdx=${p}`;
exports.OY_STORE_JSON_URL = OY_STORE_JSON_URL;
const OY_STORE_DETAIL_URL = (s) => `${OY}/getOfflineOrderDetail.do?ordNo=${encodeURIComponent(s.dealSp + s.ordNo)}&operDt=${encodeURIComponent(s.operDt)}&originBizplCd=${encodeURIComponent(s.originBizplCd)}&posNo=${encodeURIComponent(s.posNo)}&receiptNo=${encodeURIComponent(s.receiptNo)}&frstReceiptNo=${encodeURIComponent(s.frstReceiptNo)}`;
exports.OY_STORE_DETAIL_URL = OY_STORE_DETAIL_URL;
const KSNET_VIEW_URL = (shopSysNo) => `https://ksta.ksnet.co.kr/mint/tsk/pgi01/mad/pgimad19m1.jsp?tr_no=${shopSysNo}`;
exports.KSNET_VIEW_URL = KSNET_VIEW_URL;
exports.KSNET_JSON_URL = 'https://ksta.ksnet.co.kr/kfm/JsonChannelService.do';
/** KSNET 매출전표 JSON 요청 본문(대표님 요청 본문 그대로, param= 뒤는 URL 인코딩) */
const ksnetBody = (pgDealNumb) => 'param=' + encodeURIComponent(JSON.stringify({ request_header: { deal_code: 'S0PGIMAD19I001', screen_id: 'pgimad19m0', requ_trm_sele_code: 'S', ssgbcd: 'A', non_certi_deal_yn: 'Y', file_proc_gbcd: null, tp_node_code: null, syst_code: 'PGI01', cross_domain_yn: 'N' }, request_data: { pg_deal_numb: pgDealNumb } }));
exports.ksnetBody = ksnetBody;
const SELLER = '올리브영';
const MAX_PAGES = 30;
const DAY_MS = 86400000;
const KST_MS = 9 * 3600000;
const MAX_LIST_TRIES = 3;
const MAX_JOB_TRIES = 2;
const MAX_BLOCKED_RUN = 3;
const MAX_TIMEOUT_RUN = 3;
const CANCEL = /취소|반품|환불/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const obj = (v) => (isObj(v) ? v : {});
const str = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const num = (v) => {
    if (typeof v === 'number')
        return Number.isFinite(v) && v >= 0 && v <= 1e12 ? Math.floor(v) : undefined;
    if (typeof v === 'string' && /\d/.test(v)) {
        const n = Number(v.replace(/[^\d.-]/g, ''));
        return Number.isFinite(n) && n >= 0 && n <= 1e12 ? Math.floor(n) : undefined;
    }
    return undefined;
};
const kstYmd = (ms) => new Date(ms + KST_MS).toISOString().slice(0, 10).replace(/-/g, '');
const pathOf = (url) => { const i = url.indexOf('/'); return i < 0 ? '/' : url.slice(i).split(/[?#]/)[0]; };
const hostOf = (url) => url.split('/')[0].toLowerCase();
const splitUrl = (url) => { const m = /^https:\/\/([^/?#]+)([^?#]*)/.exec(url); return { host: m ? m[1] : '', path: m ? m[2] : '/' }; };
const ORD_NO = /^[0-9A-Za-z_-]{6,40}$/;
/** 주소에 그대로 넣는 값 — 글자 · 숫자 · %(이미 인코딩됨) · _.-= 만 */
const SAFE_PARAM = /^[0-9A-Za-z%_.=-]{1,200}$/;
/* ---------------- HTML · JSON 읽기(순수 함수 — 시험한다) ---------------- */
const decodeEntities = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
/** HTML → 글자(스크립트 · 스타일 · 태그 제거, 공백 하나로) */
function htmlText(html) {
    return decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
const attr = (tag, name) => { const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag); return m ? decodeEntities((m[1] ?? m[2] ?? '').trim()) : ''; };
const strongTexts = (html) => [...html.matchAll(/<strong[^>]*>([\s\S]*?)<\/strong>/gi)].map((m) => htmlText(m[1] ?? '')).filter(Boolean);
/** 거래증빙서류 HTML → 주문별 줄(tr[data-ord-no]) */
function oyDealRows(html) {
    const out = [];
    for (const m of html.matchAll(/<tr\b([^>]*\bdata-ord-no\s*=\s*(?:"[^"]*"|'[^']*')[^>]*)>([\s\S]*?)<\/tr>/gi)) {
        const ordNo = attr(` ${m[1] ?? ''}`, 'data-ord-no');
        if (!ORD_NO.test(ordNo))
            continue;
        const body = m[2] ?? '';
        const cardTag = /<[^>]*\bid\s*=\s*["']cardReceipt["'][^>]*>/i.exec(body)?.[0] ?? '';
        const cashTag = /<[^>]*\bid\s*=\s*["']cashReceipt["'][^>]*>/i.exec(body)?.[0] ?? '';
        const tot = /<td[^>]*class\s*=\s*["'][^"']*colorOrange[^"']*["'][^>]*>[\s\S]*?<strong[^>]*>\s*([\d,]+)/i.exec(body);
        const row = { ordNo, card: cardTag !== '', vanCd: attr(cardTag, 'data-van-cd'), shopSysNo: attr(cardTag, 'data-shop-sys-no'), paySctCd: attr(cardTag, 'data-pay-sct-cd'), cash: cashTag !== '', crConfNo: attr(cashTag, 'data-cr-conf-no') };
        const total = tot ? num(tot[1]) : undefined;
        if (total !== undefined)
            row.total = total;
        out.push(row);
    }
    return out;
}
/** 매장 주문 목록 HTML → a.btnDetail 마다 한 줄(onclick goOrderDetail('주문번호','Y')). 상태는 같은 토막(tr · li)의 <strong> 글자 중 마지막 */
function oyStoreRows(html) {
    const out = [];
    const seen = new Set();
    for (const m of html.matchAll(/<a\b[^>]*class\s*=\s*["'][^"']*\bbtnDetail\b[^"']*["'][^>]*>/gi)) {
        const tag = m[0];
        const oc = /goOrderDetail\(\s*'([^']+)'\s*,\s*'([^']*)'/.exec(decodeEntities(attr(tag, 'onclick')));
        const ordNo = oc ? oc[1] : '';
        if (!ORD_NO.test(ordNo) || seen.has(ordNo))
            continue;
        seen.add(ordNo);
        const at = m.index ?? 0;
        const before = html.slice(Math.max(0, at - 6000), at);
        const openAt = Math.max(before.lastIndexOf('<tr'), before.lastIndexOf('<li'));
        const seg = html.slice(openAt >= 0 ? Math.max(0, at - 6000) + openAt : at, at + 4000);
        const close = seg.search(/<\/tr>|<\/li>/i);
        const strongs = strongTexts(close >= 0 ? seg.slice(0, close) : seg);
        out.push({ ordNo, store: (oc?.[2] ?? '') === 'Y', operDt: attr(tag, 'data-oper-dt').replace(/\D/g, ''), originBizplCd: attr(tag, 'data-origin-bizpl-cd'), posNo: attr(tag, 'data-pos-no'), receiptNo: attr(tag, 'data-receipt-no'), dealSp: attr(tag, 'data-deal-sp'), frstReceiptNo: attr(tag, 'data-frst-receipt-no'), status: strongs.length > 0 ? strongs[strongs.length - 1] : '' });
    }
    return out;
}
/** 주문 상세 HTML 글자 — 「총 결제금액 N」 · 결제수단 줄(카드사 / 일시불(YYYY.MM.DD HH:MM:SS)) */
function oyTotal(html) {
    const t = htmlText(html);
    const out = {};
    const m = /총\s*결제\s*금액\s*:?\s*([\d,]+)/.exec(t);
    const total = m ? num(m[1]) : undefined;
    if (total !== undefined)
        out.total = total;
    const d = /(\d{4}\.\d{2}\.\d{2})\s+(\d{2}:\d{2}:\d{2})/.exec(t);
    const paidAt = d ? (0, naverReceipt_1.normalizeKst)(`${d[1]} ${d[2]}`) : null;
    if (paidAt)
        out.paidAt = paidAt;
    const pm = /결제\s*수단\s*:?\s*([^(\d]{1,40}?)\s*(?:\(|\d|$)/.exec(t);
    if (pm)
        out.method = pm[1].trim().slice(0, 30);
    return out;
}
/** KSNET 매출전표 화면 원문의 거래번호 — 서버가 스크립트에 박아 둔 pg_deal_numb : '<숫자>' */
const ksnetDealNumb = (html) => /pg_deal_numb\s*:\s*['"](\d{8,20})['"]/.exec(html)?.[1] ?? null;
exports.ksnetDealNumb = ksnetDealNumb;
/** KSNET 매출전표 JSON — response_header.result_code 0 · response_data(appr_numb · appr_date · appr_time · amount · svos · vat · make_comp_gove_name · shop_name · entr_numb · canc_yn) */
function readKsnetSlip(json) {
    const h = obj(obj(json).response_header);
    const d = obj(obj(json).response_data);
    const code = str(h.result_code);
    const out = { ok: code === '0' && Object.keys(d).length > 0, code: code || '?', cancelled: /^y$/i.test(str(d.canc_yn)) };
    const approval = str(d.appr_numb);
    if (approval)
        out.approval = approval.slice(0, 30);
    const date = str(d.appr_date).replace(/\D/g, '');
    const time = str(d.appr_time).replace(/\D/g, '');
    const paidAt = date.length === 8 ? (0, naverReceipt_1.normalizeKst)(date + (time + '000000').slice(0, 6)) : (0, naverReceipt_1.normalizeKst)(str(d.appr_date));
    if (paidAt)
        out.paidAt = paidAt;
    const amount = num(d.amount);
    if (amount !== undefined)
        out.amount = amount;
    const supply = num(d.svos);
    if (supply !== undefined)
        out.supply = supply;
    const tax = num(d.vat);
    if (tax !== undefined)
        out.tax = tax;
    const issuer = str(d.make_comp_gove_name) || str(d.card_name);
    if (issuer)
        out.issuer = issuer.slice(0, 30);
    const merchant = str(d.shop_name);
    if (merchant)
        out.merchant = merchant.slice(0, 60);
    const biz = str(d.entr_numb).replace(/[^\d-]/g, '');
    if (biz)
        out.businessNumber = biz.slice(0, 20);
    return out;
}
/** 상품 줄 배열(온라인 · 매장 JSON)을 주문번호로 묶는다 — 취소 = 상태 글자에 취소 · 반품 · 환불, 또는 모든 줄 realQty 0 + cnclQty/rtgsQty */
function oyGroups(rows) {
    const by = new Map();
    for (const r of rows) {
        if (!isObj(r))
            continue;
        const no = str(r.ordNo);
        if (!ORD_NO.test(no))
            continue;
        const l = by.get(no);
        if (l)
            l.push(r);
        else
            by.set(no, [r]);
    }
    const out = [];
    for (const [ordNo, list] of by) {
        const status = list.map((x) => str(x.ordPrgsStatCdViewNm)).join(' ');
        const allGone = list.every((x) => (num(x.realQty) ?? 1) === 0 && ((num(x.cnclQty) ?? 0) > 0 || (num(x.rtgsQty) ?? 0) > 0));
        const names = list.map((x) => str(x.goodsNm)).filter(Boolean);
        const g = { ordNo, rows: list, cancelled: CANCEL.test(status) || allGone, orderedAt: (0, naverReceipt_1.normalizeKst)(num(list[0].ordDtime) ?? str(list[0].ordDtime) ?? str(list[0].ordDt)) };
        if (names.length > 0)
            g.title = `${names[0]}${names.length > 1 ? ` 외 ${names.length - 1}건` : ''}`.slice(0, 120);
        const store = str(list[0].strNm);
        if (store)
            g.seller = `${SELLER} ${store}`.slice(0, 60);
        const amount = list.reduce((a, x) => a + (num(x.totSalePrc) ?? num(x.salePrc) ?? 0), 0);
        if (amount > 0)
            g.amount = amount;
        out.push(g);
    }
    return out;
}
const FAIL_OF = { blocked: 'blocked', net: 'network', shape: 'unreadable', http: 'unreadable', login: 'login' };
function createOliveyoungApiFlow(opts = {}) {
    const now = opts.now ?? (() => Date.now());
    const maxSteps = opts.maxSteps ?? 4000;
    const budgetMs = opts.budgetMs ?? 1500000;
    const maxOrders = opts.maxOrders ?? 800;
    const allowNoSeconds = opts.allowNoSeconds ?? true;
    const only = opts.onlyKeys ? new Set(opts.onlyKeys) : null;
    const startedAt = now();
    const windowDays = opts.windowDays ?? 365;
    const fromYmd = kstYmd(startedAt - windowDays * DAY_MS);
    const toYmd = kstYmd(startedAt);
    const cutoff = `${fromYmd.slice(0, 4)}-${fromYmd.slice(4, 6)}-${fromYmd.slice(6, 8)}`;
    let phase = 'idle';
    let steps = 0;
    let tries = 0;
    let listTries = 0;
    let page = 1;
    let lastUrl = '';
    let lastText = '';
    let final = null;
    let after = null;
    let resumeAt = null;
    const knownNos = new Set();
    const knownKeys = new Set();
    const knownTails = new Set();
    const onlineRows = [];
    const deal = new Map();
    const storeHtml = new Map();
    const storeJsonRows = [];
    const seenNo = new Set();
    const recorded = new Set();
    let queue = [];
    let batch = [];
    const cardJobs = [];
    let ks = null;
    let ksDeal = '';
    const orders = [];
    const pending = [];
    const outcomes = [];
    const stats = { rejected: 0, probes: 0, duplicates: 0, unfetched: [], reasons: {} };
    const note = (k, n = 1) => { const r = (stats.reasons ?? (stats.reasons = {})); r[k] = (r[k] ?? 0) + n; };
    let totalN = 0;
    let okN = 0;
    let noneN = 0;
    let failN = 0;
    let okTotal = 0;
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
    const finish = (reason) => {
        if (final)
            return final;
        if (!ending) {
            const at = phase;
            phase = 'finished';
            after = null;
            ending = { reason, orders: pending.splice(0), stats: { ...stats } };
            endQueue = [`flowc-t${totalN}-k${okN}-x${noneN}-f${failN}-q${queue.length + cardJobs.length}`, `flowe-${reason}-${at}`];
        }
        return drainEnd();
    };
    const retryOr = (reason) => { if (tries < 2) {
        tries++;
        return READ;
    } return finish(reason); };
    const setOutcome = (key, outcome) => { outcomes.push({ key, outcome }); };
    const fail = (j, code) => { failN++; setOutcome(j.key, { state: 'failed', code }); stats.unfetched = [...(stats.unfetched ?? []), j.order.orderNo]; };
    const none = (j) => { noneN++; setOutcome(j.key, { state: 'none' }); pending.push((0, naverReceipt_1.noneOrder)(j.order)); };
    const cancelled = (j) => { noneN++; setOutcome(j.key, { state: 'none', why: 'cancelled' }); };
    const structThen = (where, url, data, used, then) => {
        if (recorded.has(where) || data === undefined || data === null)
            return then();
        recorded.add(where);
        const { host, path } = splitUrl(url);
        const lines = [...used.map((u) => `use ${u}`.slice(0, 200)), ...(0, shapeLines_1.structureLines)(data, 280)].slice(0, 300);
        after = then;
        return { type: 'structure', where, host, path, lines };
    };
    const run = (reqs, conc) => ({ kind: 'fetch', reqs, conc, staggerMs: slow ? 0 : conc > 1 ? siteFetch_1.FETCH_STAGGER_MS : 0, gapMs: slow ? siteFetch_1.FETCH_SLOW.gapMs : 0, timeoutMs: siteFetch_1.FETCH_TIMEOUT_MS, deadlineMs: siteFetch_1.FETCH_DEADLINE_MS });
    const getJson = (key, url) => ({ key, method: 'GET', url, as: 'json', xhr: true });
    const getHtml = (key, url) => ({ key, method: 'GET', url, as: 'html', accept: 'text/html,application/xhtml+xml,*/*' });
    const known = (o) => knownNos.has(o.orderNo) || knownTails.has((0, naverApiFlow_1.tailOf)(o.orderNo, o.orderedAt)) || (o.listKey !== undefined && knownKeys.has(o.listKey));
    /** 주문 하나를 일감으로 — 금액을 아직 모르면(상세에서 읽음) 목록 행은 올리지 않는다 */
    const enqueue = (o, isCancelled, extra, into) => {
        if (seenNo.has(o.orderNo)) {
            stats.duplicates++;
            note('drop-dup');
            return;
        }
        seenNo.add(o.orderNo);
        if (o.orderedAt.slice(0, 10) < cutoff) {
            note('drop-old');
            return;
        }
        const key = (0, runOutcome_1.outcomeKey)(o.orderNo, o.orderedAt, o.amount);
        if (only) {
            if (!only.has(key))
                return;
        }
        else if (known(o)) {
            note('skip-known');
            return;
        }
        const job = { order: o, key, tries: 0, store: false, ...extra };
        totalN++;
        if (isCancelled) {
            cancelled(job);
            return;
        }
        if (!only && o.amount >= 1)
            pending.push(o);
        into.push(job);
    };
    const listOf = (ordNo, orderedAt, amount, title, seller) => {
        const o = { orderNo: ordNo, orderedAt, amount: amount ?? 0, seller, payment: '카드', kind: 'list', needsReceipt: true, listKey: `${orderedAt.slice(0, 16)}|${amount ?? 0}` };
        if (title)
            o.title = title;
        return o;
    };
    /* ---- 2) 온라인 목록 JSON ---- */
    const onlineReq = () => { phase = 'online'; return run([getJson(`online-${page}`, (0, exports.OY_ONLINE_URL)(page, fromYmd, toYmd))], 1); };
    const onOnline = (r) => {
        if (r.st === 'ok') {
            okTotal++;
            timeoutRun = 0;
            listTries = 0;
            const rows = Array.isArray(r.data) ? r.data : [];
            const go = () => {
                if (!Array.isArray(r.data)) {
                    note('online-not-array');
                    return dealStart();
                }
                const fresh = rows.filter((x) => isObj(x) && !onlineRows.some((y) => str(y.ordNo) === str(x.ordNo) && str(y.ordGoodsSeq) === str(x.ordGoodsSeq)));
                onlineRows.push(...fresh);
                if (rows.length === 0 || fresh.length === 0 || page >= MAX_PAGES)
                    return dealStart();
                page++;
                return onlineReq();
            };
            return page === 1 && rows.length > 0 ? structThen('oy-online-list', (0, exports.OY_ONLINE_URL)(1, '#', '#'), rows.slice(0, 2), ['orderNo : ordNo', 'date : ordDtime(ms)', 'title : goodsNm', 'cancel : ordPrgsStatCdViewNm realQty cnclQty rtgsQty'], go) : go();
        }
        if (r.st === 'login') {
            phase = 'page';
            return { type: 'login' };
        }
        if (r.st === 'blocked') {
            slow = true;
            blockedRun++;
            if (blockedRun >= MAX_BLOCKED_RUN)
                return finish('blocked');
        }
        note(`online-${r.st}-${r.status ?? 0}`);
        listTries++;
        if (listTries < MAX_LIST_TRIES && r.st !== 'http')
            return onlineReq();
        return okTotal === 0 ? finish(r.st === 'blocked' ? 'blocked' : 'list-failed') : dealStart();
    };
    /* ---- 3) 거래증빙서류 HTML ---- */
    const dealStart = () => { note('online-rows', onlineRows.length); page = 1; listTries = 0; return dealReq(); };
    const dealReq = () => { phase = 'deal'; return run([getHtml(`deal-${page}`, (0, exports.OY_DEAL_URL)(page, fromYmd, toYmd))], 1); };
    const onDeal = (r) => {
        if (r.st === 'ok') {
            okTotal++;
            timeoutRun = 0;
            listTries = 0;
            const rows = oyDealRows(r.text ?? '');
            const fresh = rows.filter((x) => !deal.has(x.ordNo));
            for (const x of fresh)
                deal.set(x.ordNo, x);
            const go = () => {
                if (fresh.length === 0 || page >= MAX_PAGES)
                    return onlineJobs();
                page++;
                return dealReq();
            };
            return page === 1 && rows.length > 0 ? structThen('oy-deal-list', (0, exports.OY_DEAL_URL)(1, '#', '#'), rows.slice(0, 2).map((x) => ({ ...x, shopSysNo: x.shopSysNo ? '#' : '', crConfNo: x.crConfNo ? '#' : '' })), ['total : td.colorOrange strong', 'card : #cardReceipt data-van-cd data-shop-sys-no', 'cash : #cashReceipt data-cr-conf-no'], go) : go();
        }
        if (r.st === 'login') {
            phase = 'relogin';
            tries = 0;
            resumeAt = dealReq;
            return { type: 'login' };
        }
        if (r.st === 'blocked') {
            slow = true;
            blockedRun++;
            if (blockedRun >= MAX_BLOCKED_RUN)
                return finish('blocked');
        }
        note(`deal-${r.st}-${r.status ?? 0}`);
        listTries++;
        if (listTries < MAX_LIST_TRIES && r.st !== 'http')
            return dealReq();
        return onlineJobs();
    };
    const onlineJobs = () => {
        note('deal-rows', deal.size);
        const groups = oyGroups(onlineRows);
        let cancelN = 0;
        const jobs = [];
        for (const g of groups) {
            if (!g.orderedAt) {
                stats.rejected++;
                note('drop-unreadable');
                continue;
            }
            const d = deal.get(g.ordNo);
            const o = listOf(g.ordNo, g.orderedAt, d?.total ?? g.amount, g.title, SELLER);
            if (g.cancelled)
                cancelN++;
            enqueue(o, g.cancelled, d ? { deal: d } : {}, jobs);
            if (jobs.length >= maxOrders)
                break;
        }
        note('online-cancelled', cancelN);
        // 증빙 목록에만 있고 주문 목록에 없는 주문번호는 날짜를 모른다 — 상세에서 읽으려면 금액 0 · 날짜 없음이라 만들 수 없어 건너뛴다(건수만 기록)
        let onlyDeal = 0;
        for (const no of deal.keys())
            if (!groups.some((g) => g.ordNo === no))
                onlyDeal++;
        if (onlyDeal > 0)
            note('deal-only', onlyDeal);
        jobs.sort((a, b) => (a.order.orderedAt < b.order.orderedAt ? 1 : a.order.orderedAt > b.order.orderedAt ? -1 : 0));
        queue = jobs;
        return storeHtmlReq();
    };
    /* ---- 5) 매장 목록 HTML + JSON ---- */
    const storeHtmlReq = () => { phase = 'storehtml'; listTries = 0; return run([getHtml('store-html', (0, exports.OY_STORE_HTML_URL)(fromYmd, toYmd))], 1); };
    const onStoreHtml = (r) => {
        if (r.st === 'ok') {
            okTotal++;
            timeoutRun = 0;
            const rows = oyStoreRows(r.text ?? '').filter((x) => x.store);
            for (const x of rows)
                if (!storeHtml.has(x.ordNo))
                    storeHtml.set(x.ordNo, x);
            const go = () => { page = 1; listTries = 0; return storeJsonReq(); };
            return rows.length > 0 ? structThen('oy-store-list', (0, exports.OY_STORE_HTML_URL)('#', '#'), rows.slice(0, 2).map((x) => ({ ...x, ordNo: '#', receiptNo: x.receiptNo ? '#' : '', frstReceiptNo: x.frstReceiptNo ? '#' : '' })), ['orderNo : goOrderDetail(ordNo, Y)', 'date : data-oper-dt', 'detail : data-deal-sp data-origin-bizpl-cd data-pos-no data-receipt-no data-frst-receipt-no', 'status : strong'], go) : go();
        }
        if (r.st === 'login') {
            phase = 'relogin';
            tries = 0;
            resumeAt = storeHtmlReq;
            return { type: 'login' };
        }
        if (r.st === 'blocked') {
            slow = true;
            blockedRun++;
            if (blockedRun >= MAX_BLOCKED_RUN)
                return finish('blocked');
        }
        note(`store-html-${r.st}-${r.status ?? 0}`);
        listTries++;
        if (listTries < MAX_LIST_TRIES && r.st !== 'http')
            return storeHtmlReq();
        page = 1;
        listTries = 0;
        return storeJsonReq();
    };
    const storeJsonReq = () => { phase = 'storejson'; return run([getJson(`storej-${page}`, (0, exports.OY_STORE_JSON_URL)(page, fromYmd, toYmd))], 1); };
    const onStoreJson = (r) => {
        if (r.st === 'ok') {
            okTotal++;
            timeoutRun = 0;
            listTries = 0;
            const rows = Array.isArray(r.data) ? r.data : [];
            const go = () => {
                const fresh = rows.filter((x) => isObj(x) && !storeJsonRows.some((y) => str(y.ordNo) === str(x.ordNo) && str(y.ordGoodsSeq) === str(x.ordGoodsSeq) && str(y.goodsNm) === str(x.goodsNm)));
                storeJsonRows.push(...fresh);
                if (rows.length === 0 || fresh.length === 0 || page >= MAX_PAGES)
                    return storeJobs();
                page++;
                return storeJsonReq();
            };
            return page === 1 && rows.length > 0 ? structThen('oy-store-json', (0, exports.OY_STORE_JSON_URL)(1, '#', '#'), rows.slice(0, 2), ['orderNo : ordNo', 'date : ordDtime(ms)', 'store : strNm', 'amount : totSalePrc', 'cancel : ordPrgsStatCdViewNm cnclQty rtgsQty'], go) : go();
        }
        if (r.st === 'login') {
            phase = 'relogin';
            tries = 0;
            resumeAt = storeJsonReq;
            return { type: 'login' };
        }
        if (r.st === 'blocked') {
            slow = true;
            blockedRun++;
            if (blockedRun >= MAX_BLOCKED_RUN)
                return finish('blocked');
        }
        note(`store-json-${r.st}-${r.status ?? 0}`);
        listTries++;
        if (listTries < MAX_LIST_TRIES && r.st !== 'http')
            return storeJsonReq();
        return storeJobs();
    };
    const storeJobs = () => {
        const groups = new Map(oyGroups(storeJsonRows).map((g) => [g.ordNo, g]));
        note('store-rows', storeHtml.size);
        note('store-json-orders', groups.size);
        let cancelN = 0;
        const jobs = [];
        for (const s of storeHtml.values()) {
            const g = groups.get(s.ordNo);
            const orderedAt = g?.orderedAt ?? (s.operDt.length === 8 ? (0, naverReceipt_1.normalizeKst)(`${s.operDt}000000`) : null);
            if (!orderedAt) {
                stats.rejected++;
                note('drop-store-unreadable');
                continue;
            }
            const isCancelled = (g?.cancelled ?? false) || CANCEL.test(s.status);
            if (isCancelled)
                cancelN++;
            enqueue(listOf(s.ordNo, orderedAt, g?.amount, g?.title, g?.seller ?? SELLER), isCancelled, { store: true, storeRow: s }, jobs);
            if (jobs.length >= maxOrders)
                break;
        }
        // JSON 에만 있는 매장 주문(HTML 에 버튼이 없음)은 상세 주소 칸을 몰라 건너뛴다(건수만)
        let onlyJson = 0;
        for (const no of groups.keys())
            if (!storeHtml.has(no))
                onlyJson++;
        if (onlyJson > 0)
            note('store-json-only', onlyJson);
        note('store-cancelled', cancelN);
        jobs.sort((a, b) => (a.order.orderedAt < b.order.orderedAt ? 1 : a.order.orderedAt > b.order.orderedAt ? -1 : 0));
        queue = [...queue, ...jobs];
        return nextDetail();
    };
    /* ---- 4) · 6) 상세 HTML(온라인 · 매장) ---- */
    const nextDetail = () => {
        if (queue.length === 0)
            return ksStart();
        batch = queue.splice(0, slow ? siteFetch_1.FETCH_SLOW.batch : siteFetch_1.FETCH_BATCH);
        for (const j of batch)
            setOutcome(j.key, { state: 'fetching' });
        phase = 'detail';
        return run(batch.map((j) => getHtml(j.key, j.store && j.storeRow ? (0, exports.OY_STORE_DETAIL_URL)(j.storeRow) : (0, exports.OY_DETAIL_URL)(j.order.orderNo))), slow ? siteFetch_1.FETCH_SLOW.conc : siteFetch_1.FETCH_CONC);
    };
    /** 상세를 읽은 주문을 구매영수증으로(카드 매출전표를 못 받은 카드 주문 · 현금영수증 · 그 밖 결제) */
    const settlePurchase = (j, t, cash) => {
        const amount = t?.total ?? (j.order.amount >= 1 ? j.order.amount : undefined);
        if (amount === undefined) {
            if (t)
                none(j);
            else
                fail(j, 'unreadable');
            return;
        }
        const paidAt = t?.paidAt ?? j.order.orderedAt;
        const done = (0, naverReceipt_1.toImportOrder)({ paidAt, amount }, { orderNo: j.order.orderNo, seller: j.order.seller ?? SELLER, title: j.order.title, amount }, { kind: 'purchase', allowNoSeconds });
        if (!done) {
            fail(j, 'unreadable');
            return;
        }
        if (j.order.listKey && j.order.amount >= 1)
            done.listKey = j.order.listKey;
        if (cash)
            done.payment = '현금영수증';
        else if (t?.method && /카드/.test(t.method))
            done.payment = '카드';
        const detail = { totalAmount: amount, approvalAt: paidAt, merchantName: j.order.seller ?? SELLER };
        if (t?.method)
            detail.tradeType = t.method;
        done.detail = detail;
        orders.push(done);
        pending.push(done);
        okN++;
        setOutcome(j.key, { state: 'done' });
    };
    const settleCommon = (j, r, again, flags) => {
        if (r.st === 'login') {
            flags.login = true;
            again.push(j);
            return;
        }
        if (r.st === 'blocked' || r.st === 'net' || (r.st === 'http' && (r.status ?? 0) >= 500)) {
            if (r.st === 'blocked')
                flags.blocked++;
            if (j.tries + 1 < MAX_JOB_TRIES) {
                j.tries++;
                again.push(j);
            }
            else
                fail(j, r.st === 'blocked' ? 'blocked' : 'network');
            return;
        }
        fail(j, FAIL_OF[r.st] ?? 'unreadable');
    };
    const afterBatch = (flags, next) => {
        if (flags.login) {
            phase = 'relogin';
            tries = 0;
            resumeAt = next;
            return { type: 'login' };
        }
        if (flags.blocked > 0) {
            slow = true;
            blockedRun++;
            if (blockedRun >= MAX_BLOCKED_RUN)
                return finish('blocked');
        }
        else
            blockedRun = 0;
        return next();
    };
    const onDetail = (results) => {
        timeoutRun = 0;
        const byKey = new Map(results.map((r) => [r.key, r]));
        const again = [];
        const flags = { login: false, blocked: 0 };
        let first;
        for (const j of batch) {
            const r = byKey.get(j.key) ?? { key: j.key, st: 'net' };
            if (r.st === 'ok') {
                okTotal++;
                const t = oyTotal(r.text ?? '');
                first ?? (first = { where: j.store ? 'oy-store-detail' : 'oy-online-detail', url: j.store && j.storeRow ? (0, exports.OY_STORE_DETAIL_URL)({ ...j.storeRow, ordNo: '#', dealSp: '', operDt: '', originBizplCd: '', posNo: '', receiptNo: '', frstReceiptNo: '' }) : (0, exports.OY_DETAIL_URL)('#'), t });
                j.total = t;
                const d = j.deal;
                if (!j.store && d?.card && d.vanCd === '02' && SAFE_PARAM.test(d.shopSysNo)) {
                    cardJobs.push(j);
                    continue;
                } // 카드 매출전표는 마지막에 KSNET 에서
                if (!j.store && d?.card)
                    note(`card-van${d.vanCd || '?'}`);
                settlePurchase(j, t, !j.store && !!d?.cash && !d.card);
            }
            else
                settleCommon(j, r, again, flags);
        }
        batch = [];
        queue = [...again, ...queue];
        const go = () => afterBatch(flags, nextDetail);
        return first ? structThen(first.where, first.url, { total: first.t.total === undefined ? '' : '#', paidAt: first.t.paidAt ? '#' : '', method: first.t.method ? '#' : '' }, ['total : 「총 결제금액 N」', 'paidAt : 결제수단 줄 YYYY.MM.DD HH:MM:SS'], go) : go();
    };
    /* ---- 7) KSNET 카드 매출전표(이동 → 원문 → JSON) ---- */
    const ksStart = () => {
        if (cardJobs.length === 0)
            return finish('all-rows');
        note('ksnet-cards', cardJobs.length);
        return ksNext();
    };
    const ksNext = () => {
        const j = cardJobs.shift();
        if (!j)
            return finish('all-rows');
        ks = j;
        ksDeal = '';
        tries = 0;
        phase = 'ksview';
        return { type: 'goto', url: (0, exports.KSNET_VIEW_URL)(j.deal.shopSysNo) };
    };
    /** 매출전표를 못 받으면 상세의 총 결제금액으로 구매영수증 */
    const ksFallback = (why) => {
        const j = ks;
        ks = null;
        note(`ksnet-${why}`);
        if (j)
            settlePurchase(j, j.total, false);
        return ksNext();
    };
    const onKsPage = (url) => {
        const j = ks;
        if (!j)
            return ksNext();
        if (!/(^|\.)ksnet\.co\.kr$/.test(hostOf(url)))
            return ksFallback('view-lost');
        phase = 'ksfetch';
        return run([{ key: 'ksv', method: 'GET', url: (0, exports.KSNET_VIEW_URL)(j.deal.shopSysNo), as: 'html' }], 1);
    };
    const onKsFetch = (r) => {
        if (r.st !== 'ok')
            return ksFallback(`view-${r.st}`);
        const n = (0, exports.ksnetDealNumb)(r.text ?? '');
        if (!n)
            return ksFallback('no-dealno');
        ksDeal = n;
        phase = 'ksjson';
        return run([{ key: 'ksj', method: 'POST', url: exports.KSNET_JSON_URL, as: 'json', form: true, xhr: true, body: (0, exports.ksnetBody)(n) }], 1);
    };
    const onKsJson = (r) => {
        if (r.st !== 'ok')
            return ksFallback(`json-${r.st}`);
        const slip = readKsnetSlip(r.data);
        const j = ks;
        const go = () => {
            if (!j)
                return ksNext();
            if (!slip.ok)
                return ksFallback(`json-code-${slip.code}`);
            ks = null;
            if (slip.cancelled) {
                cancelled(j);
                return ksNext();
            }
            const amount = slip.amount ?? j.total?.total ?? (j.order.amount >= 1 ? j.order.amount : undefined);
            const paidAt = slip.paidAt ?? j.total?.paidAt ?? j.order.orderedAt;
            if (amount === undefined) {
                none(j);
                return ksNext();
            }
            const done = (0, naverReceipt_1.toImportOrder)({ paidAt, amount, approval: slip.approval, cardIssuer: slip.issuer, businessNumber: slip.businessNumber, merchant: slip.merchant }, { orderNo: j.order.orderNo, seller: SELLER, title: j.order.title, amount }, { kind: 'card', allowNoSeconds });
            if (!done) {
                fail(j, 'unreadable');
                return ksNext();
            }
            if (j.order.listKey && j.order.amount >= 1)
                done.listKey = j.order.listKey;
            const detail = { approvalAt: paidAt, approvalAmount: amount, totalAmount: amount, merchantName: slip.merchant ?? SELLER };
            if (slip.issuer)
                detail.cardCompany = slip.issuer;
            if (slip.approval)
                detail.approvalNo = slip.approval;
            if (slip.businessNumber)
                detail.merchantBusinessNo = slip.businessNumber;
            if (slip.supply !== undefined)
                detail.supplyAmount = slip.supply;
            if (slip.tax !== undefined)
                detail.taxAmount = slip.tax;
            done.detail = detail;
            orders.push(done);
            pending.push(done);
            okN++;
            setOutcome(j.key, { state: 'done' });
            return ksNext();
        };
        return structThen('oy-ksnet-slip', exports.KSNET_JSON_URL, r.data, ['ok : response_header.result_code 0', 'appr : response_data.appr_numb appr_date appr_time', 'amount : amount svos vat', 'card : make_comp_gove_name', 'merchant : shop_name entr_numb', 'cancel : canc_yn'], go);
    };
    const onTimeout = () => {
        if (phase === 'detail') {
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
                    fail(j, 'network');
            }
            queue = [...again, ...queue];
            if (timeoutRun >= MAX_TIMEOUT_RUN)
                return finish('timeouts');
            return nextDetail();
        }
        if (phase === 'online') {
            listTries++;
            return listTries < MAX_LIST_TRIES ? onlineReq() : (okTotal === 0 ? finish('timeout') : dealStart());
        }
        if (phase === 'deal') {
            listTries++;
            return listTries < MAX_LIST_TRIES ? dealReq() : onlineJobs();
        }
        if (phase === 'storehtml') {
            listTries++;
            return listTries < MAX_LIST_TRIES ? storeHtmlReq() : (page = 1, storeJsonReq());
        }
        if (phase === 'storejson') {
            listTries++;
            return listTries < MAX_LIST_TRIES ? storeJsonReq() : storeJobs();
        }
        if (phase === 'ksview' || phase === 'ksfetch' || phase === 'ksjson')
            return ksFallback('timeout');
        return retryOr('timeout');
    };
    const isLogin = (url) => pathOf(url).startsWith(exports.OY_LOGIN_PATH) || /\/login(\/|$)/i.test(pathOf(url));
    const onPage = (url, text) => {
        lastUrl = url;
        lastText = text;
        if (phase === 'ksview')
            return onKsPage(url);
        if (isLogin(url))
            return { type: 'login' };
        if (!/(^|\.)oliveyoung\.co\.kr$/.test(hostOf(url)))
            return retryOr('shop-lost');
        tries = 0;
        if (phase === 'page' || phase === 'online') {
            page = 1;
            return onlineReq();
        }
        if (phase === 'relogin') {
            const f = resumeAt;
            resumeAt = null;
            return f ? f() : onlineReq();
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
                phase = 'page';
                tries = 0;
                return { type: 'goto', url: exports.OY_HOME_URL };
            case 'page':
                return onPage(ev.url, ev.text);
            case 'resume': {
                const f = after;
                after = null;
                return f ? f() : READ;
            }
            case 'fetched': {
                const one = (prefix) => ev.results.find((r) => r.key.startsWith(prefix)) ?? { key: prefix, st: 'net' };
                if (phase === 'online')
                    return onOnline(one('online-'));
                if (phase === 'deal')
                    return onDeal(one('deal-'));
                if (phase === 'storehtml')
                    return onStoreHtml(one('store-html'));
                if (phase === 'storejson')
                    return onStoreJson(one('storej-'));
                if (phase === 'detail')
                    return onDetail(ev.results);
                if (phase === 'ksfetch')
                    return onKsFetch(one('ksv'));
                if (phase === 'ksjson')
                    return onKsJson(one('ksj'));
                return finish('unexpected-event');
            }
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
        progress: () => ({ phase, done: okN + noneN + failN, total: totalN, orders: orders.length }),
    };
}
