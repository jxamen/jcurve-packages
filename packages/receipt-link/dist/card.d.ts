/**
 * 주문내역 연동 카드(1단계) — 화면 없이 정하는 것만. 그리기는 src/screens/OrderLinkCard.tsx.
 * 1단계는 연결 · 동의 · 철회와 로그인 창까지다. 주문은 아직 읽지 않는다(기획서 docs/order-link §9 · 확인표 B).
 */
import type { ReceiptLinkClient } from './client';
import { type LinkPlatform, type LinkState } from './model';
/** 카드 상태 — 서버 스위치가 꺼졌거나(404) 읽기가 실패하면 null → 카드를 그리지 않는다 */
export declare function loadCardState(client: Pick<ReceiptLinkClient, 'fetchLinkState'>): Promise<LinkState | null>;
/** 사이트의 공식 로그인 페이지 — 회원이 여기서 직접 로그인한다 */
export declare const LOGIN_URL: Record<LinkPlatform, string>;
/** 한 줄 상태 — 「연결 안 됨」 또는 「연결됨 · 동의한 날」 */
export declare function linkStatus(s: LinkState, p: LinkPlatform): string;
/** 동의 화면 문구 — 기획서 §6.1 초안(법무 최종 문안 전). 가져오는 칸 · 로그인 정보 · 철회를 그대로 적는다 */
export declare function consentLines(p: LinkPlatform, app?: {
    appName: string;
    viaDeveloperServer?: boolean;
}): string[];
