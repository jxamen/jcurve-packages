/**
 * 쿠팡 요청 흐름 통합 시험 — 구동기 + 흐름(coupangApiFlow) + 실제 웹뷰 스크립트(siteFetchScript)를 가짜 페이지(노드 vm · 가짜 fetch) 위에서 처음부터 끝까지 돌린다(틀은 e2eHarness.ts).
 * 확인: 나간 요청 주소 틀, 이동(goto) 한 번, 줄별 결과, 완성 주문 필드, 구조 기록(키 이름만 · 값 없음), 알 수 없는 모양 · 교차 출처 거절의 끝난 까닭, known(tails) · onlyKeys 건너뛰기.
 * 응답은 모두 **가짜**다(원문 값 없음). 응답 모양은 coupangApiFlow 의 「이름으로 찾는 규칙」에 맞췄다.
 */
import { describe, expect, it } from 'vitest';
import { COUPANG_LIST_URL } from './coupangApiFlow';
import { runFlow, type Page, type Router } from './e2eHarness';
import { tailOf } from './naverApiFlow';
import { outcomeKey } from './runOutcome';

const ID = (n: number): string => `11034211${String(n).padStart(5, '0')}`;
const VENDOR = 'A01709475';
const LIST_KEY = 'mc.coupang.com/ssr/desktop/order/list';
const pages: Record<string, Page> = { [LIST_KEY]: { text: '주문 목록 8,900원 주문' } };

const receiptUrl = (n: number): string => `https://payment.coupang.com/v2/card-receipt/view?orderId=${ID(n)}&vendorIds=${VENDOR}&cancel=false`;
const htmlOf = (data: unknown): string => `<html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></head><body>주문 목록</body></html>`;
const item = (n: number, extra: Record<string, unknown> = {}) => ({ orderId: ID(n), totalPayAmount: 1000 * n, vendorItems: [{ vendorId: VENDOR, productName: `가짜상품${n}`, vendorName: `가짜상점${n}` }], ...extra });

const GROUPS = [
  { date: '2026.10.20', orders: [item(1), item(2), item(5, { status: '취소완료' })] },
  { date: '2026.10.10', orders: [item(3), { orderId: ID(4), totalPayAmount: 4000, vendorItems: [{ productName: '판매자번호 없음' }] }] },
];
/** 날짜 머리글 묶음(날짜만) 안에 주문이 든 가짜 __NEXT_DATA__ — 스크립트의 응답 줄이기(깊이 12) 안쪽 모양 */
const DATA = { props: { pageProps: { orderGroups: GROUPS } } };
/** 실제 Next.js 처럼 dehydratedState.queries[].state.data 아래에 깊이 든 모양 — 지금은 스크립트가 깊이 12 에서 잘라 판매자번호가 사라진다(최종 보고 참조) */
const DEEP_DATA = { props: { pageProps: { dehydratedState: { queries: [{ state: { data: { orderGroups: GROUPS } } }] } } } };

const SLIP_JSON = { card: { approvalNo: '11112222', approvalDateTime: '2026-10-20T14:23:45', approvalAmount: 2000, cardCompanyName: '삼성카드' }, seller: { bizNo: '1208100000', vendorName: '가짜상점2' }, owner: { name: '홍길동' } };
const SLIP_HTML = '<html><body><div class="slip"><h1>쿠팡 카드 매출전표</h1><dl><dt>상호</dt><dd>가짜상점1</dd><dt>사업자등록번호</dt><dd>120-81-00000</dd><dt>카드사</dt><dd>롯데카드</dd><dt>승인일시</dt><dd>2026.10.20 09:11:12</dd><dt>승인번호</dt><dd>12345678</dd><dt>승인금액</dt><dd>1,000 원</dd></dl></div></body></html>';

const router: Router = (url) => {
  if (url.includes('/ssr/api/myorders/model/find-over')) return { json: DATA };
  if (url === receiptUrl(1)) return { text: SLIP_HTML };        // HTML 글자 영수증
  if (url === receiptUrl(2)) return { json: SLIP_JSON };         // JSON 영수증
  if (url === receiptUrl(3)) return { status: 404 };             // 영수증 없음
  return { status: 500 };
};

const lastOutcomes = (outcomes: { key: string; outcome: { state: string; code?: string } }[]): Map<string, string> => {
  const m = new Map<string, string>();
  for (const e of outcomes) m.set(e.key, e.outcome.state === 'failed' ? `failed:${e.outcome.code}` : e.outcome.state);
  return m;
};

describe('쿠팡 — 구동기 + 흐름 + 실제 스크립트(가짜 페이지)', () => {
  it('목록(__NEXT_DATA__) → 최신순 영수증 요청 → 줄별 결과(가져옴 2 · 영수증 없음 · 주소 못 찾음) → 완성 주문 · 구조 기록 · 끝', async () => {
    const r = await runFlow('coupang', pages, router);
    expect(r.results).toHaveLength(1);
    expect(r.results[0].reason).toBe('all-rows');
    // 이동은 출처 페이지 한 번뿐
    expect(r.gotos).toHaveLength(1);
    expect(r.gotos[0]).toContain(`${COUPANG_LIST_URL}?`);
    // 나간 요청: 목록 한 번 + 판매자번호가 있는 주문 셋(번호 3 · 2 · 1 의 날짜 순이 아니라 최신 날짜 묶음 → 오래된 묶음 순)
    expect(r.urls[0]).toContain('/ssr/api/myorders/model/find-over');
    expect(r.urls[0]).toContain('size=10&pageIndex=0');
    const receipts = r.urls.filter((u) => u.includes('card-receipt'));
    expect(receipts.sort()).toEqual([`GET ${receiptUrl(1)}`, `GET ${receiptUrl(2)}`, `GET ${receiptUrl(3)}`]);   // 판매자번호 없는 4번 · 취소 5번은 요청하지 않는다
    expect(r.urls.every((u) => /^GET https:\/\/(mc|payment)\.coupang\.com\//.test(u))).toBe(true);
    // 목록 행(취소 제외 4건)과 완성 주문 2건
    expect(r.orders.filter((o) => o.kind === 'list').map((o) => o.orderNo).sort()).toEqual([ID(1), ID(2), ID(3), ID(4)]);
    const cards = r.orders.filter((o) => o.kind === 'card').sort((a, b) => a.orderNo.localeCompare(b.orderNo));
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ orderNo: ID(1), kind: 'card', seller: '가짜상점1', businessNumber: '120-81-00000', approval: '12345678', orderedAt: '2026-10-20 09:11:12', amount: 1000, title: '가짜상품1' });
    expect(cards[1]).toMatchObject({ orderNo: ID(2), kind: 'card', seller: '가짜상점2', businessNumber: '120-81-00000', approval: '11112222', cardIssuer: '삼성카드', orderedAt: '2026-10-20 14:23:45', amount: 2000 });
    // JSON 영수증은 세부 칸(서버 허용 칸 이름)도 채운다 — 운영에 쿠팡 detail 빈 칸으로 올라간 것(10-30 3건)의 고침
    expect(cards[1].detail).toMatchObject({ approvalNo: '11112222', cardCompany: '삼성카드', approvalAt: '2026-10-20 14:23:45', approvalAmount: 2000, sellerBusinessNo: '120-81-00000', sellerName: '가짜상점2' });
    // 완성 주문은 목록 행과 같은 listKey(날짜만 아는 행은 00:00)
    expect(cards[0].listKey).toBe('2026-10-20 00:00|1000');
    // 줄별 마지막 결과: 1 · 2 가져옴, 3 영수증 없음, 4 주소 못 찾음
    const last = lastOutcomes(r.outcomes);
    expect(last.get(outcomeKey(ID(1), '2026-10-20 00:00:00', 1000))).toBe('done');
    expect(last.get(outcomeKey(ID(2), '2026-10-20 00:00:00', 2000))).toBe('done');
    expect(last.get(outcomeKey(ID(3), '2026-10-10 00:00:00', 3000))).toBe('none');
    expect(last.get(outcomeKey(ID(4), '2026-10-10 00:00:00', 4000))).toBe('failed:no-pair');
    // 개인정보는 완성 주문에 없다
    expect(JSON.stringify(r.orders)).not.toMatch(/홍길동|1234-\*\*/);
  }, 30000);

  it('깊은 dehydratedState 안의 주문도 판매자번호까지 읽는다(응답 줄이기 깊이 한도 24)', async () => {
    const r = await runFlow('coupang', pages, (u) => (u.includes('/ssr/api/myorders/model/find-over') ? { json: DEEP_DATA } : router(u, {})));
    expect(r.urls.filter((u) => u.includes('card-receipt')).length).toBe(3);
  }, 30000);

  it('구조 기록은 키 이름만 — 목록 · 이름으로 찾은 칸 · 첫 영수증, 값(상품 · 판매자 · 번호 · 승인번호)은 한 글자도 없다', async () => {
    const r = await runFlow('coupang', pages, router);
    expect(r.structures.map((s) => s.where)).toEqual(['cp-list', 'cp-listpick', 'cp-receipt']);
    expect(r.structures[0]).toMatchObject({ host: 'mc.coupang.com', path: '/ssr/api/myorders/model/find-over' });
    expect(r.structures[2]).toMatchObject({ host: 'payment.coupang.com', path: '/v2/card-receipt/view' });
    expect(r.structures[0].lines.some((l) => l.endsWith('orderGroups[0].orders[0].orderId : string'))).toBe(true);
    const raw = JSON.stringify(r.structures);
    for (const v of ['가짜상품', '가짜상점', VENDOR, ID(1), ID(2), '12345678', '11112222', '120-81', '홍길동', '삼성카드']) expect(raw, v).not.toContain(v);
  }, 30000);

  it('알 수 없는 모양: 주문이 없으면 구조 기록을 남기고 list-failed, JSON 이 아니면 요청 세 번 뒤 list-failed', async () => {
    const empty = await runFlow('coupang', pages, (u) => (u.includes('/ssr/api/myorders/model/find-over') ? { json: { props: { pageProps: { unknown: [{ foo: 1 }] } } } } : { status: 500 }));
    expect(empty.results[0].reason).toBe('list-failed');
    expect(empty.structures.map((s) => s.where)).toContain('cp-list');
    expect(empty.urls.filter((u) => u.includes('card-receipt'))).toEqual([]);
    const noNext = await runFlow('coupang', pages, (u) => (u.includes('/ssr/api/myorders/model/find-over') ? { text: '<html><body>주문 목록</body></html>' } : { status: 500 }));
    expect(noNext.results[0].reason).toBe('list-failed');
    expect(noNext.urls.filter((u) => u.includes('/ssr/api/myorders/model/find-over'))).toHaveLength(3);
  }, 30000);

  it('교차 출처 거절: 영수증 요청이 net 으로만 오면 숨은 웹뷰가 영수증 주소를 직접 열어 읽는다(대표님 11-02 「어떤 방식이든」 · 10-29 17:05)', async () => {
    const navPages: Record<string, Page> = { ...pages, 'payment.coupang.com/v2/card-receipt/view': { text: JSON.stringify(SLIP_JSON) } };
    const r = await runFlow('coupang', navPages, (u) => (u.includes('/ssr/api/myorders/model/find-over') ? { json: DATA } : { reject: true }));
    expect(r.results[0].reason).toBe('all-rows');
    // 두 묶음(3건 + 다시 3건)까지만 요청하고, 그 뒤는 주문마다 한 번씩 이동해 읽는다
    expect(r.urls.filter((u) => u.includes('card-receipt'))).toHaveLength(6);
    expect(r.gotos[0]).toContain(`${COUPANG_LIST_URL}?`);
    expect(r.gotos.filter((g) => g.includes('card-receipt'))).toHaveLength(3);
    // 화면 글자(JSON 본문)로 읽은 영수증 — 세부 칸(서버 허용 칸 이름)도 붙는다
    const cards = r.orders.filter((o) => o.kind === 'card');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({ approval: '11112222', businessNumber: '120-81-00000', cardIssuer: '삼성카드', seller: '가짜상점2' });
    expect(cards[0].detail).toMatchObject({ approvalNo: '11112222', cardCompany: '삼성카드', sellerBusinessNo: '120-81-00000', approvalAmount: 2000 });
    expect(r.orders.filter((o) => o.kind === 'list')).toHaveLength(4);
    expect(JSON.stringify(r.orders)).not.toContain('홍길동');
  }, 30000);

  it('웹뷰 직접 열기도 빈 화면(차단 오류 페이지)만 연달아 나오면 cross-origin 으로 끝내고 줄마다 까닭을 남긴다', async () => {
    const r = await runFlow('coupang', pages, (u) => (u.includes('/ssr/api/myorders/model/find-over') ? { json: DATA } : { reject: true }));
    expect(r.results[0].reason).toBe('cross-origin');
    expect(r.orders.filter((o) => o.kind === 'list').length).toBeGreaterThan(0);
    expect(r.orders.filter((o) => o.kind === 'card')).toEqual([]);
    expect([...lastOutcomes(r.outcomes).values()].filter((v) => v === 'failed:network')).toHaveLength(3);
  }, 30000);

  it('막히면(429) 한 번에 2건 · 하나씩으로 늦추고 연달아 세 번 막히면 blocked 로 끝낸다', async () => {
    const r = await runFlow('coupang', pages, (u) => (u.includes('/ssr/api/myorders/model/find-over') ? { json: DATA } : { status: 429 }));
    expect(r.results[0].reason).toBe('blocked');
  }, 40000);

  it('이미 가져온 주문(뒤 4자리 + 날짜)은 영수증을 요청하지 않고 목록 행도 다시 올리지 않는다', async () => {
    const r = await runFlow('coupang', pages, router, { sinceLatest: false }, { tails: [tailOf(ID(1), '2026-10-20 00:00:00')] });
    expect(r.results[0].reason).toBe('all-rows');
    expect(r.urls.some((u) => u.includes(`orderId=${ID(1)}`))).toBe(false);
    expect(r.urls.some((u) => u.includes(`orderId=${ID(2)}`))).toBe(true);
    expect(r.orders.filter((o) => o.kind === 'list').map((o) => o.orderNo).sort()).toEqual([ID(2), ID(3), ID(4)]);
  }, 30000);

  it('저장된 가장 최근 주문 날짜 이후만 읽는다(대표님 11-02) — 그보다 오래된 주문은 요청도 · 목록 행도 없다', async () => {
    const r = await runFlow('coupang', pages, router, {}, { tails: [tailOf(ID(1), '2026-10-20 00:00:00')] });
    const all = await runFlow('coupang', pages, router, { sinceLatest: false }, { tails: [tailOf(ID(1), '2026-10-20 00:00:00')] });
    const listed = r.orders.filter((o) => o.kind === 'list').map((o) => o.orderNo);
    expect(listed.length).toBeLessThanOrEqual(all.orders.filter((o) => o.kind === 'list').length);
    for (const o of r.orders) expect(o.orderedAt.slice(0, 10) >= '2026-10-20').toBe(true);
    expect(r.urls.some((u) => u.includes(`orderId=${ID(1)}`))).toBe(false);
  }, 30000);

  it('한 줄만 다시(onlyKeys) — 그 주문만 요청하고 목록 행은 다시 올리지 않는다', async () => {
    const key = outcomeKey(ID(2), '2026-10-20 00:00:00', 2000);
    const r = await runFlow('coupang', pages, router, { onlyKeys: [key] });
    expect(r.results[0].reason).toBe('all-rows');
    expect(r.urls.filter((u) => u.includes('card-receipt'))).toEqual([`GET ${receiptUrl(2)}`]);
    expect(r.orders.filter((o) => o.kind === 'list')).toEqual([]);
    expect(r.orders.filter((o) => o.kind === 'card').map((o) => o.orderNo)).toEqual([ID(2)]);
    expect(r.outcomes.at(-1)).toEqual({ key, outcome: { state: 'done' } });
  }, 30000);
});
