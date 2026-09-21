/**
 * 현금 인출 — 모은 포인트를 **계좌로 받는다**(2026-09-17 지시).
 *
 * 기프티콘 교환과 다르다. 저쪽은 상품이 정해져 있어 금액을 고를 일이 없지만, 이쪽은
 * 사람이 금액을 직접 적는다 — **적은 숫자가 곧 나가는 돈**이라 여기서 막지 못하면
 * 서버가 막아야 하고, 둘 다 못 막으면 돈이 잘못 나간다.
 *
 * 규칙(어드민 「앱 설정」이 값을 정한다):
 *  - 1,000원 단위로만 (`unit`)
 *  - 한 번에 50,000원까지 (`max`)
 *  - 최소 1,000원 (`min`)
 *  - 가진 포인트보다 많이 못 뺀다 (1P = 1원)
 *
 * **게스트는 신청할 수 없다.** 받는 사람을 확인할 수 없는 계정으로 현금이 나가면 되돌릴 수
 * 없다 — 기프티콘도 같은 이유로 막아 두었다(서버가 403 `signup_required`).
 *
 * 순수 함수다. 화면은 이 결과를 그리기만 하고, 진짜 판정은 서버가 한 번 더 한다.
 */
/** 어드민이 정하는 금액 규칙 */
export type CashRules = {
    /** 최소 금액(원) */
    min: number;
    /** 한 번에 뺄 수 있는 최대(원) */
    max: number;
    /** 이 단위로만 — 1000 이면 1,000원 단위 */
    unit: number;
};
export declare const DEFAULT_CASH: CashRules;
/** 무엇이 잘못됐나 — 화면이 사유별로 다르게 말할 수 있게 코드로 준다 */
export type CashProblem = 'empty' | 'not_number' | 'unit' | 'min' | 'max' | 'balance';
export type CashCheck = {
    ok: true;
    amount: number;
} | {
    ok: false;
    problem: CashProblem;
};
/**
 * 적은 금액이 나갈 수 있는 금액인가.
 *
 * 순서가 중요하다 — 「50,500원」은 단위도 틀리고 한도도 넘지만, **단위**를 먼저 말해 줘야
 * 사람이 고칠 수 있다. 한도부터 말하면 5만 원으로 줄였다가 또 단위로 걸린다.
 */
export declare function checkCash(input: string, balance: number, rules?: CashRules): CashCheck;
/**
 * 고를 수 있는 금액들 — **가진 포인트 안에서만**(2026-09-17 지시).
 *
 * 전에는 숫자를 직접 적게 했다. 그러다 보니 74P 를 가진 사람에게도 숫자판이 열렸고,
 * 다 적고 누른 뒤에야 「가진 포인트보다 많아요」를 봤다. 애초에 못 고르게 하면
 * 틀릴 일이 없다 — 나갈 수 있는 금액만 목록에 올린다.
 *
 * 모자라면 **빈 배열**이다. 화면은 그때 목록 대신 「얼마가 더 필요한지」를 말한다.
 */
export declare function amountChoices(balance: number, rules?: CashRules): number[];
/** 사유를 사람 말로 */
export declare function sayCashProblem(p: CashProblem, rules?: CashRules): string;
/**
 * 계좌번호 — 숫자와 하이픈만 남긴다.
 * 은행마다 자릿수가 달라서 길이는 재지 않는다. 대신 **너무 짧으면** 오타다.
 */
export declare function cleanAccount(v: string): string;
/** 계좌번호로 볼 만한가 — 숫자만 세서 판단한다 */
export declare function accountLooksOk(v: string): boolean;
/** 이름 — 앞뒤 공백만 걷어낸다. 예금주는 은행이 대조하므로 우리가 모양을 따지지 않는다 */
export declare function cleanName(v: string): string;
/**
 * 휴대폰 번호 — 숫자만 남기고 11자리까지.
 * 인증은 서버가 한다. 여기서는 **적어 넣을 수 있는 모양**인지만 본다.
 */
export declare function cleanPhone(v: string): string;
export declare function phoneLooksOk(v: string): boolean;
/** 신청에 필요한 것이 다 찼나 — 버튼을 켤지 정한다 */
export declare function cashFormReady(f: {
    name: string;
    bank: string;
    account: string;
    amount: string;
}, balance: number, rules?: CashRules): boolean;
