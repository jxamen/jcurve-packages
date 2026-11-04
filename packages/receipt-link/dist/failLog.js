"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.failItems = failItems;
exports.updateIdOf = updateIdOf;
const STAGE_OF_CODE = { 'no-pair': 'detail', 'not-in-history': 'detail', unreadable: 'read' };
/** 줄 결과 + 목록 주문 → 서버로 보낼 줄. endCode 는 끝날 때 아직 받는 중이던 줄의 까닭(stopped · closed · 흐름이 끝낸 까닭) */
function failItems(outcomes, orders, endCode, ctx) {
    const out = [];
    for (const [key, o] of Object.entries(outcomes)) {
        if (o.state === 'done' || (o.state === 'none' && o.why === 'cancelled'))
            continue;
        const ord = orders.get(key);
        if (!ord)
            continue;
        const info = o.state === 'failed' || o.state === 'none' ? o.info : undefined;
        const code = o.state === 'failed' ? o.code : o.state === 'none' ? 'none' : endCode;
        out.push({
            order_no: ord.orderNo,
            title: ord.title?.slice(0, 120) ?? null,
            ordered_at: ord.orderedAt || null,
            amount: Number.isFinite(ord.amount) ? Math.floor(ord.amount) : null,
            outcome: o.state === 'fetching' ? 'left' : o.state,
            code: code.slice(0, 30),
            stage: info?.stage ?? (o.state === 'fetching' ? 'request' : STAGE_OF_CODE[code] ?? 'request'),
            moved_on: o.state !== 'fetching',
            info: { ...(info ?? {}), ...ctx },
        });
    }
    return out;
}
/** 지금 앱 판(OTA 업데이트 ID) — Metro 가 CJS/ESM 어느 쪽으로 주든 */
function updateIdOf(mod) {
    const m = mod;
    return String(m?.updateId ?? m?.default?.updateId ?? '');
}
