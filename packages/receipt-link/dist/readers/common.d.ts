/**
 * 사이트별 주문 읽기 스크립트의 공통 틀. 웹뷰 안에서 실행되는 자바스크립트 문자열 하나(`script`)를 만든다.
 *
 * 앱 쪽 약속(영테크 harness, 앱보조5): 스크립트는 즉시실행함수, 외부 의존 없음. 읽은 결과를
 *   window.ReactNativeWebView.postMessage(JSON.stringify({ type:'orders', site, orders:[{orderNo, orderedAt, amount, seller, title, payment}], done, note? }))
 * 로 보낸다. 한 번에 최대 50건, 최근 30일 것만. 더 있으면 done:false — 앱이 같은 스크립트를 다시 부르면 다음 묶음을 보낸다.
 * 못 읽으면 orders:[] 와 note(짧은 영문/숫자 코드: login_needed · no_list_found · wrong_page · error · fetch_failed …).
 *
 * 개인정보: 보내는 칸은 위 여섯 개뿐이다. 수취인 · 주소 · 전화 · 카드번호 · 쿠키 · 토큰은 읽어도 여기서 버려지고(`clean`), 사이트별 본문(body)도 읽지 않는다.
 */
export declare const ORDER_SITES: readonly ["naver_shop", "naver_pay", "musinsa", "kurly"];
export type OrderSite = (typeof ORDER_SITES)[number];
/** 앱으로 가는 주문 한 건 — 이 여섯 칸이 전부 */
export type ReaderOrder = {
    orderNo: string;
    orderedAt: string;
    amount: number;
    seller?: string;
    title?: string;
    payment?: string;
};
/** `shape` 는 목록을 못 읽었을 때(note 가 no_list_found · wrong_page · error) 한 번만 붙는 진단용 화면 모양(요소 이름 · 클래스 · data- 이름 · 날짜/금액/긴 숫자 글자가 몇 개인지 — 글자 내용은 없음). 앱이 모르는 칸은 무시해도 된다. */
export type ReaderShape = {
    host: string;
    path: string;
    outline: string[];
    hits: {
        date: number;
        money: number;
        longNumber: number;
    };
};
export type OrdersMessage = {
    type: 'orders';
    site: OrderSite;
    orders: ReaderOrder[];
    done: boolean;
    note?: string;
    shape?: ReaderShape;
};
export declare const READER_WINDOW_DAYS = 30;
export declare const READER_BATCH = 50;
/**
 * 본문(body) 안에서 `H` 로 쓰는 도우미들. 본문은 `(state, H)` 를 받는 함수 몸통이고 `{ orders, done, note? }` 또는 그것의 Promise 를 돌려준다.
 *  - orders : 이번에 읽은 주문들(여섯 칸, 모자란 칸은 `clean` 이 거른다). 50건보다 많아도 된다 — 틀이 50건씩 나눠 보낸다.
 *  - done   : 더 읽을 쪽이 없으면 true. false 면 앱이 같은 스크립트를 다시 부르고, 본문은 `state`(같은 페이지에서 유지되는 객체)에 커서를 두고 이어 읽는다.
 *  - H.text(el) 공백 정리한 글자 · H.money('12,300원') → 12300 · H.kst('2026.10.28 18:30' | '10/28' | 1761640000000 | Date) → 'YYYY-MM-DD HH:mm'(KST) 또는 null ·
 *    H.recent(orderedAt) 최근 30일 안인가 · H.sleep(ms) · H.waitFor(fn, ms) 조건이 참이 될 때까지(없으면 null) · H.q(sel, root) / H.qa(sel, root) · H.now()
 */
export declare const HELPERS_JS: string;
/** 사이트 본문을 틀에 끼워 웹뷰에서 돌릴 스크립트 문자열을 만든다. */
export declare function buildScript(site: OrderSite, body: string): string;
