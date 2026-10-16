"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectorError = void 0;
exports.attachCollector = attachCollector;
exports.collectWeb = collectWeb;
exports.blockReason = blockReason;
exports.subscribeCollectorFailure = subscribeCollectorFailure;
exports.reportCollectorFailure = reportCollectorFailure;
const license_1 = require("./license");
const webThrottle_1 = require("./webThrottle");
class CollectorError extends Error {
    constructor(code, evidence = '') {
        super((code === 'timeout' ? '90초 안에 확인하지 못했어요. 잠시 후 다시 시도해 주세요' : ['blocked_limit', 'captcha'].includes(code) ? '네이버가 잠시 막았어요. 내일 다시 확인돼요' : ['captcha', 'blocked_login', 'blocked_limit'].includes(code) ? '네이버가 잠시 막았어요' : '네이버 검색 결과를 확인할 수 없어요') + ' [' + code + ']');
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
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new CollectorError('timeout')); }, 90000); });
    const task = queue.catch(() => { }).then(async () => {
        if (controller.signal.aborted)
            throw new CollectorError('timeout');
        await (0, license_1.authorize)();
        if (controller.signal.aborted)
            throw new CollectorError('timeout');
        if (await (0, webThrottle_1.isStopped)(channel))
            throw new CollectorError('blocked_limit');
        await (0, license_1.recordUsage)(channel);
        if (controller.signal.aborted)
            throw new CollectorError('timeout');
        return new Promise((resolve, reject) => { if (!collector)
            return reject(new CollectorError('unavailable')); started = true; collector({ channel, keyword, placeId, signal: controller.signal, resolve, reject: e => { if (e instanceof CollectorError && ['blocked_limit', 'captcha'].includes(e.code)) {
                void (0, webThrottle_1.stopToday)(channel).then(() => reject(e));
            }
            else
                reject(e); } }); });
    });
    const result = Promise.race([task, deadline]).finally(() => clearTimeout(timer));
    queue = result.then(() => { }, () => { }).then(() => started ? new Promise(r => setTimeout(r, (0, webThrottle_1.randomDelay)(20, 40))) : undefined);
    return result;
}
function blockReason(text, url) {
    if (/쇼핑\s*서비스\s*접속이\s*일시적으로\s*제한/.test(text))
        return 'blocked_limit';
    if (/captcha|캡차|자동입력|보안 확인|보안문자/i.test(text + ' ' + url))
        return 'captcha';
    if (/nid\.naver\.com\/nidlogin|로그인이 필요|로그인해 주세요/i.test(url + ' ' + text))
        return 'blocked_login';
    if (/접속.{0,12}제한|비정상적인 접근|서비스 이용이 제한|요청이 너무 많/i.test(text))
        return 'blocked_limit';
}
const failureListeners = new Set();
function subscribeCollectorFailure(listener) { failureListeners.add(listener); return () => { failureListeners.delete(listener); }; }
function reportCollectorFailure(error) { for (const listener of failureListeners)
    listener(error); }
