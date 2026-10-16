"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectorError = void 0;
exports.attachCollector = attachCollector;
exports.collectWeb = collectWeb;
exports.blockReason = blockReason;
const license_1 = require("./license");
const webThrottle_1 = require("./webThrottle");
class CollectorError extends Error {
    constructor(code, evidence = '') {
        super((code === 'blocked_limit' ? '잠시 뒤 다시 확인해 주세요' : ['captcha', 'blocked_login', 'blocked_limit'].includes(code) ? '네이버가 잠시 막았어요' : '네이버 검색 결과를 확인할 수 없어요') + ' [' + code + ']');
        this.code = code;
        this.evidence = evidence;
    }
}
exports.CollectorError = CollectorError;
let collector;
let queue = Promise.resolve();
function attachCollector(handler) { collector = handler; return () => { collector = undefined; }; }
function collectWeb(channel, keyword, placeId) {
    let started = false;
    const task = queue.catch(() => { }).then(async () => { await (0, license_1.authorize)(); await (0, license_1.recordUsage)(channel); return new Promise((resolve, reject) => { if (!collector)
        return reject(new CollectorError('unavailable')); started = true; collector({ channel, keyword, placeId, resolve, reject }); }); });
    queue = task.then(() => { }, () => { }).then(() => started ? new Promise(r => setTimeout(r, (0, webThrottle_1.randomDelay)(20, 40))) : undefined);
    return task;
}
function blockReason(text, url) {
    if (/captcha|캡차|자동입력|보안 확인|보안문자/i.test(text + ' ' + url))
        return 'captcha';
    if (/nid\.naver\.com\/nidlogin|로그인이 필요|로그인해 주세요/i.test(url + ' ' + text))
        return 'blocked_login';
    if (/접속.{0,5}제한|비정상적인 접근|서비스 이용이 제한|요청이 너무 많/i.test(text))
        return 'blocked_limit';
}
