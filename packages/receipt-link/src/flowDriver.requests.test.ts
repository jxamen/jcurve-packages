/**
 * 구동기의 요청 동작 경로 시험 — receipts(네이버 영수증 요청) · fetch(범용 요청) 응답 정리, 요청 호스트 거절, 줄 결과(onOutcome) 전달,
 * 중단 시 진행 중 요청 끊기, 응답 키 구조(structure) 전달. 값은 모두 가짜.
 */
import { describe, expect, it } from 'vitest';
import { createFlowDriver, type DriverResult, type FlowHost } from './flowDriver';
import type { FlowFactoryOptions, ReceiptFlow } from './flows';
import type { FlowEvent, FlowOut, FlowStats } from './naverReceipt';
import { pageShape } from './naverReceipt';
import { ABORT_RECEIPTS_SCRIPT } from './naverReceiptsScript';
import { ABORT_FETCH_SCRIPT } from './siteFetch';
import type { OutcomeEvent } from './runOutcome';

const T0 = Date.UTC(2026, 9, 29, 1, 0, 0);
const STATS: FlowStats = { rejected: 0, probes: 0, duplicates: 0 };
const ORDER = '2026102012345678';
const RECEIPTS: FlowOut = { kind: 'receipts', jobs: [{ key: 'k1', orderNo: ORDER }], conc: 2, staggerMs: 0, gapMs: 0, timeoutMs: 1000, deadlineMs: 2000 };
const fetchOut = (url: string): FlowOut => ({ kind: 'fetch', reqs: [{ key: 'q1', method: 'GET', url, as: 'json' }], conc: 1, staggerMs: 0, gapMs: 0, timeoutMs: 1000, deadlineMs: 2000 });
// 주문이 하나도 없이 끝나면 구동기가 마지막 화면 구조를 읽으려고 한 번 더 기다리니, 시험의 done 에는 주문 한 건을 담는다
const ONE = { orderNo: ORDER, orderedAt: '2026-10-20 10:04:43', amount: 5000, payment: '카드', kind: 'card' } as const;
const done = (reason = 'all-rows'): FlowOut => ({ type: 'done', reason, orders: [ONE], stats: STATS });

type Fake = { host: FlowHost; gotos: string[]; injected: string[]; structures: unknown[][]; results: DriverResult[]; clock: { t: number } };
function fake(): Fake {
  const clock = { t: T0 };
  const f: Fake = {
    clock, gotos: [], injected: [], structures: [], results: [],
    host: {
      goto: (u) => { f.gotos.push(u); },
      back: () => undefined,
      inject: (s) => { f.injected.push(s); },
      probe: () => undefined,
      structure: (...a) => { f.structures.push(a); },
      now: () => clock.t,
    },
  };
  return f;
}

/** 이벤트마다 responders 를 차례로 쓰는 흐름. outcomes 는 단계마다 takeOutcomes 로 한 번씩 비운다 */
function scripted(responders: ((ev: FlowEvent) => FlowOut)[], seen: FlowEvent[] = [], outcomes: OutcomeEvent[][] = []) {
  return (_o?: FlowFactoryOptions): ReceiptFlow => {
    let i = 0;
    let final: FlowOut | null = null;
    return {
      next: (ev) => {
        if (final) return final;
        seen.push(ev);
        const out = responders[Math.min(i, responders.length - 1)](ev);
        i++;
        if ('type' in out && out.type === 'done') final = out;
        return out;
      },
      takeOutcomes: () => outcomes[Math.min(i - 1, outcomes.length - 1)] ?? [],
      progress: () => ({ phase: 'x', done: i, total: 3, orders: 0 }),
    };
  };
}

const make = (f: Fake, factory: (o?: FlowFactoryOptions) => ReceiptFlow, site: 'naver' | 'kurly' = 'naver', onOutcome?: (e: OutcomeEvent) => void) =>
  createFlowDriver({ site, factory, host: f.host, onDone: (r) => f.results.push(r), onOutcome });

describe('receipts 응답 정리', () => {
  it('receipts 동작을 내면 스크립트를 넣고, 답(step receipts)의 허용 필드만 흐름에 넘긴다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const d = make(f, scripted([() => RECEIPTS, () => done()], seen));
    d.start();
    expect(f.injected).toHaveLength(1);
    expect(f.injected[0]).toContain("step: 'receipts'");
    d.onMessage({
      type: 'nav', step: 'receipts', results: [
        { key: 'k1', st: 'ok', slip: { approvalNo: '111', cardCompany: '삼성카드', approvalAt: '2026-10-20T10:04:43', sellerName: '가짜상점', businessNo: '123-45-67890', amount: 5000, cardNo: '1234-****', representative: '홍길동' } },
        { key: 'k2', st: 'nope' },
        { st: 'ok' },
        'x',
      ],
    });
    const ev = seen.find((e) => e.type === 'receipts') as Extract<FlowEvent, { type: 'receipts' }>;
    expect(ev.results).toHaveLength(1);
    expect(ev.results[0].slip).toEqual({
      approvalNo: '111', cardCompany: '삼성카드', approvalAt: '2026-10-20T10:04:43', cancelAt: undefined, productName: undefined, sellerName: '가짜상점', businessNo: '123-45-67890', amount: 5000, cancelAmount: undefined,
      // 대표님 14:26 「원문 칸 전부」 — 카드번호는 사이트가 가린 값 그대로 싣는다
      cardNo: '1234-****',
    });
    // 허용 목록 밖 이름(representative — 스크립트는 sellerRepresentative 로 낸다)은 버린다
    expect(JSON.stringify(ev)).not.toContain('홍길동');
  });

  it('영수증 답의 status · diag(실패 진단)는 모양이 맞는 것만 흐름에 넘긴다 — 단계 이름 · HTTP 번호 · 줄 수 · 줄 길이 상한', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const d = make(f, scripted([() => RECEIPTS, () => done()], seen));
    d.start();
    const longLine = 'x'.repeat(201);
    d.onMessage({
      type: 'nav', step: 'receipts', results: [
        { key: 'k1', st: 'net', status: 404, diag: { w: 'card', status: 404, lines: ['fmt payId : n20', longLine, 7, ''] } },
        { key: 'k2', st: 'net', status: 1000, diag: { w: 'bad w!', status: 3, lines: ['a'] } },
        { key: 'k3', st: 'nopair', diag: { w: 'pair', status: 'x', lines: ['have payId true'] } },
        { key: 'k4', st: 'net', diag: { w: 'card', status: 500, lines: [] } },
      ],
    });
    const ev = seen.find((e) => e.type === 'receipts') as Extract<FlowEvent, { type: 'receipts' }>;
    expect(ev.results[0]).toEqual({ key: 'k1', st: 'net', status: 404, diag: { w: 'card', status: 404, lines: ['fmt payId : n20'] } });
    expect(ev.results[1]).toEqual({ key: 'k2', st: 'net' });
    expect(ev.results[2]).toEqual({ key: 'k3', st: 'nopair', diag: { w: 'pair', status: 0, lines: ['have payId true'] } });
    expect(ev.results[3]).toEqual({ key: 'k4', st: 'net' });
  });

  it('기다리지 않는 답(다른 단계의 메시지)은 무시한다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const d = make(f, scripted([() => RECEIPTS, () => done()], seen));
    d.start();
    d.onMessage({ type: 'nav', step: 'fetched', results: [{ key: 'q', st: 'ok' }] });
    d.onMessage({ type: 'nav', step: 'api', name: 'shop', items: [], page: 1, done: true });
    expect(seen.map((e) => e.type)).toEqual(['start']);
  });
});

describe('fetch 요청 동작', () => {
  it('흐름이 열어도 되는 호스트의 https 주소나 현재 페이지 기준 경로만 부른다 — 그 밖은 요청 없이 끝낸다(fetch-refused)', () => {
    const f1 = fake();
    make(f1, scripted([() => fetchOut('https://evil.example.com/x'), () => done()]), 'kurly').start();
    expect(f1.injected.some((x) => x.includes("step: 'fetched'"))).toBe(false);
    expect(f1.results[0].reason).toBe('fetch-refused');

    const f2 = fake();
    make(f2, scripted([() => fetchOut('https://api.kurly.com/order-external/v4/mypage/orders'), () => done()]), 'kurly').start();
    expect(f2.injected).toHaveLength(1);
    expect(f2.injected[0]).toContain("step: 'fetched'");

    const f3 = fake();
    make(f3, scripted([() => fetchOut('/mps/receipt/1?x=1'), () => done()]), 'kurly').start();
    expect(f3.injected).toHaveLength(1);
  });

  it('답(step fetched)은 상태 · 번호 · 줄인 JSON · 글자(12만 자까지)만 흐름에 넘기고, 모르는 상태는 버린다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const d = make(f, scripted([() => fetchOut('/x'), () => done()], seen), 'kurly');
    d.start();
    const long = 'a'.repeat(130_000);
    d.onMessage({ type: 'nav', step: 'fetched', results: [
      { key: 'q1', st: 'ok', status: 200, data: { a: 1 }, text: long, extra: 'x' },
      { key: 'q2', st: 'bad' },
      { key: 'q3', st: 'http', status: 500 },
    ] });
    const ev = seen.find((e) => e.type === 'fetched') as Extract<FlowEvent, { type: 'fetched' }>;
    expect(ev.results.map((r) => [r.key, r.st, r.status])).toEqual([['q1', 'ok', 200], ['q3', 'http', 500]]);
    expect(ev.results[0].data).toEqual({ a: 1 });
    expect(ev.results[0].text).toHaveLength(120_000);
    expect(Object.keys(ev.results[0])).not.toContain('extra');
  });
});

describe('줄 결과 · 구조 · 중단', () => {
  it('흐름이 낸 줄 결과(takeOutcomes)를 onOutcome 으로 순서대로 넘기고, 받는 쪽 오류는 읽기를 막지 않는다', () => {
    const f = fake();
    const got: OutcomeEvent[] = [];
    const outs: OutcomeEvent[][] = [[{ key: 'a', outcome: { state: 'fetching' } }], [{ key: 'a', outcome: { state: 'done' } }, { key: 'b', outcome: { state: 'none' } }]];
    const d = make(f, scripted([() => RECEIPTS, () => done()], [], outs), 'naver', (e) => { got.push(e); if (e.key === 'a' && e.outcome.state === 'done') throw new Error('boom'); });
    d.start();
    d.onMessage({ type: 'nav', step: 'receipts', results: [{ key: 'k1', st: 'none' }] });
    expect(got.map((e) => `${e.key}:${e.outcome.state}`)).toEqual(['a:fetching', 'a:done', 'b:none']);
    expect(f.results).toHaveLength(1);
  });

  it('structure 출력은 host.structure 로 보내고 이어서 흐름을 계속한다(resume)', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const lines = ['orders : array3', 'orders[0].orderId : number'];
    const d = make(f, scripted([() => ({ type: 'structure', where: 'kurly-list', host: 'api.kurly.com', path: '/order-external/v4/mypage/orders', lines }), () => done()], seen), 'kurly');
    d.start();
    expect(f.structures).toEqual([['kurly-list', 'api.kurly.com', '/order-external/v4/mypage/orders', lines]]);
    expect(seen.map((e) => e.type)).toEqual(['start', 'resume']);
    expect(f.results).toHaveLength(1);
  });

  it('host.structure 가 없거나 던져도 읽기는 이어진다', () => {
    const f = fake();
    f.host.structure = () => { throw new Error('x'); };
    const d = make(f, scripted([() => ({ type: 'structure', where: 'w', host: 'h', path: '/', lines: [] }), () => done()]), 'kurly');
    d.start();
    expect(f.results).toHaveLength(1);
    const g = fake();
    delete (g.host as { structure?: unknown }).structure;
    make(g, scripted([() => ({ type: 'structure', where: 'w', host: 'h', path: '/', lines: [] }), () => done()]), 'kurly').start();
    expect(g.results).toHaveLength(1);
  });

  it('중단(stop) — 영수증 요청을 기다리는 중이면 진행 중 요청을 끊는 스크립트를 넣고, 그 뒤 온 답은 버린다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const d = make(f, scripted([() => RECEIPTS, () => done()], seen));
    d.start();
    d.stop();
    expect(f.injected.at(-1)).toBe(ABORT_RECEIPTS_SCRIPT);
    d.onMessage({ type: 'nav', step: 'receipts', results: [{ key: 'k1', st: 'none' }] });
    expect(seen.map((e) => e.type)).toEqual(['start']);
    expect(f.results).toHaveLength(0);
  });

  it('중단(stop) — 범용 요청을 기다리는 중이면 그 요청을 끊는 스크립트를 넣는다. 기다리는 게 없으면 아무것도 넣지 않는다', () => {
    const f = fake();
    const d = make(f, scripted([() => fetchOut('/x'), () => done()]), 'kurly');
    d.start();
    d.stop();
    expect(f.injected.at(-1)).toBe(ABORT_FETCH_SCRIPT);
    const g = fake();
    const e = make(g, scripted([() => ({ type: 'goto', url: 'https://www.kurly.com/mypage/order' }), () => done()]), 'kurly');
    e.start();
    const before = g.injected.length;
    e.stop();
    expect(g.injected.length).toBe(before);
  });

  it('pageShape 가 필요한 probe 는 그대로 동작한다(회귀)', () => {
    const f = fake();
    const probes: string[] = [];
    f.host.probe = (_s, w) => { probes.push(w); };
    const d = make(f, scripted([() => ({ type: 'probe', where: 'w1', shape: pageShape('a.test/x', 't') }), () => done()]));
    d.start();
    expect(probes).toEqual(['w1']);
  });
});
