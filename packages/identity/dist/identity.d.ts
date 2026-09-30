/**
 * 간편인증 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * **이 파일은 앱을 모른다.** 스킴·세션·저장은 앱이 주입한다.
 */
/**
 * 앱이 주는 것.
 *
 * `ret` 는 **서버 화이트리스트와 같아야 한다.** 다르면 인증을 마치고 돌아올 곳이 없어
 * 브라우저가 열린 채 끝난다 — 사용자에게는 「아무 일도 안 일어남」으로 보인다.
 */
export type IdentityDeps = {
    /** 예: `https://api.j-curve.co.kr/v1/kkokkofarm` */
    base: string;
    /** 앱 공개 토큰(`X-App-Token`) */
    appToken: string;
    /** 지금 회원 세션 토큰. 없으면 `null` */
    token: () => string | null;
    /** 복귀 스킴. 예: `kkokkofarm://kiap` */
    ret: string;
    /** 인증이 끝나면 이름·번호를 앱이 간직한다(쿠폰 수신처 등) */
    keep?: (v: {
        name: string;
        phone: string;
        provider: string;
    }) => void | Promise<void>;
    /** 이미 인증한 회원일 때 서버 회원 정보를 읽는다 — 기기를 바꾼 사람을 이어 준다 */
    me?: () => Promise<{
        name?: string;
        phone?: string;
    } | null>;
    /**
     * 흐름. 기본 `init` — 플랫폼 API(로그인한 회원, POST kiap/init → page).
     * `start` — **가입 전**(회원 세션 없음) 자체 서버 흐름(스터디숲): status 가 준 `start` 주소를 `?ret=` 붙여 열고,
     * result 는 세션 없이 1회용 토큰으로 받는다(결과에 signupToken 이 올 수 있다).
     */
    flow?: 'init' | 'start';
};
export type IdentityResult = {
    ok: true;
    name: string;
    phone: string;
    provider: string;
    birth?: string | null;
    signupToken?: string;
} | {
    ok: false;
    reason: string;
};
/** 사유 → 사람이 읽는 말. 모르는 사유도 빈 문자열을 내지 않는다 */
export declare function identityMessage(reason: string): string;
/**
 * 인증 창을 연다 — iOS 는 **ephemeral 세션**으로 연다. 안 그러면 ASWebAuthenticationSession 이
 * 「'앱'이(가) 로그인하려고 합니다」 확인 창을 먼저 띄운다(스터디숲 #303). 쿠키를 남기지 않는 것은 오히려 맞다(본인인증은 한 번).
 */
export declare function openAuth(WebBrowser: {
    openAuthSessionAsync: (url: string, ret: string, opt?: Record<string, unknown>) => Promise<{
        type: string;
        url?: string;
    }>;
}, url: string, ret: string): Promise<{
    type: string;
    url?: string;
}>;
/**
 * 복귀 URL 의 쿼리를 읽는다 — **RN 의 `URLSearchParams` 폴리필을 믿지 않는다.**
 * 기기·판마다 있기도 없기도 해서, 없는 기기에서만 결과를 잃는다.
 */
export declare function parseQuery(url: string): Record<string, string>;
export type Identity = {
    /** 서버에 자격증명이 등록됐는가 — 아니면 화면이 「준비 중」으로 안내한다 */
    enabled: () => Promise<boolean>;
    /** 이 앱에서 켠 인증기관(어드민 앱 관리 체크 ∩ KICA 계약) — 화면에 안내할 때 */
    providers: () => Promise<string[]>;
    /** 인증 실행 — 브라우저를 열고 결과를 회수한다 */
    verify: () => Promise<IdentityResult>;
    /** 복귀 URL 을 결과로 바꾼다 — verify 가 부른다(앱이 딥링크로 따로 받았을 때도 쓸 수 있다) */
    finish: (r: {
        type: string;
        url?: string;
    }) => Promise<IdentityResult>;
};
export declare function createIdentity(deps: IdentityDeps): Identity;
