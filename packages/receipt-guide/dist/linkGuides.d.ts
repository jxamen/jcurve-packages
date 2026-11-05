/**
 * 전자 영수증(주문내역 연동) 처음 쓰는 법 — 칩마다 그 곳 전용(대표님 11-03 07:55 「네이버 버튼 누르면 나오고 쿠팡 … 무신사 버튼 누르면 나오게」).
 * 배민 안내와 같은 재생기 · 같은 가짜 화면(막대 · 카드 · 글자)으로 그린다. 로그인 화면은 A32 에서 「로그인 창 열기」로 연
 * 실제 웹페이지(11-03 08:01 캡처)를 보고 본떴다 — 캡처 그림 자체는 넣지 않는다(회원 주문 · 계정이 들어가므로).
 * 단계: ① 칩 → 동의 → 그 곳 로그인 ② 주문 불러오기 ③ 광고 보고 적립. RN 에 기대지 않는다(노드 시험이 읽는다).
 */
import type { ReceiptGuide } from './types';
export type LinkSite = 'naver' | 'coupang' | 'kurly' | 'musinsa';
export declare function linkGuide(site: LinkSite): ReceiptGuide;
/** 이 곳 가이드를 본 적이 있나 — 저장 값은 본 곳 목록(JSON). 틀린 값이면 아무것도 안 봤다 */
export declare function parseLinkSeen(raw: string | null | undefined): LinkSite[];
export declare const markLinkSeen: (seen: readonly LinkSite[], site: LinkSite) => LinkSite[];
