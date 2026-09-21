/**
 * `@jcurve/auth` — 리워드 앱 세 개(당근캐시·꿀꿀캐시·꼬꼬농장)가 **같이 쓰는 소셜 로그인**.
 *
 * 로그인은 앱마다 다시 만들 자리가 아니다. 겉보기에는 「카카오 버튼을 누르면 토큰을 받아
 * 서버에 준다」가 전부인데, 실제로는 **기기에서만 드러나는 함정이 줄줄이** 있다.
 * 아래는 전부 실기기에서 한 번씩 밟고 고친 것들이고, 앱을 새로 만들 때마다 다시 밟았다.
 *
 *  ① **SDK 로그인이어야 한다.** 서버 콜백형 웹 OAuth 는 인앱 브라우저를 열고, 거기 로그인이
 *     안 돼 있으면 아이디·비밀번호를 치게 한다 — 꼬꼬농장이 **웹 OAuth 를 쓰던 시절**
 *     로그인 단계에서 절반이 빠졌다(첫 실행 55명 중 27명 이탈).
 *     그 뒤 꼬꼬농장도 SDK 로 옮겼다 — 이 줄은 **되돌아가지 말라는 기록**이다.
 *
 *  ② **네이티브 모듈은 지연 `require` 로만 집는다.** 모듈이 빠진 빌드에서 정적 import 는
 *     앱 시작 자체를 죽인다. OTA 로 옛 런타임에 같은 JS 가 내려가므로 더 그렇다.
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
 * ## 쓰는 법
 *
 * 앱마다 다른 것은 **셋뿐**이다 — 키, 서버 호출, 기록. 그 셋을 주고 만들어 쓴다.
 *
 * ```ts
 * import { createAuth } from '@jcurve/auth';
 *
 * export const auth = createAuth({
 *   keys: { kakaoNative: KAKAO_NATIVE_APP_KEY, googleWeb: GOOGLE_WEB_CLIENT_ID, googleIos: GOOGLE_IOS_CLIENT_ID },
 *   track,
 *   server: { kakao: loginKakao, google: loginGoogle, apple: loginApple },
 * });
 * ```
 *
 * ⚠ **화면이 뜨는 순간 도는 함수에서 네이티브를 부르지 마라.** `availableProviders()` 는
 * 그래도 되게 만들어 두었다(모듈 객체의 필드를 읽기만 한다). 「카카오톡이 없으면 버튼을
 * 아래로」 같은 것을 붙일 때는 반드시 `kakaoTalkAvailable()` 을 쓴다 — 그 안에서 초기화를
 * 먼저 한다. 직접 `isKakaoTalkLoginAvailable()` 을 부르면 ③ 을 밟는다.
 */
export { createAuth, isCancel, PLACEHOLDER } from './auth';
export type { Auth, AuthDeps, Provider, ServerLogin, TrackParams } from './auth';
