export declare const KURLY_URL = "https://www.kurly.com/mypage/order";
export declare const KURLY_BODY_V1: string;
/**
 * 2차(10-28 저녁): 대표님 캡처의 실제 글자로 읽는다(앱보조5 전달) — 제목 「주문 내역」 · 기간 「3년 ▾」 · 묶음 머리 「2025.09.28」(주문 날짜) 아래
 * 「주문번호 13자리」(옆 「>」 로 상세) · 「배송완료 9.29(월) 03:08」 · 「총 7건 주문 펼쳐보기」. 목록에는 금액이 안 보이므로(확인 못 함) 각 주문은
 * `needsDetail:true`(금액 없음)로 내고, 상세(`KURLY_DETAIL_SCRIPT`)가 결제금액 · 결제 일시(초)를 채운다. 읽은 게 없으면 1차(KURLY_BODY_V1, 가정 배치)로 넘어간다.
 */
export declare const KURLY_BODY: string;
export declare const KURLY_SCRIPT: string;
