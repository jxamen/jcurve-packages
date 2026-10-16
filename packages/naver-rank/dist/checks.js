"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPlaceRank = checkPlaceRank;
exports.checkShoppingRank = checkShoppingRank;
const placeInApp_1 = require("./placeInApp");
const webQueue_1 = require("./webQueue");
const naverUrl_1 = require("./naverUrl");
const license_1 = require("./license");
const webThrottle_1 = require("./webThrottle");
const naverUrl_2 = require("./naverUrl");
const shopping_1 = require("./shopping");
async function checkPlaceRank(keyword, placeId) {
    const id = (0, naverUrl_1.targetUrlId)(placeId, 'place') ?? placeId.trim();
    if (!keyword.trim() || !/^\d{1,30}$/.test(id))
        throw new webQueue_1.CollectorError('invalid_input');
    return (0, placeInApp_1.collectPlaceInApp)(keyword.trim(), id);
}
const memory = new Map();
const pending = new Map();
async function checkShoppingRank(keyword, target) {
    const value = (target.productId ?? target.mallName ?? target.titleIncludes)?.trim();
    if (!keyword.trim() || !value)
        throw new webQueue_1.CollectorError('invalid_input');
    const normalized = target.productId !== undefined ? { productId: (0, naverUrl_2.targetUrlId)(value, 'shop') ?? value } : target.mallName !== undefined ? { mallName: value } : { titleIncludes: value };
    const key = 'rank.shopping.daily.' + encodeURIComponent(JSON.stringify([keyword.trim(), normalized]));
    const valid = (result) => result && (0, webThrottle_1.koreanDay)(result.timestamp) === (0, webThrottle_1.koreanDay)();
    if (valid(memory.get(key)))
        return { ...memory.get(key), cached: true };
    if (pending.has(key))
        return pending.get(key);
    const task = (async () => {
        try {
            const saved = JSON.parse(await (0, license_1.storage)().getItem(key) ?? 'null');
            if (saved && Number.isFinite(saved.timestamp) && Array.isArray(saved.items) && valid(saved)) {
                memory.set(key, saved);
                return { ...saved, cached: true };
            }
        }
        catch { }
        const convert = (rows) => rows.map(x => ({ rank: x.rank, productId: x.id, link: x.link, title: x.title, mallName: x.mallName }));
        const items = convert(await (0, webQueue_1.collectWeb)('shopping', keyword.trim(), undefined, rows => (0, shopping_1.findMyRank)(convert(rows), normalized) !== undefined));
        const result = { rank: (0, shopping_1.findMyRank)(items, normalized) ?? null, items, timestamp: Date.now(), cached: false };
        memory.set(key, result);
        try {
            await (0, license_1.storage)().setItem(key, JSON.stringify(result));
        }
        catch { }
        return result;
    })();
    pending.set(key, task);
    try {
        return await task;
    }
    finally {
        pending.delete(key);
    }
}
