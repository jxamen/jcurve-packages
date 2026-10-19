/*
 | @jcurve/shopping — 제휴 쇼핑 탭(대표님 2026-10-19 「쇼핑은 패키지로 제작 한다」).
 |
 | 화면 · 배치는 패키지가 정하고, 앱은 **테마(색 · 포인트 이름 · 앱 이름)** 와 **데이터 함수(ShoppingApi)** 만 넘긴다.
 | 상품 · 이동 링크 · 누적 혜택 · 할인권 등급 · 유의사항은 전부 서버(jcurve-api, 패키지api 설계)에서 온다.
 | 패키지에는 정책 문구를 박지 않는다 — 적립 조건 · 기한 · 한도는 서버 글을 그대로 그린다(우리 정책이 정해지기 전에 다른 회사 조건을 옮기지 않게).
 */

/** 제휴처 — 'toss' · 'coupang' 처럼 서버가 정한 id */
export type PartnerId = string;

/** 보상 방식 — point · coupon · none(적립 없는 쉐어링크 수동 진열, 이동만) */
export type RewardKind = 'point' | 'coupon' | 'none';

export type Partner = {
  id: PartnerId;
  /** 화면 이름(예 「토스쇼핑」) */
  name: string;
  /** 적립률 글(예 「3%」 · 「1.2%」) — 계산은 서버가 한다 */
  rateText: string;
  rewardKind: RewardKind;
  /** 지급 형태 이름(예 「포인트」 · 「할인권」) — 서버 설정값(어드민). 있으면 테마 이름보다 먼저 쓴다(대표님 10-19 「어디 설정에서 할 수 있게」) */
  rewardLabel?: string | null;
  /** 제휴처 로고 그림 주소(없으면 이름 첫 글자) */
  logo?: string | null;
  /** 제휴 활동 고지(예: 수수료 안내) — 서버 글 그대로 화면 아래에 늘 그린다(패키지에 고정 글 없음) */
  disclosure?: string | null;
};

export type Product = {
  id: string;
  partnerId: PartnerId;
  title: string;
  image?: string | null;
  /** 판매가(원) — 수동 목록에서 생략 가능, 없으면 가격 · 할인율을 숨긴다 */
  price?: number | null;
  /** 할인율(%) — 없으면 표시 안 함 */
  discountRate?: number | null;
  /** **예상** 적립(포인트 수 · 할인권 금액) — 확정 때 수수료 · 하루 상한으로 줄 수 있어 화면은 「약」으로 쓴다 */
  reward: number;
  rewardKind: RewardKind;
  rating?: number | null;
  reviews?: number | null;
  /** 짧은 딱지(예 「로켓배송」) — 서버가 준 글 그대로 */
  tags?: string[];
};

export type ThemeSection = { id: string; title: string; subtitle?: string | null; items: Product[] };

export type Category = { id: string; name: string };

/** 실제 적립 기록 — 서버가 실제 적립이 있을 때만 준다. 패키지는 지어내지 않는다(대표님: 가짜 문구 금지) */
export type RecentReward = {
  /** 가린 이름(예 「따뜻한****」) — 서버가 가린다 */
  maskedName: string;
  amount: number;
  /** 단위 글(예 「원」 · 「P」) */
  unit: string;
  at: number;
};

export type ShoppingHome = {
  /** 누적 혜택(이 회원) */
  totalBenefit: number;
  partners: Partner[];
  /** 맨 위 배너 — 없으면 안 그린다 */
  hero?: { label: string; title: string; image?: string | null; productId?: string | null; partnerId?: PartnerId | null } | null;
  recent?: RecentReward[];
};

export type ProductPage = { items: Product[]; next?: string | null };

export type Deals = { title?: string; endsAt: number; items: Product[] };

export type NoticeSection = { title: string; items: Array<string | { text: string; sub?: string[] }> };

/** 할인권 안내(⑤) — 등급 · 이용 방법 · 질문은 서버 글 */
export type CouponInfo = {
  title: string;
  subtitle?: string;
  /** 왼쪽 → 오른쪽 비교 두 칸(예 「결제 금액 · 1,000원 단위로 보상」 → 「기프티콘 살 때 · 할인 적용」) */
  compare?: Array<{ label: string; value: string }>;
  tiers?: Array<{ name: string; range: string }>;
  steps?: Array<{ title: string; desc?: string }>;
  faq?: Array<{ q: string; a: string }>;
  notice?: NoticeSection[];
  /** 아래 고정 버튼 글 — 없으면 「{제휴처} 쇼핑하러 가기」 */
  cta?: string;
};

export type ProductQuery = { partnerId: PartnerId | 'all'; categoryId?: string | null; cursor?: string | null };

export type ProofStatus = 'received' | 'checked' | 'waiting' | 'paid' | 'rejected' | 'revoked';
export type ProofInfo = { rateText: string; title?: string | null; subtitle?: string | null; payoutText?: string | null; steps?: Array<{ title: string; desc?: string | null }>; faq?: Array<{ q: string; a: string }>; notice?: NoticeSection[]; cta?: string | null; guide?: string[]; confirmDays?: number | null; dailyMax?: number | null };
export type ProofItem = { id: string; partnerId: PartnerId; status: ProofStatus; createdAt: number; amount?: number | null; reward?: number | null; confirmAt?: number | null; reason?: string | null };
export type PickedImage = { uri: string; name: string; type: string };

/** 앱이 넘기는 데이터 함수 — 서버 경로는 앱(또는 createHttpShoppingApi)이 정한다 */
export type ShoppingApi = {
  home(): Promise<ShoppingHome>;
  proof?: {
    info(partnerId: PartnerId): Promise<ProofInfo | null>;
    list(): Promise<ProofItem[]>;
    submit(input: { partnerId: PartnerId; image: PickedImage; orderNo?: string | null; amount?: number | null }): Promise<ProofItem>;
  };
  /** 주제별 묶음 — 있으면 그 제휴처 칸은 분류 칩 + 2열 목록 대신 주제 줄로 그린다 */
  themes?(partnerId: PartnerId): Promise<ThemeSection[]>;
  categories(partnerId: PartnerId | 'all'): Promise<Category[]>;
  products(q: ProductQuery): Promise<ProductPage>;
  /** 오늘만 특가 — 없으면 null */
  deals(partnerId: PartnerId): Promise<Deals | null>;
  couponInfo(partnerId: PartnerId): Promise<CouponInfo | null>;
  notice(partnerId: PartnerId | 'all'): Promise<NoticeSection[]>;
  /**
   * 이동 링크 — 적립 추적이 붙은 주소를 서버가 만든다. 상품이 없으면 제휴처 첫 화면.
   * 실패는 Error 의 `code` 로 준다(createHttpShoppingApi 는 서버 error 를 그대로): signup_required(게스트 · 로그인 필요) · too_often · provider_not_ready · product_not_found
   */
  link(target: { partnerId: PartnerId; productId?: string | null }): Promise<{ url: string }>;
};

export type ShoppingTheme = {
  /** 앱 이름 — 「{앱}에서 이동해야 적립돼요」 */
  appName: string;
  /** 문장에 쓰는 포인트 이름(예 「포인트」 · 「캐시」) — 「구매 금액의 3%를 포인트로 드려요」 */
  pointName: string;
  /** 딱지 · 숫자 앞에 붙는 짧은 표시(기본 「P」) — 「P 447」 */
  pointMark?: string;
  /** 쿠폰형 적립 이름(예 「할인권」) */
  couponName?: string;
  bg: string;
  card: string;
  text: string;
  sub: string;
  line: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  /** 할인율 · 남은 시간 글 */
  danger: string;
  /** 쇼핑 탭 머리 제목(기본 「쇼핑」) */
  title?: string;
};

export const DEFAULT_THEME: ShoppingTheme = {
  appName: '앱', pointName: '포인트', pointMark: 'P', couponName: '할인권',
  bg: '#FFFFFF', card: '#F4F6F9', text: '#191F28', sub: '#6B7684', line: '#E5E8EB',
  primary: '#2F6BFF', primarySoft: '#E8F0FF', onPrimary: '#FFFFFF', danger: '#F04452',
};
