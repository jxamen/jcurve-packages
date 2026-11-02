/**
 * 영수증 가져오기 줄별 결과 — 흐름(naverReceipt)이 주문 하나마다 알리고, 주문 시트(ReceiptOrdersSheet)가 줄 오른쪽 글자로 쓴다.
 * react-native 를 import 하지 않는다(노드에서 시험한다). 값(쿠키 · 토큰 · 영수증 내용)은 이 파일 어디에도 없다.
 *
 * 줄 잇는 법: 흐름은 16자리 주문번호를 알고, 서버 목록은 앞자리를 별(*)로 가린 주문번호(뒤 4자리만 보임)를 준다.
 * 그래서 두 쪽이 같은 키 「뒤4자리|주문일시(분까지)|금액」 을 만든다(outcomeKey). 주문일시는 한국 시각 「YYYY-MM-DD HH:mm」.
 */
/** 못 가져온 까닭 — 줄에 쉬운 말로 보인다(failText). 영수증이 아예 없는 결제는 실패가 아니라 따로 센다(Outcome none) */
export type FailCode = 'login' | 'blocked' | 'no-pair' | 'not-in-history' | 'unreadable' | 'network' | 'stopped';
/** 줄 하나의 가져오기 결과 */
export type Outcome = {
    state: 'fetching';
} | {
    state: 'done';
} | {
    state: 'none';
    why?: 'cancelled';
} | {
    state: 'failed';
    code: FailCode;
};
/** 흐름이 주문 하나의 결과를 알릴 때 쓰는 한 건 */
export type OutcomeEvent = {
    key: string;
    outcome: Outcome;
};
/** 서버 목록 줄과 흐름의 주문을 잇는 키 — orderNo 는 16자리 그대로이거나 앞이 가려진 값(뒤 4자리만 쓴다), orderedAt 은 「YYYY-MM-DD HH:mm…」(앞 16자만 쓴다) */
export declare const outcomeKey: (orderNo: string, orderedAt: string, amount: number) => string;
/** 못 가져옴 줄의 까닭 글자(영문 코드 · 번호는 넣지 않는다) */
export declare const failText: (code: FailCode) => string;
/** 「영수증 없음」 줄의 안내 글자 */
export declare const NONE_TEXT = "\uC601\uC218\uC99D\uC774 \uC5C6\uB294 \uACB0\uC81C\uC608\uC694";
/** 취소된 주문 줄의 안내 글자 */
export declare const CANCELLED_TEXT = "\uCDE8\uC18C\uB41C \uC8FC\uBB38\uC774\uB77C \uC801\uB9BD \uB300\uC0C1\uC774 \uC544\uB2C8\uC5D0\uC694";
/** 줄 오른쪽 큰 글자 — 실패는 「못 가져옴」, 영수증이 없는 결제는 「영수증 없음」, 취소된 주문은 「취소된 주문」 */
export declare const outcomeLabel: (o: Outcome) => string;
/** 줄 오른쪽 작은 까닭 글자 */
export declare const outcomeReason: (o: Outcome) => string;
