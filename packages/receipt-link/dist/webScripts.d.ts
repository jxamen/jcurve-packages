/**
 * 주문 읽기 웹뷰에 문서가 로드되기 전에 심는 스크립트 모음 — react-native 를 import 하지 않는 순수 함수(노드에서 시험한다).
 *  1) 새 창 막기: window.open · target=_blank 를 같은 창으로(로그인 화면의 새 창 · 사이트가 띄우는 새 창이 아무 일도 안 일어나게 두지 않는다)
 *  2) 알림 삼키기: 숨김 웹뷰의 alert · confirm · prompt 가 사용자 화면 위에 네이티브 알림으로 뜨지 않게(웹뷰를 보여 줄 때만 통과 — OrderImportView 가 __ytQuiet 로 켜고 끈다)
 * 8차부터 요청 흐름만 쓰므로 응답 속 번호 가로채기 · 글자 찾기 · 누르기 도구 · 사이트별 가로채기는 심지 않는다(페이지가 부르는 응답을 읽는 스크립트가 없다).
 * 모두 쿠키 · 저장소를 읽지 않는다.
 */
import type { FlowSite } from './flows';
/** extra: 대표님 계정의 구조 기록 관찰 래퍼처럼 호스트가 더 얹는 스크립트 */
export declare function beforeContentLoadedScripts(_site: FlowSite, extra?: readonly string[]): string[];
/** 하나로 이은 스크립트(각 스크립트는 끝에 `true;` 가 있어 줄바꿈으로 이으면 된다) */
export declare function beforeContentLoaded(site: FlowSite, extra?: readonly string[]): string;
