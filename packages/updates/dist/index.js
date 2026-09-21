"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startupSettled = exports.bundleLabel = exports.autoApply = exports.__reset = void 0;
/**
 * `@jcurve/updates` — 리워드 앱 공용 **OTA 적용하기**(2.0 — 꼬꼬농장 방식).
 *
 * 받는 것은 네이티브가 켤 때 한다. 이 패키지는 **다 받은 새 버전을 언제 적용할지**만 정한다.
 * 적용은 앱을 다시 시작하는 일이라, 그 순간이 로그인과 겹치면 **로그인이 취소되며 튕겨 나가고
 * 그 사람은 이탈한다** — 소셜 로그인은 앱 밖(카카오톡·브라우저)에 나갔다 돌아오는 흐름이라,
 * 그 사이에 앱이 다시 시작되면 돌아올 곳이 사라진다.
 *
 * ## 왜 이렇게 생겼나 — 꼬꼬농장이 실기기에서 밟은 것
 *
 *  ① **켜자마자 적용하면 가입이 끊긴다.** 새로 설치한 기기가 첫 1~2분에 3~4번 다시 시작됐고,
 *     그 사이에 로그인 버튼을 누른 사람이 가입을 못 했다(2026-09-16 신규 134대 중 79대가 3회 이상
 *     재시작, **57대 가입 실패**).
 *     → **로그인·가입 중에는 절대 적용하지 않는다**(`busy`). 앱이 뒤로 가 있을 때도(로그인 창·미션 매체).
 *
 *  ② **「가입 후에만 적용」도 틀렸다.** 새로 깐 사람은 스토어 빌드의 옛 코드로 시작하는데, 가입을
 *     막는 버그를 고쳐도 가입을 해야 받으니 **영영 못 받는다**(카카오 로그인이 그랬다, 2026-09-18).
 *     → 로그인 전이라도 **로그인 버튼을 누르기 전이면** 바로 적용한다 — 같은 로그인 화면으로
 *     돌아올 뿐이라 인증을 끊지 않는다. 한 번이라도 눌렀으면(`triedAuth`) 그 실행에서는 안 한다.
 *
 *  ③ **다음 실행을 기다리면 늘 한 판 뒤처진다.** 기본 동작은 「완전 종료 두 번」을 요구해
 *     받았는지조차 알 수 없었다. → 로그인한 사람은 **켠 지 6초 안**(시작 화면)이면 바로,
 *     늦으면 **메인에 있을 때**(`atHome`) 조용히 적용한다. 끝내 기회가 없으면 다음 실행에 저절로.
 *
 *  ④ **로그인 전 사람의 시작 화면은 네이티브 확인이 끝날 때까지 붙잡는다**(`startupSettled`, 최대 3초).
 *     앱 소개가 먼저 뜬 뒤 적용되면 화면이 덜컥 처음으로 돌아간다.
 *
 * ## 쓰는 법
 *
 * `app.json` 은 **기본값 그대로** 둔다 — `checkAutomatically` 를 건드리지 않고(켤 때 네이티브가 받는다),
 * `"fallbackToCacheTimeout": 0`(받기를 기다리느라 시작이 늦지 않게).
 *
 * **(2.1) `checkAutomatically` 를 ON_ERROR_RECOVERY·NEVER 로 박아 낸 빌드도 된다** — 1.0 안내대로 만든 앱(당근캐시 등).
 * 그 설정은 빌드에 박혀 OTA 로 못 바꾸므로, 그런 빌드면 패키지가 켠 지 2초 뒤 직접 받는다. 적용 규칙은 같다.
 * 다음 네이티브 빌드 때 기본값으로 돌려 두면 네이티브가 받는다.
 *
 * ```ts
 * import { autoApply, startupSettled } from '@jcurve/updates';
 * import { auth } from './auth';   // @jcurve/auth
 *
 * // 앱이 켜질 때 한 번
 * autoApply({
 *   signedIn: () => !!session,
 *   triedAuth: () => auth.hasTriedAuth(),
 *   busy: () => onLoginScreen || inSignup || auth.isAuthorizing(),
 *   atHome: () => onMainTab,
 * });
 *
 * // 로그인 전이면 시작 화면을 네이티브 확인이 끝날 때까지 붙잡는다
 * if (!session) await startupSettled();
 * SplashScreen.hideAsync();
 * ```
 *
 * **`busy` 에 로그인 화면·가입 화면을 빠뜨리지 마라.** 로그인 창을 다녀오는 중(`isAuthorizing`)만
 * 넣으면, 창을 열기 직전·가입 동의 화면에서 적용돼 같은 사고가 난다.
 *
 * `bundleLabel()` 은 지금 돌고 있는 판 이름이다(설정 화면에 두면 「적용됐나?」를 눈으로 본다).
 *
 * ## 1.0 에서 달라진 것
 *
 * 1.0 은 「스스로 다시 시작하지 않고, 띠를 눌러야 적용」이었다. 적용이 사람 손에 달려 새 버전이 퍼지지
 * 않았고, 쓰는 앱도 없었다. 2.0 은 꼬꼬농장이 실제로 쓰며 다듬은 방식을 **모든 앱이 그대로** 쓴다.
 */
var updates_1 = require("./updates");
Object.defineProperty(exports, "__reset", { enumerable: true, get: function () { return updates_1.__reset; } });
Object.defineProperty(exports, "autoApply", { enumerable: true, get: function () { return updates_1.autoApply; } });
Object.defineProperty(exports, "bundleLabel", { enumerable: true, get: function () { return updates_1.bundleLabel; } });
Object.defineProperty(exports, "startupSettled", { enumerable: true, get: function () { return updates_1.startupSettled; } });
