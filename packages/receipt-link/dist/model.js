"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_IMPORT_TEXTS = exports.emptyTally = exports.isConnected = exports.ORDERS_PER_REQUEST = exports.LINK_LABEL = exports.ALL_LINK_PLATFORMS = exports.TEST_LINK_PLATFORMS = exports.LINK_PLATFORMS = void 0;
exports.parseLinkState = parseLinkState;
exports.cleanOrder = cleanOrder;
exports.chunkOrders = chunkOrders;
exports.addTally = addTally;
exports.importMessage = importMessage;
/** 캡슐함 카드에 보이는 두 곳(모든 스위치 켜진 회원) */
exports.LINK_PLATFORMS = ['naver', 'coupang'];
/** 대표님 계정(probe)에게만 보이는 시험 곳 — 영수증 올리기 연동 줄 · 구조 기록 */
exports.TEST_LINK_PLATFORMS = ['naver', 'musinsa', 'kurly'];
/** 서버가 줄 수 있는 모든 곳 */
exports.ALL_LINK_PLATFORMS = ['naver', 'coupang', 'musinsa', 'kurly'];
exports.LINK_LABEL = { naver: '네이버', coupang: '쿠팡', musinsa: '무신사', kurly: '마이컬리' };
/** 서버가 한 번에 받는 주문 수 */
exports.ORDERS_PER_REQUEST = 50;
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
const RESULTS = ['new', 'duplicate', 'taken', 'out_of_range', 'invalid', 'amount', 'pouch_full'];
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
    return {
        windowDays: typeof r.windowDays === 'number' && r.windowDays > 0 ? r.windowDays : 30, consentVersion: typeof r.consentVersion === 'string' ? r.consentVersion : '', links,
        probe: r.probe === true, hide_legacy: r.hide_legacy === true,
        ordersPerRequest: typeof r.ordersPerRequest === 'number' && r.ordersPerRequest >= 1 && r.ordersPerRequest <= exports.ORDERS_PER_REQUEST ? Math.floor(r.ordersPerRequest) : exports.ORDERS_PER_REQUEST,
        amountMax: typeof r.amountMax === 'number' && r.amountMax > 0 ? Math.floor(r.amountMax) : null,
    };
}
/** 동의했고 철회하지 않았다 */
const isConnected = (s, p) => !!s.links[p]?.linkedAt && !s.links[p]?.revokedAt;
exports.isConnected = isConnected;
const clip = (v, max) => {
    if (typeof v !== 'string')
        return undefined;
    const t = v.replace(/\s+/g, ' ').trim();
    return t ? t.slice(0, max) : undefined;
};
/**
 * 읽어 온 주문 한 건에서 서버에 보낼 여섯 칸만 남긴다. 주문번호 · 일시 · 금액이 없거나 모양이 틀리면 null(그 주문은 보내지 않는다).
 * 금액은 쉼표 · 「원」 이 붙은 글자도 받는다(화면 읽기). 다른 키는 전부 버린다.
 */
function cleanOrder(raw) {
    const r = object(raw);
    const orderNo = clip(r.orderNo, 60);
    const orderedAt = clip(r.orderedAt, 40);
    const n = typeof r.amount === 'number' ? r.amount : typeof r.amount === 'string' && /\d/.test(r.amount) ? Number(r.amount.replace(/[^\d]/g, '')) : NaN;
    if (!orderNo || !orderedAt || !Number.isFinite(n) || n < 0 || n > 1000000000 || !Number.isFinite(Date.parse(orderedAt.replace(' ', 'T'))))
        return null;
    const out = { orderNo, orderedAt, amount: Math.floor(n) };
    const seller = clip(r.seller, 80);
    if (seller)
        out.seller = seller;
    const title = clip(r.title, 200);
    if (title)
        out.title = title;
    const payment = clip(r.payment, 30);
    if (payment)
        out.payment = payment;
    return out;
}
function chunkOrders(items, size = exports.ORDERS_PER_REQUEST) {
    const out = [];
    for (let i = 0; i < items.length; i += size)
        out.push(items.slice(i, i + size));
    return out;
}
const emptyTally = () => ({ new: 0, duplicate: 0, taken: 0, out_of_range: 0, invalid: 0, amount: 0, pouch_full: 0 });
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
exports.DEFAULT_IMPORT_TEXTS = {
    added: (n) => `새 주문 ${n}건을 영수증 보상으로 담았어요.`,
    capacityFull: (n) => `용돈 주머니가 가득 차서 ${n}건은 담지 못했어요. 주머니를 꺼낸 뒤 다시 가져와 주세요.`,
};
/** 가져오기가 끝난 뒤 사용자에게 보이는 한두 줄 */
function importMessage(t, skippedUnreadable = 0, texts = {}) {
    const say = { ...exports.DEFAULT_IMPORT_TEXTS, ...texts };
    const lines = [];
    lines.push(t.new > 0 ? say.added(t.new) : '새로 담을 주문이 없어요.');
    if (t.pouch_full > 0)
        lines.push(say.capacityFull(t.pouch_full));
    if (t.duplicate > 0)
        lines.push(`이미 가져온 ${t.duplicate}건은 건너뛰었어요.`);
    if (t.taken > 0)
        lines.push(`다른 계정에서 이미 받은 ${t.taken}건은 받을 수 없어요.`);
    const other = t.out_of_range + t.invalid + t.amount + skippedUnreadable;
    if (other > 0)
        lines.push(`최근 30일이 아니거나 읽을 수 없는 ${other}건은 건너뛰었어요.`);
    return lines.join('\n');
}
