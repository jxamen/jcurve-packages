"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAppHub = exports.DEFAULT_SECTION = exports.parseHub = exports.hubLoader = exports.storeLoader = exports.tintOf = exports.familyRows = exports.AppHubSheet = void 0;
/**
 * `@jcurve/apphub` — 리워드 앱 공용 「앱 모아보기」.
 *
 * 하단 버튼(입구)은 앱마다 그 앱답게 따로 달고, **눌러서 나오는 내용은 이 패키지 하나**를 쓴다.
 * 목록의 원본은 어드민 「앱관리」이고 서버가 `{API_BASE}/family` 로 내준다.
 */
var AppHubSheet_1 = require("./AppHubSheet");
Object.defineProperty(exports, "AppHubSheet", { enumerable: true, get: function () { return AppHubSheet_1.AppHubSheet; } });
var pick_1 = require("./pick");
Object.defineProperty(exports, "familyRows", { enumerable: true, get: function () { return pick_1.familyRows; } });
Object.defineProperty(exports, "tintOf", { enumerable: true, get: function () { return pick_1.tintOf; } });
var load_1 = require("./load");
Object.defineProperty(exports, "storeLoader", { enumerable: true, get: function () { return load_1.storeLoader; } });
Object.defineProperty(exports, "hubLoader", { enumerable: true, get: function () { return load_1.hubLoader; } });
Object.defineProperty(exports, "parseHub", { enumerable: true, get: function () { return load_1.parseHub; } });
Object.defineProperty(exports, "DEFAULT_SECTION", { enumerable: true, get: function () { return load_1.DEFAULT_SECTION; } });
var hook_1 = require("./hook");
Object.defineProperty(exports, "useAppHub", { enumerable: true, get: function () { return hook_1.useAppHub; } });
