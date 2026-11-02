"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.beforeContentLoadedScripts = beforeContentLoadedScripts;
exports.beforeContentLoaded = beforeContentLoaded;
const navCommon_1 = require("./navCommon");
/** extra: 대표님 계정의 구조 기록 관찰 래퍼처럼 호스트가 더 얹는 스크립트 */
function beforeContentLoadedScripts(_site, extra = []) {
    return [navCommon_1.NEUTRALIZE_NEW_WINDOW_SCRIPT, navCommon_1.QUIET_DIALOGS_SCRIPT, ...extra];
}
/** 하나로 이은 스크립트(각 스크립트는 끝에 `true;` 가 있어 줄바꿈으로 이으면 된다) */
function beforeContentLoaded(site, extra = []) {
    return beforeContentLoadedScripts(site, extra).join('\n');
}
