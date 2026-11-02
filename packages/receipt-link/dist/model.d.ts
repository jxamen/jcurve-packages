/**
 * 네이버 · 쿠팡 주문내역 연동 — 서버 계약과 읽어 온 주문을 서버로 보내기 전에 거르는 순수 함수(기획서 docs/order-link §9).
 * 쿠키 · 아이디 · 비밀번호 · 수취인 · 주소 · 전화는 이 파일 어디에도 타입이 없다 — 읽는 쪽이 그런 값을 건네도 cleanOrder 가 버린다.
 */
export type LinkPlatform = 'naver' | 'coupang' | 'musinsa' | 'kurly';
/** 캡슐함 카드에 보이는 두 곳(모든 스위치 켜진 회원) */
export declare const LINK_PLATFORMS: LinkPlatform[];
/** 대표님 계정(probe)에게만 보이는 시험 곳 — 영수증 올리기 「전자 영수증」 칸 앞 연동 칩의 순서(대표님 10-28 17:56) · 구조 기록 */
export declare const TEST_LINK_PLATFORMS: LinkPlatform[];
/** 서버가 줄 수 있는 모든 곳 */
export declare const ALL_LINK_PLATFORMS: LinkPlatform[];
export declare const LINK_LABEL: Record<LinkPlatform, string>;
/** 서버가 한 번에 받는 주문 수 */
export declare const ORDERS_PER_REQUEST = 50;
export type LinkLine = {
    linkedAt: string | null;
    revokedAt: string | null;
    lastImportAt: string | null;
    importedTotal: number;
};
/** probe: 구조 기록 단추를 보일 회원(대표님 계정) · hide_legacy: 「전자 영수증」 카드에서 N+스토어 · 네이버페이 · 쿠팡을 숨긴다 */
export type LinkState = {
    windowDays: number;
    consentVersion: string;
    links: Partial<Record<LinkPlatform, LinkLine>>;
    probe: boolean;
    hide_legacy: boolean;
    /** 쿠팡 읽기 스위치(대표님 「켜기」 뒤 true). 서버 필드가 없으면 false 로 본다 */
    coupangRead?: boolean;
    /** 새 네이버페이 수집 길(rl15) — 서버 목록 회원만. 켜진 회원은 홈에서 자동 점검도 돈다 */
    npv2?: boolean;
    /** 플랫폼별 읽기 기간(일) — 서버 앱설정이 정한 값. 없으면 흐름 기본(365) */
    readDays?: Partial<Record<LinkPlatform, number>>;
};
/**
 * 서버로 보내는 주문 — 이 열두 칸이 전부다. 뒤의 여섯 칸(사업자번호 · 승인번호 · 카드사 · 종류 · 목록 키)은 영수증을 건건이 읽었을 때만 있다.
 * orderedAt 은 'YYYY-MM-DD HH:mm:ss'(초 포함)가 정상이고, 'YYYY-MM-DD HH:mm' 도 받는다.
 * kind 'list' 는 영수증을 읽기 전의 목록 행이다 — orderNo 가 없을 수 있고(그러면 listKey 로 가린다), 서버가 완성본으로 바꿔 넣는다(결과 updated).
 */
export type OrderKind = 'card' | 'purchase' | 'list';
export type OrderInput = {
    orderNo?: string;
    orderedAt: string;
    amount: number;
    seller?: string;
    title?: string;
    payment?: string;
    businessNumber?: string;
    approval?: string;
    cardIssuer?: string;
    kind?: OrderKind;
    listKey?: string;
    detail?: ReceiptDetail;
};
/** 영수증 세부 칸 — 대표님 10-29 14:15 card-single 원문 칸(세부 화면에 22:30 캡처 순서로 보인다) */
export declare const RECEIPT_DETAIL_KEYS: readonly ["cardCompany", "approvalNo", "cardNo", "tradeType", "ownerType", "installmentType", "approvalAt", "cancelAt", "productName", "productOrderNo", "sellerName", "sellerRepresentative", "sellerBusinessNo", "sellerTel", "sellerAddress", "merchantName", "merchantBusinessNo", "approvalAmount", "cancelAmount", "supplyAmount", "taxAmount", "totalAmount", "cardExpiredYear", "cardExpiredMonth", "merchantRepresentative", "merchantNo", "merchantAddress", "serviceCharge", "disposableCupAmount"];
export type ReceiptDetailKey = (typeof RECEIPT_DETAIL_KEYS)[number];
export type ReceiptDetail = Partial<Record<ReceiptDetailKey, string | number>>;
/** 세부 칸만 남긴다 — 금액 칸은 정수, 나머지는 글자(200자까지). 모르는 키 · 다른 모양은 버린다 */
export declare function readDetail(v: unknown): ReceiptDetail | undefined;
export type OrderResult = 'new' | 'duplicate' | 'updated' | 'taken' | 'out_of_range' | 'invalid' | 'amount' | 'pouch_full';
export type ImportTally = Record<OrderResult, number>;
export declare function parseLinkState(v: unknown): LinkState;
export declare const isConnected: (s: LinkState, p: LinkPlatform) => boolean;
/**
 * 목록 키 「YYYY-MM-DD HH:mm|금액」 — 영수증을 읽기 전 목록 행과 읽은 뒤 완성본을 잇는다(서버가 같은 키의 list 행을 완성본으로 바꾼다).
 * 날짜만 아는 「YYYY-MM-DD|금액」(쿠팡)은 서버 모양에 맞게 「YYYY-MM-DD 00:00|금액」 으로 맞춘다. 모양이 틀리면 undefined.
 */
export declare function normalizeListKey(v: unknown): string | undefined;
/**
 * 읽어 온 주문 한 건에서 서버에 보낼 열 칸만 남긴다. 주문번호 · 일시 · 금액이 없거나 모양이 틀리면 null(그 주문은 보내지 않는다).
 * 금액은 쉼표 · 「원」 이 붙은 글자도 받는다(화면 읽기). 다른 키는 전부 버린다.
 */
export declare function cleanOrder(raw: unknown): OrderInput | null;
export declare function chunkOrders<T>(items: T[], size?: number): T[][];
export declare const emptyTally: () => ImportTally;
/** 서버 응답 results[].result 를 합친다 — 모르는 값은 invalid 로 센다 */
export declare function addTally(t: ImportTally, results: unknown): ImportTally;
/** 가져오기가 끝난 뒤 사용자에게 보이는 한두 줄 */
export declare function importMessage(t: ImportTally, skippedUnreadable?: number): string;
