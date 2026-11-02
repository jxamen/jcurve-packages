/**
 * 영수증 화면(ReceiptSheet) 위에 덮이는 연동 층 가운데 맨 위가 무엇인가 — 안드로이드 뒤로 키가 한 번에 한 층씩 닫는 순서다.
 * 화면에 쌓이는 순서(아래 → 위): 동의 화면 · 로그인 창 · 주문 불러오기 · 불러온 주문 목록. react-native 를 import 하지 않는다(노드에서 시험한다).
 */
export type LinkLayerState = { ordersOpen: boolean; importing: boolean; login: boolean; consenting: boolean };
export type LinkLayer = 'orders' | 'importing' | 'login' | 'consenting';

export function topLinkLayer(s: LinkLayerState): LinkLayer | null {
  if (s.ordersOpen) return 'orders';
  if (s.importing) return 'importing';
  if (s.login) return 'login';
  if (s.consenting) return 'consenting';
  return null;
}
