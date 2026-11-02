/**
 * 무신사 요청 흐름(musinsaApiFlow) 시험 — 이벤트를 하나씩 먹이며 낸 동작 · 결과를 확인한다(값은 모두 가짜).
 * 핵심: 클릭 · 영수증 화면 열기 없음(fetch 와 출처 페이지 한 번의 goto 뿐), 대표님 요청 주소 그대로, 가득 찬 구간 나누기, 이름 찾기, 줄별 결과, 구조 기록(값 없음).
 */
import { describe, expect, it } from 'vitest';
import type { FlowOut } from './naverReceipt';
import type { ApiFlowOptions } from './naverApiFlow';
import { tailOf } from './naverApiFlow';
import {
  cleanMerchant, createMusinsaApiFlow, findKey, findOrderRows, MUSINSA_ORDER_LIST_URL, parseOrderRow, slipFromJson, slipOf,
} from './musinsaApiFlow';
import { checkFetchRun, FETCH_BATCH, type FetchResult } from './siteFetch';
import { outcomeKey } from './runOutcome';

const NOW = Date.parse('2026-10-29T09:00:00+09:00');
const mk = (o: ApiFlowOptions = {}) => createMusinsaApiFlow({ now: () => NOW, ...o });

type Fetch = Extract<FlowOut, { kind: 'fetch' }>;
type Struct = Extract<FlowOut, { type: 'structure' }>;
const asFetch = (out: FlowOut): Fetch => {
  if (!('kind' in out) || out.kind !== 'fetch') throw new Error(`fetch 동작이 아님: ${JSON.stringify(out).slice(0, 120)}`);
  return out;
};
/** structure 를 모아 흘려 보내며 다음 동작까지 간다 */
function pass(flow: ReturnType<typeof mk>, first: FlowOut, seen: Struct[] = []): FlowOut {
  let out = first;
  for (let i = 0; i < 10 && 'type' in out && out.type === 'structure'; i++) { seen.push(out); out = flow.next({ type: 'resume' }); }
  return out;
}
/** probe 를 흘려 보내며 done 까지 간다 */
function finishOut(flow: ReturnType<typeof mk>, first: FlowOut, seen: Struct[] = []): FlowOut {
  let out = first;
  for (let i = 0; i < 20 && 'type' in out && (out.type === 'probe' || out.type === 'structure'); i++) {
    if (out.type === 'structure') seen.push(out);
    out = flow.next({ type: 'resume' });
  }
  return out;
}

const PK = (n: number): string => `PkFAKE${String(n).padStart(2, '0')}aB3dE5gH7jK9mN1pQ3`;
const TID = (n: number): string => `mps_FAKE_tid_${String(n).padStart(2, '0')}_0123456789abcdefghijklmnopqrstuvwxyz0123456789ABCDEF`;
const ordNo = (n: number): string => `20261020100000${String(n).padStart(4, '0')}`;
const row = (n: number, at: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  orderNo: ordNo(n), orderDate: at, paymentAmount: 10000 * n, goodsName: `가짜상품${n}`, brandName: `가짜브랜드${n}`, payMethod: '신용카드', orderStatus: '배송완료',
  payment: { paymentKey: PK(n), tid: TID(n), merchantCode: 'STORE' }, ...extra,
});
const keyOf = (n: number, at: string): string => outcomeKey(ordNo(n), at, 10000 * n);
const listBody = (rows: unknown[]) => ({ meta: { result: 'SUCCESS', onlineOffset: '999999999999999999', offlineOffset: '999999999999999999' }, data: { orderList: rows } });

const JSON_SLIP = { approvalNo: '12345678', bizNo: '123-45-67890', approvalDateTime: '2026-10-20T10:04:43', approvalAmount: 45900, cardName: '삼성카드', merchantName: '가짜상점' };
const TEXT_SLIP = '신용/체크카드 매출전표\n판매자상호 가짜상점\n사업자등록번호 123-45-67890\n카드사 삼성카드\n승인번호 12345678\n거래일시 2026-10-20 10:04:43\n승인금액 45,900원';
const OKJ = (key: string, data: unknown = JSON_SLIP): FetchResult => ({ key, st: 'ok', data });
const OKT = (key: string, text: string = TEXT_SLIP): FetchResult => ({ key, st: 'ok', text });

/** start → 출처 페이지 → 목록 fetch(날짜 구간들) */
function toList(flow: ReturnType<typeof mk>, known?: { orderNos?: string[]; listKeys?: string[]; tails?: string[] }): Fetch {
  expect(flow.next({ type: 'start', known })).toEqual({ type: 'goto', url: MUSINSA_ORDER_LIST_URL });
  return asFetch(flow.next({ type: 'page', url: 'www.musinsa.com/order/order-list', text: '주문내역 45,900원' }));
}
/** 구간 i 의 응답에 rows 를 넣고 나머지 구간은 빈 목록 */
const listResults = (f: Fetch, rowsAt: Record<number, unknown[]>): FetchResult[] =>
  f.reqs.map((q, i) => ({ key: q.key, st: 'ok' as const, data: listBody(rowsAt[i] ?? []) }));
/** 목록 → 주문 상세 → 영수증 도메인 출처 → 첫 매출전표 묶음까지 */
function toReceipts(flow: ReturnType<typeof mk>, rows: unknown[], known?: { orderNos?: string[]; listKeys?: string[]; tails?: string[] }, seen: Struct[] = []): Fetch {
  const f = toList(flow, known);
  let out = pass(flow, flow.next({ type: 'fetched', results: listResults(f, { 0: rows }) }), seen);
  for (let i = 0; i < 30; i++) {
    if ('type' in out && out.type === 'goto') {
      out = pass(flow, flow.next({ type: 'page', url: 'pay.musinsapayments.com/', text: '' }), seen);
      continue;
    }
    const batch = asFetch(out);
    if (!batch.reqs.every((q) => q.url.includes('/get_order_view/'))) return batch;
    out = pass(flow, flow.next({ type: 'fetched', results: batch.reqs.map((q) => {
      const n = Number(q.url.slice(-4));
      const source = rows.find((r) => (r as { orderNo?: unknown }).orderNo === q.url.split('/').pop()) as { payment?: unknown } | undefined;
      return { key: q.key, st: 'ok' as const, data: { orderInfo: source?.payment ? { payment_key: PK(n), tno: TID(n) } : {} } };
    }) }), seen);
  }
  throw new Error('매출전표 단계에 도달하지 못했습니다');
}

const ROWS = [row(1, '2026-10-20 10:04:43'), row(2, '2026-10-25 12:00:00'), row(3, '2026-09-05 09:30:00')];

describe('요청 주소 — 대표님 원문(23:51 · 23:52) 그대로', () => {
  it('출처 페이지를 한 번 열고 최근 1년 목록을 offset 없이 처음 부른다', () => {
    const f = toList(mk());
    expect(f.reqs).toHaveLength(1);
    expect(f.reqs[0]).toMatchObject({
      method: 'GET', as: 'json', accept: 'application/json, text/plain, */*',
      url: 'https://api.musinsa.com/api2/claim/store/mypage/integration/order?size=15&searchText=&startDate=2025-10-29&endDate=2026-10-29',
    });
    expect(() => checkFetchRun(f)).not.toThrow();
  });

  it('매출전표는 GET pay.musinsapayments.com/mps/receipt/{주문번호}?paymentKey=…&merchantCode=…&tid=… 로 최신 주문부터 부른다', () => {
    const flow = mk();
    const b = toReceipts(flow, ROWS);
    expect(b.reqs.map((q) => q.key)).toEqual([keyOf(2, '2026-10-25 12:00:00'), keyOf(1, '2026-10-20 10:04:43'), keyOf(3, '2026-09-05 09:30:00')]);
    expect(b.reqs[0]).toMatchObject({
      method: 'GET', as: 'text', url: `https://pay.musinsapayments.com/mps/receipt/${ordNo(2)}?paymentKey=${PK(2)}&merchantCode=STORE&tid=${TID(2)}`,
    });
    expect(b.reqs[0].accept).toContain('text/html');
    expect(() => checkFetchRun(b)).not.toThrow();
  });

  it('영수증 merchantCode 는 상세 확인 경로와 같이 STORE 를 쓴다', () => {
    const noMerchant = row(1, '2026-10-20 10:04:43', { payment: { paymentKey: PK(1), tid: TID(1) } });
    const other = row(2, '2026-10-25 12:00:00', { payment: { paymentKey: PK(2), tid: TID(2), merchantCode: 'ABCDE' } });
    const b = toReceipts(mk(), [noMerchant, other]);
    expect(b.reqs[0].url).toContain('merchantCode=STORE');
    expect(b.reqs[1].url).toContain('merchantCode=STORE');
  });
});

describe('목록 · 구간 나누기', () => {
  it('목록 행(kind list, 주문번호 있음)이 먼저 take 로 나가고 줄별 「가져오는 중」이 알려진다', () => {
    const flow = mk();
    const b = toReceipts(flow, ROWS);
    const rows = flow.take();
    expect(rows.map((o) => [o.orderNo, o.kind])).toEqual([[ordNo(2), 'list'], [ordNo(1), 'list'], [ordNo(3), 'list']]);
    expect(rows[0]).toMatchObject({ orderedAt: '2026-10-25 12:00:00', amount: 20000, title: '가짜상품2', seller: '가짜브랜드2', listKey: '2026-10-25 12:00|20000' });
    expect(flow.takeOutcomes?.().filter((e) => e.outcome.state === 'fetching').map((e) => e.key)).toEqual(b.reqs.map((q) => q.key));
  });

  it('응답 meta 의 onlineOffset · offlineOffset 을 다음 요청에 그대로 붙인다', () => {
    const flow = mk();
    const f = toList(flow);
    const full = Array.from({ length: 15 }, (_, i) => row(i + 1, `2026-10-${String(20 - (i % 10)).padStart(2, '0')} 10:00:00`));
    const data = { meta: { result: 'SUCCESS', onlineOffset: '123456789', offlineOffset: '987654321' }, data: { orderList: full } };
    const out = asFetch(pass(flow, flow.next({ type: 'fetched', results: [{ key: 'list', st: 'ok', data }] })));
    expect(out.reqs).toHaveLength(1);
    expect(out.reqs[0].url).toContain('onlineOffset=123456789&offlineOffset=987654321');
    // 2026-07-31 ~ 2026-10-29(90일 차이) → 가운데 2026-09-14: 최신 쪽 [09-15, 10-29] 먼저, 오래된 쪽 [07-31, 09-14]
  });

  it('옵션 상태(orderOptionList) — 전부 반품이면 취소 주문, 일부만 반품이면 반품 옵션을 뺀 금액 · 일부 반품 표시(대표님 11-02)', () => {
    const base = { ord_no: '202606211833200003', ord_dt: '2026.06.21 18:34:06', payAmt: '296,070', payMethod: '카드' };
    const ok = { orderState: 50, claimState: 0, orderStateText: '구매 확정', payAmt: '258,390' };
    const back = { orderState: 40, claimState: 61, orderStateText: '반품 완료', payAmt: '37,680' };
    expect(parseOrderRow({ ...base, orderOptionList: [back] })).toMatchObject({ cancelled: true });
    const mixed = parseOrderRow({ ...base, orderOptionList: [back, ok] });
    expect(mixed).toMatchObject({ cancelled: false, mixed: true, amount: 258390 });
    expect(parseOrderRow({ ...base, orderOptionList: [ok] })).toMatchObject({ cancelled: false, amount: 296070 });
  });

  it('이름으로 찾기 — 다른 키 이름(ord_no · ord_dt · payAmt · 안쪽 paymentInfo)도 읽고, 주문번호 없는 배열은 주문으로 보지 않는다', () => {
    const odd = { ord_no: '202610201000009999', ord_dt: '2026.10.20 10:04:43', payAmt: '45,900', productName: '가짜', paymentInfo: { paymentKey: PK(9), tid: TID(9), merchantCode: 'STORE' }, payMethod: '카드' };
    expect(parseOrderRow(odd)).toMatchObject({ orderNo: '202610201000009999', orderedAt: '2026-10-20 10:04:43', amount: 45900, title: '가짜', cancelled: false });
    expect(parseOrderRow(odd)?.pay).toEqual({ paymentKey: PK(9), tid: TID(9), merchantCode: 'STORE' });
    const nested = { result: { groups: [{ date: '2026-10-20', orders: [odd] }] }, noise: [{ a: 1 }, { b: 2 }] };
    expect(findOrderRows(nested)).toHaveLength(1);
    expect(findOrderRows({ items: [{ foo: 1 }, { bar: 'x' }] })).toEqual([]);
    expect(parseOrderRow({ orderNo: '202610201000009999' })).toBeNull();
    expect(findKey({ a: { tid: 'x' } }, [/^tid$/i], () => true, 0)).toBeUndefined();
  });

  it('가장 얕은 주문 배열을 쓴다 — 주문 안의 상품 배열에 같은 주문번호가 있어도 주문이 중복되지 않는다', () => {
    const o = row(1, '2026-10-20 10:04:43', { orderOptionList: [{ orderNo: ordNo(1), optionName: '가짜 옵션' }, { orderNo: ordNo(1), optionName: '가짜 옵션2' }] });
    expect(findOrderRows({ data: { orderList: [o, row(2, '2026-10-21 10:04:43')] } })).toHaveLength(2);
  });
});

describe('구조 기록 — 값 없이 키 구조만, 같은 모양은 한 번', () => {
  it('목록 응답의 키 구조를 한 번만 낸다(구간 다섯 개를 받아도) — 값(상품명 · 결제 키)은 한 글자도 없다', () => {
    const flow = mk();
    const seen: Struct[] = [];
    const f = toList(flow);
    pass(flow, flow.next({ type: 'fetched', results: listResults(f, { 0: ROWS, 2: [row(7, '2026-02-01 10:00:00')] }) }), seen);
    expect(seen.map((s) => s.where)).toEqual(['mus-list']);
    expect(seen[0]).toMatchObject({ host: 'api.musinsa.com', path: '/api2/claim/store/mypage/integration/order' });
    expect(seen[0].lines).toContain('data.orderList : array3');
    expect(seen[0].lines).toContain('data.orderList[0].paymentAmount : number');
    expect(seen[0].lines).toContain('data.orderList[0].payment.paymentKey : string');
    const raw = JSON.stringify(seen);
    for (const secret of ['가짜상품', '가짜브랜드', PK(1), TID(1), ordNo(1), '2026-10-20']) expect(raw).not.toContain(secret);
  });

  it('매출전표 구조도 첫 응답에서 한 번 — JSON 이면 키 구조, HTML 글자면 읽은 칸의 있음 · 없음만', () => {
    const flow = mk();
    const b = toReceipts(flow, ROWS);
    const seen: Struct[] = [];
    pass(flow, flow.next({ type: 'fetched', results: [OKJ(b.reqs[0].key), OKT(b.reqs[1].key), OKT(b.reqs[2].key)] }), seen);
    expect(seen.map((s) => s.where)).toEqual(['mus-rcpt']);
    expect(seen[0]).toMatchObject({ host: 'pay.musinsapayments.com', path: '/mps/receipt/#' });
    expect(seen[0].lines).toContain('approvalNo : string');
    expect(JSON.stringify(seen)).not.toContain('12345678');
    const flow2 = mk();
    const b2 = toReceipts(flow2, ROWS);
    const seen2: Struct[] = [];
    pass(flow2, flow2.next({ type: 'fetched', results: [OKT(b2.reqs[0].key), OKT(b2.reqs[1].key), OKT(b2.reqs[2].key)] }), seen2);
    expect(seen2[0].lines).toContain('has.approvalWord : boolean');
    expect(JSON.stringify(seen2)).not.toContain('123-45-67890');
  });
});

describe('매출전표 결과 · 줄별 결과', () => {
  it('JSON 매출전표(이름으로)와 HTML 글자 매출전표(extractSlip)가 같은 완성 주문(목록 행과 같은 listKey)이 된다', () => {
    const flow = mk();
    const b = toReceipts(flow, ROWS);
    flow.take(); flow.takeOutcomes?.();
    const out = finishOut(flow, flow.next({ type: 'fetched', results: [OKJ(b.reqs[0].key), OKT(b.reqs[1].key), { key: b.reqs[2].key, st: 'http', status: 404 }] }));
    expect(out).toMatchObject({ type: 'done', reason: 'all-rows' });
    const done = (out as Extract<FlowOut, { type: 'done' }>).orders;
    expect(done.map((o) => o.orderNo)).toEqual([ordNo(2), ordNo(1)]);
    expect(done[0]).toMatchObject({ kind: 'card', approval: '12345678', businessNumber: '123-45-67890', cardIssuer: '삼성카드', orderedAt: '2026-10-20 10:04:43', amount: 45900, seller: '가짜브랜드2', listKey: '2026-10-25 12:00|20000' });
    expect(done[1]).toMatchObject({ kind: 'card', approval: '12345678', orderedAt: '2026-10-20 10:04:43' });
    expect(flow.takeOutcomes?.().map((e) => e.outcome.state)).toEqual(['done', 'done', 'none']);
  });

  it('요청 없이 정해지는 줄 — 취소 · 반품은 영수증 없음, 카드 아닌 결제(무신사머니)는 영수증 없음, 결제 값도 수단도 모르면 영수증 주소를 못 찾음', () => {
    const flow = mk();
    const rows = [
      row(1, '2026-10-20 10:04:43'),
      row(2, '2026-10-21 10:04:43', { orderStatus: '취소완료' }),
      row(3, '2026-10-22 10:04:43', { payment: undefined, payMethod: '무신사머니' }),
      row(4, '2026-10-23 10:04:43', { payment: undefined, payMethod: undefined }),
    ];
    const b = toReceipts(flow, rows);
    expect(b.reqs.map((q) => q.key)).toEqual([keyOf(1, '2026-10-20 10:04:43')]);
    const oc = flow.takeOutcomes?.() ?? [];
    expect(oc.find((e) => e.key === keyOf(2, '2026-10-21 10:04:43'))?.outcome).toEqual({ state: 'none', why: 'cancelled' });
    expect(oc.find((e) => e.key === keyOf(3, '2026-10-22 10:04:43'))?.outcome).toEqual({ state: 'none' });
    expect(oc.find((e) => e.key === keyOf(4, '2026-10-23 10:04:43'))?.outcome).toEqual({ state: 'failed', code: 'no-pair' });
  });

  it('매출전표 응답이 404 · 410 이면 영수증 없음, 400 대는 주소 문제, 응답이 영수증이 아니면 읽지 못함 — 현금영수증 글자만 있으면 영수증 없음', () => {
    const flow = mk();
    const b = toReceipts(flow, [row(1, '2026-10-20 10:04:43'), row(2, '2026-10-21 10:04:43'), row(3, '2026-10-22 10:04:43'), row(4, '2026-10-23 10:04:43')]);
    flow.takeOutcomes?.();
    const keys = b.reqs.map((q) => q.key);   // 최신순: 4 3 2 1
    flow.next({ type: 'fetched', results: [
      { key: keys[0], st: 'http', status: 404 }, { key: keys[1], st: 'http', status: 400 },
      OKT(keys[2], '현금영수증 거래내역'), OKT(keys[3], '아무 글자'),
    ] });
    const oc = flow.takeOutcomes?.() ?? [];
    expect(oc.map((e) => e.outcome)).toEqual([{ state: 'none' }, { state: 'failed', code: 'no-pair' }, { state: 'none' }, { state: 'failed', code: 'unreadable' }]);
  });

  it('slipFromJson · slipOf — 이름으로 읽고, 네 칸 중 셋 미만이면 영수증이 아니다', () => {
    expect(slipFromJson(JSON_SLIP)).toMatchObject({ approval: '12345678', businessNumber: '123-45-67890', paidAt: '2026-10-20 10:04:43', amount: 45900, cardIssuer: '삼성카드' });
    expect(slipFromJson({ approvalNo: '12345678', approvalAmount: 1000 })).toBeNull();
    expect(slipOf({ key: 'k', st: 'ok', text: JSON.stringify(JSON_SLIP) })?.approval).toBe('12345678');
    expect(slipOf({ key: 'k', st: 'ok', text: TEXT_SLIP })).toMatchObject({ approval: '12345678', amount: 45900 });
    expect(slipOf({ key: 'k', st: 'ok', text: '안내' })).toBeNull();
  });
});

describe('cleanMerchant — 접힌 한 줄 글자에서 상호만', () => {
  it('다음 칸 이름 앞에서 자르고, 남는 글자가 없으면 없음', () => {
    expect(cleanMerchant('가짜상점 사업자등록번호 123-45-67890 카드사 삼성카드 승인번호 87654321')).toBe('가짜상점');
    expect(cleanMerchant('가짜 상점 대표자 홍길동')).toBe('가짜 상점');
    expect(cleanMerchant('가짜상점')).toBe('가짜상점');
    expect(cleanMerchant(' 사업자등록번호 123-45-67890')).toBeUndefined();
    expect(cleanMerchant(undefined)).toBeUndefined();
  });
});

describe('이미 가져온 것 · 한 건 다시', () => {
  it('서버에 영수증까지 있는 주문(뒤 4자리 + 날짜)은 건너뛰고 나머지만 받으며, 목록 행도 그것만 올린다', () => {
    const flow = mk();
    const b = toReceipts(flow, ROWS, { tails: [tailOf(ordNo(2), '2026-10-25 12:00:00')] });
    expect(b.reqs.map((q) => q.key)).toEqual([keyOf(1, '2026-10-20 10:04:43'), keyOf(3, '2026-09-05 09:30:00')]);
    expect(flow.take().map((o) => o.orderNo)).toEqual([ordNo(1), ordNo(3)]);
  });

  it('주문번호 · 목록 키로 아는 것도 건너뛰고, 가져올 게 없으면 매출전표를 부르지 않고 끝낸다', () => {
    const flow = mk();
    const b = toReceipts(flow, ROWS, { orderNos: [ordNo(1)], listKeys: ['2026-09-05 09:30|30000'] });
    expect(b.reqs.map((q) => q.key)).toEqual([keyOf(2, '2026-10-25 12:00:00')]);
    const flow2 = mk();
    const f = toList(flow2, { orderNos: [ordNo(1), ordNo(2), ordNo(3)] });
    expect(finishOut(flow2, pass(flow2, flow2.next({ type: 'fetched', results: listResults(f, { 0: ROWS }) })))).toMatchObject({ type: 'done', reason: 'all-rows' });
  });

  it('onlyKeys 면 그 줄만 받고 목록 행은 다시 올리지 않으며, 목록에 없는 줄은 까닭을 남긴다', () => {
    const k1 = keyOf(1, '2026-10-20 10:04:43');
    const missing = outcomeKey('202610201000009999', '2026-10-01 00:00', 7);
    const flow = mk({ onlyKeys: [k1, missing] });
    const b = toReceipts(flow, ROWS);
    expect(b.reqs.map((q) => q.key)).toEqual([k1]);
    expect(flow.take()).toEqual([]);
    expect(flow.takeOutcomes?.()).toEqual([{ key: missing, outcome: { state: 'failed', code: 'no-pair' } }, { key: k1, outcome: { state: 'fetching' } }]);
  });
});

describe('로그인 · 막힘 · 시간 초과 · 끝난 까닭', () => {
  it('출처 페이지가 로그인 화면이면 로그인을 부탁하고, 로그인 뒤 다시 읽으면 목록부터 이어 간다', () => {
    const flow = mk();
    flow.next({ type: 'start' });
    expect(flow.next({ type: 'page', url: 'www.musinsa.com/auth/login', text: '로그인 아이디 비밀번호' })).toEqual({ type: 'login' });
    expect(flow.next({ type: 'page', url: 'www.musinsa.com/order/order-list', text: '주문내역 45,900원' })).toMatchObject({ kind: 'fetch' });
  });

  it('목록 요청에서 로그인이 풀리면 로그인을 부탁하고, 풀린 뒤 같은 구간부터 다시 받는다', () => {
    const flow = mk();
    const f = toList(flow);
    expect(flow.next({ type: 'fetched', results: f.reqs.map((q) => ({ key: q.key, st: 'login' as const })) })).toEqual({ type: 'login' });
    const again = asFetch(flow.next({ type: 'page', url: 'www.musinsa.com/order/order-list', text: '주문내역 1,000원' }));
    expect(again.reqs.map((q) => q.key)).toEqual(f.reqs.map((q) => q.key));
  });

  it('매출전표에서 로그인이 풀리면 로그인을 부탁하고, 풀린 뒤 같은 묶음부터 다시 보낸다(목록은 다시 받지 않는다)', () => {
    const flow = mk();
    const b = toReceipts(flow, ROWS);
    expect(flow.next({ type: 'fetched', results: b.reqs.map((q) => ({ key: q.key, st: 'login' as const })) })).toEqual({ type: 'login' });
    const again = asFetch(flow.next({ type: 'page', url: 'www.musinsa.com/order/order-list', text: '주문내역 1,000원' }));
    expect(again.reqs.map((q) => q.key)).toEqual(b.reqs.map((q) => q.key));
    expect(again.reqs[0].url).toContain('/mps/receipt/');
  });

  it('막히면(403 · 429) 한 번에 2건 · 하나씩 · 요청 사이를 늘려 이어 가고, 연달아 세 번 막히면 끝낸다', () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(i + 1, `2026-10-${String(10 + i).padStart(2, '0')} 10:00:00`));
    const flow = mk();
    const b1 = toReceipts(flow, rows);
    expect(b1.reqs).toHaveLength(FETCH_BATCH);
    flow.takeOutcomes?.();
    const blocked = (f: Fetch): FetchResult[] => f.reqs.map((q) => ({ key: q.key, st: 'blocked' as const }));
    const b2 = asFetch(pass(flow, flow.next({ type: 'fetched', results: blocked(b1) })));
    expect(b2).toMatchObject({ conc: 1, staggerMs: 0, gapMs: 1200 });
    expect(b2.reqs).toHaveLength(2);
    const b3 = asFetch(pass(flow, flow.next({ type: 'fetched', results: blocked(b2) })));
    const end = finishOut(flow, flow.next({ type: 'fetched', results: blocked(b3) }));
    expect(end).toMatchObject({ type: 'done', reason: 'blocked' });
    const failed = (flow.takeOutcomes?.() ?? []).filter((e) => e.outcome.state === 'failed');
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((e) => e.outcome.state === 'failed' && e.outcome.code === 'blocked')).toBe(true);
  });

  it('매출전표 요청이 연달아 모두 net(교차 출처 거절)이면 요청을 되풀이하지 않고 숨은 웹뷰가 매출전표 주소를 직접 연다 — 화면 글자로 영수증 완성(대표님 11-02 「어떤 방식이든」)', () => {
    const flow = mk();
    const b1 = toReceipts(flow, ROWS);
    flow.takeOutcomes?.();
    const allNet = (f: Fetch): FetchResult[] => f.reqs.map((q) => ({ key: q.key, st: 'net' as const }));
    const b2 = asFetch(pass(flow, flow.next({ type: 'fetched', results: allNet(b1) })));
    expect(b2.reqs.map((q) => q.key).sort()).toEqual(b1.reqs.map((q) => q.key).sort());
    const g = pass(flow, flow.next({ type: 'fetched', results: allNet(b2) }));
    expect(g).toEqual({ type: 'goto', url: `https://pay.musinsapayments.com/mps/receipt/${ordNo(2)}?paymentKey=${PK(2)}&merchantCode=STORE&tid=${TID(2)}` });
    // 웹뷰가 연 화면의 글자(태그를 걷은 본문)로 매출전표를 읽는다
    const page = { type: 'page' as const, url: 'pay.musinsapayments.com/mps/receipt/#', text: TEXT_SLIP };
    pass(flow, flow.next(page));
    pass(flow, flow.next(page));
    const end = finishOut(flow, pass(flow, flow.next(page)));
    expect(end).toMatchObject({ type: 'done', reason: 'all-rows' });
    const cards = (end as Extract<FlowOut, { type: 'done' }>).orders.filter((o) => o.kind === 'card');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({ approval: '12345678', businessNumber: '123-45-67890' });
    expect(cards[0].detail).toMatchObject({ approvalNo: '12345678', sellerBusinessNo: '123-45-67890', approvalAmount: 45900 });
  });

  it('웹뷰 직접 열기도 빈 화면이 연달아 나오면(매출전표 호스트가 막음) cross-origin 으로 끝내고 줄마다 까닭을 남긴다', () => {
    const flow = mk();
    const b1 = toReceipts(flow, ROWS);
    flow.takeOutcomes?.();
    const allNet = (f: Fetch): FetchResult[] => f.reqs.map((q) => ({ key: q.key, st: 'net' as const }));
    pass(flow, flow.next({ type: 'fetched', results: allNet(b1) }));
    expect(pass(flow, flow.next({ type: 'fetched', results: allNet(b1) }))).toMatchObject({ type: 'goto' });
    const blank = { type: 'page' as const, url: 'pay.musinsapayments.com/mps/receipt/#', text: '' };
    flow.next(blank);
    flow.next(blank);
    expect(finishOut(flow, pass(flow, flow.next(blank)))).toMatchObject({ type: 'done', reason: 'cross-origin' });
    expect((flow.takeOutcomes?.() ?? []).filter((e) => e.outcome.state === 'failed').map((e) => (e.outcome as { code: string }).code)).toEqual(['network', 'network', 'network']);
  });

  it('시간 초과면 그 묶음을 한 번 더 보내고, 두 번째에도 안 오면 줄마다 「인터넷이 불안정」으로 남긴다', () => {
    const flow = mk();
    const b1 = toReceipts(flow, ROWS);
    flow.takeOutcomes?.();
    const b2 = asFetch(flow.next({ type: 'timeout' }));
    expect(b2.reqs.map((q) => q.key).sort()).toEqual(b1.reqs.map((q) => q.key).sort());
    expect(finishOut(flow, flow.next({ type: 'timeout' }))).toMatchObject({ type: 'done', reason: 'all-rows' });
    expect((flow.takeOutcomes?.() ?? []).filter((e) => e.outcome.state === 'failed').map((e) => (e.outcome as { code: string }).code)).toEqual(['network', 'network', 'network']);
  });

  it('목록을 세 번 못 받으면 list-failed(화면 방식으로 되돌아가지 않는다)', () => {
    const flow = mk();
    const f1 = toList(flow);
    const net = (f: Fetch): FetchResult[] => f.reqs.map((q) => ({ key: q.key, st: 'net' as const }));
    const f2 = asFetch(flow.next({ type: 'fetched', results: net(f1) }));
    expect(finishOut(flow, flow.next({ type: 'fetched', results: net(f2) }))).toMatchObject({ type: 'done', reason: 'list-failed' });
  });

  it('목록은 왔는데 주문으로 읽은 게 없으면 list-shape, 정말 빈 목록이면 all-rows', () => {
    const flow = mk();
    const f = toList(flow);
    expect(finishOut(flow, flow.next({ type: 'fetched', results: f.reqs.map((q) => ({ key: q.key, st: 'ok' as const, data: { items: [{ foo: 1 }, { bar: 'x' }] } })) }))).toMatchObject({ type: 'done', reason: 'list-shape' });
    const flow2 = mk();
    const f2 = toList(flow2);
    expect(finishOut(flow2, flow2.next({ type: 'fetched', results: listResults(f2, {}) }))).toMatchObject({ type: 'done', reason: 'all-rows' });
    const flow3 = mk();   // 주문번호는 있는데 금액 · 일시를 못 찾음 → 읽은 게 없다
    const f3 = toList(flow3);
    expect(finishOut(flow3, pass(flow3, flow3.next({ type: 'fetched', results: listResults(f3, { 0: [{ orderNo: ordNo(1) }] }) })))).toMatchObject({ type: 'done', reason: 'list-shape' });
  });

  it('알 수 없는 이벤트면 끝낸다', () => {
    const flow = mk();
    flow.next({ type: 'start' });
    expect(finishOut(flow, flow.next({ type: 'tokens', tokens: [], hasMore: false }))).toMatchObject({ type: 'done', reason: 'unexpected-event' });
  });
});

describe('클릭 · 화면 열기 없음', () => {
  it('흐름이 낸 모든 동작은 fetch 와 출처 페이지 한 번의 goto · login · probe · structure · done 뿐이다', () => {
    const outs: FlowOut[] = [];
    const flow = mk();
    const feed = (o: FlowOut): FlowOut => { outs.push(o); return o; };
    feed(flow.next({ type: 'start' }));
    let out = feed(flow.next({ type: 'page', url: 'www.musinsa.com/order/order-list', text: '주문내역 45,900원' }));
    const rows = Array.from({ length: 10 }, (_, i) => row(i + 1, `2026-10-${String(10 + i).padStart(2, '0')} 10:00:00`));
    let first = true;
    for (let i = 0; i < 12; i++) {
      while ('type' in out && out.type === 'structure') out = feed(flow.next({ type: 'resume' }));
      if (!('kind' in out) || out.kind !== 'fetch') break;
      const f: Fetch = out;
      const results: FetchResult[] = f.reqs[0].url.startsWith('https://api.musinsa.com')
        ? listResults(f, first ? { 0: rows } : {})
        : f.reqs.map((q, n) => (n % 2 === 0 ? OKJ(q.key) : { key: q.key, st: 'http' as const, status: 404 }));
      first = false;
      out = feed(flow.next({ type: 'fetched', results }));
    }
    while ('type' in out && (out.type === 'probe' || out.type === 'structure')) out = feed(flow.next({ type: 'resume' }));
    expect(out).toMatchObject({ type: 'done' });
    for (const o of outs) {
      if ('kind' in o) expect(o.kind).toBe('fetch');
      else if (o.type === 'goto') expect(o.url).toBe(MUSINSA_ORDER_LIST_URL);
      else expect(['login', 'probe', 'structure', 'done']).toContain(o.type);
    }
    expect(outs.filter((o) => 'type' in o && o.type === 'goto')).toHaveLength(1);
  });
});

describe('무신사페이 매출전표 HTML (대표님 11-02 원문 모양)', () => {
  it('정의 · 설명 짝에서 승인번호 · 승인 일시(주석 줄 무시) · 합계 · 카드종류를 읽는다', async () => {
    const { slipFromMusinsaText } = await import('./musinsaApiFlow');
    const html = `<ul class="receipt-detail"><li class="receipt-detail__wrap"><span class="receipt-detail__definition">주문번호 </span><span class="receipt-detail__description">202601010000000001</span></li></ul>
      <ul class="receipt-detail"><li class="receipt-detail__wrap"><span class="receipt-detail__definition">카드종류 </span><span class="receipt-detail__description">가짜카드</span></li>
      <li class="receipt-detail__wrap"><span class="receipt-detail__definition">승인번호 </span><span class="receipt-detail__description">12345678</span></li>
      <!-- <li class="receipt-detail__wrap"><span class="receipt-detail__definition">결제일시 </span><span class="receipt-detail__description">2023.04.08 22:42:17</span></li> --></ul>
      <ul class="receipt-detail"><div><li class="receipt-detail__wrap"><span class="receipt-detail__definition">승인 <span class="receipt-detail__definition__date">2026-01-01 10:20:30</span></span><span class="receipt-detail__description">10,000원</span></li></div></ul>
      <ul class="receipt-detail"><li class="receipt-detail__wrap receipt-detail__wrap--total"><span class="receipt-detail__definition">합계 </span><span class="receipt-detail__description">10,000원</span></li></ul>`;
    expect(slipFromMusinsaText(html)).toEqual({ approval: '12345678', paidAt: '2026-01-01 10:20:30', amount: 10000, cardIssuer: '가짜카드' });
    expect(slipFromMusinsaText('<div>영수증을 찾을 수 없습니다</div>')).toBeNull();
  });
});
