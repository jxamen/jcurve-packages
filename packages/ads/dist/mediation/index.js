"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeSkAdNetworkItems = exports.patchPodfile = exports.patchProjectBuildGradle = exports.patchAppBuildGradle = exports.PANGLE_TIKTOK_COMP = exports.pickVersions = exports.podSatisfies = exports.cmpVersion = exports.SKADNETWORK_IDS = exports.DEFAULT_GMA = exports.SPECS = exports.NETWORKS = void 0;
/**
 * @jcurve/mediation — AdMob 미디에이션 어댑터(앱러빈 · 유니티 · 민티그럴 · 팽글 · 메타)를 넣는 Expo 설정 플러그인.
 *
 * 런타임 코드는 없다. 광고를 켜고 받는 시점(처음 광고 직전에 켜기 · 미리 안 받기, 9/22 발열 결정)은 @jcurve/ads 그대로다.
 * 어댑터는 GMA SDK 가 켜질 때(`mobileAds().initialize()`) 같이 켜지고, 어느 망을 쓸지는 AdMob 미디에이션 그룹에서 정한다.
 * 쓰는 법은 README, 앱이 부르는 것은 app.plugin.js 뿐이다. 여기 내보내는 것은 시험 · 확인용이다.
 */
var catalog_1 = require("./catalog");
Object.defineProperty(exports, "NETWORKS", { enumerable: true, get: function () { return catalog_1.NETWORKS; } });
Object.defineProperty(exports, "SPECS", { enumerable: true, get: function () { return catalog_1.SPECS; } });
Object.defineProperty(exports, "DEFAULT_GMA", { enumerable: true, get: function () { return catalog_1.DEFAULT_GMA; } });
Object.defineProperty(exports, "SKADNETWORK_IDS", { enumerable: true, get: function () { return catalog_1.SKADNETWORK_IDS; } });
var patch_1 = require("./patch");
Object.defineProperty(exports, "cmpVersion", { enumerable: true, get: function () { return patch_1.cmpVersion; } });
Object.defineProperty(exports, "podSatisfies", { enumerable: true, get: function () { return patch_1.podSatisfies; } });
Object.defineProperty(exports, "pickVersions", { enumerable: true, get: function () { return patch_1.pickVersions; } });
Object.defineProperty(exports, "PANGLE_TIKTOK_COMP", { enumerable: true, get: function () { return patch_1.PANGLE_TIKTOK_COMP; } });
Object.defineProperty(exports, "patchAppBuildGradle", { enumerable: true, get: function () { return patch_1.patchAppBuildGradle; } });
Object.defineProperty(exports, "patchProjectBuildGradle", { enumerable: true, get: function () { return patch_1.patchProjectBuildGradle; } });
Object.defineProperty(exports, "patchPodfile", { enumerable: true, get: function () { return patch_1.patchPodfile; } });
Object.defineProperty(exports, "mergeSkAdNetworkItems", { enumerable: true, get: function () { return patch_1.mergeSkAdNetworkItems; } });
