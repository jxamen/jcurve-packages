export declare const TAP_MAX_DEPTH = 7;
export declare const TAP_MAX_KEYS = 60;
/** 한 번에 줄 수 상한(서버 구조 기록의 outline 한도 300) */
export declare const TAP_MAX_LINES = 300;
export declare const TAP_MAX_LINE = 200;
/** 페이지(문서) 하나에서 보내는 tap 상한 */
export declare const TAP_MAX_PER_PAGE = 10;
/** tap 을 거는 호스트 — 이 밖의 요청은 보지 않는다 */
export declare const TAP_HOSTS: string[];
export declare const TAP_TARGETS: readonly ["order-histories", "card-single", "card-single-B", "issue-history", "api", "nextdata"];
export type TapTarget = (typeof TAP_TARGETS)[number];
/** 쌍 찾기 상한 */
export declare const PAIR_MAX_DEPTH = 10;
export declare const PAIR_MAX_NODES = 5000;
/** __NEXT_DATA__ 에서 쌍을 찾은 뒤 읽기 전용 GET 을 부르기까지 기다리는 시간 — 호스트가 이미 한 번 불렀다고 알릴 틈(window.__ytNoPair) */
export declare const TAP_PAIR_DELAY_MS = 1200;
export declare const TAP_PAIR_API_PATH = "/web-api/receipts/card-single";
/**
 * 키 이름 → 서버가 받는 글자만. 이메일 모양은 통째로 :e, 4자리 이상 숫자는 :n(7자리 · 전화 · 번호 모양을 피한다), 24자 이상 긴 토큰은 앞 8자 + ~,
 * 한글은 가, 허용 밖 글자(. [ ] $ @ 등)는 _ . 경로에서 쓰는 . 과 [ ] 도 이름 안에서는 _ 로 바꾼다.
 */
export declare function safeKey(k: string): string;
/** 객체 → 「경로 : 형태」 줄들(너비 우선이라 위쪽 구조가 먼저 나온다). 값은 읽지 않는다 */
export declare function walkShape(root: unknown): string[];
/**
 * 한 JSON 안에서 같은 객체에 키 이름이 정확히 paymentId 와 tid 둘 다 있고 두 값이 비어 있지 않은 문자열 · 숫자인 첫 번째 객체의 쌍(깊이 10, 객체 5000개 상한, 문서 순서).
 * 값은 호출 주소를 만드는 데만 쓴다 — 어디에도 기록하지 않는다.
 */
export declare function findPaymentPair(root: unknown): {
    paymentId: string | number;
    tid: string | number;
} | null;
/** safeKey 와 같은 함수 식 */
export declare const SAFE_KEY_JS: string;
/** walkShape 와 같은 함수 식 */
export declare const SHAPE_WALK_JS: string;
/** findPaymentPair 와 같은 함수 식 */
export declare const FIND_PAIR_JS: string;
/** 호스트가 새 문서마다 넣는 한 줄 — 이미 쌍 호출 기록이 있으면 이 문서에서는 부르지 않는다(다 막지는 못하는 최선의 방법: 호출은 쌍을 찾고 TAP_PAIR_DELAY_MS 뒤에 한다) */
export declare const NO_PAIR_SCRIPT = "window.__ytNoPair=1;true;";
/**
 * 주입 스크립트(문서 시작 시점, probe 일 때만). 이미 심었으면 다시 심지 않는다. 원래 응답 · 호출은 바꾸지 않고 예외는 모두 삼킨다.
 *  a. fetch · XHR 을 감싸 TAP_HOSTS 호스트의 JSON 응답 구조를 {type:'tap', target, host, path, apiPath, apiHost, queryKeys, lines} 로 앱에 보낸다.
 *     target: 주소에 order-histories → order-histories · receipts/card-single → 쿼리 키에 payId 면 card-single(A), paymentId 면 card-single-B · 페이지가 /receipts/issue-history → issue-history · 그 밖 api.
 *     같은 target + 호스트 + 경로 모양은 한 번, 페이지당 TAP_MAX_PER_PAGE 개. apiPath 는 숫자를 가린 경로이고 쿼리는 키 이름만 queryKeys 로 보낸다(값 없음).
 *  b. __NEXT_DATA__ 의 구조를 {type:'tap', target:'nextdata', …} 로 보낸다.
 *  c. pay.naver.com 이면 __NEXT_DATA__ 에서 paymentId · tid 쌍(첫 쌍 하나)을 찾아 같은 출처로 card-single GET 을 한 번만 부른다. 응답 구조는 (a)의 감싸기가 기록한다.
 *     쌍이 없으면 호출하지 않고 'none : pair-not-found' 만, 호출이 실패하면(HTTP 오류 · JSON 아님) 'none : http-error' 만 기록한다. 쌍의 값은 주소를 만드는 데만 쓴다.
 */
export declare const SHAPE_TAP_SCRIPT: string;
export type TapRecord = {
    target: TapTarget;
    host: string;
    path: string;
    apiHost: string;
    apiPath: string;
    queryKeys: string[];
    lines: string[];
};
/** 웹뷰가 보낸 tap 메시지 한 덩이를 검사해 읽는다. 모양이 틀리면 null */
export declare function parseTapMessage(m: unknown): TapRecord | null;
/** 같은 화면 모양 + target + 요청 경로는 한 번만 올린다. 「없음」 기록은 구조 기록과 따로 센다 */
export declare function tapKey(r: TapRecord): string;
/** 서버 구조 기록(buildPayload)이 받는 raw. 구조 줄만 outline 에 담는다 — 요청 목록 · 쿠키 이름은 비운다 */
export declare function tapRaw(r: TapRecord): {
    host: string;
    path: string;
    queryKeys: string[];
    cookieNames: string[];
    outline: string[];
    repeat: Record<string, number>;
    requests: [];
};
