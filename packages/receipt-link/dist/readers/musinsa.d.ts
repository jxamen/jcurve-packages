/**
 * 무신사 주문내역 목록. 출처: 사용자 지정 주소. 공개 페이지 본문은 확인되지 않음(WebFetch 가 제목만 돌려줌) — 아래 본문의 모든 선택자는 "assumed — defensive fallback".
 * 로그아웃 시 동작: 공개 근거 없음 — 본문은 로그인 페이지 경로(/login)나 비밀번호 입력칸을 보면 login_needed 로 끝낸다(assumed).
 */
export declare const MUSINSA_URL = "https://www.musinsa.com/order/order-list";
/**
 * 본문(BODY)은 (state, H) 를 받는 함수 몸통. 무신사 내부 JSON 엔드포인트는 공개 근거가 없어 쓰지 않는다(확인되면 1단계로 추가).
 * 1) DOM: data-order-no / 주문상세 링크(orderNo= 또는 /order-detail/<no>) — assumed
 * 2) 글자 패턴: 「주문번호 …」 · 「20xx.MM.DD」 · 「결제금액 N,NNN원」 · 첫 「N,NNN원」 — assumed
 * 3) 더보기 버튼 반복 클릭, 가장 오래된 행이 30일 밖이면 멈춤.
 * 취소완료 · 반품완료 · 환불완료 가 붙은 행은 건너뛴다.
 * 개인정보: 행 글자는 정규식으로만 읽고 저장하지 않는다. 보내는 칸은 여섯 개뿐(틀이 거른다).
 */
export declare const MUSINSA_BODY: string;
export declare const MUSINSA_SCRIPT: string;
