"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normLang = normLang;
exports.t = t;
exports.tf = tf;
/**
 * 패키지 문구 번역 틀 — 한국어 원문이 열쇠다. 문구 자리는 `t('한국어 원문', lang)` 으로 감싸기만 한다.
 * (당근 본 앱 src/i18n 과 같은 모양. 패키지마다 같은 파일을 둔다 — 패키지끼리 서로 기대지 않게)
 *
 * - **언어는 패키지가 기기에서 읽지 않는다.** 앱이 공개 API 의 `lang` 옵션으로 넘긴다(앱이 이미 정한 언어 하나를 따른다).
 * - `lang` 이 없거나 'ko' 면 **원문 그대로**(바이트까지 같은 글자) — 지금 한국어 앱은 아무것도 바뀌지 않는다.
 * - 표에 없는 언어 · 표에 없는 문구도 원문 그대로 돌려준다.
 * - 언어 추가 = `locales/<언어>.ts` 표 하나 + `locales/index.ts` 에 한 줄. 문구 자리 코드는 그대로다.
 */
const locales_1 = require("./locales");
const BASE_LANG = 'ko';
/** 'en-US' · 'en_US' · 'EN' → 'en'. 못 읽으면 'ko' */
function normLang(lang) {
    if (typeof lang !== 'string')
        return BASE_LANG;
    const l = (lang.trim().split(/[-_]/)[0] ?? '').toLowerCase();
    return /^[a-z]{2,3}$/.test(l) ? l : BASE_LANG;
}
/** 한국어 원문 → 그 언어. lang 이 없거나 ko 거나 표에 없으면 원문 그대로 */
function t(ko, lang) {
    const l = normLang(lang);
    if (l === BASE_LANG)
        return ko;
    const v = locales_1.LOCALES[l]?.[ko];
    return typeof v === 'string' ? v : ko;
}
/** `{0}` · `{1}` 자리에 값을 넣는다 — 원문(한국어)도 같은 자리표로 적는다(한국어면 예전 템플릿과 같은 글자) */
function tf(ko, lang, ...args) {
    return t(ko, lang).replace(/\{(\d+)\}/g, (m, i) => (Number(i) < args.length ? String(args[Number(i)]) : m));
}
