"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPlaceRank = checkPlaceRank;
exports.checkShoppingRank = checkShoppingRank;
const placeInApp_1 = require("./placeInApp");
const webQueue_1 = require("./webQueue");
const naverUrl_1 = require("./naverUrl");
const shopping_1 = require("./shopping");
async function checkPlaceRank(keyword, placeId) {
    const id = (0, naverUrl_1.targetUrlId)(placeId, 'place') ?? placeId.trim();
    if (!keyword.trim() || !/^\d{1,30}$/.test(id))
        throw new webQueue_1.CollectorError('invalid_input');
    return (0, placeInApp_1.collectPlaceInApp)(keyword.trim(), id);
}
async function checkShoppingRank(keyword, target) {
    if (!keyword.trim() || !(target.productId ?? target.mallName ?? target.titleIncludes)?.trim())
        throw new webQueue_1.CollectorError('invalid_input');
    const items = (await (0, webQueue_1.collectWeb)('shopping', keyword.trim())).map(x => ({ rank: x.rank, productId: x.id, link: x.link, title: x.title, mallName: x.mallName }));
    return { rank: (0, shopping_1.findMyRank)(items, target) ?? null, items };
}
