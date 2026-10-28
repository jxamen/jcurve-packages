/**
 * 네이버 · 쿠팡 주문내역 연동 — 서버 계약과 읽어 온 주문을 서버로 보내기 전에 거르는 순수 함수(기획서 docs/order-link §9).
 * 쿠키 · 아이디 · 비밀번호 · 수취인 · 주소 · 전화는 이 파일 어디에도 타입이 없다 — 읽는 쪽이 그런 값을 건네도 cleanOrder 가 버린다.
 */
export type LinkPlatform = 'naver' | 'coupang' | 'musinsa' | 'kurly';
/** 캡슐함 카드에 보이는 두 곳(모든 스위치 켜진 회원) */
export declare const LINK_PLATFORMS: LinkPlatform[];
/** 대표님 계정(probe)에게만 보이는 시험 곳 — 영수증 올리기 연동 줄 · 구조 기록 */
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
    /** (0.1.0) 서버가 알려 주면 그 값, 옛 서버면 50 · 없음 — 상한 검사는 서버가 하고 앱은 미리 거르는 데만 쓴다 */
    ordersPerRequest: number;
    amountMax: number | null;
};
/** 서버로 보내는 주문 — 이 여섯 칸이 전부다 */
export type OrderInput = {
    orderNo: string;
    orderedAt: string;
    amount: number;
    seller?: string;
    title?: string;
    payment?: string;
};
export type OrderResult = 'new' | 'duplicate' | 'taken' | 'out_of_range' | 'invalid' | 'amount' | 'pouch_full';
export type ImportTally = Record<OrderResult, number>;
export declare function parseLinkState(v: unknown): LinkState;
/** 동의했고 철회하지 않았다 */
export declare const isConnected: (s: LinkState, p: LinkPlatform) => boolean;
/**
 * 읽어 온 주문 한 건에서 서버에 보낼 여섯 칸만 남긴다. 주문번호 · 일시 · 금액이 없거나 모양이 틀리면 null(그 주문은 보내지 않는다).
 * 금액은 쉼표 · 「원」 이 붙은 글자도 받는다(화면 읽기). 다른 키는 전부 버린다.
 */
export declare function cleanOrder(raw: unknown): OrderInput | null;
export declare function chunkOrders<T>(items: T[], size?: number): T[][];
export declare const emptyTally: () => ImportTally;
/** 서버 응답 results[].result 를 합친다 — 모르는 값은 invalid 로 센다 */
export declare function addTally(t: ImportTally, results: unknown): ImportTally;
/** 가져오기 결과 문구 중 앱마다 다른 것 — 보상이 들어가는 곳(영테크: 용돈 주머니 · 사임캐시: 바로 적립)이 다르다 */
export type ImportTexts = {
    added: (n: number) => string;
    capacityFull: (n: number) => string;
};
export declare const DEFAULT_IMPORT_TEXTS: ImportTexts;
/** 가져오기가 끝난 뒤 사용자에게 보이는 한두 줄 */
export declare function importMessage(t: ImportTally, skippedUnreadable?: number, texts?: Partial<ImportTexts>): string;
