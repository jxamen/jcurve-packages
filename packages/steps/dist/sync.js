"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncToday = syncToday;
const days_1 = require("./days");
/** 오늘 + 어제 걸음을 서버에 올린다(0.3.0 — 어제 몫을 받으려면 서버가 어제 걸음을 알아야 한다). 그 앞 날은 올리지 않는다. */
async function syncToday(days, send, now = Date.now()) {
    const recent = (0, days_1.keepRecent)(days, now);
    return recent.length ? send({ days: (0, days_1.toServerDays)(recent) }) : null;
}
