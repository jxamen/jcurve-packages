/**
 * 다이소 영수증 흐름 — 다이소몰 온라인 주문 + 매장 전자영수증. **요청만** 쓴다(클릭 · 로그인 정보 입력 없음).
 * 서버 크롬 실측(tools/crawl-test presets.json `_version` 21 · src/flow.cjs, 2026-11-05 대표님 15:45 「다이소 · 올리브영도 수집」) 순서 그대로:
 *  1) https://www.daisomall.co.kr/ 를 한 번 연다(요청 출처 페이지 — 실행당 한 번). 로그인 화면(/mb/mbb/SCR_MBB_0097A)이면 로그인
 *  2) 온라인 목록  POST https://fapi.daisomall.co.kr/or/orb/selOr   {strtDt 오늘-1년 · endDt 오늘 · currentPage p · pageSize 15} — 빈 data[] 또는 받은 수 ≥ 첫 줄 totalCnt 까지
 *     취소(orCnclDtm 있음 · orStsCdNm 에 취소 · orderProd 전부 cnclSeCd)는 뺀다(대표님 「취소는 빼기」)
 *  3) 온라인 상세  POST https://fapi.daisomall.co.kr/or/orb/orDts/selOrDtl   {orNo} — data.orPyAm.totPyAm(결제 금액) · data.orPymt(pymtCdNm · credCoCdNm · pyApvDtm)
 *     카드 결제면 카드영수증(card, 카드사 · 승인 시각), 아니면 구매영수증(purchase). 카드 영수증 화면(pyRctwUrl, 결제사 도메인)은 내용이 미확인이라 열지 않는다
 *  4) 매장 목록    POST https://fapi.daisomall.co.kr/or/orb/orOff/selOfflineOrList   {strtDt 1일 · endDt 말일 · pageIndex 0..} 한 달씩 12개월, hasNext 동안 — salDiv "92"(취소)는 뺀다
 *  5) 매장 영수증  POST https://fapi.daisomall.co.kr/or/orb/orOff/getOfflineOrReceipt   {ssNum} — data.orMOfflineorVO(saleDtm · saleAmt · addTax · cardAmt · cashAmt · strNm · bzmnNo) · orOfflineorApprVOList[](apprNo · cardNm · apprYmd · apprTm)
 *     결제 금액 = saleAmt + addTax(매장 saleAmt 는 부가세 뺀 값 — 실측 909 + 91 = 1,000원)
 * 같은 FlowEvent/FlowOut 규약(naverReceipt.ts)을 따르고 구동기가 숨은 웹뷰에서 범용 요청(fetch 동작, siteFetch.ts)을 실행한다.
 * 쿠키 · 토큰 · 이름 · 주소 · 전화 · 카드번호는 이 파일 어디에도 없다 — 요청 모양과 응답 키 이름만 쓴다. 로그에는 건수만.
 * 목록 줄은 먼저 목록 행(list)으로 서버에 올리고, 영수증 · 상세를 읽은 주문은 완성본으로 바꿔 올린다(컬리 흐름과 같다).
 */
import { type NaverFlow, type ReceiptOrder } from './naverReceipt';
import { type ApiFlowOptions } from './naverApiFlow';
import type { ReceiptDetail } from './model';
export declare const DAISO_HOME_URL = "https://www.daisomall.co.kr/";
export declare const DAISO_LOGIN_PATH = "/mb/mbb/SCR_MBB_0097A";
export declare const DAISO_LIST_URL = "https://fapi.daisomall.co.kr/or/orb/selOr";
export declare const DAISO_DETAIL_URL = "https://fapi.daisomall.co.kr/or/orb/orDts/selOrDtl";
export declare const DAISO_STORE_LIST_URL = "https://fapi.daisomall.co.kr/or/orb/orOff/selOfflineOrList";
export declare const DAISO_STORE_RECEIPT_URL = "https://fapi.daisomall.co.kr/or/orb/orOff/getOfflineOrReceipt";
type Raw = Record<string, unknown>;
/** 온라인 목록 응답 → 주문 줄 배열(data[] 가 바로 주문 배열, 11-05 실측) */
export declare function daisoListRows(json: unknown): Raw[];
/** 첫 줄의 totalCnt — 없으면 null */
export declare const daisoTotalCount: (rows: Raw[]) => number | null;
/** 취소된 온라인 주문 — orCnclDtm 있음 · 상태 글자에 취소 · 상품 줄이 모두 취소 구분(cnclSeCd) */
export declare function daisoCancelled(o: Raw): boolean;
/** 온라인 목록 줄 → 목록 주문(주문번호 orNo · 결제 완료 시각 pyCmptDtm · 금액 = 상품 줄 orAm 합). 못 읽으면 null */
export declare function daisoListOrder(o: Raw): ReceiptOrder | null;
export type DaisoDetail = {
    amount?: number;
    paidAt?: string;
    card: boolean;
    issuer?: string;
    cancelled: boolean;
    found: boolean;
};
/** 온라인 상세 응답 — data.or · data.orPyAm.totPyAm · data.orPymt(pymtCdNm 신용카드 · credCoCdNm · pyApvDtm) */
export declare function readDaisoDetail(json: unknown): DaisoDetail;
/** 매장 목록 응답 → 줄 배열 · 다음 쪽 — data.orOffineList(API 철자 그대로) 또는 orOfflineList, data.hasNext · nextPageIndex */
export declare function daisoStoreRows(json: unknown): {
    rows: Raw[];
    hasNext: boolean;
    next: number | null;
};
/** 매장 결제 금액 — saleAmt(공급가) + addTax(부가세) */
export declare const daisoStoreAmount: (o: Raw) => number | undefined;
/** 매장 목록 줄 → 목록 주문(주문번호 = ssNum · 시각 saleDay+saleTim). salDiv 92 는 취소라 부르는 쪽이 뺀다. 못 읽으면 null */
export declare function daisoStoreOrder(o: Raw): ReceiptOrder | null;
export type DaisoStoreReceipt = {
    amount?: number;
    paidAt?: string;
    card: boolean;
    issuer?: string;
    approval?: string;
    businessNumber?: string;
    seller?: string;
    cancelled: boolean;
    detail: ReceiptDetail;
};
/** 매장 전자영수증 응답 — data.orMOfflineorVO + orOfflineorApprVOList[0]. 없으면 null */
export declare function readDaisoStoreReceipt(json: unknown): DaisoStoreReceipt | null;
export declare function createDaisoApiFlow(opts?: ApiFlowOptions): NaverFlow;
export {};
