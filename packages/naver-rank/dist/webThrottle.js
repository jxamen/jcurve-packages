"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomDelay = exports.koreanDay = void 0;
exports.limitAction = limitAction;
exports.isStopped = isStopped;
exports.stopToday = stopToday;
exports.recordLimit = recordLimit;
const license_1 = require("./license");
const memory = new Map();
const key = (channel) => 'rank.' + channel + '.last429';
const koreanDay = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10);
exports.koreanDay = koreanDay;
const randomDelay = (min, max, random = Math.random) => Math.round((min + (max - min) * random()) * 1000);
exports.randomDelay = randomDelay;
function limitAction(lastDay, today, retried) { return retried || lastDay === today ? 'stop' : 'retry'; }
async function isStopped(channel) {
    const today = (0, exports.koreanDay)();
    if (memory.get(key(channel)) === today)
        return true;
    try {
        const saved = await (0, license_1.storage)().getItem(key(channel));
        return saved?.split('-').map(v => v.padStart(2, '0')).join('-') === today;
    }
    catch {
        return true;
    }
}
async function stopToday(channel) {
    const today = (0, exports.koreanDay)();
    memory.set(key(channel), today);
    // Keep the current process stopped even if persistence fails.
    try {
        await (0, license_1.storage)().setItem(key(channel), today);
    }
    catch { }
}
async function recordLimit(retried, channel = 'shopping') {
    const stopped = await isStopped(channel);
    await stopToday(channel); // Reserve the only retry before waiting; restarts cannot reset it.
    return limitAction(stopped ? (0, exports.koreanDay)() : null, (0, exports.koreanDay)(), retried);
}
