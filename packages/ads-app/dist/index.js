"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @jcurve/ads-app — 앱 층 광고 접착의 공용 부분(JS 전용, 네이티브 파일 없음).
 * 0.1.0 은 머니트리(12eeee8f)의 순수 모듈을 코드 변경 없이 옮긴 것이다: 앱 오프닝 판단 규칙 · 가드, 테스트 광고 단위 판정.
 * 설계: ADS-GLUE-DESIGN.md (보상 흐름 · 열린 광고 복구 · 대기 청구는 0.2.0).
 */
__exportStar(require("./appOpenRules"), exports);
__exportStar(require("./appOpenGuard"), exports);
__exportStar(require("./adMode"), exports);
