/** 웹뷰 → 앱 메시지. 페이지가 부른 MocationNativeBridge 함수 이름(method)과 그 인자 */
export type BridgeMessage = {
    method: 'openAppTarget';
    params: {
        url: string;
        fallbackUrl?: string;
    };
} | {
    method: 'showFloatingPopup';
    params: {
        imageUrl: string;
        name: string;
        price: string;
        durationSec: number;
    };
} | {
    method: 'requestOverlayPermission';
    params: Record<string, never>;
} | {
    method: 'hasOverlayPermission';
    params: Record<string, never>;
};
/** react-native-webview 의 onMessage 문자열 → 알려진 메시지. 우리가 심은 shim 이 보낸 것만 받는다(다른 글은 null) */
export declare function parseBridgeMessage(data: unknown, nonce?: string): BridgeMessage | null;
/**
 * openAppTarget — 못 열면 fallbackUrl(스토어 링크 등). 막힌 주소는 열지 않는다.
 * openURL 은 앱이 넘긴다(Linking.openURL). 열었으면 true.
 */
export declare function openAppTarget(params: {
    url: string;
    fallbackUrl?: string;
}, openURL: (url: string) => Promise<unknown>): Promise<boolean>;
