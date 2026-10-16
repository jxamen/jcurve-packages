"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomDelay = void 0;
exports.limitAction = limitAction;
exports.recordLimit = recordLimit;
const license_1 = require("./license");
const key = 'rank.shopping.last429';
const randomDelay = (min, max, random = Math.random) => Math.round((min + (max - min) * random()) * 1000);
exports.randomDelay = randomDelay;
function limitAction(lastDay, today, retried) { return retried || lastDay === today ? 'stop' : 'retry'; }
async function recordLimit(retried) {
    const now = new Date();
    const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].join('-');
    // Fail closed if local persistence is unavailable: avoid an unbounded retry after restart.
    try {
        const last = await (0, license_1.storage)().getItem(key);
        await (0, license_1.storage)().setItem(key, day);
        return limitAction(last, day, retried);
    }
    catch {
        return 'stop';
    }
}
