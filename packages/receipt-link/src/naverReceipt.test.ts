import { describe, expect, it } from 'vitest';
import vm from 'node:vm';
import {
  NAV_HELPERS_SCRIPT,
  NAV_INTERCEPT_SCRIPT,
  NAVER_TOKEN_PATTERNS,
  countLabel,
  countOrderCards,
  extractDetailStamp,
  extractHistoryRows,
  extractPaymentTokens,
  extractReceiptRows,
  extractPayBlocks,
  extractShopBlocks,
  extractSlip,
  blockTextsScript,
  NAV_API_INTERCEPT_SCRIPT,
  normalizeKst,
  parseNvMids,
  parseOrderHistories,
  interceptScript,
  resolveSlipSeconds,
  isLoginPage,
  navScript,
  pairTokens,
  parseKoreanMD,
  parseTokens,
  readTokensScript,
  toImportOrder,
} from './naverReceipt';

/* ---------- 합성 글자(대표님 캡처 문구에 맞춤) ---------- */
const NOW = Date.UTC(2026, 9, 28, 0, 0);
const SHOP_LIST = [
  '마이쇼핑 | 주문/배송내역',
  'N pay 내역',
  '전체 5,650원 적립받기 취소/교환/반품 12',
  '구매확정완료',
  '9.11. 11:50 주문',
  '카네이션 꽃다발',
  '39,000원',
  '한달사용리뷰 장바구니 담기 바로 구매하기',
  '…',
  '광고 · 오늘의 특가 고객센터 1588-0000',
].join('\n');
/** 주문 2건(1번: 카드영수증, 2번: 구매영수증만) */
const PAY_LIST = [
  '영수증 발급 내역',
  '구매영수증',
  '주문번호 2026091195203331',
  '판매처 화원노리',
  '카네이션 꽃다발',
  '금액 39,000원',
  '카드영수증',
  '주문번호 2026090994110022',
  '판매처 쿠킹마트',
  '냉동 만두',
  '금액 12,500원',
  '구매영수증',
  '신용카드 매출전표는 결제완료 시 자동 발급되며',
].join('\n');
const SLIP_CARD = [
  '신용카드 매출전표',
  '상점 정보',
  '상호 화원노리',
  '사업자등록번호 123-45-67890',
  '대표자 홍길동',
  '결제정보',
  '총 결제금액 39,000원',
  '결제수단 신한카드',
  '승인번호 12345678',
  '승인일시 2026/10/20 10:04:43',
  '결제서비스 업체정보',
  '상호 주식회사 컬리페이',
  '사업자등록번호 473-81-00089',
].join('\n');
const SLIP_CARD_NOSEC = ['신용카드 매출전표', '사업자번호 123-45-67890', '승인번호 87654321', '거래일시 2026.10.19 09:30', '합계 15,000원'].join('\n');
const PURCHASE_SLIP = ['구매영수증', '상호 쿠킹마트', '사업자등록번호 234-56-78901', '거래일시 2026.09.09 08:12:40', '결제금액 12,500원'].join('\n');
const PAY_HISTORY = ['N pay 결제 내역', '추가 계정 (프리미엄) >', '5,000원 | 10. 20. 10:04 결제', '⋮'].join('\n');

const P1 = '20261020NP1673267032';
const T1 = '20261020100443508304';
const P2 = '20261019NP1234567890';
const T2 = '20261019093015112233';

/* ---------- 추출기 ---------- */
describe('extractSlip', () => {
  it('reads card slip with slash timestamp and the 상점 정보 section first', () => {
    expect(extractSlip(SLIP_CARD)).toEqual({
      businessNumber: '123-45-67890',
      approval: '12345678',
      paidAt: '2026-10-20 10:04:43',
      paidAtNoSeconds: false,
      amount: 39000,
      cardIssuer: '신한',
      merchant: '화원노리',
      orderNo: undefined,
    });
  });

  it('flags a timestamp without seconds and keeps the 거래일시 label', () => {
    const s = extractSlip(SLIP_CARD_NOSEC);
    expect(s?.paidAt).toBe('2026-10-19 09:30');
    expect(s?.paidAtNoSeconds).toBe(true);
    expect(s?.approval).toBe('87654321');
  });

  it('returns null with fewer than 3 of amount / time / approval / business number', () => {
    expect(extractSlip('총 결제금액 39,000원\n승인일시 2026/10/20 10:04:43')).toBeNull();
  });
});

describe('extractReceiptRows', () => {
  it('splits rows at order numbers and counts button indexes (top 구매영수증 included)', () => {
    const rows = extractReceiptRows(PAY_LIST).map((r) => [r.orderNo, r.hasCard, r.hasPurchase, r.cardIndex, r.purchaseIndex]);
    expect(rows).toEqual([
      ['2026091195203331', true, false, 0, 1],
      ['2026090994110022', false, true, 1, 1],
    ]);
    const rs = extractReceiptRows(PAY_LIST);
    expect(rs[0].seller).toBe('화원노리');
    expect(rs[0].amount).toBe(39000);
    expect(rs[1].amount).toBe(12500);
  });

  it('counts a label only as a whole word (구매영수증 is not 영수증)', () => {
    expect(countLabel('구매영수증 영수증 영수증조회', '영수증')).toBe(1);
  });
});

describe('order cards and Korean M.D. dates', () => {
  it('counts 「M.D. HH:mm 주문」 cards', () => {
    expect(countOrderCards(SHOP_LIST)).toBe(1);
    expect(countOrderCards('9.11. 11:50 주문\n9.09. 08:12 주문')).toBe(2);
  });

  it('fills the given year for 「9.11. 11:50 주문」 and 「10. 20. 10:04 결제」', () => {
    expect(parseKoreanMD('9.11. 11:50 주문', 2026)).toEqual([{ at: '2026-09-11 11:50', kind: 'order' }]);
    expect(parseKoreanMD(PAY_HISTORY, 2026)).toEqual([{ at: '2026-10-20 10:04', kind: 'pay' }]);
  });
});

describe('login, tokens, preview URL', () => {
  it('detects login by address, and by login words without order content', () => {
    expect(isLoginPage('nid.naver.com/nidlogin.login', '')).toBe(true);
    expect(isLoginPage('pay.naver.com/history', '로그인 아이디 비밀번호')).toBe(true);
    expect(isLoginPage('pay.naver.com/history', '로그인 주문번호 2026091195203331')).toBe(false);
  });

  it('pairs query-form and JSON-form tokens, and falls back to same-date tid', () => {
    const q = `https://pay.naver.com/x?paymentId=${P1}&tid=${T1} {"paymentId":"${P2}","tid":"${T2}"}`;
    expect(extractPaymentTokens(q).pairs).toEqual([
      { paymentId: P1, tid: T1 },
      { paymentId: P2, tid: T2 },
    ]);
    const set = parseTokens([`pid:${P1}`, `tid:${T1}`, 'pid:20261018NP1111111111', `tid:${T2}`, 'pid:bad']);
    expect(pairTokens(set)).toEqual([
      { paymentId: P1, tid: T1 },
      { paymentId: '20261018NP1111111111', tid: undefined },
    ]);
  });
});

describe('toImportOrder', () => {
  const slip = extractSlip(SLIP_CARD);
  if (!slip) throw new Error('fixture');
  it('keeps seconds and fills the order number from the row', () => {
    const o = toImportOrder(slip, { orderNo: P1 }, { kind: 'card' });
    expect(o).toMatchObject({ orderNo: P1, orderedAt: '2026-10-20 10:04:43', amount: 39000, payment: '카드', kind: 'card', seller: '화원노리' });
  });

  it('returns null for a timestamp without seconds unless allowNoSeconds is set', () => {
    const noSec = extractSlip(SLIP_CARD_NOSEC);
    if (!noSec) throw new Error('fixture');
    expect(toImportOrder(noSec, { orderNo: P2 })).toBeNull();
    expect(toImportOrder(noSec, { orderNo: P2 }, { allowNoSeconds: true })?.orderedAt).toBe('2026-10-19 09:30:00');
  });

  it('returns null without an order number', () => {
    const p = extractSlip(PURCHASE_SLIP);
    if (!p) throw new Error('fixture');
    expect(toImportOrder(p, undefined)).toBeNull();
  });

  it('marks a purchase receipt as 포인트·기타', () => {
    const p = extractSlip(PURCHASE_SLIP);
    if (!p) throw new Error('fixture');
    expect(toImportOrder(p, { orderNo: '2026090994110022' }, { kind: 'purchase' })).toMatchObject({
      payment: '포인트·기타',
      kind: 'purchase',
      orderedAt: '2026-09-09 08:12:40',
      amount: 12500,
    });
  });
});

/* ---------- 웹뷰 스크립트: 정적 검사 ---------- */
const FORBIDDEN_IN_NAV = ['eval(', 'new Function', 'cookie', 'localStorage', 'fetch(', 'XMLHttpRequest'];
const FORBIDDEN_IN_INTERCEPT = ['eval(', 'new Function', 'cookie', 'localStorage'];

describe('webview scripts (static)', () => {
  const navScripts = [
    NAV_HELPERS_SCRIPT,
    navScript({ kind: 'read' }),
    navScript({ kind: 'click', labels: ['영수증조회'] }),
    navScript({ kind: 'clickNth', labels: ['…'], index: 0 }),
    readTokensScript(),
    navScript({ kind: 'blocks', selectors: ['div[class*="OrderPro"]'] }),
    navScript({ kind: 'escape' }),
  ];
  it('navigation helpers and actions never use eval, cookies, storage or network calls', () => {
    for (const s of navScripts) for (const bad of FORBIDDEN_IN_NAV) expect(s).not.toContain(bad);
  });

  it('every script ends with true;', () => {
    for (const s of [...navScripts, NAV_INTERCEPT_SCRIPT]) expect(s.endsWith('true;')).toBe(true);
  });

  it('intercept script never reads cookies or storage', () => {
    for (const bad of FORBIDDEN_IN_INTERCEPT) expect(NAV_INTERCEPT_SCRIPT).not.toContain(bad);
  });

  it('rejects malformed actions', () => {
    expect(() => navScript({ kind: 'clickNth', labels: [], index: 0 })).toThrow();
    expect(() => navScript({ kind: 'clickNth', labels: ['…'], index: -1 })).toThrow();
  });
});

/* ---------- 웹뷰 스크립트: 가짜 화면에서 실행 ---------- */
class FakeEl {
  parentElement: FakeEl | null = null;
  rect = { left: 10, top: 10, width: 50, height: 20 };
  hidden = false;
  events: string[] = [];
  innerText?: string;
  href?: string;
  type?: string;
  attrs: Record<string, string>;
  children: FakeEl[];
  constructor(
    public tagName: string,
    private own: string,
    children: FakeEl[] = [],
    attrs: Record<string, string> = {},
  ) {
    this.children = children;
    this.attrs = attrs;
    children.forEach((c) => (c.parentElement = this));
  }
  get textContent(): string {
    return this.own + this.children.map((c) => c.textContent).join('');
  }
  getAttribute(n: string): string | null {
    return n in this.attrs ? this.attrs[n] : null;
  }
  getBoundingClientRect() {
    return this.rect;
  }
  contains(o: FakeEl): boolean {
    return o === this || this.children.some((c) => c.contains(o));
  }
  dispatchEvent(e: { type: string }): boolean {
    this.events.push(e.type);
    return true;
  }
  click(): void {
    this.events.push('click');
  }
  scrollIntoView(): void {}
  querySelectorAll(sel: string): FakeEl[] {
    const all = desc(this);
    if (sel === '*') return all;
    if (sel === 'a[href]') return all.filter((x) => x.tagName === 'A' && !!x.href);
    if (sel === 'script') return all.filter((x) => x.tagName === 'SCRIPT');
    return [];
  }
}
function desc(n: FakeEl): FakeEl[] {
  return n.children.flatMap((c) => [c, ...desc(c)]);
}

const tick = (): Promise<void> => Promise.resolve();

function sandbox(body: FakeEl, posts: unknown[], loc = { host: 'pay.naver.com', pathname: '/history' }): Record<string, unknown> {
  let clock = 1000000;
  class FakeMouseEvent {
    type: string;
    constructor(type: string, init: object) {
      this.type = type;
      Object.assign(this, init);
    }
  }
  const sb: Record<string, unknown> = {
    document: { body, querySelectorAll: (s: string) => body.querySelectorAll(s) },
    location: loc,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    MouseEvent: FakeMouseEvent,
    setTimeout: (fn: () => void, ms: number) => {
      clock += ms;
      void tick().then(fn);
      return 0;
    },
    Date: { now: () => clock },
    ReactNativeWebView: { postMessage: (s: string) => void posts.push(JSON.parse(s)) },
  };
  sb.window = sb;
  vm.createContext(sb);
  return sb;
}

async function waitPosts(posts: unknown[]): Promise<void> {
  for (let i = 0; i < 5000 && posts.length === 0; i++) await tick();
}

function fakeBody(): FakeEl {
  const btn = (text: string) => new FakeEl('BUTTON', '', [new FakeEl('SPAN', text)]);
  const body = new FakeEl('BODY', '', [
    new FakeEl('DIV', '', [btn('카드영수증'), btn('카드영수증')]),
    new FakeEl('A', '', [new FakeEl('SPAN', '영수증조회')]),
    btn('결제내역 삭제'),
    btn('결제상세'),
  ]);
  body.innerText = 'hello';
  return body;
}

describe('webview helpers in a fake page', () => {
  it('read waits for text on a blank page instead of reporting it empty (late-rendering sites)', async () => {
    const body = fakeBody();
    let calls = 0;
    Object.defineProperty(body, 'innerText', { get: () => (++calls > 12 ? 'ready' : ''), configurable: true });
    const posts: unknown[] = [];
    const sb = sandbox(body, posts);
    vm.runInContext(NAV_HELPERS_SCRIPT, sb);
    vm.runInContext(navScript({ kind: 'read' }), sb);
    await waitPosts(posts);
    expect(posts[0]).toMatchObject({ type: 'nav', step: 'read', text: 'ready' });
  });

  it('read on a page that stays blank gives up at the maximum wait and reports empty text', async () => {
    const body = fakeBody();
    Object.defineProperty(body, 'innerText', { get: () => '', configurable: true });
    const posts: unknown[] = [];
    const sb = sandbox(body, posts);
    vm.runInContext(NAV_HELPERS_SCRIPT, sb);
    vm.runInContext(navScript({ kind: 'read' }), sb);
    await waitPosts(posts);
    expect(posts[0]).toMatchObject({ type: 'nav', step: 'read', text: '' });
  });

  it('clickByText matches labels exactly and reports the click', async () => {
    const body = fakeBody();
    const posts: unknown[] = [];
    const sb = sandbox(body, posts);
    vm.runInContext(NAV_HELPERS_SCRIPT, sb);
    vm.runInContext(navScript({ kind: 'click', labels: ['영수증조회'] }), sb);
    await waitPosts(posts);
    expect(posts[0]).toMatchObject({ type: 'nav', step: 'clicked', ok: true, label: '영수증조회' });
    const hit = desc(body).filter((x) => x.textContent === '영수증조회');
    expect(hit.some((x) => x.events.includes('click'))).toBe(true);
  });

  it('never clicks an element whose label holds a forbidden word (결제내역 삭제)', async () => {
    const body = fakeBody();
    const posts: unknown[] = [];
    const sb = sandbox(body, posts);
    vm.runInContext(NAV_HELPERS_SCRIPT, sb);
    vm.runInContext(navScript({ kind: 'click', labels: ['결제내역 삭제'] }), sb);
    await waitPosts(posts);
    expect(posts[0]).toMatchObject({ step: 'clicked', ok: false });
    const del = desc(body).filter((x) => x.textContent === '결제내역 삭제');
    expect(del.every((x) => x.events.length === 0)).toBe(true);
  });

  it('clickByText does not accept a partial label', async () => {
    const body = fakeBody();
    const posts: unknown[] = [];
    const sb = sandbox(body, posts);
    vm.runInContext(NAV_HELPERS_SCRIPT, sb);
    vm.runInContext(navScript({ kind: 'click', labels: ['영수증'] }), sb);
    await waitPosts(posts);
    expect(posts[0]).toMatchObject({ step: 'clicked', ok: false });
  });

  it('clickNth picks the nth matching visible element in page order', async () => {
    const body = fakeBody();
    const second = desc(body).filter((x) => x.tagName === 'SPAN' && x.textContent === '카드영수증')[1];
    const posts: unknown[] = [];
    const sb = sandbox(body, posts);
    vm.runInContext(NAV_HELPERS_SCRIPT, sb);
    vm.runInContext(navScript({ kind: 'clickNth', labels: ['카드영수증'], index: 1 }), sb);
    await waitPosts(posts);
    expect(posts[0]).toMatchObject({ step: 'clicked', ok: true, index: 1 });
    expect(second.events).toContain('click');
  });

  it('read posts only url host+path (digits masked), text and structural signals', async () => {
    const body = fakeBody();
    body.innerText = PAY_LIST;
    const posts: unknown[] = [];
    const sb = sandbox(body, posts, { host: 'pay.naver.com', pathname: '/receipt/list/123456789012' });
    vm.runInContext(NAV_HELPERS_SCRIPT, sb);
    vm.runInContext(navScript({ kind: 'read' }), sb);
    await waitPosts(posts);
    const p = posts[0] as { step: string; url: string; text: string; signals: { orderNos: number } };
    expect(p.step).toBe('read');
    expect(p.url).toBe('pay.naver.com/receipt/list/#');
    expect(p.text).toBe(PAY_LIST);
    expect(p.signals.orderNos).toBe(2);
  });

  it('tokens: collects paymentId/tid pairs from links, posts ids only', async () => {
    const link = new FakeEl('A', '영수증', [], {});
    link.href = `https://pay.naver.com/receipts/preview/card?svcInfType=PD&paymentId=${P1}&tid=${T1}`;
    const body = new FakeEl('BODY', '', [link]);
    body.innerText = '';
    const posts: unknown[] = [];
    const sb = sandbox(body, posts);
    vm.runInContext(NAV_HELPERS_SCRIPT, sb);
    vm.runInContext(readTokensScript(), sb);
    await waitPosts(posts);
    const p = posts[0] as { step: string; tokens: string[] };
    expect(p.step).toBe('tokens');
    expect(p.tokens).toContain(`pair:${P1}|${T1}`);
    expect(p.tokens).toContain(`pid:${P1}`);
    expect(JSON.stringify(p)).not.toContain('receipts/preview');
  });

  it('intercept keeps the original response and stores only tokens', async () => {
    const body = new FakeEl('BODY', '');
    body.innerText = '';
    const posts: unknown[] = [];
    const sb = sandbox(body, posts);
    const payload = `{"items":[{"paymentId":"${P2}","tid":"${T2}","amount":15000}]}`;
    const response = { clone: () => ({ text: async () => payload }) };
    sb.fetch = async () => response;
    vm.runInContext(NAV_INTERCEPT_SCRIPT, sb);
    const f = sb.window as { fetch: () => Promise<unknown> };
    const got = await f.fetch();
    expect(got).toBe(response);
    for (let i = 0; i < 20; i++) await tick();
    const store = sb.__ytTokens as string[];
    expect(store).toContain(`pair:${P2}|${T2}`);
    expect(store.join(' ')).not.toContain('15000');
  });

  it('interceptScript accepts custom token patterns', () => {
    expect(interceptScript(NAVER_TOKEN_PATTERNS).endsWith('true;')).toBe(true);
  });
});

describe('naver flow: dates and seconds', () => {
  it('reads 「5,000원 | 10. 20. 10:04 결제」 with the year, and 「2026.10.19」 too', () => {
    expect(extractHistoryRows(PAY_HISTORY, NOW)).toEqual([expect.objectContaining({ date: '2026-10-20', amount: 5000, menuIndex: 0 })]);
    const rs = extractHistoryRows('2026.10.19 결제완료\n화원노리\n5,000원\n⋮', NOW);
    expect(rs[0]).toMatchObject({ date: '2026-10-19', amount: 5000, menuIndex: 0 });
  });

  it('rolls the year back across 12 → 1 and for a date after today', () => {
    const jan = Date.UTC(2026, 0, 10);
    const rs = extractHistoryRows('1. 5. 10:00 결제\n⋮\n12. 20. 09:00 결제\n⋮', jan);
    expect(rs.map((r) => r.date)).toEqual(['2026-01-05', '2025-12-20']);
    expect(rs.map((r) => r.menuIndex)).toEqual([0, 1]);
    expect(extractHistoryRows('12. 30. 09:00 결제\n⋮', jan)[0].date).toBe('2025-12-30');
  });

  it('reads 결제상세 「2026.10.20. 10:04:43」 with seconds only', () => {
    expect(extractDetailStamp('결제 상세정보\n2026.10.20. 10:04:43')).toBe('2026-10-20 10:04:43');
    expect(extractDetailStamp('2026.10.20. 10:04')).toBeUndefined();
  });

  it('fills missing seconds from 결제상세 first, then tid, only within the same minute', () => {
    const s = extractSlip(SLIP_CARD_NOSEC);
    if (!s) throw new Error('fixture');
    expect(resolveSlipSeconds(s, '2026-10-19 09:30:40', T2).paidAt).toBe('2026-10-19 09:30:40');
    expect(resolveSlipSeconds(s, '2026-10-19 08:00:00', T2).paidAt).toBe('2026-10-19 09:30:15');
    expect(resolveSlipSeconds(s).paidAtNoSeconds).toBe(true);
  });
});

/* ---------- 목록 읽기: API(1순위) · 블록 글자(대체) ---------- */
const SHOP_CARD_TEXTS: string[] = Array.from({ length: 11 }, (_, i) => {
  if (i === 5) return ['취소완료', '9.6. 11:50 주문', '상품 5', '39,000원', '상세보기'].join('\n');
  if (i === 10) return ['구매확정완료', '12.30. 09:00 주문', '연말 상품', '50,000원', '상세보기'].join('\n');
  const lines = ['구매확정완료', `9.${i + 1}. 11:50 주문`, `상품 ${i}`];
  if (i === 2) lines.push('882원 적립 완료', '41,000원');
  else lines.push(`${(i + 1) * 1000 + 38000}원`);
  lines.push('상세보기', '판매자정보/문의');
  return lines.join('\n');
});
const PAY_CARD_TEXTS: string[] = Array.from({ length: 15 }, (_, i) => {
  const lines = ['결제완료', `상품 ${i}`, `${(i + 1) * 1000}원 | 10. 20. 10:${String(i).padStart(2, '0')} 결제`];
  if (i === 7) lines.push('882원 적립 완료');
  return lines.join('\n');
});
const PAY_CARD_19 = ['결제완료', '카네이션 꽃다발', '39,000원 | 10. 20. 10:04 결제', '882원 적립 완료'].join('\n');

describe('목록 읽기: 블록 글자', () => {
  it('shop cards: 11 per page; cancelled skipped; 「882원 적립 완료」 is not the amount; yearless date rolls back', () => {
    const cards = extractShopBlocks(SHOP_CARD_TEXTS, NOW);
    expect(cards.length).toBe(10);
    expect(cards.some((c) => c.index === 5)).toBe(false);
    expect(cards.find((c) => c.index === 2)?.order).toMatchObject({ amount: 41000, orderedAt: '2026-09-03 11:50', kind: 'list', needsReceipt: true });
    expect(cards.find((c) => c.index === 10)?.order).toMatchObject({ amount: 50000, orderedAt: '2025-12-30 09:00' });
    expect(cards.find((c) => c.index === 0)?.order.title).toBe('상품 0');
  });

  it('pay cards: 15 per page; amount is the 결제 amount, not the 적립 amount', () => {
    const cards = extractPayBlocks(PAY_CARD_TEXTS, NOW);
    expect(cards.length).toBe(15);
    expect(cards.map((c) => c.order.amount)).toEqual(Array.from({ length: 15 }, (_, i) => (i + 1) * 1000));
    expect(cards[7].order.amount).toBe(8000);
    expect(cards[7].index).toBe(7);
    expect(extractPayBlocks([PAY_CARD_19], NOW)[0].order).toMatchObject({ amount: 39000, orderedAt: '2026-10-20 10:04' });
  });

  it('block script takes only well-formed selectors and posts blocks (no clicks)', () => {
    expect(() => blockTextsScript(['div"><script>'])).toThrow();
    const s = blockTextsScript(['div[class*="OrderPro"]', 'ul > li[class*="PaymentI"]']);
    expect(s).toContain('OrderPro');
    expect(s).toContain("step: 'blocks'");
    expect(s).toContain('.slice(0, 600)');
    for (const bad of FORBIDDEN_IN_NAV) expect(s).not.toContain(bad);
    expect(s).not.toContain('.click(');
  });
});

describe('목록 읽기: API 파서 · 시각', () => {
  it('normalizes ISO, epoch and dotted times to KST seconds', () => {
    expect(normalizeKst('2026-10-20 10:04:43')).toBe('2026-10-20 10:04:43');
    expect(normalizeKst('2026.10.20. 10:04:43')).toBe('2026-10-20 10:04:43');
    expect(normalizeKst('2026-10-20T01:04:43Z')).toBe('2026-10-20 10:04:43');
    expect(normalizeKst(Date.UTC(2026, 9, 20, 1, 4, 43))).toBe('2026-10-20 10:04:43');
    expect(normalizeKst('not a date')).toBeNull();
  });

  it('shop order-histories: only allowed fields become list orders; unknown shape gives null', () => {
    const json = {
      contents: [
        { orderNo: '2026091195203331', productOrderNo: '2026091195203332', orderDateTime: '2026-09-11 11:50:20', productName: '카네이션 꽃다발', productAmount: 39000, merchantName: '화원노리', buyerName: '홍길동', phone: '010-1234-5678', imageUrl: 'https://x.test/a.png' },
      ],
    };
    const got = parseOrderHistories(json);
    expect(got).toEqual([
      expect.objectContaining({ orderNo: '2026091195203331', productOrderNo: '2026091195203332', orderedAt: '2026-09-11 11:50:20', amount: 39000, title: '카네이션 꽃다발', seller: '화원노리', kind: 'list', needsReceipt: true, listKey: '2026-09-11 11:50|39000' }),
    ]);
    expect(JSON.stringify(got)).not.toContain('홍길동');
    expect(parseOrderHistories({ something: [] })).toBeNull();
  });

  it('payment timeline nvMids: no order number needed; amount may be a string', () => {
    const got = parseNvMids({ nvMids: [{ nvMid: 'abc', time: 1792500000000, productOrderStatusCode: 'PAY', productAmount: '5,000' }, { time: 'bad', productAmount: 1000 }] });
    expect(got?.length).toBe(1);
    expect(got?.[0]).toMatchObject({ orderNo: '', kind: 'list', amount: 5000, needsReceipt: true });
    expect(parseNvMids({ x: 1 })).toBeNull();
  });
});

/** 페이지 안 API 읽기: 가짜 fetch 와 가짜 페이지에서 실행 */
function apiRun(pageUrl: string, respond: (url: string) => unknown) {
  const reqs: string[] = [];
  const posts: unknown[] = [];
  const loc = { host: 'pay.naver.com', pathname: '/history', href: 'https://pay.naver.com/history' };
  const sb = sandbox(new FakeEl('BODY', ''), posts, loc);
  sb.URL = URL;
  sb.Date = Date;
  sb.__ytApi = pageUrl ? { pay: pageUrl } : {};
  sb.fetch = async (url: string) => {
    reqs.push(url);
    const r = respond(url);
    if (r === 'error') return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => r };
  };
  const action = { kind: 'api' as const, name: 'pay' as const, maxPages: 40, sinceMs: Date.parse('2025-10-28T00:00:00+09:00'), since: '2025-10-28', until: '2026-10-28' };
  return { sb, reqs, posts, action };
}
const PAY_URL = 'https://pay.naver.com/web-api/timeline/v1/payments/nvMids?page=1&size=15&startDate=2024-01-01&endDate=2024-12-31';

describe('목록 읽기: API 스크립트(페이지 안)', () => {
  it('pages through with the window keys, posts only allowed fields, stops on last', async () => {
    const r = apiRun(PAY_URL, (url) => {
      const page = new URL(url).searchParams.get('page');
      if (page === '1') return { nvMids: [{ nvMid: 'm1', time: '2026-10-20 10:04:43', productOrderStatusCode: 'PURCHASE', productAmount: 39000, name: '홍길동', phone: '010-1234-5678', address: '서울' }], hasMore: true };
      return { nvMids: [{ nvMid: 'm2', time: '2026-10-19 09:30:15', productAmount: 5000 }], last: true };
    });
    vm.runInContext(navScript(r.action), r.sb);
    await waitPosts(r.posts);
    expect(r.reqs.length).toBe(2);
    expect(r.reqs[0]).toContain('startDate=2025-10-28');
    expect(r.reqs[0]).toContain('endDate=2026-10-28');
    expect(r.reqs[1]).toContain('page=2');
    const msg = r.posts[0] as { step: string; name: string; items: Record<string, unknown>[]; page: number; done: boolean };
    expect(msg).toMatchObject({ step: 'api', name: 'pay', page: 2, done: true });
    expect(msg.items.length).toBe(2);
    for (const it of msg.items) for (const k of Object.keys(it)) expect(['nvMid', 'time', 'productOrderStatusCode', 'productAmount']).toContain(k);
    expect(JSON.stringify(msg)).not.toContain('홍길동');
    expect(JSON.stringify(msg)).not.toContain('010-1234');
  });

  it('period override fails → goes back to the original address and retries', async () => {
    const r = apiRun(PAY_URL, (url) => (url.includes('startDate=2025-10-28') ? 'error' : { nvMids: [{ nvMid: 'm3', time: '2024-06-01 10:00:00', productAmount: 1000 }], last: true }));
    vm.runInContext(navScript(r.action), r.sb);
    await waitPosts(r.posts);
    expect(r.reqs[0]).toContain('startDate=2025-10-28');
    expect(r.reqs[1]).toContain('startDate=2024-01-01');
    expect(r.posts[0]).toMatchObject({ step: 'api', done: true });
    expect(r.posts[0]).not.toMatchObject({ failed: true });
  });

  it('stops paging once the oldest item is outside the window', async () => {
    const r = apiRun(PAY_URL, () => ({ nvMids: [{ nvMid: 'old', time: '2025-10-01 10:00:00', productAmount: 1000 }], hasMore: true }));
    vm.runInContext(navScript(r.action), r.sb);
    await waitPosts(r.posts);
    expect(r.reqs.length).toBe(1);
  });

  it('never calls another host, and fails cleanly without a learned address', async () => {
    const other = apiRun('https://evil.example/web-api/timeline/v1/payments/nvMids?page=1', () => ({ nvMids: [] }));
    vm.runInContext(navScript(other.action), other.sb);
    await waitPosts(other.posts);
    expect(other.reqs).toEqual([]);
    expect(other.posts[0]).toMatchObject({ failed: true, note: 'other_host' });

    const none = apiRun('', () => ({ nvMids: [] }));
    vm.runInContext(navScript(none.action), none.sb);
    await waitPosts(none.posts);
    expect(none.posts[0]).toMatchObject({ failed: true, note: 'no_url' });
  });

  it('address learning keeps only the route addresses (no bodies)', async () => {
    const loc = { host: 'pay.naver.com', pathname: '/history', href: 'https://pay.naver.com/history' };
    const sb = sandbox(new FakeEl('BODY', ''), [], loc);
    sb.fetch = async () => ({ ok: true });
    vm.runInContext(NAV_API_INTERCEPT_SCRIPT, sb);
    const w = sb.window as { fetch: (u: string) => Promise<unknown> };
    await w.fetch('https://pay.naver.com/web-api/timeline/v1/payments/nvMids?page=1');
    await w.fetch('/my/order/api/npay/order-histories?page=1&size=10');
    await w.fetch('/some/other/path?page=1');
    const store = sb.__ytApi as Record<string, string>;
    expect(store.pay).toContain('nvMids?page=1');
    expect(store.shop).toContain('order-histories?page=1');
    expect(Object.keys(store).sort()).toEqual(['pay', 'shop']);
  });

  it('shop API: 페이지가 부른 주소를 못 배웠어도 shopping.naver.com 이면 알려진 주소로 page=1 부터 빈 목록이 나올 때까지 직접 부른다', async () => {
    const reqs: string[] = [];
    const posts: unknown[] = [];
    const sb = sandbox(new FakeEl('BODY', ''), posts, { host: 'shopping.naver.com', pathname: '/my/order' });
    sb.URL = URL;
    sb.Date = Date;
    sb.__ytApi = {};
    sb.fetch = async (url: string) => {
      reqs.push(url);
      const page = new URL(url).searchParams.get('page');
      return { ok: true, json: async () => (page === '1' ? { contents: [{ orderNo: '2026091100000001', productOrderNo: 'PD2026091100000001', orderDateTime: '2026-10-20T10:04:43+09:00', productName: '상품', productAmount: 39000, buyerName: '홍길동' }] } : { contents: [] }) };
    };
    vm.runInContext(navScript({ kind: 'api', name: 'shop', maxPages: 40, sinceMs: Date.parse('2025-10-28T00:00:00+09:00'), since: '2025-10-28', until: '2026-10-28' }), sb);
    await waitPosts(posts);
    expect(reqs).toEqual([
      'https://shopping.naver.com/my/order/api/npay/order-histories?page=1',
      'https://shopping.naver.com/my/order/api/npay/order-histories?page=2',
    ]);
    const msg = posts[0] as { step: string; name: string; items: Record<string, unknown>[]; done: boolean; failed?: boolean };
    expect(msg).toMatchObject({ step: 'api', name: 'shop', done: true });
    expect(msg.failed).toBeUndefined();
    expect(msg.items).toHaveLength(1);
    expect(Object.keys(msg.items[0])).not.toContain('buyerName');
  });

  it('shop API 대체 주소는 shopping.naver.com 에서만 — 다른 호스트나 pay 는 배운 주소가 없으면 no_url 로 끝낸다', async () => {
    const posts: unknown[] = [];
    const sb = sandbox(new FakeEl('BODY', ''), posts, { host: 'pay.naver.com', pathname: '/history' });
    sb.URL = URL;
    sb.Date = Date;
    sb.__ytApi = {};
    sb.fetch = async () => ({ ok: true, json: async () => ({}) });
    vm.runInContext(navScript({ kind: 'api', name: 'shop', maxPages: 3, sinceMs: 0, since: '2025-10-28', until: '2026-10-28' }), sb);
    await waitPosts(posts);
    expect(posts[0]).toMatchObject({ step: 'api', name: 'shop', failed: true, note: 'no_url' });
  });

  it('API script: only same-origin fetch with credentials; no eval, cookies, storage or XHR', () => {
    const s = navScript({ kind: 'api', name: 'shop', maxPages: 3, sinceMs: 0, since: '2025-10-28', until: '2026-10-28' });
    expect(s).toContain("credentials: 'include'");
    expect(s).toContain('base.host !== location.host');
    for (const bad of ['eval(', 'new Function', 'cookie', 'localStorage', 'XMLHttpRequest']) expect(s).not.toContain(bad);
    expect(() => navScript({ kind: 'api', name: 'shop', maxPages: 41, sinceMs: 0, since: '2025-10-28', until: '2026-10-28' })).toThrow();
  });
});
describe('목록 읽기: 시험용 카드 개수', () => {
  it('fixture sizes match the captured layouts (11 shop cards, 15 pay cards)', () => {
    expect(SHOP_CARD_TEXTS.length).toBe(11);
    expect(PAY_CARD_TEXTS.length).toBe(15);
  });
});

/** 판매자 번호(111-22-33333)와 가맹점 번호(999-88-77777)를 서로 다른 가짜 값으로 */
const CARD_SLIP_LABELS = [
  '카드사/승인번호 롯데 / 12345678',
  '카드번호(유효기간) 1234-56**-****-7890 (**/**)',
  '거래종류/할부 일시불',
  '결제일자 2026-10-20 10:04:43',
  '상품명 테스트 상품',
  '상품 주문번호 PD12345678901234',
  '판매자 정보',
  '판매자상호 테스트상점',
  '사업자등록번호 111-22-33333',
  '가맹점 정보',
  '가맹점명 네이버파이낸셜 주식회사',
  '사업자등록번호 999-88-77777',
  '승인 금액 39,000원',
].join('\n');

describe('6차: 카드 영수증 라벨 읽기', () => {
  it('seller number (not the 가맹점 number), 승인번호 after /, 결제일자 시분초, 판매자상호; no card number kept', () => {
    const s = extractSlip(CARD_SLIP_LABELS);
    expect(s).toMatchObject({ businessNumber: '111-22-33333', approval: '12345678', paidAt: '2026-10-20 10:04:43', paidAtNoSeconds: false, amount: 39000, merchant: '테스트상점' });
    expect(JSON.stringify(s)).not.toContain('999-88-77777');
    expect(JSON.stringify(s)).not.toContain('1234-56');
  });

  it('no 판매자 block: the 가맹점 number is not used; a missing label leaves its field empty', () => {
    const noSeller = CARD_SLIP_LABELS.split('\n').filter((l) => !l.startsWith('판매자') && !l.startsWith('사업자등록번호 111')).join('\n');
    const s = extractSlip(noSeller);
    expect(s?.businessNumber).toBeUndefined();
    expect(s?.merchant).toBeUndefined();
  });
});