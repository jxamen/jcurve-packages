/**
 * 소셜 로그인 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * 이 파일은 **앱을 모른다.** 키·서버 호출·기록을 받아서 쓸 뿐이라 세 앱이 그대로 쓴다.
 */
export type Provider = 'kakao' | 'google' | 'apple';
/** 서버가 토큰을 받아 세션을 만들어 준다 — 모양은 앱마다 다르므로 그대로 흘려보낸다 */
export type ServerLogin<T> = {
    kakao: (accessToken: string) => Promise<T>;
    google: (idToken: string) => Promise<T>;
    /** 이름은 애플이 **최초 1회만** 준다 — 그때 서버에 넘기지 않으면 영영 못 받는다 */
    apple: (identityToken: string, name: string) => Promise<T>;
};
/**
 * 계측에 실을 수 있는 값 — **스칼라만**.
 *
 * 객체를 넣으면 GA4 는 조용히 버리고, 서버 퍼널은 400 을 준다. 넓게 열어 두면 화면에서
 * 무심코 객체를 넣고 **나중에 「그 값이 안 보인다」로만** 드러난다.
 */
export type TrackParams = Record<string, string | number | boolean | null | undefined>;
export type AuthDeps<T> = {
    keys: {
        kakaoNative?: string;
        googleWeb?: string;
        /** 없으면 웹 클라이언트 ID 로만 돈다 */
        googleIos?: string;
    };
    server: ServerLogin<T>;
    /**
     * 사용 기록 — 앱의 `track()` 을 그대로 준다.
     *
     * 여기서 내는 이름은 `login_native_fallback` 하나다. **서버 화이트리스트에 그 이름이
     * 없으면 400 으로 버려진다** — 퍼널에서 그 단계만 조용히 비어 보인다.
     */
    track?: (name: string, params?: TrackParams) => void;
};
export type Auth<T> = {
    /** 카카오 SDK 초기화 — 여러 번 불러도 한 번만 한다 */
    initKakao: () => void;
    /** 이 기기에서 실제로 쓸 수 있는 제공자 — **네이티브를 부르지 않는다**(화면이 뜰 때 돈다) */
    availableProviders: () => Provider[];
    /** 카카오톡으로 로그인할 수 있는가 — 안에서 초기화를 먼저 한다 */
    kakaoTalkAvailable: () => Promise<boolean>;
    signIn: (provider: Provider) => Promise<T>;
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
 *    이것 때문에 **취소한 사람에게 오류창**을 띄웠다. OAuth 표준 `access_denied` 도 같다.
 *  - `1001` — 애플·구글 iOS 쪽 취소
 *  - `12501` — 구글 안드로이드 계정 선택 취소
 */
export declare const isCancel: (code: string) => boolean;
export declare function createAuth<T>(deps: AuthDeps<T>): Auth<T>;
