"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncToday = syncToday;
const days_1 = require("./days");
async function syncToday(days, send, now = Date.now()) {
    const today = days.filter(d => d.date === (0, days_1.kstDay)(now));
    return today.length ? send({ days: (0, days_1.toServerDays)(today) }) : null;
}
