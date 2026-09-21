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
};
export type IdentityResult = {
    ok: true;
    name: string;
    phone: string;
    provider: string;
} | {
    ok: false;
    reason: string;
};
/** 사유 → 사람이 읽는 말. 모르는 사유도 빈 문자열을 내지 않는다 */
export declare function identityMessage(reason: string): string;
/**
 * 복귀 URL 의 쿼리를 읽는다 — **RN 의 `URLSearchParams` 폴리필을 믿지 않는다.**
 * 기기·판마다 있기도 없기도 해서, 없는 기기에서만 결과를 잃는다.
 */
export declare function parseQuery(url: string): Record<string, string>;
export type Identity = {
    /** 서버에 자격증명이 등록됐는가 — 아니면 화면이 「준비 중」으로 안내한다 */
    enabled: () => Promise<boolean>;
    /** 인증 실행 — 브라우저를 열고 결과를 회수한다 */
    verify: () => Promise<IdentityResult>;
};
export declare function createIdentity(deps: IdentityDeps): Identity;
