/**
 * 배달 · 쇼핑 앱 영수증 올리는 법 — **그림 없는 데이터**로만 적는다(대표님 10-03 23:17).
 *
 * 화면은 같은 폴더의 재생기(Player.tsx)가 이 데이터로 흉내 낸다. 앱마다 화면 코드를 따로 두지 않는다 —
 * 단계 글은 전부 `data.ts` 한 파일에 있다. 새 앱은 거기에 한 덩어리를 더 쓰고 `GUIDES` 순서에 올리면 끝이다.
 *
 * 가짜 화면은 **막대 · 둥근 카드 · 글자**뿐이다. 진짜 앱의 로고 · 그림 · 캡처는 쓰지 않는다.
 * 가게 이름 · 금액은 지어낸 값(「○○치킨 △△점」 · 18,500원)이다 — 실제 이름 · 전화 · 주소를 넣지 않는다.
 *
 * RN 에 기대지 않는 파일이라 노드 시험(data.test.ts)이 바로 읽는다.
 */

/** 안내가 있는 앱 */
export type GuideApp = 'baemin' | 'coupang' | 'coupangeats' | 'nplus' | 'naverpay' | 'musinsa' | 'kurly' | 'kakaopay' | 'other';
/** 올릴 때 서버에 함께 보내는 「어디 영수증인가」 — 종이 영수증은 안내 없이 바로 찍는다 */
export type ReceiptPlatform = GuideApp | 'paper';

/** 아래 탭 한 칸 — 사람 모양처럼 글자 없이 그림으로만 알아보는 칸은 `icon` */
export type NavItem = string | { icon: 'person'; label: string };

/**
 * 가짜 화면 한 줄. `tap` 이 붙은 곳이 그 단계에서 누를 곳이다(한 화면에 하나).
 * 숫자 `tap` 은 그 줄의 몇 번째 칸인지(0부터)다.
 */
export type MockNode =
  /** 맨 위 제목 줄 — back: 왼쪽 ‹ · close: 오른쪽 ✕ · left/right: 그 자리 글자 버튼(네이버 「pay」 · 「영수증」) */
  | { type: 'header'; title: string; back?: boolean; close?: boolean; left?: string; right?: string; tap?: 'left' | 'right' }
  /** 밑줄 탭 */
  | { type: 'tabs'; items: string[]; on: number; tap?: number }
  /** 둥근 칩 */
  | { type: 'chips'; items: string[]; on?: number; tap?: number }
  /** 소제목 줄 — 오른쪽에 「전체 보기 >」 같은 글자 버튼(여럿이면 나란히). tap: 'title' 이면 제목 줄 자체 */
  | { type: 'section'; title: string; links?: string[]; tap?: number | 'title' }
  /**
   * 주문 카드. corner: 오른쪽 위 글자 버튼 · button: 아래 넓은 버튼(small 이면 금액 옆 작은 버튼) ·
   * more: 오른쪽 아래 「…」. dim: 흐리게(누를 카드가 아님)
   */
  | {
    type: 'order'; shop: string; meta: string; amount?: string;
    corner?: string; button?: string; small?: boolean; more?: boolean;
    tap?: 'corner' | 'button' | 'more'; dim?: boolean;
  }
  /** 이름 · 값 줄 — strong 번째 줄은 굵게(합계). tap 번째 줄을 가리킨다(「결제방법을 봐요」) */
  | { type: 'rows'; rows: [string, string][]; strong?: number; tap?: number }
  /** 가로 버튼 줄 — solid 번째는 채운 버튼 */
  | { type: 'buttons'; items: string[]; solid?: number; tap?: number }
  /** 아래에서 올라온 창 — 뒤 화면은 어둡게 */
  | { type: 'menu'; items: string[]; tap?: number }
  /** 사진첩 — pick 번째 사진이 영수증(고른 순서대로 번호) */
  | { type: 'album'; pick: number[] }
  /** 회색 글 줄 자리 */
  | { type: 'bars'; n?: number }
  /** 아래 탭 막대 — 화면 맨 아래에 붙는다 */
  | { type: 'nav'; items: NavItem[]; on?: number; tap?: number };

export type GuideStep = {
  /** 대표님 단계 번호(①②…) — 한 번호를 여러 장면으로 나눌 수 있다 */
  no: number;
  /** 갈래 꼬리표 — 결제방법 등에 따라 길이 갈릴 때(컬리 「카드 결제라면」) 말풍선 위에 붙는다 */
  branch?: string;
  /** 말풍선 큰 줄 */
  say: string;
  sub?: string;
  nodes: MockNode[];
  /** tap(기본): 손가락이 누를 곳으로 간다 · capture: 화면 캡처(찰칵) */
  action?: 'tap' | 'capture';
  /** 누르거나 찍은 뒤 잠깐 뜨는 알림 */
  toast?: string;
  /** 위에서 이어지는 화면(아래로 내린 뒤) — 맨 위에 「위에서 이어져요」 띠 */
  scrolled?: boolean;
  /** 이 장면이 머무는 시간(ms) — 없으면 재생기 기본값 */
  ms?: number;
  /** 다른 안내로 가는 길(컬리 네이버페이 갈래 → 네이버페이 안내) — 가짜 화면 아래 카드 */
  link?: { text: string; label: string; app: GuideApp };
};

export type ReceiptGuide = {
  app: GuideApp;
  /** 고르는 칸 · 머리 제목에 쓰는 이름 */
  name: string;
  /** 앱 느낌만 살짝 — 가짜 화면 머리 줄 · 칩에만 옅게 쓴다 */
  accent: string;
  /** 대표님이 적어 준 단계 글 그대로 — 끝 카드에 다시 보여 준다 */
  summary: string[];
  /** 끝 카드 작은 줄 */
  doneSub: string;
  /** 사진첩에서 한 번에 고를 수 있는 장 수(없으면 1장) — 길어서 여러 장 캡처하는 앱만 */
  multi?: number;
  /** 사진첩을 열기 전 알려 줄 말(여러 장 순서 등) */
  pickHint?: string;
  /** 꼭 알아야 할 한 줄 — 안내 내내 가짜 화면 아래 노란 카드(네이버페이: 「PDF로 저장」은 사진첩에 안 들어감) */
  note?: string;
  steps: GuideStep[];
};

/** 그 장면에서 누를 곳 수 — 한 화면에 하나여야 손가락이 어디로 갈지 정해진다 */
export function targetsOf(step: GuideStep): number {
  let n = 0;
  for (const node of step.nodes) {
    if (node.type === 'album') n += node.pick.length ? 1 : 0;
    else if ('tap' in node && node.tap !== undefined) n += 1;
  }

  return n;
}

/** 글 속 `{앱}` 을 쓰는 앱 이름으로 바꾼다 */
export function fillApp(text: string, appName: string): string {
  return text.split('{앱}').join(appName);
}
