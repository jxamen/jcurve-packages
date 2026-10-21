import type { Requester } from './entry';
export declare function useCoupangVisit(request: Requester, refreshKey?: unknown): {
    status: import("./coupang").CoupangStatus;
    visible: boolean;
    start: () => void;
    toast: string | null;
};
