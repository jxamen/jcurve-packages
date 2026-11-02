/**
 * 컬리 통합 시험 — 구동기 + 흐름(kurlyApiFlow) + 실제 웹뷰 스크립트(siteFetchScript)를 가짜 페이지(노드 vm · 가짜 fetch) 위에서 처음부터 끝까지 돌린다(틀은 e2eHarness.ts).
 * 응답은 모두 가짜: 목록 · 상세는 응답 모양 원문이 없어 흔한 이름으로 만들었고, 영수증은 대표님 10-28 23:50:20 원문 키 이름 그대로(값은 가짜).
 * 확인: 실제로 나간 요청 · POST 본문 키, 이동 한 번, 줄별 결과, 완성 주문 매핑, 구조 기록(키 이름만), 기본 배송지 API 먼저, 영수증은 페이지 열기(var data), 교차 출처 끝, 건너뛰기 · onlyKeys.
 */
import { describe, expect, it } from 'vitest';
import { runFlow, type Page, type Reply, type Router } from './e2eHarness';
import { KURLY_ADDRESS_URL, KURLY_LIST_URL, KURLY_ORDERS_URL, KURLY_RECEIPT_URL, kurlyDetailUrl } from './kurlyApiFlow';
import { tailOf } from './naverApiFlow';
import { outcomeKey } from './runOutcome';

const no = (n: number): string => `2026102${String(n).padStart(6, '0')}`;
const day = (n: number): string => String(28 - n).padStart(2, '0');
const hour = (n: number): string => String(8 + n).padStart(2, '0');
const price = (n: number): number => 1000 + n * 100;
const iso = (n: number): string => `2026-10-${day(n)}T${hour(n)}:00:00`;
const kst = (n: number): string => `2026-10-${day(n)} ${hour(n)}:00:00`;
const key = (n: number): string => outcomeKey(no(n), kst(n), price(n));
const enc = (n: number): string => `AbCdEf${String(n).padStart(2, '0')}123456789+/==`;

/** 목록 줄 — 응답 모양 원문이 없어 흔한 이름으로 만든 가짜 */
const row = (n: number, extra: Record<string, unknown> = {}) => ({ orderNo: no(n), orderDateTime: iso(n), paymentPrice: price(n), productName: `상품${n}`, ...extra });
/** 영수증 응답 — 키는 23:50:20 원문 그대로, 값은 가짜 */
const receipt = (n: number, over: Record<string, unknown> = {}) => ({
  CARD_NO: '1234********5678', REP_NM2: '가나다', CPX_FLG: 'N', TEL_NO: '1588', PM_NM: '신용카드', GOODS_VAT: '118', QUOTA_MON: '00', ORD_NO: `X${n}`, APP_TM: `${hour(n)}0000`, ORD_NM: '가짜',
  GOODS_SVS_AMT: '0', CHKCARD_FLG: 'N', ADDR2: '가짜 주소2', RCPT_PRT_TYPE: '1', TRX_ST_CD: '1', GOODS_AMT: String(price(n)), PAY_NO: `P${n}`, CO_NM2: '가짜결제사', GOODS_NM: `가짜 영수증 상품${n}`,
  CARD_NM: '삼성카드', REP_NM: '홍길', CC_DT: '', CO_NO: '1234567890', CO_NO2: '0987654321', CO_NM: '가짜상점', CC_TM: '', PM_CD: '10', TEL_NO2: '1599', CARD_APP_NO: `A${n}9999`, TID: `T${n}`,
  GOODS_SPL_AMT: '11', ADDR: '가짜 주소', STATE_NM: '승인', APP_DT: `202610${day(n)}`, MBS_USR_ID: 'u', TR_DT: `202610${day(n)}`, CREATED_DTTM: `2026-10-${day(n)} ${hour(n)}:00:01`, PAYMENT_ID: `PID${n}`, ...over,
});

/** 영수증 화면 글자 — 앱 읽기 스크립트처럼 화면 글자 + `var data = [...]` 스크립트를 함께 보낸다 */
const receiptText = (r: Record<string, unknown>): string => `영수증
매출전표
var data = ${JSON.stringify([r])};`;
const RECEIPT_KEY = 'pg.kurlypay.co.kr/api/payments/receipt/request/card';
/** 영수증 화면 가짜 — pick 이 주문별로 영수증 칸을 바꿀 수 있다(기본은 receipt(n)) */
const receiptPages = (pick: (n: number) => Record<string, unknown> = (n) => receipt(n)): Record<string, Page> => ({
  'www.kurly.com/mypage/order': { text: '주문 내역' },
  [RECEIPT_KEY]: { text: (url) => receiptText(pick(nOfEnc(url) || 1)) },
});
const pages = receiptPages();
const ADDR_URL = KURLY_ADDRESS_URL;
const bodyOf = (b?: string): Record<string, unknown> => JSON.parse(b ?? '{}') as Record<string, unknown>;
const nOfDetail = (url: string): number => Number(url.slice(-13).slice(7)) || 0;
const nOfEnc = (url: string): number => { const e = new URL(url).searchParams.get('encreq') ?? ''; return Number(e.slice(6, 8)); };
const lastStates = (outcomes: { key: string; outcome: { state: string; code?: string } }[]): Map<string, string> => {
  const m = new Map<string, string>();
  for (const e of outcomes) m.set(e.key, e.outcome.state === 'failed' ? `failed:${e.outcome.code}` : e.outcome.state);
  return m;
};
const RECEIPT_GOTO = (g: string): boolean => g.startsWith(KURLY_RECEIPT_URL);

type Call = { method: string; url: string; body: Record<string, unknown> };
/** 가짜 컬리 서버 — 부른 요청과 POST 본문을 calls 에 기록한다 */
function server(behave: (c: Call) => Reply | undefined): { router: Router; calls: Call[] } {
  const calls: Call[] = [];
  const router: Router = (url, init) => {
    const c: Call = { method: init.method ?? 'GET', url, body: bodyOf(init.body) };
    calls.push(c);
    const rep = behave(c);
    if (rep) return rep;
    if (c.url === ADDR_URL) return { json: { address: '가짜시 가짜구', address_sub: '' } };
    return { status: 404 };
  };
  return { router, calls };
}

/** 주문 열두 건(2번 네이버페이 · 3번 목록에서 취소 · 4번 영수증 취소 · 5번 상세 500 · 6번 영수증 승인번호 없음) */
const MAIN = (c: Call): Reply | undefined => {
  if (c.method === 'GET' && c.url === ADDR_URL) {
    return { json: { address: '가짜시 가짜구', address_sub: '' } };
  }
  if (c.method === 'POST' && c.url === KURLY_ORDERS_URL) {
    const page = Number(c.body.page);
    const rows = Array.from({ length: 12 }, (_, i) => i + 1).map((n) => row(n, n === 3 ? { orderStatus: '주문취소 완료' } : {}));
    return { json: { data: { orders: rows.slice((page - 1) * 10, page * 10), totalCount: 12 } } };
  }
  if (c.method === 'POST' && c.url.startsWith('https://api.kurly.com/order-external/v3/mypage/orders/')) {
    const n = nOfDetail(c.url);
    if (n === 5) return { status: 500 };
    if (n === 2) return { json: { data: { order: { paymentMethod: '네이버페이' } } } };
    return { json: { data: { order: { paymentMethod: '신용카드', receipt: { encreq: enc(n) } } } } };
  }
  return undefined;
};
/** 영수증 화면 — 4번은 취소(CC_DT), 6번은 승인번호 없음 */
const MAIN_PAGES = receiptPages((n) => (n === 4 ? receipt(n, { CC_DT: '20261030' }) : n === 6 ? receipt(n, { CARD_APP_NO: '' }) : receipt(n)));

describe('컬리 — 구동기 + 흐름 + 실제 스크립트(가짜 페이지)', () => {
  it('목록(쪽 넘김) → 상세 → 영수증: 요청 · 본문 · 이동 · 줄별 결과 · 완성 주문 · 구조 기록이 한 줄로 이어진다', async () => {
    const { router, calls } = server(MAIN);
    const r = await runFlow('kurly', MAIN_PAGES, router);
    expect(r.results).toHaveLength(1);
    expect(r.results[0].reason).toBe('all-rows');

    // 요청은 컬리 api 뿐(기본 배송지 GET 하나 + 목록 · 상세 POST) — 영수증은 요청이 아니라 페이지 열기
    expect(new Set(calls.map((c) => new URL(c.url).host))).toEqual(new Set(['api.kurly.com']));
    expect(r.urls.filter((u) => u.startsWith('GET '))).toEqual([`GET ${ADDR_URL}`]);
    expect(r.urls.every((u) => u === `GET ${ADDR_URL}` || u.startsWith('POST https://api.kurly.com/'))).toBe(true);
    expect(r.urls[0]).toBe(`GET ${ADDR_URL}`);   // 기본 배송지가 가장 먼저
    // 이동: 출처 페이지로 시작, 영수증 주소는 아홉 건을 한 장씩, 영수증 묶음 사이에 출처 페이지로 돌아간다
    expect(r.gotos[0]).toBe(KURLY_LIST_URL);
    expect(r.gotos.filter(RECEIPT_GOTO).map(nOfEnc).sort((a, b) => a - b)).toEqual([1, 4, 6, 7, 8, 9, 10, 11, 12]);
    expect(r.gotos.every((g) => g === KURLY_LIST_URL || RECEIPT_GOTO(g))).toBe(true);
    expect(r.gotos.filter((g) => RECEIPT_GOTO(g) && (g.includes('+') || !g.includes('%2B')))).toEqual([]);   // encreq 는 퍼센트 부호가 붙은 채

    // 목록: POST v4, 본문 키 · 값(기본 배송지 API 의 배송지, 최근 1년) · 두 쪽
    const lists = calls.filter((c) => c.url === KURLY_ORDERS_URL);
    expect(lists.map((c) => c.method)).toEqual(['POST', 'POST']);
    expect(lists.map((c) => c.body.page)).toEqual([1, 2]);
    for (const c of lists) {
      expect(Object.keys(c.body).sort()).toEqual(['address', 'addressDetail', 'endDate', 'limit', 'page', 'productName', 'startDate']);
      expect(c.body).toMatchObject({ limit: 10, productName: '', address: '가짜시 가짜구', addressDetail: '', startDate: '2025-10-29T00:00:00', endDate: '2026-10-29T23:59:59' });
    }

    // 상세: 취소된 3번은 부르지 않고 5번은 500 이라 한 번 더(열한 건 + 다시 한 번), 본문은 배송지 두 칸뿐
    const details = calls.filter((c) => c.url.startsWith('https://api.kurly.com/order-external/v3/mypage/orders/'));
    expect(details).toHaveLength(12);
    expect(details.every((c) => c.method === 'POST')).toBe(true);
    expect(details.every((c) => Object.keys(c.body).sort().join() === 'address,addressDetail' && c.body.address === '가짜시 가짜구' && c.body.addressDetail === '')).toBe(true);
    expect(details.some((c) => c.url === kurlyDetailUrl(no(3)))).toBe(false);
    expect(details.filter((c) => c.url === kurlyDetailUrl(no(5)))).toHaveLength(2);

    // 영수증: 네이버페이(2) · 상세 500(5)은 열지 않고 나머지 아홉 건을 열었다(위 gotos) — 요청으로는 한 번도 부르지 않는다
    expect(calls.filter((c) => c.url.startsWith(KURLY_RECEIPT_URL))).toEqual([]);

    // 줄별 마지막 결과
    const last = lastStates(r.outcomes);
    const expected: Record<number, string> = { 1: 'done', 2: 'done', 3: 'none', 4: 'none', 5: 'failed:network', 6: 'done', 7: 'done', 8: 'done', 9: 'done', 10: 'done', 11: 'done', 12: 'done' };
    for (const n of Object.keys(expected).map(Number)) expect(last.get(key(n)), `주문 ${n}`).toBe(expected[n]);
    expect(last.size).toBe(12);

    // 서버로 올라가는 것: 목록 행 열두 개(kind list) + 완성 주문 일곱 개
    expect(r.orders.filter((o) => o.kind === 'list')).toHaveLength(11);   // 취소 1건은 올리지 않는다(11-02)
    const cards = r.orders.filter((o) => o.kind === 'card');
    expect(cards.map((o) => o.orderNo).sort()).toEqual([1, 7, 8, 9, 10, 11, 12].map(no).sort());
    // 완성 주문 필드 = 대표님 23:50:20 키 매핑(CO_NM · CO_NO · CARD_APP_NO · CARD_NM · APP_DT+APP_TM · GOODS_AMT · GOODS_NM)
    const one = cards.find((o) => o.orderNo === no(1));
    expect(one).toMatchObject({
      seller: '가짜상점', businessNumber: '1234567890', approval: 'A19999', cardIssuer: '삼성카드', orderedAt: kst(1), amount: price(1), title: '가짜 영수증 상품1', payment: '카드',
    });
    // 목록 행과 같은 listKey 로 이어 서버가 목록 행을 완성본으로 바꾼다
    expect(one?.listKey).toBe(`${kst(1).slice(0, 16)}|${price(1)}`);
    expect(r.orders.find((o) => o.kind === 'list' && o.orderNo === no(1))?.listKey).toBe(one?.listKey);
    // 결제서비스 업체(CO_NO2 · CO_NM2) · 카드번호 · 대표자 · 주소는 어디에도 없다
    const dump = JSON.stringify(r.orders);
    for (const secret of ['0987654321', '가짜결제사', '1234********5678', '홍길', '가짜 주소']) expect(dump).not.toContain(secret);

    // 구조 기록: 목록 · 상세 · 영수증 한 번씩, 키 이름만(값 없음)
    expect(r.structures.map((s) => [s.where, s.host, s.path])).toEqual([
      ['kurly-addr', 'api.kurly.com', '/addressbook/v1/cart/check-base-address-notification'],
      ['kurly-list', 'api.kurly.com', '/order-external/v4/mypage/orders'],
      ['kurly-detail', 'api.kurly.com', '/order-external/v3/mypage/orders/#'],
      ['kurly-receipt', 'pg.kurlypay.co.kr', '/api/payments/receipt/request/card'],
    ]);
    expect(r.structures[1].lines).toContain('use orderNo : orderNo');
    expect(r.structures[1].lines).toContain('data.orders : array10');
    expect(r.structures[1].lines).toContain('data.orders[0].paymentPrice : number');
    expect(r.structures[3].lines).toContain('use slip : CARD_APP_NO CO_NM CO_NO APP_DT APP_TM GOODS_AMT');
    const structDump = JSON.stringify(r.structures);
    for (const value of ['가짜상점', '1234567890', 'A19999', '삼성카드', enc(1), '1234********5678', '가짜 영수증 상품1', '상품1', '가짜시']) expect(structDump).not.toContain(value);
    for (const s of r.structures) for (const line of s.lines) { expect(line.length).toBeLessThanOrEqual(200); expect(line).not.toMatch(/\d{7,}/); }
  }, 60000);

  it('기본 배송지 API 를 가장 먼저 부르고, 그 배송지(address · address_sub)를 목록 · 상세 본문에 싣는다 — 값은 구조 기록에 남지 않는다', async () => {
    const { router, calls } = server((c) => {
      if (c.url === ADDR_URL) return { json: { address: '가짜시 가짜구 1', address_sub: '101동 1호' } };
      if (c.method === 'POST' && (c.url === KURLY_ORDERS_URL || c.url.includes('/v3/mypage/orders/'))) {
        if (c.body.address === '') return { status: 400 };   // 빈 배송지는 컬리가 거절한다
        if (c.url === KURLY_ORDERS_URL) return { json: { data: { orders: [row(1), row(2)] } } };
        return { json: { data: { order: { paymentMethod: '신용카드', receipt: { encreq: enc(nOfDetail(c.url)) } } } } };
      }
      return undefined;
    });
    const r = await runFlow('kurly', pages, router);
    expect(r.results[0].reason).toBe('all-rows');
    expect(calls[0]).toMatchObject({ method: 'GET', url: ADDR_URL });
    expect(calls.filter((c) => c.url === ADDR_URL)).toHaveLength(1);
    const lists = calls.filter((c) => c.url === KURLY_ORDERS_URL);
    expect(lists.map((c) => c.body.address)).toEqual(['가짜시 가짜구 1']);
    expect(lists[0].body).toMatchObject({ page: 1, addressDetail: '101동 1호' });
    const details = calls.filter((c) => c.url.includes('/v3/mypage/orders/'));
    expect(details).toHaveLength(2);
    expect(details.every((c) => c.body.address === '가짜시 가짜구 1' && c.body.addressDetail === '101동 1호')).toBe(true);
    expect(r.orders.filter((o) => o.kind === 'card')).toHaveLength(2);
    expect(r.gotos.filter(RECEIPT_GOTO)).toHaveLength(2);
    // 배송지 응답의 구조가 가장 먼저 나가고, 구조 기록에는 배송지 값이 없다(「found」 · 키 이름만)
    expect(r.structures.map((s) => s.where)).toEqual(['kurly-addr', 'kurly-list', 'kurly-detail', 'kurly-receipt']);
    expect(JSON.stringify(r.structures)).not.toContain('가짜시');
    expect(JSON.stringify(r.structures)).not.toContain('101동');
  }, 40000);

  it('목록은 열렸는데 상세가 4xx 면 배송지를 다시 찾지 않고 그 줄만 「읽지 못함」 — 다른 줄은 이어 간다', async () => {
    const { router, calls } = server((c) => {
      if (c.url === KURLY_ORDERS_URL) return { json: { data: { orders: [row(1), row(2)] } } };
      if (c.url.includes('/v3/mypage/orders/')) return nOfDetail(c.url) === 2 ? { status: 400 } : { json: { data: { order: { paymentMethod: '신용카드', receipt: { encreq: enc(nOfDetail(c.url)) } } } } };
      return undefined;
    });
    const r = await runFlow('kurly', pages, router);
    expect(r.results[0].reason).toBe('all-rows');
    expect(calls.filter((c) => c.url === ADDR_URL)).toHaveLength(1);
    expect(calls.filter((c) => c.url.includes('/v3/mypage/orders/'))).toHaveLength(2);
    const last = lastStates(r.outcomes);
    expect(last.get(key(1))).toBe('done');
    expect(last.get(key(2))).toBe('failed:unreadable');
    expect(r.orders.filter((o) => o.kind === 'card')).toHaveLength(1);
  }, 40000);

  it('배송지를 못 찾거나 배송지를 실은 목록이 거절돼도 list-failed 로 끝난다(화면 방식으로 되돌아가지 않는다)', async () => {
    // 배송지 API 가 배송지를 주지 않으면 목록을 부르지 않는다
    const none = server((c) => (c.url === ADDR_URL ? { json: { name: '가짜' } } : undefined));
    const a = await runFlow('kurly', pages, none.router);
    expect(a.results[0].reason).toBe('list-failed');
    expect(none.calls.filter((c) => c.url === KURLY_ORDERS_URL)).toHaveLength(0);
    expect(a.orders).toEqual([]);
    // 배송지를 실었는데도 목록이 4xx 면 배송지를 다시 찾지 않고 한 번으로 끝
    const { router, calls } = server((c) => (c.url === KURLY_ORDERS_URL ? { status: 422 } : undefined));
    const r = await runFlow('kurly', pages, router);
    expect(r.results[0].reason).toBe('list-failed');
    expect(r.gotos).toEqual([KURLY_LIST_URL]);
    expect(calls.filter((c) => c.url === ADDR_URL)).toHaveLength(1);
    expect(calls.filter((c) => c.url === KURLY_ORDERS_URL)).toHaveLength(1);
    expect(r.orders).toEqual([]);
  }, 30000);

  it('교차 출처로 막힌 경우 — 배송지를 읽은 뒤 목록 요청이 전부 안 돌아오면 cross-origin, 배송지부터 안 돌아오면 list-failed', async () => {
    const a = await runFlow('kurly', pages, server((c) => (c.url === KURLY_ORDERS_URL ? { reject: true } : undefined)).router);
    expect(a.results[0].reason).toBe('cross-origin');
    expect(a.orders).toEqual([]);
    expect(a.urls[0]).toBe(`GET ${ADDR_URL}`);
    expect(a.urls.slice(1).every((u) => u.startsWith('POST https://api.kurly.com/order-external/v4/'))).toBe(true);

    // 컬리 api 전체가 거절되면 가장 먼저 부르는 배송지 요청에서 멈춘다 — 코드는 이때 cross-origin 이 아니라 list-failed 로 끝낸다(보고 참고)
    const b = await runFlow('kurly', pages, server((c) => (new URL(c.url).host === 'api.kurly.com' ? { reject: true } : undefined)).router);
    expect(b.results[0].reason).toBe('list-failed');
    expect(b.urls).toEqual([`GET ${ADDR_URL}`]);
    expect(b.orders).toEqual([]);
  }, 60000);

  it('영수증 호스트(pg.kurlypay.co.kr)는 요청을 거절해도 상관없다 — 영수증은 처음부터 페이지 열기라 화면 글자(var data)로 읽고, 세부 칸도 붙는다(대표님 11-02)', async () => {
    const rows = (c: Call): Reply | undefined => {
      if (c.url === KURLY_ORDERS_URL) return { json: { data: { orders: Array.from({ length: 7 }, (_, i) => row(i + 1)) } } };
      if (c.url.includes('/v3/mypage/orders/')) return { json: { data: { order: { paymentMethod: '신용카드', receipt: { encreq: enc(nOfDetail(c.url)) } } } } };
      if (new URL(c.url).host === 'pg.kurlypay.co.kr') return { reject: true };
      return undefined;
    };
    const { router, calls } = server(rows);
    const b = await runFlow('kurly', pages, router);
    expect(b.results[0].reason).toBe('all-rows');
    expect(b.orders.filter((o) => o.kind === 'card')).toHaveLength(7);
    expect(b.orders.filter((o) => o.kind === 'list')).toHaveLength(7);
    // 영수증 호스트로는 요청이 한 번도 나가지 않고, 주문마다 한 번씩 이동해 읽는다
    expect(calls.some((c) => new URL(c.url).host === 'pg.kurlypay.co.kr')).toBe(false);
    expect(b.gotos[0]).toBe(KURLY_LIST_URL);
    expect(b.gotos.filter(RECEIPT_GOTO)).toHaveLength(7);
    expect(b.orders.find((o) => o.kind === 'card')?.detail).toMatchObject({ approvalNo: 'A19999', cardCompany: '삼성카드', sellerBusinessNo: '1234567890' });
  }, 60000);

  it('영수증 화면이 빈 화면(차단 오류 페이지)만 연달아 나오면 cross-origin 으로 끝내고 남은 줄에 까닭을 남긴다', async () => {
    const rows = (c: Call): Reply | undefined => {
      if (c.url === KURLY_ORDERS_URL) return { json: { data: { orders: Array.from({ length: 7 }, (_, i) => row(i + 1)) } } };
      if (c.url.includes('/v3/mypage/orders/')) return { json: { data: { order: { paymentMethod: '신용카드', receipt: { encreq: enc(nOfDetail(c.url)) } } } } };
      return undefined;
    };
    const blank: Record<string, Page> = { 'www.kurly.com/mypage/order': { text: '주문 내역' }, [RECEIPT_KEY]: { text: '' } };
    const b = await runFlow('kurly', blank, server(rows).router);
    expect(b.results[0].reason).toBe('cross-origin');
    expect(b.orders.filter((o) => o.kind === 'card')).toEqual([]);
    expect(b.orders.filter((o) => o.kind === 'list')).toHaveLength(7);
    // 읽기를 포기한 나머지 줄도 「가져오는 중」으로 남지 않는다
    const states = [...lastStates(b.outcomes).values()];
    expect(states).toHaveLength(7);
    // 빈 영수증 화면 세 건은 주문상세(구매영수증)로(대표님 11-02 23:36), 포기한 나머지는 까닭을 남긴다
    expect(states.filter((s) => s === 'done')).toHaveLength(3);
    expect(b.orders.filter((o) => o.kind === 'purchase')).toHaveLength(3);
    expect(states.filter((s) => s.startsWith('failed'))).toHaveLength(4);
  }, 60000);

  it('이미 가져온 주문(뒤 4자리 + 날짜)은 상세 · 영수증을 요청하지 않고 목록 행도 다시 올리지 않는다', async () => {
    const { router, calls } = server(MAIN);
    const r = await runFlow('kurly', pages, router, { sinceLatest: false }, { tails: [tailOf(no(1), kst(1)), tailOf(no(7), kst(7))] });
    expect(r.results[0].reason).toBe('all-rows');
    const details = calls.filter((c) => c.url.includes('/v3/mypage/orders/')).map((c) => c.url);
    expect(details).not.toContain(kurlyDetailUrl(no(1)));
    expect(details).not.toContain(kurlyDetailUrl(no(7)));
    expect(details).toContain(kurlyDetailUrl(no(8)));
    expect(r.orders.filter((o) => o.kind === 'list').map((o) => o.orderNo)).not.toContain(no(1));
    expect(r.orders.filter((o) => o.kind === 'list')).toHaveLength(9);   // 취소 1건은 올리지 않는다(11-02)
  }, 60000);

  it('한 줄만 다시(onlyKeys) — 그 주문만 상세 · 영수증을 열고 목록 행은 올리지 않는다, 목록에 없는 줄은 까닭을 남긴다', async () => {
    const missing = outcomeKey('2026102009999', '2026-09-01 00:00', 7);
    const { router, calls } = server(MAIN);
    const r = await runFlow('kurly', pages, router, { onlyKeys: [key(8), missing] });
    expect(r.results[0].reason).toBe('all-rows');
    expect(calls.filter((c) => c.url.includes('/v3/mypage/orders/')).map((c) => c.url)).toEqual([kurlyDetailUrl(no(8))]);
    expect(r.gotos.filter(RECEIPT_GOTO).map(nOfEnc)).toEqual([8]);
    expect(r.orders.filter((o) => o.kind === 'list')).toEqual([]);
    expect(r.orders.filter((o) => o.kind === 'card').map((o) => o.orderNo)).toEqual([no(8)]);
    const last = lastStates(r.outcomes);
    expect(last.get(key(8))).toBe('done');
    expect(last.get(missing)).toBe('failed:no-pair');
  }, 60000);

  it('요청 중 로그인이 풀리면(401) 구동기가 로그인 구간에 들어갔다가 다시 읽고 같은 묶음부터 이어 간다 — 이동은 여전히 한 번', async () => {
    let denied = 0;
    const { router, calls } = server((c) => {
      if (c.url === KURLY_ORDERS_URL) return { json: { data: { orders: [row(1), row(2), row(3)] } } };
      if (c.url.includes('/v3/mypage/orders/')) {
        if (denied < 3) { denied++; return { status: 401 }; }
        return { json: { data: { order: { receipt: { encreq: enc(nOfDetail(c.url)) } } } } };
      }
      if (c.url.startsWith(KURLY_RECEIPT_URL)) return { json: receipt(nOfEnc(c.url)) };
      return undefined;
    });
    const r = await runFlow('kurly', pages, router);
    expect(r.results[0].reason).toBe('all-rows');
    // 출처 페이지 이동은 여전히 한 번(로그인 뒤 다시 읽을 때도 새로 열지 않는다) — 그 밖 이동은 영수증 주소 세 건
    expect(r.gotos.filter((g) => g === KURLY_LIST_URL)).toHaveLength(1);
    expect(r.gotos.filter(RECEIPT_GOTO)).toHaveLength(3);
    expect(r.gotos).toHaveLength(4);
    expect(calls.filter((c) => c.url.includes('/v3/mypage/orders/'))).toHaveLength(6);
    expect(calls.filter((c) => c.url === KURLY_ORDERS_URL)).toHaveLength(1);
    expect([...lastStates(r.outcomes).values()]).toEqual(['done', 'done', 'done']);
  }, 60000);

  it('막히면(429) 한 번에 2건 · 하나씩 · 요청 사이를 쉬며 이어 가고, 끝내 막히면 줄마다 「사이트가 잠시 막았어요」', async () => {
    const { router, calls } = server((c) => {
      if (c.url === KURLY_ORDERS_URL) return { json: { data: { orders: [row(1), row(2)] } } };
      if (c.url.includes('/v3/mypage/orders/')) return { status: 429 };
      return undefined;
    });
    const t0 = Date.now();
    const r = await runFlow('kurly', pages, router);
    expect(r.results[0].reason).toBe('all-rows');
    expect(calls.filter((c) => c.url.includes('/v3/mypage/orders/'))).toHaveLength(4);
    expect([...lastStates(r.outcomes).values()].sort()).toEqual(['failed:blocked', 'failed:blocked']);
    // 두 번째(느린) 묶음은 하나씩 부르고 요청 사이를 쉰다(gapMs 1.2초)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(1100);
  }, 60000);
});
