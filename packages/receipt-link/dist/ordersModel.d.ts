/**
 * 불러온 주문 목록(영수증 적립) — 서버 응답을 화면 모양으로 고치는 순수 함수.
 * 주문번호는 서버가 가린 값만 받는다. 판매처 · 상품명 · 금액 · 날짜 말고는 화면에 올리지 않는다.
 */
import { type ReceiptDetail } from './model';
import { type Outcome } from './runOutcome';
/** card 카드영수증 · purchase 구매영수증 · list 영수증을 아직 가져오기 전의 목록 행(서버가 완성본으로 바꿔 넣는다) */
export type OrderKindShown = 'card' | 'purchase' | 'list';
export type LinkOrder = {
    id: number;
    platform: string;
    orderNo: string;
    seller: string;
    title: string;
    amount: number;
    orderedAt: string;
    claimed: boolean;
    claimedAt: string | null;
    kind: OrderKindShown | null;
    /** 같은 영수증이 이미 사진 영수증이나 다른 주문으로 올라와 있다 — 적립할 수 없다 */
    duplicate: boolean;
    /** 영수증 세부(card-single 원문 칸)를 받은 줄 — 서버 hasDetail. 옛 방식으로 받은 줄은 false */
    hasDetail?: boolean;
};
export type OrderList = {
    orders: LinkOrder[];
    point: number;
    claimable: number;
};
export type ClaimResult = {
    given: number;
    pouchRoom: number;
};
export declare function parseOrderList(v: unknown): OrderList;
export declare function parseClaimResult(v: unknown): ClaimResult;
/** 「12,300원」 — 천 단위 쉼표 */
export declare function formatWon(n: number): string;
/** 「2026.10.20」 — 날짜는 'YYYY-MM-DD HH:mm' 에서 연 · 월 · 일까지. 모양이 틀리면 빈 글자 */
export declare function formatDate(orderedAt: string): string;
/** 제목에서 화면 글자(자세히 보기 · 더보기 · 영수증 · 결제상세 …)를 지운다. 낱말 단위로만 지워서 「영수증용지」 같은 상품 이름은 그대로 둔다. 남는 것이 없으면 빈 글자 */
export declare function cleanTitle(title: string): string;
/**
 * 줄에 보일 이름 — 판매처와 상품명. 상품명이 판매처와 같거나 판매처로 시작하면 한 번만 보인다(상품명이 더 길면 상품명 한 줄, 같으면 판매처 한 줄).
 * 상품명 안의 배송비 부가 줄과 이어서 되풀이되는 이름(「웰스 · 웰스」)은 뺀다. 판매처가 상품명으로 시작해도(상품명이 더 짧다) 판매처만 보인다.
 */
export declare function displayName(seller: string, title: string): string;
/** 「2026.10.20 판매처 · 상품명」 — 상품명이 비었거나 화면 글자뿐이면 날짜(와 판매처)만, 판매처와 겹치는 상품명은 한 번만 */
export declare function displayLine(o: LinkOrder): string;
/** 적립 안 한 것이 먼저, 그 안에서는 최근 주문이 먼저. 원래 배열은 바꾸지 않는다 */
export declare function sortOrders(list: LinkOrder[]): LinkOrder[];
/** 「적립 가능 3건 · 건당 300P」 */
export declare function summaryLine(claimable: number, perOrder: number): string;
/** 줄 오른쪽에 무엇을 보일지 — claimed 적립 완료(claimedAt 이 있어도) · duplicate 이미 올린 영수증 · pending 아직 영수증을 못 가져온 목록 행 · ready 광고 보고 적립 */
export type RowState = 'claimed' | 'duplicate' | 'pending' | 'ready';
export declare function rowState(o: LinkOrder): RowState;
/**
 * 주문 읽기가 어디까지 왔는지(화면이 이미 아는 신호만) — list 목록을 읽는 중(영수증 단계 전) · receipt 영수증을 가져오는 중 · ended 끝남(끝난 까닭 reason).
 * outcomes 는 흐름이 줄마다 알려 주는 결과(runOutcome.ts) — 키는 outcomeKey(주문번호 뒤 4자리 · 주문 일시 · 금액). 결과를 알리는 사이트(네이버)만 주고,
 * 없으면(다른 사이트) 끝났는데 아직 목록 행인 줄을 못 가져온 것으로 보고 가져오는 중인 줄은 가장 위(최신) 대기 줄로 짐작한다.
 */
/**
 * only: 한 줄 다시 가져오기 실행이면 그 줄들(outcomeKey) — 나머지 줄은 실행 중이어도 지난 전체 실행이 끝난 모습(base 까닭) 그대로 둔다(대표님 10-29 13:36 「하나 누르면 전체 가져오기 단추가 다 사라졌다가 나오고」).
 */
export type RunView = {
    stage: 'list' | 'receipt' | 'ended';
    reason: string;
    outcomes?: Record<string, Outcome>;
    only?: string[];
    base?: string;
};
/**
 * 줄 하나의 상태 — 적립 완료 · 이미 올린 영수증 · 가져옴 ✓(광고 보고 적립) · 대기 · 가져오는 중 · 영수증 없음 · 못 가져옴(reason).
 * retry 는 그 줄만 다시 가져올 수 있다(「가져오기」 단추) — 못 가져옴(로그인이 풀린 때는 빼고)과 멈춘 뒤 남은 대기 줄.
 */
export type RowView = {
    state: 'claimed' | 'duplicate' | 'fetched' | 'waiting' | 'fetching' | 'none' | 'cancelled' | 'failed';
    reason: string;
    retry?: boolean;
};
/** 끝난 까닭을 모를 때의 글자 — 「읽지 못했어요」처럼 두루뭉술하게 말하지 않고 다음 할 일을 말한다 */
export declare const UNKNOWN_END_TEXT = "\uAC00\uC838\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694 \u00B7 \uAC00\uC838\uC624\uAE30\uB97C \uB20C\uB7EC \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694";
/** 로그인이 풀린 줄 — 다시 가져와도 같다(먼저 로그인) */
export declare const LOGIN_TEXT = "\uB85C\uADF8\uC778\uC774 \uD480\uB838\uC5B4\uC694";
/** 끝난 까닭 코드를 쉬운 말로(영문 코드 · 번호는 글자에 넣지 않는다) */
export declare function endReasonText(reason: string): string;
/**
 * 줄마다 상태. 읽는 중에는 흐름이 알린 줄 결과(outcomes)를 그대로 보이고, 아직 결과가 없는 줄은 「대기」다(결과를 알리지 않는 사이트는 영수증 단계에서
 * 가장 위(최신) 대기 줄 하나만 「가져오는 중」 — 흐름이 최신부터 처리한다).
 * 끝났거나 읽기 정보가 없으면(run 없음) 결과가 없는 줄은 끝난 까닭으로 「못 가져옴」 — 사용자가 중단했으면(reason stopped) 실패가 아니라 「대기」로 남긴다.
 */
export declare function rowViews(list: LinkOrder[], run: RunView | null): Map<number, RowView>;
/** 아직 영수증이 없는 줄(목록 행)의 현재 몫 — 머리 줄의 「영수증 없음 K건 · 못 가져옴 F건」과 중단 뒤 「남은 W건」에 쓴다 */
export type PendingTally = {
    waiting: number;
    fetching: number;
    none: number;
    cancelled: number;
    failed: number;
};
export declare function tallyPending(list: LinkOrder[], run: RunView | null): PendingTally;
/** 목록 전체 · 영수증을 가져온 줄(목록 행이 아니게 된 줄 · 적립 완료 · 이미 올린 영수증) · 적립 가능(광고 보고 적립 버튼이 있는 줄, 적립 완료는 뺀다) */
export type ListCounts = {
    total: number;
    fetched: number;
    claimable: number;
};
export declare function listCounts(list: LinkOrder[]): ListCounts;
/** 줄 오른쪽 글자 — 광고 보고 적립 버튼이 있는 줄(fetched)은 버튼이, 이미 올린 영수증(duplicate)은 서버 안내 글이 대신한다 */
export declare function rowLabel(v: RowView): string;
/** 「5,000원 · 카드영수증 · 가져옴 ✓」 — 금액과 종류, 가져온 줄이면 가져옴 표시 */
export declare function amountLine(o: LinkOrder, v: RowView): string;
/** 금액 밑의 작은 종류 글자 — 카드영수증 · 구매영수증(목록 행 · 모르는 종류는 없음) */
export declare function kindLabel(o: LinkOrder): string;
/** 영수증 보기에 쓰는 한 건 — 서버 GET receipt-orders/{id} 의 receipt. 가져온 영수증(카드 매출전표)의 칸만 있다 */
export type OrderReceipt = {
    seller: string;
    title: string;
    amount: number;
    /** 한국 시각 「YYYY-MM-DD HH:mm:ss」(초가 없으면 분까지) */
    orderedAt: string;
    kind: OrderKindShown | null;
    cardIssuer: string;
    approval: string;
    businessNumber: string;
    /** 영수증 세부(대표님 14:15 card-single 원문 칸) — 어제 옛 방식으로 받은 줄에는 없다 */
    detail?: ReceiptDetail;
};
/** 응답 모양이 틀리거나 일시 · 금액이 없으면 null */
export declare function parseOrderReceipt(v: unknown): OrderReceipt | null;
/** 「2026.10.20 14:03:22」 — 초가 없으면 분까지. 모양이 틀리면 빈 글자 */
export declare function formatDateTime(orderedAt: string): string;
export type ReceiptRow = {
    label: string;
    value: string;
    head?: boolean;
    strong?: boolean;
};
/** 영수증 보기의 표 — 값이 없는 칸은 줄을 만들지 않는다. 세부(detail)가 있으면 대표님 22:30 캡처 순서, 없으면(옛 방식으로 받은 줄) 예전 칸 */
export declare function receiptRows(r: OrderReceipt): ReceiptRow[];
/**
 * 「영수증 내용 채우기」로 다시 받을 줄 — 세부가 빈 내 네이버 카드 줄(서버 hasDetail 이 없는 줄).
 * 서버가 주문번호를 가려 주므로 「뒤 4자리|결제 날짜」로 넘긴다(흐름이 목록 주문과 날짜 하루 차이까지 잇는다). 대표님 14:26 「가져온 영수증 정보도 빈게 너무 많아」
 */
export declare function refillTails(orders: LinkOrder[]): string[];
