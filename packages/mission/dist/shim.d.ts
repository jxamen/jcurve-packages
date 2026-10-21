/**
 * 웹페이지가 부르는 MocationNativeBridge 를 react-native-webview 위에 만들어 주는 글(페이지가 열리기 전에 심는다).
 *  - Android 방식: window.MocationNativeBridge.openAppTarget(JSON 문자열) …(addJavascriptInterface 와 같은 모양)
 *  - iOS 방식   : window.webkit.messageHandlers.MocationNativeBridge.postMessage({ message: 'openAppTarget', url, fallbackUrl })
 * 페이지가 「MocationNativeBridge 가 있으면 Android」로 가를 수 있어, **그 기기의 방식 하나만** 심는다.
 * 오버레이(다른 앱 위에 표시)는 네이티브 모듈이 있어야 해서 이 OTA 판에서는 hasOverlayPermission 이 항상 false 다(overlay 인자로 켠다).
 */
export type ShimPlatform = 'ios' | 'android';
export declare function bridgeShim(platform: ShimPlatform, overlay?: boolean, nonce?: string): string;
