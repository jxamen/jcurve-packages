/** Native SDK is required lazily: importing this package works before keys/SDK exist. */
export type OfferwallResult = {
    ok: true;
} | {
    ok: false;
    reason: 'not_ready' | 'invalid_usn' | 'sdk_error';
    message: string;
};
export type RewardInfo = {
    queryResult: boolean;
    totalCount: number;
    totalReward: string;
};
export type OfferwallConfig = {
    appKey?: string;
    hashKey?: string;
    title?: string;
    color?: string;
};
/** Optional override for bare RN. Expo apps read config-plugin's extra automatically. */
export declare function configureOfferwall(options: OfferwallConfig): void;
export declare function openOfferwall({ usn }: {
    usn: string;
}): OfferwallResult;
/** Total reward arrives via SDK event. Timeout always removes the subscription. */
export declare function getOfferwallTotalRewardInfo({ usn, timeoutMs }: {
    usn: string;
    timeoutMs?: number;
}): Promise<OfferwallResult & {
    info?: RewardInfo;
}>;
export declare function onOfferwallClosed(callback: () => void): () => void;
/** Stable callback recommended. Closing the SDK is a good time to refresh server balance. */
export declare function useOfferwallClosed(callback: () => void): void;
