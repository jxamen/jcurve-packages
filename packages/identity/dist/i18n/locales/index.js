"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCALES = void 0;
/**
 * 언어 표 모음 — 한국어 원문이 열쇠, 값이 그 언어 문구.
 * 언어를 더할 때: 같은 모양으로 `ja.ts` 를 만들고 아래에 `ja,` 한 줄만 더한다.
 */
const en_1 = __importDefault(require("./en"));
exports.LOCALES = {
    en: en_1.default,
};
