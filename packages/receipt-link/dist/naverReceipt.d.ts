/**
 * 영수증 읽기(네이버 · 쿠팡 공통 부품) — 순수 함수와 상태 기계. react-native 를 import 하지 않는다(노드에서 시험한다).
 * DOM 셀렉터는 쓰지 않는다. 보이는 글자(innerText) · 정규식 · 글자로 찾아 누르기만 쓴다.
 * 개인정보: 응답 본문 · 페이지 본문은 저장하지 않는다. 가로채기는 정규식에 맞는 토큰(번호)만 남기고, 주문 내용은 웹뷰 → 앱 메시지로만 흐른다.
 *   probe 로 서버에 가는 것은 구조 요약(shape: 주소 경로 · 개수 · 있음/없음)뿐이다.
 * 가정(실기기 확인 전): 네이버 라벨(판매처 · 판매자 · 결제일시 등)과 목록 구조는 추정이다. 주소 형식은 대표님 확인값이다.
 * 호스트 규약:
 *  - navScript(action) 은 action.prepare === 'neutralizeNewWindow' 이면 NEUTRALIZE_NEW_WINDOW_SCRIPT 를 앞에 붙여 준다(호스트는 navScript 만 실행하면 된다).
 *    영수증 버튼이 새 창을 열어도 같은 웹뷰에서 열린다. 그래도 안 열리면 navCommon.hrefByTextScript 로 주소만 얻어 호스트가 연다.
 *  - 결제 상세 → 영수증 주소 우선순위: 매출전표 승인일시(초 있음) > 결제상세 일시(초) > tid 앞 14자리(같은 분일 때만).
 *  - 중복: 결제번호(paymentId) 또는 16자리 주문번호, 그리고 「금액|일시」 가 이미 나왔으면 한 건으로 센다(쇼핑 주문과 네이버페이 결제를 묶는다).
 */
import type { ReceiptDetail } from './model';
export type { ReceiptDetail } from './model';
import { type ReceiptResult, type ReceiptsRun } from './naverReceiptsScript';
import type { OutcomeEvent } from './runOutcome';
import { type FetchResult, type FetchRun } from './siteFetch';
export type ReceiptKind = 'card' | 'purchase';
export type Slip = {
    businessNumber?: string;
    approval?: string;
    paidAt?: string;
    /** true 면 paidAt 은 'YYYY-MM-DD HH:mm' 이다(초가 안 보임) */
    paidAtNoSeconds?: boolean;
    amount?: number;
    cardIssuer?: string;
    merchant?: string;
    orderNo?: string;
};
export type ReceiptRow = {
    orderNo: string;
    seller?: string;
    amount?: number;
    hasCard: boolean;
    hasPurchase: boolean;
    cardIndex: number;
    purchaseIndex: number;
};
export type HistoryRow = {
    date: string;
    orderNo?: string;
    merchant?: string;
    amount?: number;
    hasReceipt: boolean;
    receiptIndex: number;
    menuIndex?: number;
};
export type ReceiptTarget = {
    orderNo?: string;
    seller?: string;
    amount?: number;
    title?: string;
};
export type ReceiptOrder = {
    orderNo: string;
    orderedAt: string;
    amount: number;
    seller?: string;
    title?: string;
    payment: '카드' | '포인트·기타';
    businessNumber?: string;
    approval?: string;
    cardIssuer?: string;
    /** 'list' = 목록(API · 블록 글자)에서 본 주문. 영수증 보강 전이면 needsReceipt, orderNo 는 빈 문자열일 수 있다 */
    kind: ReceiptKind | 'list';
    needsReceipt?: boolean;
    /** 「YYYY-MM-DD HH:mm|금액」 — 목록 행과 보강본을 잇는 키. 서버는 같은 키의 list 행을 보강본으로 바꾼다 */
    listKey?: string;
    productOrderNo?: string;
    /** 네이버페이 내역 줄에서 온 주문의 payId(additionalData.payId) — tid 가 없어 pay 짝은 아니고, 「카드영수증」 링크가 없을 때 ② 길에 쓴다 */
    payIdHint?: string;
    /** 영수증 세부(대표님 14:15 원문 칸 전부, 22:30 캡처 순서로 보인다) — 서버 receipt_link_orders.detail 에 그대로 */
    detail?: ReceiptDetail;
    /** 목록 항목(order-histories)에 이미 있던 결제 짝 — 영수증 요청(naverApiFlow)이 쓴다. 없으면 영수증 응답에서 얻는다 */
    pay?: {
        tid: string;
        payId?: string;
        paymentId?: string;
    };
};
/** 가로채기 · 페이지 훑기에서 쓰는 토큰 규칙. value 는 group(또는 group+group2 짝)에서 꺼낸다 */
export type TokenPattern = {
    name: string;
    source: string;
    group: number;
    group2?: number;
};
/** 이 글자가 든 요소는 눌러도 되는 요소가 아니다(삭제 · 해지 · 탈퇴 · 취소) */
export declare const FORBIDDEN_LABEL_WORDS: readonly string[];
export declare const LOOKBACK_DAYS = 365;
export declare const MAX_PAY_PAGES = 40;
export declare const SHOP_ORDER_URL = "https://shopping.naver.com/my/order";
export declare const payHistoryUrl: (page: number) => string;
/** 라벨이 붙은 글자를 센다. 앞뒤가 한글·영숫자이면 다른 단어의 일부이므로 세지 않는다(예: 구매영수증 안의 영수증) */
export declare function countLabel(text: string, label: string): number;
export declare const NAVER_TOKEN_PATTERNS: TokenPattern[];
/** 쿠팡 가정 규칙: 주문번호는 orderId 근처 숫자, 판매자 번호는 vendorId(s) 근처 영문1+숫자7~10 */
export declare const COUPANG_TOKEN_PATTERNS: TokenPattern[];
/** 글자에서 규칙에 맞는 토큰만 「이름:값」 으로 뽑는다. 본문은 남기지 않는다 */
export declare function runPatterns(text: string, patterns: readonly TokenPattern[]): string[];
export type TokenSet = {
    paymentIds: string[];
    tids: string[];
    pairs: {
        paymentId: string;
        tid: string;
    }[];
    orderIds: string[];
    vendorIds: string[];
    orderNos: string[];
    productOrderNos: string[];
};
/** 「이름:값」 토큰을 모양 검사 후 종류별로 나눈다. 모양이 틀린 토큰은 버린다 */
export declare function parseTokens(tokens: readonly string[]): TokenSet;
/** 짝이 명시된 것은 그대로, 없으면 같은 날짜(앞 8자리)의 안 쓴 tid 를 붙인다. 최신 날짜부터 */
export declare function pairTokens(set: TokenSet): {
    paymentId: string;
    tid?: string;
}[];
/** 글자 한 덩이에서 네이버 결제 번호 · tid · 짝을 뽑는다(글자는 저장하지 않는다) */
export declare function extractPaymentTokens(text: string): {
    paymentIds: string[];
    tids: string[];
    pairs: {
        paymentId: string;
        tid: string;
    }[];
};
/** 카드 영수증 주소(새 형식). 세 값(tid · productOrderNo · payId)이 모두 맞을 때만 만든다. 옛 형식은 만들지 않는다 */
export declare function previewUrl(tid: string, productOrderNo: string, payId: string): string | null;
/** 결제번호 앞 8자리 → 'YYYY-MM-DD' */
export declare function dateOfPaymentId(paymentId: string): string | null;
/** tid 앞 14자리(YYYYMMDDHHMMSS) → 'YYYY-MM-DD HH:mm:ss' */
export declare function tidStamp(tid: string): string | null;
/** 매출전표(카드 · 구매영수증) 글자 → 필드. 금액 · 결제일시 · 승인번호 · 사업자번호 중 3개 이상 있어야 한다 */
export declare function extractSlip(raw: string): Slip | null;
/** 「영수증 발급 내역」 글자 → 줄(주문) 목록. 카드영수증 · 구매영수증 버튼이 몇 번째인지도 센다(눌러서 고를 때 쓴다) */
export declare function extractReceiptRows(raw: string): ReceiptRow[];
/**
 * 연도 없는 「9.11. 11:50 주문」 · 「10. 20. 10:04 결제」 를 'YYYY-MM-DD HH:mm' 으로(연도는 주어진 해, 기본은 현재 해).
 * 초는 없으므로 이 값은 목록용 힌트일 뿐 서버에 주문일시로 넣지 않는다.
 */
export declare function parseKoreanMD(raw: string, year?: number): {
    at: string;
    kind: 'order' | 'pay';
}[];
/** 주문 목록의 「9.11. 11:50 주문」 개수 */
export declare function countOrderCards(raw: string): number;
/**
 * 결제내역(pay.naver.com/history) 글자 → 결제 블록 목록.
 * 날짜는 「2026.10.20」 또는 「5,000원 | 10. 20. 10:04 결제」(연도 없음) 둘 다 본다.
 * 연도 없는 날짜: 최신순 목록에서 12월 → 1월로 넘어가면 해를 낮추고, 오늘(KST)보다 뒤면 해를 낮춘다.
 * 블록은 날짜가 있는 줄의 맨 앞에서 시작한다(금액이 같은 줄에 있다). menuIndex 는 그 결제의 「⋮」 이 페이지에서 몇 번째인지(없으면 undefined).
 */
export declare function extractHistoryRows(raw: string, nowMs?: number): HistoryRow[];
/** 결제상세의 「2026.10.20. 10:04:43」 → 'YYYY-MM-DD HH:mm:ss'. 초가 없으면 undefined(초 없는 값은 쓰지 않는다) */
export declare function extractDetailStamp(raw: string): string | undefined;
/**
 * 매출전표에 초가 없으면 초를 채운다. 우선순위: 매출전표 승인일시(초 있음) > 결제상세 일시 > tid 앞 14자리.
 * 후보는 전표와 같은 분(HH:mm)일 때만 쓴다. 맞는 후보가 없으면 전표를 그대로 둔다(초 없음 → toImportOrder 가 버린다).
 */
export declare function resolveSlipSeconds(slip: Slip, detailAt?: string, tid?: string): Slip;
/** 로그인 화면인지. 네이버 로그인 주소이거나, 주문 흔적 없이 로그인 글자만 있으면 로그인 화면이다 */
export declare function isLoginPage(url: string, text: string): boolean;
/**
 * 매출전표 → 서버가 받는 주문 한 건. 주문번호 · 결제일시(초까지) · 금액이 없으면 null.
 * 초가 없는 결제일시는 allowNoSeconds 를 켰을 때만 ':00' 을 붙인다(기본은 null — 가짜 초를 서버에 넣지 않는다).
 */
export declare function toImportOrder(slip: Slip, row?: ReceiptTarget, opts?: {
    kind?: ReceiptKind;
    allowNoSeconds?: boolean;
}): ReceiptOrder | null;
/** 가로채기 스크립트(injectedJavaScriptBeforeContentLoaded). 응답은 그대로 통과시키고 토큰만 window.__ytTokens 에 쌓는다 */
export declare function interceptScript(patterns: readonly TokenPattern[]): string;
export declare const NAV_INTERCEPT_SCRIPT: string;
/** 웹뷰 안 글자 찾기 · 누르기 · 본문 읽기 도구. 이 자체는 아무것도 보내지 않는다 */
export declare const NAV_HELPERS_SCRIPT: string;
export type ApiName = 'shop' | 'pay';
/** 페이지가 스스로 부르는 목록 주소의 경로. 가로채기 스크립트가 이 경로에 맞는 주소를 window.__ytApi[name] 에 둔다(페이지 메모리 안) */
export declare const API_ROUTES: Record<ApiName, string>;
export declare const SHOP_BLOCK_SELECTOR = "div[class*=\"OrderPro\"]";
export declare const PAY_BLOCK_SELECTOR = "ul > li[class*=\"PaymentI\"]";
/** 주문 시각 → 'YYYY-MM-DD HH:mm:ss'(KST). 숫자(초·밀리초), 「2026.10.20. 10:04:43」, 「2026-10-20 10:04:43」, 존 있는 ISO 를 받는다. 못 읽으면 null */
export declare function normalizeKst(v: unknown): string | null;
type ListFields = {
    orderNo?: string;
    orderedAt: string;
    amount: number;
    title?: string;
    seller?: string;
    productOrderNo?: string;
    pay?: ReceiptOrder['pay'];
};
/** 목록에서 본 주문 — 영수증으로 보강 전이라 needsReceipt, orderNo 는 모를 수 있다(빈 문자열) */
export declare function listOrder(f: ListFields): ReceiptOrder;
/** 쇼핑 주문내역 API 의 contents[] 한 칸(허용 필드만 쓴다). 주문번호 · 시각 · 금액이 없으면 null */
export declare function shopItemToOrder(x: unknown): ReceiptOrder | null;
/** 네이버페이 결제내역 API 의 nvMids[] 한 칸. 주문번호는 없을 수 있다(영수증으로 찾는다) */
export declare function payItemToOrder(x: unknown): ReceiptOrder | null;
/** 쇼핑 API 응답 전체. contents 가 배열이 아니면 null(모르는 모양), 배열이면 읽은 것만 */
export declare function parseOrderHistories(json: unknown): ReceiptOrder[] | null;
/** 네이버페이 결제내역 API 응답 전체. nvMids 가 배열이 아니면 null */
export declare function parseNvMids(json: unknown): ReceiptOrder[] | null;
/** 영수증 보기 화면의 가게 · 상품 글자(화면 그대로): 「주문번호」 줄 다음부터 금액 줄 전까지, 버튼 · 안내를 뺀 첫 두 줄 */
export declare function pickIssueTitle(text: string): string | undefined;
/** 쇼핑 주문 카드 한 장 → 목록 주문. 취소 · 반품 · 날짜 · 금액이 없으면 null */
export declare function parseShopCard(raw: string, nowMs?: number): ReceiptOrder | null;
/** 결제 카드 한 장 → 목록 주문. 「5,000원 | 10. 20. 10:04 결제」 의 금액(적립 금액 아님) */
export declare function parsePayCard(raw: string, nowMs?: number): ReceiptOrder | null;
/** 블록 한 칸: 목록의 몇 번째 카드인지(index)와 주문 */
export type BlockCard = {
    index: number;
    order: ReceiptOrder;
};
export declare function extractShopBlocks(texts: readonly string[], nowMs?: number): BlockCard[];
export declare function extractPayBlocks(texts: readonly string[], nowMs?: number): BlockCard[];
/** 블록 글자 스크립트: 선택자별 카드 innerText 를 600자씩 모아 {step:'blocks'} 로 보낸다. 누르지 않는다 */
export declare function blockTextsScript(selectors: readonly string[], shape?: boolean, hrefs?: boolean): string;
/** 가로채기(API 주소 학습): 페이지가 부르는 목록 주소만 window.__ytApi 에 둔다. 응답 본문은 읽지도 보내지도 않는다 */
export declare const NAV_API_INTERCEPT_SCRIPT: string;
/** 열린 시트 닫기: Escape 키 이벤트만 보낸다 */
export declare const ESCAPE_SCRIPT: string;
/** 누르기 전에 넣을 준비 스크립트. neutralizeNewWindow = navCommon.NEUTRALIZE_NEW_WINDOW_SCRIPT(새 창을 같은 웹뷰로) */
export type Prepare = 'neutralizeNewWindow';
export type NavAction = {
    kind: 'read';
} | {
    kind: 'click';
    labels: string[];
    prepare?: Prepare;
} | {
    kind: 'clickNth';
    labels: string[];
    index: number;
    prepare?: Prepare;
} | {
    kind: 'tokens';
    patterns: TokenPattern[];
} | {
    kind: 'blocks';
    selectors: string[];
    shape?: boolean;
    hrefs?: boolean;
} | {
    kind: 'api';
    name: ApiName;
    maxPages: number;
    sinceMs: number;
    since: string;
    until: string;
} | ({
    kind: 'receipts';
} & ReceiptsRun) | ({
    kind: 'fetch';
} & FetchRun) | {
    kind: 'escape';
};
/**
 * 한 단계 실행 스크립트. prepare 가 있으면 새 창 막기 스크립트를 앞에 붙인다.
 * read → {step:'read'}, tokens → {step:'tokens'}, click → {step:'clicked'} 를 보낸다
 */
export declare function navScript(action: NavAction): string;
/** 토큰 모으기 스크립트(a[href] · 초기 상태 JSON · 가로챈 토큰만). 보내는 것은 토큰 목록과 더보기 유무뿐이다 */
export declare function readTokensScript(patterns?: readonly TokenPattern[]): string;
/** 구조 요약만(주문 번호 · 금액 글자는 넣지 않는다). 주소 안의 긴 숫자는 # 로 가린다 */
export type PageShape = {
    url: string;
    textLen: number;
    orderNos: number;
    amounts: number;
    orderCards: number;
    receiptMenu: number;
    cardReceiptBtns: number;
    purchaseReceiptBtns: number;
    login: boolean;
};
export declare function pageShape(url: string, text: string): PageShape;
export type FlowStats = {
    rejected: number;
    probes: number;
    duplicates: number; /** 못 가져온 주문번호(16자리) 목록 — 호스트가 줄별로 「못 가져옴」 표시 */
    unfetched?: string[];
};
export type FlowEvent = {
    type: 'start';
    route?: 'issue' | 'history' | 'pay' | 'shop';
    known?: {
        orderNos?: string[];
        listKeys?: string[]; /** 「뒤4자리|날짜」 — 서버가 가린 주문번호로 이미 가져온 주문을 가린다(naverApiFlow) */
        tails?: string[];
    };
} | {
    type: 'page';
    url: string;
    text: string;
} | {
    type: 'clicked';
    ok: boolean;
} | {
    type: 'tokens';
    tokens: string[];
    hasMore: boolean;
} | {
    type: 'blocks';
    texts: string[];
} | {
    type: 'api';
    name: ApiName;
    items: unknown[];
    page: number;
    done: boolean;
    failed?: boolean;
} | {
    type: 'receipts';
    results: ReceiptResult[];
} | {
    type: 'fetched';
    results: FetchResult[];
} | {
    type: 'timeout';
} | {
    type: 'resume';
};
export type FlowOut = NavAction | {
    type: 'goto';
    url: string;
} | {
    type: 'back';
} | {
    type: 'login';
} | {
    type: 'probe';
    where: string;
    shape: PageShape;
}
/** 응답 JSON 의 키 구조(값 없음, shapeLines.structureLines) — 호스트가 대표님 계정에서만 조용히 서버 구조 기록으로 올린다. host · path 는 요청 주소의 호스트 · 경로(긴 숫자는 #) */
 | {
    type: 'structure';
    where: string;
    host: string;
    path: string;
    lines: string[];
} | {
    type: 'done';
    reason: string;
    orders: ReceiptOrder[];
    stats: FlowStats;
};
export type FlowOptions = {
    maxOrders?: number;
    now?: () => number;
    maxSteps?: number;
    budgetMs?: number;
    allowNoSeconds?: boolean;
    /** 대표님 계정 전용 점검: true 면 본 경로 전에 결제내역 1쪽을 한 번 읽는다(주문 · 영수증은 만들지 않음). 아니면 없음 */
    probe?: boolean;
};
export type NaverFlow = {
    next(ev: FlowEvent): FlowOut;
    /** 호출 시점까지 새로 만들어진 주문(목록 · 보강본)을 읽은 순서대로 돌려주고 버퍼를 비운다 */
    take(): ReceiptOrder[];
    /** 호출 시점까지 생긴 줄별 결과(가져오는 중 · 가져옴 · 영수증 없음 · 못 가져옴+까닭)를 만든 순서대로 돌려주고 버퍼를 비운다. 없는 흐름도 있다 */
    takeOutcomes?(): OutcomeEvent[];
    progress(): {
        phase: string;
        done: number;
        total: number;
        orders: number;
    };
};
