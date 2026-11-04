/**
 * 화면 설정 — 앱이 넘기는 것 전부(대표님 11-04 12:53 「다른 앱은 패키지만 붙이면 수집→주문 보내기→저장까지 그대로」).
 * 앱마다 다른 것만 받는다: 서버 호출 · 웹뷰 · 단추 · 색 · 앱 판 · 보상 글 · 목록 그리기. 나머지(흐름 · 구동기 · 올리기 · 실패 기록 · 진행 줄)는 패키지 안에 있다.
 */
import type { ComponentType, ReactNode } from 'react';
import type { ReceiptLinkApi } from '../appKit';
import type { LinkPlatform } from '../model';
import type { LinkOrder, ListCounts, RunView } from '../ordersModel';

/** 화면이 그리는 단추 — 앱 UI 의 Button 을 그대로 넘긴다(label · onPress 필수, compact · tone 'ghost' 선택) */
export type ScreenButtonProps = { label: string; onPress: () => void; compact?: boolean; tone?: 'ghost' };

/** 색 · 간격 — 앱 theme 의 C · S 에서 이 키만 */
export type ScreenTheme = {
  bg: string;
  text: string;
  sub: string;
  brandDark: string;
  space: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
};

/** 화면 안 목록 자리(renderOrders)에 넘기는 것 — 영테크 ReceiptOrdersSheet(embedded)와 같은 모양 */
export type OrdersSlotProps = {
  platform: LinkPlatform;
  /** 지금 읽는 중 */
  reading: boolean;
  onClose: () => void;
  /** 서버에 올라간 묶음마다 1씩 오른다 — 목록을 다시 받는 신호 */
  reloadKey: number;
  /** 줄의 대기 · 가져오는 중 · 영수증 없음 · 못 가져옴을 가르는 실행 상태 */
  run: RunView;
  /** 「가져오기」(한 줄 다시) — key 는 outcomeKey */
  onFetchOne: (key: string) => void;
  /** 「영수증 내용 채우기」 — 네이버만 */
  onRefill?: (tails: string[]) => void;
  fetchBusy: boolean;
  /** 서버 목록을 받을 때마다(실패도) — key · 줄 수 · 줄들 */
  onLoaded: (key: number, counts: ListCounts | null, orders?: LinkOrder[]) => void;
};

export type ReceiptLinkScreenConfig = {
  /** createReceiptLinkApi(앱의 http) */
  api: ReceiptLinkApi;
  /** react-native-webview 의 WebView. 없으면(web) 「이 기기에서는 읽을 수 없어요」 */
  WebView: ComponentType<any> | null;
  Button: ComponentType<ScreenButtonProps>;
  theme: ScreenTheme;
  /** 지금 앱 판(OTA 업데이트 ID) — 실패 기록에 싣는다. 없으면 빈 글 */
  updateId?: string;
  /** 진행 팝업의 보상 줄(예: 「적립 가능 3건 · 건당 5P」). 보상이 없는 앱은 넘기지 않는다 */
  claimLine?: (claimable: number) => string | null;
  /** 화면 안에 그릴 주문 목록. 없으면 패키지가 서버 목록 수만 받아 진행 줄에 쓴다(목록 없음) */
  renderOrders?: (p: OrdersSlotProps) => ReactNode;
};

/** 설정을 한 번 만들어 두고 화면에 넘긴다 — 모양 검사만 한다 */
export function defineReceiptLinkScreen(c: ReceiptLinkScreenConfig): ReceiptLinkScreenConfig {
  return c;
}
