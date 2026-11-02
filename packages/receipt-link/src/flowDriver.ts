/**
 * 영수증 읽기 흐름 구동기 — 사이트별 흐름(flows.ts)이 내는 동작(FlowOut)을 웹뷰 위에서 실행하고, 웹뷰가 돌려준 메시지를 흐름 이벤트(FlowEvent)로 바꿔 먹인다.
 * react-native 를 import 하지 않는다(노드에서 시험한다). 웹뷰 · 시계는 host 로 받는다.
 * 지키는 것: 글자 · 주문 내용은 로그나 서버로 보내지 않는다(probe 는 구조 요약 PageShape 만). 쿠키 · 저장소는 읽지 않는다. 영수증 주소(토큰)는 이동에만 쓰고 서버로 보내지 않는다.
 *
 * 구동 규칙
 *  - 흐름이 동작을 내면 그 동작에 맞는 답 하나만 받는다(awaiting). 같은 읽기 답이 두 번 와도 한 번만 먹인다.
 *  - 페이지가 열리면(onPageChanged) 잠깐(READ_SETTLE_MS) 기다렸다가 읽기를 넣는다 — load 끝 · SPA 이동이 겹쳐 와도 한 번으로 합친다.
 *  - 동작을 낸 뒤 20초 동안 답이 없으면 {type:'timeout'} 을 먹인다. 연속 6번이면 사용자 확인(attention)을 한 번 부탁하고, 그 뒤에도 6번 더 연속이면 구조를 보내고 끝낸다.
 *    한 사이트 전체 4분이 상한이다.
 *  - 로그인(흐름이 login 을 낸 동안) · 사용자 확인 구간의 시간은 흐름의 시계 · 4분 상한에서 뺀다(그 구간 상한은 따로 10분). 이 구간에는 호스트가 웹뷰를 보여 준다.
 *  - goto 는 https 이고 FLOW_HOSTS[site] 안의 호스트일 때만 연다. 아니면 열지 않고 구조를 보내고 끝낸다.
 *  - 흐름에 take() 가 있으면 한 단계마다 불러 새 주문을 onOrders 로 바로 넘긴다. 없으면 done 의 주문을 한 번에 넘긴다. 같은 주문은 한 번만 넘긴다.
 */
import { FLOW_HOSTS, type FlowFactoryOptions, type FlowSite, type ReceiptFlow } from './flows';
import { NEUTRALIZE_NEW_WINDOW_SCRIPT } from './navCommon';
import { navScript, pageShape, type FlowEvent, type FlowOut, type FlowStats, type PageShape, type ReceiptOrder } from './naverReceipt';
import { ABORT_RECEIPTS_SCRIPT, type PayRow, type ReceiptDiag, type ReceiptResult, type ReceiptSlip, type ReceiptStatus } from './naverReceiptsScript';
import { ABORT_FETCH_SCRIPT, type FetchResult, type FetchStatus } from './siteFetch';
import type { OutcomeEvent } from './runOutcome';

export const WATCHDOG_MS = 20_000;
export const MAX_TIMEOUTS = 6;
/** 네이버페이 내역 줄을 한 번에 받아들이는 안전 상한 — 60쪽(MAX_SCAN_PAGES) × 쪽당 수십 줄보다 크게 */
export const MAX_PAY_ROWS = 5000;
export const SITE_CAP_MS = 240_000;
export const LOGIN_CAP_MS = 600_000;
export const READ_SETTLE_MS = 600;
export const BACK_READ_MS = 2_500;
export const LOGIN_POLL_MS = 10_000;
export const CLOSING_WAIT_MS = 15_000;
/** goto 앞에서 기다릴 수 있는 시간의 상한 — 흐름이 더 크게 실어도 이만큼만 기다린다 */
export const MAX_GOTO_DELAY_MS = 5_000;
/** 한 입력(메시지 · 시계)에서 흐름을 이어서 돌리는 최대 횟수 — 흐름이 probe 만 반복해도 멈추게 */
const MAX_CHAIN = 60;

export type FlowHost = {
  goto(url: string): void;
  back(): void;
  inject(script: string): void;
  /** 구조 요약(PageShape)을 보낸다. where 는 흐름이 붙인 짧은 이름(영문 · 숫자 · - _). 보내는 곳이 없으면 아무것도 안 해도 된다 */
  probe(shape: PageShape, where: string): void;
  /** 응답 JSON 의 키 구조 줄(structureLines)을 구조 기록으로 보낸다. 보내는 곳이 없으면 안 해도 된다 */
  structure?(where: string, host: string, path: string, lines: string[]): void;
  now(): number;
};

/**
 * login: 로그인 화면을 사용자에게 보여 줄 때 · attention: 캡차 · 본인확인처럼 사용자가 화면에서 직접 끝내야 할 때(둘 다 호스트가 웹뷰를 보여 준다)
 * closing: 주문이 없어 마지막 페이지 구조를 읽어 보내는 중
 */
export type DriverState = 'idle' | 'running' | 'login' | 'attention' | 'closing' | 'done';
export type DriverStatus = { state: DriverState; phase: string; done: number; total: number; orders: number; timeouts: number };
/** orders 는 onOrders 로 넘긴 모든 주문(중복 없이)이다 */
export type DriverResult = { orders: ReceiptOrder[]; reason: string; stats: FlowStats; probes: number; timeouts: number };

export type FlowDriverArgs = {
  site: FlowSite;
  factory: (opts?: FlowFactoryOptions) => ReceiptFlow;
  host: FlowHost;
  onDone: (r: DriverResult) => void;
  /** 새 주문이 생길 때마다 — 같은 주문은 한 번만 온다 */
  onOrders?: (orders: ReceiptOrder[]) => void;
  onUpdate?: (s: DriverStatus) => void;
  /** 주문 한 건의 결과(가져오는 중 · 가져옴 · 영수증 없음 · 못 가져옴+까닭)가 날 때마다 — 줄 상태를 그리는 데 쓴다. 결과를 내지 않는 흐름은 부르지 않는다 */
  onOutcome?: (e: OutcomeEvent) => void;
  options?: FlowFactoryOptions;
  /** start 이벤트에 실을 시작 경로 — 안 주면 흐름의 기본 경로(네이버는 issue) */
  route?: 'issue' | 'history' | 'pay' | 'shop';
  /** start 이벤트에 실을 「서버에 이미 있는 주문」 — 흐름이 이 주문은 다시 열지 않고 건너뛴다(없으면 전부 처리) */
  known?: { orderNos?: string[]; listKeys?: string[]; tails?: string[] };
  /** 첫 이동을 뺀 모든 goto 앞에서 최소로 쉬는 시간(밀리초). 흐름이 delayMs 를 실었으면 둘 중 큰 쪽. 기본 0(구동기가 멋대로 쉬지 않는다) */
  minGotoDelayMs?: number;
  /** 사이트 하나를 읽는 최대 시간(밀리초). 없으면 SITE_CAP_MS(4분). 네이버 영수증(issue)은 주문마다 쉬면서 1년치를 읽으므로 호스트가 더 길게 넘긴다 */
  siteCapMs?: number;
};

export type FlowDriver = {
  start(): void;
  /** 웹뷰 load 끝 · 주소 바뀜(SPA 포함) — 전체 주소를 넘긴다 */
  onPageChanged(url: string): void;
  /** 페이지 안 스크립트가 보낸 {type:'nav', step, ...} 메시지(JSON.parse 한 값) */
  onMessage(msg: unknown): void;
  /** 0.5초쯤마다 부른다 — 읽기 예약 · 20초 감시 · 상한을 본다 */
  tick(): void;
  /** 로그인 · 사용자 확인을 사용자가 끝냈다고 알린다(주소가 안 바뀌는 확인 화면용) — 바로 다시 읽는다 */
  resume(): void;
  status(): DriverStatus;
  /** 끝내지 않고 조용히 멈춘다(onDone 을 부르지 않는다) */
  stop(): void;
};

/** 호스트 이름(소문자). https 가 아니거나 모양이 틀리면 빈 문자열 — 사용자 정보(@) 가 든 주소는 거절한다 */
export const httpsHostOf = (url: string): string => (/^https:\/\/([^/?#:@\s]+)(?::\d+)?(?:[/?#]|$)/i.exec(url)?.[1] ?? '').toLowerCase();

/** 흐름이 열어도 되는 주소 — https, 허용 도메인(하위 포함), 경로에 로그아웃 · 탈퇴 · 삭제 글자가 없음(쿼리는 보지 않는다: 쿠팡은 cancel=false 가 든다) */
export function isFlowUrl(url: string, hosts: readonly string[]): boolean {
  if (typeof url !== 'string' || url.length > 2000 || /[\s\u0000-\u001f]/.test(url)) return false;
  const host = httpsHostOf(url);
  if (!host || !hosts.some((h) => host === h || host.endsWith('.' + h))) return false;
  const path = /^https:\/\/[^/?#]+(\/[^?#]*)?/i.exec(url)?.[1] ?? '';
  return !/(logout|signout|withdraw|delete)/i.test(path);
}

/** 전체 주소 → 「호스트+경로」(긴 숫자는 #) — 흐름의 page 이벤트 주소와 같은 모양이다. 쿼리 · 해시는 버린다 */
export function pageKey(url: string): string {
  const m = /^https?:\/\/([^/?#]+)([^?#]*)/i.exec(url);
  return m ? (m[1] + m[2]).toLowerCase().replace(/\d{6,}/g, '#') : '';
}

/** 구조 요약 → 서버 구조 기록(buildPayload)이 받는 raw. 글자 · 번호는 없고 개수 · 있음/없음만 담는다 */
export function shapeProbeRaw(shape: PageShape, where: string): { host: string; path: string; queryKeys: string[]; cookieNames: string[]; outline: string[]; repeat: Record<string, number>; requests: [] } {
  const i = shape.url.indexOf('/');
  const w = String(where).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'unknown';
  return {
    host: i < 0 ? shape.url : shape.url.slice(0, i),
    path: i < 0 ? '/' : shape.url.slice(i),
    queryKeys: [],
    cookieNames: [],
    outline: [
      'flow-shape',
      `where=${w}`,
      `textLen=${shape.textLen}`,
      `orderNos=${shape.orderNos}`,
      `amounts=${shape.amounts}`,
      `orderCards=${shape.orderCards}`,
      `receiptMenu=${shape.receiptMenu}`,
      `cardBtns=${shape.cardReceiptBtns}`,
      `purchaseBtns=${shape.purchaseReceiptBtns}`,
      `login=${shape.login ? 1 : 0}`,
    ],
    repeat: {},
    requests: [],
  };
}

type DoneOut = Extract<FlowOut, { type: 'done' }>;
const isDone = (o: FlowOut): o is DoneOut => 'type' in o && o.type === 'done';
/** 양수 밀리초만 인정한다(숫자가 아니거나 0 이하면 0) */
const positiveMs = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const NO_AUTO_PROBE = ['login-timeout', 'attention-timeout', 'stopped'];
type Awaiting = 'read' | 'clicked' | 'tokens' | 'blocks' | 'api' | 'receipts' | 'fetched';
/** 동작 종류 → 기다리는 답. escape 는 눌렀다는 답(clicked)을 보낸다 */
const awaitingFor = (kind: string): Awaiting => (
  kind === 'read' ? 'read' : kind === 'tokens' ? 'tokens' : kind === 'api' ? 'api' : kind === 'receipts' ? 'receipts' : kind === 'fetch' ? 'fetched' : kind === 'blocks' ? 'blocks' : 'clicked'
);
/** 주문 하나의 이름 — 종류 + 주문번호(비었으면 목록 키). 목록 행과 완성본은 종류가 달라 따로 센다 */
const orderKey = (o: ReceiptOrder): string => {
  const x = o as { kind?: string; orderNo?: string; listKey?: string };
  const id = x.orderNo || x.listKey || '';
  return id ? `${x.kind ?? ''}:${id}` : '';
};

export function createFlowDriver(args: FlowDriverArgs): FlowDriver {
  const { site, factory, host, onDone, onUpdate, onOrders, onOutcome } = args;
  const hosts = FLOW_HOSTS[site];

  let state: DriverState = 'idle';
  let flow: (ReceiptFlow & { take?: () => ReceiptOrder[]; takeOutcomes?: () => OutcomeEvent[] }) | null = null;
  let awaiting: Awaiting | null = null;
  let startedAt = 0;
  let lastActionAt = 0;
  // 지금 기다리는 동작의 응답 제한 — 기본 WATCHDOG_MS, 동작이 timeoutMs 를 주면(예: npv2 scan 은 내역 더보기로 오래 걸려 40초) 그 값. 동작마다 다시 정한다
  let curWatchdogMs = WATCHDOG_MS;
  let readDueAt = 0;
  let pausedMs = 0;
  let waitStartedAt = 0;
  let waitKey = '';
  let waitPollAt = 0;
  let attentionShown = false;
  let closeDeadline = 0;
  let timeouts = 0;
  let probes = 0;
  let forced = false;
  let lastUrl = '';
  let lastText = '';
  let closing: DriverResult | null = null;
  /** 쉬는 중인 goto — 기다리는 동안은 읽기 예약 · 20초 감시를 세우지 않는다. dueAt 이 되면 tick 이 이동한다 */
  let pendingGoto: { url: string; dueAt: number } | null = null;
  let gotos = 0;
  const emitted = new Set<string>();
  const allOrders: ReceiptOrder[] = [];

  const isWait = (): boolean => state === 'login' || state === 'attention';

  /** 흐름이 보는 시계 — 로그인 · 확인 구간은 멈춰 있고, 강제로 끝낼 때는 끝없이 멀리 간다(흐름이 예산 초과로 지금까지 읽은 주문을 내게) */
  const vnow = (): number => (forced ? Number.MAX_SAFE_INTEGER : host.now() - pausedMs - (isWait() ? host.now() - waitStartedAt : 0));

  const status = (): DriverStatus => {
    const p = flow ? flow.progress() : { phase: 'idle', done: 0, total: 0, orders: 0 };
    return { state, phase: p.phase, done: p.done, total: p.total, orders: p.orders, timeouts };
  };
  const emit = (): void => { if (onUpdate) onUpdate(status()); };

  const sendShape = (where: string, shape?: PageShape): void => {
    const s = shape ?? (lastUrl ? pageShape(lastUrl, lastText) : null);
    if (!s || !s.url) return;
    probes++;
    try { host.probe(s, where); } catch { /* 보고 실패는 읽기를 막지 않는다 */ }
  };

  /** 새 주문을 한 번씩만 넘긴다 */
  const emitOrders = (list: ReceiptOrder[]): void => {
    const fresh: ReceiptOrder[] = [];
    for (const o of list) {
      const k = orderKey(o);
      if (k) { if (emitted.has(k)) continue; emitted.add(k); }
      fresh.push(o);
    }
    if (fresh.length === 0) return;
    allOrders.push(...fresh);
    if (onOrders) { try { onOrders(fresh); } catch { /* 받는 쪽 오류가 읽기를 막지 않는다 */ } }
  };

  const finalize = (r: DriverResult): void => {
    if (state === 'done') return;
    state = 'done';
    awaiting = null;
    readDueAt = 0;
    closing = null;
    pendingGoto = null;
    emit();
    onDone({ ...r, probes: Math.max(r.probes, probes), timeouts });
  };

  /** 주문이 하나도 없는데 구조도 안 보냈으면 마지막 페이지 구조를 한 번 보낸다(페이지를 아직 못 읽었으면 읽어서) */
  const complete = (r: DriverResult): void => {
    if (state === 'done') return;
    if (r.orders.length === 0 && probes === 0 && r.stats.probes === 0 && !NO_AUTO_PROBE.includes(r.reason)) {
      if (lastUrl) { sendShape('no-orders'); finalize(r); return; }
      state = 'closing';
      closing = r;
      closeDeadline = host.now() + CLOSING_WAIT_MS;
      awaiting = 'read';
      lastActionAt = host.now();
      curWatchdogMs = WATCHDOG_MS;
      host.inject(navScript({ kind: 'read' }));
      emit();
      return;
    }
    finalize(r);
  };

  const emptyStats = (): FlowStats => ({ rejected: 0, probes: 0, duplicates: 0 });
  const resultOf = (reason: string, stats: FlowStats): DriverResult => ({ orders: allOrders.slice(), reason, stats, probes, timeouts });

  const doneResult = (out: DoneOut, reasonOverride?: string): DriverResult => {
    emitOrders(out.orders);
    return resultOf(reasonOverride ?? out.reason, out.stats);
  };

  const safeNext = (ev: FlowEvent): FlowOut | null => {
    if (!flow) return null;
    let out: FlowOut;
    try { out = flow.next(ev); } catch { return null; }
    // 한 단계에서 새로 만든 주문은 바로 넘긴다(take 가 있는 흐름)
    if (typeof flow.take === 'function') { try { emitOrders(flow.take()); } catch { /* take 오류는 done 에서 다시 모은다 */ } }
    // 줄별 결과(가져오는 중 · 가져옴 · 영수증 없음 · 못 가져옴)도 바로 넘긴다
    if (typeof flow.takeOutcomes === 'function' && onOutcome) {
      try { for (const e of flow.takeOutcomes()) { try { onOutcome(e); } catch { /* 받는 쪽 오류가 읽기를 막지 않는다 */ } } } catch { /* 결과를 못 꺼내도 읽기는 이어 간다 */ }
    }
    return out;
  };

  /** 시계를 끝없이 보내 흐름이 지금까지 읽은 주문을 done 으로 내게 한 뒤 끝낸다 */
  const forceFinish = (reason: string, where?: string): void => {
    if (state === 'done') return;
    if (where) sendShape(where);
    forced = true;
    let out: FlowOut | null = safeNext({ type: 'timeout' });
    for (let i = 0; i < 4 && out && !isDone(out); i++) {
      out = safeNext('type' in out && out.type === 'probe' ? { type: 'resume' } : { type: 'timeout' });
    }
    if (out && isDone(out)) { complete(doneResult(out, reason)); return; }
    complete(resultOf(reason, emptyStats()));
  };

  /** 로그인 · 사용자 확인 구간에 들어간다 — 호스트가 웹뷰를 보여 주고, 이 구간의 시간은 흐름의 시계에서 뺀다 */
  const enterWait = (kind: 'login' | 'attention'): void => {
    const now = host.now();
    if (!isWait()) waitStartedAt = now;
    state = kind;
    waitKey = lastUrl ? pageKey(`https://${lastUrl}`) : '';
    waitPollAt = now + LOGIN_POLL_MS;
    awaiting = null;
    readDueAt = 0;
    emit();
  };

  const leaveWait = (): void => {
    if (!isWait()) return;
    pausedMs += host.now() - waitStartedAt;
    state = 'running';
  };

  const apply = (out: FlowOut): void => {
    const now = host.now();
    if ('kind' in out) {
      // 요청 동작은 흐름이 열어도 되는 호스트(FLOW_HOSTS) 안의 https 주소만 부른다 — 쿠키가 딸려 가는 요청이라 goto 와 같은 검사를 한다
      if (out.kind === 'fetch' && out.reqs.some((q) => q.url.charAt(0) !== '/' && !isFlowUrl(q.url, hosts))) { forceFinish('fetch-refused', 'fetch-refused'); return; }
      let script = '';
      try { script = navScript(out); } catch { forceFinish('bad-action', 'bad-action'); return; }
      // 누르기 직전에 새 창 막기를 다시 넣는다(이미 들어 있으면 아무 일 없다) — 영수증이 새 창으로 열리는 사이트를 위해
      if (out.kind === 'click' || out.kind === 'clickNth') script = `${NEUTRALIZE_NEW_WINDOW_SCRIPT}\n${script}`;
      leaveWait();
      awaiting = awaitingFor(out.kind);
      readDueAt = 0;
      lastActionAt = now;
      curWatchdogMs = Math.max(positiveMs((out as { timeoutMs?: unknown }).timeoutMs), WATCHDOG_MS);   // scan 등 오래 걸리는 동작은 자기 timeoutMs 만큼 기다린다. 기본 WATCHDOG_MS 보다 짧게는 안 줄인다(다른 사이트 9초 timeoutMs 가 20초를 깎지 않게)
      host.inject(script);
      emit();
      return;
    }
    switch (out.type) {
      case 'goto': {
        if (!isFlowUrl(out.url, hosts)) { forceFinish('goto-refused', 'goto-refused'); return; }
        leaveWait();
        readDueAt = 0;
        lastActionAt = now;
        curWatchdogMs = WATCHDOG_MS;
        // 쉬는 시간 — 흐름이 실은 delayMs 와 호스트가 정한 최소(첫 이동은 제외) 중 큰 쪽, 상한 MAX_GOTO_DELAY_MS
        const delay = Math.min(MAX_GOTO_DELAY_MS, Math.max(positiveMs((out as { delayMs?: unknown }).delayMs), gotos > 0 ? positiveMs(args.minGotoDelayMs) : 0));
        gotos += 1;
        if (delay > 0) {
          pendingGoto = { url: out.url, dueAt: now + delay };
          awaiting = null;
        } else {
          awaiting = 'read';
          host.goto(out.url);
        }
        emit();
        return;
      }
      case 'back':
        leaveWait();
        awaiting = 'read';
        readDueAt = now + BACK_READ_MS;
        lastActionAt = now;
        host.back();
        emit();
        return;
      case 'login':
        enterWait('login');
        return;
      default:
        // 모르는 동작 — 흐름이 규약을 벗어났다. 지금까지 읽은 것만 남기고 끝낸다
        forceFinish('unknown-action', 'unknown-action');
    }
  };

  /** 흐름 출력 하나를 처리한다. probe 는 보내고 resume 을 먹여 다음 동작을 받는다 */
  const run = (first: FlowOut | null): void => {
    let out = first;
    for (let i = 0; i < MAX_CHAIN; i++) {
      if (state === 'done') return;
      if (!out) { complete(resultOf('flow-error', emptyStats())); return; }
      if ('type' in out && out.type === 'done') { log('done', `${out.reason} orders=${out.orders.length}`); leaveWait(); complete(doneResult(out)); return; }
      if ('type' in out && out.type === 'probe') {
        probes++;
        log('probe', out.where);
        try { host.probe(out.shape, out.where); } catch { /* 보고 실패는 읽기를 막지 않는다 */ }
        out = safeNext({ type: 'resume' });
        continue;
      }
      if ('type' in out && out.type === 'structure') {
        // 구조 기록 줄 전부를 20줄씩 나눠 찍는다(앞 12줄만 찍어 진단 트리가 잘리던 것, 10-29 14:15) — 값 없는 이름 · 모양 줄뿐
        for (let i = 0; i < out.lines.length || i === 0; i += 20) log('structure', `${out.where} ${out.path} ${i / 20 + 1}/${Math.max(1, Math.ceil(out.lines.length / 20))} | ${out.lines.slice(i, i + 20).join(' | ')}`);
        try { host.structure?.(out.where, out.host, out.path, out.lines); } catch { /* 보고 실패는 읽기를 막지 않는다 */ }
        out = safeNext({ type: 'resume' });
        continue;
      }
      apply(out);
      return;
    }
    forceFinish('too-many-steps', 'too-many-steps');
  };

  const feed = (ev: FlowEvent): void => { run(safeNext(ev)); };

  const start = (): void => {
    if (state !== 'idle') return;
    startedAt = host.now();
    flow = factory({ ...(args.options ?? {}), now: vnow });
    state = 'running';
    feed({ type: 'start', route: args.route, known: args.known });
  };

  /** 로그인 · 확인 구간을 벗어나 읽기로 돌아간다 */
  const resumeReading = (): void => {
    const now = host.now();
    leaveWait();
    awaiting = 'read';
    readDueAt = now + READ_SETTLE_MS;
    lastActionAt = now;
    emit();
  };

  const onPageChanged = (url: string): void => {
    const now = host.now();
    if (isWait()) {
      if (pageKey(url) !== waitKey) resumeReading();
      return;
    }
    if (state === 'closing' || (state === 'running' && awaiting === 'read')) {
      readDueAt = now + READ_SETTLE_MS;
      lastActionAt = now;
    }
  };

  const resume = (): void => { if (isWait()) resumeReading(); };

  const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null);

  /** 맥북에 이은 아이폰 log stream 에서 보는 줄 — 머리말 [receiptLink], 단계 이름 · 개수 · 모양만(쿠키 · 토큰 · 주문번호 · 금액 값 없음) */
  const log = (step: string, text: string): void => { try { console.log(`[receiptLink] ${site} ${step} ${text}`); } catch { /* 로그 실패는 무시 */ } };
  const RECEIPT_STATUS: readonly ReceiptStatus[] = ['ok', 'none', 'login', 'blocked', 'net', 'nopair', 'shape', 'pair'];
  const ID20 = /^\d{18,22}$/;
  /** 네이버페이 내역 줄 — 주문번호 16자리 · 시각 · 금액이 맞는 것만. 줄 수 제한은 폭주 방지용 안전 상한(MAX_PAY_ROWS)뿐 — 전에는 앞 200줄만 통과시켜 736줄을 읽어도 그 뒤 줄을 아예 못 봤다(11-02 대표님 「지우고 다시 하니 50개만」) */
  const cleanRows = (v: unknown): PayRow[] => {
    const out: PayRow[] = [];
    for (const x of Array.isArray(v) ? v.slice(0, MAX_PAY_ROWS) : []) {
      if (!isObj(x)) continue;
      const orderNo = typeof x.orderNo === 'string' && /^\d{16}$/.test(x.orderNo) ? x.orderNo : undefined;
      const tid = typeof x.tid === 'string' && ID20.test(x.tid) ? x.tid : undefined;
      const paymentId = typeof x.paymentId === 'string' && /^\d{8}NP\d{6,14}$/.test(x.paymentId) ? x.paymentId : undefined;
      // 주문번호가 있거나, 버튼 영수증 주소의 짝(tid + payId · 상품 주문번호 또는 paymentId)이 있어야 한다
      const pairOk = !!tid && ((typeof x.payId === 'string' && ID20.test(x.payId) && typeof x.productOrderNo === 'string') || !!paymentId);
      // 간편결제 줄 — 실기록 주소 경로(/instantPay/detail/<결제번호>?…)와 그 결제번호
      const instant = typeof x.instant === 'string' && /^\/instantPay\/detail\/\d{8}NP\d{6,14}(\?[A-Za-z0-9=&%._~:\/+-]{0,400})?$/.test(x.instant) && !!paymentId ? x.instant : undefined;
      if (!orderNo && !pairOk && !instant) continue;
      const row: PayRow = orderNo ? { orderNo } : {};
      if (instant) row.instant = instant;
      if (tid) row.tid = tid;
      if (paymentId) row.paymentId = paymentId;
      if (typeof x.at === 'number' && Number.isFinite(x.at)) row.at = x.at;
      if (typeof x.amount === 'number' && Number.isInteger(x.amount) && x.amount >= 1 && x.amount <= 1_000_000_000) row.amount = x.amount;
      if (typeof x.payId === 'string' && ID20.test(x.payId)) row.payId = x.payId;
      if (typeof x.productOrderNo === 'string' && /^\d{8,24}$/.test(x.productOrderNo)) row.productOrderNo = x.productOrderNo;
      out.push(row);
    }
    return out;
  };
  const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined);
  const when = (v: unknown): string | number | undefined => (typeof v === 'string' ? v.slice(0, 40) : typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const money = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1_000_000_000 ? v : undefined);
  const cleanSlip = (x: Record<string, unknown>): ReceiptSlip => ({
    approvalNo: text(x.approvalNo, 40), cardCompany: text(x.cardCompany, 30), approvalAt: when(x.approvalAt), cancelAt: when(x.cancelAt),
    productName: text(x.productName, 120), sellerName: text(x.sellerName, 80), businessNo: text(x.businessNo, 20), amount: money(x.amount), cancelAmount: money(x.cancelAmount),
    // 대표님 14:15 원문 칸 — 세부 화면에 모두 보인다(14:26)
    cardNo: text(x.cardNo, 40), tradeType: text(x.tradeType, 30), ownerType: text(x.ownerType, 30), installmentType: text(x.installmentType, 30), productOrderNo: text(x.productOrderNo, 40),
    sellerRepresentative: text(x.sellerRepresentative, 40), sellerTel: text(x.sellerTel, 30), sellerAddress: text(x.sellerAddress, 200),
    merchantName: text(x.merchantName, 80), merchantBusinessNo: text(x.merchantBusinessNo, 20),
    supplyAmount: money(x.supplyAmount), taxAmount: money(x.taxAmount), totalAmount: money(x.totalAmount),
    expiredYear: text(x.expiredYear, 8), expiredMonth: text(x.expiredMonth, 8), merchantRepresentative: text(x.merchantRepresentative, 40), merchantNo: text(x.merchantNo, 30), merchantAddress: text(x.merchantAddress, 200),
    serviceCharge: money(x.serviceCharge), disposableCupAmount: money(x.disposableCupAmount),
  });
  const FETCH_STATUS: readonly FetchStatus[] = ['ok', 'login', 'blocked', 'net', 'http', 'shape'];
  const cleanFetchResults = (v: unknown): FetchResult[] => {
    const out: FetchResult[] = [];
    for (const x of Array.isArray(v) ? v.slice(0, 16) : []) {
      if (!isObj(x)) continue;
      const key = str(x.key, 80);
      const st = FETCH_STATUS.find((s) => s === x.st);
      if (key === null || key === '' || st === undefined) continue;
      const r: FetchResult = { key, st };
      if (typeof x.status === 'number' && Number.isFinite(x.status)) r.status = Math.floor(x.status);
      if (x.data !== undefined) r.data = x.data;
      if (typeof x.text === 'string') r.text = x.text.slice(0, 120_000);
      out.push(r);
    }
    return out;
  };
  const cleanReceiptResults = (v: unknown): ReceiptResult[] => {
    const out: ReceiptResult[] = [];
    for (const x of Array.isArray(v) ? v.slice(0, 96) : []) {
      if (!isObj(x)) continue;
      const key = str(x.key, 60);
      const st = RECEIPT_STATUS.find((s) => s === x.st);
      if (key === null || key === '' || st === undefined) continue;
      if (st === 'ok' && isObj(x.slip)) { const okDiag = cleanDiag(x.diag); out.push({ key, st, slip: cleanSlip(x.slip), ...(okDiag ? { diag: okDiag } : {}) }); continue; }
      const status = typeof x.status === 'number' && Number.isInteger(x.status) && x.status >= 0 && x.status <= 999 ? x.status : undefined;
      const diag = cleanDiag(x.diag);
      const found = typeof x.found === 'number' && Number.isInteger(x.found) && x.found >= 0 && x.found <= 999 ? x.found : undefined;
      const payId = typeof x.payId === 'string' && ID20.test(x.payId) ? x.payId : undefined;
      const tid = typeof x.tid === 'string' && ID20.test(x.tid) ? x.tid : undefined;
      const pos = Array.isArray(x.pos) ? x.pos.filter((p): p is string => typeof p === 'string' && /^\d{8,24}$/.test(p)).slice(0, 10) : [];
      const paymentId = typeof x.paymentId === 'string' && /^\d{8}NP\d{6,14}$/.test(x.paymentId) ? x.paymentId : undefined;
      const via = x.via === 'read' || x.via === 'tap' ? x.via : undefined;
      if (st === 'pair' && (!tid || (pos.length === 0 && !paymentId))) continue;
      const rows = key === 'np:scan' ? cleanRows(x.rows) : [];
      const page = key === 'np:scan' && typeof x.page === 'number' && Number.isInteger(x.page) && x.page >= 0 && x.page <= 999 ? x.page : undefined;
      const pages = key === 'np:scan' && typeof x.pages === 'number' && Number.isInteger(x.pages) && x.pages >= 0 && x.pages <= 999 ? x.pages : undefined;
      out.push({ key, st, ...(status !== undefined ? { status } : {}), ...(found !== undefined ? { found } : {}), ...(diag ? { diag } : {}),
        ...(payId ? { payId } : {}), ...(st === 'pair' ? { tid, pos, ...(paymentId ? { paymentId } : {}), ...(via ? { via } : {}) } : {}), ...(rows.length > 0 ? { rows } : {}),
        ...(page !== undefined ? { page } : {}), ...(pages !== undefined ? { pages } : {}) });
    }
    return out;
  };
  /** 실패 진단(모양만) — 단계 이름은 짧은 영문, 줄은 구조 기록 한도(300줄 · 200자) 안으로 */
  const cleanDiag = (v: unknown): ReceiptDiag | undefined => {
    if (!isObj(v) || typeof v.w !== 'string' || !/^[A-Za-z0-9_-]{1,24}$/.test(v.w) || !Array.isArray(v.lines)) return undefined;
    const status = typeof v.status === 'number' && Number.isInteger(v.status) && v.status >= 0 && v.status <= 999 ? v.status : 0;
    const lines = v.lines.filter((l): l is string => typeof l === 'string' && l.length > 0 && l.length <= 200).slice(0, 300);
    return lines.length > 0 ? { w: v.w, status, lines } : undefined;
  };

  /** 시간 초과 한 번 — 연속 6번이면 사용자 확인을 한 번 부탁하고, 그래도 안 풀리면 구조를 보내고 끝낸다 */
  const timeoutNow = (): void => {
    timeouts++;
    lastActionAt = host.now();
    awaiting = null;
    if (timeouts >= MAX_TIMEOUTS) {
      if (!attentionShown) {
        attentionShown = true;
        timeouts = 0;
        sendShape('timeouts');
        enterWait('attention');
        return;
      }
      forceFinish('timeouts', 'timeouts');
      return;
    }
    emit();
    feed({ type: 'timeout' });
  };

  const onMessage = (m: unknown): void => {
    if (state === 'idle' || state === 'done' || !isObj(m) || m.type !== 'nav') return;
    const step = m.step;
    if (state === 'closing') {
      if (step === 'read' && closing) {
        const u = str(m.url, 300);
        const t = str(m.text, 400_000);
        if (u !== null && t !== null) { lastUrl = u; lastText = t; sendShape('no-orders'); }
        finalize(closing);
      }
      return;
    }
    if (!awaiting) return;
    let ev: FlowEvent | null = null;
    if (step === 'read' && awaiting === 'read') {
      const u = str(m.url, 300);
      const t = str(m.text, 400_000);
      if (u === null || t === null) return;
      lastUrl = u;
      lastText = t;
      ev = { type: 'page', url: u, text: t };
    } else if (step === 'clicked' && awaiting === 'clicked') {
      ev = { type: 'clicked', ok: m.ok === true };
    } else if (step === 'tokens' && awaiting === 'tokens') {
      const list = Array.isArray(m.tokens) ? m.tokens.filter((x): x is string => typeof x === 'string' && x.length <= 1500).slice(0, 2000) : [];
      ev = { type: 'tokens', tokens: list, hasMore: m.hasMore === true };
    } else if (step === 'blocks' && awaiting === 'blocks') {
      // 흐름이 낸 blocks 동작의 답 — 글자 덩이들을 그대로 흐름에 넘긴다(앱 안에서만 쓰고 서버로 보내지 않는다)
      const blocks = Array.isArray(m.blocks) ? m.blocks.filter((x): x is string => typeof x === 'string' && x.length <= 20_000).slice(0, 500) : [];
      if (site === 'coupang') {
        // 쿠팡은 page 이벤트를 대신하는 {type:'blocks', url, blocks}(CoupangEvent)다
        const u = str(m.url, 300);
        if (u === null) return;
        lastUrl = u;
        lastText = blocks.join('\n');
        ev = { type: 'blocks', url: u, blocks } as unknown as FlowEvent;
      } else {
        ev = { type: 'blocks', texts: blocks };
      }
    } else if (step === 'api' && awaiting === 'api') {
      // 페이지가 같은 출처 목록 주소를 다시 불러 모은 항목들 — 흐름이 주문으로 바꾼다(항목은 앱 안에서만 쓴다)
      if (m.name !== 'shop' && m.name !== 'pay') return;
      const items = Array.isArray(m.items) ? m.items.slice(0, 600) : [];
      const page = typeof m.page === 'number' && Number.isFinite(m.page) ? Math.max(0, Math.floor(m.page)) : 0;
      ev = m.failed === true
        ? { type: 'api', name: m.name, items, page, done: m.done === true, failed: true }
        : { type: 'api', name: m.name, items, page, done: m.done === true };
    } else if (step === 'fetched' && awaiting === 'fetched') {
      // 범용 요청 묶음의 답 — 줄인 JSON · 글자를 그대로 흐름에 넘긴다(앱 안에서만 쓰고 서버로 보내지 않는다)
      ev = { type: 'fetched', results: cleanFetchResults(m.results) };
    } else if (step === 'receipts' && awaiting === 'receipts') {
      // 영수증 요청 묶음의 답 — 허용 필드만 걸러 흐름에 넘긴다(앱 안에서만 쓰고 서버로 보내지 않는다)
      ev = { type: 'receipts', results: cleanReceiptResults(m.results) };
      // 줄마다의 결과 개수와 HTTP 번호만(줄 key 에는 주문번호 끝자리 · 시각 · 금액이 들어 있어 찍지 않는다)
      const tally: Record<string, number> = {};
      for (const r of ev.results) { const k = `${r.st}${r.status !== undefined ? `:${r.status}` : ''}`; tally[k] = (tally[k] ?? 0) + 1; }
      log('receipts', JSON.stringify(tally));
    } else if (step === 'error') {
      // 페이지 안 도구가 실패했다 — 20초를 기다리지 않고 시간 초과로 본다
      timeoutNow();
      return;
    } else {
      return;
    }
    awaiting = null;
    timeouts = 0;
    lastActionAt = host.now();
    feed(ev);
  };

  const tick = (): void => {
    if (state === 'idle' || state === 'done') return;
    const now = host.now();
    if (state === 'closing') {
      if (readDueAt && now >= readDueAt) { readDueAt = 0; host.inject(navScript({ kind: 'read' })); }
      if (closing && now >= closeDeadline) finalize(closing);
      return;
    }
    if (isWait()) {
      if (now - waitStartedAt > LOGIN_CAP_MS) { forceFinish(state === 'login' ? 'login-timeout' : 'attention-timeout'); return; }
      if (state === 'login' && now >= waitPollAt) {
        // 같은 주소 안에서 로그인 화면이 바뀌는 사이트를 위해 가끔 한 번 읽어 본다
        waitPollAt = now + LOGIN_POLL_MS;
        awaiting = 'read';
        host.inject(navScript({ kind: 'read' }));
      }
      return;
    }
    if (vnow() - startedAt > (args.siteCapMs ?? SITE_CAP_MS)) { forceFinish('site-cap', 'site-cap'); return; }
    if (pendingGoto) {
      // 쉬는 중 — 시간이 되면 이동한다(그 전에는 읽기 예약 · 20초 감시를 건드리지 않는다)
      if (now >= pendingGoto.dueAt) {
        const url = pendingGoto.url;
        pendingGoto = null;
        awaiting = 'read';
        lastActionAt = now;
        host.goto(url);
        emit();
      }
      return;
    }
    if (readDueAt && now >= readDueAt) {
      readDueAt = 0;
      awaiting = 'read';
      lastActionAt = now;
      host.inject(navScript({ kind: 'read' }));
      return;
    }
    if (awaiting && now - lastActionAt >= curWatchdogMs) timeoutNow();
  };

  const stop = (): void => {
    // 진행 중인 영수증 요청이 있으면 끊는다(답은 어차피 받지 않는다)
    if (state !== 'done' && state !== 'idle' && awaiting === 'fetched') { try { host.inject(ABORT_FETCH_SCRIPT); } catch { /* 웹뷰가 이미 없으면 그대로 멈춘다 */ } }
    if (state !== 'done' && state !== 'idle' && awaiting === 'receipts') { try { host.inject(ABORT_RECEIPTS_SCRIPT); } catch { /* 웹뷰가 이미 없으면 그대로 멈춘다 */ } }
    state = 'done'; awaiting = null; readDueAt = 0; closing = null; pendingGoto = null;
  };

  return { start, onPageChanged, onMessage, tick, resume, status, stop };
}
