import { describe, expect, it } from 'vitest';
import {
  BACK_READ_MS,
  MAX_GOTO_DELAY_MS,
  CLOSING_WAIT_MS,
  createFlowDriver,
  isFlowUrl,
  LOGIN_CAP_MS,
  LOGIN_POLL_MS,
  MAX_TIMEOUTS,
  pageKey,
  READ_SETTLE_MS,
  shapeProbeRaw,
  SITE_CAP_MS,
  WATCHDOG_MS,
  type DriverResult,
  type FlowHost,
} from './flowDriver';
import { NAVER_ISSUE_GOTO_DELAY_MS, type FlowFactoryOptions, type ReceiptFlow } from './flows';
import { pageShape, previewUrl, type FlowEvent, type FlowOut, type FlowStats, type PageShape, type ReceiptOrder } from './naverReceipt';
import { buildPayload } from './probe';

const T0 = Date.UTC(2026, 9, 28, 1, 0, 0);
const STATS: FlowStats = { rejected: 0, probes: 0, duplicates: 0 };
const order = (no: string): ReceiptOrder => ({ orderNo: no, orderedAt: '2026-10-27 14:03:22', amount: 12300, payment: '카드', kind: 'card' });

type Fake = {
  host: FlowHost;
  clock: { t: number };
  gotos: string[];
  backs: number;
  injected: string[];
  probes: { shape: PageShape; where: string }[];
  results: DriverResult[];
  batches: ReceiptOrder[][];
  advance(ms: number): void;
};
function fake(): Fake {
  const clock = { t: T0 };
  const f: Fake = {
    clock, gotos: [], backs: 0, injected: [], probes: [], results: [], batches: [],
    host: {
      goto: (u) => { f.gotos.push(u); },
      back: () => { f.backs++; },
      inject: (s) => { f.injected.push(s); },
      probe: (shape, where) => { f.probes.push({ shape, where }); },
      now: () => clock.t,
    },
    advance: (ms) => { clock.t += ms; },
  };
  return f;
}

/** 대본대로 답하는 흐름 — 이벤트마다 responders 를 차례로 쓴다. 시계는 진짜 흐름처럼 budgetMs 를 넘으면 지금까지의 주문을 done 으로 낸다 */
function scripted(responders: ((ev: FlowEvent) => FlowOut)[], orders: ReceiptOrder[] = [], seen: FlowEvent[] = []) {
  const factory = (opts: FlowFactoryOptions = {}): ReceiptFlow => {
    const now = opts.now ?? (() => Date.now());
    const budgetMs = opts.budgetMs ?? 180000;
    const startedAt = now();
    let i = 0;
    let final: FlowOut | null = null;
    return {
      next: (ev) => {
        if (final) return final;
        seen.push(ev);
        if (now() - startedAt > budgetMs) { final = { type: 'done', reason: 'budget', orders: orders.slice(), stats: STATS }; return final; }
        const r = responders[Math.min(i, responders.length - 1)];
        i++;
        const out = r(ev);
        if ('type' in out && out.type === 'done') final = out;
        return out;
      },
      progress: () => ({ phase: 'x', done: i, total: 10, orders: orders.length }),
    } as ReceiptFlow;
  };
  return factory;
}

const readMsg = (url = 'pay.naver.com/history', text = '결제 내역') => ({ type: 'nav', step: 'read', url, text, signals: {} });
const READ = { kind: 'read' } as const;
const done = (orders: ReceiptOrder[] = [], reason = 'all-rows'): FlowOut => ({ type: 'done', reason, orders, stats: STATS });

function make(f: Fake, factory: (o?: FlowFactoryOptions) => ReceiptFlow, site: 'naver' | 'coupang' | 'kurly' | 'musinsa' = 'naver', options?: FlowFactoryOptions) {
  return createFlowDriver({ site, factory, host: f.host, onDone: (r) => f.results.push(r), onOrders: (o) => f.batches.push(o), options });
}

describe('주소 검사 (isFlowUrl · pageKey)', () => {
  it('https 이고 허용 도메인(하위 포함)만 연다', () => {
    const naver = ['naver.com'];
    expect(isFlowUrl('https://pay.naver.com/history?page=1', naver)).toBe(true);
    expect(isFlowUrl('https://naver.com/', naver)).toBe(true);
    expect(isFlowUrl('http://pay.naver.com/history', naver)).toBe(false);
    expect(isFlowUrl('https://evilnaver.com/', naver)).toBe(false);
    expect(isFlowUrl('https://nid.naver.com.evil.com/', naver)).toBe(false);
    expect(isFlowUrl('https://naver.com@evil.com/', naver)).toBe(false);
    expect(isFlowUrl('https://evil.com/?u=https://pay.naver.com/', naver)).toBe(false);
    expect(isFlowUrl('javascript:alert(1)', naver)).toBe(false);
    expect(isFlowUrl('https://pay.naver.com/a b', naver)).toBe(false);
  });
  it('경로의 로그아웃 · 탈퇴 · 삭제는 거절하지만 쿼리의 cancel=false 는 통과한다(쿠팡 카드영수증)', () => {
    const coupang = ['coupang.com'];
    expect(isFlowUrl('https://payment.coupang.com/v2/card-receipt/view?orderId=1234567890&vendorIds=A1234567&cancel=false', coupang)).toBe(true);
    expect(isFlowUrl('https://www.coupang.com/np/logout', coupang)).toBe(false);
    expect(isFlowUrl('https://www.coupang.com/my/withdraw', coupang)).toBe(false);
  });
  it('전체 주소를 흐름의 page 주소 모양(호스트+경로, 긴 숫자는 #)으로 바꾼다', () => {
    expect(pageKey('https://pay.naver.com/history?page=1#x')).toBe('pay.naver.com/history');
    expect(pageKey('https://shopping.naver.com/my/order/2026102712345678')).toBe('shopping.naver.com/my/order/#');
    expect(pageKey('')).toBe('');
  });
});

describe('구조 요약 → 서버 구조 기록 (shapeProbeRaw)', () => {
  it('개수와 있음/없음만 담고 서버가 받는 글자만 남는다', () => {
    const shape = pageShape('pay.naver.com/history', '주문 2026091195203331 12,300원 로그인');
    const body = buildPayload(shapeProbeRaw(shape, 'no-order-cards'), 'naver');
    expect(body.page.host).toBe('pay.naver.com');
    expect(body.page.path).toBe('/history');
    expect(body.cookie_names).toEqual([]);
    expect(body.requests).toEqual([]);
    expect(body.dom.outline).toContain('where=no-order-cards');
    expect(body.dom.outline).toContain('orderNos=1');
    expect(body.dom.outline).toContain('login=1');
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/\d{7}/);
    expect(text).not.toContain('2026091195203331');
  });
  it('where 의 이상한 글자는 지우고 비면 unknown', () => {
    const shape = pageShape('a.naver.com/x', '');
    expect(shapeProbeRaw(shape, '주문 <b>').outline).toContain('where=b');
    expect(shapeProbeRaw(shape, '가나다').outline).toContain('where=unknown');
  });
});

describe('구동기 — 정상 흐름', () => {
  it('start 에 route 를 싣지 않고(흐름의 기본 경로 — 네이버는 issue), goto → 읽기 → 토큰 → done 까지 간다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const orders = [order('A1'), order('A2')];
    const d = make(f, scripted([
      () => ({ type: 'goto', url: 'https://pay.naver.com/history?page=1' }),
      () => ({ kind: 'tokens', patterns: [{ name: 'pid', source: String.raw`\b\d{8}NP\d{6,14}\b`, group: 0 }] }),
      () => done(orders),
    ], orders, seen));
    d.start();
    expect(seen[0]).toEqual({ type: 'start' });
    expect('route' in (seen[0] as object) && (seen[0] as { route?: unknown }).route !== undefined).toBe(false);
    expect(f.gotos).toEqual(['https://pay.naver.com/history?page=1']);
    // 페이지가 열리면 잠깐 뒤 읽기를 넣는다
    d.onPageChanged('https://pay.naver.com/history?page=1');
    d.tick();
    expect(f.injected).toHaveLength(0);
    f.advance(READ_SETTLE_MS);
    d.tick();
    expect(f.injected).toHaveLength(1);
    expect(f.injected[0]).toContain('"kind":"read"');
    d.onMessage(readMsg());
    expect(seen[1]).toEqual({ type: 'page', url: 'pay.naver.com/history', text: '결제 내역' });
    expect(f.injected).toHaveLength(2);
    expect(f.injected[1]).toContain('"kind":"tokens"');
    d.onMessage({ type: 'nav', step: 'tokens', tokens: ['pid:20261027NP1234567', 7, 'x'.repeat(2000)], hasMore: true });
    expect(seen[2]).toEqual({ type: 'tokens', tokens: ['pid:20261027NP1234567'], hasMore: true });
    expect(f.results).toHaveLength(1);
    expect(f.results[0].orders).toEqual(orders);
    expect(f.results[0].reason).toBe('all-rows');
    expect(d.status().state).toBe('done');
  });

  it('네이버가 아닌 사이트도 route 없이 start 한다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    make(f, scripted([() => ({ type: 'goto', url: 'https://mc.coupang.com/ssr/mobile/order/list' })], [], seen), 'coupang').start();
    expect(seen[0]).toEqual({ type: 'start', route: undefined });
    expect(f.gotos).toEqual(['https://mc.coupang.com/ssr/mobile/order/list']);
  });

  it('click 동작은 clicked 답을 기다린다 — 읽기 답은 무시하고 clicked 만 흐름에 먹인다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const d = make(f, scripted([
      () => ({ kind: 'clickNth', labels: ['카드영수증'], index: 2 }),
      () => READ,
      () => done([order('B1')]),
    ], [order('B1')], seen));
    d.start();
    expect(f.injected[0]).toContain('"kind":"clickNth"');
    d.onMessage(readMsg());
    expect(seen).toHaveLength(1);
    d.onMessage({ type: 'nav', step: 'clicked', ok: true });
    expect(seen[1]).toEqual({ type: 'clicked', ok: true });
    expect(f.injected[1]).toContain('"kind":"read"');
    d.onMessage(readMsg('pay.naver.com/receipts', '영수증'));
    expect(f.results[0].orders.map((o) => o.orderNo)).toEqual(['B1']);
  });

  it('같은 읽기 답이 두 번 와도 한 번만 먹이고, 흐름이 낸 동작과 다른 종류의 답은 버린다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const d = make(f, scripted([() => READ, () => ({ kind: 'click', labels: ['더보기'] }), () => done()], [], seen));
    d.start();
    d.onMessage(readMsg());
    d.onMessage(readMsg());
    d.onMessage({ type: 'nav', step: 'tokens', tokens: [], hasMore: false });
    expect(seen.map((e) => e.type)).toEqual(['start', 'page']);
    d.onMessage({ type: 'other' });
    d.onMessage(null);
    d.onMessage({ type: 'nav', step: 'read', url: 5, text: 'x' });
    expect(seen).toHaveLength(2);
  });

  it('back 은 host.back 을 부르고 주소 변화가 없어도 잠시 뒤 읽는다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const d = make(f, scripted([() => ({ type: 'back' }), () => done()], [], seen));
    d.start();
    expect(f.backs).toBe(1);
    f.advance(BACK_READ_MS - 1);
    d.tick();
    expect(f.injected).toHaveLength(0);
    f.advance(1);
    d.tick();
    expect(f.injected).toHaveLength(1);
    expect(f.injected[0]).toContain('"kind":"read"');
  });

  it('load 끝과 SPA 이동이 겹쳐 와도 읽기는 한 번만 넣는다', () => {
    const f = fake();
    const d = make(f, scripted([() => ({ type: 'goto', url: 'https://pay.naver.com/history' }), () => done()]));
    d.start();
    d.onPageChanged('https://pay.naver.com/history');
    f.advance(200);
    d.onPageChanged('https://pay.naver.com/history');
    f.advance(READ_SETTLE_MS - 1);
    d.tick();
    expect(f.injected).toHaveLength(0);
    f.advance(1);
    d.tick();
    d.tick();
    expect(f.injected).toHaveLength(1);
  });

  it('progress 는 흐름 것을 그대로 보인다', () => {
    const f = fake();
    const d = make(f, scripted([() => READ]));
    d.start();
    expect(d.status()).toEqual({ state: 'running', phase: 'x', done: 1, total: 10, orders: 0, timeouts: 0 });
  });
});

describe('구동기 — 시간 초과 · 구조 기록', () => {
  it('20초 동안 답이 없으면 timeout 을 먹이고, 흐름이 probe 를 내면 host.probe 한 뒤 resume 을 먹인다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const shape = pageShape('pay.naver.com/history', 'x');
    const d = make(f, scripted([
      () => READ,
      (ev) => (ev.type === 'timeout' ? { type: 'probe', where: 'timeout', shape } : READ),
      (ev) => (ev.type === 'resume' ? done([], 'timeout') : READ),
    ], [], seen));
    d.start();
    f.advance(WATCHDOG_MS - 1);
    d.tick();
    expect(seen.map((e) => e.type)).toEqual(['start']);
    f.advance(1);
    d.tick();
    expect(seen.map((e) => e.type)).toEqual(['start', 'timeout', 'resume']);
    expect(f.probes).toEqual([{ shape, where: 'timeout' }]);
    expect(f.results).toHaveLength(1);
    expect(f.results[0].reason).toBe('timeout');
    expect(f.results[0].probes).toBe(1);
  });

  it('답이 오면 연속 시간 초과 수가 0 으로 돌아간다', () => {
    const f = fake();
    const d = make(f, scripted([() => READ]), 'naver', { budgetMs: 600_000 });
    d.start();
    for (let i = 0; i < MAX_TIMEOUTS - 1; i++) { f.advance(WATCHDOG_MS); d.tick(); }
    d.onMessage(readMsg());
    for (let i = 0; i < MAX_TIMEOUTS - 1; i++) { f.advance(WATCHDOG_MS); d.tick(); }
    expect(f.results).toHaveLength(0);
  });

  it('연속 6번 시간 초과면 사용자 확인(attention)을 한 번 부탁하고, 확인 뒤에도 6번 더 연속이면 구조를 보내고 지금까지 읽은 주문을 들고 끝낸다', () => {
    const f = fake();
    const got = [order('C1'), order('C2')];
    const d = make(f, scripted([
      () => ({ type: 'goto', url: 'https://pay.naver.com/history' }),
      () => READ,
    ], got), 'naver', { budgetMs: 3_600_000 });
    d.start();
    d.onMessage({ type: 'nav', step: 'read', url: 'pay.naver.com/history', text: '결제' });
    for (let i = 0; i < MAX_TIMEOUTS; i++) {
      expect(d.status().state).toBe('running');
      f.advance(WATCHDOG_MS);
      d.tick();
    }
    expect(d.status().state).toBe('attention');
    expect(f.results).toHaveLength(0);
    expect(f.probes.map((p) => p.where)).toEqual(['timeouts']);
    // 사용자가 화면에서 확인하는 동안은 시간이 흘러도 감시하지 않는다
    f.advance(LOGIN_CAP_MS - 1000);
    d.tick();
    expect(d.status().state).toBe('attention');
    // 확인이 끝나 주소가 바뀌면 다시 읽는다
    d.onPageChanged('https://pay.naver.com/history/done');
    expect(d.status().state).toBe('running');
    f.advance(READ_SETTLE_MS);
    d.tick();
    expect(f.injected[f.injected.length - 1]).toContain('"kind":"read"');
    for (let i = 0; i < MAX_TIMEOUTS; i++) {
      expect(f.results).toHaveLength(0);
      f.advance(WATCHDOG_MS);
      d.tick();
    }
    expect(f.results).toHaveLength(1);
    // 두 번째 6연속(2분)은 한 사이트 4분 상한과 거의 같은 때에 끝난다 — 어느 쪽이든 구조를 보내고 지금까지의 주문으로 끝난다
    expect(['timeouts', 'site-cap']).toContain(f.results[0].reason);
    expect(f.results[0].orders).toEqual(got);
    expect(f.probes.map((p) => p.where)).toEqual(['timeouts', f.results[0].reason]);
    expect(f.probes[1].shape.url).toBe('pay.naver.com/history');
  });

  it('주소가 안 바뀌는 확인 화면은 resume() 으로 이어 간다', () => {
    const f = fake();
    const d = make(f, scripted([() => READ]), 'naver', { budgetMs: 3_600_000 });
    d.start();
    for (let i = 0; i < MAX_TIMEOUTS; i++) { f.advance(WATCHDOG_MS); d.tick(); }
    expect(d.status().state).toBe('attention');
    const n = f.injected.length;
    d.resume();
    expect(d.status().state).toBe('running');
    f.advance(READ_SETTLE_MS);
    d.tick();
    expect(f.injected.length).toBe(n + 1);
    d.resume(); // 확인 구간이 아니면 아무 일도 없다
    expect(d.status().state).toBe('running');
  });

  it('사용자 확인을 10분 넘게 안 끝내면 끝낸다', () => {
    const f = fake();
    const d = make(f, scripted([() => READ]), 'naver', { budgetMs: 3_600_000 });
    d.start();
    for (let i = 0; i < MAX_TIMEOUTS; i++) { f.advance(WATCHDOG_MS); d.tick(); }
    f.advance(LOGIN_CAP_MS + 1);
    d.tick();
    expect(f.results).toHaveLength(1);
    expect(f.results[0].reason).toBe('attention-timeout');
  });

  it('상태에 연속 시간 초과 수가 보인다', () => {
    const f = fake();
    const d = make(f, scripted([() => READ]), 'naver', { budgetMs: 3_600_000 });
    d.start();
    expect(d.status().timeouts).toBe(0);
    f.advance(WATCHDOG_MS);
    d.tick();
    expect(d.status().timeouts).toBe(1);
    d.onMessage(readMsg());
    expect(d.status().timeouts).toBe(0);
  });

  it('페이지 안 도구가 error 를 보내면 20초를 기다리지 않고 시간 초과로 본다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const d = make(f, scripted([() => READ], [], seen));
    d.start();
    d.onMessage({ type: 'nav', step: 'error', message: 'TypeError' });
    expect(seen.map((e) => e.type)).toEqual(['start', 'timeout']);
  });

  it('한 사이트 4분을 넘기면 구조를 보내고 지금까지의 주문으로 끝낸다', () => {
    const f = fake();
    const got = [order('D1')];
    const d = make(f, scripted([() => READ], got));
    d.start();
    d.onMessage(readMsg());
    for (let t = 0; t < SITE_CAP_MS; t += 15_000) { f.advance(15_000); d.onMessage(readMsg()); d.tick(); }
    f.advance(15_000);
    d.tick();
    expect(f.results).toHaveLength(1);
    expect(f.results[0].orders).toEqual(got);
    expect(['site-cap', 'budget']).toContain(f.results[0].reason);
  });

  it('흐름이 예외를 던지면 주문 없이 끝낸다(페이지를 읽어 구조는 한 번 보낸다)', () => {
    const f = fake();
    const factory = (): ReceiptFlow => ({ next: () => { throw new Error('boom'); }, progress: () => ({ phase: 'x', done: 0, total: 0, orders: 0 }) });
    const d = make(f, factory);
    d.start();
    d.onMessage(readMsg());
    expect(f.probes.map((p) => p.where)).toEqual(['no-orders']);
    expect(f.results).toHaveLength(1);
    expect(f.results[0].orders).toEqual([]);
    expect(f.results[0].reason).toBe('flow-error');
  });
});

describe('구동기 — 열 수 없는 주소', () => {
  it('허용 도메인 밖 · http · 로그아웃 주소 goto 는 열지 않고 구조를 보내고 끝낸다', () => {
    for (const bad of ['https://evil.example.com/steal', 'http://pay.naver.com/history', 'https://nid.naver.com.evil.com/', 'https://pay.naver.com/logout']) {
      const f = fake();
      const got = [order('E1')];
      const d = make(f, scripted([() => READ, () => ({ type: 'goto', url: bad })], got));
      d.start();
      d.onMessage(readMsg());
      expect(f.gotos).toEqual([]);
      expect(f.results).toHaveLength(1);
      expect(f.results[0].reason).toBe('goto-refused');
      expect(f.results[0].orders).toEqual(got);
      expect(f.probes.map((p) => p.where)).toEqual(['goto-refused']);
    }
  });

  it('사이트마다 허용 도메인이 다르다 — 컬리는 kurlypay.co.kr 도 열고, 네이버 주소는 못 연다', () => {
    const f = fake();
    const d = make(f, scripted([() => ({ type: 'goto', url: 'https://kurlypay.co.kr/receipt/x' }), () => ({ type: 'goto', url: 'https://pay.naver.com/history' })]), 'kurly');
    d.start();
    expect(f.gotos).toEqual(['https://kurlypay.co.kr/receipt/x']);
    d.onMessage(readMsg('kurlypay.co.kr/receipt/x'));
    expect(f.gotos).toHaveLength(1);
    expect(f.results[0].reason).toBe('goto-refused');
  });

  it('모르는 동작은 규약 밖이라 끝낸다', () => {
    const f = fake();
    const d = make(f, scripted([() => ({ type: 'teleport' } as unknown as FlowOut)], [order('F1')]));
    d.start();
    expect(f.results[0].reason).toBe('unknown-action');
    expect(f.results[0].orders).toHaveLength(1);
  });

  it('흐름이 읽기 이름이 잘못된 동작을 내도(navScript 가 거절) 끝낸다', () => {
    const f = fake();
    const d = make(f, scripted([() => ({ kind: 'click', labels: [] } as unknown as FlowOut)], [order('F2')]));
    d.start();
    expect(f.results[0].reason).toBe('bad-action');
    expect(f.results[0].orders).toHaveLength(1);
  });
});

describe('구동기 — 로그인', () => {
  const loginFlow = (seen: FlowEvent[] = [], orders: ReceiptOrder[] = []) => scripted([
    () => ({ type: 'goto', url: 'https://pay.naver.com/history' }),
    (ev) => (ev.type === 'page' && ev.url.startsWith('nid.naver.com') ? { type: 'login' } : READ),
    () => READ,
    () => done(orders),
  ], orders, seen);

  it('login 이면 로그인 화면을 벗어날 때까지 기다리고, 벗어나면 잠깐 뒤 다시 읽는다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const d = make(f, loginFlow(seen));
    d.start();
    d.onPageChanged('https://nid.naver.com/nidlogin.login?url=x');
    f.advance(READ_SETTLE_MS);
    d.tick();
    d.onMessage(readMsg('nid.naver.com/nidlogin.login', '로그인 아이디 비밀번호'));
    expect(d.status().state).toBe('login');
    const injectedBefore = f.injected.length;
    // 같은 로그인 화면이 다시 열려도(틀린 비밀번호) 읽지 않는다
    d.onPageChanged('https://nid.naver.com/nidlogin.login?url=x&retry=1');
    f.advance(READ_SETTLE_MS + 100);
    d.tick();
    expect(f.injected.length).toBe(injectedBefore);
    // 로그인이 끝나 다른 주소로 가면 읽는다
    d.onPageChanged('https://pay.naver.com/history');
    expect(d.status().state).toBe('running');
    f.advance(READ_SETTLE_MS);
    d.tick();
    expect(f.injected.length).toBe(injectedBefore + 1);
    expect(f.injected[f.injected.length - 1]).toContain('"kind":"read"');
  });

  it('로그인 기다린 시간은 흐름의 시계와 4분 상한에서 빠진다', () => {
    const f = fake();
    const got = [order('G1')];
    const d = make(f, loginFlow([], got));
    d.start();
    d.onPageChanged('https://nid.naver.com/nidlogin.login');
    f.advance(READ_SETTLE_MS);
    d.tick();
    d.onMessage(readMsg('nid.naver.com/nidlogin.login', '로그인'));
    f.advance(LOGIN_CAP_MS - 60_000); // 흐름의 예산(3분)과 사이트 상한(4분)보다 훨씬 긴 로그인
    d.tick();
    expect(f.results).toHaveLength(0);
    d.onPageChanged('https://pay.naver.com/history');
    f.advance(READ_SETTLE_MS);
    d.tick();
    d.onMessage(readMsg('pay.naver.com/history', '내역'));
    d.onMessage(readMsg('pay.naver.com/history', '내역'));
    expect(f.results).toHaveLength(1);
    expect(f.results[0].reason).toBe('all-rows');
    expect(f.results[0].orders).toEqual(got);
  });

  it('주소가 안 바뀌는 로그인 화면은 가끔 한 번 읽어 본다', () => {
    const f = fake();
    const d = make(f, loginFlow());
    d.start();
    d.onMessage(readMsg('nid.naver.com/nidlogin.login', '로그인'));
    expect(d.status().state).toBe('login');
    const n = f.injected.length;
    f.advance(LOGIN_POLL_MS);
    d.tick();
    expect(f.injected.length).toBe(n + 1);
  });

  it('로그인을 10분 넘게 안 하면 구조 없이 끝낸다', () => {
    const f = fake();
    const d = make(f, loginFlow());
    d.start();
    d.onMessage(readMsg('nid.naver.com/nidlogin.login', '로그인'));
    f.advance(LOGIN_CAP_MS + 1);
    d.tick();
    expect(f.results).toHaveLength(1);
    expect(f.results[0].reason).toBe('login-timeout');
    expect(f.probes).toEqual([]);
  });
});

describe('구동기 — 끝', () => {
  it('done 의 주문과 사유를 그대로 낸다', () => {
    const f = fake();
    const orders = [order('H1')];
    const d = make(f, scripted([() => done(orders, 'max-orders')], orders));
    d.start();
    expect(f.results).toEqual([{ orders, reason: 'max-orders', stats: STATS, probes: 0, timeouts: 0 }]);
    d.onMessage(readMsg());
    d.tick();
    expect(f.results).toHaveLength(1);
  });

  it('주문이 0건이고 구조도 안 보냈으면 마지막으로 읽은 페이지 구조를 한 번 보낸다', () => {
    const f = fake();
    const d = make(f, scripted([() => READ, () => done([], 'all-rows')]));
    d.start();
    d.onMessage(readMsg('pay.naver.com/history', '주문 없음'));
    expect(f.probes.map((p) => p.where)).toEqual(['no-orders']);
    expect(f.results).toHaveLength(1);
  });

  it('페이지를 아직 한 번도 못 읽고 끝나면(자리표시자 흐름) 한 번 읽어서 구조를 보낸다', () => {
    const f = fake();
    const d = make(f, scripted([() => done([], 'not_implemented')]), 'kurly');
    d.start();
    expect(f.results).toHaveLength(0);
    expect(d.status().state).toBe('closing');
    expect(f.injected[0]).toContain('"kind":"read"');
    d.onMessage(readMsg('www.kurly.com/mypage/order', '주문내역'));
    expect(f.probes.map((p) => p.where)).toEqual(['no-orders']);
    expect(f.results).toHaveLength(1);
    expect(f.results[0].reason).toBe('not_implemented');
  });

  it('읽을 페이지가 끝내 없으면 기다리다가 구조 없이 끝낸다', () => {
    const f = fake();
    const d = make(f, scripted([() => done([], 'not_implemented')]), 'musinsa');
    d.start();
    f.advance(CLOSING_WAIT_MS + 1);
    d.tick();
    expect(f.results).toHaveLength(1);
    expect(f.probes).toEqual([]);
  });

  it('흐름이 이미 구조를 보냈으면 같은 구조를 또 보내지 않는다', () => {
    const f = fake();
    const shape = pageShape('pay.naver.com/history', 'x');
    const d = make(f, scripted([() => ({ type: 'probe', where: 'no-order-cards', shape }), () => done([], 'no-order-cards')]));
    d.start();
    expect(f.probes).toHaveLength(1);
    expect(f.results).toHaveLength(1);
  });

  it('stop 은 조용히 멈춘다(onDone 없음)', () => {
    const f = fake();
    const d = make(f, scripted([() => READ]));
    d.start();
    d.stop();
    d.onMessage(readMsg());
    f.advance(WATCHDOG_MS * 10);
    d.tick();
    expect(f.results).toHaveLength(0);
    expect(d.status().state).toBe('done');
  });
});


/** take() 가 있는 가짜 흐름 — 단계마다 새로 만든 주문을 쌓아 두고 take 로 비운다. done.orders 에는 전부 담는다(진짜 흐름처럼) */
function takeable(steps: { out: (ev: FlowEvent) => FlowOut; made?: ReceiptOrder[] }[], seen: FlowEvent[] = []) {
  return (opts: FlowFactoryOptions = {}): ReceiptFlow & { take(): ReceiptOrder[] } => {
    let i = 0;
    let pending: ReceiptOrder[] = [];
    const all: ReceiptOrder[] = [];
    let final: FlowOut | null = null;
    const now = opts.now ?? (() => Date.now());
    const startedAt = now();
    return {
      next: (ev) => {
        if (final) return final;
        seen.push(ev);
        if (now() - startedAt > (opts.budgetMs ?? 180000)) { final = { type: 'done', reason: 'budget', orders: all.slice(), stats: STATS }; return final; }
        const step = steps[Math.min(i, steps.length - 1)];
        i++;
        for (const o of step.made ?? []) { all.push(o); pending.push(o); }
        const out = step.out(ev);
        if ('type' in out && out.type === 'done') final = { ...out, orders: all.slice() };
        return final ?? out;
      },
      take: () => { const r = pending; pending = []; return r; },
      progress: () => ({ phase: 'x', done: i, total: 10, orders: all.length }),
    } as ReceiptFlow & { take(): ReceiptOrder[] };
  };
}

describe('구동기 — take() 가 있는 흐름은 한 단계마다 새 주문을 바로 넘긴다', () => {
  it('단계마다 onOrders 로 넘기고, done 에서는 이미 넘긴 것을 다시 넘기지 않는다', () => {
    const f = fake();
    const d = make(f, takeable([
      { out: () => READ },
      { out: () => READ, made: [order('T1')] },
      { out: () => READ, made: [order('T2'), order('T3')] },
      { out: () => done([], 'all-rows'), made: [order('T4')] },
    ]));
    d.start();
    expect(f.batches).toEqual([]);
    d.onMessage(readMsg());
    expect(f.batches.map((b) => b.map((o) => o.orderNo))).toEqual([['T1']]);
    d.onMessage(readMsg());
    expect(f.batches.map((b) => b.map((o) => o.orderNo))).toEqual([['T1'], ['T2', 'T3']]);
    expect(f.results).toHaveLength(0);
    d.onMessage(readMsg());
    expect(f.batches.map((b) => b.map((o) => o.orderNo))).toEqual([['T1'], ['T2', 'T3'], ['T4']]);
    expect(f.results).toHaveLength(1);
    expect(f.results[0].orders.map((o) => o.orderNo)).toEqual(['T1', 'T2', 'T3', 'T4']);
  });

  it('take 가 없는 흐름은 done 에서 한 번에 넘긴다', () => {
    const f = fake();
    const got = [order('N1'), order('N2')];
    const d = make(f, scripted([() => READ, () => done(got)], got));
    d.start();
    expect(f.batches).toEqual([]);
    d.onMessage(readMsg());
    expect(f.batches).toEqual([got]);
  });

  it('같은 주문번호는 한 번만 넘기지만, 목록 행(list)과 그 완성본은 따로 넘긴다', () => {
    const f = fake();
    const list = { orderedAt: '2026-10-27 14:03:22', amount: 900, payment: '카드', kind: 'list', listKey: '2026-10-27 14:03|900' } as unknown as ReceiptOrder;
    const list2 = { ...order('K2'), kind: 'list' } as unknown as ReceiptOrder;
    const d = make(f, takeable([
      { out: () => READ },
      { out: () => READ, made: [list, list2, list] },
      { out: () => done([], 'all-rows'), made: [order('K2'), order('K2')] },
    ]));
    d.start();
    d.onMessage(readMsg());
    expect(f.batches).toHaveLength(1);
    expect(f.batches[0]).toHaveLength(2);
    d.onMessage(readMsg());
    expect(f.batches[1].map((o) => o.orderNo)).toEqual(['K2']);
    expect(f.results[0].orders).toHaveLength(3);
  });

  it('시간 초과로 강제로 끝내도 take 로 이미 넘긴 주문은 결과에 남는다', () => {
    const f = fake();
    const d = make(f, takeable([
      { out: () => READ },
      { out: () => READ, made: [order('F1')] },
      { out: () => ({ type: 'goto', url: 'https://evil.example.com/' }) },
    ]));
    d.start();
    d.onMessage(readMsg());
    d.onMessage(readMsg());
    expect(f.results).toHaveLength(1);
    expect(f.results[0].reason).toBe('goto-refused');
    expect(f.results[0].orders.map((o) => o.orderNo)).toEqual(['F1']);
    expect(f.batches).toHaveLength(1);
  });

  it('받는 쪽이 예외를 던져도 읽기는 이어진다', () => {
    const f = fake();
    const d = createFlowDriver({
      site: 'naver',
      factory: takeable([{ out: () => READ }, { out: () => done([], 'all-rows'), made: [order('X1')] }]),
      host: f.host,
      onDone: (r) => f.results.push(r),
      onOrders: () => { throw new Error('upload bug'); },
    });
    d.start();
    d.onMessage(readMsg());
    expect(f.results).toHaveLength(1);
    expect(f.results[0].orders).toHaveLength(1);
  });
});

describe('구동기 — goto 의 delayMs · 최소 쉬기 · start 에 싣는 known', () => {
  const GO = (delayMs?: unknown): FlowOut => ({ type: 'goto', url: 'https://shopping.naver.com/my/order', ...(delayMs === undefined ? {} : { delayMs }) } as FlowOut);

  it('흐름이 실은 delayMs 만큼 기다린 뒤 이동한다 — 기다리는 동안은 이동하지 않는다', () => {
    const f = fake();
    const d = make(f, scripted([() => GO(1500), () => READ]));
    d.start();
    expect(f.gotos).toEqual([]);
    f.advance(1499);
    d.tick();
    expect(f.gotos).toEqual([]);
    f.advance(1);
    d.tick();
    expect(f.gotos).toEqual(['https://shopping.naver.com/my/order']);
    d.tick();
    expect(f.gotos).toHaveLength(1);
  });

  it('상한은 5000 이다 — 더 크게 실어도 5초만 기다린다', () => {
    expect(MAX_GOTO_DELAY_MS).toBe(5000);
    const f = fake();
    const d = make(f, scripted([() => GO(60_000), () => READ]));
    d.start();
    f.advance(4999);
    d.tick();
    expect(f.gotos).toEqual([]);
    f.advance(1);
    d.tick();
    expect(f.gotos).toHaveLength(1);
  });

  it('양수가 아닌 값(0 · 음수 · 숫자 아님)은 기다리지 않는다 — 구동기가 멋대로 기본 쉬기를 넣지도 않는다', () => {
    for (const v of [undefined, 0, -5, Number.NaN, '3000', null]) {
      const f = fake();
      const d = make(f, scripted([() => GO(v), () => READ]));
      d.start();
      expect(f.gotos, String(v)).toHaveLength(1);
      d.stop();
    }
  });

  it('기다리는 중 stop 이 오면 이동하지 않고 끝난다', () => {
    const f = fake();
    const d = make(f, scripted([() => GO(2000), () => READ]));
    d.start();
    f.advance(1000);
    d.tick();
    d.stop();
    f.advance(10_000);
    d.tick();
    expect(f.gotos).toEqual([]);
    expect(f.results).toHaveLength(0);
    expect(d.status().state).toBe('done');
  });

  it('쉬는 동안 시계가 겹치지 않는다 — 읽기 예약 · 20초 감시가 서지 않고, 이동 뒤에 새로 잰다', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const d = make(f, scripted([() => GO(5000), () => READ], [], seen));
    d.start();
    // 쉬는 중에 옛 페이지의 load 끝 · 답이 와도 읽기를 넣거나 흐름에 먹이지 않는다
    d.onPageChanged('https://shopping.naver.com/my/order');
    d.onMessage(readMsg('shopping.naver.com/my/order', '옛 페이지'));
    f.advance(4000);
    d.tick();
    expect(f.injected).toHaveLength(0);
    expect(seen.map((e) => e.type)).toEqual(['start']);
    expect(d.status().timeouts).toBe(0);
    f.advance(1000);
    d.tick();
    expect(f.gotos).toHaveLength(1);
    // 감시는 이동한 때부터 20초
    f.advance(WATCHDOG_MS - 1);
    d.tick();
    expect(d.status().timeouts).toBe(0);
    f.advance(1);
    d.tick();
    expect(d.status().timeouts).toBe(1);
    expect(seen.map((e) => e.type)).toEqual(['start', 'timeout']);
  });

  it('쉬는 동안의 시간은 사이트 4분 상한에서 빼지 않는다(그냥 흐르는 시간이다)', () => {
    const f = fake();
    const d = make(f, scripted([() => GO(5000), () => READ], [order('C9')]), 'naver', { budgetMs: 3_600_000 });
    d.start();
    f.advance(SITE_CAP_MS + 1);
    d.tick();
    expect(f.results).toHaveLength(1);
    expect(f.results[0].reason).toBe('site-cap');
    expect(f.gotos).toEqual([]);
  });

  it('siteCapMs 를 길게 넘기면 기본 4분(SITE_CAP_MS)이 지나도 자르지 않는다(네이버 issue 는 주문마다 쉬며 1년치를 읽는다)', () => {
    const f = fake();
    const d = createFlowDriver({ site: 'naver', factory: scripted([() => READ, () => READ], [order('C8')]), host: f.host, onDone: (r) => f.results.push(r), siteCapMs: 1_500_000, options: { budgetMs: 3_600_000 } });
    d.start();
    f.advance(SITE_CAP_MS + 1);
    d.tick();
    expect(f.results).toHaveLength(0);
  });

  it('siteCapMs 에 도달하면 site-cap 으로 끝낸다', () => {
    const f = fake();
    const d = createFlowDriver({ site: 'naver', factory: scripted([() => READ, () => READ], [order('C8')]), host: f.host, onDone: (r) => f.results.push(r), siteCapMs: 1_500_000, options: { budgetMs: 3_600_000 } });
    d.start();
    f.advance(1_500_001);
    d.tick();
    expect(f.results).toHaveLength(1);
    expect(f.results[0].reason).toBe('site-cap');
  });

  it('minGotoDelayMs: 첫 이동은 쉬지 않고, 그 뒤 이동마다 최소 그만큼 쉰다 — 흐름의 delayMs 가 더 크면 그쪽', () => {
    const f = fake();
    const outs: FlowOut[] = [GO(), GO(), GO(3000), GO(200)];
    let i = 0;
    const d = createFlowDriver({ site: 'naver', factory: scripted([() => outs[Math.min(i++, outs.length - 1)]]), host: f.host, onDone: (r) => f.results.push(r), minGotoDelayMs: 1000, options: { budgetMs: 3_600_000 } });
    d.start();
    expect(f.gotos).toHaveLength(1);                 // 첫 이동: 바로
    d.onMessage(readMsg('shopping.naver.com/my/order', '목록'));
    expect(f.gotos).toHaveLength(1);                 // 두 번째: 1000ms 쉬는 중
    f.advance(999);
    d.tick();
    expect(f.gotos).toHaveLength(1);
    f.advance(1);
    d.tick();
    expect(f.gotos).toHaveLength(2);
    d.onMessage(readMsg('shopping.naver.com/my/order', '목록'));   // 세 번째: delayMs 3000 > 최소 1000
    f.advance(2999);
    d.tick();
    expect(f.gotos).toHaveLength(2);
    f.advance(1);
    d.tick();
    expect(f.gotos).toHaveLength(3);
    d.onMessage(readMsg('shopping.naver.com/my/order', '목록'));   // 네 번째: delayMs 200 < 최소 1000
    f.advance(999);
    d.tick();
    expect(f.gotos).toHaveLength(3);
    f.advance(1);
    d.tick();
    expect(f.gotos).toHaveLength(4);
  });

  it('호스트의 쉬기 상수는 한 곳(flows.ts) — 네이버 issue 경로 1000ms', () => {
    expect(NAVER_ISSUE_GOTO_DELAY_MS).toBe(1000);
    expect(NAVER_ISSUE_GOTO_DELAY_MS).toBeLessThanOrEqual(MAX_GOTO_DELAY_MS);
  });

  it('route 와 known 을 start 이벤트에 싣는다(없으면 싣지 않는다)', () => {
    const f = fake();
    const seen: FlowEvent[] = [];
    const known = { orderNos: ['2026102712345678'], listKeys: ['2026-10-27 14:03|12300'] };
    createFlowDriver({ site: 'naver', factory: scripted([() => READ], [], seen), host: f.host, onDone: () => undefined, route: 'issue', known }).start();
    expect(seen[0]).toEqual({ type: 'start', route: 'issue', known });
    const seen2: FlowEvent[] = [];
    createFlowDriver({ site: 'naver', factory: scripted([() => READ], [], seen2), host: f.host, onDone: () => undefined }).start();
    expect(seen2[0]).toEqual({ type: 'start' });
    expect('known' in seen2[0] && (seen2[0] as { known?: unknown }).known !== undefined).toBe(false);
  });
});
