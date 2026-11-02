/**
 * 컬리 영수증 흐름(8차) — **요청만** 쓴다. 영수증 화면을 열거나 단추를 누르거나 막히면 화면 방식으로 되돌아가는 길이 없다(대표님 10-29 09:03).
 * 예외(대표님 10-29 17:05 「크롤링 안되면 브라우저 눌러서라도 수집해」 · 11-02 「어떤 방식이든 해결」): 영수증 호스트(pg.kurlypay.co.kr)가
 * 교차 출처 요청을 받지 않아(모든 요청이 net) 두 묶음 연속 한 건도 못 읽으면, 숨은 웹뷰가 영수증 주소를 **직접 열어**(goto) 화면 글자(JSON 본문)를 읽는다.
 * 화면을 여는 것은 이 대체 길뿐이고, 단추를 누르거나 사용자 로그인 정보를 앱이 넣는 일은 없다.
 * 같은 FlowEvent/FlowOut 규약(naverReceipt.ts)을 따르고 구동기가 숨은 웹뷰에서 범용 요청(fetch 동작, siteFetch.ts)을 실행한다.
 * 쿠키 · 토큰 · 주소 · 영수증 내용 값은 이 파일 어디에도 없다 — 대표님 10-28 23:46~23:50 원문의 요청 모양과 응답 키 이름만 쓴다.
 *
 *  1) https://www.kurly.com/mypage/order 를 한 번 열어 둔다(요청을 부를 출처 페이지 — 실행당 한 번, 로그인이 풀렸으면 로그인 화면)
 *  2) 목록  POST https://api.kurly.com/order-external/v4/mypage/orders   본문 {startDate, endDate, page, limit:10, productName:"", address, addressDetail}   (23:46:23)
 *     — address · addressDetail 은 대표님 배송지라 앱이 모른다 → 먼저 빈 값으로 보내고, 4xx 로 거절되면 컬리 페이지(__NEXT_DATA__)에서 기본 배송지 값을 이름으로 찾아 한 번 다시 보낸다
 *  3) 상세  POST https://api.kurly.com/order-external/v3/mypage/orders/{주문번호}   본문 {address, addressDetail}   (23:47:51) — 영수증 요청의 encreq 를 얻는다
 *  4) 영수증 GET https://pg.kurlypay.co.kr/api/payments/receipt/request/card?encreq=…   (23:50:20, 응답 JSON 키는 원문 그대로 매핑)
 *  5) 결제수단이 네이버페이인 주문은 영수증이 따로 없다(23:48:03) → 실패가 아니라 「영수증 없음」
 * 최신 주문부터 FETCH_BATCH 건씩 상세 → 영수증 두 번에 나눠 부르고, 주문마다 결과를 takeOutcomes 로 알린다. 이미 서버에 영수증까지 있는 주문(start.known)은 건너뛰고 onlyKeys 면 그 줄만.
 * 막히면(403 · 429) 한 번에 2건 · 하나씩 · 요청 사이를 늘리고 연달아 세 번이면 끝낸다. 모든 요청이 net 으로만 끝나면(교차 출처 거절) 'cross-origin' 으로 끝낸다.
 *
 * 응답 모양을 모르는 칸(목록 · 상세)은 **이름으로 찾는다**(아래 규칙) — 틀리면 줄에 까닭이 뜨고, 같은 응답의 키 구조(값 없음)를 structure 로 한 번씩 남긴다.
 *   목록 줄    : 값이 13자리 숫자인 칸이 든 객체들의 배열 중 가장 많은 것(컬리 주문번호는 13자리). 그 줄의 주문번호 = 13자리 값(키 이름에 order 가 든 것 먼저)
 *   주문 일시  : 키 이름이 (order|regist|reg|create)…(date|time|dt|at) 인 칸 먼저, 없으면 date|time|dt|at 인 칸. 날짜만 있으면 00:00:00
 *   금액       : 키 이름 점수 — final|payment|pay +3 · total +2 · price|amount|money +1 이 가장 높은 양수
 *   상품명     : 키 이름이 (product|goods|item|order)…(name|title) 인 글자, 없으면 name|title(수령인 · 주소 이름은 뺀다)
 *   취소       : 키 이름이 status|state 인 칸의 값에 「취소」 · cancel 이 있으면 취소 주문 → 영수증 없음으로 센다
 *   네이버페이 : 상세 응답 어디든 글자 값에 「네이버페이」 · NAVER_PAY · NPAY 가 있으면
 *   encreq     : 키 이름이 encreq 인 글자, 없으면 값에 「encreq=」가 든 글자에서 꺼낸다
 *   기본 배송지: address|addr|baseAddress|roadAddress 글자 + addressDetail|detailAddress|addrDetail 글자
 */
import { type NaverFlow, type ReceiptOrder, type Slip } from './naverReceipt';
import { type ApiFlowOptions } from './naverApiFlow';
import type { ReceiptDetail } from './model';
export declare const KURLY_LIST_URL = "https://www.kurly.com/mypage/order";
export declare const KURLY_ORDERS_URL = "https://api.kurly.com/order-external/v4/mypage/orders";
export declare const KURLY_ADDRESS_URL = "https://api.kurly.com/addressbook/v1/cart/check-base-address-notification";
export declare const kurlyDetailUrl: (orderNo: string) => string;
export declare const KURLY_RECEIPT_URL = "https://pg.kurlypay.co.kr/api/payments/receipt/request/card";
/** 목록 응답 → 주문 줄 배열(13자리 값이 든 객체가 가장 많은 배열). 없으면 [] */
export declare function findOrderRows(json: unknown): Record<string, unknown>[];
/** 값이 든 객체 배열이 하나라도 있는가 — 주문번호 모양을 못 찾았는데 목록이 있는 응답(모양 못 읽음)과 정말 빈 응답을 가른다 */
export declare function hasFilledArray(json: unknown): boolean;
/** 목록 줄 하나 → 목록 주문(kind list). 주문번호 · 일시 · 금액 중 하나라도 못 찾으면 null */
export declare function kurlyRowToOrder(row: Record<string, unknown>): {
    order: ReceiptOrder;
    cancelled: boolean;
} | null;
/** 상세 응답 → 네이버페이 여부 · 영수증 요청 값(encreq). 어디든 이름으로 찾는다 */
export declare function readKurlyDetail(json: unknown): {
    npay: boolean;
    method: string;
    encreq?: string;
};
/** 영수증 요청 값 → 요청 주소. 이미 퍼센트 부호가 든 값은 그대로, 아니면 부호를 붙인다(base64 의 + / =) */
export declare const kurlyReceiptUrl: (encreq: string) => string | null;
/** 응답 어디든 기본 배송지(주소 + 상세 주소)를 이름으로 찾는다 — 주소만 있고 상세가 없으면 상세는 빈 글자 */
export declare function findDefaultAddress(json: unknown): {
    address: string;
    addressDetail: string;
} | null;
/** 영수증 응답(컬리페이 JSON, 대표님 23:50:20 키 그대로) → 매출전표 칸. 승인번호(CARD_APP_NO)가 든 객체를 찾아 쓴다 */
export type KurlySlip = {
    slip: Slip;
    seller?: string;
    title?: string;
    cancelled: boolean;
    detail?: ReceiptDetail;
};
export declare function kurlySlip(json: unknown): KurlySlip | null;
export declare function kurlyReceiptData(text: string): unknown;
export declare function createKurlyApiFlow(opts?: ApiFlowOptions): NaverFlow;
