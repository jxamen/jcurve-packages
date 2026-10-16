export type Channel = 'shopping' | 'place';
export type WebRow = {
    id: string;
    link: string;
    title: string;
    mallName: string;
    rank: number;
    total?: number;
    photo?: string | null;
    reviews?: number | null;
};
export declare class CollectorError extends Error {
    code: string;
    evidence: string;
    constructor(code: string, evidence?: string);
}
export declare function withCollectorDiagnostic(error: Error, diagnostic?: string): Error;
export type Job = {
    channel: Channel;
    keyword: string;
    placeId?: string;
    shoppingMatch?: (rows: WebRow[]) => boolean;
    signal: AbortSignal;
    diagnostic?: string;
    resolve: (rows: WebRow[]) => void;
    reject: (e: Error) => void;
};
export declare function attachCollector(handler: (job: Job) => void): () => void;
export declare function collectWeb(channel: Channel, keyword: string, placeId?: string, shoppingMatch?: (rows: WebRow[]) => boolean): Promise<WebRow[]>;
export declare function blockReason(text: string, url: string): "blocked_limit" | "captcha" | "blocked_login" | undefined;
export declare function subscribeCollectorFailure(listener: (error: CollectorError) => void): () => void;
export declare function reportCollectorFailure(error: CollectorError): void;
