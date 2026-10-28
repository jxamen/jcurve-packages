/**
 * 주문 상세 화면 읽기(영수증 한 장). 사이트마다 화면 구조를 확인하지 못해서 **글자 라벨 기반**으로 읽는다(전부 「가정」):
 * 화면의 글자 조각들을 순서대로 모은 뒤 「주문번호 · 결제일시/주문일시 · 실결제/최종결제/결제금액 · 결제수단 · 판매자/판매처/스토어 · 상품명」 라벨을 찾고,
 * 같은 조각 안의 「라벨: 값」 이나 바로 뒤 조각(최대 3개 안, 다른 라벨을 만나면 멈춤)을 값으로 쓴다. dt/dd · th/td · span 쌍 · 「라벨 값」 한 줄을 모두 받는다.
 * 배송지 · 수령인 · 연락처 같은 라벨은 값을 읽지 않고 「여기서 멈춘다」는 표시로만 쓴다.
 * 주문번호는 주소의 orderNo=… 나 마지막 숫자 경로도 대신 받고, 결제 일시는 화면 어디든 `20xx.MM.DD HH:mm(:ss)` 모양 첫 글자열도 대신 받는다. 금액은 라벨이 있을 때만 읽는다(추측하지 않음).
 */
export declare const DETAIL_BODY: (defaultSeller?: string, amountLabels?: string[]) => string;
export declare const NAVER_SHOP_DETAIL_SCRIPT: string;
export declare const NAVER_PAY_DETAIL_SCRIPT: string;
export declare const MUSINSA_DETAIL_SCRIPT: string;
export declare const KURLY_DETAIL_SCRIPT: string;
