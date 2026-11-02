/**
 * 영테크 「불러오기」 주문 읽기 — 사이트별 주소와 웹뷰에서 돌리는 스크립트. 자동 생성(packages/receipt-link/scripts/gen-standalone-readers.cjs, deb3426). 직접 고치지 말고 src/readers 에서 고친다.
 * script 는 즉시실행함수(끝에 true;), 외부 의존 없음. postMessage({type:"orders", site, orders:[{orderNo,orderedAt,amount,seller,title,payment}], done, note?, shape?}) — 한 번에 50건 · 최근 30일 · 같은 script 를 다시 부르면 다음 묶음.
 * 로그인된 실제 화면은 확인하지 못했다 — 모든 선택자는 가정(첫 실행으로 확인). 목록을 못 읽으면 note(no_list_found · wrong_page · login_needed · error)와, no_list_found/wrong_page/error 일 때 한 번 글자 없는 화면 모양 shape 를 보낸다.
 */
export type OrderSite = 'naver_shop' | 'naver_pay' | 'musinsa' | 'kurly' | 'coupang';
export declare const ORDER_PAGES: Record<OrderSite, {
    url: string;
    script: string;
}>;
