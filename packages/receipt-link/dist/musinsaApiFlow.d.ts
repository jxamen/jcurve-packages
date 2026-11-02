/**
 * 무신사 영수증 흐름(8차) — **요청만** 쓴다. 영수증 화면을 열거나 단추를 누르거나 막히면 화면 방식으로 되돌아가는 길이 없다(대표님 10-29 09:03).
 * 예외(대표님 10-29 17:05 「크롤링 안되면 브라우저 눌러서라도 수집해」 · 11-02 「어떤 방식이든 해결」): 매출전표 호스트(pay.musinsapayments.com)가
 * 교차 출처 요청을 받지 않아(모든 요청이 net) 두 묶음 연속 한 건도 못 읽으면, 숨은 웹뷰가 매출전표 주소를 **직접 열어**(goto) 화면 글자를 읽는다.
 * 화면을 여는 것은 이 대체 길뿐이고, 단추를 누르거나 사용자 로그인 정보를 앱이 넣는 일은 없다.
 * 같은 FlowEvent/FlowOut 규약(naverReceipt.ts)을 따르고, 구동기가 숨은 웹뷰 안에서 범용 요청 동작(fetch, siteFetch.ts)을 실행한다.
 *
 *  1) https://www.musinsa.com/order/order-list 를 한 번 열어 둔다(같은 출처에서 요청을 부르려고 — 실행당 한 번)
 *  2) 주문 목록: GET https://api.musinsa.com/api2/claim/store/mypage/integration/order?size=15&searchText=&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *     (대표님 10-28 23:51 요청의 쿼리 키 네 개 그대로). 최근 1년을 91일 구간으로 나눠 최신 구간부터 받고, 한 구간이 size(15)건으로 가득 차면
 *     그 구간을 반으로 나눠 다시 받는다 — 쪽 번호 같은 모르는 파라미터를 만들지 않으려고 날짜 구간만으로 모두 받는다(하루 구간이 가득 차면 거기까지).
 *  3) 매출전표: GET https://pay.musinsapayments.com/mps/receipt/{주문번호}?paymentKey=…&merchantCode=…&tid=… (23:52 요청 그대로)
 *     최신 주문부터 FETCH_BATCH 건씩 몇 건씩 병렬로 부른다.
 *  4) 주문마다 결과(가져옴 · 영수증 없음 · 못 가져옴+까닭)를 takeOutcomes 로 알리고, 가져온 영수증은 take 로 낸다.
 * 이미 서버에 있는 주문(start.known)은 건너뛰고(영수증 보강된 줄만 — 목록 행은 다시 가져온다), onlyKeys 가 있으면 그 줄들만 가져온다.
 * 막히면(403 · 429) 한 번에 2건 · 하나씩 · 요청 사이를 늘려 이어 가고, 연달아 세 번 막히면 끝낸다. 로그인이 풀리면 로그인 화면을 보이고 풀린 뒤 같은 곳부터 이어 간다.
 *
 * ── 응답 모양은 원문에 없다 → 이름으로 찾아 바로 쓰고, 동시에 키 구조(값 없음)를 {type:'structure'} 로 남긴다(맞는지 · 틀린지 다음 확인용). 찾는 규칙(추정):
 *  · 주문 배열: 응답 JSON 안에서 「원소에 주문번호(숫자 12~24자리)가 든 객체」의 배열 중 가장 얕은(깊이) 것, 같은 깊이면 가장 긴 것
 *  · 원소의 칸은 이름으로(너비 우선, 깊이 5까지): 주문번호 orderNo · ordNo · orderNumber · ord_no ⋯ / 주문 일시 orderDate · orderDt ⋯ → paymentDate · regDate ⋯ /
 *    금액 finalPaymentAmount · paymentAmount ⋯ → totalAmount · orderAmount ⋯ / 상품명 goodsName · productName ⋯ / 영수증 값 paymentKey · tid · merchantCode
 *  · merchantCode 가 없으면 대표님 원문(5글자)과 옛 확인(STORE)에 맞춰 STORE 를 쓴다
 *  · 영수증이 없는 결제: 목록 원소의 취소 · 반품 · 환불 상태, 또는 결제수단 이름이 포인트 · 계좌 · 무통장 · 가상계좌 · 머니(카드 아님)이면 요청 없이 「영수증 없음」,
 *    paymentKey · tid 가 없고 결제수단도 모르면 「영수증 주소를 못 찾았어요」, 매출전표 요청이 404 · 410 이면 「영수증 없음」
 *  · 매출전표 응답은 JSON 이면 이름으로(approvalNo · businessNo · approvalDateTime · approvalAmount ⋯), HTML 이면 태그를 걷은 글자에서 extractSlip 으로 읽는다
 * 끝난 까닭 코드: all-rows · login · blocked · list-failed · list-shape(목록은 왔는데 주문으로 읽은 게 없음) · cross-origin(매출전표 호스트로 가는 요청이 모두 실패) ·
 *  timeout · timeouts · max-steps · budget · shop-lost · unexpected-event
 */
import { type NaverFlow, type Slip } from './naverReceipt';
import { type ApiFlowOptions } from './naverApiFlow';
import { type FetchResult } from './siteFetch';
export declare const MUSINSA_ORDER_LIST_URL = "https://www.musinsa.com/order/order-list";
export declare const MUSINSA_LIST_API = "https://api.musinsa.com/api2/claim/store/mypage/integration/order";
export declare const MUSINSA_RECEIPT_BASE = "https://pay.musinsapayments.com/mps/receipt/";
export declare const MUSINSA_RECEIPT_ORIGIN = "https://pay.musinsapayments.com/";
export declare const musinsaDetailUrl: (orderNo: string) => string;
type Raw = Record<string, unknown>;
/** root 아래(너비 우선, maxDepth 까지)에서 이름이 patterns[i] 에 맞고 값이 ok 인 첫 것. patterns 앞쪽이 우선이다 */
export declare function findKey(root: unknown, patterns: readonly RegExp[], ok: (v: unknown) => boolean, maxDepth?: number): unknown;
export type ParsedOrder = {
    orderNo: string;
    orderedAt: string;
    amount: number;
    title?: string;
    seller?: string;
    pay?: {
        paymentKey: string;
        tid: string;
        merchantCode: string;
    };
    method?: string;
    cancelled: boolean;
    /** 옵션 일부만 반품 · 취소(나머지는 구매 확정) */
    mixed?: boolean;
};
export declare function readMusinsaDetail(json: unknown): NonNullable<ParsedOrder['pay']> | null;
export declare function musinsaNextOffsets(json: unknown): {
    onlineOffset?: string;
    offlineOffset?: string;
} | null;
/** 응답 JSON 안의 주문 배열을 찾는다 — 규칙은 파일 머리말 */
export declare function findOrderRows(json: unknown): Raw[];
/** 상태 기록 한 줄(날짜 · 금액 같은 값 없이): 결제 키 있음/없음 · 옵션별 orderState/claimState/childOrderState/상태 글자 · 판정 */
export declare function musinsaStatusLine(e: Raw, p: ParsedOrder): string;
export declare function parseOrderRow(e: Raw): ParsedOrder | null;
/** 매출전표 JSON → Slip(이름으로 찾기, 네 칸 중 셋 이상이면 영수증) */
export declare function slipFromJson(json: unknown): Slip | null;
/** 매출전표 응답(JSON 이면 이름으로, 아니면 글자에서 extractSlip) → Slip */
/**
 * 무신사페이 매출전표 HTML(대표님 11-02 원문) — receipt-detail__definition / description 짝. 태그 · 주석을 걷어 낸 글자에서 이름으로 읽는다
 * (요청으로 받은 HTML 이든 웹뷰가 연 화면 글자든 같은 글자가 남는다). 결제일시 줄은 주석이라 「승인 YYYY-MM-DD HH:mm:ss」 를 쓴다
 */
export declare function slipFromMusinsaText(raw: string): Slip | null;
export declare function slipOf(r: FetchResult): Slip | null;
/**
 * extractSlip 의 상호(판매자상호 · 상호 · 판매처)는 한 줄 안의 글자를 읽는데, 웹뷰 스크립트(siteFetchScript)가 HTML 의 줄바꿈을 공백으로 접어 한 줄이 되므로
 * 뒤 칸 글자(사업자등록번호 · 카드사 · 승인번호 …)까지 끌려온다(통합 시험에서 확인) — 다음 칸 이름 앞에서 자른다. 남는 글자가 없으면 없음
 */
export declare const cleanMerchant: (m: string | undefined) => string | undefined;
export declare function createMusinsaApiFlow(opts?: ApiFlowOptions): NaverFlow;
export {};
