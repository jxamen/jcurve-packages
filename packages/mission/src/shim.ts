/**
 * 웹페이지가 부르는 MocationNativeBridge 를 react-native-webview 위에 만들어 주는 글(페이지가 열리기 전에 심는다).
 *  - Android 방식: window.MocationNativeBridge.openAppTarget(JSON 문자열) …(addJavascriptInterface 와 같은 모양)
 *  - iOS 방식   : window.webkit.messageHandlers.MocationNativeBridge.postMessage({ message: 'openAppTarget', url, fallbackUrl })
 * 페이지가 「MocationNativeBridge 가 있으면 Android」로 가를 수 있어, **그 기기의 방식 하나만** 심는다.
 * 오버레이(다른 앱 위에 표시)는 네이티브 모듈이 있어야 해서 이 OTA 판에서는 hasOverlayPermission 이 항상 false 다(overlay 인자로 켠다).
 */
export type ShimPlatform = 'ios' | 'android';

export function bridgeShim(platform: ShimPlatform, overlay = false, nonce = ''): string {
  const n = JSON.stringify(String(nonce));
  const common = `
  var isTop = function () { try { return window.top === window; } catch (e) { return false; } };
  var send = function (method, params) {
    if (!isTop()) return;   // iframe 안에서 만들어진 호출은 보내지 않는다
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ m: 'MocationNativeBridge', n: ${n}, t: 1, method: method, params: params || {} })); } catch (e) {}
  };
  var parse = function (p) { if (typeof p === 'string') { try { return JSON.parse(p); } catch (e) { return {}; } } return p || {}; };`;
  if (platform === 'android') {
    return `(function () {
  if (window.MocationNativeBridge) return;${common}
  window.MocationNativeBridge = {
    openAppTarget: function (p) { send('openAppTarget', parse(p)); },
    showFloatingPopup: function (p) { send('showFloatingPopup', parse(p)); },
    requestOverlayPermission: function () { send('requestOverlayPermission'); },
    hasOverlayPermission: function () { return ${overlay ? 'true' : 'false'}; }
  };
})(); true;`;
  }
  return `(function () {${common}
  var ours = { postMessage: function (body) {
    var b = parse(body);
    if (b && b.message === 'openAppTarget') send('openAppTarget', { url: b.url, fallbackUrl: b.fallbackUrl });
  } };
  try {
    window.webkit = window.webkit || {};
    var mh = window.webkit.messageHandlers;
    if (mh && typeof mh === 'object') { try { mh.MocationNativeBridge = ours; } catch (e) {} }
    if (!(window.webkit.messageHandlers && window.webkit.messageHandlers.MocationNativeBridge)) {
      var wrapped = typeof Proxy === 'function' && mh ? new Proxy(mh, { get: function (t, k) { return k === 'MocationNativeBridge' ? ours : t[k]; } }) : { MocationNativeBridge: ours };
      Object.defineProperty(window.webkit, 'messageHandlers', { value: wrapped, configurable: true });
    }
  } catch (e) {}
})(); true;`;
}
