/**
 * 영테크 「불러오기」 주문 읽기 — 사이트별 주소와 웹뷰에서 돌릴 스크립트(앱 harness 가 이대로 받는다).
 *
 *   ORDER_PAGES[site] = { url, script }
 *   - url    : 그 사이트 주문내역 화면. 로그인이 안 돼 있으면 사이트가 로그인 뒤 돌려주는 곳이다.
 *   - script : 그 페이지 안에서 실행하는 즉시실행함수 문자열(외부 의존 없음, 끝에 `true;`). 앱이 같은 스크립트를 다시 부르면 다음 묶음을 보낸다.
 *
 * 스크립트가 앱으로 보내는 것(window.ReactNativeWebView.postMessage):
 *   { type:'orders', site, orders:[{ orderNo, orderedAt('YYYY-MM-DD HH:mm' KST), amount(정수 원), seller, title, payment? }], done, note? }
 * 한 번에 최대 50건 · 최근 30일 · 여섯 칸 밖은 틀(common.ts)이 버린다. 못 읽으면 orders:[] 와 note(login_needed · wrong_page · no_list_found · fetch_failed · error).
 */
import { MUSINSA_SCRIPT, MUSINSA_URL } from './musinsa';
import { KURLY_SCRIPT, KURLY_URL } from './kurly';
import { NAVER_PAY_SCRIPT, NAVER_PAY_URL } from './naver_pay';
import { NAVER_SHOP_SCRIPT, NAVER_SHOP_URL } from './naver_shop';
import type { OrderSite } from './common';

export const ORDER_PAGES: Record<OrderSite, { url: string; script: string }> = {
  naver_shop: { url: NAVER_SHOP_URL, script: NAVER_SHOP_SCRIPT },
  naver_pay: { url: NAVER_PAY_URL, script: NAVER_PAY_SCRIPT },
  musinsa: { url: MUSINSA_URL, script: MUSINSA_SCRIPT },
  kurly: { url: KURLY_URL, script: KURLY_SCRIPT },
};
export type { OrderSite, OrdersMessage, ReaderOrder } from './common';
