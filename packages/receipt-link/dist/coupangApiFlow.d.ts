/**
 * 쿠팡 영수증 흐름(8차) — **요청만** 쓴다. 단추 누르기 · 영수증 화면 열기 · 못 찾으면 화면 방식으로 되돌아가기가 없다(대표님 10-29 09:03).
 * 예외(대표님 10-29 17:05 「크롤링 안되면 브라우저 눌러서라도 수집해」 · 11-02 「어떤 방식이든 해결」): 영수증 호스트(payment.coupang.com)가
 * 교차 출처 요청을 받지 않아(모든 요청이 net) 두 묶음 연속 한 건도 못 읽으면, 숨은 웹뷰가 영수증 주소를 **직접 열어**(goto) 화면 글자를 읽는다.
 * 화면을 여는 것은 이 대체 길뿐이고, 단추를 누르거나 사용자 로그인 정보를 앱이 넣는 일은 없다.
 * 같은 FlowEvent/FlowOut 규약(naverReceipt.ts)과 naverApiFlow 의 틀을 따른다. 호스트는 숨은 웹뷰에서 동작을 실행한다.
 *
 *  1) https://mc.coupang.com/ssr/mobile/order/search-by-month 를 한 번 열어 둔다(같은 출처에서 요청을 부르려고 — 실행당 한 번, 대표님 23:44:29 주소)
 *  2) find-over API를 size=10 · pageIndex=0부터 호출하고 hasNext · nextPageIndex 로 넘긴다. orderList 는 이름으로 읽는다(findCoupangOrders)
 *  3) 최신 주문부터 FETCH_BATCH 건씩 GET https://payment.coupang.com/v2/card-receipt/view?orderId=…&vendorIds=…&cancel=false (대표님 23:45:08) 를 몇 건씩 병렬로 부른다
 *  4) 영수증 응답은 JSON 이면 이름으로, 글자(HTML)면 naverReceipt.extractSlip 으로 읽는다. 주문마다 결과(가져옴 · 영수증 없음 · 못 가져옴+까닭)를 takeOutcomes 로 알린다
 *  5) 응답의 키 구조(값 없음)를 structure 로 남긴다 — 이름으로 찾은 칸이 틀렸을 때 다음에 고칠 수 있게(같은 모양은 한 번만)
 * 이미 서버에 있는 주문(start.known)은 건너뛰고, onlyKeys 가 있으면 그 줄들만 가져온다. 막히면(403 · 429) 한 번에 2건 · 하나씩으로 늦추고 연달아 세 번 막히면 끝낸다.
 * 영수증 요청이 모두 net 으로만 돌아오면(교차 출처 거절 의심) 끝난 까닭 「cross-origin」으로 끝낸다 — 줄에 「인터넷이 불안정해요」를 붙이지 않는다.
 *
 * 이름으로 찾는 규칙(응답 모양을 모르니 가정이다 — 코드 위치 findCoupangOrders · readReceiptJson):
 *  - 주문: 키 이름이 orderId · orderNo · orderNumber · orderSeq 같고 값이 10~16자리 숫자인 객체(바깥쪽 것 하나). 날짜 머리글 객체(date · orderDate 같은 키)는 아래 주문이 이어받는다
 *  - 주문 일시: order*At · order*Date · date · createdAt 같은 키(에포크 · ISO · 「2026.10.06」). 날짜만 있으면 00:00:00 을 자리표시로 쓴다
 *  - 금액: totalPayAmount · payAmount · paymentAmount · orderAmount · totalPrice · amount · price 순(숫자 · 「12,300원」)
 *  - 판매자번호(vendorIds): vendor 가 든 키 아래의 「A + 7~10자리 숫자」 값(대표님 23:45:08 의 vendorIds 모양)
 *  - 취소: cancel 이 든 키가 true · 상태 글자에 「취소」
 */
import { type NaverFlow, type Slip } from './naverReceipt';
import { type ApiFlowOptions } from './naverApiFlow';
import { type FetchResult } from './siteFetch';
import type { ReceiptDetail } from './model';
export declare const COUPANG_LIST_URL = "https://mc.coupang.com/ssr/mobile/order/search-by-month";
export declare const COUPANG_LIST_API = "https://mc.coupang.com/ssr/api/myorders/model/find-over";
export declare const COUPANG_RECEIPT_URL = "https://payment.coupang.com/v2/card-receipt/view";
export declare const coupangListUrl: (startDate: string, endDate: string, year: string) => string;
export declare const coupangFindOverUrl: (startDate: string, endDate: string, pageIndex: number) => string;
/** 주문 목록을 이어 받는 최대 쪽 수 */
export declare const COUPANG_MAX_PAGES = 40;
export type CoupangListOrder = {
    orderId: string;
    /** 'YYYY-MM-DD HH:mm:ss'(한국 시각). dateOnly 면 시각 00:00:00 은 자리표시다 */
    at: string;
    dateOnly: boolean;
    amount: number;
    seller?: string;
    title?: string;
    vendorIds: string[];
    cancelled: boolean;
    /** 목록의 주문 상태 · 결제수단 글자(짧은 글자만, 실패 기록용) */
    status?: string;
    pay?: string;
};
/** 값 → 한국 날짜. 「2026.10.06」 · 「2026-10-06」 처럼 날짜만 있으면 dateOnly. 에포크 · ISO · 시각 있는 글자는 normalizeKst */
export declare function parseListDate(v: unknown): {
    at: string;
    dateOnly: boolean;
} | null;
/** 값 → 원 단위 정수(1 ~ 10억). 숫자 · 「12,300원」 */
export declare function parseAmount(v: unknown): number | undefined;
/**
 * __NEXT_DATA__ 등 JSON 안에서 주문을 찾는다(위 「이름으로 찾는 규칙」). 주문번호가 같은 것은 바깥쪽 하나만.
 * 일시 · 금액을 못 찾은 객체는 주문이 아니다(목록 행을 만들 수 없다).
 */
export declare function findCoupangOrders(root: unknown): CoupangListOrder[];
/**
 * 다음 쪽 주소 — nextUrl · nextPageUrl · nextLink 처럼 이름이 다음 쪽 주소인 칸의 값(https 쿠팡 주소 또는 /ssr/ 경로)만 쓴다. 주소를 지어내지 않는다.
 * more: 다음 쪽이 있다는 표시(hasNext · hasMore · isLast=false 등)는 있는데 주소를 못 찾았다.
 */
export declare function nextListPage(root: unknown): {
    url: string | null;
    more: boolean;
};
/** 쿠팡 카드영수증 주소 — 대표님 23:45:08 형식(orderId · vendorIds · cancel=false). 값 모양이 틀리면 null */
export declare function receiptUrl(orderId: string, vendorIds: readonly string[]): string | null;
/** none 은 영수증이 없는 결제. cancelled 가 붙으면 취소된 주문(「취소된 주문」 줄 · 서버에 none 행을 남기지 않는다) */
export type ReceiptRead = {
    kind: 'slip';
    slip: Slip;
    seller?: string;
    detail?: ReceiptDetail;
} | {
    kind: 'none';
    cancelled?: true;
} | {
    kind: 'bad';
};
/** 영수증 JSON 에서 이름으로 칸을 찾는다. 사업자번호 · 승인번호 · 결제 일시 · 금액 중 셋이 안 되면 null (extractSlip 과 같은 기준) */
export declare function readReceiptJson(data: unknown): ReceiptRead;
/**
 * 글자 영수증의 상호 — 웹뷰 스크립트가 HTML 의 태그를 걷으며 줄바꿈을 공백 하나로 합치므로 extractSlip 의 「상호 …」 읽기가 뒤 라벨(사업자등록번호 · 카드사 · 승인일시 …)까지 삼킨다.
 * 첫 라벨 앞에서 자르고, 남는 게 없으면 undefined(그러면 목록의 판매자를 쓴다).
 */
export declare function cleanMerchant(raw: string | undefined): string | undefined;
/** 영수증 응답 → 읽은 것. data 가 있으면 JSON 으로, 아니면 text 가 JSON 모양이면 파싱, 아니면 글자에서(extractSlip). 취소 · 영수증 없음 글자는 none */
export declare function readReceipt(r: FetchResult): ReceiptRead;
export declare function badWords(text: string | undefined): string;
export declare function badKey(text: string | undefined): string;
/** 응답이 글자(HTML)일 때 구조 기록용 요약 줄 — 값 없이 라벨 유무 · 길이 단계만(영문) */
export declare function textSummaryLines(text: string): string[];
export declare function createCoupangApiFlow(opts?: ApiFlowOptions): NaverFlow;
