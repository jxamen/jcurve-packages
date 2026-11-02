/**
 * 영수증 읽기 흐름 공통 조각 — 사이트별 흐름(네이버 · 쿠팡 · 컬리 · 무신사)이 같이 쓴다(2026-10-28).
 * naverReceipt.ts 의 NAV_HELPERS_SCRIPT 가 먼저 주입돼 `window.__yt` 가 있다는 전제다.
 */
/**
 * 컬리 · 무신사 영수증은 새 탭/새 창(window.open · target=_blank)으로 열린다(대표님 20:00). 웹뷰는 새 창을 못 열어 아무 일도 안 일어나므로
 * `window.open` 을 같은 창 이동으로 바꾸고, 클릭 직전의 a[target] 을 `_self` 로 바꾼다. 문서가 로드되기 전(injectedJavaScriptBeforeContentLoaded)과
 * 클릭 전(injectJavaScript) 어디서든 한 번만 적용된다. eval · 저장소 · 쿠키 · 네트워크 없음.
 */
export declare const NEUTRALIZE_NEW_WINDOW_SCRIPT: string;
/**
 * 숨김 웹뷰에서 사이트가 띄우는 alert · confirm · prompt 를 삼킨다(2026-10-28). react-native-webview 는 iOS 에서 JS alert 를 네이티브 UIAlertController 로 그대로 보여 줘서
 * 보이지 않는 곳에서 읽는 중인데도 사용자 화면 위에 「영수증 조회에 실패하였습니다…」 같은 알림이 떴다. 네이티브는 OTA 로 못 고쳐 JS 로 막는다.
 * 문서가 로드되기 전(injectedJavaScriptBeforeContentLoaded)에 넣고, 두 번 적용돼도 한 번만 감싼다.
 *  - 기본(window.__ytQuiet 가 0 이 아님)은 조용히: alert 는 아무것도 안 하고, confirm 은 false, prompt 는 null.
 *  - window.__ytQuiet = 0 이면(사용자에게 웹뷰를 보여 주는 동안: 로그인 · 확인) 원래 함수로 통과 — 비밀번호 오류 같은 알림은 그대로 보여야 한다(setQuietScript).
 *    단 「로그인이 필요하다」는 뜻의 alert 만은 보이는 동안에도 삼킨다: 컬리가 「로그인하셔야 본 서비스를 이용하실 수 있습니다」를 띄우고 확인을 누를 때까지
 *    로그인 화면으로 넘기지 않아, 사용자가 로그인 입력 화면을 못 봤다(A32 3차 시험). confirm · prompt 는 보이는 동안 그대로 통과.
 *    「재로그인 후 다시 시도해주세요」처럼 실패를 알리는 문구(재로그인)는 로그인이 필요하다는 뜻이 아니라 그대로 통과한다.
 *  - 가로챌 때마다 {type:'dialog', kind, len, fail} 만 앱에 보낸다(보이는 동안 삼킨 로그인 알림은 fail:false, login:true). 메시지 글자는 담지 않는다.
 * eval · 저장소 · 쿠키 · 네트워크 없음.
 */
export declare const QUIET_DIALOGS_SCRIPT: string;
/** 웹뷰를 사용자에게 보여 주면(quiet=false) 알림을 그대로 통과시키고, 다시 숨기면(quiet=true) 삼킨다. injectJavaScript 로 보낸다 */
export declare const setQuietScript: (quiet: boolean) => string;
/**
 * 글자로 찾은 요소(또는 그 조상 a[href])의 주소만 알려 준다 — 클릭하지 않는다. 새 창으로 열리는 링크의 주소를 호스트가 직접 열 때 쓴다.
 * 결과: postMessage({type:'nav', step:'href', ok, label, href}) — href 는 같은 사이트 https 주소만, javascript: · 로그인 · 삭제 글자가 든 요소는 거절.
 * 주소의 쿼리에는 토큰이 들 수 있어 **서버로 올리지 않는다**(호스트가 화면 이동에만 쓴다).
 */
export declare function hrefByTextScript(labels: string[], index?: number): string;
/** 새 창 주소를 받았을 때 호스트가 같은 웹뷰로 열어도 되는 주소인가 — https, 허용 도메인(하위 포함), 로그인 · 삭제 글자 없음 */
export declare function isOpenableUrl(url: string, hosts: readonly string[]): boolean;
