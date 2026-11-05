/**
 * 사이트 요청 동작(fetch) — 쿠팡 · 컬리 · 무신사 요청 흐름이 함께 쓰는 범용 요청 묶음(네이버는 영수증 전용 naverReceiptsScript 를 쓴다).
 * 숨은 웹뷰의 **현재 페이지 안에서** fetch 만 부른다(클릭 · 화면 이동 없음, credentials include). 응답은 앱(JS) 안으로만 돌아온다 — 서버 · 로그로 보내지 않는다.
 * 모양이 다른 응답은 흐름(TypeScript)이 이름으로 찾는다 — 그래서 응답 JSON 을 가볍게 줄여(긴 글자 · 긴 배열 · 깊이 제한) 통째로 돌려준다.
 * react-native 를 import 하지 않는다(노드의 vm 으로 이 스크립트 자체를 시험한다).
 */
/**
 * 요청 한 건. url 은 https 절대 주소(흐름이 열어도 되는 호스트 안) 또는 현재 페이지 기준 경로다.
 *  as: json 응답 JSON(data) · nextData 응답 HTML 의 <script id="__NEXT_DATA__"> 안 JSON(data) · html 응답 원문 그대로(text, 앞 120,000자 — 올리브영처럼 data-* 속성에 값이 있는 HTML) ·
 *      text 응답 글자(text) — 본문이 JSON 이면 줄인 JSON 도 data 로 함께 주고, HTML 이면 script · style · 태그를 걷은 글자를 text 로(HTML 안에 <script id="__NEXT_DATA__"> 가 있으면 그 JSON 도 data 로) 준다
 *  body 는 POST 의 JSON 글자(content-type: application/json 으로 보낸다). form 이 true 면 body 를 그대로 application/x-www-form-urlencoded 로 보낸다(KSNET 영수증 JSON)
 */
export type FetchReq = {
    key: string;
    method: 'GET' | 'POST';
    url: string;
    body?: string;
    as: 'json' | 'nextData' | 'text' | 'html';
    accept?: string;
    form?: boolean; /** true 면 x-requested-with: XMLHttpRequest 를 붙인다(올리브영 JSON 주소가 화면과 같은 머리말을 기대할 때) */
    xhr?: boolean;
};
/**
 * st: ok 응답을 읽음 · login 로그인이 풀림(401 · 로그인 주소로 되돌려짐) · blocked 사이트가 막음(403 · 429) · net 요청 실패 · 시간 초과(교차 출처 거절도 여기) ·
 *     http 그 밖의 오류 응답(status 에 번호) · shape 응답이 기대한 모양이 아님(JSON 아님 · __NEXT_DATA__ 없음)
 */
export type FetchStatus = 'ok' | 'login' | 'blocked' | 'net' | 'http' | 'shape';
/** data: 줄인 JSON(as=json · nextData, as=text 인데 본문이 JSON 일 때) · text: as=text 의 글자(앞 120,000자 — JSON 이면 원문, HTML 이면 태그를 걷은 글자) */
export type FetchResult = {
    key: string;
    st: FetchStatus;
    status?: number;
    data?: unknown;
    text?: string; /** 4xx 본문의 오류 코드 이름(영문 소문자 · 숫자 16자 이하)만 — 기록용 */
    why?: string;
};
export type FetchRun = {
    reqs: FetchReq[];
    conc: number;
    staggerMs: number;
    gapMs: number;
    timeoutMs: number;
    deadlineMs: number;
};
/** 한 번에 보내는 최대 요청 수 · 기본 동시 수 · 첫 요청 간격 · 요청 시간 제한 · 전체 마감(구동기 감시 20초보다 짧게). 막혔을 때는 FETCH_SLOW 로 늦춘다 */
export declare const FETCH_BATCH = 6;
export declare const FETCH_CONC = 3;
export declare const FETCH_STAGGER_MS = 200;
export declare const FETCH_TIMEOUT_MS = 9000;
export declare const FETCH_DEADLINE_MS = 16000;
export declare const FETCH_SLOW: {
    readonly batch: 2;
    readonly conc: 1;
    readonly gapMs: 1200;
};
/** 응답 줄이기 한도 — 글자 300자 · 배열 400칸 · 깊이 24(Next.js dehydratedState 처럼 깊이 든 주문 안쪽 객체까지) · 결과 하나 300KB(넘으면 배열을 더 줄이고, 그래도 넘으면 shape) */
export declare const FETCH_PRUNE: {
    readonly str: 300;
    readonly arr: 400;
    readonly depth: 24;
    readonly bytes: 300000;
};
/** 진행 중인 요청을 모두 끊는다(구동기 stop 이 넣는다) */
export declare const ABORT_FETCH_SCRIPT = "try{window.__ytAbortFetch&&window.__ytAbortFetch();}catch(e){};true;";
export declare const checkFetchRun: (r: FetchRun) => void;
