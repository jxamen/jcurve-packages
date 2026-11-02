/**
 * 주문 읽기 웹뷰를 어떻게 놓을지 — react-native 를 import 하지 않는 순수 함수(노드에서 시험한다).
 *
 * 읽기는 사용자 눈에 안 보이게 뒤에서 돌린다. 하지만 웹뷰를 「없는 것처럼」 숨기면 읽기가 멈춘다:
 *  - iOS WKWebView 는 isHidden / alpha 0 / 크기 0 이면 타이머 · 렌더를 멈추고 injectJavaScript 도 응답이 늦거나 끊긴다.
 *  - Android WebView 는 visibility 가 숨김(GONE/INVISIBLE)이거나 크기가 0 이면 렌더 · 스크립트가 멈춘다.
 * 그래서 숨김 상태에서도 display:none · opacity:0 · 크기 0 은 쓰지 않는다.
 *  - iOS: 화면 크기 그대로 alpha 0.01 로 목록 뒤에 둔다(보이지 않지만 살아 있다). 크기를 1px 로 줄이면 사이트가 1px 폭으로 그려져
 *    글자 찾기 · 누르기(getBoundingClientRect)가 틀어져서 실제 크기를 쓴다.
 *  - Android: 실제 크기 그대로 화면 밖(left:-5000)에 둔다. 투명도는 건드리지 않는다.
 * 로그인 · 사용자 확인이 필요할 때만 shown — 읽기 영역 전체로 올려 사용자가 직접 조작하게 한다(터치 받음).
 */
export type HostMode = 'hidden' | 'shown';
export type WebHostStyle = {
    position: 'absolute';
    left: number;
    top: number;
    right?: number;
    bottom?: number;
    width?: number;
    height?: number;
    opacity?: number;
    zIndex: number;
};
export type WebHostLayout = {
    style: WebHostStyle;
    pointerEvents: 'none' | 'auto';
};
export declare function webHostLayout(mode: HostMode, os: string, win: {
    width: number;
    height: number;
}): WebHostLayout;
