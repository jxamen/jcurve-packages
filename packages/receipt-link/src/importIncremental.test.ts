import { describe, expect, it } from 'vitest';
import { createFlowDriver, type DriverResult, type FlowHost } from './flowDriver';
import type { FlowFactoryOptions, ReceiptFlow } from './flows';
import { createUploader, type UploaderSend } from './importUploader';
import { emptyTally, type OrderInput } from './model';
import { type FlowEvent, type FlowOut, type ReceiptOrder } from './naverReceipt';

// 구동기(flowDriver) + 올리기(importUploader)를 화면(OrderImportView)과 같은 배선으로 이어 본다: onOrders → uploader.add, onDone → uploader.finish
const NOW = Date.UTC(2026, 9, 28, 0, 0);
const STATS = { rejected: 0, probes: 0, duplicates: 0 };
const order = (i: number, extra: Record<string, unknown> = {}): ReceiptOrder => ({
  orderNo: 'IN-' + String(100000 + i), orderedAt: '2026-10-27 14:03:22', amount: 1000 + i, payment: '카드', kind: 'card', ...extra,
} as ReceiptOrder);

/** 단계마다 새 주문을 만들고 take 로 비우는 가짜 흐름. done.orders 에는 전부 담는다 */
function takeFlow(steps: { made?: ReceiptOrder[]; out?: FlowOut }[]) {
  return (_o?: FlowFactoryOptions): ReceiptFlow & { take(): ReceiptOrder[] } => {
    let i = 0;
    let pending: ReceiptOrder[] = [];
    const all: ReceiptOrder[] = [];
    return {
      next: (_ev: FlowEvent) => {
        const st = steps[Math.min(i, steps.length - 1)];
        i++;
        for (const o of st.made ?? []) { all.push(o); pending.push(o); }
        return st.out ?? { type: 'done', reason: 'all-rows', orders: all.slice(), stats: STATS };
      },
      take: () => { const r = pending; pending = []; return r; },
      progress: () => ({ phase: 'x', done: i, total: 5, orders: all.length }),
    } as ReceiptFlow & { take(): ReceiptOrder[] };
  };
}

function wire(factory: (o?: FlowFactoryOptions) => ReceiptFlow, send: UploaderSend) {
  const sentCalls: OrderInput[][] = [];
  const wrapped: UploaderSend = async (orders) => { sentCalls.push(orders); return send(orders); };
  const uploader = createUploader({ send: wrapped, nowMs: NOW });
  const results: DriverResult[] = [];
  const host: FlowHost = { goto: () => undefined, back: () => undefined, inject: () => undefined, probe: () => undefined, now: () => NOW };
  const d = createFlowDriver({ site: 'naver', factory, host, onOrders: (l) => uploader.add(l), onDone: (r) => results.push(r) });
  const page = () => d.onMessage({ type: 'nav', step: 'read', url: 'pay.naver.com/history', text: '내역' });
  return { d, uploader, results, sentCalls, page };
}

const okSend: UploaderSend = async (orders) => ({ tally: { ...emptyTally(), new: orders.length }, unreadable: 0 });

describe('읽는 대로 올리기 — 구동기 + 올리기', () => {
  it('페이지마다 새 주문을 바로 올리고, done 에서는 남은 것만 올린다', async () => {
    const w = wire(takeFlow([
      { out: { kind: 'read' } },
      { made: [order(1), order(2)], out: { kind: 'read' } },
      { made: [order(3)], out: { kind: 'read' } },
      { made: [order(4)] },
    ]), okSend);
    w.d.start();
    w.page();
    await w.uploader.flush();
    expect(w.sentCalls.map((c) => c.map((o) => o.orderNo))).toEqual([['IN-100001', 'IN-100002']]);
    w.page();
    await w.uploader.flush();
    expect(w.sentCalls).toHaveLength(2);
    w.page();            // 이 단계에서 done — 마지막 주문 하나
    expect(w.results).toHaveLength(1);
    const sum = await w.uploader.finish();
    expect(w.sentCalls.map((c) => c.map((o) => o.orderNo))).toEqual([['IN-100001', 'IN-100002'], ['IN-100003'], ['IN-100004']]);
    expect(sum.pending).toBe(0);
    expect(sum.result).toMatchObject({ read: 4, sent: 4, added: 4, duplicates: 0, rejected: 0 });
  });

  it('올리기에 실패한 주문은 다음 회차(다음 페이지 · 끝)에 다시 올린다', async () => {
    let fail = true;
    const send: UploaderSend = async (orders) => {
      if (fail) { fail = false; throw Object.assign(new Error('offline'), { status: 500, code: 'http_500' }); }
      return okSend(orders);
    };
    const w = wire(takeFlow([
      { out: { kind: 'read' } },
      { made: [order(1)], out: { kind: 'read' } },
      { made: [order(2)] },
    ]), send);
    w.d.start();
    w.page();
    await w.uploader.flush();
    expect(w.uploader.progress()).toMatchObject({ read: 1, sent: 0, pending: 1, failed: true });
    w.page();            // 두 번째 주문과 함께 앞의 실패한 주문도 다시 올라간다
    const sum = await w.uploader.finish();
    expect(w.sentCalls.map((c) => c.map((o) => o.orderNo))).toEqual([['IN-100001'], ['IN-100001', 'IN-100002']]);
    expect(sum.pending).toBe(0);
    expect(sum.result).toMatchObject({ read: 2, sent: 2, added: 2 });
  });

  it('끝(done)에서 올리기가 계속 실패하면 못 올린 수를 알린다(화면은 「다시 보내기」)', async () => {
    const send: UploaderSend = async () => { throw Object.assign(new Error('offline'), { status: 0, code: 'network' }); };
    const w = wire(takeFlow([{ made: [order(1), order(2)] }]), send);
    w.d.start();
    expect(w.results).toHaveLength(1);
    const sum = await w.uploader.finish();
    expect(sum.pending).toBe(2);
    expect(sum.result.sent).toBe(0);
  });

  it('목록 행(list)을 먼저 올리고 영수증을 읽은 완성본으로 바꿔 올린다 — 서버의 updated 는 성공', async () => {
    const list = { orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list', listKey: '2026-10-27 14:03|900' } as unknown as ReceiptOrder;
    const send: UploaderSend = async (orders) => {
      const t = emptyTally();
      for (const o of orders) t[o.kind === 'list' ? 'new' : 'updated']++;
      return { tally: t, unreadable: 0 };
    };
    const w = wire(takeFlow([
      { out: { kind: 'read' } },
      { made: [list], out: { kind: 'read' } },
      { made: [order(7, { listKey: '2026-10-27 14:03|900', amount: 900 })] },
    ]), send);
    w.d.start();
    w.page();
    await w.uploader.flush();
    expect(w.sentCalls[0]).toEqual([{ orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list', listKey: '2026-10-27 14:03|900' }]);
    w.page();
    const sum = await w.uploader.finish();
    expect(w.sentCalls[1].map((o) => [o.orderNo, o.kind, o.listKey])).toEqual([['IN-100007', 'card', '2026-10-27 14:03|900']]);
    expect(sum.result).toMatchObject({ added: 1, rejected: 0, duplicates: 0 });
    expect(w.uploader.progress().read).toBe(1);
  });

  it('take 가 없는 흐름은 done 에서 한꺼번에 50건씩 올린다', async () => {
    const all = Array.from({ length: 120 }, (_, i) => order(i));
    const factory = (_o?: FlowFactoryOptions): ReceiptFlow => ({
      next: () => ({ type: 'done', reason: 'all-rows', orders: all, stats: STATS }),
      progress: () => ({ phase: 'x', done: 0, total: 0, orders: 0 }),
    });
    const w = wire(factory, okSend);
    w.d.start();
    await w.uploader.finish();
    expect(w.sentCalls.map((c) => c.length).reduce((a, b) => a + b, 0)).toBe(120);
    expect(Math.max(...w.sentCalls.map((c) => c.length))).toBeLessThanOrEqual(50);
  });
});

