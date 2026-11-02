/**
 * 네이버 영수증 흐름(7차) — **요청만** 쓴다. 영수증 화면을 열거나 단추를 누르거나 막히면 화면 방식으로 되돌아가는 길이 없다(대표님 10-29 09:03).
 * 같은 FlowEvent/FlowOut 규약(naverReceipt.ts)을 따르고, 구동기가 숨은 웹뷰에서 동작을 실행한다.
 *
 *  1) shopping.naver.com/my/order 를 한 번 열어 둔다(같은 출처에서 요청을 부르려고 — 실행당 한 번)
 *  2) GET /my/order/api/npay/order-histories?page=N (대표님 23:12~23:22 요청 형식) 로 최근 1년 주문 목록을 받는다(기존 api 동작)
 *     — 한 주문의 여러 상품 줄은 첫 줄만 올린다(영수증도 적립도 한 주문에 한 번)
 *  3) pay.naver.com/history 를 한 번 열어 둔다(영수증 요청의 출처, 실행당 한 번)
 *  4) 최신 주문부터 RECEIPTS_BATCH 건씩 naverReceiptsScript 가 card-single(B형 · A형) 요청을 몇 건씩 병렬로 부른다
 *  5) 주문마다 결과(가져옴 · 영수증 없음 · 못 가져옴+까닭)를 takeOutcomes 로 알리고, 가져온 영수증은 take 로 낸다
 * 이미 서버에 있는 주문(start.known)은 건너뛰고(영수증 보강된 줄만 — 목록 행은 다시 가져온다), onlyKeys 가 있으면 그 줄들만 가져온다.
 * 막히면(403 · 429) 한 번에 2건 · 하나씩 · 요청 사이를 늘려 이어 가고, 연달아 세 번 막히면 끝낸다. 로그인이 풀리면 로그인 화면을 보이고 풀린 뒤 같은 묶음부터 이어 간다.
 */
import { type FlowOptions, type NaverFlow } from './naverReceipt';
import type { ReceiptDetail } from './model';
import { type ReceiptSlip } from './naverReceiptsScript';
export type ApiFlowOptions = FlowOptions & {
    /** 이 줄들(outcomeKey)만 영수증을 가져온다 — 줄별 「가져오기」용. 목록 행은 서버에 이미 있으니 다시 올리지 않는다 */
    onlyKeys?: string[];
    /** 「영수증 내용 채우기」 — 세부가 빈 카드 줄(「뒤 4자리|날짜」)의 주문만 다시 받는다. 날짜는 하루 차이까지(서버 줄은 결제 날짜, 목록은 주문 날짜) */
    refill?: string[];
    /** 새 네이버페이 수집 길(서버 npv2, 대표님 10-29 16:07~16:09) — 내역 전체 페이지 · 버튼 영수증 주소 · 개별 가져오기에서 내역 줄 찾기 */
    npv2?: boolean;
    /** 서버에 저장된 가장 최근 주문 날짜부터만 읽는다(대표님 11-02) — 앱 흐름(flows.ts)이 켠다 */
    sinceLatest?: boolean;
    /** 읽을 기간(일) — 서버 앱설정(LinkState.readDays). 없으면 LOOKBACK_DAYS(365) */
    windowDays?: number;
};
/** card-single 영수증 한 장의 원문 칸 전부(대표님 14:15) → 세부 칸. 빈 칸은 싣지 않는다 */
export declare const detailOf: (slip: ReceiptSlip) => ReceiptDetail | undefined;
/** 서버가 가린 주문번호(뒤 4자리) + 날짜로 「이미 가져온 주문」을 가린다 — 영수증의 결제 시각 · 금액은 목록의 주문 시각 · 상품 금액과 다를 수 있어 쓰지 않는다 */
export declare const tailOf: (orderNo: string, orderedAt: string) => string;
/** 서버에 저장된 가장 최근 주문의 날짜(YYYY-MM-DD) — 「뒤4자리|날짜」 · 「날짜 시각|금액」에서. 없으면 undefined. 대표님 11-02 「최종 저장된 주문 건 이후 건만」 */
export declare const latestKnownDay: (known?: {
    listKeys?: string[];
    tails?: string[];
}) => string | undefined;
export declare function createNaverApiFlow(opts?: ApiFlowOptions): NaverFlow;
