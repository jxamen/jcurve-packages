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
type Picked = {
    appKey: string;
    hashKey: string;
    source: 'expoConfig' | 'embedded' | 'server' | 'none';
};
/** (0.2.2) 번들 표식 — OTA 발행 검사(배포2)가 번들 문자열에서 「키를 빌드 · 서버에서도 찾는 판」인지 본다 */
export declare const OFFERWALL_KEYS_MARK = "jcurve-offerwall-keys:expoConfig>embedded>server";
export type BuiltOfferwallKeys = {
    appKey: string;
    hasAppKey: boolean;
    hasHashKey: boolean;
    source: Picked['source'];
};
/**
 * (0.2.2) 이 기기에서 쓸 오퍼월 키 — 앱의 키 가드(offerwallKeyGuard)가 Constants.expoConfig.extra 대신 이것을 본다.
 * appKey(매체 키)는 서버 mediaKey 와 맞대야 해서 값을 주고, hashKey 는 있음/없음만 준다(값은 내보내지 않는다).
 */
export declare function builtOfferwallKeys(): BuiltOfferwallKeys;
/**
 * (0.2.2) 1 · 2 가 다 비었으면 서버 키까지 — `fetcher` 는 앱이 준다(앱 api 주소 · 토큰을 패키지가 모르게): content/config/adpopcorn 응답 JSON 을 돌려준다.
 * 받은 키는 SDK 를 열 때도 쓴다(안드로이드 options). 실패하면 조용히 none
 */
export declare function resolveOfferwallKeys(fetcher?: () => Promise<unknown>): Promise<BuiltOfferwallKeys>;
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
export { OfferwallScreen, OFFERWALL_SCREEN_MARK } from './OfferwallScreen';
export type { OfferwallScreenProps } from './OfferwallScreen';
export * from './combos';
export * from './comboEntry';
export * from './campaigns';
export * from './comboDone';
