import type { CouponInfo, NoticeSection, Product, ProofItem, ShoppingApi } from './types';

/*
 | 목업 데이터 — 서버(패키지api 설계 중)가 붙기 전 화면 확인용. 모든 글에 「목업」 표시를 남겨 실제 운영 글로 착각하지 않게 한다.
 | 실제 적립 기록(recent)은 비워 둔다 — 「○○님이 받았어요」 띠는 서버가 실제 기록을 줄 때만 보인다.
 */
const P = (partnerId: string, i: number, title: string, price: number, reward: number, discountRate?: number, tags?: string[]): Product => ({
  id: `${partnerId}-${i}`, partnerId, title, image: null, price, discountRate: discountRate ?? null, reward,
  rewardKind: partnerId === 'coupang' ? 'coupon' : 'point', rating: 4.6, reviews: 1200 + i * 37, tags,
});

const TOSS = [
  P('toss', 1, '[목업] 생수 2L × 12병', 9900, 297, 31),
  P('toss', 2, '[목업] 3겹 화장지 30롤', 14900, 447, 62),
  P('toss', 3, '[목업] 양념 소불고기 500g', 7900, 237, 50),
  P('toss', 4, '[목업] 무선 이어폰', 5190, 155, 40),
];
const COUPANG = [
  P('coupang', 1, '[목업] 탄산음료 190ml × 30캔', 16110, 7, undefined, ['빠른배송']),
  P('coupang', 2, '[목업] 천연펄프 3겹 화장지', 19140, 10, undefined, ['빠른배송']),
  P('coupang', 3, '[목업] 물티슈 캡형 10팩', 8900, 2, undefined, ['빠른배송']),
  P('coupang', 4, '[목업] 두유 190ml × 24팩', 12900, 5),
];

const NOTICE: NoticeSection[] = [
  { title: '[목업] 적립 안내', items: ['이 글은 화면 확인용이에요. 실제 안내는 서버에서 받아 그대로 보여 줘요.'] },
  { title: '[목업] 적립이 인정되는 조건', items: ['조건 · 기한 · 한도는 정해지는 대로 서버 글로 바뀌어요.'] },
];

const COUPON: CouponInfo = {
  title: '[목업] 할인권 적립', subtitle: '기프티콘을 더 싸게 사는',
  compare: [{ label: '결제 금액', value: '1,000원 단위로 보상' }, { label: '기프티콘 살 때', value: '할인 적용' }],
  tiers: [{ name: '일반 할인권', range: '[목업] 범위' }, { name: '큰 할인권', range: '[목업] 범위' }],
  steps: [{ title: '쇼핑 탭에서 이동하기' }, { title: '평소처럼 장보기' }, { title: '교환소에서 기프티콘 할인 구매' }],
  faq: [{ q: '[목업] 할인권이 뭔가요?', a: '실제 답은 서버 글로 바뀌어요.' }],
  notice: NOTICE,
};

export function createMockShoppingApi(delayMs = 150): ShoppingApi {
  const wait = <T>(v: T) => new Promise<T>(r => setTimeout(() => r(v), delayMs));
  const now = Date.now();
  let nextId = 4;
  const proofs: ProofItem[] = [
    { id: 'mock-1', partnerId: 'toss', status: 'received', createdAt: now, amount: 10000 },
    { id: 'mock-2', partnerId: 'toss', status: 'waiting', createdAt: now, confirmAt: now + 3 * 86_400_000, reward: 200 },
    { id: 'mock-3', partnerId: 'toss', status: 'rejected', createdAt: now, reason: '[목업] 주문번호가 보이지 않아요' },
  ];
  return {
    proof: {
      info: () => wait({
        rateText: '[목업] 구매 금액의 1%를 포인트로',
        subtitle: '[목업] 구매 인증 안내', title: '[목업] 주문내역을 인증해 주세요',
        payoutText: '[목업] 지급 시점은 서버 안내로 표시돼요',
        steps: [
          { title: '[목업] 주문내역 준비', desc: '[목업] 인증할 사진을 준비해 주세요' },
          { title: '[목업] 사진 올리기', desc: '[목업] 주문내역 사진을 골라 주세요' },
          { title: '[목업] 내역 확인', desc: '[목업] 처리 상태를 확인해 주세요' },
        ],
        faq: [
          { q: '[목업] 어떤 사진을 올리나요?', a: '[목업] 실제 사진 조건은 서버가 안내해요' },
          { q: '[목업] 언제 지급되나요?', a: '[목업] 실제 지급 시점은 서버가 안내해요' },
        ],
        notice: [
          { title: '[목업] 인증 안내', items: ['[목업] 실제 인증 조건은 서버가 안내해요'] },
          { title: '[목업] 지급 안내', items: ['[목업] 실제 지급 조건은 서버가 안내해요'] },
        ],
        cta: '[목업] 구매 인증 사진 고르기',
      }),
      list: () => wait(proofs.map(item => ({ ...item }))),
      submit: input => {
        const item: ProofItem = { id: `mock-${nextId++}`, partnerId: input.partnerId, status: 'received', createdAt: Date.now(), amount: input.amount };
        proofs.unshift(item);
        return wait({ ...item });
      },
    },
    home: () => wait({
      totalBenefit: 0,
      partners: [
        { id: 'toss', name: '토스쇼핑', rateText: '3%', rewardKind: 'point' },
        { id: 'coupang', name: '쿠팡', rateText: '1.2%', rewardKind: 'coupon', disclosure: '[목업] 제휴 활동 고지 — 실제 글은 서버가 줘요.' },
      ],
      hero: { label: '판매 1위', title: '[목업] 생수 2L × 12병', partnerId: 'toss', productId: 'toss-1' },
      recent: [],
    }),
    categories: () => wait([{ id: 'best', name: '베스트' }, { id: 'food', name: '식품' }, { id: 'living', name: '생활용품' }, { id: 'kitchen', name: '주방용품' }, { id: 'home', name: '가구/홈데코' }]),
    products: q => wait({ items: q.partnerId === 'coupang' ? COUPANG : q.partnerId === 'toss' ? TOSS : [...TOSS, ...COUPANG.slice(0, 2)], next: null }),
    deals: partnerId => wait(partnerId === 'toss' ? { endsAt: Date.now() + 3 * 3600_000, items: TOSS.slice(0, 3) } : null),
    couponInfo: partnerId => wait(partnerId === 'coupang' ? COUPON : null),
    notice: () => wait(NOTICE),
    link: t => wait({ url: t.partnerId === 'coupang' ? 'https://www.coupang.com/' : 'https://shopping.toss.im/' }),
  };
}
