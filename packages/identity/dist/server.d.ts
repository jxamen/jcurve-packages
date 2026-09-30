export declare const KIAP_HOST: {
    readonly dev: "https://kiapdev.signgate.com";
    readonly prod: "https://kiap.signgate.com";
};
/** 인증 페이지 응답 머리글 — Referrer-Policy 가 no-referrer 면 KICA iframe 이 부른 쪽 도메인을 못 봐 E4108 */
export declare const PAGE_HEADERS: {
    readonly 'Content-Type': "text/html; charset=utf-8";
    readonly 'Cache-Control': "no-store";
    readonly 'Referrer-Policy': "strict-origin-when-cross-origin";
};
/** 흔한 사유 코드 — 복귀 주소의 `reason` 과 서버 로그에 쓰는 이름(앱 쪽 identityMessage 와 같은 목록) */
export declare const REASONS: readonly ["CANCELED", "CONFIG_MISSING", "SESSION_USED", "SESSION_EXPIRED", "RATE_LIMITED", "CALLBACK_FIELDS_MISSING", "PROVIDER_NOT_ALLOWED", "RESULT_BINDING_MISMATCH", "DECRYPT_FAILED", "CI_MISSING", "DUPLICATE_CI", "RACE_BLOCKED", "KIAP_TIMEOUT", "KIAP_BADJSON", "KIAP_HTTP_<상태>", "KIAP_<KICA 코드>"];
/** 응답 칸 복호화 — AES-CBC/PKCS5, 키 = base64(auth_token)(16·24·32바이트), IV 고정. 실패 · 빈 값은 '' */
export declare function kiapDecrypt(enc: unknown, authToken: string): string;
export declare const normName: (s: string) => string;
export declare function normPhone(s: string): string;
/**
 * CI 꺼내기 — 칸 이름이 다르고(ci · CI · connInfo · conn_info) 원문(88자 base64)으로 올 수도 있다.
 * 원문을 복호화하면 드물게 「성공」하며 깨진 글자가 나와 **읽을 수 있는 글자일 때만** 복호화 값을 쓴다.
 * CI 가 없으면 `dev`(테스트 키 · 개발 주소)일 때만 번호로 대신한다 — 운영은 빈 값(호출한 쪽이 CI_MISSING).
 */
export declare function extractCi(d: Record<string, unknown>, authToken: string, opt: {
    dev: boolean;
    phone: string;
}): {
    ci: string;
    from: 'dec' | 'raw' | 'dev' | 'none';
    key: string | null;
};
/** 생년월일 — YYYYMMDD · YYYY-MM-DD 모두 받아 YYYY-MM-DD, 모양이 아니면 null */
export declare function extractBirth(d: Record<string, unknown>, authToken: string): string | null;
/** CI 검색 해시 — HMAC-SHA256 base64url. 키는 앱 서버가 가진 비밀(바꾸면 기존 해시가 모두 무효) */
export declare const ciHash: (ci: string, key: Buffer | string) => string;
/** getResult — Bearer 는 콜백 form 의 **동적** access_token(콘솔의 고정 토큰이면 401) */
export declare function kiapResult(host: string, dynToken: string, ids: {
    provider_id: string;
    client_tx_id: string;
    server_tx_id: string;
}, timeoutMs?: number): Promise<{
    ok: true;
    data: Record<string, unknown>;
} | {
    ok: false;
    error: string;
}>;
export type Verified = {
    ok: true;
    name: string;
    phone: string;
    birth: string | null;
    ci: string;
    ciFrom: string;
    provider: string;
    fields: string[];
};
/**
 * 콜백 판정 ①②③ — ① KICA 결과 코드 ② getResult + 이 거래 · 이 기관 · AUTH 인지 ③ 복호화 · CI.
 * ④ 1인 1계정(CI 해시 대조)과 세션 · 가입은 앱 서버가 한다. 실패는 사유 코드만(값은 밖으로 내지 않는다).
 * `form` 은 KICA 가 콜백에 form POST 로 준 값 그대로.
 */
export declare function verifyCallback(form: Record<string, string>, cfg: {
    host: string;
}): Promise<Verified | {
    ok: false;
    reason: string;
}>;
/**
 * 인증 페이지 · 콜백 · SDK 의 공개 주소 — KICA 는 **허용 도메인**에서만 창을 띄운다.
 * `KIAP_PUBLIC_BASE` 가 있으면 그 주소, 없으면 요청이 들어온 주소(프록시 머리글 x-forwarded-* 존중) + `suffix`.
 */
export declare function publicBase(req: {
    url: string;
    headers: {
        get(k: string): string | null;
    };
} | null, env?: string | undefined, suffix?: string): string | null;
/** 복귀 주소에 쿼리를 붙인다 */
export declare const withQuery: (ret: string, q: Record<string, string | number>) => string;
/** 앱으로 돌려보내는 작은 페이지 — 콜백은 KICA iframe 안이라 top 을 옮긴다 */
export declare const backPageHtml: (url: string) => string;
/**
 * 인증 시작 페이지 HTML — 응답 머리글은 PAGE_HEADERS 를 쓴다.
 * `providers` 가 하나면 우리 화면 없이 그 기관으로 바로 열고, 여럿이면 켠 것만 버튼으로 보이며 누르면 default_provider 로 넘긴다.
 * 비우면 KICA 창의 목록 하나로 연다. 오류는 코드와 함께 화면에(조용히 삼키지 않는다).
 */
export declare function startPageHtml(o: {
    title: string;
    host: string;
    clientId: string;
    accessToken: string;
    sdkUrl: string;
    callbackUrl: string;
    cancelUrl: string;
    providers?: {
        code: string;
        label: string;
    }[];
    lead?: string;
}): string;
