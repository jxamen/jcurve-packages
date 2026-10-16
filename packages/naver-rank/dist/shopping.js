"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOPPING_FIELDS = void 0;
exports.parseShoppingSlots = parseShoppingSlots;
exports.findMyRank = findMyRank;
exports.parseShoppingPage = parseShoppingPage;
const naverUrl_1 = require("./naverUrl");
const naver_1 = require("./naver");
/** 추정한 견본 스키마다. 실제 응답 확인 후 이 필드 매핑을 교체한다. */
exports.SHOPPING_FIELDS = {
    root: 'shoppingResult', items: 'products', title: 'productTitle',
    mall: 'mallName', id: 'productId', link: 'productUrl',
};
const object = (value) => value !== null && typeof value === 'object' ? value : {};
function parseShoppingSlots(json) {
    const rows = object(object(json)[exports.SHOPPING_FIELDS.root])[exports.SHOPPING_FIELDS.items];
    if (!Array.isArray(rows))
        throw new Error('쇼핑 응답 형식을 확인해 주세요');
    return rows.slice(0, 20).map((row, index) => {
        const item = object(row);
        const id = item[exports.SHOPPING_FIELDS.id];
        const title = item[exports.SHOPPING_FIELDS.title];
        if ((typeof id !== 'string' && typeof id !== 'number') || !String(id).trim()
            || typeof title !== 'string' || !title.trim())
            throw new Error('쇼핑 상품 형식을 확인해 주세요');
        return {
            rank: index + 1, productId: String(id), title: title.replace(/<[^>]*>/g, ''),
            mallName: typeof item[exports.SHOPPING_FIELDS.mall] === 'string' ? item[exports.SHOPPING_FIELDS.mall] : '',
            link: typeof item[exports.SHOPPING_FIELDS.link] === 'string' ? item[exports.SHOPPING_FIELDS.link] : '',
        };
    });
}
function findMyRank(items, target) {
    const value = (target.productId ?? target.mallName ?? target.titleIncludes ?? '').trim();
    if (!value)
        return undefined;
    const id = (0, naverUrl_1.targetUrlId)(value, 'shop') ?? value;
    return items.find(item => target.productId !== undefined ? ((0, naverUrl_1.targetUrlId)(item.productId, 'shop') ?? item.productId) === id || (0, naverUrl_1.targetUrlId)(item.link, 'shop') === id
        : target.mallName !== undefined ? item.mallName === value : item.title.includes(value))?.rank;
}
function parseShoppingPage(html, page) {
    const props = (0, naver_1.record)((0, naver_1.record)((0, naver_1.nextData)(html)).props);
    const pageProps = (0, naver_1.record)(props.pageProps);
    const result = (0, naver_1.record)(pageProps.shoppingResult);
    const rows = result.products;
    if (!Array.isArray(rows))
        throw Error('네이버 쇼핑 검색 응답 형식을 확인할 수 없어요');
    return rows.map((row, index) => {
        const item = (0, naver_1.record)((0, naver_1.record)(row).item ?? row);
        const parsed = parseShoppingSlots({ shoppingResult: { products: [item] } })[0];
        return { ...parsed, rank: (page - 1) * 40 + index + 1 };
    });
}
