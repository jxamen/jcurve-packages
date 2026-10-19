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
export type OfferwallServerConfig = {
    android?: {
        mediaKey?: string;
        hashKey?: string;
    };
    ios?: {
        mediaKey?: string;
        hashKey?: string;
    };
};
/** Call on logout/app switch before fetching the next app's settings. */
export declare function resetOfferwall(): void;
/** Fetch the authenticated app content API. Keys stay in memory and must never be logged. */
export declare function initializeOfferwall({ configUrl, headers }: {
    configUrl: string;
    headers: Record<string, string>;
}): Promise<OfferwallResult>;
/** Explicit injection of fetched SDK keys. Only Android reads bundled plugin keys. */
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
export type OfferwallViewProps = {
    usn: string;
    style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
    onLoaded?: () => void;
    onError?: (result: OfferwallResult) => void;
};
/** SDK ViewType list. Mount only after initializeOfferwall succeeds; unmount on exit/logout. */
export declare function OfferwallView({ usn, style, onLoaded, onError }: OfferwallViewProps): import('react').ReactElement | null;
