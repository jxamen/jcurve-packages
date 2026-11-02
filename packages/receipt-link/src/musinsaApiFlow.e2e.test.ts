/**
 * 무신사 요청 흐름 통합 시험 — 구동기 + 흐름(musinsaApiFlow) + 실제 웹뷰 스크립트(siteFetchScript)를 가짜 페이지(노드 vm · 가짜 fetch) 위에서 처음부터 끝까지 돌린다(틀은 e2eHarness.ts).
 * 값은 모두 가짜(상호 · 번호 · 결제 키 · tid · 승인번호). 확인: 실제로 나간 요청 주소 틀, 이동(goto) 1번, 줄별 결과, 완성 주문 필드, 구조 기록(키 이름만),
 * 가득 찬 구간 반분, 끝난 까닭(교차 출처 · 목록 모양 · 목록 실패), 막힘 뒤 이어 가기, onlyKeys · known 건너뛰기.
 */
import { describe, expect, it } from 'vitest';
import { runFlow, type Page, type Router } from './e2eHarness';
import { tailOf } from './naverApiFlow';
import { outcomeKey } from './runOutcome';

const PK = (n: number): string => `PkFAKE${String(n).padStart(2, '0')}aB3dE5gH7jK9mN1pQ3`;
const TID = (n: number): string => `mps_FAKE_tid_${String(n).padStart(2, '0')}_0123456789abcdefghijklmnopqrstuvwxyz0123456789ABCDEF`;
const ordNo = (n: number): string => `20261020100000${String(n).padStart(4, '0')}`;
/** n 번째 주문의 일시 — 1~10 은 최신 구간(2026-09-15 이후), 11~17 은 그 앞 구간 */
const dateOf = (n: number): string => (n <= 10 ? `2026-10-${String(29 - n).padStart(2, '0')} 12:00:00` : `2026-09-${String(25 - n).padStart(2, '0')} 12:00:00`);

const mkRow = (n: number): Record<string, unknown> => {
  const base = {
    orderNo: ordNo(n), orderDate: dateOf(n), paymentAmount: 10000 * n, goodsName: `가짜상품${n}`, brandName: `가짜브랜드${n}`, payMethod: '신용카드', orderStatus: '배송완료',
    payment: { paymentKey: PK(n), tid: TID(n), merchantCode: 'STORE' },
  };
  if (n === 4) return { ...base, payment: undefined, payMethod: '무신사머니' };    // 카드가 아닌 결제 → 영수증 없음(요청 없이)
  if (n === 5) return { ...base, orderStatus: '취소완료' };                          // 취소 → 영수증 없음(요청 없이)
  if (n === 6) return { ...base, payment: undefined, payMethod: undefined };         // 결제 값도 수단도 모름 → 영수증 주소를 못 찾음
  return base;
};
const ALL = Array.from({ length: 17 }, (_, i) => mkRow(i + 1));

const JSON_SLIP = { approvalNo: '12345678', bizNo: '123-45-67890', approvalDateTime: '2026-10-20T10:04:43', approvalAmount: 45900, cardName: '삼성카드', merchantName: '가짜상점', cardNo: '1234-****-****-5678', ownerName: '홍길동' };
const HTML_SLIP = '<html><head><style>x{color:red}</style></head><body><h1>신용/체크카드 매출전표</h1><table>'
  + '<tr><th>판매자상호</th><td>가짜상점</td></tr><tr><th>사업자등록번호</th><td>123-45-67890</td></tr><tr><th>카드사</th><td>삼성카드</td></tr>'
  + '<tr><th>승인번호</th><td>87654321</td></tr><tr><th>거래일시</th><td>2026-10-21 12:00:00</td></tr><tr><th>승인금액</th><td>39,000원</td></tr></table><script>var a=1</script></body></html>';

const pages: Record<string, Page> = { 'www.musinsa.com/order/order-list': { text: '주문내역 45,900원 주문' } };
const LIST_PREFIX = 'GET https://api.musinsa.com/api2/claim/store/mypage/integration/order?';
const RECEIPT_PREFIX = 'GET https://pay.musinsapayments.com/mps/receipt/';

/** 서버를 흉내 낸다: 목록은 요청한 날짜 구간의 주문을 최신순으로 size 건까지(15건 상한), 매출전표는 주문 번호(뒤 4자리)로 갈래를 정한다 */
const serverOf = (rows: Record<string, unknown>[], over: { receipt?: (n: number, url: string) => ReturnType<Router> | undefined; list?: (url: string) => ReturnType<Router> | undefined } = {}): Router => (url) => {
  const u = new URL(url);
  if (u.host === 'api.musinsa.com' && u.pathname === '/api2/claim/store/mypage/integration/order') {
    const special = over.list?.(url);
    if (special) return special;
    const start = u.searchParams.get('startDate') ?? '';
    const end = u.searchParams.get('endDate') ?? '';
    const size = Number(u.searchParams.get('size'));
    const offset = Number(u.searchParams.get('onlineOffset') || 0);
    const ordered = rows
      .filter((r) => { const d = String(r.orderDate).slice(0, 10); return d >= start && d <= end; })
      .sort((a, b) => (String(a.orderDate) < String(b.orderDate) ? 1 : -1));
    const hit = ordered.slice(offset, offset + size);
    const onlineOffset = offset + size < ordered.length ? String(offset + size) : '999999999999999999';
    return { json: { meta: { result: 'SUCCESS', onlineOffset, offlineOffset: '999999999999999999' }, data: { orderList: hit } } };
  }
  if (u.host === 'www.musinsa.com' && u.pathname.startsWith('/order-service/my/order/get_order_view/')) {
    const row = rows.find((r) => r.orderNo === u.pathname.split('/').pop());
    const payment = row?.payment as { paymentKey?: string; tid?: string } | undefined;
    return { json: { orderInfo: payment?.paymentKey && payment.tid ? { payment_key: payment.paymentKey, tno: payment.tid } : {} } };
  }
  if (u.host === 'pay.musinsapayments.com' && u.pathname.startsWith('/mps/receipt/')) {
    const n = Number(u.pathname.slice(-4));
    const special = over.receipt?.(n, url);
    if (special) return special;
    if (n === 3) return { status: 404 };
    if (n === 2) return { text: HTML_SLIP };
    return { json: JSON_SLIP };
  }
  return { status: 404 };
};

const lastStates = (outcomes: { key: string; outcome: { state: string; code?: string } }[]): Map<string, string> => {
  const m = new Map<string, string>();
  for (const e of outcomes) m.set(e.key, e.outcome.state === 'failed' ? `failed:${e.outcome.code}` : e.outcome.state);
  return m;
};
const keyOf = (n: number): string => outcomeKey(ordNo(n), dateOf(n), 10000 * n);

describe('무신사 — 구동기 + 흐름 + 실제 스크립트(가짜 페이지)', () => {
  it('17건: 구간 반분 → 최신순 매출전표(JSON · HTML · 404 · 포인트 · 취소 · 값 없음) → 줄별 결과 · 완성 주문 · 구조 기록', async () => {
    const r = await runFlow('musinsa', pages, serverOf(ALL), { maxOrders: 50 });
    expect(r.results).toHaveLength(1);
    expect(r.results[0].reason).toBe('all-rows');
    // 영수증 도메인 첫 화면(/)은 다른 곳으로 넘어가 shop-lost 가 된다(11-02 실측) — 첫 영수증 주소로 들어간다
    expect(r.gotos).toHaveLength(2);
    expect(r.gotos[0]).toBe('https://www.musinsa.com/order/order-list');
    expect(r.gotos[1].startsWith('https://pay.musinsapayments.com/mps/receipt/')).toBe(true);
    const lists = r.urls.filter((u) => u.startsWith(LIST_PREFIX));
    expect(lists).toHaveLength(2);
    expect(lists[0]).toContain('size=15&searchText=');
    expect(lists[1]).toContain('onlineOffset=15');
    // 매출전표 요청: 요청 없이 정해지는 4·5·6 번은 부르지 않는다 — 주소는 대표님 원문 틀 그대로
    const receipts = r.urls.filter((u) => u.startsWith(RECEIPT_PREFIX));
    expect(receipts).toHaveLength(14);
    expect(receipts).toContain(`${RECEIPT_PREFIX}${ordNo(1)}?paymentKey=${PK(1)}&merchantCode=STORE&tid=${TID(1)}`);
    for (const n of [4, 5, 6]) expect(receipts.some((u) => u.includes(ordNo(n)))).toBe(false);
    expect([...new Set(r.urls.map((u) => new URL(u.slice(4)).host))].sort()).toEqual(['api.musinsa.com', 'pay.musinsapayments.com', 'www.musinsa.com']);
    // 목록 행 17(주문번호 있음) + 완성 주문 13
    const list = r.orders.filter((o) => o.kind === 'list');
    expect(list).toHaveLength(16);   // 취소 1건은 올리지 않는다(11-02)
    expect(list.every((o) => /^\d{18}$/.test(o.orderNo))).toBe(true);
    const cards = r.orders.filter((o) => o.kind === 'card');
    expect(cards).toHaveLength(13);
    const c1 = cards.find((o) => o.orderNo === ordNo(1));
    expect(c1).toMatchObject({ kind: 'card', approval: '12345678', businessNumber: '123-45-67890', cardIssuer: '삼성카드', orderedAt: '2026-10-20 10:04:43', amount: 45900, seller: '가짜브랜드1', title: '가짜상품1', listKey: '2026-10-28 12:00|10000' });
    const c2 = cards.find((o) => o.orderNo === ordNo(2));
    expect(c2).toMatchObject({ kind: 'card', approval: '87654321', businessNumber: '123-45-67890', orderedAt: '2026-10-21 12:00:00', amount: 39000, listKey: '2026-10-27 12:00|20000' });
    // 줄별 마지막 결과: 가져옴 13 · 영수증 없음 3(404 · 포인트 · 취소) · 못 가져옴 1(영수증 주소를 못 찾음)
    const last = lastStates(r.outcomes);
    expect(last.size).toBe(17);
    expect(last.get(keyOf(3))).toBe('none');
    expect(last.get(keyOf(4))).toBe('none');
    expect(last.get(keyOf(5))).toBe('none');
    expect(last.get(keyOf(6))).toBe('failed:no-pair');
    expect([...last.values()].filter((s) => s === 'done')).toHaveLength(13);
    // 구조 기록: 목록(가득 찬 첫 구간) · 매출전표(JSON) — 키 이름만, 값은 한 글자도 없다
    expect(r.structures.map((s) => s.where)).toEqual(['mus-list', 'mus-rcpt']);
    const [sl, sr] = r.structures;
    expect(sl).toMatchObject({ host: 'api.musinsa.com', path: '/api2/claim/store/mypage/integration/order' });
    expect(sl.lines).toContain('data.orderList : array15');
    expect(sl.lines).toContain('data.orderList[0].payment.paymentKey : string');
    expect(sr).toMatchObject({ host: 'pay.musinsapayments.com', path: '/mps/receipt/#' });
    expect(sr.lines).toContain('approvalNo : string');
    const raw = JSON.stringify(r.structures);
    for (const secret of ['가짜상품', '가짜브랜드', PK(1), TID(1), ordNo(1), '12345678', '123-45-67890', '가짜상점', '홍길동']) expect(raw).not.toContain(secret);
    // 응답의 카드번호 · 소유자 이름은 완성 주문에 없다
    const ordersRaw = JSON.stringify(r.orders);
    for (const secret of ['1234-****', '홍길동', PK(1), TID(1)]) expect(ordersRaw).not.toContain(secret);
  }, 60000);

  it('HTML 매출전표가 첫 응답이면 구조 기록은 읽은 칸의 있음 · 없음만(글자 값 없음)', async () => {
    const rows = [mkRow(2), mkRow(7)];   // 최신순: 2(HTML) → 7(JSON)
    const r = await runFlow('musinsa', pages, serverOf(rows));
    expect(r.results[0].reason).toBe('all-rows');
    const sr = r.structures.find((s) => s.where === 'mus-rcpt');
    expect(sr?.lines).toContain('has.approvalWord : boolean');
    expect(sr?.lines).toContain('has.businessWord : boolean');
    expect(JSON.stringify(r.structures)).not.toContain('87654321');
    expect(JSON.stringify(r.structures)).not.toContain('123-45-67890');
    expect(r.orders.filter((o) => o.kind === 'card')).toHaveLength(2);
  }, 30000);

  it('목록에 상호가 없으면 HTML 매출전표의 판매자상호를 쓴다 — 스크립트가 줄바꿈을 접어도 뒤 칸 글자(사업자 · 카드사 · 승인 …)까지 끌려오지 않는다', async () => {
    const bare = { ...mkRow(2), brandName: undefined, goodsName: undefined };
    const r = await runFlow('musinsa', pages, serverOf([bare, { ...mkRow(7), brandName: undefined }]));
    const card = r.orders.find((o) => o.kind === 'card' && o.orderNo === ordNo(2));
    expect(card?.seller).toBe('가짜상점');
    expect(card?.approval).toBe('87654321');
    expect(r.orders.find((o) => o.kind === 'card' && o.orderNo === ordNo(7))?.seller).toBe('가짜상점');   // JSON 매출전표의 merchantName
  }, 30000);

  it('매출전표 호스트가 요청을 받지 않으면(교차 출처) 숨은 웹뷰가 매출전표 주소를 직접 열어 읽는다 — 화면 글자로 영수증 완성(대표님 11-02 「어떤 방식이든」)', async () => {
    const rows = [mkRow(1), mkRow(7), mkRow(8)];
    const PAGE_TEXT = '신용/체크카드 매출전표\n판매자상호 가짜상점\n사업자등록번호 123-45-67890\n카드사 삼성카드\n승인번호 87654321\n거래일시 2026-10-21 12:00:00\n승인금액 39,000원';
    const navPages: Record<string, Page> = { ...pages, 'pay.musinsapayments.com/mps/receipt/#': { text: PAGE_TEXT } };
    const r = await runFlow('musinsa', navPages, serverOf(rows, { receipt: () => ({ reject: true }) }));
    expect(r.results[0].reason).toBe('all-rows');
    expect(r.orders.filter((o) => o.kind === 'card')).toHaveLength(3);
    expect(r.orders.filter((o) => o.kind === 'list')).toHaveLength(3);
    // 요청은 두 묶음(3건 + 다시 3건)에서 멈추고, 그 뒤는 주문마다 한 번씩 이동해 읽는다
    expect(r.urls.filter((u) => u.startsWith(RECEIPT_PREFIX))).toHaveLength(6);
    // 영수증 도메인 들어가기(첫 영수증 주소) 1번 + 주문마다 직접 열기 3번
    expect(r.gotos.filter((g) => g.startsWith('https://pay.musinsapayments.com/mps/receipt/'))).toHaveLength(4);
    const card = r.orders.find((o) => o.kind === 'card');
    expect(card).toMatchObject({ approval: '87654321', businessNumber: '123-45-67890', amount: 39000 });
    expect(card?.detail).toMatchObject({ approvalNo: '87654321', sellerBusinessNo: '123-45-67890', approvalAmount: 39000 });
    expect(JSON.stringify(r.orders)).not.toContain('1234-****');
  }, 60000);

  it('웹뷰 직접 열기도 빈 화면(차단 오류 페이지)만 연달아 나오면 cross-origin 으로 끝내고 줄마다 까닭을 남긴다', async () => {
    const rows = [mkRow(1), mkRow(7), mkRow(8)];
    const r = await runFlow('musinsa', pages, serverOf(rows, { receipt: () => ({ reject: true }) }));
    expect(r.results[0].reason).toBe('cross-origin');
    const last = lastStates(r.outcomes);
    expect([...last.values()].sort()).toEqual(['failed:network', 'failed:network', 'failed:network']);
    expect(r.orders.filter((o) => o.kind === 'card')).toEqual([]);
    expect(r.orders.filter((o) => o.kind === 'list')).toHaveLength(3);   // 목록 행은 올라간다 — 다음에 「가져오기」로 다시
  }, 60000);

  it('목록은 왔는데 주문 모양을 못 읽으면 list-shape, 목록 요청이 계속 실패하면 list-failed — 매출전표는 부르지 않는다', async () => {
    const shape = await runFlow('musinsa', pages, serverOf([], { list: () => ({ json: { items: [{ foo: 1 }, { bar: 'x' }] } }) }));
    expect(shape.results[0].reason).toBe('list-shape');
    expect(shape.urls.some((u) => u.startsWith(RECEIPT_PREFIX))).toBe(false);
    expect(shape.structures.map((s) => s.where)).toEqual(['mus-list']);
    const failed = await runFlow('musinsa', pages, serverOf([], { list: () => ({ status: 500 }) }));
    expect(failed.results[0].reason).toBe('list-failed');
    expect(failed.urls.filter((u) => u.startsWith(LIST_PREFIX))).toHaveLength(2);
    expect(failed.urls.some((u) => u.startsWith(RECEIPT_PREFIX))).toBe(false);
    const empty = await runFlow('musinsa', pages, serverOf([]));
    expect(empty.results[0].reason).toBe('all-rows');
    expect(empty.orders).toEqual([]);
  }, 60000);

  it('막혔다가(429) 풀리면 느리게 이어 받아 끝까지 가져온다', async () => {
    const seen = new Map<number, number>();
    const rows = [mkRow(1), mkRow(7)];
    const r = await runFlow('musinsa', pages, serverOf(rows, { receipt: (n) => { const c = (seen.get(n) ?? 0) + 1; seen.set(n, c); return c === 1 ? { status: 429 } : undefined; } }));
    expect(r.results[0].reason).toBe('all-rows');
    const receipts = r.urls.filter((u) => u.startsWith(RECEIPT_PREFIX));
    expect(receipts).toHaveLength(4);   // 두 주문이 한 번씩 막히고 한 번씩 다시
    expect(r.orders.filter((o) => o.kind === 'card')).toHaveLength(2);
    expect([...lastStates(r.outcomes).values()]).toEqual(['done', 'done']);
  }, 60000);

  it('이미 가져온 주문(뒤 4자리 + 날짜)은 매출전표를 요청하지 않고 목록 행도 다시 올리지 않는다', async () => {
    const rows = [mkRow(1), mkRow(7), mkRow(8)];
    const r = await runFlow('musinsa', pages, serverOf(rows), {}, { tails: [tailOf(ordNo(1), dateOf(1))] });
    expect(r.results[0].reason).toBe('all-rows');
    const receipts = r.urls.filter((u) => u.startsWith(RECEIPT_PREFIX));
    expect(receipts.some((u) => u.includes(ordNo(1)))).toBe(false);
    expect(receipts).toHaveLength(2);
    expect(r.orders.filter((o) => o.kind === 'list').map((o) => o.orderNo).sort()).toEqual([ordNo(7), ordNo(8)]);
  }, 60000);

  it('한 줄만 다시(onlyKeys) — 그 주문만 요청하고 목록 행은 다시 올리지 않는다', async () => {
    const rows = [mkRow(1), mkRow(7), mkRow(8)];
    const key = keyOf(7);
    const r = await runFlow('musinsa', pages, serverOf(rows), { onlyKeys: [key] });
    expect(r.results[0].reason).toBe('all-rows');
    const receipts = r.urls.filter((u) => u.startsWith(RECEIPT_PREFIX));
    expect(receipts).toEqual([`${RECEIPT_PREFIX}${ordNo(7)}?paymentKey=${PK(7)}&merchantCode=STORE&tid=${TID(7)}`]);
    expect(r.orders.filter((o) => o.kind === 'list')).toEqual([]);
    expect(r.orders.filter((o) => o.kind === 'card').map((o) => o.orderNo)).toEqual([ordNo(7)]);
    expect(r.outcomes.at(-1)).toEqual({ key, outcome: { state: 'done' } });
  }, 60000);
});
