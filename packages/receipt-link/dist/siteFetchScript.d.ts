/**
 * 사이트 요청 동작(fetch)의 웹뷰 스크립트 — 숨은 웹뷰의 현재 페이지 안에서 요청만 부른다(클릭 · 화면 이동 없음, credentials include).
 * 응답은 줄여서(FETCH_PRUNE) {step:'fetched'} 한 번으로 앱 안에 돌려준다. 요청마다 시간 제한이 있고 전체 마감도 있어 구동기의 20초 감시보다 먼저 답한다.
 * window.__ytAbortFetch() 로 즉시 멈출 수 있다. 타입 · 한도는 siteFetch.ts. react-native 를 import 하지 않는다(노드 vm 으로 이 스크립트 자체를 시험한다).
 */
import { type FetchRun } from './siteFetch';
export declare function fetchScript(r: FetchRun): string;
