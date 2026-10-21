"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCards = normalizeCards;
exports.parseCardsResponse = parseCardsResponse;
exports.fetchCards = fetchCards;
/** 서버와 fallback 모두 같은 검증·중복 제거·안정 정렬을 적용한다. */
function normalizeCards(raw) {
    if (!Array.isArray(raw))
        return [];
    const seen = new Set();
    const cards = [];
    raw.forEach((value, index) => {
        if (!value || typeof value !== 'object')
            return;
        const c = value;
        if (typeof c.id !== 'string' || !/^[a-z0-9_]{1,40}$/.test(c.id) || seen.has(c.id))
            return;
        if (c.type !== 'apihub_shopping' && c.type !== 'place_stamp')
            return;
        if (c.enabled === false || c.enabled === 0 || (typeof c.enabled === 'string' && ['false', '0', 'off', 'no', ''].includes(c.enabled.toLowerCase().trim())))
            return;
        if (typeof c.title !== 'string' || !c.title.trim())
            return;
        const order = typeof c.order === 'number' || (typeof c.order === 'string' && c.order.trim()) ? Number(c.order) : NaN;
        seen.add(c.id);
        cards.push({
            id: c.id, type: c.type, title: Array.from(c.title.trim()).slice(0, 40).join(''),
            desc: typeof c.desc === 'string' ? Array.from(c.desc.trim()).slice(0, 80).join('') : '',
            icon: typeof c.icon === 'string' && /^https:\/\/[^\s]{1,400}$/.test(c.icon) ? c.icon : null,
            order: Number.isFinite(order) ? Math.trunc(order) : (index + 1) * 10,
        });
    });
    return cards.sort((a, b) => a.order - b.order);
}
/** 빈 성공 목록은 어드민이 모두 끈 상태일 수 있으므로 fallback으로 바꾸지 않는다. */
function parseCardsResponse(response, fallbackCards = []) {
    const r = response;
    return normalizeCards(r?.ok === true && Array.isArray(r.cards) ? r.cards : fallbackCards);
}
async function fetchCards(fetchJson, fallbackCards = []) {
    try {
        return parseCardsResponse(await fetchJson('mission/cards', { method: 'GET' }), fallbackCards);
    }
    catch {
        return normalizeCards(fallbackCards);
    }
}
