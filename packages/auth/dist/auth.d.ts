export type Provider = 'kakao' | 'google' | 'apple';
/** 서버 웹 로그인으로도 되는 제공자까지 — 네이버는 앱이 SDK 를 주면 네이버 앱으로(2.8), 아니면 웹으로 간다 */
export type AnyProvider = Provider | 'naver';
/**
 * 네이버 SDK 초기화 값(2.8) — **서버가 내려 준 값**을 앱이 그대로 넘긴다(`auth/providers` 의 `config.naver`).
 * `serviceUrlScheme` 은 앱의 iOS URL Scheme(app.json 에 넣은 것) — 패키지는 이 값만 쓴다(하드코딩 없음).
 */
export type NaverKeys = {
    consumerKey: string;
    consumerSecret: string;
    appName: string;
    serviceUrlScheme?: string;
};
/** 서버가 토큰을 받아 세션을 만들어 준다 — 모양은 앱마다 다르므로 그대로 흘려보낸다 */
export type ServerLogin<T> = {
    kakao: (accessToken: string) => Promise<T>;
    google: (idToken: string) => Promise<T>;
    /** 이름은 애플이 **최초 1회만** 준다 — 그때 서버에 넘기지 않으면 영영 못 받는다 */
    apple: (identityToken: string, name: string) => Promise<T>;
    /** (2.8) 네이버 앱 로그인 토큰 → `POST {app}/auth/naver { accessToken }`. 없으면 네이버는 웹으로만 */
    naver?: (accessToken: string) => Promise<T>;
    /** (2.9) 서버 로그아웃(세션 지우기) — `signOut()` 이 부른다. 실패해도 기기 정리는 계속한다 */
    logout?: () => Promise<unknown>;
    /** (2.9) 서버 탈퇴 — `withdraw()` 가 부른다. 실패하면 SDK 연결은 끊지 않고 이유를 돌려준다 */
    withdraw?: () => Promise<unknown>;
};
/** (2.9) SDK 정리 결과 — 제공자마다 실패했을 때만 사유(정리할 것이 없으면 칸이 없다) */
export type SdkForgetResult = {
    naver?: string;
    kakao?: string;
    google?: string;
};
/**
 * (2.9) 로그인 결과가 「새 가입」인가 — 서버 `isNew`(첫 세션, jcurve-api e98cfb5) → 없으면 `member.needsSignup`(약관 전) → false.
 * 앱은 새 가입만 온보딩으로 보낸다(대표님 10-03 「가입 회원인데 온보딩으로 감」).
 */
export declare function isNewMember(result: unknown): boolean;
/**
 * (2.9) 화면에 쓸 이름 — 이메일 · 이름이 없을 수 있다(네이버 · 애플은 동의를 안 하면 비어 온다). 빈 값이면 「○○로 가입」.
 */
export declare function memberLabel(member: unknown): string;
/**
 * 계측에 실을 수 있는 값 — **스칼라만**.
 *
 * 객체를 넣으면 GA4 는 조용히 버리고, 서버 퍼널은 400 을 준다. 넓게 열어 두면 화면에서
 * 무심코 객체를 넣고 **나중에 「그 값이 안 보인다」로만** 드러난다.
 */
export type TrackParams = Record<string, string | number | boolean | null | undefined>;
/**
 * 서버를 거치는 웹 로그인 — SDK 가 없거나 실패했을 때 넘어가는 길(2.0).
 *
 * 브라우저로 서버의 로그인 시작 주소를 열고, 각 사 로그인이 끝나면 서버가 `returnUrl?ticket=…` 로
 * 앱을 다시 부른다. 앱은 그 티켓을 세션과 바꾼다. **인가 코드를 토큰으로 바꾸는 일은 서버가 한다** —
 * 카카오 REST 키는 client_secret 이 기본 활성이고 네이버는 필수라, 앱에 넣으면 번들을 뜯는 순간 나온다.
 *
 * 주면 켜진다: SDK 가 안 될 때 웹으로 넘어가고, 네이버와 안드로이드 애플(`apple_web`)이 된다.
 * 안 주면 1.0 과 같다 — SDK 가 안 되면 던진다.
 */
export type WebLogin<T> = {
    /**
     * 로그인 창 주소(서버의 로그인 시작 경로). `link` 는 게스트 연결 코드.
     *
     * **`nonce` 를 주소에 실어야 한다**(`&nonce=…`). 서버가 그것을 티켓에 묶고, 교환 때 같은 값을
     * 요구한다 — 없으면 다른 앱이 밀어 넣은 티켓으로 **남의 계정에 로그인**된다(2.0 Codex 검증 #1).
     */
    start: (provider: AnyProvider, link: string | undefined, nonce: string) => string;
    /** 서버가 로그인을 마치고 앱을 다시 부르는 주소. 예: `kkokkofarm://auth` */
    returnUrl: string;
    /** 복귀 주소의 1회용 티켓을 세션으로 바꾼다 — **`nonce` 를 함께 보낸다**(시작 때 준 값) */
    exchange: (ticket: string, nonce: string) => Promise<T>;
    /**
     * **서버가 만든 nonce** 를 받아 온다(`POST {app}/auth/nonce`) — 주면 이것을 먼저 쓴다.
     *
     * 기기에서 만들면 기기 난수에 기대야 하는데 React Native 기본엔 보안 난수가 없어 `Math.random` 으로
     * 떨어진다. 그 값을 누가 짐작하면 **같은 nonce 로 자기 로그인을 시작해 정상 서명된 티켓**을 받아
     * 밀어 넣을 수 있다(Codex 3차). 못 받으면 아래 `random` → 기기 난수로 넘어간다.
     */
    nonce?: () => Promise<string>;
};
/**
 * 게스트로 키우던 것을 가입한 계정에 잇는다 — **웹 로그인에서만** 쓴다.
 *
 * SDK 로그인은 앱의 `server.*` 호출이 게스트 세션을 헤더에 실어 보내면 서버가 잇는다.
 * 웹 로그인은 세션 토큰을 주소에 실을 수 없어서 1회용 연결 코드를 따로 받는다.
 */
export type Guest = {
    /** 지금 게스트로 쓰는 중인가 */
    active: () => boolean;
    /** 1회용 연결 코드. **비어 오면 창을 열지 않는다**(아래 웹 로그인 참고) */
    link: () => Promise<string | undefined>;
};
export type AuthDeps<T> = {
    keys: {
        kakaoNative?: string;
        googleWeb?: string;
        /** 없으면 웹 클라이언트 ID 로만 돈다 */
        googleIos?: string;
        /**
         * (2.8) 네이버 SDK 값 — **누를 때** 부른다(서버 목록을 앱이 뜬 뒤 받으므로 함수). 못 받았으면 null —
         * 그때는 웹 로그인으로 넘어가고 `login_native_fallback{provider:'naver', code:'no_keys'}` 를 남긴다.
         */
        naver?: () => NaverKeys | null | undefined | Promise<NaverKeys | null | undefined>;
        /**
         * (2.9.1) 이메일을 꼭 받는다(대표님 10-03 「네이버, 카카오 모두 이메일 받자」). 카카오는 로그인 뒤 이메일 동의가 없으면
         * 이메일 항목만 한 번 더 동의를 묻는다(카카오 계정 화면) — 거절하면 받은 토큰으로 그대로 진행. 이미 가입한 회원도 다음 로그인 때 묻는다.
         * 네이버 SDK 에는 재동의(reprompt) 옵션이 없다 — 네이버 콘솔에서 이메일을 필수로 두고, 빈 이메일은 서버가 다음 로그인에 채운다.
         */
        requireEmail?: boolean;
    };
    /**
     * (2.8) `@react-native-seoul/naver-login` 모듈 — 앱이 `() => require('@react-native-seoul/naver-login').default` 로 준다.
     *
     * 패키지가 직접 require 하지 않는 이유는 `random` 과 같다 — Metro 는 require 를 **빌드 때** 찾아서, 그 모듈이
     * 없는 앱은 try/catch 로 감싸도 번들이 깨진다. 이것 · `keys.naver` · `server.naver` 가 모두 있어야 네이버 앱으로 간다.
     */
    naverSdk?: () => any;
    server: ServerLogin<T>;
    /**
     * 사용 기록 — `createTrack()` 이 만든 것이나 앱의 `track()` 을 그대로 준다.
     *
     * 여기서 내는 이름은 `login_native_fallback`·`login_native_ok` 다. **서버 퍼널 허용 목록에
     * 없는 이름은 400 으로 버려진다** — `login_native_ok` 는 GA4 에만 남는다(`funnel.ts`).
     * 사유는 `code` 로 싣는다. 1.0 은 `why` 로 실어서 **서버 퍼널에서 사유가 비어 있었다**.
     */
    track?: (name: string, params?: TrackParams) => void;
    /** 서버 웹 로그인(2.0). 없으면 SDK 로만 한다 */
    web?: WebLogin<T>;
    /**
     * (2.10) 앱 로그인(SDK)이 안 되면 **웹으로 넘기지 않고 그대로 실패**로 돌릴 제공자(기본 없음 = 지금처럼 웹으로 넘김).
     * 예: `nativeOnly: ['kakao', 'naver', 'google']`. 실패는 `AuthError('failed', '<제공자>_native:<사유>')` 라
     * 화면이 `e.tag` 를 `login_fail` 에 실으면 사유가 남는다(카카오 계정 창까지 실패하면 예전처럼 `kakao_account:…`).
     * 애플(안드로이드 apple_web) · 게스트 잇기 · 늦게 온 웹 복귀는 이 값과 상관없다.
     */
    nativeOnly?: readonly AnyProvider[];
    /**
     * 어드민이 켠 로그인 — 서버의 제공자 목록(`kakao`·`kakao_native`·`google`·`naver`·`naver_native`·`apple`·`apple_web`).
     *
     * **비어 있으면 「아직 모른다」로 읽는다**(막지 않는다). 목록은 앱이 뜬 뒤 따로 받아 오는데,
     * 사람들은 첫 실행 1~5초 만에 로그인을 누른다. 그때 막으면 카카오 가입이 52 → 0 으로
     * 사라진다(꼬꼬농장 2026-09-18). 토큰은 어차피 서버가 확인하므로 잘못 열려도 서버가 거절한다.
     */
    providers?: () => readonly string[];
    /** 게스트 농장 잇기(2.0) */
    guest?: Guest;
    /**
     * 보안 난수 — `expo-crypto` 가 있는 앱은 `(b) => Crypto.getRandomValues(b)` 를 준다.
     *
     * 패키지가 `expo-crypto` 를 직접 require 하지 않는 이유: Metro 는 require 를 **빌드 때** 찾으므로,
     * 그 모듈이 없는 앱(꼬꼬농장)은 try/catch 로 감싸도 **번들이 깨진다**(Codex 3차).
     */
    random?: (bytes: Uint8Array) => void;
    /** 로그인이 끝나고 조용해져야 하는 시간(밀리초, 기본 1000) — `afterLoginSettled` 가 쓴다(2.6) */
    settleMs?: number;
};
/**
 * `busy` — 다른 로그인이 이미 도는 중이다. **화면은 무시하면 된다**(오류창을 띄우지 않는다).
 * 버튼을 연달아 눌렀을 때 창이 두 개 뜨고 서로의 복귀 주소를 가로채던 것을 막는다.
 */
export type AuthErrorCode = 'cancelled' | 'failed' | 'disabled' | 'busy';
/**
 * 로그인이 안 됐을 때 던지는 것.
 *
 * `tag` 는 **어디서 끊겼는지**다 — `open:`(창을 못 띄움) · `win:`(창이 이상하게 닫힘) ·
 * `ret:`(서버가 티켓 대신 오류) · `exg:`(교환 거절, 걸린 시간·시도 횟수). 문구가 하나뿐이면
 * 제보를 받아도 어느 갈래인지 알 수 없었다(꼬꼬농장). 화면 오류 문구 뒤에 붙여 두면 캡처 한 장으로 가른다.
 *
 * 메시지는 일부러 **고정값**이다. 취소면 `user_cancel` 이라 `isCancel(e.message)` 가 참이고,
 * 실패면 `auth_failed` 라 거짓이다 — 태그에 `cancel` 같은 글자가 섞여도 판정이 흔들리지 않는다.
 */
export declare class AuthError extends Error {
    readonly code: AuthErrorCode;
    readonly tag: string;
    /**
     * (2.9.4) 사용자에게 보여 줄 **정확한 안내** — 있으면 화면은 이 글을 그대로 쓰면 된다(없으면 앱의 기본 문구).
     * 예: 카카오톡이 없는 기기에서 카카오 계정 창을 못 열었을 때(10-04 디저트나우 iOS 시뮬).
     */
    readonly hint?: string;
    constructor(code: AuthErrorCode, tag: string, hint?: string);
}
/** 카카오톡 없는 기기에서 카카오 계정 로그인 창이 안 열렸을 때 안내(2.9.4) */
export declare const KAKAO_ACCOUNT_HINT = "\uCE74\uCE74\uC624 \uACC4\uC815 \uB85C\uADF8\uC778 \uCC3D\uC744 \uC5F4\uC9C0 \uBABB\uD588\uC5B4\uC694. \uCE74\uCE74\uC624\uD1A1\uC744 \uC124\uCE58\uD558\uAC70\uB098 \uB2E4\uB978 \uBC29\uBC95\uC73C\uB85C \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.";
export type Auth<T> = {
    /** 카카오 SDK 초기화 — 여러 번 불러도 한 번만 한다 */
    initKakao: () => void;
    /** 이 기기에서 SDK 로 쓸 수 있는 제공자 — **네이티브를 부르지 않는다**(화면이 뜰 때 돈다) */
    availableProviders: () => Provider[];
    /** 카카오톡으로 로그인할 수 있는가 — 안에서 초기화를 먼저 한다 */
    kakaoTalkAvailable: () => Promise<boolean>;
    signIn: (provider: AnyProvider) => Promise<T>;
    /**
     * 이 실행에서 로그인을 눌러 봤는가 — **누른 뒤에는 앱을 재시작하지 않는다.**
     *
     * OTA 적용처럼 앱이 스스로 다시 시작하는 일은 이걸 보고 정한다. 누르기 전에는 재시작해도
     * 같은 로그인 화면으로 돌아올 뿐이고, **오히려 적용해야 한다** — 새로 깐 사람은 옛 코드로
     * 시작하는데 「가입 뒤에만 적용」이면 가입을 막는 버그를 고친 판을 영영 못 받는다.
     */
    hasTriedAuth: () => boolean;
    /** 지금 로그인 창을 다녀오는 중인가 — 이때 재시작하면 복귀 주소를 잃는다 */
    isAuthorizing: () => boolean;
    /**
     * 로그인 창 **밖에서** 복귀 주소가 들어왔다 — 받은 제공자로 `signIn` 을 다시 부르면 창을 다시
     * 열지 않고 그 주소로 끝낸다. 돌려주는 함수를 부르면 구독을 끊는다.
     *
     * **반드시 받은 제공자로 부른다.** 다른 제공자로 부르면 받아 둔 주소를 쓰지 않고 새 로그인을
     * 시작한다(카카오 SDK 창이 뜨는 식). 1.x 의 꼬꼬농장은 「아무 제공자나」 넘겼다.
     */
    onLateReturn: (fn: (provider: AnyProvider) => void) => () => void;
    /**
     * 걸려 있는 로그인을 **잊는다** — 화면이 「돌아왔는데 안 끝났다」고 판단했을 때 부른다.
     *
     * 로그인 중 앱 밖에 나갔다 **아이콘으로** 돌아오면 SDK·커스텀 탭의 약속이 영영 안 끝날 수 있다
     * (당근캐시 2026-09-18 실기기). 패키지가 그 약속을 붙잡고 있으면 같은 버튼은 그 약속을 또 받고
     * 다른 버튼은 `busy` 라 **모든 로그인 버튼이 먹통**이 된다.
     *
     * ⚠ **언제 부르는지가 중요하다**(2026-09-22 영테크 · 당근 a93c018 · 꿀꿀 82e748c 에서 각각 터짐).
     * 앱이 **밖에 다녀왔을 때만** 잰다 — `createReturnWatch()` 의 `saw(next)` 가 참일 때
     * 2.5초 기다렸다가 안 끝났으면 화면의 busy 와 함께 이것을 부른다(바로 풀면 정상 로그인에 오탐).
     * 그 장치는 `background` 에서 깃발을 올리고 `active` 에서 내린다 — **중간 `inactive` 에서 지우면**
     * iOS 가 `background → inactive → active` 로 알려 주는 진짜 복귀를 놓쳐 버튼이 영영 먹통이 된다.
     * **`inactive` ↔ `active` 만 오간 것은 밖에 나간 게 아니다** — iOS 의 앱 안 로그인 창
     * (`ASWebAuthenticationSession`)·구글 계정 고르기·제어센터가 그렇다. 그걸 「돌아왔다」로 읽으면
     * 계정을 고르는 사이에 로그인을 잊어버린다.
     * 그리고 이때 **안내 팝업(RN `Modal`)을 띄우지 마라** — iOS 에서 그 창 위에 Modal 을 올리면
     * 보이지 않는 막이 남아 화면 터치가 전부 막힌다. 조용히 busy 만 푼다.
     * 웹 흐름·받아 둔 후보는 그대로 둔다 — 복귀 주소가 뒤늦게 오면 `onLateReturn` 으로 이어진다.
     */
    abandon: () => void;
    /**
     * (2.6) **로그인 직후 안전 시점**까지 기다린다 — 로그인 창(구글·애플·카카오)이 완전히 닫히고 앱이 `active` 로
     * 돌아와 1초 조용해진 뒤 한 틱 더. 로그인이 없었으면 곧 풀린다.
     *
     * 로그인 창이 **닫히는 중에** RN `Modal` 을 열면 iOS 에서 Modal 은 안 보이고 **보이지 않는 막만 남아 화면이 전부
     * 안 눌린다**(머니트리 2026-09-23 — 홈 진입 순간 가이드). 로그인 직후 여는 Modal · 시스템 창(가이드 · 알림 동의 ·
     * ATT)은 모두 이것을 거친다 — 보통은 `runAfterLogin` 으로.
     */
    afterLoginSettled: () => Promise<void>;
    /**
     * (2.6) 안전 시점에 **차례로** 연다 — 앞의 것이 끝나야(돌려준 약속까지) 다음이 열린다. 앞의 것이 실패해도 뒤는 연다.
     * 시스템 창 두 개가 겹치면 뒤의 것이 창 없이 끝난다(ATT · 알림 권한) — 그래서 줄을 세운다.
     *
     * ```ts
     * auth.runAfterLogin(() => showGuide());                 // 가이드가 닫힐 때 풀리는 약속을 돌려준다
     * auth.runAfterLogin(() => ads.requestTracking());       // 그다음 ATT
     * auth.runAfterLogin(() => notify.ask());                // 그다음 알림 권한
     * ```
     */
    runAfterLogin: <R>(fn: () => R | Promise<R>) => Promise<R>;
    /**
     * (2.9) 기기에 남은 SNS 로그인 정리 — 네이버 logout · 카카오 logout · 구글 signOut(`unlink` 면 네이버 deleteToken · 카카오 unlink · 구글 revokeAccess).
     * 안 지우면 다시 누를 때 **계정 선택 없이 바로 들어간다**(팩트투자 10-03). 실패는 무시하고 사유만 돌려준다. 애플은 기기에 지울 토큰이 없다.
     */
    forgetSdks: (opts?: {
        unlink?: boolean;
    }) => Promise<SdkForgetResult>;
    /** (2.9) 로그아웃 — 서버(`server.logout`, 실패 무시) + SDK 정리. 앱은 그 뒤 자기 저장값(세션 토큰)을 지운다 */
    signOut: (opts?: {
        unlink?: boolean;
    }) => Promise<SdkForgetResult>;
    /**
     * (2.9) 탈퇴 — 서버(`server.withdraw`)가 성공했을 때만 SDK 연결을 끊는다(네이버 토큰 삭제 · 카카오 unlink · 구글 revoke).
     * 서버가 실패하면 `{ ok:false, error }`(사용자에게 이유를 보여 준다) — 연결은 그대로라 다시 시도할 수 있다. 애플 revoke 는 대표님 결정 전 보류.
     */
    withdraw: () => Promise<{
        ok: boolean;
        error?: string;
        sdk?: SdkForgetResult;
    }>;
    /**
     * (2.6) 지금 안전 시점인가(동기) — **Modal 안전장치**로 쓴다: `visible={want && auth.loginSettled()}`.
     * 거짓이었으면 `afterLoginSettled().then(다시 그리기)` 로 한 번 더 그린다.
     */
    loginSettled: () => boolean;
};
/**
 * 아직 안 채운 값인가 — `.env.example` 의 `여기에_...` 같은 자리표시자.
 *
 * 키가 자리표시자면 **버튼을 아예 띄우지 않는다.** 눌러도 안 되는 버튼은 고장으로 보이고,
 * 카카오는 그 상태로 초기화하면 SDK 가 이상한 오류를 뱉는다.
 */
export declare const PLACEHOLDER: RegExp;
/**
 * 사용자가 **스스로 그만둔 것**인가.
 *
 * 그만둔 사람에게 오류창을 띄우면 앱이 고장 난 줄 안다. 그리고 퍼널에서 이탈이 **실패로
 * 부풀어** 보여, 고칠 것이 없는 자리를 들여다보게 된다.
 *
 * 제공자마다 말이 다르다 — 하나라도 빠뜨리면 그 갈래만 조용히 오류창이 된다.
 *  - `cancel` — `Cancelled`·`USER_CANCELLED`·`SIGN_IN_CANCELLED`·`ERR_REQUEST_CANCELED`
 *    (l 이 하나든 둘이든 앞부분이 같아 다 걸린다)
 *  - **`AccessDenied`** — 카카오가 동의 화면에서 「취소」를 눌렀을 때 주는 말이다.
 *    `cancel` 이 안 들어가 있어서 **빠뜨리기 쉽다.** 꿀꿀캐시가 2026-09-18 실기기에서
 *    이것 때문에 **취소한 사람에게 오류창**을 띄웠다. 꼬꼬농장은 같은 자리에서 **웹 로그인
 *    창을 한 번 더 열었다**(2.0 에서 고침). OAuth 표준 `access_denied` 도 같다.
 *  - `1001` — 애플·구글 iOS 쪽 취소
 *  - `12501` — 구글 안드로이드 계정 선택 취소
 */
export declare const isCancel: (code: string) => boolean;
/**
 * **앱 밖에 다녀왔다가 돌아왔는가** — `abandon()` 을 언제 잴지 가르는 장치. `AppState` 변화를 그대로 넣는다.
 *
 * 규칙은 둘뿐이다.
 *  - `background` 에서 **깃발을 올린다**(다른 앱·홈 화면으로 나갔다).
 *  - `active` 에서 **깃발을 내리고**, 올라가 있었으면 참을 돌려준다.
 *  - **`inactive` 는 깃발을 건드리지 않는다.**
 *
 * ⚠ **`inactive` 에서 깃발을 지우면 안 된다.** iOS 는 아이콘으로 나갔다 돌아올 때도 `background → inactive →
 * active` 로 알려 줘서, 중간에 지우면 **진짜 다녀온 경우를 놓친다** — 원래 버그(로그인 버튼이 영영 먹통,
 * 당근캐시 2026-09-18)가 되살아난다(총무님 세션 2026-09-22).
 * 반대로 `inactive → active` 만 오간 것은 **앱 안에서 일어난 일**이다 — iOS 앱 안 로그인 창
 * (`ASWebAuthenticationSession`), 구글 계정 고르기, 제어센터, 알림창. 그걸 「돌아왔다」로 읽으면 사용자가
 * 계정을 고르는 사이에 로그인을 잊어버린다(2026-09-22 영테크 실기기 · 당근 a93c018 · 꿀꿀 82e748c —
 * 앱마다 따로 만들다 세 번 샜다).
 *
 * ```ts
 * // 타이머까지 맡긴다(권장) — 다녀올 때마다 앞서 건 타이머를 끄고 새로 건다
 * const watch = createReturnWatch({
 *   busy: () => stillBusy(),
 *   onStuck: () => { auth.abandon(); clearBusy(); },   // 팝업은 띄우지 않는다
 * });
 * const sub = AppState.addEventListener('change', (next) => watch.saw(next));
 * // 화면을 떠날 때: sub.remove(); watch.stop();
 * ```
 *
 * ⚠ **앞서 건 타이머를 끄지 않으면**, 다녀와서 타이머를 걸고 또 나갔다 왔을 때 옛 타이머가 뒤늦게 울려
 * **그 사이 시작된 정상 로그인을 놓아 버린다**(당근 0079d15 · 영테크 f9f643b). 인자를 넘기면 패키지가 처리한다.
 * 인자 없이 `saw(next)` 만 쓰면 「밖에 다녀왔나」만 알려 준다 — 그때는 앱이 옛 타이머를 직접 무효화해야 한다.
 */
export type ReturnWatchDeps = {
    /** 지금도 로그인이 도는 중인가 — 참일 때만 `onStuck` 을 부른다 */
    busy: () => boolean;
    /** 밖에 다녀와 `wait` 가 지나도 안 끝났을 때 — `auth.abandon()` 과 화면 busy 풀기를 여기서 한다(팝업 금지) */
    onStuck: () => void;
    /** 기다리는 시간(밀리초, 기본 2500) */
    wait?: number;
    /**
     * **막 누른 참은 봐준다**(밀리초, 기본 3000). `started()` 를 부른 지 이만큼 안 지났으면 `onStuck` 을 걸지 않는다 —
     * 로그인 창이 아직 뜨는 중일 수 있어, 그때 놓아 주면 **정상 로그인을 시작하자마자 끊는다**
     * (용돈캡슐 · 꾹테크가 앱마다 따로 두던 처리를 2.4 에서 패키지가 든다).
     * `started()` 를 안 부르면 이 봐주기는 없던 것처럼 돈다.
     */
    grace?: number;
};
export declare function createReturnWatch(deps?: ReturnWatchDeps): {
    /** 로그인 버튼을 누르는 순간 부른다 — 「막 누른 참」을 재는 기준 */
    started: () => void;
    saw: (next: string | null | undefined) => boolean;
    stop: () => void;
};
/**
 * 복귀 주소에서 티켓·오류를 꺼낸다 — **RN 의 `URLSearchParams` 폴리필을 믿지 않는다.**
 *
 * 구글 재로그인(자동 리다이렉트)은 주소 끝에 `#` 가 남는다. 쿼리에 섞이면 티켓이 `XXXX#` 가 되어
 * 서버가 못 찾는다(꼬꼬농장 2026-08-26, 구글만 로그인 실패).
 */
export declare function parseReturn(url: string): {
    ticket?: string;
    error?: string;
};
/**
 * 기기와 닿는 것 — **시험에서만** 갈아 끼운다.
 *
 * 네이티브 모듈은 모두 지연 `require` 로만 집는다(②). 모듈이 빠진 빌드에서 정적 import 는
 * 앱 시작 자체를 죽이고, OTA 로 옛 런타임에 같은 JS 가 내려가므로 더 그렇다.
 */
export type AuthEnv = {
    os: () => string;
    kakaoCore: () => any | null;
    kakaoUser: () => any | null;
    google: () => any | null;
    apple: () => any | null;
    /** expo-web-browser */
    browser: () => any | null;
    /** react-native 의 Linking */
    linking: () => any | null;
    wait: (ms: number) => Promise<void>;
    /** (2.6) 지금 AppState · 바뀔 때 알림 · 시각 — 없으면 늘 active 로 본다(시험·웹) */
    appState?: () => string;
    onAppState?: (fn: (next: string) => void) => () => void;
    now?: () => number;
};
export declare function createAuth<T>(deps: AuthDeps<T>, env?: AuthEnv): Auth<T>;
