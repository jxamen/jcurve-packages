/** JS-only, best-effort funnel. No SDK keys, user IDs or callback payloads leave this module. */
export type OfferwallFunnelEvent = 'chance_tab_open' | 'offerwall_open' | 'offerwall_close';
export type OfferwallFunnelSend = (event: OfferwallFunnelEvent, prop: string) => unknown;
export declare function configureOfferwallFunnel(sender: OfferwallFunnelSend): void;
export declare function resetOfferwallFunnelContext(): void;
/** Compare locally, retain only a boolean category and public tokens, never the list or member ID. */
export declare function setOfferwallFunnelContext(value: unknown, memberId: unknown): void;
export type OfferwallAttempt = {
    loaded(): void;
    fail(reason: 'not_ready' | 'invalid_usn' | 'sdk_error' | 'timeout' | 'cancelled'): void;
};
export type ChanceFunnel = {
    enter(): void;
    begin(platform: string): OfferwallAttempt;
    close(reason?: 'screen_exit' | 'sdk_close'): void;
};
/** One terminal open result per SDK invocation; duplicate native callbacks are ignored. */
export declare function createChanceFunnel(sender?: OfferwallFunnelSend | undefined): ChanceFunnel;
/** Screen visibility, not button presses. Deferred cleanup ignores React StrictMode's effect replay. */
export declare function useChanceFunnel(): ChanceFunnel;
