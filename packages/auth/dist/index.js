"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.standardEvent = exports.propOf = exports.createTrack = exports.referrerKeys = exports.looksPersonal = exports.FUNNEL_EVENTS = exports.createFunnel = exports.PLACEHOLDER = exports.parseReturn = exports.isCancel = exports.createAuth = exports.AuthError = void 0;
/**
 * `@jcurve/auth` — 리워드 앱들이 **같이 쓰는 소셜 로그인 + 가입 퍼널 기록**.
 *
 * 로그인은 앱마다 다시 만들 자리가 아니다. 겉보기에는 「카카오 버튼을 누르면 토큰을 받아
 * 서버에 준다」가 전부인데, 실제로는 **기기에서만 드러나는 함정이 줄줄이** 있다.
 * 아래는 전부 실기기에서 한 번씩 밟고 고친 것들이고, 앱을 새로 만들 때마다 다시 밟았다.
 *
 *  ① **SDK 로그인이어야 한다.** 서버 콜백형 웹 OAuth 는 인앱 브라우저를 열고, 거기 로그인이
 *     안 돼 있으면 아이디·비밀번호를 치게 한다 — 꼬꼬농장이 **웹 OAuth 를 쓰던 시절**
 *     로그인 단계에서 절반이 빠졌다(첫 실행 55명 중 27명 이탈).
 *     그 뒤 꼬꼬농장도 SDK 로 옮겼다 — 이 줄은 **되돌아가지 말라는 기록**이다.
 *     2.0 의 서버 웹 로그인(`web`)은 **SDK 가 안 될 때 넘어가는 길**이다 — 먼저 쓰지 않는다.
 *
 *  ② **네이티브 모듈은 지연 `require` 로만 집는다.** 모듈이 빠진 빌드에서 정적 import 는
 *     앱 시작 자체를 죽인다. OTA 로 옛 런타임에 같은 JS 가 내려가므로 더 그렇다.
 *     ⚠ 다만 **Metro 는 `require('…')` 를 빌드 때 찾는다**(`allowOptionalDependencies` 기본 꺼짐) —
 *     실행 때는 네이티브가 없어도 넘어가지만, **JS 패키지가 앱에 설치돼 있지 않으면 번들이 깨진다.**
 *     그래서 앱에 다음이 모두 있어야 한다: `@react-native-kakao/core`·`@react-native-kakao/user`·
 *     `@react-native-google-signin/google-signin`·`expo-apple-authentication`·`expo-web-browser`·
 *     `@react-native-firebase/analytics`·`expo-application`·`expo-modules-core`·`expo-updates`.
 *     목록 밖의 모듈(`expo-crypto` 등)을 여기서 require 하지 마라 — 한 번 넣었다가 꼬꼬농장 번들이
 *     깨질 뻔했다(Codex 3차). 필요하면 앱이 함수로 넘겨준다(`random`).
 *
 *  ③ **카카오는 초기화 전에 네이티브를 부르면 안드로이드가 그 자리에서 죽는다**
 *     (`lateinit property hosts has not been initialized`). 네이티브가 메인 스레드에서
 *     던져 **자바스크립트 `try/catch` 로 안 잡힌다.** iOS 는 같은 코드로도 버텨서
 *     안드로이드에서만 드러난다(2026-09-18 꿀꿀캐시, 갤럭시 A32).
 *
 *  ④ **카카오 `login()` 한 줄은 조용히 웹으로 떨어진다.** 편해 보이지만 **사유가 아무 데도
 *     안 남는다** — 카카오톡이 없는 것인지, 키 해시가 틀린 것인지, 서버가 거절한 것인지
 *     구분할 수 없다. 여기서는 갈래마다 `login_native_fallback` 을 남긴다.
 *
 *  ⑤ **구글은 취소가 예외가 아니라 반환값이다**(google-signin v13+, `{ type: 'cancelled' }`).
 *     못 알아보면 그냥 취소한 사람에게 「로그인하지 못했어요」 오류창이 뜨고,
 *     퍼널에서는 이탈이 **실패로 부풀어** 보인다.
 *
 *  ⑥ **애플 이름은 최초 1회만 온다.** 그때 서버에 안 넘기면 영영 못 받는다.
 *
 *  ⑦ **인증 창이 닫히며 돌아오는 순간의 fetch 가 iOS 에서 끊긴다**(함정 B-29).
 *     서버 교환은 멱등이라 두 번까지 다시 보낸다.
 *
 * ## 2.0 — 꼬꼬농장이 실기기에서 쌓은 것을 얹었다(2026-09-21)
 *
 * 1.0 은 「SDK 로 토큰 받아 서버에 넘기기」 한 겹이었다. 꼬꼬농장에는 그 위에 가입을 지키는
 * 장치가 더 있었고, 전부 실제 사고로 생긴 것이다. **모두 선택**이라 1.0 처럼 써도 그대로 돈다.
 *
 *  ⑧ **SDK 가 안 되면 서버 웹 로그인으로 넘어간다**(`web`). 모듈이 없는 옛 빌드, 키 해시 미등록,
 *     서버가 토큰을 거절한 경우 — 그냥 실패하면 그 사람은 가입을 못 한다.
 *
 *  ⑨ **안드로이드는 복귀 주소가 창보다 늦게 온다.** 카카오톡 앱을 다녀오면 로그인 창이 먼저 닫혀
 *     「취소」로 받고 주소는 따로 온다. 잡아 두지 않으면 **인증하고도 가입이 안 된다**
 *     (꼬꼬농장 2026-09-14, 13건). `onLateReturn` 으로 화면이 이어서 처리한다.
 *
 *  ⑩ **게스트로 키운 것을 잇는다**(`guest`). 연결 코드를 못 받으면 **창을 열지 않는다** —
 *     열면 오류 없이 새 회원이 생기고 키우던 농장만 사라진다(2026-09-19 당근캐시 세션).
 *
 *  ⑪ **로그인을 누른 뒤에는 앱을 재시작하지 않는다**(`hasTriedAuth`·`isAuthorizing`).
 *     OTA 적용이 로그인 창을 다녀오는 중에 앱을 다시 시작하면 돌아올 곳이 사라진다 —
 *     꼬꼬농장 신규 설치 134대 중 57대가 그래서 가입을 못 했다(2026-09-16).
 *
 *  ⑫ **어드민이 켠 로그인만**(`providers`). 목록이 **비어 있으면 모르는 것으로 보고 막지 않는다** —
 *     목록보다 먼저 버튼을 누르는 사람이 흔해서, 막았더니 카카오 가입이 52 → 0 이 됐다.
 *
 *  ⑬ **가입 퍼널을 앱마다 같은 이름으로**(`createFunnel`·`createTrack`). 이름이 제각각이면
 *     어드민에서 앱을 나란히 놓고 비교할 수 없다. 이름 목록은 서버 허용 목록과 같아야 한다.
 *
 *  ⑭ **티켓 밀어 넣기(로그인 CSRF)를 막는다.** 남이 자기 계정으로 받은 복귀 주소를 딥링크로 쏘면
 *     그 계정으로 로그인됐다(Codex 검증). 흐름마다 서버가 만든 `nonce` 를 시작 주소와 교환에 싣고,
 *     서버는 그 nonce 로 서명한 티켓만 바꿔 준다. 앱도 한 겹 더 — 늦게 온 주소는 **후보**로만 받고
 *     (창이 돌려준 것도), 서버가 확인한 것으로만 흐름을 닫는다.
 *
 * 고친 것 둘:
 *  - 카카오 동의 화면의 「취소」(`AccessDenied`)에 꼬꼬농장은 **웹 로그인 창을 한 번 더 열었다.**
 *  - 1.0 은 폴백 사유를 `why` 로 실어 **서버 퍼널에서 사유가 비어 있었다.** 이제 `code` 다.
 *
 * ## 쓰는 법
 *
 * ```ts
 * import { createAuth, createFunnel, createTrack, isCancel, AuthError } from '@jcurve/auth';
 *
 * const funnel = createFunnel({ base: API, appToken: APP_TOKEN, storage: AsyncStorage });
 * export const track = createTrack({ funnel });
 *
 * export const auth = createAuth({
 *   keys: { kakaoNative: KAKAO_NATIVE_APP_KEY, googleWeb: GOOGLE_WEB_CLIENT_ID, googleIos: GOOGLE_IOS_CLIENT_ID },
 *   server: { kakao: loginKakao, google: loginGoogle, apple: loginApple },
 *   track,
 *   // ↓ 여기부터 2.0 (없어도 된다)
 *   // nonce 는 **시작 주소와 교환 본문 둘 다**에 싣는다 — 한쪽만 실으면 서버가 모든 교환을 거절하고,
 *   // 둘 다 빼면 보안 수정이 적용되지 않는다(남이 밀어 넣은 티켓으로 로그인된다)
 *   web: { start: (p, link, nonce) => `${API}/auth/start?provider=${p}&nonce=${nonce}` + (link ? `&link=${link}` : ''),
 *          returnUrl: 'myapp://auth',
 *          exchange: (ticket, nonce) => api.post('auth/exchange', { ticket, nonce }),
 *          // nonce 는 **서버가 만든 것**을 쓴다 — RN 기본엔 보안 난수가 없어 기기에서 만들면 짐작될 수 있다
 *          nonce: async () => (await api.post('auth/nonce')).nonce },
 *   providers: () => serverProviders,          // /auth/providers 결과(비어 있으면 막지 않는다)
 *   guest: { active: () => !!guestToken, link: () => guestLinkCode(guestToken) },
 * });
 *
 * auth.onLateReturn((p) => auth.signIn(p));   // 창 밖으로 늦게 온 복귀 — **받은 제공자로**
 * funnel.appOpen();                            // 앱 실행마다 한 번
 * try {
 *   const session = await auth.signIn('kakao');
 * } catch (e) {
 *   // 취소·busy(다른 로그인이 도는 중)는 오류창을 띄우지 않는다
 *   if (e instanceof AuthError && (e.code === 'cancelled' || e.code === 'busy')) return;
 *   showError(e instanceof AuthError ? e.tag : '');
 * }
 * ```
 *
 * **이미 쓰던 앱은 퍼널 저장 키를 그대로 준다**(`keys.device`) — 바뀌면 전 사용자가 하루에
 * 「첫 실행」으로 찍힌다.
 *
 * ⚠ **화면이 뜨는 순간 도는 함수에서 네이티브를 부르지 마라.** `availableProviders()` 는
 * 그래도 되게 만들어 두었다(모듈 객체의 필드를 읽기만 한다). 「카카오톡이 없으면 버튼을
 * 아래로」 같은 것을 붙일 때는 반드시 `kakaoTalkAvailable()` 을 쓴다 — 그 안에서 초기화를
 * 먼저 한다. 직접 `isKakaoTalkLoginAvailable()` 을 부르면 ③ 을 밟는다.
 */
var auth_1 = require("./auth");
Object.defineProperty(exports, "AuthError", { enumerable: true, get: function () { return auth_1.AuthError; } });
Object.defineProperty(exports, "createAuth", { enumerable: true, get: function () { return auth_1.createAuth; } });
Object.defineProperty(exports, "isCancel", { enumerable: true, get: function () { return auth_1.isCancel; } });
Object.defineProperty(exports, "parseReturn", { enumerable: true, get: function () { return auth_1.parseReturn; } });
Object.defineProperty(exports, "PLACEHOLDER", { enumerable: true, get: function () { return auth_1.PLACEHOLDER; } });
var funnel_1 = require("./funnel");
Object.defineProperty(exports, "createFunnel", { enumerable: true, get: function () { return funnel_1.createFunnel; } });
Object.defineProperty(exports, "FUNNEL_EVENTS", { enumerable: true, get: function () { return funnel_1.FUNNEL_EVENTS; } });
Object.defineProperty(exports, "looksPersonal", { enumerable: true, get: function () { return funnel_1.looksPersonal; } });
Object.defineProperty(exports, "referrerKeys", { enumerable: true, get: function () { return funnel_1.referrerKeys; } });
var track_1 = require("./track");
Object.defineProperty(exports, "createTrack", { enumerable: true, get: function () { return track_1.createTrack; } });
Object.defineProperty(exports, "propOf", { enumerable: true, get: function () { return track_1.propOf; } });
Object.defineProperty(exports, "standardEvent", { enumerable: true, get: function () { return track_1.standardEvent; } });
