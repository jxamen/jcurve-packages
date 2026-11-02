"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_FETCH_TIMEOUT_MS = void 0;
exports.knownFromOrders = knownFromOrders;
exports.fetchKnown = fetchKnown;
/** 목록을 기다리는 시간 — 넘으면 known 없이 시작한다(전체 처리) */
exports.KNOWN_FETCH_TIMEOUT_MS = 6000;
const ORDER_NO = /^\d{16}$/;
const STAMP16 = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;
function knownFromOrders(orders, platform) {
    const orderNos = new Set();
    const listKeys = new Set();
    const tails = new Set();
    for (const o of orders) {
        if (o.platform !== platform || o.kind === 'list')
            continue;
        if (ORDER_NO.test(o.orderNo))
            orderNos.add(o.orderNo);
        const at = STAMP16.exec(o.orderedAt)?.[0];
        if (at && o.amount > 0)
            listKeys.add(`${at}|${o.amount}`);
        if (at && o.amount > 0 && /\d{4}$/.test(o.orderNo))
            tails.add(`${o.orderNo.slice(-4)}|${at.slice(0, 10)}`);
    }
    if (orderNos.size === 0 && listKeys.size === 0 && tails.size === 0)
        return undefined;
    return { orderNos: [...orderNos], listKeys: [...listKeys], tails: [...tails] };
}
/** 서버 목록을 한 번 받아 known 으로. 못 받거나(오류 · 시간 초과) 비었으면 undefined — 그대로 전체 처리 */
async function fetchKnown(list, platform, timeoutMs = exports.KNOWN_FETCH_TIMEOUT_MS) {
    let timer;
    try {
        const slow = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); });
        const r = await Promise.race([list(), slow]);
        return knownFromOrders(r.orders, platform);
    }
    catch {
        return undefined;
    }
    finally {
        if (timer !== undefined)
            clearTimeout(timer);
    }
}
