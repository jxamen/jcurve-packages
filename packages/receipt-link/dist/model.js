"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyTally = exports.isConnected = exports.RECEIPT_DETAIL_KEYS = exports.ORDERS_PER_REQUEST = exports.LINK_LABEL = exports.ALL_LINK_PLATFORMS = exports.TEST_LINK_PLATFORMS = exports.LINK_PLATFORMS = void 0;
exports.readDetail = readDetail;
exports.parseLinkState = parseLinkState;
exports.normalizeListKey = normalizeListKey;
exports.cleanOrder = cleanOrder;
exports.chunkOrders = chunkOrders;
exports.addTally = addTally;
exports.importMessage = importMessage;
/** 캡슐함 카드에 보이는 두 곳(모든 스위치 켜진 회원) */
exports.LINK_PLATFORMS = ['naver', 'coupang'];
/** 대표님 계정(probe)에게만 보이는 시험 곳 — 영수증 올리기 「전자 영수증」 칸 앞 연동 칩의 순서(대표님 10-28 17:56) · 구조 기록 */
exports.TEST_LINK_PLATFORMS = ['naver', 'coupang', 'kurly', 'musinsa'];
/** 서버가 줄 수 있는 모든 곳 */
exports.ALL_LINK_PLATFORMS = ['naver', 'coupang', 'musinsa', 'kurly'];
exports.LINK_LABEL = { naver: '네이버', coupang: '쿠팡', musinsa: '무신사', kurly: '컬리' };
/** 서버가 한 번에 받는 주문 수 */
exports.ORDERS_PER_REQUEST = 50;
/** 영수증 세부 칸 — 대표님 10-29 14:15 card-single 원문 칸(세부 화면에 22:30 캡처 순서로 보인다) */
exports.RECEIPT_DETAIL_KEYS = [
    'cardCompany', 'approvalNo', 'cardNo', 'tradeType', 'ownerType', 'installmentType', 'approvalAt', 'cancelAt', 'productName', 'productOrderNo',
    'sellerName', 'sellerRepresentative', 'sellerBusinessNo', 'sellerTel', 'sellerAddress', 'merchantName', 'merchantBusinessNo',
    'approvalAmount', 'cancelAmount', 'supplyAmount', 'taxAmount', 'totalAmount',
    // 대표님 폰 실기록(10-29 14:31 rcpt-cardok) 응답에만 있던 칸
    'cardExpiredYear', 'cardExpiredMonth', 'merchantRepresentative', 'merchantNo', 'merchantAddress', 'serviceCharge', 'disposableCupAmount',
];
const DETAIL_AMOUNTS = new Set(['approvalAmount', 'cancelAmount', 'supplyAmount', 'taxAmount', 'totalAmount', 'serviceCharge', 'disposableCupAmount']);
/** 세부 칸만 남긴다 — 금액 칸은 정수, 나머지는 글자(200자까지). 모르는 키 · 다른 모양은 버린다 */
function readDetail(v) {
    const r = object(v);
    const out = {};
    for (const k of exports.RECEIPT_DETAIL_KEYS) {
        const x = r[k];
        if (DETAIL_AMOUNTS.has(k)) {
            if (typeof x === 'number' && Number.isInteger(x) && Math.abs(x) <= 1000000000)
                out[k] = x;
            continue;
        }
        if (typeof x === 'string') {
            const t = x.replace(/\s+/g, ' ').trim().slice(0, 200);
            if (t)
                out[k] = t;
        }
    }
    return Object.keys(out).length ? out : undefined;
}
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
const RESULTS = ['new', 'duplicate', 'updated', 'taken', 'out_of_range', 'invalid', 'amount', 'pouch_full'];
const strOrNull = (v) => typeof v === 'string' && v ? v : null;
function parseLinkState(v) {
    const r = object(v);
    const links = {};
    const raw = object(r.links);
    for (const p of exports.ALL_LINK_PLATFORMS) {
        if (!(p in raw))
            continue;
        const l = object(raw[p]);
        links[p] = { linkedAt: strOrNull(l.linkedAt), revokedAt: strOrNull(l.revokedAt), lastImportAt: strOrNull(l.lastImportAt),
            importedTotal: typeof l.importedTotal === 'number' && l.importedTotal >= 0 ? Math.floor(l.importedTotal) : 0 };
    }
    return { windowDays: typeof r.windowDays === 'number' && r.windowDays > 0 ? r.windowDays : 30, consentVersion: typeof r.consentVersion === 'string' ? r.consentVersion : '', links, probe: r.probe === true, hide_legacy: r.hide_legacy === true, coupangRead: r.coupangRead === true, npv2: r.npv2 === true, readDays: parseReadDays(r.readDays) };
}
/** 동의했고 철회하지 않았다 */
/** 서버가 준 플랫폼별 읽기 기간 — 1 이상 숫자만 싣는다 */
function parseReadDays(v) {
    const raw = object(v);
    const out = {};
    for (const p of exports.ALL_LINK_PLATFORMS) {
        const d = raw[p];
        if (typeof d === 'number' && d >= 1)
            out[p] = Math.floor(d);
    }
    return out;
}
const isConnected = (s, p) => !!s.links[p]?.linkedAt && !s.links[p]?.revokedAt;
exports.isConnected = isConnected;
/**
 * 목록 키 「YYYY-MM-DD HH:mm|금액」 — 영수증을 읽기 전 목록 행과 읽은 뒤 완성본을 잇는다(서버가 같은 키의 list 행을 완성본으로 바꾼다).
 * 날짜만 아는 「YYYY-MM-DD|금액」(쿠팡)은 서버 모양에 맞게 「YYYY-MM-DD 00:00|금액」 으로 맞춘다. 모양이 틀리면 undefined.
 */
function normalizeListKey(v) {
    if (typeof v !== 'string')
        return undefined;
    const t = v.replace(/\s+/g, ' ').trim();
    const dateOnly = /^(\d{4}-\d{2}-\d{2})\|(\d{1,12})$/.exec(t);
    const k = dateOnly ? `${dateOnly[1]} 00:00|${dateOnly[2]}` : t;
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}\|\d{1,12}$/.test(k) ? k : undefined;
}
const clip = (v, max) => {
    if (typeof v !== 'string')
        return undefined;
    const t = v.replace(/\s+/g, ' ').trim();
    return t ? t.slice(0, max) : undefined;
};
/**
 * 읽어 온 주문 한 건에서 서버에 보낼 열 칸만 남긴다. 주문번호 · 일시 · 금액이 없거나 모양이 틀리면 null(그 주문은 보내지 않는다).
 * 금액은 쉼표 · 「원」 이 붙은 글자도 받는다(화면 읽기). 다른 키는 전부 버린다.
 */
function cleanOrder(raw) {
    const r = object(raw);
    const isList = r.kind === 'list';
    const orderNo = clip(r.orderNo, 60);
    const listKey = normalizeListKey(r.listKey);
    const orderedAt = clip(r.orderedAt, 40);
    const n = typeof r.amount === 'number' ? r.amount : typeof r.amount === 'string' && /\d/.test(r.amount) ? Number(r.amount.replace(/[^\d]/g, '')) : NaN;
    if ((!orderNo && !(isList && listKey)) || !orderedAt || !Number.isFinite(n) || n < 0 || n > 1000000000 || !Number.isFinite(Date.parse(orderedAt.replace(' ', 'T'))))
        return null;
    const out = { orderedAt, amount: Math.floor(n) };
    if (orderNo)
        out.orderNo = orderNo;
    const seller = clip(r.seller, 80);
    if (seller)
        out.seller = seller;
    const title = clip(r.title, 200);
    if (title)
        out.title = title;
    const payment = clip(r.payment, 30);
    if (payment)
        out.payment = payment;
    const biz = typeof r.businessNumber === 'string' ? r.businessNumber.trim() : '';
    if (/^[0-9-]{1,20}$/.test(biz))
        out.businessNumber = biz;
    const approval = clip(r.approval, 40);
    if (approval)
        out.approval = approval;
    const cardIssuer = clip(r.cardIssuer, 30);
    if (cardIssuer)
        out.cardIssuer = cardIssuer;
    if (r.kind === 'card' || r.kind === 'purchase' || isList)
        out.kind = r.kind;
    if (listKey)
        out.listKey = listKey;
    const detail = readDetail(r.detail);
    if (detail)
        out.detail = detail;
    return out;
}
function chunkOrders(items, size = exports.ORDERS_PER_REQUEST) {
    const out = [];
    for (let i = 0; i < items.length; i += size)
        out.push(items.slice(i, i + size));
    return out;
}
const emptyTally = () => ({ new: 0, duplicate: 0, updated: 0, taken: 0, out_of_range: 0, invalid: 0, amount: 0, pouch_full: 0 });
exports.emptyTally = emptyTally;
/** 서버 응답 results[].result 를 합친다 — 모르는 값은 invalid 로 센다 */
function addTally(t, results) {
    const out = { ...t };
    if (!Array.isArray(results))
        return out;
    for (const item of results) {
        const res = object(item).result;
        out[RESULTS.includes(res) ? res : 'invalid']++;
    }
    return out;
}
/** 가져오기가 끝난 뒤 사용자에게 보이는 한두 줄 */
function importMessage(t, skippedUnreadable = 0) {
    const lines = [];
    lines.push(t.new > 0 ? `새 주문 ${t.new}건을 영수증 보상으로 담았어요.` : '새로 담을 주문이 없어요.');
    if (t.pouch_full > 0)
        lines.push(`용돈 주머니가 가득 차서 ${t.pouch_full}건은 담지 못했어요. 주머니를 꺼낸 뒤 다시 가져와 주세요.`);
    if (t.duplicate > 0)
        lines.push(`이미 가져온 ${t.duplicate}건은 건너뛰었어요.`);
    if (t.taken > 0)
        lines.push(`다른 계정에서 이미 받은 ${t.taken}건은 받을 수 없어요.`);
    const other = t.out_of_range + t.invalid + t.amount + skippedUnreadable;
    if (other > 0)
        lines.push(`기간이 지났거나 읽을 수 없는 ${other}건은 건너뛰었어요.`);
    return lines.join('\n');
}
