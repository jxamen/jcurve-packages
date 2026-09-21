/**
 * 번호 인증 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * 이 파일은 **앱도 화면도 모른다.** 주소와 헤더를 받아 서버를 부르고, 화면이 그릴 값만 돌려준다.
 * 그래서 앱마다 다른 디자인을 그대로 둘 수 있다.
 */
/** 인증번호 자릿수 — 서버가 정한 값이다. 화면의 `maxLength` 도 이것을 쓴다 */
export declare const CODE_LEN = 6;
/** 서버가 돌려주는 오류 코드 — 여기 없는 값은 `unknown` 으로 다룬다 */
export type PhoneError = 'phone_taken' | 'signup_required' | 'sms_off' | 'bad_phone' | 'too_soon' | 'too_many' | 'daily_max' | 'expired' | 'not_sent' | 'wrong' | 'network' | 'unknown';
export type PhoneStatus = {
    /** 확인이 끝난 번호. 없으면 빈 문자열 */
    phone: string;
    verified: boolean;
    /**
     * 서버가 문자를 보낼 수 있는 상태인가.
     *
     * **false 면 인증 화면을 아예 열지 않는다.** 열어 봐야 문자가 안 가고, 꼬꼬농장에서
     * 「인증 문자가 안 와요」 리뷰가 달린 전례가 있다.
     */
    smsReady: boolean;
};
export type SendResult = {
    ok: true;
    ttlMs: number;
    leftToday: number;
} | {
    ok: false;
    error: PhoneError;
    waitMs?: number;
};
export type VerifyResult = {
    ok: true;
    phone: string;
} | {
    ok: false;
    error: PhoneError;
    left?: number;
};
/** 숫자만 남긴다 — 서버로는 항상 이 모양으로 보낸다 */
export declare const digits: (v: string) => string;
/** 010-1234-5678 로 보이게만 한다. 값은 숫자만 들고 다닌다 */
export declare function format(v: string): string;
/**
 * 보낼 수 있는 번호인가 — **서버와 같은 규칙**이어야 한다.
 *
 * 화면이 더 느슨하면 서버가 `bad_phone` 으로 거절하고, 더 빡빡하면 멀쩡한 번호를 못 넣는다.
 * 둘 다 「왜 안 되지」가 되고, 그때 사람은 번호를 의심한다.
 */
export declare const looksValid: (v: string) => boolean;
export declare const codeLooksValid: (v: string) => boolean;
/**
 * 오류 → 사람이 읽는 말.
 *
 * **무엇을 하면 되는지까지 적는다.** 「실패했어요」로 끝내면 그 사람이 할 수 있는 일이 없다.
 * 앱마다 다시 쓰면 같은 오류가 앱마다 다른 말로 나와서, 문의가 오면 어느 앱인지부터 묻게 된다.
 */
export declare function message(error: PhoneError | string, extra?: {
    waitMs?: number;
    left?: number;
}): string;
/**
 * 틀린 뒤 처음부터 다시 받아야 하는가.
 *
 * 시간이 지났거나 다섯 번 다 틀리면 **서버가 그 코드를 버린다.** 화면이 그대로 두면
 * 이미 없는 코드에 계속 숫자를 넣게 된다.
 */
export declare const needsResend: (error: PhoneError | string) => boolean;
export type PhoneDeps = {
    /** 예: `https://api.j-curve.co.kr/v1/kkokkofarm` */
    base: string;
    /**
     * 요청마다 헤더를 만든다 — 세션 토큰이 바뀌므로 **값이 아니라 함수로 받는다.**
     * 로그인 전이라 보낼 수 없으면 `null` 을 주면 된다(그때는 부르지 않는다).
     */
    headers: () => Record<string, string> | null;
    /** 밀리초. 기본 8초 */
    timeoutMs?: number;
};
export type Phone = {
    /** 지금 상태 — 화면이 「인증하기」를 띄울지 정한다. 못 읽으면 `null` */
    status: () => Promise<PhoneStatus | null>;
    send: (phone: string) => Promise<SendResult>;
    verify: (phone: string, code: string) => Promise<VerifyResult>;
};
export declare function createPhone(deps: PhoneDeps): Phone;
