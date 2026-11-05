/**
 * 앱이 그대로 부르는 부분 — 사이트 주소 · 연결 상태 글자 · 동의 문구 · 「새 주문 0건」 까닭 · 서버 호출 · 오류 문구.
 * 영테크 앱 src/receiptLink/{card,client,ordersClient,importEnd}.ts 에 있던 것을 옮겼다(대표님 11-03 「앱은 부르기만」).
 * react-native 를 import 하지 않는다. 서버 호출은 앱의 http(get · post · slow)를 받아 쓴다. 주문 내용은 글자에 넣지 않는다.
 */
import { type ImportTally, type LinkPlatform, type LinkState } from './model';
import { type ClaimResult, type LinkOrder, type OrderList, type OrderReceipt } from './ordersModel';
import type { FailItem } from './failLog';
import type { ProbePayload } from './probe';
import type { Outcome } from './runOutcome';
/** 사이트의 공식 로그인 페이지 — 회원이 여기서 직접 로그인한다 */
export declare const LOGIN_URL: Record<LinkPlatform, string>;
/** 로그인 창을 여는 곳 — 주문내역 페이지. 로그인이 안 돼 있으면 사이트가 로그인 뒤 여기로 돌려보낸다 */
export declare const ORDER_URL: Record<LinkPlatform, string>;
/** 한 줄 상태 — 「연결 안 됨」 또는 「연결됨 · 동의한 날」 */
export declare function linkStatus(s: LinkState, p: LinkPlatform): string;
/** 동의 화면 문구 — appName 은 앱 이름(예: 영테크 · 사임캐시). 가져오는 칸 · 로그인 정보 · 철회를 그대로 적는다 */
export declare function consentLines(p: LinkPlatform, appName: string): string[];
/** 새 주문 0건으로 끝난 까닭 — none-new 만 실패가 아니다(대표님 11-02 20:36 「로그인이 풀린 건지 가져올 게 없어서인지」) */
export type EndNote = 'none-new' | 'login' | 'attention' | 'slow' | 'blocked' | 'unreadable';
/** 한 건도 새로 못 읽고 끝났다 — 화면 상태(ended 정상 · stalled 못 읽음)와 까닭. 정상 종료여도 failed 줄이 있으면 「가져올 게 없다」가 아니다 */
export declare function endOfNothingRead(reason: string, outcomes?: readonly Outcome[]): {
    mode: 'ended' | 'stalled';
    note: EndNote;
};
/** 이 상태의 진행 줄 글자. 서버 목록 숫자(counts)는 아직 못 받았으면 null */
export declare function endNoteLine(note: EndNote, label: string, counts: {
    total: number;
    claimable: number;
} | null): string;
/** 앱의 서버 호출 — 경로는 /api/ 뒤(예: 'receipt-link'). slow 는 오래 걸리는 저장(없으면 post) */
export interface ReceiptLinkHttp {
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    slow?<T>(path: string, body?: unknown): Promise<T>;
}
/** 서버 끝점 묶음 — receipt-link(상태 · 동의 · probe · 철회) · receipt-orders(보내기 · 목록 · 영수증 · 적립) */
export declare function createReceiptLinkApi(http: ReceiptLinkHttp): {
    /** 서버 스위치가 꺼져 있으면 404 → null(앱은 연동 영역을 그리지 않는다) */
    fetchLinkState(): Promise<LinkState | null>;
    consentLink(platform: LinkPlatform): Promise<LinkState>;
    /** 구조 기록 — 모양만 담은 본문. 거절이면 false */
    postProbe(body: ProbePayload): Promise<boolean>;
    revokeLink(platform: LinkPlatform): Promise<LinkState>;
    /** 읽은 주문 등록 — cleanOrder 를 통과한 것만 50건씩. 주머니가 차면(pouch_full) 남은 묶음은 보내지 않고 같은 사유로 센다 */
    sendOrders(platform: LinkPlatform, raw: unknown[]): Promise<{
        tally: ImportTally;
        unreadable: number;
    }>;
    /** 불러온 주문 목록 — 최신순 */
    listOrders(): Promise<OrderList>;
    /** 영수증 한 건 — 모양이 틀리면 Error('bad_receipt') */
    getOrderReceipt(id: number): Promise<OrderReceipt>;
    /** 광고를 본 뒤 한 건 적립. 광고 확인 전이면 402 ad_required */
    claimOrder(id: number): Promise<ClaimResult>;
    /** 카드 · 화면이 쓰는 상태 — 서버 스위치가 꺼졌거나(404) 못 받으면 null(연동 영역을 그리지 않는다) */
    loadLinkState(): Promise<LinkState | null>;
    /** 불러오기 한 번의 끝 — 까닭별 개수만(모든 회원, 주문 값 없음) + 패키지 판(pkg, 11-05 옛 판 표시용). 서버 receipt-link/run-end(11-03). 기록이라 실패해도 막지 않는다 */
    postRunEnd(body: RunEndBody): Promise<void>;
    /** 영수증을 못 받은 주문마다 진단 한 줄(failLog.failItems) — 100줄씩, 서버 receipt-link/fails(11-04). 실패해도 막지 않는다 */
    postFails(platform: LinkPlatform, items: readonly FailItem[]): Promise<void>;
};
/** 실행 끝 기록 본문 — reason · reasons 의 키는 영문 · 숫자 · : _ - 만(서버가 그 모양만 받는다) */
export type RunEndBody = {
    platform: LinkPlatform;
    total: number;
    ok: number;
    reason: string;
    reasons: Record<string, number>; /** 이번 실행에서 로그인이 확인됐다(주문 목록을 읽었거나 끝까지 돌았다) — 서버가 첫 lastImportAt 을 찍는 근거(1.2.2, 대표님 11-05 18:06) */
    loggedIn?: boolean;
};
export type ReceiptLinkApi = ReturnType<typeof createReceiptLinkApi>;
/** 영수증 보기를 못 열었을 때 — 없는 주문(404)과 그 밖 */
export declare function receiptErrorMessage(e: unknown): string;
/** 같은 영수증이 이미 있어 적립할 수 없다(목록 duplicate 줄 · 적립 409 duplicate_receipt 가 같은 말) */
export declare const DUPLICATE_MESSAGE = "\uC774\uBBF8 \uC62C\uB9B0 \uC601\uC218\uC99D\uC774\uC5D0\uC694";
/** 적립 실패를 사용자 말로 — 서버 코드(없으면 HTTP 상태)로 가른다 */
export declare function claimErrorMessage(e: unknown): string;
/** 적립 실패 코드 — 추적용(주문 내용 없음) */
export declare function claimErrorCode(e: unknown): string;
/** 전자 영수증 출처 글자 — 「네이버 · 카드영수증」 「마켓컬리 · 구매영수증」 */
export declare function linkSourceLabel(o: Pick<LinkOrder, 'platform' | 'kind'>): string;
/**
 * 내 기록(달력 · 한 줄)에 같이 보일 전자 영수증 — 영수증을 가져온 줄(card · purchase)만, 주문일(결제일) 달로 가른다(대표님 11-03 07:52 「전자 영수증도 나오게」).
 * 목록 행(list · 영수증 전) · 모양이 틀린 날짜는 뺀다. 최신순.
 */
export type LinkRecordEntry = {
    id: string;
    orderId: number;
    date: string;
    time: string | null;
    store: string;
    total: number;
    source: string;
    claimed: boolean;
};
export declare function linkRecordEntries(orders: readonly LinkOrder[], month: string): LinkRecordEntry[];
