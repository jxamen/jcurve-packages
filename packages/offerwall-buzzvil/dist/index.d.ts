export type Result = {
    ok: true;
} | {
    ok: false;
    reason: 'not_ready' | 'invalid_usn' | 'sdk_error';
    message: string;
};
export type Config = {
    appId?: string;
    unitId?: string;
};
/** Clear before logout/app switch; also invalidates asynchronous SDK login. */
export declare function resetOfferwall(): void;
export declare function initializeOfferwall({ configUrl, headers }: {
    configUrl: string;
    headers: Record<string, string>;
}): Promise<Result>;
/** Resolves after native login and presentation request, never grants points. */
export declare function openOfferwall({ usn }: {
    usn: string;
}): Promise<Result>;
