/**
 * 「○○ 연동됨」 시트 항목 — 네 몰 공용, iOS 순서(주문 불러오기 · 불러온 주문 보기 · 사용 방법 보기 · [로그인 창 열기 (구조 기록)] · 연동 해제).
 * 「로그인 창 열기 (구조 기록)」는 어드민(시험 회원, 서버 link.state.probe === true)에게만 — 일반 회원 화면에는 안 보인다(대표님 11-02 「이건 어드민만 나오게 해」).
 * 글자를 앱마다 다시 치지 않도록 여기 둔다. RN 에 기대지 않는다(노드 시험이 읽는다).
 */
import type { ActionMenuItem } from './ActionMenu';

export type LinkedMenuHandlers = {
  /** 「주문 불러오기」 — 불러오기 화면(ReceiptImportScreen) */
  importOrders: () => void;
  /** 「불러온 주문 보기」 — 불러온 주문 목록 */
  showOrders: () => void;
  /** 「사용 방법 보기」 — linkGuide(site) 안내 */
  showGuide: () => void;
  /** 「로그인 창 열기 (구조 기록)」 — probe 일 때만 쓰인다 */
  openLogin?: () => void;
  /** 「연동 해제」 */
  withdraw: () => void;
};

/** 시트 제목 — 「네이버 연동됨」 */
export const linkedMenuTitle = (name: string): string => name + ' 연동됨';

export function linkedMenuItems(on: LinkedMenuHandlers, opts: { probe?: boolean } = {}): ActionMenuItem[] {
  return [
    { label: '주문 불러오기', onPress: on.importOrders },
    { label: '불러온 주문 보기', onPress: on.showOrders },
    { label: '사용 방법 보기', onPress: on.showGuide },
    ...(opts.probe === true && on.openLogin ? [{ label: '로그인 창 열기 (구조 기록)', onPress: on.openLogin }] : []),
    { label: '연동 해제', destructive: true, onPress: on.withdraw },
  ];
}
