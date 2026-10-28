/**
 * @jcurve/receipt-link — 주문내역 연동(로그인 창 · 구조 기록 · 불러오기)의 공용 부분. 0.1.0 은 core(순수 TS) 뼈대:
 * 모델 · 서버 호출 클라이언트(`request` 주입) · 동의 문구/상태 · 구조 기록(probe). 화면(UI)과 사이트별 읽기 규칙은 다음 판.
 * 영테크 `20defd33` 의 src/receiptLink 에서 옮겼다. 앱 화면 코드는 이 판에서 바꾸지 않는다.
 */
export * from './model';
export * from './client';
export * from './card';
export * from './probe';
export * from './useLinkState';
// 0.2.0: 사이트별 주문 읽기(웹뷰에서 돌리는 스크립트) — 네이버 쇼핑 · 네이버페이 · 무신사 · 컬리
export * from './readers/readers';
