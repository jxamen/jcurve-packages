"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOnSite = exports.hostOf = exports.isLoginUrl = exports.MAX_TOTAL = exports.MAX_PER_MESSAGE = exports.WINDOW_DAYS = exports.SITE_LABEL = exports.SITES_FOR_PLATFORM = void 0;
exports.readFlowOrders = readFlowOrders;
exports.parseReaderMessage = parseReaderMessage;
exports.kstStamp = kstStamp;
exports.createCollector = createCollector;
/**
 * 주문 불러오기 — 읽기 결과(옛 목록 스크립트 메시지 · 영수증 흐름의 주문)를 검사해 모으는 순수 함수(노드에서 바로 시험한다). react-native 를 import 하지 않는다.
 * 주문 내용은 여기서도 로그로 남기거나 예외 메시지에 넣지 않는다. 틀린 메시지는 null, 틀린 주문 한 건은 세고 버린다.
 */
const readers_1 = require("./readers");
const model_1 = require("./model");
/** 한 곳을 연동하면 읽는 사이트 목록(순서대로). 쿠팡은 서버 스위치(coupangRead)가 켜진 뒤에만 연다 */
exports.SITES_FOR_PLATFORM = {
    naver: ['naver_shop', 'naver_pay'],
    musinsa: ['musinsa'],
    kurly: ['kurly'],
    coupang: ['coupang'],
    // 다이소 · 올리브영은 옛 목록 스크립트가 없다 — 요청 흐름(flows.ts)만
    daiso: [],
    oliveyoung: [],
};
exports.SITE_LABEL = { naver_shop: '네이버 쇼핑', naver_pay: '네이버페이', musinsa: '무신사', kurly: '마켓컬리', coupang: '쿠팡' };
/** 서버가 받는 기간(일) — 대표님 2026-10-28 20:20 「최근 일 년치까지」 */
exports.WINDOW_DAYS = 365;
exports.MAX_PER_MESSAGE = 50;
exports.MAX_TOTAL = 500;
const SITE_KEYS = Object.keys(readers_1.ORDER_PAGES);
const DAY_MS = 86400000;
const KST_MS = 9 * 3600000;
const STAMP = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/;
const LOGIN_URL = /nid\.naver\.com|\/login/i;
const obj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
const text = (v, max) => {
    if (typeof v !== 'string')
        return undefined;
    const t = v.replace(/\s+/g, ' ').trim();
    return t ? t.slice(0, max) : undefined;
};
/** 「YYYY-MM-DD HH:mm」 또는 「YYYY-MM-DD HH:mm:ss」이고 실제 있는 날짜 · 시각인지 */
function validStamp(v) {
    if (typeof v !== 'string')
        return false;
    const m = STAMP.exec(v);
    if (!m)
        return false;
    const [y, mo, d, h, mi] = m.slice(1, 6).map(Number);
    const sec = m[6] === undefined ? 0 : Number(m[6]);
    const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d && h < 24 && mi < 60 && sec < 60;
}
/** 사업자번호 — 숫자와 하이픈만, 20자까지. 아니면 그 칸만 버린다(주문은 남긴다) */
const BIZ = /^[0-9-]{1,20}$/;
/**
 * 주문 한 건 — 열두 칸과 영수증 세부(detail, 대표님 14:15 원문 칸)만 남긴다. 일시 · 금액이 틀리거나 주문번호가 틀리면 null(목록 행 kind 'list' 는 주문번호 대신 listKey 가 있으면 된다).
 * 사업자번호 · 승인번호 · 카드사 · 종류는 틀리면 그 칸만 버린다(서버가 한 묶음을 통째로 거절하지 않게).
 * noSeconds 표시가 붙은 주문(초를 못 읽은 영수증)은 보내지 않는다.
 */
function readOrder(v) {
    const r = obj(v);
    if (r.noSeconds === true)
        return null;
    const isList = (0, model_1.isPendingKind)(r.kind);
    const listKey = (0, model_1.normalizeListKey)(r.listKey);
    const orderNo = typeof r.orderNo === 'string' ? r.orderNo.replace(/[^0-9A-Za-z-]/g, '') : '';
    const noOk = orderNo.length >= 5 && orderNo.length <= 40;
    if (!noOk && !(isList && listKey))
        return null;
    if (!validStamp(r.orderedAt))
        return null;
    if (typeof r.amount !== 'number' || !Number.isInteger(r.amount) || r.amount < 1 || r.amount > 1000000000)
        return null;
    const out = { orderedAt: r.orderedAt, amount: r.amount };
    if (noOk)
        out.orderNo = orderNo;
    const seller = text(r.seller, 80);
    if (seller)
        out.seller = seller;
    const title = text(r.title, 200);
    if (title)
        out.title = title;
    const payment = text(r.payment, 30);
    if (payment)
        out.payment = payment;
    const biz = typeof r.businessNumber === 'string' ? r.businessNumber.trim() : '';
    if (BIZ.test(biz))
        out.businessNumber = biz;
    const approval = text(r.approval, 40);
    if (approval)
        out.approval = approval;
    const cardIssuer = text(r.cardIssuer, 30);
    if (cardIssuer)
        out.cardIssuer = cardIssuer;
    if (r.kind === 'card' || r.kind === 'purchase' || isList)
        out.kind = r.kind;
    if (listKey)
        out.listKey = listKey;
    const detail = (0, model_1.readDetail)(r.detail);
    if (detail)
        out.detail = detail;
    return out;
}
/** 흐름(구동기)이 낸 주문 목록 → 검사를 통과한 주문과 버린 수. 목록 모양이 아니면 아무것도 읽지 않는다 */
function readFlowOrders(list) {
    if (!Array.isArray(list))
        return { orders: [], dropped: 0 };
    const orders = [];
    let dropped = 0;
    for (const item of list) {
        const o = readOrder(item);
        if (o)
            orders.push(o);
        else
            dropped++;
    }
    return { orders, dropped };
}
/** 웹뷰 메시지 한 덩이. 모양이 틀리거나 사이트 키가 다르거나 50건을 넘으면 null(메시지 통째로 버림) */
function parseReaderMessage(raw) {
    if (typeof raw !== 'string')
        return null;
    let v;
    try {
        v = JSON.parse(raw);
    }
    catch {
        return null;
    }
    const m = obj(v);
    if (m.type !== 'orders')
        return null;
    if (typeof m.site !== 'string' || !SITE_KEYS.includes(m.site))
        return null;
    if (!Array.isArray(m.orders) || m.orders.length > exports.MAX_PER_MESSAGE || typeof m.done !== 'boolean')
        return null;
    const orders = [];
    let dropped = 0;
    for (const item of m.orders) {
        const o = readOrder(item);
        if (o)
            orders.push(o);
        else
            dropped++;
    }
    const note = typeof m.note === 'string' ? m.note.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) : undefined;
    return { site: m.site, done: m.done, orders, dropped, note };
}
/** 로그인 페이지인지 주소만 보고 판단한다(네이버 통합 로그인 · 각 사이트의 /login 경로) */
const isLoginUrl = (url) => LOGIN_URL.test(url);
exports.isLoginUrl = isLoginUrl;
/** 주소의 호스트(소문자). 주소가 아니면 빈 문자열 */
const hostOf = (url) => (/^https?:\/\/([^/?#]+)/i.exec(url)?.[1] ?? '').toLowerCase();
exports.hostOf = hostOf;
/** 이 주소가 사이트 주문내역 페이지와 같은 호스트인지 — SPA 안에서 옮겨 간 페이지를 다시 읽을지 볼 때 쓴다 */
const isOnSite = (url, siteUrl) => {
    const host = (0, exports.hostOf)(siteUrl);
    return host !== '' && (0, exports.hostOf)(url) === host;
};
exports.isOnSite = isOnSite;
/** 밀리초 → KST 「YYYY-MM-DD HH:mm」(주문일시와 같은 모양이라 문자열로 비교한다) */
function kstStamp(ms) {
    return new Date(ms + KST_MS).toISOString().slice(0, 16).replace('T', ' ');
}
/**
 * 여러 페이지 · 여러 사이트의 주문을 모은다. 주문번호로 중복을 거르고, 최근 1년(WINDOW_DAYS)만 남기고, 최신순으로 MAX_TOTAL 건까지만 담는다.
 * 같은 주문번호가 네이버 쇼핑 · 네이버페이에 둘 다 있으면 한 건으로 센다(서버도 주문번호로 거른다).
 * add 는 한꺼번에 모아 finish 에서 자르고, accept 는 읽는 대로 받아 새로 담긴 것만 돌려준다(읽는 순서가 최신순이라 한도는 먼저 온 것부터 채운다).
 */
function createCollector(nowMs = Date.now(), windowDays = exports.WINDOW_DAYS) {
    let cutoff = kstStamp(nowMs - windowDays * DAY_MS);
    const byNo = new Map();
    let read = 0;
    let duplicates = 0;
    let dropped = 0;
    let outOfWindow = 0;
    let capped = 0;
    const keyOf = (o) => o.orderNo ?? 'list:' + (o.listKey ?? '');
    /** 목록 행(kind list)의 listKey → 담아 둔 이름 — 같은 listKey 의 완성본이 오면 이 행을 바꾼다 */
    const listIdx = new Map();
    const ingest = (msg, cap) => {
        dropped += msg.dropped;
        const fresh = [];
        for (const o of msg.orders) {
            read++;
            if (o.orderedAt < cutoff) {
                outOfWindow++;
                continue;
            }
            const key = keyOf(o);
            const prev = byNo.get(key);
            const sharedKey = o.listKey ? listIdx.get(o.listKey) : undefined;
            const listPrev = sharedKey !== undefined && (0, model_1.isPendingKind)(byNo.get(sharedKey)?.kind) ? sharedKey : undefined;
            // 영수증을 읽어 완성된 주문은 먼저 올린 목록 행(kind list)을 대신한다 — 중복으로 세지 않고 다시 올린다(서버가 바꿔 넣는다).
            // 「영수증 없음」(kind none)도 목록 행을 대신하지만, 완성본(card · purchase)이나 다른 none 을 대신하지는 않는다
            const replaces = o.kind !== 'list' && !(o.kind === 'none' && (prev?.kind === 'none' || (listPrev !== undefined && byNo.get(listPrev)?.kind === 'none')));
            if (replaces && ((0, model_1.isPendingKind)(prev?.kind) || listPrev !== undefined)) {
                if (listPrev !== undefined && listPrev !== key)
                    byNo.delete(listPrev);
                if (o.listKey)
                    listIdx.delete(o.listKey);
                byNo.set(key, o);
                fresh.push(o);
            }
            else if (prev)
                duplicates++;
            else if (cap && byNo.size >= exports.MAX_TOTAL)
                capped++;
            else {
                byNo.set(key, o);
                if ((0, model_1.isPendingKind)(o.kind) && o.listKey)
                    listIdx.set(o.listKey, key);
                fresh.push(o);
            }
        }
        return fresh;
    };
    return {
        add(msg) { ingest(msg, false); },
        /** 읽기 기간을 바꾼다(플랫폼마다 서버 설정이 다르다) — 이후 들어오는 주문부터 이 기간으로 거른다 */
        setWindowDays(days) { cutoff = kstStamp(nowMs - days * DAY_MS); },
        /** 읽는 대로 받는다 — 새로 담긴 주문만 돌려준다(중복 · 기간 밖 · 한도 밖은 세고 버린다) */
        accept(msg) { return ingest(msg, true); },
        /** 지금까지 담은 주문 수 */
        size() { return byNo.size; },
        /** 지금까지 모은 결과 — 여러 번 불러도 같다 */
        finish() {
            const all = [...byNo.values()].sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
            return { orders: all.slice(0, exports.MAX_TOTAL), read, duplicates, rejected: dropped + outOfWindow + capped + Math.max(0, all.length - exports.MAX_TOTAL) };
        },
    };
}
