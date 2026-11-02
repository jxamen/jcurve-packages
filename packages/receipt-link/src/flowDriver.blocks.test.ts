import { describe, expect, it, vi } from 'vitest';

// naverReceipt.ts 에 blocks 동작이 들어오기 전이라 navScript 가 그 종류를 거절한다 — 구동기 배선만 고정하려고 blocks 동작의 스크립트를 대신 만든다
vi.mock('./naverReceipt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./naverReceipt')>();
  return { ...actual, navScript: (a: { kind: string }) => (a.kind === 'blocks' ? '/*blocks-script*/' : a.kind === 'api' ? '/*api-script*/' : actual.navScript(a as never)) };
});

import { createFlowDriver, type FlowHost } from './flowDriver';
import type { FlowFactoryOptions, ReceiptFlow } from './flows';
import type { FlowEvent, FlowOut } from './naverReceipt';

function setup(responders: ((ev: FlowEvent) => FlowOut)[], site: 'naver' | 'coupang' | 'kurly' | 'musinsa' = 'kurly') {
  const seen: FlowEvent[] = [];
  const injected: string[] = [];
  const host: FlowHost = { goto: () => undefined, back: () => undefined, inject: (s) => { injected.push(s); }, probe: () => undefined, now: () => 1_000_000 };
  const factory = (_o?: FlowFactoryOptions): ReceiptFlow => {
    let i = 0;
    return {
      next: (ev) => { seen.push(ev); const r = responders[Math.min(i, responders.length - 1)]; i++; return r(ev); },
      progress: () => ({ phase: 'x', done: 0, total: 0, orders: 0 }),
    };
  };
  const results: unknown[] = [];
  const d = createFlowDriver({ site, factory, host, onDone: (r) => results.push(r) });
  return { d, seen, injected, results };
}

const BLOCKS = { kind: 'blocks' } as unknown as FlowOut;

describe('구동기 — blocks 답 배선', () => {
  it('blocks 동작을 낸 뒤 온 {step:"blocks"} 메시지를 {type:"blocks", texts} 이벤트로 흐름에 먹인다(네이버 · 문자열만 · 너무 긴 덩이는 버림)', () => {
    const { d, seen, injected } = setup([() => BLOCKS, () => ({ kind: 'read' })]);
    d.start();
    expect(injected).toEqual(['/*blocks-script*/']);
    d.onMessage({ type: 'nav', step: 'blocks', blocks: ['첫째 덩이', 7, null, 'x'.repeat(30_000), '둘째'] });
    expect(seen[1]).toEqual({ type: 'blocks', texts: ['첫째 덩이', '둘째'] });
    expect(injected).toHaveLength(2);
  });

  it('쿠팡은 page 를 대신하는 {type:"blocks", url, blocks} 로 먹이고, url 이 없으면 버린다', () => {
    const { d, seen } = setup([() => BLOCKS, () => ({ kind: 'read' })], 'coupang');
    d.start();
    d.onMessage({ type: 'nav', step: 'blocks', blocks: ['a'] });
    expect(seen).toHaveLength(1);
    d.onMessage({ type: 'nav', step: 'blocks', url: 'mc.coupang.com/ssr/mobile/order/list', blocks: ['2026. 10. 27.\n생수 12,300원', 5] });
    expect(seen[1]).toEqual({ type: 'blocks', url: 'mc.coupang.com/ssr/mobile/order/list', blocks: ['2026. 10. 27.\n생수 12,300원'] });
  });

  it('blocks 를 기다리지 않을 때 온 blocks 메시지는 버린다, 같은 답이 두 번 와도 한 번만 먹인다', () => {
    const { d, seen } = setup([() => ({ kind: 'read' }), () => BLOCKS, () => ({ kind: 'read' })]);
    d.start();
    d.onMessage({ type: 'nav', step: 'blocks', blocks: ['a'] });
    expect(seen).toHaveLength(1);
    d.onMessage({ type: 'nav', step: 'read', url: 'www.kurly.com/mypage/order', text: '주문' });
    expect(seen).toHaveLength(2);
    d.onMessage({ type: 'nav', step: 'blocks', blocks: ['a'] });
    d.onMessage({ type: 'nav', step: 'blocks', blocks: ['b'] });
    expect(seen.map((e) => e.type)).toEqual(['start', 'page', 'blocks']);
  });

  it('blocks 모양이 틀리면 빈 목록으로 먹인다', () => {
    const { d, seen } = setup([() => BLOCKS, () => ({ kind: 'read' })]);
    d.start();
    d.onMessage({ type: 'nav', step: 'blocks', blocks: 'oops' });
    expect(seen[1]).toEqual({ type: 'blocks', texts: [] });
  });
});

describe('구동기 — api 답 배선', () => {
  const API = { kind: 'api' } as unknown as FlowOut;

  it('api 동작의 답 {step:"api"} 를 {type:"api", name, items, page, done} 이벤트로 먹인다', () => {
    const { d, seen } = setup([() => API, () => ({ kind: 'read' })]);
    d.start();
    d.onMessage({ type: 'nav', step: 'api', name: 'shop', items: [{ orderNo: '1' }], page: 3.7, done: true });
    expect(seen[1]).toEqual({ type: 'api', name: 'shop', items: [{ orderNo: '1' }], page: 3, done: true });
  });

  it('실패 답은 failed:true 를 붙이고, 이름이 다르거나 기다리지 않던 답은 버린다', () => {
    const { d, seen } = setup([() => API, () => ({ kind: 'read' })]);
    d.start();
    d.onMessage({ type: 'nav', step: 'api', name: 'other', items: [], page: 0, done: true });
    expect(seen).toHaveLength(1);
    d.onMessage({ type: 'nav', step: 'api', name: 'pay', items: [], page: 0, done: true, failed: true, note: 'no_url' });
    expect(seen[1]).toEqual({ type: 'api', name: 'pay', items: [], page: 0, done: true, failed: true });
    d.onMessage({ type: 'nav', step: 'api', name: 'pay', items: [], page: 0, done: true });
    expect(seen).toHaveLength(2);
  });
});
