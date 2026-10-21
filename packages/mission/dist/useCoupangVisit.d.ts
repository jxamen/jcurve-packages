import type { Requester } from './entry';
import { CoupangVisit } from './coupang';
export declare function useCoupangVisit(request: Requester, refreshKey?: unknown): {
    shortVisit: {
        owner: CoupangVisit;
        seconds: number;
        points: number;
    } | null;
    closeShortVisit: () => void;
    status: import("./coupang").CoupangStatus;
    visible: boolean;
    start: () => void;
    toast: string | null;
};
