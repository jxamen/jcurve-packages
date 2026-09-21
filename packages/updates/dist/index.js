"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pullUpdateSoon = exports.onUpdateReady = exports.hasWaiting = exports.bundleLabel = exports.bandShows = exports.applyUpdate = exports.__reset = void 0;
/**
 * `@jcurve/updates` — 리워드 앱 공용 **OTA 받기·적용하기**.
 *
 * **언제 받을지도, 언제 적용할지도 앱이 정한다.** 그냥 두면 expo-updates 가 켤 때마다
 * 확인하고 스스로 다시 시작하는데, 그게 사람을 잃는 자리다.
 *
 * ## 왜 이렇게 생겼나 — 전부 실기기에서 한 번씩 밟은 것
 *
 *  ① **켤 때 자동으로 확인하지 않는다.** 꼬꼬농장에서 새로 설치한 기기가 첫 1~2분에 앱이
 *     3~4번 다시 시작됐고, 그 사이에 로그인 버튼을 누른 사람이 가입을 못 했다
 *     (신규 134대 중 79대가 3회 이상 재시작, **57대가 가입 실패**). 소셜 로그인은 앱 밖으로
 *     나갔다 돌아오는 흐름이라, 그 사이에 앱이 다시 시작되면 **돌아올 곳이 사라진다.**
 *     → `app.json` 에 `checkAutomatically: 'ON_ERROR_RECOVERY'` 를 두고, 받는 것은 여기서 한다.
 *
 *  ② **받아만 두고 다음 실행을 기다리면 늘 한 판 뒤처진다.** 새 판을 자주 올리는 동안
 *     기기가 계속 옛 판이었다(2026-09-17 제보: 「OTA 가 왜 이렇게 자꾸 안 되는 거야?」).
 *     → 다 받으면 알려 주고, **사람이 누르면 그때 적용한다**(`applyUpdate`).
 *
 *  ③ **스스로 다시 시작하지 않는다.** 끊는 주체가 사람이라 로그인이 끊길 일이 없다.
 *     `applyUpdate` 말고 어디에서도 `reloadAsync` 를 부르지 않는 것이 규칙이다.
 *
 *  ④ **어느 화면에서든 받는다.** 홈에 도착한 뒤에만 받게 하면 **로그인 화면을 고친 변경이
 *     영영 안 내려간다** — 로그인 안 한 기기는 홈에 갈 일이 없다.
 *
 *  ⑤ **이미 받아 뒀으면 등록하는 그 자리에서 알린다.** 받는 것이 홈보다 먼저 끝난 기기에서
 *     등록만 하고 기다리면 알림을 놓쳐 **띠가 영영 안 뜬다**(캐시팡에 있던 구멍).
 *
 *  ⑥ **`isNew` 일 때만 알린다.** 되돌리기·실패에도 띠를 내면 눌러도 그대로다.
 *
 * 앱마다 다시 쓰면 이 여섯 개 중 몇 개가 빠진다. 2026-09-21 실측에서 **아홉 벌이 흩어져
 * 있었고 길이가 33~119줄로 제각각**이었다 — 짧은 쪽에는 위 교훈이 안 들어가 있다.
 *
 * ## 쓰는 법
 *
 * `app.json` 에 먼저:
 * ```json
 * "updates": { "checkAutomatically": "ON_ERROR_RECOVERY" }
 * ```
 *
 * ```ts
 * import { pullUpdateSoon, onUpdateReady, applyUpdate, bandShows, bundleLabel } from '@jcurve/updates';
 *
 * pullUpdateSoon();                              // 앱이 뜨고 2초 뒤 받는다
 * onUpdateReady(() => setGotOne(true));          // 다 받으면 띠를 띄운다
 *
 * {bandShows(gotOne, notice, keyboard) && (
 *   <Band onPress={() => void applyUpdate()}>새 버전이 준비됐어요</Band>
 * )}
 * ```
 *
 * **띠의 생김새는 앱마다 다르게 둔다** — 이 패키지는 「언제 띄울지」만 정한다.
 * `bundleLabel()` 은 지금 돌고 있는 판 이름이다(설정 화면에 두면 「적용됐나?」를 눈으로 본다).
 */
var updates_1 = require("./updates");
Object.defineProperty(exports, "__reset", { enumerable: true, get: function () { return updates_1.__reset; } });
Object.defineProperty(exports, "applyUpdate", { enumerable: true, get: function () { return updates_1.applyUpdate; } });
Object.defineProperty(exports, "bandShows", { enumerable: true, get: function () { return updates_1.bandShows; } });
Object.defineProperty(exports, "bundleLabel", { enumerable: true, get: function () { return updates_1.bundleLabel; } });
Object.defineProperty(exports, "hasWaiting", { enumerable: true, get: function () { return updates_1.hasWaiting; } });
Object.defineProperty(exports, "onUpdateReady", { enumerable: true, get: function () { return updates_1.onUpdateReady; } });
Object.defineProperty(exports, "pullUpdateSoon", { enumerable: true, get: function () { return updates_1.pullUpdateSoon; } });
