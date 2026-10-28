import { type ImportTally, type LinkPlatform, type LinkState } from './model';
import type { ProbePayload } from './probe';
/**
 * 앱이 주는 요청 계층. 경로는 상대(`receipt-link` · `receipt-link/revoke` · `receipt-link/probe` · `receipt-orders`)이고
 * 베이스 주소 · 인증 헤더 · 접두(`bill/server/…` 같은 개발자 서버 경유)는 이 계층이 정한다 — 영테크는 앱 `api`, 사임캐시는 개발자 서버 어댑터.
 * 실패는 `status`(HTTP 숫자)를 가진 오류를 던진다.
 */
export type ReceiptLinkRequest = {
    get<T = unknown>(path: string): Promise<T>;
    post<T = unknown>(path: string, body?: unknown): Promise<T>;
};
export type SendOrdersOptions = {
    ordersPerRequest?: number;
    amountMax?: number | null;
};
export type SendOrdersResult = {
    tally: ImportTally;
    unreadable: number;
    disabled: boolean;
};
export declare function createReceiptLinkClient({ request }: {
    request: ReceiptLinkRequest;
}): {
    fetchLinkState: () => Promise<LinkState | null>;
    consentLink: (platform: LinkPlatform) => Promise<LinkState>;
    revokeLink: (platform: LinkPlatform) => Promise<LinkState>;
    postProbe: (body: ProbePayload) => Promise<boolean>;
    sendOrders: (platform: LinkPlatform, raw: unknown[], options?: SendOrdersOptions) => Promise<SendOrdersResult>;
};
export type ReceiptLinkClient = ReturnType<typeof createReceiptLinkClient>;
