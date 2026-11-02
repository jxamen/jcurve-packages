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
exports.tapSafeKey = exports.safeKey = exports.musinsaFindOrderRows = exports.findOrderRows = exports.musinsaCleanMerchant = exports.cleanMerchant = void 0;
// @jcurve/receipt-link — 쇼핑몰 주문 · 영수증 수집(네이버 쇼핑+페이 · 쿠팡 · 무신사 · 컬리). 화면은 없다 — 흐름 · 웹뷰 스크립트 · 구동기 · 모델만.
__exportStar(require("./backLayer"), exports);
__exportStar(require("./coupangApiFlow"), exports);
__exportStar(require("./flowDriver"), exports);
__exportStar(require("./flows"), exports);
__exportStar(require("./importLine"), exports);
__exportStar(require("./importPlan"), exports);
__exportStar(require("./importUploader"), exports);
__exportStar(require("./knownOrders"), exports);
__exportStar(require("./kurlyApiFlow"), exports);
__exportStar(require("./model"), exports);
__exportStar(require("./musinsaApiFlow"), exports);
__exportStar(require("./navCommon"), exports);
__exportStar(require("./naverApiFlow"), exports);
__exportStar(require("./naverReceipt"), exports);
__exportStar(require("./naverReceiptsScript"), exports);
__exportStar(require("./ordersModel"), exports);
__exportStar(require("./probe"), exports);
__exportStar(require("./readers"), exports);
__exportStar(require("./runOutcome"), exports);
__exportStar(require("./shapeLines"), exports);
__exportStar(require("./shapeTap"), exports);
__exportStar(require("./siteFetch"), exports);
__exportStar(require("./siteFetchScript"), exports);
__exportStar(require("./webHostStyle"), exports);
__exportStar(require("./webScripts"), exports);
// 두 모듈이 같은 이름을 내보내는 것 — 기본은 아래 쪽, 다른 쪽은 접두어를 붙여 내보낸다
var coupangApiFlow_1 = require("./coupangApiFlow");
Object.defineProperty(exports, "cleanMerchant", { enumerable: true, get: function () { return coupangApiFlow_1.cleanMerchant; } });
var musinsaApiFlow_1 = require("./musinsaApiFlow");
Object.defineProperty(exports, "musinsaCleanMerchant", { enumerable: true, get: function () { return musinsaApiFlow_1.cleanMerchant; } });
var kurlyApiFlow_1 = require("./kurlyApiFlow");
Object.defineProperty(exports, "findOrderRows", { enumerable: true, get: function () { return kurlyApiFlow_1.findOrderRows; } });
var musinsaApiFlow_2 = require("./musinsaApiFlow");
Object.defineProperty(exports, "musinsaFindOrderRows", { enumerable: true, get: function () { return musinsaApiFlow_2.findOrderRows; } });
var shapeLines_1 = require("./shapeLines");
Object.defineProperty(exports, "safeKey", { enumerable: true, get: function () { return shapeLines_1.safeKey; } });
var shapeTap_1 = require("./shapeTap");
Object.defineProperty(exports, "tapSafeKey", { enumerable: true, get: function () { return shapeTap_1.safeKey; } });
