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
 * @jcurve/receipt-link — 주문내역 연동(로그인 창 · 구조 기록 · 불러오기)의 공용 부분. 0.1.0 은 core(순수 TS) 뼈대:
 * 모델 · 서버 호출 클라이언트(`request` 주입) · 동의 문구/상태 · 구조 기록(probe). 화면(UI)과 사이트별 읽기 규칙은 다음 판.
 * 영테크 `20defd33` 의 src/receiptLink 에서 옮겼다. 앱 화면 코드는 이 판에서 바꾸지 않는다.
 */
__exportStar(require("./model"), exports);
__exportStar(require("./client"), exports);
__exportStar(require("./card"), exports);
__exportStar(require("./probe"), exports);
__exportStar(require("./useLinkState"), exports);
// 0.2.0: 사이트별 주문 읽기(웹뷰에서 돌리는 스크립트) — 네이버 쇼핑 · 네이버페이 · 무신사 · 컬리
__exportStar(require("./readers/readers"), exports);
