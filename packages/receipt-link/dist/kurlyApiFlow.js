"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kurlyReceiptUrl = exports.KURLY_RECEIPT_URL = exports.kurlyDetailUrl = exports.KURLY_ADDRESS_URL = exports.KURLY_ORDERS_URL = exports.KURLY_LIST_URL = void 0;
exports.orderNoOf = orderNoOf;
exports.findOrderRows = findOrderRows;
exports.hasFilledArray = hasFilledArray;
exports.kurlyRowToOrder = kurlyRowToOrder;
exports.kurlyRowParse = kurlyRowParse;
exports.readKurlyDetail = readKurlyDetail;
exports.findDefaultAddress = findDefaultAddress;
exports.kurlySlip = kurlySlip;
exports.kurlyReceiptData = kurlyReceiptData;
exports.createKurlyApiFlow = createKurlyApiFlow;
/**
 * 컬리 영수증 흐름(8차) — **요청만** 쓴다. 영수증 화면을 열거나 단추를 누르거나 막히면 화면 방식으로 되돌아가는 길이 없다(대표님 10-29 09:03).
 * 예외(대표님 10-29 17:05 「크롤링 안되면 브라우저 눌러서라도 수집해」 · 11-02 「어떤 방식이든 해결」): 영수증 호스트(pg.kurlypay.co.kr)가
 * 교차 출처 요청을 받지 않아(모든 요청이 net) 두 묶음 연속 한 건도 못 읽으면, 숨은 웹뷰가 영수증 주소를 **직접 열어**(goto) 화면 글자(JSON 본문)를 읽는다.
 * 화면을 여는 것은 이 대체 길뿐이고, 단추를 누르거나 사용자 로그인 정보를 앱이 넣는 일은 없다.
 * 같은 FlowEvent/FlowOut 규약(naverReceipt.ts)을 따르고 구동기가 숨은 웹뷰에서 범용 요청(fetch 동작, siteFetch.ts)을 실행한다.
 * 쿠키 · 토큰 · 주소 · 영수증 내용 값은 이 파일 어디에도 없다 — 대표님 10-28 23:46~23:50 원문의 요청 모양과 응답 키 이름만 쓴다.
 *
 *  1) https://www.kurly.com/mypage/order 를 한 번 열어 둔다(요청을 부를 출처 페이지 — 실행당 한 번, 로그인이 풀렸으면 로그인 화면)
 *  2) 목록  POST https://api.kurly.com/order-external/v4/mypage/orders   본문 {startDate, endDate, page, limit:10, productName:"", address, addressDetail}   (23:46:23)
 *     — address · addressDetail 은 대표님 배송지라 앱이 모른다 → 먼저 빈 값으로 보내고, 4xx 로 거절되면 컬리 페이지(__NEXT_DATA__)에서 기본 배송지 값을 이름으로 찾아 한 번 다시 보낸다
 *  3) 상세  POST https://api.kurly.com/order-external/v3/mypage/orders/{주문번호}   본문 {address, addressDetail}   (23:47:51) — 영수증 요청의 encreq 를 얻는다
 *  4) 영수증 GET https://pg.kurlypay.co.kr/api/payments/receipt/request/card?encreq=…   (23:50:20, 응답 JSON 키는 원문 그대로 매핑)
 *  5) 결제수단이 네이버페이인 주문은 영수증이 따로 없다(23:48:03) → 실패가 아니라 「영수증 없음」
 * 최신 주문부터 FETCH_BATCH 건씩 상세 → 영수증 두 번에 나눠 부르고, 주문마다 결과를 takeOutcomes 로 알린다. 이미 서버에 영수증까지 있는 주문(start.known)은 건너뛰고 onlyKeys 면 그 줄만.
 * 막히면(403 · 429) 한 번에 2건 · 하나씩 · 요청 사이를 늘리고 연달아 세 번이면 끝낸다. 모든 요청이 net 으로만 끝나면(교차 출처 거절) 'cross-origin' 으로 끝낸다.
 *
 * 응답 모양을 모르는 칸(목록 · 상세)은 **이름으로 찾는다**(아래 규칙) — 틀리면 줄에 까닭이 뜨고, 같은 응답의 키 구조(값 없음)를 structure 로 한 번씩 남긴다.
 *   목록 줄    : 값이 13자리 숫자인 칸이 든 객체들의 배열 중 가장 많은 것(컬리 주문번호는 13자리). 그 줄의 주문번호 = 13자리 값(키 이름에 order 가 든 것 먼저)
 *   주문 일시  : 키 이름이 (order|regist|reg|create)…(date|time|dt|at) 인 칸 먼저, 없으면 date|time|dt|at 인 칸. 날짜만 있으면 00:00:00
 *   금액       : 키 이름 점수 — final|payment|pay +3 · total +2 · price|amount|money +1 이 가장 높은 양수
 *   상품명     : 키 이름이 (product|goods|item|order)…(name|title) 인 글자, 없으면 name|title(수령인 · 주소 이름은 뺀다)
 *   취소       : 키 이름이 status|state 인 칸의 값에 「취소」 · cancel 이 있으면 취소 주문 → 영수증 없음으로 센다
 *   네이버페이 : 상세 응답 어디든 글자 값에 「네이버페이」 · NAVER_PAY · NPAY 가 있으면
 *   encreq     : 키 이름이 encreq 인 글자, 없으면 값에 「encreq=」가 든 글자에서 꺼낸다
 *   기본 배송지: address|addr|baseAddress|roadAddress 글자 + addressDetail|detailAddress|addrDetail 글자
 */
const naverReceipt_1 = require("./naverReceipt");
const naverApiFlow_1 = require("./naverApiFlow");
const siteFetch_1 = require("./siteFetch");
const runOutcome_1 = require("./runOutcome");
const shapeLines_1 = require("./shapeLines");
exports.KURLY_LIST_URL = 'https://www.kurly.com/mypage/order';
exports.KURLY_ORDERS_URL = 'https://api.kurly.com/order-external/v4/mypage/orders';
exports.KURLY_ADDRESS_URL = 'https://api.kurly.com/addressbook/v1/cart/check-base-address-notification';
const kurlyDetailUrl = (orderNo) => `https://api.kurly.com/order-external/v3/mypage/orders/${orderNo}`;
exports.kurlyDetailUrl = kurlyDetailUrl;
exports.KURLY_RECEIPT_URL = 'https://pg.kurlypay.co.kr/api/payments/receipt/request/card';
const SELLER = '컬리';
const PAGE_LIMIT = 10;
const MAX_PAGES = 40;
const DAY_MS = 86400000;
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const hostOf = (url) => url.split('/')[0].toLowerCase();
const pathOf = (url) => { const i = url.indexOf('/'); return i < 0 ? '/' : url.slice(i).split(/[?#]/)[0]; };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const scalar = (v) => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
/* ---------------- 응답에서 이름으로 찾기(순수 함수 — 시험한다) ---------------- */
/** 주문번호: 자릿수로 거르지 않는다(대표님 11-03 「3자리든 20자리든」) — 키 이름이 주문번호 칸(order…No · …Number · …Id)이고 값이 숫자인 것 */
const ORDER_NO = /^\d{1,40}$/;
const ORDER_NO_KEY = /(order|^ord).*(no|num|number|id|seq|sn)$/i;
/** 객체의 글자 · 숫자 칸을 깊이 2까지 [키 이름, 값] 으로 편다 */
function flat(o) {
    const out = [];
    for (const k of Object.keys(o)) {
        const v = o[k];
        if (isObj(v)) {
            for (const k2 of Object.keys(v)) {
                const s = scalar(v[k2]);
                if (s)
                    out.push([k2, s]);
            }
            continue;
        }
        const s = scalar(v);
        if (s)
            out.push([k, s]);
    }
    return out;
}
/** 줄의 주문번호 — 주문번호 칸 가운데 가장 긴 숫자(순번 · 수량 같은 작은 숫자를 집지 않게). 없으면 '' */
function orderNoOf(o) {
    let best = '';
    for (const [k, s] of flat(o))
        if (ORDER_NO_KEY.test(k) && ORDER_NO.test(s) && s.length > best.length)
            best = s;
    return best;
}
/** 목록 응답 → 주문 줄 배열(주문번호 칸이 든 객체가 가장 많은 배열). 없으면 [] */
function findOrderRows(json) {
    let best = [];
    let n = 0;
    const hasNo = (o) => orderNoOf(o) !== '';
    const walk = (v, depth) => {
        if (depth > 7 || n++ > 5000)
            return;
        if (Array.isArray(v)) {
            const rows = v.filter(isObj).filter(hasNo);
            if (rows.length > best.length)
                best = rows;
            for (const x of v.slice(0, 60))
                walk(x, depth + 1);
        }
        else if (isObj(v))
            for (const k of Object.keys(v))
                walk(v[k], depth + 1);
    };
    walk(json, 0);
    return best;
}
/** 값이 든 객체 배열이 하나라도 있는가 — 주문번호 모양을 못 찾았는데 목록이 있는 응답(모양 못 읽음)과 정말 빈 응답을 가른다 */
function hasFilledArray(json) {
    let n = 0;
    const walk = (v, depth) => {
        if (depth > 7 || n++ > 5000)
            return false;
        if (Array.isArray(v))
            return (v.length > 0 && v.some(isObj)) || v.slice(0, 20).some((x) => walk(x, depth + 1));
        if (isObj(v))
            return Object.keys(v).some((k) => walk(v[k], depth + 1));
        return false;
    };
    return walk(json, 0);
}
const toKst = (s) => {
    const t = (0, naverReceipt_1.normalizeKst)(s);
    if (t)
        return t;
    const d = /^(\d{4})[.\-/](\d{2})[.\-/](\d{2})$/.exec(s.trim());
    return d ? `${d[1]}-${d[2]}-${d[3]} 00:00:00` : null;
};
const DATE_KEY_STRONG = /(order|regist|reg|create).*(date|time|dt|at)$/i;
const DATE_KEY_WEAK = /(date|time|dt|at)$/i;
const NAME_KEY_STRONG = /(product|goods|item|order).*(name|title)/i;
const NAME_KEY_WEAK = /(name|title)/i;
const NAME_KEY_BAD = /(user|member|receiver|recipient|addr|deliver|sender|shop)/i;
/** 목록 줄 하나 → 목록 주문(kind list). 주문번호 · 일시 · 금액 중 하나라도 못 찾으면 null */
function kurlyRowToOrder(row) {
    return kurlyRowParse(row).p;
}
/** kurlyRowToOrder + 못 읽은 까닭(no-orderno · no-date · no-amount) — 실행 끝 기록용 */
function kurlyRowParse(row) {
    const f = flat(row);
    const orderNo = orderNoOf(row);
    if (!orderNo)
        return { p: null, why: 'no-orderno' };
    const dateKeys = [...f.filter(([k]) => DATE_KEY_STRONG.test(k)), ...f.filter(([k]) => !DATE_KEY_STRONG.test(k) && DATE_KEY_WEAK.test(k))];
    let orderedAt = null;
    for (const [, v] of dateKeys) {
        orderedAt = toKst(v);
        if (orderedAt)
            break;
    }
    let amount = 0;
    let score = 0;
    for (const [k, v] of f) {
        if (!/^\d[\d,]*$/.test(v))
            continue;
        const n = Number(v.replace(/,/g, ''));
        if (!(n > 0 && n <= 1000000000))
            continue;
        const sc = (/(final|payment|pay)/i.test(k) ? 3 : 0) + (/total/i.test(k) ? 2 : 0) + (/(price|amount|money)/i.test(k) ? 1 : 0);
        if (sc > score) {
            score = sc;
            amount = n;
        }
    }
    // 실측(11-02 서버 구조 기록): 목록 줄은 {groupOrderNo, paymentCompletedAt, deliveryGroups:[{orderStatus, dealProducts:[{dealProductName, quantity, displayPrice, displayDiscountPrice}]}], isSelfCancelable} —
    // 금액 · 이름 · 상태가 배열 안에 있어 flat 이 못 읽는다(전 줄이 amount 0 으로 버려져 컬리는 6건을 받고도 0건이었다). 배열 안에서 찾는다
    const groups = Array.isArray(row.deliveryGroups) ? row.deliveryGroups.filter(isObj) : [];
    const products = groups.flatMap((g) => (Array.isArray(g.dealProducts) ? g.dealProducts.filter(isObj) : []));
    if (amount < 1 && products.length > 0) {
        const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
        amount = products.reduce((sum, d) => sum + (num(d.displayDiscountPrice) || num(d.displayPrice)) * (num(d.quantity) || 1), 0);
    }
    if (!orderedAt)
        return { p: null, why: 'no-date' };
    if (amount < 1)
        return { p: null, why: 'no-amount' };
    const nameOfProduct = products.map((d) => scalar(d.dealProductName) || scalar(d.contentsProductName)).find((n) => n.length > 0);
    const title = nameOfProduct ?? (f.find(([k, v]) => NAME_KEY_STRONG.test(k) && !NAME_KEY_BAD.test(k) && v.length > 0 && !/^\d+$/.test(v)) ?? f.find(([k, v]) => NAME_KEY_WEAK.test(k) && !NAME_KEY_BAD.test(k) && !/^\d+$/.test(v)))?.[1];
    const OFF = /취소|반품|환불|cancel|return|refund/i;
    const groupStates = groups.map((g) => scalar(g.orderStatus)).filter((x) => x.length > 0);
    const cancelled = f.some(([k, v]) => /(status|state)/i.test(k) && OFF.test(v)) || (groupStates.length > 0 && groupStates.every((x) => OFF.test(x))); // 묶음이 여럿이면 전부 취소 · 반품일 때만(일부만이면 남은 묶음은 받는다)
    return { p: { order: (0, naverReceipt_1.listOrder)({ orderNo, orderedAt, amount, seller: SELLER, ...(title ? { title: title.slice(0, 80) } : {}) }), cancelled } };
}
/** 상세 응답 → 네이버페이 여부 · 영수증 요청 값(encreq). 어디든 이름으로 찾는다 */
function readKurlyDetail(json) {
    let npay = false;
    let method = '';
    let encreq;
    let card;
    let paidAt;
    let amount;
    let n = 0;
    const walk = (v, key, depth) => {
        if (depth > 9 || n++ > 6000)
            return;
        if (typeof v === 'number') {
            if (amount === undefined && /^totalPaymentPrice$/i.test(key) && v > 0)
                amount = v;
            return;
        }
        if (typeof v === 'string') {
            // 「영수증 보기」 버튼 주소(receipt.creditCardUrl)를 이름으로 먼저 — payment.cardBillRedirectUrl 같은 다른 주소의 encreq 를 집지 않는다(대표님 10-28 19:58 「카드 결제면 영수증보기 누르면 영수증이 열림」)
            if (!card && /^creditCardUrl$/i.test(key) && /^https:\/\/pg\.kurlypay\.co\.kr\//.test(v))
                card = v;
            if (!paidAt && /^paymentCompletedAt$/i.test(key) && v.length >= 10)
                paidAt = v;
            if (/^paymentMethod$/i.test(key))
                method = v;
            if (/네이버\s*페이|NAVER_?PAY|NPAY/i.test(v))
                npay = true;
            if (!encreq && /^encreq$/i.test(key) && v.length > 8)
                encreq = v;
            if (!encreq) {
                const m = /encreq=([^&"'\s]+)/.exec(v);
                if (m && m[1].length > 8)
                    encreq = m[1];
            }
            return;
        }
        if (Array.isArray(v)) {
            for (const x of v.slice(0, 80))
                walk(x, key, depth + 1);
            return;
        }
        if (isObj(v))
            for (const k of Object.keys(v))
                walk(v[k], k, depth + 1);
    };
    walk(json, '', 0);
    // 결제수단 칸이 있으면 그것으로만 가른다 — 응답 다른 곳의 「npay」 글자(주소 · 결제사 id)로 카드 결제를 네이버페이로 잘못 보지 않게
    if (/네이버\s*페이|naver|npay/i.test(method) || method === 'pay_point')
        npay = true;
    else if (/card|카드/i.test(method))
        npay = false;
    if (card)
        encreq = card;
    return { npay, method, ...(encreq ? { encreq } : {}), ...(paidAt ? { paidAt } : {}), ...(amount !== undefined ? { amount } : {}) };
}
/** 영수증 요청 값 → 요청 주소. 이미 퍼센트 부호가 든 값은 그대로, 아니면 부호를 붙인다(base64 의 + / =) */
const kurlyReceiptUrl = (encreq) => {
    if (/^https:\/\/pg\.kurlypay\.co\.kr\/\S{1,1900}$/.test(encreq))
        return encreq;
    if (!/^[A-Za-z0-9+/=%_\-.~]{9,400}$/.test(encreq))
        return null;
    return `${exports.KURLY_RECEIPT_URL}?encreq=${/%[0-9A-Fa-f]{2}/.test(encreq) ? encreq : encodeURIComponent(encreq)}`;
};
exports.kurlyReceiptUrl = kurlyReceiptUrl;
/** 응답 어디든 기본 배송지(주소 + 상세 주소)를 이름으로 찾는다 — 주소만 있고 상세가 없으면 상세는 빈 글자 */
function findDefaultAddress(json) {
    let n = 0;
    let found = null;
    const walk = (v, depth) => {
        if (found && found.addressDetail !== '')
            return;
        if (depth > 9 || n++ > 8000)
            return;
        if (Array.isArray(v)) {
            for (const x of v.slice(0, 40))
                walk(x, depth + 1);
            return;
        }
        if (!isObj(v))
            return;
        const keys = Object.keys(v);
        const ak = keys.find((k) => /^(address|addr|baseAddress|roadAddress|roadAddr)$/i.test(k) && typeof v[k] === 'string' && v[k].trim() !== '');
        if (ak) {
            const dk = keys.find((k) => /^(addressDetail|detailAddress|addrDetail|addressDetail1|address_sub)$/i.test(k) && typeof v[k] === 'string');
            const cand = { address: v[ak].trim(), addressDetail: dk ? v[dk].trim() : '' };
            if (!found || (found.addressDetail === '' && cand.addressDetail !== ''))
                found = cand;
        }
        for (const k of keys)
            walk(v[k], depth + 1);
    };
    walk(json, 0);
    return found;
}
function kurlySlip(json) {
    let obj = null;
    let n = 0;
    const walk = (v, depth) => {
        if (obj || depth > 6 || n++ > 2000)
            return;
        if (Array.isArray(v)) {
            for (const x of v.slice(0, 20))
                walk(x, depth + 1);
            return;
        }
        if (!isObj(v))
            return;
        if ('CARD_APP_NO' in v) {
            obj = v;
            return;
        }
        for (const k of Object.keys(v))
            walk(v[k], depth + 1);
    };
    walk(json, 0);
    if (!obj)
        return null;
    const o = obj;
    const approval = scalar(o.CARD_APP_NO).trim();
    const dt = scalar(o.APP_DT);
    const tmRaw = scalar(o.APP_TM).trim();
    const tm = tmRaw ? tmRaw.padStart(6, '0') : '';
    // 승인 일시: APP_DT(YYYYMMDD) + APP_TM(HHmmss), 없으면 CREATED_DTTM(YYYY-MM-DD HH:mm:ss)
    const paidAt = /^\d{8}$/.test(dt) && /^\d{6}$/.test(tm)
        ? (0, naverReceipt_1.normalizeKst)(`${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)} ${tm.slice(0, 2)}:${tm.slice(2, 4)}:${tm.slice(4, 6)}`)
        : (0, naverReceipt_1.normalizeKst)(scalar(o.CREATED_DTTM));
    const amt = scalar(o.GOODS_AMT).replace(/,/g, '');
    const amount = /^\d+$/.test(amt) && Number(amt) > 0 ? Number(amt) : undefined;
    if (!approval || !paidAt || amount === undefined)
        return null;
    const biz = scalar(o.CO_NO).replace(/[^0-9]/g, '');
    const cancelled = scalar(o.CC_DT).trim() !== '' || /취소/.test(scalar(o.STATE_NM));
    const seller = scalar(o.CO_NM).trim();
    const title = scalar(o.GOODS_NM).trim();
    const card = scalar(o.CARD_NM).trim();
    const slip = { approval, paidAt, amount, ...(biz ? { businessNumber: biz } : {}), ...(card ? { cardIssuer: card } : {}) };
    // 세부 칸(서버 receipt_link_orders.detail) — 대표님 23:50:20 원문 키를 서버 허용 칸(model.ts RECEIPT_DETAIL_KEYS) 이름으로 옮긴다
    const detail = {
        ...(card ? { cardCompany: card } : {}), approvalNo: approval, approvalAt: paidAt, approvalAmount: amount,
        ...(seller ? { sellerName: seller } : {}), ...(biz ? { sellerBusinessNo: biz } : {}), ...(title ? { productName: title.slice(0, 200) } : {}),
    };
    return { slip, ...(seller ? { seller } : {}), ...(title ? { title: title.slice(0, 200) } : {}), cancelled, detail };
}
function kurlyReceiptData(text) {
    const t = text.trim();
    if (/^[{[]/.test(t)) {
        try {
            return JSON.parse(t);
        }
        catch {
            return undefined;
        }
    }
    const match = /\bvar\s+data\s*=\s*(\[[\s\S]*?\])\s*;/.exec(t);
    if (!match)
        return undefined;
    try {
        return JSON.parse(match[1]);
    }
    catch {
        return undefined;
    }
}
/* ---------------- 흐름 ---------------- */
const MAX_LIST_TRIES = 3;
const MAX_JOB_TRIES = 2;
const MAX_BLOCKED_RUN = 3;
const MAX_TIMEOUT_RUN = 3;
const MAX_NET_STRIKES = 2;
const FAIL_OF = { blocked: 'blocked', net: 'network', shape: 'unreadable', http: 'unreadable', login: 'login' };
const splitUrl = (url) => {
    const m = /^https:\/\/([^/?#]+)([^?#]*)/.exec(url);
    return { host: m ? m[1] : '', path: (m ? m[2] : '/').replace(/\d{6,}/g, '#') };
};
function createKurlyApiFlow(opts = {}) {
    const now = opts.now ?? (() => Date.now());
    const maxSteps = opts.maxSteps ?? 4000;
    const budgetMs = opts.budgetMs ?? 1500000;
    const maxOrders = opts.maxOrders ?? 800;
    const allowNoSeconds = opts.allowNoSeconds ?? false;
    const only = opts.onlyKeys ? new Set(opts.onlyKeys) : null;
    const startedAt = now();
    let cutoff = ymd(startedAt - (opts.windowDays ?? naverReceipt_1.LOOKBACK_DAYS) * DAY_MS);
    const untilDate = ymd(startedAt + 9 * 3600000);
    let phase = 'idle';
    let steps = 0;
    let tries = 0;
    let listTries = 0;
    let page = 1;
    let lastUrl = '';
    let lastText = '';
    let final = null;
    let after = null;
    const knownNos = new Set();
    const knownKeys = new Set();
    const knownTails = new Set();
    const listRows = [];
    const seenNo = new Set();
    const recorded = new Set();
    let addr = { address: '', addressDetail: '' };
    let addrTried = false;
    let addrBack = 'list';
    let queue = [];
    let batch = [];
    let rbatch = [];
    const orders = [];
    const pending = [];
    const outcomes = [];
    const stats = { rejected: 0, probes: 0, duplicates: 0, unfetched: [], reasons: {} };
    /** 까닭 하나 세기 — 목록에서 읽은 줄이 어디서 빠졌는지(값 없이 개수만, 11-03 「주문 몇 개가 안 불러와짐」) */
    const note = (k, n = 1) => { const r = (stats.reasons ?? (stats.reasons = {})); r[k] = (r[k] ?? 0) + n; };
    let total = 0;
    let okN = 0;
    let noneN = 0;
    let failN = 0;
    let okTotal = 0;
    let receiptOk = 0;
    let blockedRun = 0;
    let timeoutRun = 0;
    let netStrikes = 0;
    let slow = false;
    /* 컬리 매출전표는 확인된 creditCardUrl 페이지를 연다 — 목록 · 상세는 HTTP 유지 */
    let navMode = true;
    let routeN = 0;
    let blankN = 0;
    let blankLog = [];
    let navJobs = [];
    let navJob = null;
    let navFailRun = 0;
    const MAX_NAV_FAIL_RUN = 3;
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
            endQueue = [`flowc-t${total}-k${okN}-x${noneN}-f${failN}-q${queue.length}`, `flowe-${reason}-${at}`];
        }
        return drainEnd();
    };
    const retryOr = (reason) => {
        if (tries < 2) {
            tries++;
            return READ;
        }
        return finish(reason);
    };
    const setOutcome = (key, outcome) => { outcomes.push({ key, outcome }); };
    const fail = (j, code) => {
        failN++;
        setOutcome(j.key, { state: 'failed', code });
        stats.unfetched = [...(stats.unfetched ?? []), j.order.orderNo];
    };
    /** 영수증이 없는 결제 — 줄은 「영수증 없음」, 서버에는 목록 행을 none 으로 바꾸는 행을 보낸다(「목록만」으로 남지 않게, 11-04) */
    const none = (j) => { noneN++; setOutcome(j.key, { state: 'none' }); pending.push((0, naverReceipt_1.noneOrder)(j.order)); };
    /** 취소된 주문 — 「취소된 주문」 줄만, 서버에는 보내지 않는다(목록 단계의 취소 행과 같다) */
    const cancelled = (j) => { noneN++; setOutcome(j.key, { state: 'none', why: 'cancelled' }); };
    /** 응답의 키 구조(값 없음)를 같은 모양마다 한 번만 남긴다. 찾아 쓴 칸의 키 이름도 맨 앞에 붙인다 */
    const structThen = (where, url, data, used, then) => {
        if (recorded.has(where) || data === undefined || data === null)
            return then();
        recorded.add(where);
        const { host, path } = splitUrl(url);
        const lines = [...used.map((u) => `use ${u}`.slice(0, 200)), ...(0, shapeLines_1.structureLines)(data, 280)].slice(0, 300);
        after = then;
        return { type: 'structure', where, host, path, lines };
    };
    const run = (reqs, conc) => ({
        kind: 'fetch', reqs, conc,
        staggerMs: slow ? 0 : conc > 1 ? siteFetch_1.FETCH_STAGGER_MS : 0,
        gapMs: slow ? siteFetch_1.FETCH_SLOW.gapMs : 0,
        timeoutMs: siteFetch_1.FETCH_TIMEOUT_MS, deadlineMs: siteFetch_1.FETCH_DEADLINE_MS,
    });
    const body = (extra = {}) => JSON.stringify({ ...extra, address: addr.address, addressDetail: addr.addressDetail });
    const listReq = () => {
        phase = 'list';
        return run([{ key: `list-${page}`, method: 'POST', url: exports.KURLY_ORDERS_URL, as: 'json', body: body({ startDate: `${cutoff}T00:00:00`, endDate: `${untilDate}T23:59:59`, page, limit: PAGE_LIMIT, productName: '' }) }], 1);
    };
    const addrReq = (back) => {
        addrTried = true;
        addrBack = back;
        phase = 'addr';
        return run([{ key: 'addr', method: 'GET', url: exports.KURLY_ADDRESS_URL, as: 'json' }], 1);
    };
    const detailBatch = () => {
        if (queue.length === 0)
            return finish('all-rows');
        batch = queue.splice(0, slow ? siteFetch_1.FETCH_SLOW.batch : siteFetch_1.FETCH_BATCH);
        for (const j of batch)
            setOutcome(j.key, { state: 'fetching' });
        phase = 'detail';
        return run(batch.map((j) => ({ key: j.key, method: 'POST', url: (0, exports.kurlyDetailUrl)(j.order.orderNo), as: 'json', body: body() })), slow ? siteFetch_1.FETCH_SLOW.conc : siteFetch_1.FETCH_CONC);
    };
    const nextBatch = () => (queue.length === 0 ? finish('all-rows') : detailBatch());
    /** 목록 줄 전체 → 가져올 주문(최신 먼저, 한 주문에 한 줄, 이미 가져온 것 제외). 새 목록 행은 서버에 올린다 */
    const onList = () => {
        const parsed = [];
        note('list-rows', listRows.length);
        note(`list-pages-${page}`);
        for (const r of listRows) {
            const x = kurlyRowParse(r);
            if (x.p)
                parsed.push(x.p);
            else {
                stats.rejected++;
                note(`drop-${x.why}`);
            }
        }
        note('drop-old', parsed.filter((p) => p.order.orderedAt.slice(0, 10) < cutoff).length);
        const inWindow = parsed.filter((p) => p.order.orderedAt.slice(0, 10) >= cutoff).sort((a, b) => (a.order.orderedAt < b.order.orderedAt ? 1 : a.order.orderedAt > b.order.orderedAt ? -1 : 0));
        const matched = new Set();
        const jobs = [];
        const cancelledJobs = [];
        seenNo.clear();
        for (const { order: o, cancelled } of inWindow) {
            if (seenNo.has(o.orderNo)) {
                stats.duplicates++;
                note('drop-dup');
                continue;
            }
            seenNo.add(o.orderNo);
            const key = (0, runOutcome_1.outcomeKey)(o.orderNo, o.orderedAt, o.amount);
            if (only) {
                if (!only.has(key))
                    continue;
                matched.add(key);
            }
            else if (knownNos.has(o.orderNo) || knownTails.has((0, naverApiFlow_1.tailOf)(o.orderNo, o.orderedAt)) || (o.listKey !== undefined && knownKeys.has(o.listKey))) {
                note('skip-known');
                continue;
            }
            const job = { order: o, key, tries: 0 };
            if (cancelled)
                cancelledJobs.push(job);
            else
                jobs.push(job);
            if (jobs.length + cancelledJobs.length >= maxOrders)
                break;
        }
        if (only) {
            for (const k of only)
                if (!matched.has(k)) {
                    failN++;
                    setOutcome(k, { state: 'failed', code: 'no-pair' });
                }
        }
        else
            pending.push(...jobs.map((j) => j.order)); // 취소 주문은 서버에 올리지 않는다(대표님 11-02)
        for (const j of cancelledJobs) {
            noneN++;
            setOutcome(j.key, { state: 'none', why: 'cancelled' });
        }
        queue = jobs;
        total = jobs.length + cancelledJobs.length;
        if (jobs.length === 0)
            return finish('all-rows');
        return detailBatch();
    };
    const usedForList = (rows) => {
        const first = rows[0];
        if (!first)
            return [];
        const f = flat(first);
        const pick = (re, bad) => f.find(([k]) => re.test(k) && !(bad && bad.test(k)))?.[0];
        return [
            `orderNo : ${(0, shapeLines_1.safeKey)(pick(/order/i) ?? '-')}`, `date : ${(0, shapeLines_1.safeKey)(pick(DATE_KEY_STRONG) ?? pick(DATE_KEY_WEAK) ?? '-')}`,
            `amount : ${(0, shapeLines_1.safeKey)(pick(/(final|payment|pay|total|price|amount|money)/i) ?? '-')}`, `title : ${(0, shapeLines_1.safeKey)(pick(NAME_KEY_STRONG, NAME_KEY_BAD) ?? pick(NAME_KEY_WEAK, NAME_KEY_BAD) ?? '-')}`,
        ];
    };
    const onListResult = (r) => {
        if (r.st === 'ok') {
            okTotal++;
            timeoutRun = 0;
            listTries = 0;
            const rows = findOrderRows(r.data);
            const go = () => {
                if (rows.length === 0) {
                    if (page === 1 && listRows.length === 0 && hasFilledArray(r.data))
                        return finish('list-shape');
                    return listRows.length === 0 ? finish('all-rows') : onList();
                }
                const fresh = rows.filter((x) => { const k = orderNoOf(x); if (seenNo.has(k))
                    return false; seenNo.add(k); return true; });
                listRows.push(...fresh);
                const oldest = rows.map((x) => kurlyRowToOrder(x)?.order.orderedAt.slice(0, 10) ?? '9999').sort()[0];
                // 실제 응답 {data:{items, pagination:{hasNext}}} (11-02 실측) — 맨 위 pagination 도 받아 둔다
                const pg = isObj(r.data) && isObj(r.data.data) && isObj(r.data.data.pagination) ? r.data.data.pagination : isObj(r.data) && isObj(r.data.pagination) ? r.data.pagination : null;
                const hasNext = pg ? pg.hasNext === true : rows.length >= PAGE_LIMIT;
                if (!hasNext || fresh.length === 0 || oldest < cutoff || page >= MAX_PAGES)
                    return onList();
                page++;
                return listReq();
            };
            return page === 1 ? structThen('kurly-list', exports.KURLY_ORDERS_URL, r.data, usedForList(rows), go) : go();
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
            listTries++;
            return listTries < MAX_LIST_TRIES ? listReq() : finish('blocked');
        }
        note(`list-${r.st}-${r.status ?? 0}`);
        // 4xx(주소 값 거절로 본다): 컬리 페이지에서 기본 배송지를 찾아 한 번 다시 — 그래도 안 되면 끝낸다(대표님 지시)
        if (r.st === 'http' && (r.status ?? 0) >= 400 && (r.status ?? 0) < 500)
            return !addrTried && page === 1 ? addrReq('list') : finish('list-failed');
        listTries++;
        if (listTries < MAX_LIST_TRIES)
            return listReq();
        return r.st === 'net' && okTotal === 0 ? finish('cross-origin') : finish('list-failed');
    };
    const onAddr = (r) => {
        const found = r.st === 'ok' ? findDefaultAddress(r.data) : null;
        const used = found ? [`address : found`, `addressDetail : ${found.addressDetail ? 'found' : 'empty'}`] : ['address : none'];
        const back = () => {
            if (!found)
                return looksLoggedOut(lastText) ? (phase = 'page', { type: 'login' }) : finish('list-failed');
            addr = found;
            return addrBack === 'detail' ? detailBatch() : listReq();
        };
        return r.st === 'ok' ? structThen('kurly-addr', exports.KURLY_ADDRESS_URL, r.data, used, back) : back();
    };
    /** 영수증 한 장 → 서버로 보낼 완성 주문 */
    const settleOk = (j, ks) => {
        if (ks.cancelled) {
            cancelled(j);
            return;
        } // 영수증이 취소된 주문 — 「영수증 없음」 행을 서버에 남기지 않는다
        const amount = ks.slip.amount ?? j.order.amount;
        const done = (0, naverReceipt_1.toImportOrder)(ks.slip, { orderNo: j.order.orderNo, seller: ks.seller ?? j.order.seller ?? SELLER, title: ks.title ?? j.order.title, amount }, { kind: 'card', allowNoSeconds });
        if (!done) {
            fail(j, 'unreadable');
            return;
        }
        if (j.order.listKey)
            done.listKey = j.order.listKey;
        if (ks.detail)
            done.detail = ks.detail;
        orders.push(done);
        pending.push(done);
        okN++;
        setOutcome(j.key, { state: 'done' });
    };
    /**
     * 카드 매출전표를 못 받는 결제(네이버페이 · 카드 직접 결제 · 영수증 주소 없음 · 영수증 화면이 빔) — 주문상세(목록에서 본 금액 · 시각 · 상품)를 구매영수증으로 올린다.
     * 대표님 11-02 23:36 「컬리 아직도 제대로 못 가져옴」 — 네이버페이 주문상세와 같은 기준. 배송지 · 이름 · 전화는 쓰지 않는다. 만들 수 없으면 예전처럼 「영수증 없음」
     */
    const settleSheet = (j) => {
        const paidAt = (0, naverReceipt_1.normalizeKst)(j.paidAt ?? '') ?? (0, naverReceipt_1.normalizeKst)(j.order.orderedAt);
        const amount = j.paid ?? j.order.amount;
        const done = paidAt && amount > 0
            ? (0, naverReceipt_1.toImportOrder)({ paidAt, amount }, { orderNo: j.order.orderNo, seller: j.order.seller ?? SELLER, title: j.order.title, amount }, { kind: 'purchase', allowNoSeconds })
            : null;
        if (!done) {
            none(j);
            return;
        }
        if (j.npay)
            done.payment = '네이버페이';
        if (j.order.listKey)
            done.listKey = j.order.listKey;
        orders.push(done);
        pending.push(done);
        okN++;
        setOutcome(j.key, { state: 'done' });
    };
    /** 한 묶음 결과에서 공통 처리: 로그인 · 막힘 · 시간 초과 갈래. again 은 다시 시도할 주문 */
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
                delete j.encreq;
                again.push(j);
            }
            else
                fail(j, r.st === 'blocked' ? 'blocked' : 'network');
            return;
        }
        fail(j, FAIL_OF[r.st] ?? 'unreadable');
    };
    const afterBatch = (again, flags) => {
        queue = [...again, ...queue];
        if (flags.login) {
            phase = 'relogin';
            tries = 0;
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
        return nextBatch();
    };
    const receiptBatch = (jobs) => {
        if (navMode) {
            navJobs = [...jobs];
            return navNext();
        }
        rbatch = jobs;
        phase = 'receipt';
        const reqs = [];
        for (const j of jobs) {
            const url = j.encreq ? (0, exports.kurlyReceiptUrl)(j.encreq) : null;
            if (url)
                reqs.push({ key: j.key, method: 'GET', url, as: 'json' });
        }
        return run(reqs, slow ? siteFetch_1.FETCH_SLOW.conc : siteFetch_1.FETCH_CONC);
    };
    /** 웹뷰 직접 열기(교차 출처 대체 길): 다음 영수증 주소로 이동한다. 다 읽으면 출처 페이지로 돌아가 남은 주문의 상세 단계를 이어 간다 */
    const navNext = () => {
        const j = navJobs.shift();
        navJob = j ?? null;
        if (j) {
            phase = 'receiptnav';
            return { type: 'goto', url: (0, exports.kurlyReceiptUrl)(j.encreq) };
        }
        if (blankLog.length > 0) {
            const lines = blankLog;
            blankLog = [];
            return structThen(`kurly-blank-${blankN}`, exports.KURLY_RECEIPT_URL, {}, lines, navNext);
        }
        // 영수증 호스트(pg.kurlypay.co.kr) 출처에서는 api.kurly.com 요청이 또 교차 출처로 막힌다 — 상세 요청 전에 출처 페이지로 되돌아간다
        if (queue.length > 0) {
            phase = 'pageback';
            return { type: 'goto', url: exports.KURLY_LIST_URL };
        }
        return nextBatch();
    };
    /** 로그인 뒤 웹뷰 직접 열기 이어 가기 — 읽던 영수증부터 다시 */
    const navResume = () => {
        if (navJob) {
            navJobs.unshift(navJob);
            navJob = null;
        }
        return navJobs.length > 0 ? navNext() : nextBatch();
    };
    /** 웹뷰 직접 열기를 그만둘 때 — 아직 읽지 못한 줄(읽는 중 · 상세 대기)에 모두 까닭을 남긴다 */
    const failNavRest = () => {
        if (navJob) {
            fail(navJob, 'network');
            navJob = null;
        }
        for (const j of navJobs)
            fail(j, 'network');
        navJobs = [];
        for (const j of queue)
            fail(j, 'network');
        queue = [];
    };
    const onDetail = (results) => {
        timeoutRun = 0;
        const byKey = new Map(results.map((r) => [r.key, r]));
        const resOf = (j) => byKey.get(j.key) ?? { key: j.key, st: 'net' };
        const is4xx = (r) => r.st === 'http' && (r.status ?? 0) >= 400 && (r.status ?? 0) < 500;
        // 상세가 4xx 로 거절됐고 아직 배송지를 찾지 않았으면 — 이 묶음을 통째로 되돌리고 기본 배송지를 찾아 같은 묶음을 한 번 다시 보낸다
        if (!addrTried && addr.address === '' && batch.some((j) => is4xx(resOf(j)))) {
            queue = [...batch, ...queue];
            batch = [];
            return addrReq('detail');
        }
        const again = [];
        const flags = { login: false, blocked: 0 };
        const toReceipt = [];
        let firstOk;
        const route = [];
        for (const j of batch) {
            const r = resOf(j);
            if (r.st === 'ok') {
                okTotal++;
                firstOk ?? (firstOk = r);
                const d = readKurlyDetail(r.data);
                if (d.paidAt)
                    j.paidAt = d.paidAt;
                if (d.amount !== undefined)
                    j.paid = d.amount;
                if (d.npay)
                    j.npay = true;
                let to = 'sheet';
                if (d.npay || d.method === 'pay_credit_card')
                    settleSheet(j);
                else if (d.encreq && (0, exports.kurlyReceiptUrl)(d.encreq)) {
                    j.encreq = d.encreq;
                    toReceipt.push(j);
                    to = 'receipt';
                }
                else
                    settleSheet(j);
                // 줄마다 어느 길로 갔는지(값 없이 결제수단 코드 · 주소 있음/없음만)
                route.push(`o${route.length + 1} method=${/^[A-Za-z_]{1,30}$/.test(d.method) ? d.method : d.method ? '?' : '-'} card=${d.encreq?.startsWith('https://') ? 'url' : d.encreq ? 'enc' : 'none'} npay=${d.npay ? 'y' : 'n'} to=${to}`);
            }
            else
                settleCommon(j, r, again, flags);
        }
        batch = [];
        const go = () => {
            if (toReceipt.length === 0 || flags.login || flags.blocked > 0) {
                // 로그인 · 막힘이면 영수증 단계는 건너뛰고 같은 주문을 처음부터 다시(시도 횟수는 안 센다)
                for (const j of toReceipt)
                    delete j.encreq;
                return afterBatch([...toReceipt, ...again], flags);
            }
            queue = [...again, ...queue];
            return receiptBatch(toReceipt);
        };
        const withRoute = () => (route.length > 0 ? structThen(`kurly-route-${++routeN}`, (0, exports.kurlyDetailUrl)('0'.repeat(13)), {}, route, go) : go());
        return firstOk ? structThen('kurly-detail', (0, exports.kurlyDetailUrl)('0'.repeat(13)), firstOk.data, usedForDetail(firstOk.data), withRoute) : withRoute();
    };
    const usedForDetail = (data) => {
        const d = readKurlyDetail(data);
        return [`encreq : ${d.encreq ? 'found' : 'none'}`, `npay : ${d.npay ? 'yes' : 'no'}`];
    };
    const onReceipt = (results) => {
        timeoutRun = 0;
        const byKey = new Map(results.map((r) => [r.key, r]));
        const rs = rbatch.map((j) => ({ j, r: byKey.get(j.key) ?? { key: j.key, st: 'net' } }));
        // 영수증 요청이 한 번도 안 돌아온 채 연달아 전부 net 이면 교차 출처 거절 — 두 번 연속이면 요청을 되풀이하지 않고
        // 숨은 웹뷰가 영수증 주소를 직접 연다(대표님 11-02 「어떤 방식이든 해결」 · 10-29 17:05 「브라우저 눌러서라도 수집해」)
        const allNet = rs.length > 0 && rs.every((x) => x.r.st === 'net');
        if (allNet && receiptOk === 0) {
            netStrikes++;
            if (netStrikes >= MAX_NET_STRIKES) {
                navMode = true;
                rbatch = [];
                return receiptBatch(rs.map((x) => x.j));
            }
        }
        else
            netStrikes = 0;
        const again = [];
        const flags = { login: false, blocked: 0 };
        let firstOk;
        for (const { j, r } of rs) {
            if (r.st === 'ok') {
                okTotal++;
                receiptOk++;
                firstOk ?? (firstOk = r);
                const ks = kurlySlip(r.data);
                if (!ks)
                    fail(j, 'unreadable');
                else
                    settleOk(j, ks);
            }
            else
                settleCommon(j, r, again, flags);
        }
        rbatch = [];
        const go = () => afterBatch(again, flags);
        return firstOk ? structThen('kurly-receipt', exports.KURLY_RECEIPT_URL, firstOk.data, ['slip : CARD_APP_NO CO_NM CO_NO APP_DT APP_TM GOODS_AMT'], go) : go();
    };
    /** creditCardUrl 페이지의 var data 배열에서 승인 정볼만 읽고 개인정보 칸은 저장하지 않는다 */
    const onReceiptPage = (url, text) => {
        const j = navJob;
        navJob = null;
        if (!j)
            return navNext();
        if (/\/login/i.test(pathOf(url)) || /^(nid|accounts)\./.test(hostOf(url))) {
            navJobs.unshift(j);
            phase = 'relogin';
            tries = 0;
            return { type: 'login' };
        }
        const data = kurlyReceiptData(text);
        // 영수증 화면을 못 읽었을 때 화면 모양(길이 · 칸 이름 있음/없음만 — 글자 값은 남기지 않는다)
        const blankLines = () => [`path=${hostOf(url)}${pathOf(url)}`.slice(0, 120), `textLen=${text.length}`, `varData=${/var\s+data\s*=/.test(text) ? 'y' : 'n'}`, `CARD_APP_NO=${/CARD_APP_NO/.test(text) ? 'y' : 'n'}`, `parsed=${data === undefined ? 'none' : Array.isArray(data) ? `array${data.length}` : typeof data}`];
        if (data === undefined) {
            // 빈 화면 · 오류 화면 — 연달아 세 번이면 영수증 호스트가 막은 것으로 보고 끝낸다
            navFailRun++;
            settleSheet(j);
            if (navFailRun >= MAX_NAV_FAIL_RUN) {
                failNavRest();
                return finish('cross-origin');
            }
            if (blankLog.length < 30)
                blankLog.push(...blankLines().map((l) => `b${++blankN} ${l}`));
            return navNext();
        }
        navFailRun = 0;
        const ks = kurlySlip(data);
        if (!ks) {
            settleSheet(j);
            if (blankLog.length < 30)
                blankLog.push(...blankLines().map((l) => `b${++blankN} ${l}`));
        }
        else
            settleOk(j, ks);
        const go = () => navNext();
        return structThen('kurly-receipt', exports.KURLY_RECEIPT_URL, data, ['via : navigate', 'slip : CARD_APP_NO CO_NM CO_NO APP_DT APP_TM GOODS_AMT'], go);
    };
    const onTimeout = () => {
        if (phase === 'receiptnav') {
            const j = navJob;
            navJob = null;
            if (j) {
                if (j.tries + 1 < MAX_JOB_TRIES) {
                    j.tries++;
                    navJobs.unshift(j);
                }
                else
                    fail(j, 'network');
            }
            navFailRun++;
            if (navFailRun >= MAX_NAV_FAIL_RUN) {
                failNavRest();
                return finish('cross-origin');
            }
            return navNext();
        }
        if (phase === 'detail' || phase === 'receipt') {
            timeoutRun++;
            const lost = phase === 'detail' ? batch : rbatch;
            batch = [];
            rbatch = [];
            const again = [];
            for (const j of lost) {
                if (j.tries + 1 < MAX_JOB_TRIES) {
                    j.tries++;
                    delete j.encreq;
                    again.push(j);
                }
                else
                    fail(j, 'network');
            }
            queue = [...again, ...queue];
            if (timeoutRun >= MAX_TIMEOUT_RUN)
                return finish('timeouts');
            return nextBatch();
        }
        if (phase === 'list') {
            listTries++;
            return listTries < MAX_LIST_TRIES ? listReq() : finish('timeout');
        }
        if (phase === 'addr')
            return finish('list-failed');
        return retryOr('timeout');
    };
    /** 주문 · 금액 글자 없이 「로그인」만 있는 짧은 화면 */
    const looksLoggedOut = (text) => text.length < 600 && /로그인/.test(text) && !/\d[\d,]*원|\d{10,}/.test(text);
    const onPage = (url, text) => {
        lastUrl = url;
        lastText = text;
        if (phase === 'page' || phase === 'list') {
            if (/\/login/i.test(pathOf(url)) || /^(nid|accounts)\./.test(hostOf(url)))
                return { type: 'login' };
            if (!/(^|\.)kurly\.com$/.test(hostOf(url)))
                return retryOr('shop-lost');
            // 로그아웃된 컬리 주문 화면은 주소를 /login 으로 바꾸지 않고 같은 주소에 짧은 로그인 안내만 띄운다(11-02 기록: /mypage/order · 글자 39자 · 로그인 글자) — 로그인 화면을 보인다
            if (looksLoggedOut(text))
                return { type: 'login' };
            tries = 0;
            return phase === 'page' ? addrReq('list') : listReq();
        }
        if (phase === 'receiptnav')
            return onReceiptPage(url, text);
        if (phase === 'pageback') {
            // 출처 페이지로 되돌아오는 길 — 로그인이 풀렸으면 로그인 화면을 보이고, 돌아왔으면 남은 주문의 상세 단계를 이어 간다
            if (/\/login/i.test(pathOf(url)))
                return { type: 'login' };
            if (!/(^|\.)kurly\.com$/.test(hostOf(url)))
                return retryOr('shop-lost');
            phase = 'detail';
            tries = 0;
            return nextBatch();
        }
        if (phase === 'relogin') {
            // 로그인 뒤 같은 묶음부터 다시 — 같은 주문들이 대기열 앞에 돌아와 있다
            if (/\/login/i.test(pathOf(url)))
                return { type: 'login' };
            tries = 0;
            return navMode ? navResume() : nextBatch();
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
                    const last = opts.sinceLatest && !only ? (0, naverApiFlow_1.latestKnownDay)(ev.known) : undefined;
                    if (last && last > cutoff)
                        cutoff = last;
                }
                phase = 'page';
                tries = 0;
                return { type: 'goto', url: exports.KURLY_LIST_URL };
            case 'page':
                return onPage(ev.url, ev.text);
            case 'resume': {
                const f = after;
                after = null;
                return f ? f() : READ;
            }
            case 'fetched': {
                if (phase === 'list')
                    return onListResult(ev.results.find((r) => r.key.startsWith('list-')) ?? { key: 'list', st: 'net' });
                if (phase === 'addr')
                    return onAddr(ev.results.find((r) => r.key === 'addr') ?? { key: 'addr', st: 'net' });
                if (phase === 'detail')
                    return onDetail(ev.results);
                if (phase === 'receipt')
                    return onReceipt(ev.results);
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
        progress: () => ({ phase, done: okN + noneN + failN, total, orders: orders.length }),
    };
}
