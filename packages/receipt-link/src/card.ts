/**
 * 주문내역 연동 카드(1단계) — 화면 없이 정하는 것만. 그리기는 src/screens/OrderLinkCard.tsx.
 * 1단계는 연결 · 동의 · 철회와 로그인 창까지다. 주문은 아직 읽지 않는다(기획서 docs/order-link §9 · 확인표 B).
 */
import type { ReceiptLinkClient } from './client';
import { isConnected, LINK_LABEL, type LinkPlatform, type LinkState } from './model';

/** 카드 상태 — 서버 스위치가 꺼졌거나(404) 읽기가 실패하면 null → 카드를 그리지 않는다 */
export async function loadCardState(client: Pick<ReceiptLinkClient, 'fetchLinkState'>): Promise<LinkState | null> {
  try {
    return await client.fetchLinkState();
  } catch {
    return null;
  }
}

/** 사이트의 공식 로그인 페이지 — 회원이 여기서 직접 로그인한다 */
export const LOGIN_URL: Record<LinkPlatform, string> = {
  naver: 'https://nid.naver.com/nidlogin.login',
  coupang: 'https://login.coupang.com/login/login.pang',
  musinsa: 'https://www.musinsa.com/auth/login',
  kurly: 'https://www.kurly.com/member/login',
};

/** 한 줄 상태 — 「연결 안 됨」 또는 「연결됨 · 동의한 날」 */
export function linkStatus(s: LinkState, p: LinkPlatform): string {
  if (!isConnected(s, p)) return '연결 안 됨';
  return '연결됨 · ' + (s.links[p]?.linkedAt ?? '').slice(0, 10).replace(/-/g, '.');
}

/** 동의 화면 문구 — 기획서 §6.1 초안(법무 최종 문안 전). 가져오는 칸 · 로그인 정보 · 철회를 그대로 적는다 */
export function consentLines(p: LinkPlatform, app: { appName: string; viaDeveloperServer?: boolean } = { appName: '앱' }): string[] {
  const name = LINK_LABEL[p];
  const who = app.appName;
  return [
    `${who}가 회원님의 ${name} 주문내역(주문번호 · 주문일시 · 판매처 · 상품명 · 결제금액 · 결제수단)을 읽어 영수증 보상으로 드리려면 동의가 필요해요.`,
    `로그인은 ${name} 로그인 화면에서 직접 해요. ${who}는 아이디와 비밀번호를 보지도, 저장하지도 않아요.`,
    `로그인 정보는 회원님 휴대폰 안에만 있고, ${who} 서버로 보내지 않아요.`,
    app.viaDeveloperServer
      ? '주문내역은 앱 서버를 거쳐 연동 서버에 저장돼요. 저장하는 것은 주문내역과 「연결한 시각」뿐이고, 수취인 · 주소 · 전화번호 · 카드번호는 읽지 않아요.'
      : '서버에는 주문내역과 「연결한 시각」만 저장해요. 수취인 · 주소 · 전화번호 · 카드번호는 읽지 않아요.',
    '언제든 「연결 끊기」로 그만둘 수 있어요.',
    `${name} 이용약관에 따라 자동으로 정보를 읽는 것은 제한될 수 있어요. 계정 이용에 불이익이 생길 수 있어요. 동의는 선택이에요.`,
  ];
}
