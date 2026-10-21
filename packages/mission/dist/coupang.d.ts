import type { Requester } from './entry';
export declare const COUPANG_DISCLOSURE = "\uC774 \uAC8C\uC2DC\uBB3C\uC740 \uCFE0\uD321 \uD30C\uD2B8\uB108\uC2A4 \uD65C\uB3D9\uC758 \uC77C\uD658\uC73C\uB85C, \uC774\uC5D0 \uB530\uB978 \uC77C\uC815\uC561\uC758 \uC218\uC218\uB8CC\uB97C \uC81C\uACF5\uBC1B\uC2B5\uB2C8\uB2E4.";
export type CoupangStatus = {
    enabled: boolean;
    test_only: boolean;
    eligible: boolean;
    today_done: boolean;
    visit_point: number;
};
export declare function parseCoupangStatus(value: unknown): CoupangStatus;
export declare const coupangVisible: (s: CoupangStatus) => boolean;
export declare function isCoupangUrl(value: unknown): value is string;
/** One controller per mounted list/account. Consume a visit before awaiting complete. */
export declare class CoupangVisit {
    private request;
    private open;
    private changed;
    private notice;
    status: {
        enabled: boolean;
        test_only: boolean;
        eligible: boolean;
        today_done: boolean;
        visit_point: number;
    };
    private pending;
    private away;
    private starting;
    private completing;
    private alive;
    private revision;
    constructor(request: Requester, open: (url: string) => Promise<unknown>, changed: (status: CoupangStatus) => void, notice: (message: string) => void);
    dispose(): void;
    activate(): void;
    refresh(): Promise<void>;
    start(): Promise<void>;
    appState(state: string): Promise<void>;
}
