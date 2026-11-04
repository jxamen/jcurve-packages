/**
 * 네이버 요청 흐름(naverApiFlow) 시험 — 이벤트를 하나씩 먹이며 낸 동작 · 결과를 확인한다(값은 모두 가짜).
 * 핵심: 클릭 · 영수증 화면 열기 없음(api · receipts · read 와 출처 페이지 두 번의 goto 뿐), 최신부터 차례, 한 주문 한 줄, 이미 가져온 건 건너뜀, 줄별 결과.
 */
import { describe, expect, it } from 'vitest';
import { payHistoryUrl, SHOP_ORDER_URL, type FlowOut } from './naverReceipt';
import { createNaverApiFlow, tailOf, type ApiFlowOptions } from './naverApiFlow';
import { outcomeKey } from './runOutcome';
import type { ReceiptResult } from './naverReceiptsScript';

const NOW = Date.parse('2026-10-29T09:00:00+09:00');
const mk = (o: ApiFlowOptions = {}) => createNaverApiFlow({ now: () => NOW, ...o });

const orderNo = (n: number): string => `20261020${String(n).padStart(8, '0')}`;
const item = (n: number, at: string, extra: Record<string, unknown> = {}) => ({
  orderNo: orderNo(n), productOrderNo: `PD2026102000${String(n).padStart(6, '0')}`, orderDateTime: at, productName: `상품${n}`, productAmount: 1000 * n, merchantName: `상점${n}`, ...extra,
});
const slip = (over: Record<string, unknown> = {}) => ({ approvalNo: '111222', cardCompany: '삼성카드', approvalAt: '2026-10-20T10:04:43', productName: '영수증 상품', sellerName: '판매자', businessNo: '123-45-67890', amount: 5000, ...over });
const OK = (key: string, over: Record<string, unknown> = {}): ReceiptResult => ({ key, st: 'ok', slip: slip(over) });

const LIST = [
  item(1, '2026-10-20 10:04:43'),
  item(2, '2026-10-25 12:00:00'),
  item(2, '2026-10-25 12:00:00', { productOrderNo: 'PD2026102099999999', productName: '같은 주문의 다른 상품' }),
  item(3, '2025-01-01 09:00:00'),   // 1년 밖
];
const keyOf = (n: number, at: string, amount = 1000 * n): string => outcomeKey(orderNo(n), at, amount);

/** 네이버페이 내역 읽기(scan) 단계에는 짝이 없다고 답하고, probe 를 흘려 보내며 done 까지 간다. 지나간 probe where 는 seen 에 모은다 */
const finishOut = (flow: ReturnType<typeof mk>, first: FlowOut, seen: string[] = [], osheet: (key: string) => ReceiptResult = (key) => ({ key, st: 'none' })): FlowOut => {
  let out = first;
  let orders = false;
  for (let i = 0; i < 30; i++) {
    if ('type' in out && out.type === 'probe') { seen.push(out.where); out = flow.next({ type: 'resume' }); }
    else if ('type' in out && out.type === 'structure') out = flow.next({ type: 'resume' });
    else if ('kind' in out && out.kind === 'receipts' && out.scan === true) out = flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0 }] });
    // 카드영수증이 없는 주문 — orders 출처에서 주문상세(osheet) 한 번(기본 답: 주문상세에서도 올릴 것 없음)
    else if ('type' in out && out.type === 'goto' && out.url.startsWith('https://orders.pay.naver.com/')) { orders = true; out = flow.next({ type: 'page', url: 'orders.pay.naver.com/order/status/1', text: '주문 상세' }); }
    else if ('kind' in out && out.kind === 'receipts' && out.jobs.length > 0 && out.jobs.every((j) => j.osheet === true)) { orders = true; out = flow.next({ type: 'receipts', results: out.jobs.map((j) => osheet(j.key)) }); }
    else if (orders && 'type' in out && out.type === 'goto' && out.url === payHistoryUrl(1)) out = flow.next({ type: 'page', url: 'pay.naver.com/history?page=1', text: '결제내역' });
    else break;
  }
  return out;
};

/** start → 쇼핑 주문 화면 → 목록 api → (결제 화면 goto) 까지 */
function toPayGoto(flow: ReturnType<typeof mk>, items: unknown[] = LIST, known?: { orderNos?: string[]; listKeys?: string[]; tails?: string[] }): FlowOut {
  expect(flow.next({ type: 'start', known })).toEqual({ type: 'goto', url: SHOP_ORDER_URL });
  const api = flow.next({ type: 'page', url: 'shopping.naver.com/my/order', text: '주문 내역 1,000원' });
  expect(api).toMatchObject({ kind: 'api', name: 'shop', maxPages: 40 });
  return flow.next({ type: 'api', name: 'shop', items, page: 1, done: true });
}
const toFirstBatch = (flow: ReturnType<typeof mk>, items?: unknown[], known?: { orderNos?: string[]; listKeys?: string[]; tails?: string[] }): Extract<FlowOut, { kind: 'receipts' }> => {
  expect(toPayGoto(flow, items, known)).toEqual({ type: 'goto', url: payHistoryUrl(1) });
  const out = flow.next({ type: 'page', url: 'pay.naver.com/history?page=1', text: '결제내역 1,000원' });
  if (!('kind' in out) || out.kind !== 'receipts') throw new Error(`receipts 동작이 아님: ${JSON.stringify(out)}`);
  return out;
};

describe('순서 · 한 주문 한 줄', () => {
  it('최신 주문부터 차례로 보내고, 같은 주문의 다른 상품 줄 · 1년 밖 주문은 뺀다', () => {
    const flow = mk();
    const batch = toFirstBatch(flow);
    expect(batch.jobs.map((j) => j.orderNo)).toEqual([orderNo(2), orderNo(1)]);
    expect(batch.jobs[0].key).toBe(keyOf(2, '2026-10-25 12:00:00', 4000));
    expect(batch.jobs[0].productOrderNo).toMatch(/^PD\d+$/);
  });

  it('목록 행(kind list)은 영수증을 받기 전에 먼저 take 로 나가고, 줄별 「가져오는 중」이 알려진다', () => {
    const flow = mk();
    toFirstBatch(flow);
    const rows = flow.take();
    expect(rows.map((o) => [o.orderNo, o.kind])).toEqual([[orderNo(2), 'list'], [orderNo(1), 'list']]);
    expect(rows[0].listKey).toBe('2026-10-25 12:00|4000');
    expect(flow.takeOutcomes?.()).toEqual([
      { key: keyOf(2, '2026-10-25 12:00:00', 4000), outcome: { state: 'fetching' } },
      { key: keyOf(1, '2026-10-20 10:04:43'), outcome: { state: 'fetching' } },
    ]);
  });

  it('영수증 결과가 오면 줄별 결과(가져옴 · 영수증 없음)와 완성 주문(목록 행과 같은 listKey)을 낸다', () => {
    const flow = mk();
    const batch = toFirstBatch(flow);
    flow.take(); flow.takeOutcomes?.();
    const k2 = batch.jobs[0].key; const k1 = batch.jobs[1].key;
    const out = finishOut(flow, flow.next({ type: 'receipts', results: [OK(k2), { key: k1, st: 'none' }] }));
    expect(flow.takeOutcomes?.()).toMatchObject([{ key: k2, outcome: { state: 'done' } }, { key: k1, outcome: { state: 'none', info: { stage: 'read', words: expect.stringMatching(/-none$/) } } }]);
    expect(out).toMatchObject({ type: 'done', reason: 'all-rows' });
    const done = (out as Extract<FlowOut, { type: 'done' }>).orders;
    expect(done).toHaveLength(2);
    // 영수증이 없는 결제(none)는 목록 행과 같은 주문번호 · listKey 로 kind none 행이 간다 — 서버가 list 행을 none 으로 바꾼다(상세 없음)
    expect(done[1]).toEqual({ orderNo: orderNo(1), orderedAt: '2026-10-20 10:04:43', amount: 1000, payment: '카드', kind: 'none', listKey: '2026-10-20 10:04|1000', seller: '상점1', title: '상품1', productOrderNo: `PD${orderNo(1)}` });
    expect(done[0]).toMatchObject({
      orderNo: orderNo(2), kind: 'card', seller: '판매자', title: '영수증 상품', businessNumber: '123-45-67890', approval: '111222', cardIssuer: '삼성카드',
      orderedAt: '2026-10-20 10:04:43', amount: 5000, listKey: '2026-10-25 12:00|4000',
    });
  });

  it('줄마다 쓰는 값이 모자라면(승인 시각 없음) 그 줄만 「읽지 못함」', () => {
    const flow = mk();
    const batch = toFirstBatch(flow);
    flow.take(); flow.takeOutcomes?.();
    flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key, { approvalAt: undefined }), OK(batch.jobs[1].key)] });
    expect(flow.takeOutcomes?.()).toMatchObject([
      { key: batch.jobs[0].key, outcome: { state: 'failed', code: 'unreadable', info: { stage: 'read', words: 'card-import' } } },
      { key: batch.jobs[1].key, outcome: { state: 'done' } },
    ]);
  });

  it('승인 시각은 여러 모양(ISO · 소수초 · 압축 14자리 · 밀리초 숫자)을 같은 한국 시각으로 읽는다', () => {
    const ms = Date.parse('2026-10-20T10:04:43+09:00');
    for (const approvalAt of ['2026-10-20T10:04:43', '2026-10-20T10:04:43.123', '2026-10-20 10:04:43', '20261020100443', ms, '2026-10-20T10:04:43+09:00']) {
      const flow = mk();
      const batch = toFirstBatch(flow);
      flow.take();
      const out = finishOut(flow, flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key, { approvalAt }), { key: batch.jobs[1].key, st: 'none' }] }));
      expect((out as Extract<FlowOut, { type: 'done' }>).orders[0]?.orderedAt, String(approvalAt)).toBe('2026-10-20 10:04:43');
    }
  });

  it('취소된 결제는 영수증 없음으로 센다', () => {
    const flow = mk();
    const batch = toFirstBatch(flow);
    flow.take(); flow.takeOutcomes?.();
    finishOut(flow, flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key, { cancelAt: '2026-10-21T00:00:00' }), { key: batch.jobs[1].key, st: 'none' }] }));
    expect(flow.takeOutcomes?.().map((e) => e.outcome.state)).toEqual(['none', 'none']);
  });

  it('여덟 건씩 묶어 보낸다 — 열 건이면 8건 + 2건', () => {
    const items = Array.from({ length: 10 }, (_, i) => item(i + 1, `2026-10-${String(10 + i).padStart(2, '0')} 10:00:00`));
    const flow = mk();
    const first = toFirstBatch(flow, items);
    expect(first.jobs).toHaveLength(8);
    expect(first.jobs[0].orderNo).toBe(orderNo(10));
    flow.takeOutcomes?.();
    const second = flow.next({ type: 'receipts', results: first.jobs.map((j) => OK(j.key)) });
    expect(second).toMatchObject({ kind: 'receipts' });
    expect((second as Extract<FlowOut, { kind: 'receipts' }>).jobs.map((j) => j.orderNo)).toEqual([orderNo(2), orderNo(1)]);
  });
});

describe('이미 가져온 것 건너뛰기 · 한 건 다시', () => {
  it('서버에 영수증까지 있는 주문(뒤 4자리 + 날짜)은 건너뛰고 못 가져온 것만 보낸다 — 목록 행은 서버에 이미 있으니 done 이 아니라 다시 보낸다', () => {
    const flow = mk();
    const batch = toFirstBatch(flow, LIST, { tails: [tailOf(orderNo(2), '2026-10-25 12:00:00')] });
    expect(batch.jobs.map((j) => j.orderNo)).toEqual([orderNo(1)]);
    expect(flow.take().map((o) => o.orderNo)).toEqual([orderNo(1)]);
  });

  it('주문번호 · 목록 키로 아는 것도 건너뛴다', () => {
    const flow = mk();
    expect(toFirstBatch(flow, LIST, { orderNos: [orderNo(2)] }).jobs.map((j) => j.orderNo)).toEqual([orderNo(1)]);
    const flow2 = mk();
    expect(toFirstBatch(flow2, LIST, { listKeys: ['2026-10-20 10:04|1000'] }).jobs.map((j) => j.orderNo)).toEqual([orderNo(2)]);
  });

  it('가져올 영수증이 하나도 없어도 결제 화면은 열어 네이버페이 내역만 읽고(scan, 요청 없음) 끝낸다 — 한 줄 다시에는 하지 않는다', () => {
    const flow = mk();
    expect(toPayGoto(flow, LIST, { orderNos: [orderNo(1), orderNo(2)] })).toEqual({ type: 'goto', url: payHistoryUrl(1) });
    const scan = flow.next({ type: 'page', url: 'pay.naver.com/history?page=1', text: '결제내역 1,000원' });
    expect(scan).toMatchObject({ kind: 'receipts', jobs: [], scan: true });
    expect((scan as Extract<FlowOut, { kind: 'receipts' }>).skip).toEqual([orderNo(1), orderNo(2)]);
    expect(finishOut(flow, scan)).toMatchObject({ type: 'done', reason: 'all-rows' });
  });

  it('onlyKeys 면 그 줄만 가져오고 목록 행은 다시 올리지 않는다 — 목록에 없는 줄은 까닭을 남긴다', () => {
    const k1 = keyOf(1, '2026-10-20 10:04:43');
    const missing = outcomeKey('2026102000009999', '2026-10-01 00:00', 7);
    const flow = mk({ onlyKeys: [k1, missing] });
    const batch = toFirstBatch(flow);
    expect(batch.jobs.map((j) => j.key)).toEqual([k1]);
    expect(flow.take()).toEqual([]);
    expect(flow.takeOutcomes?.()).toEqual([{ key: missing, outcome: { state: 'failed', code: 'no-pair' } }, { key: k1, outcome: { state: 'fetching' } }]);
  });
});

describe('로그인 · 막힘 · 시간 초과', () => {
  it('쇼핑 화면이 로그인 화면이면 로그인을 부탁하고, 로그인 뒤 다시 읽으면 이어 간다', () => {
    const flow = mk();
    flow.next({ type: 'start' });
    expect(flow.next({ type: 'page', url: 'nid.naver.com/nidlogin.login', text: '로그인 아이디 비밀번호' })).toEqual({ type: 'login' });
    expect(flow.next({ type: 'page', url: 'shopping.naver.com/my/order', text: '주문 1,000원' })).toMatchObject({ kind: 'api' });
  });

  it('영수증 요청에서 로그인이 풀리면 로그인을 부탁하고, 풀린 뒤 같은 묶음부터 다시 보낸다(시도 횟수는 안 센다)', () => {
    const flow = mk();
    const batch = toFirstBatch(flow);
    expect(flow.next({ type: 'receipts', results: batch.jobs.map((j) => ({ key: j.key, st: 'login' as const })) })).toEqual({ type: 'login' });
    const again = flow.next({ type: 'page', url: 'pay.naver.com/history?page=1', text: '결제내역 1,000원' });
    expect(again).toMatchObject({ kind: 'receipts' });
    expect((again as Extract<FlowOut, { kind: 'receipts' }>).jobs.map((j) => j.key)).toEqual(batch.jobs.map((j) => j.key));
  });

  it('막히면(403 · 429) 그 줄은 「막힘」으로 남기고 다시 보내지 않는다(원문 밖 재시도 없음, 대표님 10-29 13:46)', () => {
    const items = Array.from({ length: 8 }, (_, i) => item(i + 1, `2026-10-${String(10 + i).padStart(2, '0')} 10:00:00`));
    const flow = mk();
    const b1 = toFirstBatch(flow, items);
    flow.takeOutcomes?.();
    const out = flow.next({ type: 'receipts', results: b1.jobs.map((j) => ({ key: j.key, st: 'blocked' as const })) });
    // 다시 보내는 묶음 없이 네이버페이 내역 읽기(scan)로 넘어간다
    expect(out).toMatchObject({ kind: 'receipts', jobs: [], scan: true });
    const failed = (flow.takeOutcomes?.() ?? []).filter((e) => e.outcome.state === 'failed');
    expect(failed).toHaveLength(8);
    expect(failed.every((e) => e.outcome.state === 'failed' && e.outcome.code === 'blocked')).toBe(true);
  });

  it('막히지 않은 묶음이 오면 연속 막힘 횟수가 풀린다', () => {
    const items = Array.from({ length: 12 }, (_, i) => item(i + 1, `2026-10-${String(10 + i).padStart(2, '0')} 10:00:00`));
    const flow = mk();
    const b1 = toFirstBatch(flow, items);
    const b2 = flow.next({ type: 'receipts', results: b1.jobs.map((j) => ({ key: j.key, st: 'blocked' as const })) }) as Extract<FlowOut, { kind: 'receipts' }>;
    const b3 = flow.next({ type: 'receipts', results: b2.jobs.map((j) => OK(j.key)) });
    expect(b3).toMatchObject({ kind: 'receipts' });
  });

  it('시간 초과면 그 묶음을 다시 보내지 않고 줄마다 「인터넷이 불안정」으로 남긴다(원문 밖 재시도 없음)', () => {
    const flow = mk();
    toFirstBatch(flow);
    flow.takeOutcomes?.();
    const end = finishOut(flow, flow.next({ type: 'timeout' }));
    expect(end).toMatchObject({ type: 'done', reason: 'all-rows' });
    expect((flow.takeOutcomes?.() ?? []).filter((e) => e.outcome.state === 'failed').map((e) => (e.outcome as { code: string }).code)).toEqual(['network', 'network']);
  });

  it('목록을 세 번 못 받으면 끝낸다(화면 방식으로 되돌아가지 않는다)', () => {
    const flow = mk();
    flow.next({ type: 'start' });
    flow.next({ type: 'page', url: 'shopping.naver.com/my/order', text: '주문 1,000원' });
    expect(flow.next({ type: 'api', name: 'shop', items: [], page: 0, done: true, failed: true })).toMatchObject({ kind: 'api' });
    expect(flow.next({ type: 'api', name: 'shop', items: [], page: 0, done: true, failed: true })).toMatchObject({ kind: 'api' });
    expect(finishOut(flow, flow.next({ type: 'api', name: 'shop', items: [], page: 0, done: true, failed: true }))).toMatchObject({ type: 'done', reason: 'list-failed' });
  });

  it('알 수 없는 응답 · 이벤트면 끝낸다', () => {
    const flow = mk();
    flow.next({ type: 'start' });
    expect(finishOut(flow, flow.next({ type: 'tokens', tokens: [], hasMore: false }))).toMatchObject({ type: 'done', reason: 'unexpected-event' });
  });
});

describe('클릭 · 화면 열기 없음', () => {
  it('흐름이 낸 모든 동작은 api · receipts · read 와 출처 페이지 두 번의 goto · login · probe · done 뿐이다', () => {
    const outs: FlowOut[] = [];
    const flow = mk();
    const feed = (o: FlowOut): FlowOut => { outs.push(o); return o; };
    const items = Array.from({ length: 10 }, (_, i) => item(i + 1, `2026-10-${String(10 + i).padStart(2, '0')} 10:00:00`));
    feed(flow.next({ type: 'start' }));
    feed(flow.next({ type: 'page', url: 'shopping.naver.com/my/order', text: '주문 1,000원' }));
    feed(flow.next({ type: 'api', name: 'shop', items, page: 1, done: true }));
    let out = feed(flow.next({ type: 'page', url: 'pay.naver.com/history?page=1', text: '결제내역 1,000원' }));
    for (let i = 0; i < 60; i++) {
      if ('kind' in out && out.kind === 'receipts' && out.scan === true) out = feed(flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0 }] }));
      else if ('kind' in out && out.kind === 'receipts') {
        const jobs = out.jobs;
        out = feed(flow.next({ type: 'receipts', results: jobs.map((j, n) => (j.osheet ? { key: j.key, st: 'none' as const } : n % 2 === 0 ? OK(j.key) : { key: j.key, st: 'none' as const })) }));
      } else if ('type' in out && out.type === 'goto' && out.url.startsWith('https://orders.pay.naver.com/')) out = feed(flow.next({ type: 'page', url: 'orders.pay.naver.com/order/status/1', text: '주문 상세' }));
      else if ('type' in out && out.type === 'goto' && out.url === payHistoryUrl(1)) out = feed(flow.next({ type: 'page', url: 'pay.naver.com/history?page=1', text: '결제내역' }));
      else if ('type' in out && (out.type === 'structure' || out.type === 'probe')) out = feed(flow.next({ type: 'resume' }));
      else break;
    }
    expect(out).toMatchObject({ type: 'done' });
    const ordersGoto = `https://orders.pay.naver.com/order/status/${orderNo(10)}?returnUrl=${encodeURIComponent('https://pay.naver.com/pc/history')}`;
    for (const o of outs) {
      if ('kind' in o) expect(['api', 'receipts', 'read']).toContain(o.kind);
      else if (o.type === 'goto') expect([SHOP_ORDER_URL, payHistoryUrl(1), ordersGoto]).toContain(o.url);
      else expect(['login', 'probe', 'structure', 'done']).toContain(o.type);
    }
    // 출처 화면: 쇼핑 · 결제 + 카드영수증 없는 주문의 주문상세(orders 출처 한 번 · 결제로 돌아오기 한 번)
    expect(outs.filter((o) => 'type' in o && o.type === 'goto')).toHaveLength(4);
  });
});

describe('실패 진단 · 실패 까닭 개수 (10-29 12:00 실행 뒤)', () => {
  const diag = (w: string, status: number) => ({ w, status, lines: ['sent payId,tid,productOrderNo', 'fmt payId : n20', `${w} : object`] });

  it('실패한 줄의 진단은 구조 기록으로 먼저 내보내고(resume 마다 하나씩) 끝나면 이어서 다음 묶음을 보낸다 — 같은 where 는 한 번만', () => {
    const items = Array.from({ length: 10 }, (_, i) => item(i + 1, `2026-10-${String(10 + i).padStart(2, '0')} 10:00:00`));
    const flow = mk();
    const first = toFirstBatch(flow, items);
    flow.takeOutcomes?.();
    const results: ReceiptResult[] = first.jobs.map((j, n) => (n < 3 ? { key: j.key, st: 'net' as const, status: 404, diag: n === 2 ? diag('order', 200) : diag('card', 404) } : OK(j.key)));
    const s1 = flow.next({ type: 'receipts', results });
    expect(s1).toEqual({ type: 'structure', where: 'rcpt-card-s404', host: 'pay.naver.com', path: '/web-api/receipts/card-single', lines: diag('card', 404).lines });
    const s2 = flow.next({ type: 'resume' });
    expect(s2).toMatchObject({ type: 'structure', where: 'rcpt-order-s200', path: '/web-api/receipts/:n' });
    const after = flow.next({ type: 'resume' });
    expect(after).toMatchObject({ kind: 'receipts' });
    // 실패한 줄은 다시 보내지 않는다 — 다음 묶음은 아직 안 보낸 두 건
    expect((after as Extract<FlowOut, { kind: 'receipts' }>).jobs.map((j) => j.orderNo)).toEqual([orderNo(2), orderNo(1)]);
  });

  it('로그인이 풀린 묶음에 진단이 있어도 구조 기록 뒤에 로그인을 부탁한다', () => {
    const flow = mk();
    const batch = toFirstBatch(flow);
    const out = flow.next({ type: 'receipts', results: batch.jobs.map((j, n) => (n === 0 ? { key: j.key, st: 'login' as const } : { key: j.key, st: 'net' as const, status: 400, diag: diag('card', 400) })) });
    expect(out).toMatchObject({ type: 'structure', where: 'rcpt-card-s400' });
    expect(flow.next({ type: 'resume' })).toEqual({ type: 'login' });
  });

  it('끝날 때 실패 까닭별 개수를 한 줄(flowf-…)로 남긴다 — 실패가 없으면 남기지 않는다', () => {
    const flow = mk();
    const batch = toFirstBatch(flow);
    const wheres: string[] = [];
    const out = finishOut(flow, flow.next({ type: 'receipts', results: batch.jobs.map((j) => ({ key: j.key, st: 'nopair' as const })) }), wheres);
    expect(out).toMatchObject({ type: 'done' });
    expect(wheres).toEqual(['flowc-t2-k0-x0-f2-q0', 'flowf-no-pair2', 'flown-p0-k0-f0-r0', 'flowd-cap0-nono0', 'flowd-cut0-known0', 'flowd-dup0-cancel0', 'flowd-merged1', 'flowe-all-rows-receipts']);
    const ok = mk();
    const b2 = toFirstBatch(ok);
    const w2: string[] = [];
    finishOut(ok, ok.next({ type: 'receipts', results: b2.jobs.map((j) => OK(j.key)) }), w2);
    expect(w2.some((w) => w.startsWith('flowf-'))).toBe(false);
  });

  it('resume 이 와도 기다리는 구조 기록이 없으면 끝낸다', () => {
    const flow = mk();
    toFirstBatch(flow);
    expect(finishOut(flow, flow.next({ type: 'resume' }))).toMatchObject({ type: 'done' });
  });
});

describe('네이버페이 내역 읽기 단계(scan)', () => {
  const NP = '20261020NP1673267';
  const lastBatchOut = (flow: ReturnType<typeof mk>): FlowOut => {
    const batch = toFirstBatch(flow);
    return flow.next({ type: 'receipts', results: batch.jobs.map((j) => OK(j.key)) });
  };

  it('영수증 큐가 비면 이미 가져온 주문번호를 건너뛸 목록(skip)과 함께 scan 동작을 한 번 낸다', () => {
    const flow = mk();
    const scan = lastBatchOut(flow);
    expect(scan).toMatchObject({ kind: 'receipts', jobs: [], scan: true });
    expect(Array.isArray((scan as Extract<FlowOut, { kind: 'receipts' }>).skip)).toBe(true);
  });

  it('np 결과는 결제 번호를 주문번호로 한 완성 주문이 되고, 취소 · 실패는 세어 끝에 flown 줄로 남긴다', () => {
    const flow = mk();
    lastBatchOut(flow);
    const wheres: string[] = [];
    const out = finishOut(flow, flow.next({ type: 'receipts', results: [
      { key: 'np:scan', st: 'none', found: 3 },
      { key: `np:${NP}`, st: 'ok', slip: slip({ approvalNo: '777' }) },
      { key: 'np:20261021NP1111111111', st: 'ok', slip: slip({ cancelAt: '2026-10-22T00:00:00' }) },
      { key: 'np:20261022NP2222222222', st: 'net', status: 404 },
    ] }), wheres);
    expect(out).toMatchObject({ type: 'done', reason: 'all-rows' });
    const orders = (out as Extract<FlowOut, { type: 'done' }>).orders;
    expect(orders.filter((o) => o.orderNo === NP)).toHaveLength(1);
    expect(orders.find((o) => o.orderNo === NP)).toMatchObject({ kind: 'card', approval: '777', orderedAt: '2026-10-20 10:04:43', amount: 5000 });
    expect(wheres).toContain('flown-p3-k1-f1-r0');
    // 줄별 결과(UI 줄)에는 np 가 섞이지 않는다
    expect((flow.takeOutcomes?.() ?? []).some((e) => e.key.startsWith('np:'))).toBe(false);
  });

  it('한 줄 다시(onlyKeys)에는 scan 을 하지 않고 바로 끝낸다', () => {
    const k1 = keyOf(1, '2026-10-20 10:04:43');
    const flow = mk({ onlyKeys: [k1] });
    const batch = toFirstBatch(flow);
    expect(finishOut(flow, flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key)] }))).toMatchObject({ type: 'done', reason: 'all-rows' });
  });

  it('scan 의 diag(npscan)는 구조 기록으로 내보낸 뒤 끝낸다', () => {
    const flow = mk();
    lastBatchOut(flow);
    const o1 = flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, diag: { w: 'npscan', status: 200, lines: ['has true', 'pairs 0', 'queued 0'] } }] });
    expect(o1).toEqual({ type: 'structure', where: 'rcpt-npscan-s200', host: 'pay.naver.com', path: '/web-api/receipts/card-single', lines: ['has true', 'pairs 0', 'queued 0'] });
    expect(finishOut(flow, flow.next({ type: 'resume' }))).toMatchObject({ type: 'done' });
  });
});

describe('「영수증 내용 채우기」(refill) — 세부가 빈 카드 줄의 주문만 다시', () => {
  it('뒤 4자리가 같고 날짜가 하루 안인 주문만, 이미 받은 줄이어도 보낸다 · 목록 줄은 다시 올리지 않고 네이버페이 읽기도 없다', () => {
    const flow = mk({ refill: [`${orderNo(1).slice(-4)}|2026-10-21`] });
    const batch = toFirstBatch(flow, LIST, { orderNos: [orderNo(1)] });
    expect(batch.jobs.map((j) => j.orderNo)).toEqual([orderNo(1)]);
    expect(flow.take()).toEqual([]);
    const end = finishOut(flow, flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key)] }));
    expect(end).toMatchObject({ type: 'done', reason: 'all-rows' });
  });
  it('날짜가 이틀 넘게 다르면 잇지 않는다', () => {
    const flow = mk({ refill: [`${orderNo(1).slice(-4)}|2026-10-23`] });
    expect(toPayGoto(flow)).toMatchObject({ type: 'probe' });
  });
});

describe('간편결제 · 외부몰 네이버페이(pinfo) — orders.pay.naver.com 출처에서 payment/detail/info 로 tid(11-02 대표님 확인 길, 전부 HTTP)', () => {
  const PID = '20261026NP1234567890';
  const TIDI = '20261026333333333333';
  const at = Date.parse('2026-10-26T09:30:00+09:00');
  it('내역 읽기 뒤 주문 상태 화면(출처 확보 · 한 번)으로 옮겨 pinfo 묶음을 보내고, tid 를 받으면 pay.naver.com 으로 돌아와 svcInfType=PD 형식으로 부른다', () => {
    const flow = mk({ npv2: true });
    const batch = toFirstBatch(flow, [item(1, '2026-10-20 10:04:43')]);
    flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key)] });
    const go = flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, page: 1, pages: 1, rows: [{ instant: `/instantPay/detail/${PID}?backUrl=x`, paymentId: PID, at, amount: 9900 }] }] });
    expect(go).toEqual({ type: 'goto', url: `https://orders.pay.naver.com/order/status/${orderNo(1)}?returnUrl=${encodeURIComponent('https://pay.naver.com/pc/history')}` });
    const act = flow.next({ type: 'page', url: `orders.pay.naver.com/order/status/${orderNo(1)}`, text: '주문 상세' });
    expect(act).toMatchObject({ kind: 'receipts', jobs: [{ pinfo: true, paymentId: PID }] });
    const key = (act as { jobs: { key: string }[] }).jobs[0].key;
    let step = flow.next({ type: 'receipts', results: [{ key, st: 'pair', tid: TIDI, pos: [], paymentId: PID }] });
    while ('type' in step && step.type === 'structure') step = flow.next({ type: 'resume' });   // rcpt-pinfo 구조 줄 흘려보내기
    expect(step).toEqual({ type: 'goto', url: payHistoryUrl(1) });
    const again = flow.next({ type: 'page', url: 'pay.naver.com/history?page=1', text: '결제내역' });
    expect(again).toMatchObject({ kind: 'receipts', jobs: [{ key, tid: TIDI, paymentId: PID }] });
  });

  it('pinfo 에서 짝을 못 얻으면 그 줄은 짝 못 찾음 — 출처 이동은 한 번뿐', () => {
    const flow = mk({ npv2: true });
    const batch = toFirstBatch(flow, [item(1, '2026-10-20 10:04:43')]);
    flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key)] });
    flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, page: 1, pages: 1, rows: [{ instant: `/instantPay/detail/${PID}`, paymentId: PID, at, amount: 9900 }] }] });
    const act = flow.next({ type: 'page', url: `orders.pay.naver.com/order/status/${orderNo(1)}`, text: '주문 상세' });
    const key = (act as { jobs: { key: string }[] }).jobs[0].key;
    const back = flow.next({ type: 'receipts', results: [{ key, st: 'nopair', status: 200 }] });
    expect(back).toEqual({ type: 'goto', url: payHistoryUrl(1) });
    const end = finishOut(flow, flow.next({ type: 'page', url: 'pay.naver.com/history?page=1', text: '결제내역' }));
    expect(end).toMatchObject({ type: 'done' });
    expect((flow.takeOutcomes?.() ?? []).filter((o) => o.key === key).pop()?.outcome).toEqual({ state: 'failed', code: 'no-pair', info: { stage: 'request', via: 'fetch', path: '/orderApi/payment/detail/info', http: 200, words: 'pinfo-no-pair' } });
  });

  it('카드영수증이 없는 주문은 orders 출처에서 주문상세(osheet)를 한 번 부른다 — 거기서도 없으면 예전처럼 「영수증 없음」', () => {
    const flow = mk();
    const batch = toFirstBatch(flow, [item(2, '2026-10-25 12:00:00')]);
    const scan = flow.next({ type: 'receipts', results: [{ key: batch.jobs[0].key, st: 'none', status: 200 }] });
    expect(scan).toMatchObject({ kind: 'receipts', scan: true });
    const out = flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0 }] });
    expect(out).toEqual({ type: 'goto', url: `https://orders.pay.naver.com/order/status/${orderNo(2)}?returnUrl=${encodeURIComponent('https://pay.naver.com/pc/history')}` });
    const act = flow.next({ type: 'page', url: `orders.pay.naver.com/order/status/${orderNo(2)}`, text: '주문 상세' });
    expect(act).toMatchObject({ kind: 'receipts', jobs: [{ key: batch.jobs[0].key, orderNo: orderNo(2), osheet: true }] });
    expect(finishOut(flow, act)).toMatchObject({ type: 'done' });
    const outs = flow.takeOutcomes?.() ?? [];
    // 화면에는 「영수증 없음」 그대로, 서버 실패 기록에는 어느 길에서 왜 없음이 됐는지(1.1.1 — 대표님 11-04 「뭐가 문제인지 알 수가 없으니」)
    expect(outs.filter((o) => o.key === batch.jobs[0].key).pop()?.outcome).toMatchObject({ state: 'none', info: { path: '/orderApi/orderSheet/detail', words: expect.stringMatching(/^osheet-/) } });
  });

  it('주문상세가 비카드 결제(머니 · 포인트)를 읽으면 구매영수증(kind purchase)으로 올린다 — 금액 · 시각은 목록 값', () => {
    const flow = mk();
    const batch = toFirstBatch(flow, [item(2, '2026-10-25 12:00:00')]);
    const k = batch.jobs[0].key;
    const out = finishOut(flow, flow.next({ type: 'receipts', results: [{ key: k, st: 'none', status: 200 }] }), [],
      (key) => ({ key, st: 'ok', slip: { orderSheet: true, amount: 3999, tradeType: '네이버페이 머니·포인트', productName: '주문 상품', sellerName: '스토어' } }));
    expect(out).toMatchObject({ type: 'done' });
    const done = (out as Extract<FlowOut, { type: 'done' }>).orders.filter((o) => o.kind !== 'list');
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ orderNo: orderNo(2), kind: 'purchase', payment: '네이버페이 머니·포인트', amount: 2000, orderedAt: '2026-10-25 12:00:00', seller: '스토어', title: '주문 상품' });
    expect((flow.takeOutcomes?.() ?? []).filter((o) => o.key === k).pop()?.outcome).toEqual({ state: 'done' });
  });

  it('orders 출처에서 끝나기 전에 흐름이 멈춰도(시간 초과) 주문상세를 기다리던 줄은 「영수증 없음」으로 남는다', () => {
    const flow = mk();
    const batch = toFirstBatch(flow, [item(2, '2026-10-25 12:00:00')]);
    const k = batch.jobs[0].key;
    flow.next({ type: 'receipts', results: [{ key: k, st: 'none', status: 200 }] });   // → 내역 읽기
    let out = flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0 }] });
    expect(out).toMatchObject({ type: 'goto' });
    // orders 화면이 계속 안 뜬다 — 시간 초과를 거듭해 끝낸다
    for (let i = 0; i < 20 && !('type' in out && out.type === 'done'); i++) out = 'type' in out && out.type === 'probe' ? flow.next({ type: 'resume' }) : flow.next({ type: 'timeout' });
    expect(out).toMatchObject({ type: 'done' });
    expect((flow.takeOutcomes?.() ?? []).filter((o) => o.key === k).pop()?.outcome).toMatchObject({ state: 'none', info: { path: '/orderApi/orderSheet/detail', words: expect.stringMatching(/^osheet-/) } });
  });

  it('주문상세에서 취소 · 카드로 판단되면(none) 완성본은 올리지 않고 목록 행을 none 으로 바꾸는 행만 간다 · 같은 줄은 주문상세를 한 번만 부른다', () => {
    const flow = mk();
    const batch = toFirstBatch(flow, [item(2, '2026-10-25 12:00:00')]);
    let calls = 0;
    const out = finishOut(flow, flow.next({ type: 'receipts', results: [{ key: batch.jobs[0].key, st: 'none', status: 200 }] }), [], (key) => { calls++; return { key, st: 'none' }; });
    expect(out).toMatchObject({ type: 'done' });
    const rest = (out as Extract<FlowOut, { type: 'done' }>).orders.filter((o) => o.kind !== 'list');
    expect(rest.map((o) => [o.orderNo, o.kind, o.listKey])).toEqual([[orderNo(2), 'none', '2026-10-25 12:00|2000']]);
    expect(rest[0]).not.toHaveProperty('detail');
    expect(calls).toBe(1);
  });
});

describe('네이버페이 내역 줄 → 작업(대표님 15:36 ⓑ)', () => {
  const PAYID = '20261020987654321098';
  it('쇼핑 목록에 없고 서버에도 없는 줄만 작업으로 — payId 를 싣고, 목록 키는 내역 시각 · 금액', () => {
    const flow = mk();
    const batch = toFirstBatch(flow, [item(1, '2026-10-20 10:04:43')]);
    flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key)] });
    const at = Date.parse('2026-10-26T09:30:00+09:00');
    const next = flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, rows: [
      { orderNo: orderNo(1), at, amount: 1000 },                                   // 쇼핑 목록에 있던 주문 — 건너뜀
      { orderNo: '2026102600000077', at, amount: 4500, payId: PAYID, productOrderNo: '2026102600000088' },
      { orderNo: '2026102600000099' },                                            // 시각 · 금액 없음 — 그래도 받는다
    ] }] });
    expect(next).toMatchObject({ kind: 'receipts', jobs: [{ orderNo: '2026102600000077', payId: PAYID, productOrderNo: 'PD2026102600000088' }, { orderNo: '2026102600000099' }] });
  });
});

describe('한 번에 많이 올린다(11-02 대표님 「한 번에 160건」)', () => {
  it('내역 줄 300개가 모두 작업이 된다 — 한 번 누르면 읽은 만큼(최대 maxOrders) 올라가고, 서버가 주문 받는 50건 묶음은 올리는 쪽이 나눠 보낸다', () => {
    const flow = mk();
    const batch = toFirstBatch(flow, [item(1, '2026-10-20 10:04:43')]);
    flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key)] });
    const at = Date.parse('2026-10-26T09:30:00+09:00');
    const rows = Array.from({ length: 300 }, (_, i) => ({ orderNo: '20261026' + String(10000000 + i), at: at - i * 60_000, amount: 1000 + i }));
    const next = flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, rows }] });
    expect(next).toMatchObject({ kind: 'receipts' });
    expect(flow.progress().total).toBe(300 + 1);
  });

  it('현금영수증으로 읽은 영수증은 구매 영수증(purchase) 종류 · 결제 수단 「현금영수증」 으로 올라간다 — 카드로 적지 않는다', () => {
    const flow = mk();
    const batch = toFirstBatch(flow, [item(1, '2026-10-20 10:04:43')]);
    const out = finishOut(flow, flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key, { tradeType: '현금영수증', approvalNo: '98765432' })] }));
    const orders = (out as Extract<FlowOut, { type: 'done' }>).orders;
    expect(orders.filter((o) => o.kind !== 'list')[0]).toMatchObject({ orderNo: orderNo(1), kind: 'purchase', payment: '현금영수증', approval: '98765432', amount: 5000 });
  });
});

describe('새 네이버페이 수집 길(npv2, 대표님 10-29 16:07~16:09)', () => {
  const at = Date.parse('2026-10-26T09:30:00+09:00');
  it('내역 마지막 쪽(totalPage)까지 원문 주소 page=<n> 로 넘겨 읽는다 — npv2 가 아니면 첫 쪽만', () => {
    const flow = mk({ npv2: true });
    const batch = toFirstBatch(flow, [item(1, '2026-10-20 10:04:43')]);
    expect(flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key)] })).toMatchObject({ kind: 'receipts', scan: true, v2: true });
    expect(flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, page: 1, pages: 3 }] })).toEqual({ type: 'goto', url: payHistoryUrl(2) });
    expect(flow.next({ type: 'page', url: 'pay.naver.com/history?page=2', text: '결제내역' })).toMatchObject({ kind: 'receipts', scan: true });
    expect(flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, page: 2, pages: 3 }] })).toEqual({ type: 'goto', url: payHistoryUrl(3) });
    flow.next({ type: 'page', url: 'pay.naver.com/history?page=3', text: '결제내역' });
    expect(finishOut(flow, flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, page: 3, pages: 3 }] }))).toMatchObject({ type: 'done' });

    const old = mk();
    const b2 = toFirstBatch(old, [item(1, '2026-10-20 10:04:43')]);
    old.next({ type: 'receipts', results: [OK(b2.jobs[0].key)] });
    expect(finishOut(old, old.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, page: 1, pages: 3 }] }))).toMatchObject({ type: 'done' });
  });

  it('버튼 영수증 주소의 짝만 있는 결제(주문번호 없음)는 그 짝으로 card-single 을 바로 부른다', () => {
    const flow = mk({ npv2: true });
    const batch = toFirstBatch(flow, [item(1, '2026-10-20 10:04:43')]);
    flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key)] });
    const TID = '20261026111111111111';
    const next = flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, rows: [{ tid: TID, paymentId: '20261026NP1234567890', at, amount: 4500 }] }] });
    expect(next).toMatchObject({ kind: 'receipts', jobs: [{ orderNo: TID, tid: TID, paymentId: '20261026NP1234567890' }] });
  });

  it('개별 가져오기: 쇼핑 목록에 없는 줄은 내역 줄의 날짜(분) · 금액으로 찾아 그 한 건만 — 끝까지 못 찾으면 「내역에서 못 찾음」', () => {
    const key = outcomeKey('L-43-abcd', '2026-10-26 09:30', 4500);
    const flow = mk({ npv2: true, onlyKeys: [key] });
    // 쇼핑 목록에는 없다 → 내역 첫 쪽으로
    expect(toPayGoto(flow, [item(1, '2026-10-20 10:04:43')])).toEqual({ type: 'goto', url: payHistoryUrl(1) });
    expect(flow.next({ type: 'page', url: 'pay.naver.com/history?page=1', text: '결제내역' })).toMatchObject({ kind: 'receipts', scan: true });
    const next = flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, page: 1, pages: 1, rows: [
      { orderNo: '2026102600000055', at: Date.parse('2026-10-25T09:30:00+09:00'), amount: 4500 },   // 날짜 다름
      { orderNo: '2026102600000077', at, amount: 4500, payId: '20261026987654321098' },
    ] }] });
    expect(next).toMatchObject({ kind: 'receipts', jobs: [{ key, orderNo: '2026102600000077', payId: '20261026987654321098' }] });

    const miss = mk({ npv2: true, onlyKeys: [key] });
    toPayGoto(miss, [item(1, '2026-10-20 10:04:43')]);
    miss.next({ type: 'page', url: 'pay.naver.com/history?page=1', text: '결제내역' });
    finishOut(miss, miss.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, page: 1, pages: 1, rows: [] }] }));
    expect((miss.takeOutcomes?.() ?? []).filter((o) => o.key === key).pop()?.outcome).toEqual({ state: 'failed', code: 'not-in-history' });
  });
});

describe('간편결제 줄 → orders 출처에서 payment/detail/info 로 tid(HTTP) → 원문 A형 card-single (npv2)', () => {
  const PID = '20261026NP1234567890';
  const at = Date.parse('2026-10-26T09:30:00+09:00');
  it('내역 읽기 뒤 orders 출처로 한 번 옮겨 tid 를 받고, pay.naver.com 으로 돌아와 svcInfType=PD 형식으로 부른다', () => {
    const flow = mk({ npv2: true });
    const batch = toFirstBatch(flow, [item(1, '2026-10-20 10:04:43')]);
    flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key)] });
    const go = flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, page: 1, pages: 1, rows: [{ instant: `/instantPay/detail/${PID}?backUrl=x`, paymentId: PID, at, amount: 9900 }] }] });
    expect(go).toEqual({ type: 'goto', url: `https://orders.pay.naver.com/order/status/${orderNo(1)}?returnUrl=${encodeURIComponent('https://pay.naver.com/pc/history')}` });
    const act = flow.next({ type: 'page', url: `orders.pay.naver.com/order/status/${orderNo(1)}`, text: '주문 상세' });
    expect(act).toMatchObject({ kind: 'receipts', jobs: [{ pinfo: true, paymentId: PID }] });
    const key = (act as { jobs: { key: string }[] }).jobs[0].key;
    let step = flow.next({ type: 'receipts', results: [{ key, st: 'pair', tid: '20261026333333333333', pos: [], paymentId: PID }] });
    while ('type' in step && step.type === 'structure') step = flow.next({ type: 'resume' });   // rcpt-pinfo 구조 줄 흘려보내기
    expect(step).toEqual({ type: 'goto', url: payHistoryUrl(1) });
    const again = flow.next({ type: 'page', url: 'pay.naver.com/history?page=1', text: '결제내역' });
    expect(again).toMatchObject({ kind: 'receipts', jobs: [{ key, tid: '20261026333333333333', paymentId: PID }] });
  });
  it('간편결제 짝을 HTTP 로 얻으면 구조 기록 줄 rcpt-pinfo-s200(via http)이 남는다', () => {
    const f2 = mk({ npv2: true });
    const b3 = toFirstBatch(f2, [item(1, '2026-10-20 10:04:43')]);
    f2.next({ type: 'receipts', results: [OK(b3.jobs[0].key)] });
    f2.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, page: 1, pages: 1, rows: [{ instant: `/instantPay/detail/${PID}?backUrl=x`, paymentId: PID, at, amount: 9900 }] }] });
    const act2 = f2.next({ type: 'page', url: `orders.pay.naver.com/order/status/${orderNo(1)}`, text: '주문 상세' });
    const key2 = (act2 as { jobs: { key: string }[] }).jobs[0].key;
    const out = f2.next({ type: 'receipts', results: [{ key: key2, st: 'pair', tid: '20261026333333333333', pos: [], paymentId: PID }] });
    expect(out).toMatchObject({ type: 'structure', where: 'rcpt-pinfo-s200' });
  });
  it('전체: 서버에 이미 받은 줄뿐인 쪽에서만 넘기기를 멈춘다(실패 · 목록 줄은 다음에도 다시)', () => {
    const flow = mk({ npv2: true });
    const batch = toFirstBatch(flow, [item(1, '2026-10-20 10:04:43')]);
    flow.next({ type: 'receipts', results: [OK(batch.jobs[0].key)] });
    // 쇼핑 목록에서 이번에 본 주문(아직 서버에 받은 줄 아님)만 있는 쪽은 멈추지 않는다
    expect(flow.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, page: 1, pages: 9, rows: [{ orderNo: orderNo(1), at, amount: 1000 }] }] })).toEqual({ type: 'goto', url: payHistoryUrl(2) });
    // 서버에 이미 받은 줄뿐인 쪽에서는 멈춘다
    const k2 = mk({ npv2: true });
    const b2 = toFirstBatch(k2, [item(1, '2026-10-20 10:04:43')], { orderNos: ['2026102699999999'] });
    k2.next({ type: 'receipts', results: [OK(b2.jobs[0].key)] });
    const end = finishOut(k2, k2.next({ type: 'receipts', results: [{ key: 'np:scan', st: 'none', found: 0, page: 1, pages: 9, rows: [{ orderNo: '2026102699999999', at, amount: 1000 }] }] }));
    expect(end).toMatchObject({ type: 'done' });
  });
});
