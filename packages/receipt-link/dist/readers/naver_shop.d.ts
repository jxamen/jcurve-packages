/**
 * 네이버 쇼핑 주문/배송 목록 읽기. 증거 등급은 각 항목 옆 주석에 적었다.
 *  - confirmed : 공개 자료에서 실제로 확인한 것
 *  - assumed   : 확인 못 한 추정. 방어용 대체 경로일 뿐이다.
 *
 * 이 파일을 쓸 때 공개 자료 조회는 전부 막혔다(shopping.naver.com · order.pay.naver.com 직접 조회 거부,
 * 웹 검색은 네이버 주문 API 자료를 찾지 못함). 그래서 주소 · 화면 구조 · JSON 응답 모양은 모두 assumed 이다.
 *
 * 개인정보: 여섯 칸(orderNo, orderedAt, amount, seller, title, payment)만 골라 돌려준다.
 * 수령인 · 주소 · 전화 · 카드번호 칸은 읽지도 않는다(클래스 이름에 recei/addr/phone/card 등이 있으면 건너뜀).
 */
export declare const NAVER_SHOP_URL = "https://order.pay.naver.com/orderStatus";
/**
 * 본문. 웹뷰 안에서 `(state, H)` 를 받아 실행된다. 사이트 전용 상수는 여기 안에 둔다.
 *  - 로그인 검사: 주소가 nid.naver.com 이거나 password 입력칸이 있으면 login_needed — assumed(네이버 로그인 페이지 형태 추정)
 *  - 목록 칸: data-order-no / data-orderno, 클래스 이름 부분 일치(OrderItem, orderItem, order_item, OrderList li) — assumed
 *  - 주문번호: data-order-no 속성 또는 본문의 16자리 `20YY…` 숫자 — assumed (16자리 형식은 사용자 설명, 화면 확인 못 함)
 *  - 날짜: 본문의 `20YY.MM.DD` 또는 `20YY-MM-DD` (+ 시각) — assumed
 *  - 금액: `실결제`/`결제금액`/`총 결제` 뒤의 N,NNN원 우선, 없으면 첫 N원 — assumed
 *  - 판매처/상품: 클래스 부분 일치(store·mall·seller / product·goods·name·title) — assumed
 *  - 결제수단: 본문의 짧은 단어(네이버페이·카드·계좌이체 등) — assumed
 *  - 더보기: 글자 「더보기」 버튼을 눌러 다음 묶음 — assumed
 *  - 빈 목록: 「주문 내역이 없」 문구 — assumed
 * JSON 엔드포인트는 확인한 것이 없어서 쓰지 않는다(fetch 없음 → fetch_failed 는 나지 않음).
 */
export declare const NAVER_SHOP_BODY: string;
export declare const NAVER_SHOP_SCRIPT: string;
