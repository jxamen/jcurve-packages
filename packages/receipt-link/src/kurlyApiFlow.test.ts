/**
 * 컬리 요청 흐름(kurlyApiFlow) 시험 — 이벤트를 하나씩 먹이며 낸 동작 · 결과를 확인한다(값은 모두 가짜, 영수증 응답 키 이름만 대표님 10-28 23:50:20 원문 그대로).
 * 핵심: 클릭 · 화면 열기 없음(fetch · read 와 출처 페이지 goto 한 번), 목록 → 상세 → 영수증 두 번에 나눔, 네이버페이는 영수증 없음, 줄별 결과, 구조 기록(값 없음).
 */
import { describe, expect, it } from 'vitest';
import type { FlowOut } from './naverReceipt';
import {
  createKurlyApiFlow, findDefaultAddress, KURLY_ADDRESS_URL, KURLY_RECEIPT_URL, kurlyReceiptData, findOrderRows, hasFilledArray, KURLY_LIST_URL, KURLY_ORDERS_URL, kurlyDetailUrl, kurlyReceiptUrl, kurlyRowToOrder, kurlySlip, readKurlyDetail,
} from './kurlyApiFlow';
import { tailOf, type ApiFlowOptions } from './naverApiFlow';
import { outcomeKey } from './runOutcome';
import type { FetchReq, FetchResult } from './siteFetch';

const NOW = Date.parse('2026-10-29T09:00:00+09:00');
const mk = (o: ApiFlowOptions = {}) => createKurlyApiFlow({ now: () => NOW, ...o });

const no = (n: number): string => `2026102${String(n).padStart(6, '0')}`;
/** 목록 줄(응답 모양은 원문에 없어 흔한 이름으로 만든 가짜) */
const row = (n: number, at: string, price: number, extra: Record<string, unknown> = {}) => ({ orderNo: no(n), orderDateTime: at, paymentPrice: price, productName: `상품${n}`, ...extra });
const listResp = (rows: unknown[]) => ({ data: { orders: rows, totalCount: rows.length } });
const ROWS = [row(1, '2026-10-20T10:04:43', 12300), row(2, '2026-10-25T12:00:00', 5000), row(3, '2025-01-01T09:00:00', 700)];   // 3번은 1년 밖
const kk = (n: number, at: string, amount: number): string => outcomeKey(no(n), at, amount);
const K1 = kk(1, '2026-10-20 10:04:43', 12300);
const K2 = kk(2, '2026-10-25 12:00:00', 5000);

const ENC = 'AbCdEf1234567890+/==';
const detailResp = (extra: Record<string, unknown> = {}) => ({ data: { order: { paymentMethod: '신용카드', receipt: { encreq: ENC } }, ...extra } });
/** 영수증 응답 — 키는 대표님 23:50:20 원문 그대로, 값은 가짜 */
const RECEIPT = {
  CARD_NO: '1234********5678', REP_NM2: '가나다', CPX_FLG: 'N', TEL_NO: '1588', PM_NM: '신용카드', GOODS_VAT: '1118', QUOTA_MON: '00', ORD_NO: 'X1', APP_TM: '100443', ORD_NM: '가짜', GOODS_SVS_AMT: '0',
  CHKCARD_FLG: 'N', ADDR2: '가짜 주소2', RCPT_PRT_TYPE: '1', TRX_ST_CD: '1', GOODS_AMT: '12300', PAY_NO: 'P1', CO_NM2: '가짜결제사', GOODS_NM: '가짜 영수증 상품', CARD_NM: '삼성카드', REP_NM: '홍길',
  CC_DT: '', CO_NO: '1234567890', CO_NO2: '0987654321', CO_NM: '가짜상점', CC_TM: '', PM_CD: '10', TEL_NO2: '1599', CARD_APP_NO: '12345678', TID: 'T1', GOODS_SPL_AMT: '11182', ADDR: '가짜 주소',
  STATE_NM: '승인', APP_DT: '20261020', MBS_USR_ID: 'u', TR_DT: '20261020', CREATED_DTTM: '2026-10-20 10:04:44', PAYMENT_ID: 'PID1',
};
const receiptResp = (over: Record<string, unknown> = {}) => ({ ...RECEIPT, ...over });

const ok = (key: string, data: unknown): FetchResult => ({ key, st: 'ok', data });
const st = (key: string, s: FetchResult['st'], status?: number): FetchResult => ({ key, st: s, ...(status ? { status } : {}) });

type Fetch = Extract<FlowOut, { kind: 'fetch' }>;
const asFetch = (out: FlowOut): Fetch => {
  if (!('kind' in out) || out.kind !== 'fetch') throw new Error(`fetch 동작이 아님: ${JSON.stringify(out).slice(0, 160)}`);
  return out;
};
type Structure = Extract<FlowOut, { type: 'structure' }>;

/** structure · probe 를 받아 두고 resume 을 먹여 다음 동작까지 간다 */
function settle(flow: ReturnType<typeof mk>, first: FlowOut, structs: Structure[] = []): FlowOut {
  let out = first;
  for (let i = 0; i < 20 && 'type' in out && (out.type === 'structure' || out.type === 'probe'); i++) {
    if (out.type === 'structure') structs.push(out);
    out = flow.next({ type: 'resume' });
  }
  return out;
}
/** 영수증 화면 글자 — 실제 앱 읽기 스크립트처럼 화면 글자 + 스크립트의 var data 배열을 함께 보낸다 */
const RECEIPT_PAGE_URL = 'pg.kurlypay.co.kr/api/payments/receipt/request/card';
const receiptText = (r: Record<string, unknown>): string => `영수증
매출전표
var data = ${JSON.stringify([r])};`;
type Goto = Extract<FlowOut, { type: 'goto' }>;
const asGoto = (out: FlowOut): Goto => {
  if (!('type' in out) || out.type !== 'goto') throw new Error(`goto 동작이 아님: ${JSON.stringify(out).slice(0, 160)}`);
  return out;
};
/** 영수증 goto 마다 화면 글자를 먹여, 영수증이 아닌 다음 동작(출처 페이지 goto · fetch · done)까지 간다 */
function readReceipts(flow: ReturnType<typeof mk>, first: FlowOut, make: (url: string, i: number) => string, structs: Structure[] = []): FlowOut {
  let out = first;
  for (let i = 0; i < 40 && 'type' in out && out.type === 'goto' && out.url.startsWith(KURLY_RECEIPT_URL); i++) {
    out = settle(flow, flow.next({ type: 'page', url: RECEIPT_PAGE_URL, text: make(out.url, i) }), structs);
  }
  return out;
}
const bodyOf = (q: FetchReq): Record<string, unknown> => JSON.parse(q.body ?? '{}') as Record<string, unknown>;

/** start → 출처 페이지 → 목록 요청까지 */
function toList(flow: ReturnType<typeof mk>, known?: { orderNos?: string[]; listKeys?: string[]; tails?: string[] }, structs: Structure[] = []): Fetch {
  expect(flow.next({ type: 'start', known })).toEqual({ type: 'goto', url: KURLY_LIST_URL });
  const addr = asFetch(flow.next({ type: 'page', url: 'www.kurly.com/mypage/order', text: '주문 내역' }));
  expect(addr.reqs[0].key).toBe('addr');
  return asFetch(settle(flow, flow.next({ type: 'fetched', results: [ok('addr', { address: '가짜시 가짜구', address_sub: '' })] }), structs));
}
/** 목록 응답 → 상세 요청 묶음까지(구조 기록 통과) */
function toDetail(flow: ReturnType<typeof mk>, rows: unknown[] = ROWS, known?: { orderNos?: string[]; listKeys?: string[]; tails?: string[] }, structs: Structure[] = []): Fetch {
  const list = toList(flow, known, structs);
  return asFetch(settle(flow, flow.next({ type: 'fetched', results: [ok(list.reqs[0].key, listResp(rows))] }), structs));
}

describe('요청 모양 (대표님 23:46 · 23:47 · 23:50 원문)', () => {
  it('로그아웃된 주문 화면(주소는 그대로 · 짧은 로그인 안내)이면 배송지 요청 없이 로그인 화면을 보인다(11-02)', () => {
    const flow = mk();
    flow.next({ type: 'start' });
    expect(flow.next({ type: 'page', url: 'www.kurly.com/mypage/order', text: '로그인이 필요합니다 로그인 회원가입' })).toEqual({ type: 'login' });
  });

  it('출처 페이지를 한 번 열고, 목록은 POST v4 orders — 본문 키와 빈 배송지, 최근 1년', () => {
    const flow = mk();
    const list = toList(flow);
    expect(list.reqs).toHaveLength(1);
    const q = list.reqs[0];
    expect(q).toMatchObject({ method: 'POST', url: KURLY_ORDERS_URL, as: 'json' });
    expect(bodyOf(q)).toEqual({ startDate: '2025-10-29T00:00:00', endDate: '2026-10-29T23:59:59', page: 1, limit: 10, productName: '', address: '가짜시 가짜구', addressDetail: '' });
  });

  it('windowDays 를 주면 목록 조회 시작일이 그 일수만큼 앞선다(서버 readDays)', () => {
    const list = toList(mk({ windowDays: 1095 }));
    expect(bodyOf(list.reqs[0])).toMatchObject({ startDate: '2023-10-30T00:00:00', endDate: '2026-10-29T23:59:59' });
  });

  it('목록 → 상세는 POST v3 orders/{주문번호}(본문 address · addressDetail) 최신 주문부터, 같은 주문 한 줄, 1년 밖 제외', () => {
    const flow = mk();
    const d = toDetail(flow);
    expect(d.reqs.map((q) => q.url)).toEqual([kurlyDetailUrl(no(2)), kurlyDetailUrl(no(1))]);
    expect(d.reqs.map((q) => q.key)).toEqual([K2, K1]);
    expect(d.reqs.every((q) => q.method === 'POST' && q.as === 'json')).toBe(true);
    expect(bodyOf(d.reqs[0])).toEqual({ address: '가짜시 가짜구', addressDetail: '' });
    expect(flow.take().map((o) => [o.orderNo, o.kind])).toEqual([[no(2), 'list'], [no(1), 'list']]);
  });

  it('상세에서 얻은 encreq 로 영수증 페이지를 연다(goto) — 부호 없는 값은 퍼센트 부호를 붙인다', () => {
    const flow = mk();
    const d = toDetail(flow);
    const g = asGoto(settle(flow, flow.next({ type: 'fetched', results: d.reqs.map((q) => ok(q.key, detailResp())) })));
    expect(g).toEqual({ type: 'goto', url: `https://pg.kurlypay.co.kr/api/payments/receipt/request/card?encreq=${encodeURIComponent(ENC)}` });
    expect(g.url).not.toContain('+');
  });
});

describe('결과', () => {
  it('영수증이 오면 줄별 「가져옴」과 완성 주문(대표님 원문 키 매핑 · 목록 행과 같은 listKey)을 낸다', () => {
    const flow = mk();
    const d = toDetail(flow);
    flow.take(); flow.takeOutcomes?.();
    const g = settle(flow, flow.next({ type: 'fetched', results: d.reqs.map((q) => ok(q.key, detailResp())) }));
    const out = readReceipts(flow, g, () => receiptText(receiptResp()));
    expect(out).toMatchObject({ type: 'done', reason: 'all-rows' });
    expect(flow.takeOutcomes?.().filter((e) => e.outcome.state === 'done').map((e) => e.key).sort()).toEqual([K1, K2].sort());
    const done = (out as Extract<FlowOut, { type: 'done' }>).orders;
    expect(done).toHaveLength(2);
    expect(done[0]).toMatchObject({
      kind: 'card', seller: '가짜상점', title: '가짜 영수증 상품', businessNumber: '1234567890', approval: '12345678', cardIssuer: '삼성카드',
      orderedAt: '2026-10-20 10:04:43', amount: 12300, listKey: '2026-10-25 12:00|5000',
    });
  });

  it('결제수단이 네이버페이면 영수증 요청 없이 「영수증 없음」', () => {
    const flow = mk();
    const d = toDetail(flow);
    flow.takeOutcomes?.();
    const out = settle(flow, flow.next({ type: 'fetched', results: [ok(K2, detailResp({ pay: { method: '네이버페이' } })), ok(K1, { data: { order: { payMethod: 'NAVER_PAY' } } })] }));
    expect(out).toMatchObject({ type: 'done', reason: 'all-rows' });
    expect(flow.takeOutcomes?.().map((e) => e.outcome.state)).toEqual(['none', 'none']);
    expect(d.reqs).toHaveLength(2);
  });

  it('취소된 영수증(CC_DT 가 있거나 STATE_NM 에 취소)은 영수증 없음으로 센다', () => {
    const flow = mk();
    const d = toDetail(flow);
    const g = settle(flow, flow.next({ type: 'fetched', results: d.reqs.map((q) => ok(q.key, detailResp())) }));
    flow.takeOutcomes?.();
    const made = [receiptResp({ CC_DT: '20261021' }), receiptResp({ STATE_NM: '취소' })];
    readReceipts(flow, g, (_u, i) => receiptText(made[i]));
    expect(flow.takeOutcomes?.().map((e) => e.outcome.state)).toEqual(['none', 'none']);
  });

  it('목록에서 취소 상태인 주문은 요청 없이 영수증 없음으로 센다', () => {
    const flow = mk();
    const rows = [row(1, '2026-10-20T10:04:43', 12300), row(2, '2026-10-25T12:00:00', 5000, { orderStatus: '주문취소 완료' })];
    const d = toDetail(flow, rows);
    expect(d.reqs.map((q) => q.key)).toEqual([K1]);
    expect(flow.takeOutcomes?.()).toContainEqual({ key: K2, outcome: { state: 'none', why: 'cancelled' } });
  });

  it('승인번호 · 승인 일시 · 금액이 빠진 영수증은 그 줄만 「읽지 못함」', () => {
    const flow = mk();
    const d = toDetail(flow);
    const g = settle(flow, flow.next({ type: 'fetched', results: d.reqs.map((q) => ok(q.key, detailResp())) }));
    flow.takeOutcomes?.();
    const made = [receiptResp({ GOODS_AMT: '' }), receiptResp()];
    readReceipts(flow, g, (_u, i) => receiptText(made[i]));
    expect(flow.takeOutcomes?.()).toEqual([
      { key: d.reqs[0].key, outcome: { state: 'failed', code: 'unreadable' } },
      { key: d.reqs[1].key, outcome: { state: 'done' } },
    ]);
  });

  it('상세에서 영수증 요청 값을 못 찾으면 그 줄은 「영수증 주소를 못 찾았어요」(no-pair)', () => {
    const flow = mk();
    const d = toDetail(flow);
    flow.takeOutcomes?.();
    settle(flow, flow.next({ type: 'fetched', results: d.reqs.map((q) => ok(q.key, { data: { order: { paymentMethod: '신용카드' } } })) }));
    expect((flow.takeOutcomes?.() ?? []).every((e) => e.outcome.state === 'failed' && e.outcome.code === 'no-pair')).toBe(true);
  });

  it('여섯 건씩 묶는다 — 아홉 건이면 6건 + 3건', () => {
    const rows = Array.from({ length: 9 }, (_, i) => row(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`, 1000 + i));
    const flow = mk();
    const list = toList(flow);
    const first = asFetch(settle(flow, flow.next({ type: 'fetched', results: [ok(list.reqs[0].key, listResp(rows))] })));
    expect(first.reqs).toHaveLength(6);
    expect(first.reqs[0].url).toBe(kurlyDetailUrl(no(9)));
  });
});

describe('목록 쪽 넘김 · 모양', () => {
  it('목록이 열 줄로 꽉 차면 다음 쪽을 부르고, 빈 쪽이 오면 거기서 끝낸다', () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`, 1000 + i));
    const flow = mk();
    const list = toList(flow);
    const p2 = asFetch(settle(flow, flow.next({ type: 'fetched', results: [ok(list.reqs[0].key, listResp(rows))] })));
    expect(bodyOf(p2.reqs[0]).page).toBe(2);
    expect(p2.reqs[0].key).toBe('list-2');
    const d = asFetch(settle(flow, flow.next({ type: 'fetched', results: [ok('list-2', listResp([]))] })));
    expect(d.reqs).toHaveLength(6);
  });

  // 실제 응답 모양 {data:{orders|items, pagination:{hasNext}}} (11-02 실측)
  it('끝 판단은 응답 pagination.hasNext — 열 줄 미만이어도 true 면 다음 쪽, 열 줄이어도 false 면 거기서 끝', () => {
    const few = Array.from({ length: 3 }, (_, i) => row(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`, 1000 + i));
    const f1 = mk();
    const l1 = toList(f1);
    const p2 = asFetch(settle(f1, f1.next({ type: 'fetched', results: [ok(l1.reqs[0].key, { data: { orders: few, pagination: { hasNext: true } } })] })));
    expect(p2.reqs[0].key).toBe('list-2');
    const full = Array.from({ length: 10 }, (_, i) => row(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`, 1000 + i));
    const f2 = mk();
    const l2 = toList(f2);
    const d = asFetch(settle(f2, f2.next({ type: 'fetched', results: [ok(l2.reqs[0].key, { data: { orders: full, pagination: { hasNext: false } } })] })));
    expect(d.reqs[0].url).toContain('/v3/mypage/orders/');
  });

  it('쪽에 1년 밖 주문이 나오면 거기서 쪽 넘김을 멈춘다', () => {
    const rows = [...Array.from({ length: 9 }, (_, i) => row(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`, 1000 + i)), row(20, '2025-03-01T10:00:00', 100)];
    const flow = mk();
    const list = toList(flow);
    const next = asFetch(settle(flow, flow.next({ type: 'fetched', results: [ok(list.reqs[0].key, listResp(rows))] })));
    expect(next.reqs[0].url.startsWith('https://api.kurly.com/order-external/v3/mypage/orders/')).toBe(true);
  });

  it('주문이 정말 없으면 all-rows, 줄은 있는데 주문번호 모양을 못 읽으면 list-shape 로 끝낸다', () => {
    const f1 = mk();
    const l1 = toList(f1);
    expect(settle(f1, f1.next({ type: 'fetched', results: [ok(l1.reqs[0].key, listResp([]))] }))).toMatchObject({ type: 'done', reason: 'all-rows' });
    const f2 = mk();
    const l2 = toList(f2);
    expect(settle(f2, f2.next({ type: 'fetched', results: [ok(l2.reqs[0].key, { data: { orders: [{ id: 'ab', name: '가짜' }] } })] }))).toMatchObject({ type: 'done', reason: 'list-shape' });
  });
});

describe('배송지 (address · addressDetail)', () => {
  const ADDR = { address: '가짜시 가짜구 1', address_sub: '101동 1호' };

  it('출처 페이지를 연 뒤 먼저 기본 배송지 API(GET, json)를 부르고, 그 배송지(address · address_sub)를 목록 본문에 싣는다 — 구조 기록에는 값이 없다', () => {
    const flow = mk();
    expect(flow.next({ type: 'start' })).toEqual({ type: 'goto', url: KURLY_LIST_URL });
    const addr = asFetch(flow.next({ type: 'page', url: 'www.kurly.com/mypage/order', text: '주문 내역' }));
    expect(addr.reqs).toEqual([{ key: 'addr', method: 'GET', url: KURLY_ADDRESS_URL, as: 'json' }]);
    const structs: Structure[] = [];
    const list = asFetch(settle(flow, flow.next({ type: 'fetched', results: [ok('addr', ADDR)] }), structs));
    expect(list.reqs[0]).toMatchObject({ method: 'POST', url: KURLY_ORDERS_URL });
    expect(bodyOf(list.reqs[0])).toMatchObject({ page: 1, address: '가짜시 가짜구 1', addressDetail: '101동 1호' });
    expect(structs.map((x) => x.where)).toEqual(['kurly-addr']);
    expect(structs[0]).toMatchObject({ host: 'api.kurly.com', path: '/addressbook/v1/cart/check-base-address-notification' });
    expect(JSON.stringify(structs[0].lines)).not.toContain('가짜시');
    expect(JSON.stringify(structs[0].lines)).not.toContain('101동');
  });

  it('상세 본문에도 같은 배송지를 싣는다', () => {
    const flow = mk();
    flow.next({ type: 'start' });
    flow.next({ type: 'page', url: 'www.kurly.com/mypage/order', text: '주문 내역' });
    const list = asFetch(settle(flow, flow.next({ type: 'fetched', results: [ok('addr', ADDR)] })));
    const d = asFetch(settle(flow, flow.next({ type: 'fetched', results: [ok(list.reqs[0].key, listResp(ROWS))] })));
    expect(d.reqs.every((q) => JSON.stringify(bodyOf(q)) === JSON.stringify({ address: '가짜시 가짜구 1', addressDetail: '101동 1호' }))).toBe(true);
  });

  it('배송지 API 가 거절되거나 배송지가 없으면 목록을 부르지 않고 list-failed 로 끝낸다', () => {
    const f1 = mk();
    f1.next({ type: 'start' });
    f1.next({ type: 'page', url: 'www.kurly.com/mypage/order', text: '주문 내역' });
    expect(settle(f1, f1.next({ type: 'fetched', results: [st('addr', 'http', 401)] }))).toMatchObject({ type: 'done', reason: 'list-failed' });
    const f2 = mk();
    f2.next({ type: 'start' });
    f2.next({ type: 'page', url: 'www.kurly.com/mypage/order', text: '주문 내역' });
    expect(settle(f2, f2.next({ type: 'fetched', results: [ok('addr', { name: '가짜' })] }))).toMatchObject({ type: 'done', reason: 'list-failed' });
  });

  it('배송지를 실은 목록이 4xx 로 거절되면 배송지를 다시 찾지 않고 곧바로 list-failed 로 끝낸다', () => {
    const flow = mk();
    const list = toList(flow);
    const out = settle(flow, flow.next({ type: 'fetched', results: [st(list.reqs[0].key, 'http', 422)] }));
    expect(out).toMatchObject({ type: 'done', reason: 'list-failed' });
  });

  it('상세가 4xx 로 거절되면 배송지를 다시 찾지 않고 그 줄만 「읽지 못함」', () => {
    const flow = mk();
    const d = toDetail(flow);
    flow.takeOutcomes?.();
    const out = settle(flow, flow.next({ type: 'fetched', results: d.reqs.map((q) => st(q.key, 'http', 400)) }));
    expect(out).toMatchObject({ type: 'done', reason: 'all-rows' });
    const failed = (flow.takeOutcomes?.() ?? []).filter((e) => e.outcome.state === 'failed');
    expect(failed.map((e) => e.key).sort()).toEqual([K1, K2].sort());
    expect(failed.every((e) => e.outcome.state === 'failed' && e.outcome.code === 'unreadable')).toBe(true);
  });
});

describe('이미 가져온 것 건너뛰기 · 한 건 다시', () => {
  it('서버에 영수증까지 있는 주문(뒤 4자리 + 날짜)은 건너뛰고 못 가져온 것만 보낸다', () => {
    const flow = mk();
    const d = toDetail(flow, ROWS, { tails: [tailOf(no(2), '2026-10-25 12:00:00')] });
    expect(d.reqs.map((q) => q.key)).toEqual([K1]);
    expect(flow.take().map((o) => o.orderNo)).toEqual([no(1)]);
  });

  it('가져올 게 하나도 없으면 상세 요청 없이 끝낸다', () => {
    const flow = mk();
    const list = toList(flow, { orderNos: [no(1), no(2)] });
    expect(settle(flow, flow.next({ type: 'fetched', results: [ok(list.reqs[0].key, listResp(ROWS))] }))).toMatchObject({ type: 'done', reason: 'all-rows' });
  });

  it('onlyKeys 면 그 줄만 가져오고 목록 행은 다시 올리지 않는다 — 목록에 없는 줄은 까닭을 남긴다', () => {
    const missing = outcomeKey('2026102000009999', '2026-10-01 00:00', 7);
    const flow = mk({ onlyKeys: [K1, missing] });
    const d = toDetail(flow);
    expect(d.reqs.map((q) => q.key)).toEqual([K1]);
    expect(flow.take()).toEqual([]);
    expect(flow.takeOutcomes?.()).toEqual([{ key: missing, outcome: { state: 'failed', code: 'no-pair' } }, { key: K1, outcome: { state: 'fetching' } }]);
  });
});

describe('로그인 · 막힘 · 시간 초과 · 교차 출처', () => {
  it('출처 페이지가 로그인 화면이면 로그인을 부탁하고, 로그인 뒤 다시 읽으면 목록부터 이어 간다', () => {
    const flow = mk();
    flow.next({ type: 'start' });
    expect(flow.next({ type: 'page', url: 'www.kurly.com/member/login', text: '로그인' })).toEqual({ type: 'login' });
    // 로그인 뒤 다시 읽으면 처음처럼 기본 배송지부터 읽고, 그 배송지로 목록을 부른다
    expect(asFetch(flow.next({ type: 'page', url: 'www.kurly.com/mypage/order', text: '주문 내역' })).reqs[0].key).toBe('addr');
    expect(asFetch(settle(flow, flow.next({ type: 'fetched', results: [ok('addr', { address: '가짜시 가짜구', address_sub: '' })] }))).reqs[0].key).toBe('list-1');
  });

  it('요청 중 로그인이 풀리면 로그인을 부탁하고 풀린 뒤 같은 묶음부터 다시 보낸다(목록은 다시 받지 않는다)', () => {
    const flow = mk();
    const d = toDetail(flow);
    expect(flow.next({ type: 'fetched', results: d.reqs.map((q) => st(q.key, 'login')) })).toEqual({ type: 'login' });
    const again = asFetch(flow.next({ type: 'page', url: 'www.kurly.com/mypage/order', text: '주문 내역' }));
    expect(again.reqs.map((q) => q.key)).toEqual(d.reqs.map((q) => q.key));
    expect(again.reqs[0].url).toContain('/v3/mypage/orders/');
  });

  it('막히면(403 · 429) 한 번에 2건 · 하나씩 · 요청 사이를 늘리고, 연달아 세 번이면 끝낸다', () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`, 1000 + i));
    const flow = mk();
    const b1 = toDetail(flow, rows);
    flow.takeOutcomes?.();
    const b2 = asFetch(flow.next({ type: 'fetched', results: b1.reqs.map((q) => st(q.key, 'blocked', 429)) }));
    expect(b2).toMatchObject({ conc: 1, staggerMs: 0, gapMs: 1200 });
    expect(b2.reqs).toHaveLength(2);
    const b3 = asFetch(flow.next({ type: 'fetched', results: b2.reqs.map((q) => st(q.key, 'blocked', 429)) }));
    const end = settle(flow, flow.next({ type: 'fetched', results: b3.reqs.map((q) => st(q.key, 'blocked', 429)) }));
    expect(end).toMatchObject({ type: 'done', reason: 'blocked' });
    expect((flow.takeOutcomes?.() ?? []).some((e) => e.outcome.state === 'failed' && e.outcome.code === 'blocked')).toBe(true);
  });

  it('시간 초과면 그 묶음을 한 번 더 보내고, 두 번째에도 안 오면 줄마다 「인터넷이 불안정」', () => {
    const flow = mk();
    const d = toDetail(flow);
    flow.takeOutcomes?.();
    const again = asFetch(flow.next({ type: 'timeout' }));
    expect(again.reqs.map((q) => q.key).sort()).toEqual(d.reqs.map((q) => q.key).sort());
    expect(settle(flow, flow.next({ type: 'timeout' }))).toMatchObject({ type: 'done', reason: 'all-rows' });
    expect((flow.takeOutcomes?.() ?? []).filter((e) => e.outcome.state === 'failed').map((e) => (e.outcome as { code: string }).code)).toEqual(['network', 'network']);
  });

  it('목록 요청이 세 번 net 이고 한 번도 성공이 없으면 cross-origin, 다른 오류면 list-failed', () => {
    const f1 = mk();
    const l1 = toList(f1);
    f1.next({ type: 'fetched', results: [st(l1.reqs[0].key, 'net')] });
    f1.next({ type: 'fetched', results: [st('list-1', 'net')] });
    expect(settle(f1, f1.next({ type: 'fetched', results: [st('list-1', 'net')] }))).toMatchObject({ type: 'done', reason: 'cross-origin' });
    const f2 = mk();
    const l2 = toList(f2);
    f2.next({ type: 'fetched', results: [st(l2.reqs[0].key, 'shape')] });
    f2.next({ type: 'fetched', results: [st('list-1', 'shape')] });
    expect(settle(f2, f2.next({ type: 'fetched', results: [st('list-1', 'shape')] }))).toMatchObject({ type: 'done', reason: 'list-failed' });
  });

  it('영수증은 처음부터 페이지 열기 — 주문마다 goto 로 열고 화면 글자의 var data 로 완성한다, 한 묶음이 끝나면 출처 페이지로 돌아가 남은 주문의 상세를 이어 간다(대표님 11-02)', () => {
    const rows = Array.from({ length: 9 }, (_, i) => row(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`, 1000 + i));
    const flow = mk();
    const d1 = toDetail(flow, rows);
    expect(d1.reqs).toHaveLength(6);
    const origin = { type: 'page' as const, url: 'www.kurly.com/mypage/order', text: '주문 내역' };
    const gotos: string[] = [];
    let out = settle(flow, flow.next({ type: 'fetched', results: d1.reqs.map((q) => ok(q.key, detailResp())) }));
    for (let i = 0; i < 60 && !('type' in out && out.type === 'done'); i++) {
      if ('kind' in out && out.kind === 'fetch') {
        expect(out.reqs.every((q) => q.url.includes('/v3/'))).toBe(true);   // 영수증은 요청(fetch)으로 부르지 않는다
        out = settle(flow, flow.next({ type: 'fetched', results: out.reqs.map((q) => ok(q.key, detailResp())) }));
      } else if ('type' in out && out.type === 'goto') {
        gotos.push(out.url);
        out = out.url === KURLY_LIST_URL ? settle(flow, flow.next(origin)) : settle(flow, flow.next({ type: 'page', url: RECEIPT_PAGE_URL, text: receiptText(receiptResp()) }));
      } else throw new Error(`뜻밖의 동작: ${JSON.stringify(out).slice(0, 120)}`);
    }
    expect(out).toMatchObject({ type: 'done', reason: 'all-rows' });
    expect(gotos.filter((g) => g.startsWith(KURLY_RECEIPT_URL))).toHaveLength(9);
    expect(gotos.filter((g) => g === KURLY_LIST_URL)).toHaveLength(1);   // 6건 + 3건 — 묶음 사이에 출처 페이지로 한 번
    const cards = (out as Extract<FlowOut, { type: 'done' }>).orders.filter((o) => o.kind === 'card');
    expect(cards).toHaveLength(9);
    expect(cards[0]).toMatchObject({ approval: '12345678', cardIssuer: '삼성카드', businessNumber: '1234567890' });
    expect(cards[0].detail).toMatchObject({ approvalNo: '12345678', cardCompany: '삼성카드', sellerBusinessNo: '1234567890', approvalAmount: 12300 });
  });

  it('상세 paymentMethod 가 pay_point(네이버페이) 또는 pay_credit_card(컬리페이 카드)면 영수증 페이지를 열지 않고 「영수증 없음」', () => {
    const flow = mk();
    const d = toDetail(flow);
    flow.takeOutcomes?.();
    const out = settle(flow, flow.next({ type: 'fetched', results: [ok(K2, { data: { order: { paymentMethod: 'pay_point' } } }), ok(K1, { data: { order: { paymentMethod: 'pay_credit_card' } } })] }));
    expect(out).toMatchObject({ type: 'done', reason: 'all-rows' });
    expect(flow.takeOutcomes?.().map((e) => e.outcome.state)).toEqual(['none', 'none']);
    expect(d.reqs).toHaveLength(2);
  });

  it('영수증 화면이 빈 화면이 연달아 세 번이면(영수증 호스트가 막음) cross-origin 으로 끝내고 남은 줄에 까닭을 남긴다', () => {
    const rows = Array.from({ length: 4 }, (_, i) => row(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`, 1000 + i));
    const flow = mk();
    flow.takeOutcomes?.();
    const d1 = toDetail(flow, rows);
    expect(asGoto(settle(flow, flow.next({ type: 'fetched', results: d1.reqs.map((q) => ok(q.key, detailResp())) }))).url.startsWith(KURLY_RECEIPT_URL)).toBe(true);
    const blank = { type: 'page' as const, url: RECEIPT_PAGE_URL, text: '' };
    flow.next(blank);
    flow.next(blank);
    expect(settle(flow, flow.next(blank))).toMatchObject({ type: 'done', reason: 'cross-origin' });
    const outs = flow.takeOutcomes?.() ?? [];
    expect(outs.filter((e) => e.outcome.state === 'failed')).toHaveLength(4);
  });
});

describe('구조 기록(값 없음)', () => {
  it('목록 · 상세 · 영수증 응답의 키 구조를 한 번씩만 남기고, 찾아 쓴 칸 이름이 앞에 붙는다', () => {
    const flow = mk();
    const structs: Structure[] = [];
    const d = toDetail(flow, ROWS, undefined, structs);
    const g = settle(flow, flow.next({ type: 'fetched', results: d.reqs.map((q) => ok(q.key, detailResp())) }), structs);
    readReceipts(flow, g, () => receiptText(receiptResp()), structs);
    expect(structs.map((s) => [s.where, s.host, s.path])).toEqual([
      ['kurly-addr', 'api.kurly.com', '/addressbook/v1/cart/check-base-address-notification'],
      ['kurly-list', 'api.kurly.com', '/order-external/v4/mypage/orders'],
      ['kurly-detail', 'api.kurly.com', '/order-external/v3/mypage/orders/#'],
      ['kurly-receipt', 'pg.kurlypay.co.kr', '/api/payments/receipt/request/card'],
    ]);
    expect(structs[0].lines[0]).toBe('use address : found');
    expect(structs[1].lines[0]).toBe('use orderNo : orderNo');
    expect(structs[1].lines).toContain('data.orders : array3');
    expect(structs[3].lines[0]).toBe('use via : navigate');
    for (const s of structs) {
      expect(s.where).toMatch(/^[A-Za-z0-9_-]{1,40}$/);
      expect(s.lines.length).toBeLessThanOrEqual(300);
      for (const line of s.lines) { expect(line.length).toBeLessThanOrEqual(200); expect(line).not.toMatch(/\d{7,}/); }
    }
    // 값은 한 글자도 없다
    const all = JSON.stringify(structs);
    for (const secret of ['가짜상점', '1234567890', '12345678', '가짜 주소', '가짜시', ENC, '1234********5678']) expect(all).not.toContain(secret);
  });
});

describe('클릭 · 화면 열기 없음', () => {
  it('흐름이 낸 모든 동작은 fetch · read, 출처 페이지 · 영수증 주소 goto, login · probe · structure · done 뿐이다(클릭 없음)', () => {
    const outs: FlowOut[] = [];
    const flow = mk();
    const rows = Array.from({ length: 8 }, (_, i) => row(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`, 1000 + i));
    outs.push(flow.next({ type: 'start' }));
    let out: FlowOut = flow.next({ type: 'page', url: 'www.kurly.com/mypage/order', text: '주문 내역' });
    outs.push(out);
    for (let i = 0; i < 60 && !('type' in out && out.type === 'done'); i++) {
      if ('type' in out && (out.type === 'structure' || out.type === 'probe')) out = flow.next({ type: 'resume' });
      else if ('kind' in out && out.kind === 'fetch') {
        out = flow.next({ type: 'fetched', results: out.reqs.map((q, n) => (q.key === 'addr' ? ok('addr', { address: '가짜시 가짜구', address_sub: '' }) : q.key.startsWith('list-') ? ok(q.key, listResp(rows)) : ok(q.key, n % 2 ? detailResp({ pay: '네이버페이' }) : detailResp()))) });
      } else if ('type' in out && out.type === 'goto') {
        out = out.url === KURLY_LIST_URL
          ? flow.next({ type: 'page', url: 'www.kurly.com/mypage/order', text: '주문 내역' })
          : flow.next({ type: 'page', url: RECEIPT_PAGE_URL, text: receiptText(receiptResp()) });
      } else break;
      outs.push(out);
    }
    expect(out).toMatchObject({ type: 'done', reason: 'all-rows' });
    for (const o of outs) {
      if ('kind' in o) expect(['fetch', 'read']).toContain(o.kind);
      else if (o.type === 'goto') expect(o.url === KURLY_LIST_URL || o.url.startsWith(KURLY_RECEIPT_URL)).toBe(true);
      else expect(['login', 'probe', 'structure', 'done']).toContain(o.type);
    }
    expect(outs.filter((o) => 'type' in o && o.type === 'goto' && o.url.startsWith(KURLY_RECEIPT_URL)).length).toBeGreaterThan(0);
    expect(outs.filter((o) => 'type' in o && o.type === 'done')).toHaveLength(1);
  });

  it('알 수 없는 이벤트면 끝낸다', () => {
    const flow = mk();
    flow.next({ type: 'start' });
    expect(settle(flow, flow.next({ type: 'tokens', tokens: [], hasMore: false }))).toMatchObject({ type: 'done', reason: 'unexpected-event' });
  });
});

describe('이름으로 찾기 (순수 함수)', () => {
  it('목록 줄: 13자리 값이 든 객체가 가장 많은 배열을 고르고, 주문 · 일시 · 금액 · 상품명을 이름 규칙으로 읽는다', () => {
    const json = { result: { page: 1, orderList: [{ ordNo: 2026102000001, regDate: '2026.10.20', totalPrice: 3000, payAmount: 2500, orderName: '가짜 상품 외 1건' }], etc: [{ id: 'ab' }] } };
    const rows = findOrderRows(json);
    expect(rows).toHaveLength(1);
    const p = kurlyRowToOrder(rows[0]);
    expect(p?.order).toMatchObject({ orderNo: '2026102000001', orderedAt: '2026-10-20 00:00:00', amount: 2500, title: '가짜 상품 외 1건', seller: '컬리', kind: 'list', listKey: '2026-10-20 00:00|2500' });
    expect(p?.cancelled).toBe(false);
  });

  it('주문번호가 중첩(깊이 2)에 있어도 읽고, 일시 · 금액을 못 찾으면 null · 취소 상태는 표시한다', () => {
    expect(kurlyRowToOrder({ order: { orderNo: '2026102000001' }, createdAt: '2026-10-20T10:04:43', finalPrice: 100, status: 'CANCELLED' })).toMatchObject({ cancelled: true, order: { orderNo: '2026102000001' } });
    expect(kurlyRowToOrder({ orderNo: '2026102000001', price: 100 })).toBeNull();
    // 반품 · 환불 상태도 취소처럼 거른다(대표님 11-02 「반품 취소 가져오면 안 돼」), 정상 상태는 거르지 않는다
    for (const status of ['반품완료', '환불 완료', 'RETURNED', 'REFUNDED']) {
      expect(kurlyRowToOrder({ orderNo: '2026102000001', createdAt: '2026-10-20T10:04:43', finalPrice: 100, status })).toMatchObject({ cancelled: true });
    }
    expect(kurlyRowToOrder({ orderNo: '2026102000001', createdAt: '2026-10-20T10:04:43', finalPrice: 100, status: '배송완료' })).toMatchObject({ cancelled: false });
    expect(kurlyRowToOrder({ orderNo: '2026102000001', orderDate: '2026-10-20T10:00:00' })).toBeNull();
  });

  it('실측 목록 줄(11-02 서버 구조 기록): 금액 · 이름 · 상태가 deliveryGroups[].dealProducts 안에 있어도 읽는다 — 이전엔 금액 0 으로 전 줄이 버려져 컬리가 0건이었다', () => {
    const mkRow = (status: string[], extra: Record<string, unknown> = {}) => ({
      groupOrderNo: 2026102000001, paymentCompletedAt: '2026-10-20T10:04:43', isSelfCancelable: false,
      deliveryGroups: status.map((orderStatus, i) => ({ orderNos: [2026102000001 + i], orderStatus, deliveryPolicy: 'X', partnerName: 'P', dealProducts: [{ dealProductNo: 1, dealProductName: `가짜상품${i}`, contentsProductNo: 2, quantity: 2, displayPrice: 5000, displayDiscountPrice: 4000 }, { dealProductNo: 3, dealProductName: '둘째', quantity: 1, displayPrice: 1500, displayDiscountPrice: 0 }] })),
      ...extra,
    });
    // 상품마다 (할인가 있으면 할인가, 없으면 정가) × 수량을 더한다 = 4000×2 + 1500×1
    expect(kurlyRowToOrder(mkRow(['배송완료']))).toMatchObject({ cancelled: false, order: { orderNo: '2026102000001', amount: 9500, title: '가짜상품0', kind: 'list', seller: '컬리' } });
    // 묶음이 모두 취소 · 반품이면 취소로 표시, 일부만이면 남은 묶음 때문에 받는다
    expect(kurlyRowToOrder(mkRow(['취소완료', '반품완료']))).toMatchObject({ cancelled: true });
    expect(kurlyRowToOrder(mkRow(['CANCELED']))).toMatchObject({ cancelled: true });
    expect(kurlyRowToOrder(mkRow(['취소완료', '배송완료']))).toMatchObject({ cancelled: false });
    // 상품이 없으면(금액을 만들 수 없으면) 예전처럼 null
    expect(kurlyRowToOrder(mkRow([], { deliveryGroups: [] }))).toBeNull();
  });

  it('hasFilledArray: 값이 든 객체 배열이 있는 응답과 빈 응답을 가른다', () => {
    expect(hasFilledArray({ a: { b: [{ x: 1 }] } })).toBe(true);
    expect(hasFilledArray({ a: { b: [] }, c: 1 })).toBe(false);
  });

  it('상세: 네이버페이 여부 · encreq(키 이름 또는 값 안의 encreq=)', () => {
    expect(readKurlyDetail({ a: { encreq: ENC } })).toEqual({ npay: false, method: '', encreq: ENC });
    expect(readKurlyDetail({ link: `https://pg.kurlypay.co.kr/x?encreq=${ENC}&z=1`, m: 'NPAY' })).toEqual({ npay: true, method: '', encreq: ENC });
    expect(readKurlyDetail({ a: '네이버 페이' }).npay).toBe(true);
    expect(readKurlyDetail({ a: 'x' })).toEqual({ npay: false, method: '' });
  });

  it('영수증 화면 글자: 화면 글자 뒤의 var data = [ {...} ]; 를 읽고, JSON 본문 · 빈 글자 · 모양이 틀린 글자는 처리한다', () => {
    expect(kurlyReceiptData(receiptText({ CARD_APP_NO: '1' }))).toEqual([{ CARD_APP_NO: '1' }]);
    expect(kurlyReceiptData(JSON.stringify(receiptResp()))).toMatchObject({ CARD_APP_NO: '12345678' });
    expect(kurlyReceiptData('')).toBeUndefined();
    expect(kurlyReceiptData('var data = [{ 깨짐 ];')).toBeUndefined();
    expect(kurlyReceiptData('오류가 발생했습니다')).toBeUndefined();
  });

  it('영수증 주소: 부호 없는 값은 부호를 붙이고, 이미 부호가 든 값 · 컬리페이 전체 주소는 그대로, 모양이 틀리면 null', () => {
    expect(kurlyReceiptUrl('AbCd1234+/==')).toBe('https://pg.kurlypay.co.kr/api/payments/receipt/request/card?encreq=AbCd1234%2B%2F%3D%3D');
    expect(kurlyReceiptUrl('AbCd1234%2B%2F%3D')).toBe('https://pg.kurlypay.co.kr/api/payments/receipt/request/card?encreq=AbCd1234%2B%2F%3D');
    expect(kurlyReceiptUrl('https://pg.kurlypay.co.kr/api/payments/receipt/request/card?encreq=AbCd')).toContain('https://pg.kurlypay.co.kr/');
    expect(kurlyReceiptUrl('short')).toBeNull();
    expect(kurlyReceiptUrl('https://evil.example/x?encreq=AbCdEf123456')).toBeNull();
  });

  it('기본 배송지: 주소 + 상세 주소를 이름으로 찾는다(상세가 없으면 빈 글자)', () => {
    expect(findDefaultAddress({ a: [{ addr: '가짜시 1', detailAddress: '2호' }] })).toEqual({ address: '가짜시 1', addressDetail: '2호' });
    expect(findDefaultAddress({ roadAddress: '가짜시 2' })).toEqual({ address: '가짜시 2', addressDetail: '' });
    expect(findDefaultAddress({ name: 'x' })).toBeNull();
  });

  it('영수증 매핑(대표님 원문 키): 상호 · 사업자번호 · 승인번호 · 카드사 · 승인 일시 · 금액 · 상품명, 취소는 CC_DT 또는 STATE_NM', () => {
    const k = kurlySlip({ wrapped: receiptResp() });
    expect(k).toMatchObject({ seller: '가짜상점', title: '가짜 영수증 상품', cancelled: false, slip: { businessNumber: '1234567890', approval: '12345678', cardIssuer: '삼성카드', paidAt: '2026-10-20 10:04:43', amount: 12300 } });
    // 「2」가 붙은 키(결제서비스 업체 정보)는 쓰지 않는다
    expect(JSON.stringify(k)).not.toContain('0987654321');
    expect(kurlySlip(receiptResp({ APP_TM: '', CREATED_DTTM: '2026-10-20 10:05:00' }))?.slip.paidAt).toBe('2026-10-20 10:05:00');
    expect(kurlySlip(receiptResp({ CC_DT: '20261021' }))?.cancelled).toBe(true);
    expect(kurlySlip(receiptResp({ STATE_NM: '취소' }))?.cancelled).toBe(true);
    expect(kurlySlip(receiptResp({ CARD_APP_NO: '' }))).toBeNull();
    expect(kurlySlip({ foo: 1 })).toBeNull();
  });
});
