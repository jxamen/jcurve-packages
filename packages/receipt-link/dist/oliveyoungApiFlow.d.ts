/**
 * 올리브영 영수증 흐름 — 온라인 주문(거래증빙서류 · KSNET 카드 매출전표) + 매장 구매. **요청만** 쓴다(클릭 · 로그인 정보 입력 없음).
 * 서버 크롬 실측(tools/crawl-test presets.json `_version` 21 · src/flow.cjs runOliveyoung, 2026-11-05 대표님 15:45 「다이소 · 올리브영도 수집」) 순서 그대로:
 *  1) https://www.oliveyoung.co.kr/store/main/main.do 를 한 번 연다(요청 출처 — 클라우드플레어는 화면 밖 요청을 403 으로 막는다). 로그인 화면(/store/login/loginForm.do)이면 로그인
 *  2) 온라인 목록  GET /store/mypage/getOrderListJSON.do?searchMonth=-12&startDate=&endDate=&pageIdx=p  — 상품 줄 배열, 빈 배열 [] 까지. ordNo 로 묶는다
 *     취소(ordPrgsStatCdViewNm 에 취소 · 반품, 또는 모든 줄 realQty 0 + cnclQty/rtgsQty)는 뺀다(대표님 「취소는 빼기」)
 *  3) 거래증빙서류  GET /store/mypage/getDealList.do?pageIdx=p&searchMonth=-12&startDate=&endDate=  — HTML, tr[data-ord-no] 마다 총 결제금액 · #cardReceipt(data-van-cd · data-shop-sys-no) · #cashReceipt(data-cr-conf-no). 새 줄 없을 때까지
 *  4) 온라인 상세  GET /store/mypage/getOrderDetail.do?ordNo=  — HTML 글자 「총 결제금액 N」 · 결제수단 줄 시각(YYYY.MM.DD HH:MM:SS)
 *  5) 매장 목록    GET /store/mypage/getOrderList.do?searchMonth=-12&startDate=&endDate=&searchOrderType=20  — HTML 1년 한 번, a.btnDetail(data-oper-dt · data-deal-sp · data-origin-bizpl-cd · data-pos-no · data-receipt-no · data-frst-receipt-no, onclick goOrderDetail('주문번호','Y'))
 *     + 같은 목록 JSON(searchOrderType=20&pageIdx=p) — ordDtime(밀리초) · strNm · goodsNm · totSalePrc · 상태 · cnclQty · rtgsQty
 *  6) 매장 상세    GET /store/mypage/getOfflineOrderDetail.do?ordNo=<dealSp><주문번호>&operDt=&originBizplCd=&posNo=&receiptNo=&frstReceiptNo=  — HTML 「총 결제금액」 → 구매영수증(purchase)
 *  7) 카드 매출전표(마지막, vanCd 02 = KSNET) — 카드 주문마다 https://ksta.ksnet.co.kr/mint/tsk/pgi01/mad/pgimad19m1.jsp?tr_no=<shopSysNo> 로 이동 →
 *     같은 주소 HTML 원문의 pg_deal_numb : '<숫자>' → POST https://ksta.ksnet.co.kr/kfm/JsonChannelService.do (param=URL 인코딩 JSON, 폼) → response_data(appr_numb · appr_date · appr_time · amount · svos · vat · make_comp_gove_name · shop_name · entr_numb · canc_yn) → 카드영수증(card)
 *     토스 · CJ페이(다른 vanCd) · 현금영수증 화면은 내용 미확인 — 열지 않고 상세의 총 결제금액으로 구매영수증(purchase)
 * 같은 FlowEvent/FlowOut 규약(naverReceipt.ts). 쿠키 · 토큰 · 이름 · 주소 · 전화 · 카드번호는 이 파일 어디에도 없다 — 요청 모양과 응답 키 이름만. 로그에는 건수만.
 */
import { type NaverFlow } from './naverReceipt';
import { type ApiFlowOptions } from './naverApiFlow';
export declare const OY_HOME_URL = "https://www.oliveyoung.co.kr/store/main/main.do";
export declare const OY_LOGIN_PATH = "/store/login/";
/** 로그인 화면 — 로그인이 필요하면 홈이 아니라 이 화면을 보여 준다(1.2.3, 다이소와 같은 규칙 · 대표님 11-05 18:06) */
export declare const OY_LOGIN_URL = "https://www.oliveyoung.co.kr/store/login/loginForm.do";
export declare const OY_ONLINE_URL: (p: number, from: string, to: string) => string;
export declare const OY_DEAL_URL: (p: number, from: string, to: string) => string;
export declare const OY_DETAIL_URL: (ordNo: string) => string;
export declare const OY_STORE_HTML_URL: (from: string, to: string) => string;
export declare const OY_STORE_JSON_URL: (p: number, from: string, to: string) => string;
export declare const OY_STORE_DETAIL_URL: (s: OyStoreRow) => string;
export declare const KSNET_VIEW_URL: (shopSysNo: string) => string;
export declare const KSNET_JSON_URL = "https://ksta.ksnet.co.kr/kfm/JsonChannelService.do";
/** KSNET 매출전표 JSON 요청 본문(대표님 요청 본문 그대로, param= 뒤는 URL 인코딩) */
export declare const ksnetBody: (pgDealNumb: string) => string;
type Raw = Record<string, unknown>;
/** HTML → 글자(스크립트 · 스타일 · 태그 제거, 공백 하나로) */
export declare function htmlText(html: string): string;
export type OyDealRow = {
    ordNo: string;
    total?: number;
    card: boolean;
    vanCd: string;
    shopSysNo: string;
    paySctCd: string;
    cash: boolean;
    crConfNo: string;
};
/** 거래증빙서류 HTML → 주문별 줄(tr[data-ord-no]) */
export declare function oyDealRows(html: string): OyDealRow[];
export type OyStoreRow = {
    ordNo: string;
    store: boolean;
    operDt: string;
    originBizplCd: string;
    posNo: string;
    receiptNo: string;
    dealSp: string;
    frstReceiptNo: string;
    status: string;
};
/** 매장 주문 목록 HTML → a.btnDetail 마다 한 줄(onclick goOrderDetail('주문번호','Y')). 상태는 같은 토막(tr · li)의 <strong> 글자 중 마지막 */
export declare function oyStoreRows(html: string): OyStoreRow[];
export type OyTotal = {
    total?: number;
    paidAt?: string;
    method?: string;
};
/** 주문 상세 HTML 글자 — 「총 결제금액 N」 · 결제수단 줄(카드사 / 일시불(YYYY.MM.DD HH:MM:SS)) */
export declare function oyTotal(html: string): OyTotal;
/** KSNET 매출전표 화면 원문의 거래번호 — 서버가 스크립트에 박아 둔 pg_deal_numb : '<숫자>' */
export declare const ksnetDealNumb: (html: string) => string | null;
export type KsnetSlip = {
    ok: boolean;
    code: string;
    approval?: string;
    paidAt?: string;
    amount?: number;
    supply?: number;
    tax?: number;
    issuer?: string;
    merchant?: string;
    businessNumber?: string;
    cancelled: boolean;
};
/** KSNET 매출전표 JSON — response_header.result_code 0 · response_data(appr_numb · appr_date · appr_time · amount · svos · vat · make_comp_gove_name · shop_name · entr_numb · canc_yn) */
export declare function readKsnetSlip(json: unknown): KsnetSlip;
export type OyGroup = {
    ordNo: string;
    rows: Raw[];
    cancelled: boolean;
    orderedAt: string | null;
    title?: string;
    seller?: string;
    amount?: number;
};
/** 상품 줄 배열(온라인 · 매장 JSON)을 주문번호로 묶는다 — 취소 = 상태 글자에 취소 · 반품 · 환불, 또는 모든 줄 realQty 0 + cnclQty/rtgsQty */
export declare function oyGroups(rows: unknown[]): OyGroup[];
export declare function createOliveyoungApiFlow(opts?: ApiFlowOptions): NaverFlow;
export {};
