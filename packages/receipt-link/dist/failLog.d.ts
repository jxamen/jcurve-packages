/**
 * 영수증을 못 받은 주문마다 서버 실패 기록(receipt-link/fails)으로 보낼 줄을 만든다 — 대표님 11-04 「어디서 안 되는지 알아야 고친다 · 다 기록해놔」.
 * 쿠키 · 토큰 · 카드번호 · 승인번호는 담지 않는다(흐름이 준 진단은 이미 가린 글자다). 영테크 앱 src/receiptLink/failLog.ts 에서 옮겼다(1.1.0).
 */
import type { Outcome } from './runOutcome';
export type FailOrder = {
    orderNo: string;
    title?: string;
    orderedAt: string;
    amount: number;
};
export type FailItem = {
    order_no: string;
    title: string | null;
    ordered_at: string | null;
    amount: number | null;
    /** failed 못 가져옴 · none 영수증 없음 · left 끝날 때까지 못 받음(목록만 남음) */
    outcome: 'failed' | 'none' | 'left';
    code: string;
    stage: string;
    moved_on: boolean;
    info: Record<string, unknown>;
};
/** 줄 결과 + 목록 주문 → 서버로 보낼 줄. endCode 는 끝날 때 아직 받는 중이던 줄의 까닭(stopped · closed · 흐름이 끝낸 까닭) */
export declare function failItems(outcomes: Record<string, Outcome>, orders: Map<string, FailOrder>, endCode: string, ctx: Record<string, unknown>): FailItem[];
/** 지금 앱 판(OTA 업데이트 ID) — Metro 가 CJS/ESM 어느 쪽으로 주든 */
export declare function updateIdOf(mod: unknown): string;
