/**
 * 쿠팡 요청 흐름(coupangApiFlow) 시험 — 이벤트를 하나씩 먹이며 낸 동작 · 결과를 확인한다(값은 모두 가짜).
 * 핵심: 클릭 · 영수증 화면 열기 없음(fetch · read 와 출처 페이지 goto 한 번뿐), 이름으로 주문 찾기, 최신부터 차례, 이미 가져온 건 건너뜀,
 *       줄별 결과, 교차 출처 거절 감지, 응답 구조 기록에 값이 안 새는지.
 */
import { describe, expect, it } from 'vitest';
import type { FlowOut } from './naverReceipt';
import { tailOf } from './naverApiFlow';
import {
  badWords, cleanMerchant, COUPANG_LIST_URL, coupangFindOverUrl, coupangListUrl, createCoupangApiFlow, findCoupangOrders, nextListPage, parseAmount, parseListDate, readReceipt, receiptUrl, textSummaryLines,
} from './coupangApiFlow';
import { outcomeKey } from './runOutcome';
import { FETCH_BATCH, type FetchResult } from './siteFetch';

const NOW = Date.parse('2026-10-29T09:00:00+09:00');
const mk = (o: Parameters<typeof createCoupangApiFlow>[0] = {}) => createCoupangApiFlow({ now: () => NOW, ...o });

const ID = (n: number): string => `11034211${String(n).padStart(5, '0')}`;
const VENDOR = 'A01709475';
const order = (n: number, at: unknown, extra: Record<string, unknown> = {}) => ({
  orderId: ID(n), orderedAt: at, totalPayAmount: 1000 * n, items: [{ vendorId: VENDOR, productName: `가짜상품${n}`, vendorName: `가짜상점${n}` }], ...extra,
});
const nextData = (orders: unknown[], extra: Record<string, unknown> = {}) => ({ orderList: orders, ...extra });

const SLIP_TEXT = [
  '쿠팡 카드 매출전표', '상점 정보', '상호 가짜상점', '사업자등록번호 120-81-00000', '결제서비스 업체정보', '카드사 롯데카드',
  '승인일시 2026.10.06 14:23:45', '승인번호 12345678', '할부 일시불', '승인금액 8,900 원',
].join('\n');

const keyOf = (n: number, at: string, amount = 1000 * n): string => outcomeKey(ID(n), at, amount);
const okText = (key: string, text = SLIP_TEXT): FetchResult => ({ key, st: 'ok', text });
const listOk = (data: unknown): FetchResult => ({ key: 'list', st: 'ok', data });

/** structure · probe 를 흘려 보내며(resume) 다음 동작까지 간다. 낸 structure 도 모은다 */
function settle(flow: ReturnType<typeof mk>, first: FlowOut, seen: Array<Extract<FlowOut, { type: 'structure' }>> = []): FlowOut {
  let out = first;
  for (let i = 0; i < 20 && 'type' in out && (out.type === 'structure' || out.type === 'probe'); i++) {
    if (out.type === 'structure') seen.push(out);
    out = flow.next({ type: 'resume' });
  }
  return out;
}

type Fetch = Extract<FlowOut, { kind: 'fetch' }>;
const asFetch = (o: FlowOut): Fetch => { if (!('kind' in o) || o.kind !== 'fetch') throw new Error(`fetch 동작이 아님: ${JSON.stringify(o).slice(0, 120)}`); return o; };

/** start → 출처 페이지 → 목록 fetch → 목록 응답 → (구조 기록) → 첫 영수증 묶음까지 */
function toFirstBatch(flow: ReturnType<typeof mk>, data: unknown, known?: { orderNos?: string[]; listKeys?: string[]; tails?: string[] }, seen: Array<Extract<FlowOut, { type: 'structure' }>> = []): Fetch {
  expect(flow.next({ type: 'start', known })).toEqual({ type: 'goto', url: coupangListUrl('2025-10-29', '2026-10-29', '2026') });
  const list = asFetch(flow.next({ type: 'page', url: 'mc.coupang.com/ssr/mobile/order/search-by-month', text: '주문 목록 1,000원' }));
  expect(list.reqs).toEqual([{ key: 'list', method: 'GET', url: coupangFindOverUrl('2025-10-29', '2026-10-29', 0), as: 'json' }]);
  return asFetch(settle(flow, flow.next({ type: 'fetched', results: [listOk(data)] }), seen));
}

describe('이름으로 주문 찾기 (findCoupangOrders)', () => {
  it('주문번호 칸이 있는 객체를 주문으로 — 일시(ISO · 에포크) · 금액(숫자 · 「12,300원」) · 상품 · 판매자 · 판매자번호를 같이 읽는다', () => {
    const ms = Date.parse('2026-10-20T10:04:43+09:00');
    const found = findCoupangOrders(nextData([
      order(1, '2026-10-06T09:11:12'),
      order(2, ms, { totalPayAmount: undefined, payAmount: '12,300원' }),
    ]));
    expect(found.map((o) => [o.orderId, o.at, o.dateOnly, o.amount])).toEqual([
      [ID(1), '2026-10-06 09:11:12', false, 1000],
      [ID(2), '2026-10-20 10:04:43', false, 12300],
    ]);
    expect(found[0]).toMatchObject({ seller: '가짜상점1', title: '가짜상품1', vendorIds: [VENDOR], cancelled: false });
  });

  it('주문번호는 자릿수로 거르지 않는다(3자리 · 14자리 · 20자리 그대로) — 주문번호 칸이 여럿이면 가장 긴 값(order 순번을 집지 않게, 대표님 11-03)', () => {
    for (const no of ['123', '25110312345678', '12345678901234567890']) {
      expect(findCoupangOrders({ list: [{ orderId: no, orderedAt: '2026-10-06T09:11:12', payAmount: 5000 }] }).map((o) => o.orderId)).toEqual([no]);
    }
    expect(findCoupangOrders({ list: [{ order: 1, orderId: '25110312345678', orderedAt: '2026-10-06T09:11:12', payAmount: 5000 }] }).map((o) => o.orderId)).toEqual(['25110312345678']);
  });

  it('날짜 머리글 객체의 날짜를 아래 주문이 이어받고, 날짜만 있으면 00:00:00 자리표시(dateOnly)', () => {
    const found = findCoupangOrders({ groups: [{ date: '2026.10.06', orders: [{ orderId: ID(3), payAmount: 5000, vendorIds: [VENDOR, 'B01234567'] }] }] });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ at: '2026-10-06 00:00:00', dateOnly: true, amount: 5000, vendorIds: [VENDOR, 'B01234567'] });
  });

  it('같은 주문번호는 바깥쪽 하나만(상품 줄이 또 들고 있어도), 일시나 금액을 못 찾은 객체는 주문이 아니다', () => {
    const found = findCoupangOrders(nextData([
      order(1, '2026-10-06T09:00:00', { items: [{ orderId: ID(1), vendorId: VENDOR, productName: '안쪽' }] }),
      { orderId: ID(2), orderedAt: '2026-10-06T09:00:00' },   // 금액 없음
      { orderId: ID(3), totalPayAmount: 100 },                // 일시 없음
    ]));
    expect(found.map((o) => o.orderId)).toEqual([ID(1)]);
  });

  it('판매자번호는 vendor 가 든 키 아래의 값만 — 다른 칸의 같은 모양 글자는 쓰지 않는다. 취소는 cancel 칸 · 상태 글자로', () => {
    const f = findCoupangOrders(nextData([
      order(1, '2026-10-06T09:00:00', { memo: 'A99999999', items: [{ vendorId: VENDOR }] }),
      order(2, '2026-10-06T09:00:00', { status: '취소완료' }),
      order(3, '2026-10-06T09:00:00', { isCancelled: true }),
    ]));
    expect(f[0].vendorIds).toEqual([VENDOR]);
    expect(f.map((o) => o.cancelled)).toEqual([false, true, true]);
  });

  it('반품 · 환불 상태 글자도 취소처럼 거른다(대표님 11-02 「반품 취소 가져오면 안 돼」) — 정상 상태 글자와 returnable 같은 가능 여부 칸은 거르지 않는다', () => {
    const f = findCoupangOrders(nextData([
      order(1, '2026-10-06T09:00:00', { status: '반품완료' }),
      order(2, '2026-10-06T09:00:00', { orderStatus: '환불 완료' }),
      order(3, '2026-10-06T09:00:00', { cancelReturnStatus: 'RETURN_COMPLETE' }),
      order(4, '2026-10-06T09:00:00', { status: '배송완료', returnable: true }),
    ]));
    expect(f.map((o) => o.cancelled)).toEqual([true, true, true, false]);
  });

  it('날짜 · 금액 읽기 — 에포크 아닌 작은 숫자 · 모양이 틀린 글자는 버린다', () => {
    expect(parseListDate('2026.10.06')).toEqual({ at: '2026-10-06 00:00:00', dateOnly: true });
    expect(parseListDate('2026-10-06')).toEqual({ at: '2026-10-06 00:00:00', dateOnly: true });
    expect(parseListDate('2026. 10. 6 주문')).toEqual({ at: '2026-10-06 00:00:00', dateOnly: true });
    expect(parseListDate('2026-13-45')).toBeNull();
    expect(parseListDate(12345)).toBeNull();
    expect(parseListDate('기타')).toBeNull();
    expect(parseAmount('12,300원')).toBe(12300);
    expect(parseAmount(8900)).toBe(8900);
    expect(parseAmount(0)).toBeUndefined();
    expect(parseAmount('abc')).toBeUndefined();
  });
});

describe('다음 쪽 · 영수증 주소', () => {
  it('다음 쪽 주소는 이름이 다음 쪽 주소인 칸의 값만 — 쿠팡 https 주소 · /ssr/ 경로. 다른 호스트는 안 쓴다', () => {
    expect(nextListPage({ nextPageUrl: 'https://mc.coupang.com/ssr/desktop/order/list?x=1' })).toEqual({ url: 'https://mc.coupang.com/ssr/desktop/order/list?x=1', more: false });
    expect(nextListPage({ a: { nextUrl: '/ssr/desktop/order/list?x=2' } }).url).toBe('https://mc.coupang.com/ssr/desktop/order/list?x=2');
    expect(nextListPage({ nextUrl: 'https://evil.example.com/x' }).url).toBeNull();
    expect(nextListPage({ hasNext: true })).toEqual({ url: null, more: true });
    expect(nextListPage({ isLast: false })).toEqual({ url: null, more: true });
    expect(nextListPage({ isLast: true })).toEqual({ url: null, more: false });
  });

  it('영수증 주소는 대표님 23:45:08 형식(orderId · vendorIds · cancel=false) — 판매자번호가 여럿이면 쉼표로 잇고, 모양이 틀리면 null', () => {
    expect(receiptUrl(ID(1), [VENDOR])).toBe(`https://payment.coupang.com/v2/card-receipt/view?orderId=${ID(1)}&vendorIds=${VENDOR}&cancel=false`);
    expect(receiptUrl(ID(1), [VENDOR, 'B01234567'])).toContain(`vendorIds=${VENDOR},B01234567&cancel=false`);
    expect(receiptUrl('12ab', [VENDOR])).toBeNull();
    expect(receiptUrl(ID(1), [])).toBeNull();
    expect(receiptUrl(ID(1), ['x&y=1'])).toBeNull();
  });
});

describe('영수증 읽기 (readReceipt)', () => {
  it('글자(HTML 에서 걷은)는 extractSlip 으로 — 사업자번호 · 승인번호 · 결제 일시 · 금액 · 카드사 · 상호', () => {
    const r = readReceipt({ key: 'k', st: 'ok', text: SLIP_TEXT });
    expect(r).toMatchObject({ kind: 'slip', slip: { businessNumber: '120-81-00000', approval: '12345678', paidAt: '2026-10-06 14:23:45', amount: 8900, cardIssuer: '롯데' } });
  });

  it('태그를 걷어 한 줄이 된 글자에서도 상호는 첫 라벨 앞에서 자른다(없으면 목록의 판매자를 쓴다)', () => {
    expect(cleanMerchant('가짜상점 사업자등록번호 120-81-00000 카드사 롯데카드')).toBe('가짜상점');
    expect(cleanMerchant('가짜상점')).toBe('가짜상점');
    expect(cleanMerchant('사업자등록번호 120-81-00000')).toBeUndefined();
    expect(cleanMerchant(undefined)).toBeUndefined();
    const oneLine = SLIP_TEXT.split('\n').join(' ');
    expect(readReceipt({ key: 'k', st: 'ok', text: oneLine })).toMatchObject({ kind: 'slip', seller: '가짜상점', slip: { businessNumber: '120-81-00000', approval: '12345678', amount: 8900 } });
  });

  it('JSON 은 이름으로 — data 가 있거나 text 가 JSON 이면(승인번호 · 사업자번호 · 승인 일시 · 금액)', () => {
    const json = { card: { approvalNo: '12345678', approvalDateTime: '2026-10-06T14:23:45', approvalAmount: 8900, cardCompanyName: '롯데카드' }, seller: { bizNo: '1208100000', vendorName: '가짜상점' } };
    for (const res of [{ key: 'k', st: 'ok' as const, data: json }, { key: 'k', st: 'ok' as const, text: JSON.stringify(json) }]) {
      expect(readReceipt(res)).toMatchObject({ kind: 'slip', seller: '가짜상점', slip: { businessNumber: '120-81-00000', approval: '12345678', paidAt: '2026-10-06 14:23:45', amount: 8900, cardIssuer: '롯데카드' } });
    }
  });

  it('취소완료 글자 · JSON 의 취소 표시 · 영수증 없음 안내는 none, 읽을 게 없으면 bad', () => {
    expect(readReceipt({ key: 'k', st: 'ok', text: `${SLIP_TEXT}\n취소완료` })).toEqual({ kind: 'none' });
    expect(readReceipt({ key: 'k', st: 'ok', data: { isCanceled: true, approvalNo: '12345678' } })).toEqual({ kind: 'none' });
    expect(readReceipt({ key: 'k', st: 'ok', text: '카드 영수증 정보가 없습니다' })).toEqual({ kind: 'none' });
    expect(readReceipt({ key: 'k', st: 'ok', text: '아무 글자' })).toEqual({ kind: 'bad' });
    expect(readReceipt({ key: 'k', st: 'ok' })).toEqual({ kind: 'bad' });
    expect(readReceipt({ key: 'k', st: 'ok', data: { approvalNo: '12345678' } })).toEqual({ kind: 'bad' });
  });

  it('글자 응답의 구조 기록 요약은 라벨 유무 · 길이 단계뿐이다(영문, 값 없음)', () => {
    const lines = textSummaryLines(SLIP_TEXT);
    expect(lines).toContain('label.biz : 1');
    expect(lines).toContain('label.approval : 1');
    expect(lines.join('\n')).not.toMatch(/[가-힣]|\d{4,}/);
  });
});

describe('흐름: 목록 → 영수증 묶음 → 줄별 결과', () => {
  const LIST = [order(1, '2026-10-06T09:11:12'), order(2, '2026-10-20T10:04:43'), order(3, '2024-01-01T09:00:00')];

  it('최신 주문부터, 1년 밖 주문은 뺀다 — 요청 주소는 대표님 형식, 방식은 글자(text) 응답', () => {
    const flow = mk();
    const b = toFirstBatch(flow, nextData(LIST));
    expect(b.reqs.map((r) => r.key)).toEqual([keyOf(2, '2026-10-20 10:04:43'), keyOf(1, '2026-10-06 09:11:12')]);
    expect(b.reqs[0]).toMatchObject({ method: 'GET', as: 'text', url: `https://payment.coupang.com/v2/card-receipt/view?orderId=${ID(2)}&vendorIds=${VENDOR}&cancel=false` });
    expect(b.conc).toBe(3);
  });

  it('목록 행(kind list, orderNo 채움, listKey)은 영수증을 받기 전에 먼저 take 로 나가고, 줄마다 「가져오는 중」이 알려진다', () => {
    const flow = mk();
    toFirstBatch(flow, nextData(LIST));
    const rows = flow.take();
    expect(rows.map((o) => [o.orderNo, o.kind, o.listKey])).toEqual([[ID(2), 'list', '2026-10-20 10:04|2000'], [ID(1), 'list', '2026-10-06 09:11|1000']]);
    expect(flow.takeOutcomes?.()).toEqual([
      { key: keyOf(2, '2026-10-20 10:04:43'), outcome: { state: 'fetching' } },
      { key: keyOf(1, '2026-10-06 09:11:12'), outcome: { state: 'fetching' } },
    ]);
  });

  it('영수증 결과가 오면 줄별 결과(가져옴 · 영수증 없음)와 완성 주문(목록 행과 같은 listKey)을 내고 all-rows 로 끝난다', () => {
    const flow = mk();
    const b = toFirstBatch(flow, nextData(LIST));
    flow.take(); flow.takeOutcomes?.();
    const out = settle(flow, flow.next({ type: 'fetched', results: [okText(b.reqs[0].key), okText(b.reqs[1].key, `${SLIP_TEXT}\n취소완료`)] }));
    expect(flow.takeOutcomes?.()).toEqual([{ key: b.reqs[0].key, outcome: { state: 'done' } }, { key: b.reqs[1].key, outcome: { state: 'none' } }]);
    expect(out).toMatchObject({ type: 'done', reason: 'all-rows' });
    const done = (out as Extract<FlowOut, { type: 'done' }>).orders;
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ orderNo: ID(2), kind: 'card', seller: '가짜상점', title: '가짜상품2', businessNumber: '120-81-00000', approval: '12345678', orderedAt: '2026-10-06 14:23:45', amount: 8900, listKey: '2026-10-20 10:04|2000' });
  });

  it('판매자번호를 못 찾은 주문은 요청 없이 그 줄에만 「영수증 주소를 못 찾았어요」(no-pair)', () => {
    const flow = mk();
    const noVendor = { orderId: ID(5), orderedAt: '2026-10-21T10:00:00', totalPayAmount: 5000 };
    const b = toFirstBatch(flow, nextData([noVendor, order(1, '2026-10-06T09:11:12')]));
    expect(b.reqs.map((r) => r.key)).toEqual([keyOf(1, '2026-10-06 09:11:12')]);
    expect(flow.takeOutcomes?.()).toContainEqual({ key: keyOf(5, '2026-10-21 10:00:00', 5000), outcome: { state: 'failed', code: 'no-pair' } });
  });

  it('영수증에 결제 시각이 없으면 목록의 주문 시각을 쓰고, 날짜만 아는 행의 초 없는 시각은 allowNoSeconds 가 꺼져 있으면 「읽지 못함」', () => {
    const noPaid = SLIP_TEXT.replace('승인일시 2026.10.06 14:23:45', '');
    const f1 = mk();
    const b1 = toFirstBatch(f1, nextData([order(1, '2026-10-06T09:11:12')]));
    f1.take(); f1.takeOutcomes?.();
    const out1 = settle(f1, f1.next({ type: 'fetched', results: [okText(b1.reqs[0].key, noPaid)] })) as Extract<FlowOut, { type: 'done' }>;
    expect(out1.orders[0]?.orderedAt).toBe('2026-10-06 09:11:12');
    const f2 = mk();
    const b2 = toFirstBatch(f2, { groups: [{ date: '2026.10.06', orders: [{ orderId: ID(7), payAmount: 7000, vendorIds: [VENDOR] }] }] });
    f2.takeOutcomes?.();
    settle(f2, f2.next({ type: 'fetched', results: [okText(b2.reqs[0].key, noPaid)] }));
    expect(f2.takeOutcomes?.()).toEqual([{ key: b2.reqs[0].key, outcome: { state: 'failed', code: 'unreadable' } }]);
    const f3 = mk({ allowNoSeconds: true });
    const b3 = toFirstBatch(f3, { groups: [{ date: '2026.10.06', orders: [{ orderId: ID(7), payAmount: 7000, vendorIds: [VENDOR] }] }] });
    f3.take(); f3.takeOutcomes?.();
    const out3 = settle(f3, f3.next({ type: 'fetched', results: [okText(b3.reqs[0].key, noPaid)] })) as Extract<FlowOut, { type: 'done' }>;
    expect(out3.orders[0]?.orderedAt).toBe('2026-10-06 00:00:00');
  });

  it(`${FETCH_BATCH}건씩 묶어 보낸다 — 열 건이면 ${FETCH_BATCH}건 + ${10 - FETCH_BATCH}건`, () => {
    const items = Array.from({ length: 10 }, (_, i) => order(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`));
    const flow = mk();
    const first = toFirstBatch(flow, nextData(items));
    expect(first.reqs).toHaveLength(FETCH_BATCH);
    flow.takeOutcomes?.();
    const second = asFetch(settle(flow, flow.next({ type: 'fetched', results: first.reqs.map((r) => okText(r.key)) })));
    expect(second.reqs).toHaveLength(10 - FETCH_BATCH);
  });
});

describe('이미 가져온 것 · 한 건 다시 · 쪽 넘김', () => {
  const LIST = [order(1, '2026-10-06T09:11:12'), order(2, '2026-10-20T10:04:43')];

  it('서버에 영수증까지 있는 주문(뒤 4자리 + 날짜 · 주문번호 · 목록 키)은 건너뛰고, 목록 행은 새로 올린다', () => {
    const f = mk();
    expect(toFirstBatch(f, nextData(LIST), { tails: [tailOf(ID(2), '2026-10-20 10:04:43')] }).reqs).toHaveLength(1);
    expect(f.take().map((o) => o.orderNo)).toEqual([ID(1)]);
    expect(toFirstBatch(mk(), nextData(LIST), { orderNos: [ID(1)] }).reqs.map((r) => r.key)).toEqual([keyOf(2, '2026-10-20 10:04:43')]);
    expect(toFirstBatch(mk(), nextData(LIST), { listKeys: ['2026-10-20 10:04|2000'] }).reqs.map((r) => r.key)).toEqual([keyOf(1, '2026-10-06 09:11:12')]);
  });

  it('가져올 게 하나도 없으면 영수증 요청 없이 끝낸다', () => {
    const f = mk();
    f.next({ type: 'start', known: { orderNos: [ID(1), ID(2)] } });
    f.next({ type: 'page', url: 'mc.coupang.com/ssr/desktop/order/list', text: '주문 1,000원' });
    expect(settle(f, f.next({ type: 'fetched', results: [listOk(nextData(LIST))] }))).toMatchObject({ type: 'done', reason: 'all-rows' });
  });

  it('onlyKeys 면 그 줄만 가져오고 목록 행은 다시 올리지 않는다 — 목록에 없는 줄은 까닭을 남긴다', () => {
    const k1 = keyOf(1, '2026-10-06 09:11:12');
    const missing = outcomeKey('1103421199999', '2026-10-01 00:00', 7);
    const f = mk({ onlyKeys: [k1, missing] });
    const b = toFirstBatch(f, nextData(LIST));
    expect(b.reqs.map((r) => r.key)).toEqual([k1]);
    expect(f.take()).toEqual([]);
    expect(f.takeOutcomes?.()).toEqual([{ key: missing, outcome: { state: 'failed', code: 'no-pair' } }, { key: k1, outcome: { state: 'fetching' } }]);
  });

  it('hasNext · nextPageIndex 로 이어 받고, 1년 밖 주문이 나오면 멈춘다', () => {
    const f = mk();
    f.next({ type: 'start' });
    f.next({ type: 'page', url: 'mc.coupang.com/ssr/mobile/order/search-by-month', text: '주문 1,000원' });
    const second = asFetch(settle(f, f.next({ type: 'fetched', results: [listOk(nextData([order(2, '2026-10-20T10:04:43')], { hasNext: true, nextPageIndex: 1 }))] })));
    expect(second.reqs[0]).toMatchObject({ key: 'list', url: coupangFindOverUrl('2025-10-29', '2026-10-29', 1), as: 'json' });
    const third = asFetch(settle(f, f.next({ type: 'fetched', results: [listOk(nextData([order(1, '2026-10-06T09:11:12')], { hasNext: true, nextPageIndex: 2 }))] })));
    expect(third.reqs[0].url).toContain('pageIndex=2');
    const b = asFetch(settle(f, f.next({ type: 'fetched', results: [listOk(nextData([order(3, '2024-01-01T09:00:00')], { hasNext: true, nextPageIndex: 3 }))] })));
    expect(b.reqs.map((r) => r.url.includes('card-receipt'))).toEqual([true, true]);
  });

  it('다음 쪽 표시는 있는데 주소를 못 찾으면 첫 쪽만 처리하고 「first-page-only」로 끝낸다', () => {
    const f = mk();
    const b = toFirstBatch(f, nextData([order(1, '2026-10-06T09:11:12')], { hasNext: true }));
    f.takeOutcomes?.();
    expect(settle(f, f.next({ type: 'fetched', results: [okText(b.reqs[0].key)] }))).toMatchObject({ type: 'done', reason: 'first-page-only' });
  });
});

describe('구조 기록 · 로그인 · 막힘 · 교차 출처 · 시간 초과', () => {
  it('목록 응답의 키 구조를 값 없이 남기고(같은 모양은 한 번만), 첫 영수증 응답의 구조도 남긴다', () => {
    const seen: Array<Extract<FlowOut, { type: 'structure' }>> = [];
    const f = mk();
    const b = toFirstBatch(f, nextData([order(1, '2026-10-06T09:11:12')]), undefined, seen);
    expect(seen.map((s) => s.where)).toEqual(['cp-list', 'cp-listpick']);
    expect(seen[0]).toMatchObject({ host: 'mc.coupang.com', path: '/ssr/api/myorders/model/find-over' });
    const raw = JSON.stringify(seen);
    for (const v of ['가짜상품1', '가짜상점1', VENDOR, ID(1)]) expect(raw).not.toContain(v);
    expect(seen[0].lines).toContain('orderList[0].orderId : string');
    f.take(); f.takeOutcomes?.();
    const seen2: Array<Extract<FlowOut, { type: 'structure' }>> = [];
    settle(f, f.next({ type: 'fetched', results: [okText(b.reqs[0].key)] }), seen2);
    expect(seen2.map((s) => s.where)).toEqual(['cp-receipt']);
    expect(seen2[0]).toMatchObject({ host: 'payment.coupang.com', path: '/v2/card-receipt/view' });
    expect(JSON.stringify(seen2)).not.toMatch(/12345678|120-81|롯데/);
  });

  it('주문을 하나도 못 찾으면 구조 기록 뒤 list-failed 로 끝난다(이름을 고칠 수 있게)', () => {
    const seen: Array<Extract<FlowOut, { type: 'structure' }>> = [];
    const f = mk();
    f.next({ type: 'start' });
    f.next({ type: 'page', url: 'mc.coupang.com/ssr/desktop/order/list', text: '주문 1,000원' });
    expect(settle(f, f.next({ type: 'fetched', results: [listOk({ props: { pageProps: { unknown: [{ foo: 1 }] } } })] }), seen)).toMatchObject({ type: 'done', reason: 'list-failed' });
    expect(seen.map((s) => s.where)).toContain('cp-list');
  });

  it('목록 요청이 세 번 실패하면 list-failed, 막히면 blocked, 로그인이 풀렸으면 로그인 뒤 목록부터 다시', () => {
    const f = mk();
    f.next({ type: 'start' });
    f.next({ type: 'page', url: 'mc.coupang.com/ssr/desktop/order/list', text: '주문 1,000원' });
    expect(f.next({ type: 'fetched', results: [{ key: 'list', st: 'shape' }] })).toMatchObject({ kind: 'fetch' });
    expect(f.next({ type: 'fetched', results: [{ key: 'list', st: 'net' }] })).toMatchObject({ kind: 'fetch' });
    expect(settle(f, f.next({ type: 'fetched', results: [{ key: 'list', st: 'net' }] }))).toMatchObject({ type: 'done', reason: 'list-failed' });
    const g = mk();
    g.next({ type: 'start' });
    g.next({ type: 'page', url: 'mc.coupang.com/ssr/desktop/order/list', text: '주문 1,000원' });
    expect(settle(g, g.next({ type: 'fetched', results: [{ key: 'list', st: 'blocked', status: 429 }] }))).toMatchObject({ type: 'done', reason: 'blocked' });
    const h = mk();
    h.next({ type: 'start' });
    h.next({ type: 'page', url: 'mc.coupang.com/ssr/desktop/order/list', text: '주문 1,000원' });
    expect(h.next({ type: 'fetched', results: [{ key: 'list', st: 'login' }] })).toEqual({ type: 'login' });
    expect(h.next({ type: 'page', url: 'mc.coupang.com/ssr/desktop/order/list', text: '주문 1,000원' })).toMatchObject({ kind: 'fetch', reqs: [{ key: 'list' }] });
  });

  it('출처 화면이 로그인 화면이면 로그인을 부탁한다', () => {
    const f = mk();
    f.next({ type: 'start' });
    expect(f.next({ type: 'page', url: 'login.coupang.com/login/loginForm', text: '로그인 아이디 비밀번호' })).toEqual({ type: 'login' });
  });

  it('영수증 요청에서 로그인이 풀리면 로그인 뒤 목록을 다시 받지 않고 같은 묶음부터 이어 간다', () => {
    const f = mk();
    const b = toFirstBatch(f, nextData([order(1, '2026-10-06T09:11:12'), order(2, '2026-10-20T10:04:43')]));
    expect(f.next({ type: 'fetched', results: b.reqs.map((r) => ({ key: r.key, st: 'login' as const })) })).toEqual({ type: 'login' });
    const again = f.next({ type: 'page', url: 'mc.coupang.com/ssr/desktop/order/list', text: '주문 1,000원' });
    expect(again).toMatchObject({ kind: 'fetch' });
    expect((again as Fetch).reqs.map((r) => r.key)).toEqual(b.reqs.map((r) => r.key));
  });

  it('막히면(403 · 429) 한 번에 2건 · 하나씩 · 요청 사이를 늘리고, 연달아 세 번 막히면 blocked 로 끝낸다', () => {
    const items = Array.from({ length: 8 }, (_, i) => order(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`));
    const f = mk();
    const b1 = toFirstBatch(f, nextData(items));
    f.takeOutcomes?.();
    const b2 = asFetch(settle(f, f.next({ type: 'fetched', results: b1.reqs.map((r) => ({ key: r.key, st: 'blocked' as const })) })));
    expect(b2).toMatchObject({ conc: 1, staggerMs: 0, gapMs: 1200 });
    expect(b2.reqs).toHaveLength(2);
    const b3 = asFetch(settle(f, f.next({ type: 'fetched', results: b2.reqs.map((r) => ({ key: r.key, st: 'blocked' as const })) })));
    expect(settle(f, f.next({ type: 'fetched', results: b3.reqs.map((r) => ({ key: r.key, st: 'blocked' as const })) }))).toMatchObject({ type: 'done', reason: 'blocked' });
  });

  it('성공이 하나도 없는 채로 영수증 요청이 net 으로만 연달아 오면(교차 출처) 요청을 되풀이하지 않고 숨은 웹뷰가 영수증 주소를 직접 연다 — 화면 글자로 영수증 완성(대표님 11-02 「어떤 방식이든」)', () => {
    const f = mk();
    const b1 = toFirstBatch(f, nextData([order(1, '2026-10-06T09:11:12'), order(2, '2026-10-20T10:04:43')]));
    f.take(); f.takeOutcomes?.();
    const b2 = asFetch(settle(f, f.next({ type: 'fetched', results: b1.reqs.map((r) => ({ key: r.key, st: 'net' as const })) })));
    expect(b2.reqs).toHaveLength(2);
    const g = settle(f, f.next({ type: 'fetched', results: b2.reqs.map((r) => ({ key: r.key, st: 'net' as const })) }));
    expect(g).toEqual({ type: 'goto', url: receiptUrl(ID(2), [VENDOR]) });   // 최신 주문부터 한 장씩
    // 웹뷰가 연 화면의 글자(태그를 걷은 본문)로 영수증을 읽는다
    const page = { type: 'page' as const, url: 'payment.coupang.com/v2/card-receipt/view', text: SLIP_TEXT };
    settle(f, f.next(page));
    const end = settle(f, f.next(page));
    expect(end).toMatchObject({ type: 'done', reason: 'all-rows' });
    const cards = (end as Extract<FlowOut, { type: 'done' }>).orders.filter((o) => o.kind === 'card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ approval: '12345678', businessNumber: '120-81-00000' });
    expect((f.takeOutcomes?.() ?? []).filter((e) => e.outcome.state === 'done')).toHaveLength(2);
  });

  it('요청으로 받았는데 못 읽은 영수증(글자 없는 껍데기 화면)은 요청이 다 끝난 뒤 숨은 웹뷰가 그 주소를 직접 열어 다시 읽는다 — 거기서도 못 읽으면 그 줄만 「읽지 못함」(대표님 11-03 18:11)', () => {
    const f = mk();
    const b1 = toFirstBatch(f, nextData([order(1, '2026-10-06T09:11:12'), order(2, '2026-10-20T10:04:43')]));
    f.take(); f.takeOutcomes?.();
    const shell = '<html><body><div id="root"></div><script src="/app.js"></script></body></html>';
    const g = settle(f, f.next({ type: 'fetched', results: b1.reqs.map((r) => okText(r.key, shell)) }));
    expect(g).toEqual({ type: 'goto', url: receiptUrl(ID(2), [VENDOR]) });
    settle(f, f.next({ type: 'page', url: 'payment.coupang.com/v2/card-receipt/view', text: SLIP_TEXT }));
    const end = settle(f, f.next({ type: 'page', url: 'payment.coupang.com/v2/card-receipt/view', text: '아무 글자' }));
    expect(end).toMatchObject({ type: 'done', reason: 'all-rows' });
    expect((end as Extract<FlowOut, { type: 'done' }>).orders.filter((o) => o.kind === 'card')).toHaveLength(1);
    const outs = f.takeOutcomes?.() ?? [];
    expect(outs.filter((e) => e.outcome.state === 'done')).toHaveLength(1);
    expect(outs.filter((e) => e.outcome.state === 'failed')).toHaveLength(1);
  });

  it('웹뷰 직접 열기도 빈 화면이 연달아 나오면(영수증 호스트가 막음) cross-origin 으로 끝내고 줄마다 까닭을 남긴다', () => {
    const f = mk();
    const b1 = toFirstBatch(f, nextData([order(1, '2026-10-06T09:11:12'), order(2, '2026-10-20T10:04:43'), order(3, '2026-10-21T11:00:00')]));
    f.take(); f.takeOutcomes?.();
    const allNet = (b: Fetch): FetchResult[] => b.reqs.map((r) => ({ key: r.key, st: 'net' as const }));
    const b2 = asFetch(settle(f, f.next({ type: 'fetched', results: allNet(b1) })));
    expect(settle(f, f.next({ type: 'fetched', results: allNet(b2) }))).toMatchObject({ type: 'goto' });
    const blank = { type: 'page' as const, url: 'payment.coupang.com/v2/card-receipt/view', text: '' };
    f.next(blank);
    f.next(blank);
    expect(settle(f, f.next(blank))).toMatchObject({ type: 'done', reason: 'cross-origin' });
    expect((f.takeOutcomes?.() ?? []).filter((e) => e.outcome.state === 'failed')).toHaveLength(3);
  });

  it('성공이 한 번이라도 있으면 net 은 그냥 요청 실패 — 두 번째에 줄마다 「인터넷이 불안정」', () => {
    const items = Array.from({ length: 8 }, (_, i) => order(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`));
    const f = mk();
    const b1 = toFirstBatch(f, nextData(items));
    f.take(); f.takeOutcomes?.();
    const b2 = asFetch(settle(f, f.next({ type: 'fetched', results: b1.reqs.map((r, i) => (i === 0 ? okText(r.key) : { key: r.key, st: 'net' as const })) })));
    expect(b2.reqs).toHaveLength(FETCH_BATCH);
  });

  it('404 같은 응답은 그 주문에 카드영수증이 없는 것(영수증 없음), 5xx 는 다시 해 보고 안 되면 「인터넷이 불안정」', () => {
    const f = mk();
    const b = toFirstBatch(f, nextData([order(1, '2026-10-06T09:11:12'), order(2, '2026-10-20T10:04:43')]));
    f.take(); f.takeOutcomes?.();
    const b2 = asFetch(settle(f, f.next({ type: 'fetched', results: [{ key: b.reqs[0].key, st: 'http', status: 404 }, { key: b.reqs[1].key, st: 'http', status: 503 }] })));
    expect(f.takeOutcomes?.()).toEqual([{ key: b.reqs[0].key, outcome: { state: 'none' } }, { key: b.reqs[1].key, outcome: { state: 'fetching' } }]);
    expect(b2.reqs.map((r) => r.key)).toEqual([b.reqs[1].key]);
  });

  it('시간 초과면 그 묶음을 한 번 더 보내고, 두 번째에도 안 오면 줄마다 「인터넷이 불안정」', () => {
    const f = mk();
    const b1 = toFirstBatch(f, nextData([order(1, '2026-10-06T09:11:12')]));
    f.take(); f.takeOutcomes?.();
    const b2 = asFetch(f.next({ type: 'timeout' }));
    expect(b2.reqs.map((r) => r.key)).toEqual(b1.reqs.map((r) => r.key));
    expect(settle(f, f.next({ type: 'timeout' }))).toMatchObject({ type: 'done', reason: 'all-rows' });
    expect((f.takeOutcomes?.() ?? []).filter((e) => e.outcome.state === 'failed').map((e) => (e.outcome as { code: string }).code)).toEqual(['network']);
  });

  it('알 수 없는 이벤트면 끝낸다', () => {
    const f = mk();
    f.next({ type: 'start' });
    expect(settle(f, f.next({ type: 'tokens', tokens: [], hasMore: false }))).toMatchObject({ type: 'done', reason: 'unexpected-event' });
  });
});

describe('클릭 · 화면 열기 없음', () => {
  it('흐름이 낸 모든 동작은 fetch · read 와 출처 페이지 goto 한 번 · login · structure · probe · done 뿐이다', () => {
    const outs: FlowOut[] = [];
    const f = mk();
    const feed = (o: FlowOut): FlowOut => { outs.push(o); return o; };
    const items = Array.from({ length: 9 }, (_, i) => order(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`));
    feed(f.next({ type: 'start' }));
    feed(f.next({ type: 'page', url: 'mc.coupang.com/ssr/desktop/order/list', text: '주문 1,000원' }));
    let out = feed(f.next({ type: 'fetched', results: [listOk(nextData(items))] }));
    for (let i = 0; i < 20; i++) {
      if ('type' in out && (out.type === 'structure' || out.type === 'probe')) { out = feed(f.next({ type: 'resume' })); continue; }
      if ('kind' in out && out.kind === 'fetch') { const reqs = out.reqs; out = feed(f.next({ type: 'fetched', results: reqs.map((r, n) => (n % 2 === 0 ? okText(r.key) : { key: r.key, st: 'http' as const, status: 404 })) })); continue; }
      break;
    }
    expect(out).toMatchObject({ type: 'done' });
    for (const o of outs) {
      if ('kind' in o) expect(['fetch', 'read']).toContain(o.kind);
      else if (o.type === 'goto') expect(o.url.startsWith(`${COUPANG_LIST_URL}?`)).toBe(true);
      else expect(['login', 'probe', 'structure', 'done']).toContain(o.type);
    }
    expect(outs.filter((o) => 'type' in o && o.type === 'goto')).toHaveLength(1);
  });
});

describe('못 읽은 응답 낱말 기록', () => {
  it('정해 둔 낱말 유무와 길이 단계만 — 숫자 · 이름은 남기지 않는다', () => {
    const k = badWords('<script>alert("쿠페이 머니로 결제한 주문은 카드 영수증이 없습니다 홍길동 01012345678")</script>');
    expect(k).toMatch(/^bw-[a-z]+-l\d+$/);
    expect(k).toContain('ade');
    expect(k).not.toMatch(/홍|0101/);
    expect(badWords('')).toBe('bw-0-l0');
  });
});
