/**
 * 요청 흐름 통합 시험 틀(시험 전용 · 앱 번들에 들어가지 않는다) — 구동기 + 흐름 + **실제 웹뷰 스크립트**를 가짜 페이지(노드 vm · 가짜 fetch) 위에서 처음부터 끝까지 돌린다.
 * 흐름이 낸 goto 는 가짜 페이지를 열고, read 는 그 페이지 글자로 답하고, api · receipts · fetch 스크립트는 vm 에서 router 가 주는 응답으로 실행한다.
 */
import vm from 'node:vm';
import { createFlowDriver, pageKey, READ_SETTLE_MS, type DriverResult } from './flowDriver';
import { FLOW_FACTORIES, FLOW_HOSTS, type FlowFactoryOptions, type FlowSite } from './flows';
import { navScript, type ReceiptOrder } from './naverReceipt';
import type { OutcomeEvent } from './runOutcome';

export type Reply = { status?: number; json?: unknown; text?: string; reject?: boolean; /** 로그인 주소로 되돌려짐 흉내 */ redirected?: boolean; url?: string };
export type Router = (url: string, init: { method?: string; body?: string }) => Reply;
/** nextData — 그 화면의 __NEXT_DATA__(내역 읽기 시험용) */
export type Page = { text: string | ((url: string) => string); nextData?: unknown; /** 이 화면을 읽은 뒤 사용자가 옮겨 간 것으로 치는 주소(로그인 뒤 돌아옴 흉내) — 흐름의 goto 가 아니라 gotos 에 안 남는다 */ after?: string };

const T0 = Date.UTC(2026, 9, 29, 1, 0, 0);
const READ_SCRIPT = navScript({ kind: 'read' });

/** 구동기를 돌리며, 흐름이 낸 goto 는 가짜 페이지를 열고 · read 는 그 페이지 글자로 · 그 밖 동작 스크립트는 vm 에서 가짜 fetch 로 실행한다 */
export async function runFlow(site: FlowSite, pages: Record<string, Page>, router: Router, options: FlowFactoryOptions = {}, known?: { orderNos?: string[]; listKeys?: string[]; tails?: string[] }) {
  const clock = { t: T0 };
  const gotos: string[] = [];
  const urls: string[] = [];
  const orders: ReceiptOrder[] = [];
  const outcomes: OutcomeEvent[] = [];
  const structures: { where: string; host: string; path: string; lines: string[] }[] = [];
  const results: DriverResult[] = [];
  const queue: string[] = [];
  let current = '';
  const d = createFlowDriver({
    site, factory: FLOW_FACTORIES[site], options: { ...options, now: undefined }, known,
    host: {
      goto: (u) => { gotos.push(u); current = u; queue.push(`goto:${u}`); },
      back: () => undefined,
      inject: (s) => { queue.push(s); },
      probe: () => undefined,
      structure: (where, host, path, lines) => { structures.push({ where, host, path, lines }); },
      now: () => clock.t,
    },
    onOrders: (o) => { orders.push(...o); },
    onOutcome: (e) => { outcomes.push(e); },
    onDone: (r) => { results.push(r); },
  });

  const runScript = async (script: string): Promise<void> => {
    const host = (/^https:\/\/([^/]+)/.exec(current)?.[1] ?? '');
    const win: Record<string, unknown> = { ReactNativeWebView: { postMessage: (s: string) => { d.onMessage(JSON.parse(s)); } } };
    const ctx: Record<string, unknown> = {
      window: win, location: { host, href: current }, URL, setTimeout, clearTimeout, AbortController, encodeURIComponent,
      // 지금 화면(주소에 페이지 열쇠가 든 것)의 __NEXT_DATA__ — 내역 읽기(scan)가 읽는다
      document: { getElementById: (id: string) => { const pg = Object.entries(pages).find(([k]) => current.includes(k))?.[1]; return id === '__NEXT_DATA__' && pg?.nextData !== undefined ? { textContent: JSON.stringify(pg.nextData) } : null; } },
      fetch: (url: string, init: { method?: string; body?: string; signal?: AbortSignal }) => {
        const abs = url.startsWith('/') ? `https://${host}${url}` : url;
        urls.push(`${init.method ?? 'GET'} ${abs}`);
        const rep = router(abs, { method: init.method, body: init.body });
        return new Promise((resolve, reject) => {
          if (rep.reject) { reject(new Error('net')); return; }
          const body = rep.text !== undefined ? rep.text : JSON.stringify(rep.json);
          const r: Record<string, unknown> = {
            ok: (rep.status ?? 200) >= 200 && (rep.status ?? 200) < 300, status: rep.status ?? 200, redirected: rep.redirected === true, url: rep.url ?? abs,
            json: () => (rep.text !== undefined ? Promise.reject(new Error('json')) : Promise.resolve(rep.json)),
            text: () => Promise.resolve(body),
          };
          r.clone = () => r;
          resolve(r);
        });
      },
    };
    win.window = win;
    vm.runInNewContext(script, ctx);
    // 스크립트가 답을 낼 때까지(진짜 타이머) 기다린다 — 답이 오면 구동기가 다음 동작을 queue 에 넣는다
    const before = queue.length + results.length;
    for (let i = 0; i < 600 && queue.length + results.length === before && results.length === 0; i++) await new Promise((r) => setTimeout(r, 5));
  };

  d.start();
  for (let step = 0; step < 400 && results.length === 0; step++) {
    const item = queue.shift();
    if (item === undefined) { clock.t += 1000; d.tick(); await new Promise((r) => setTimeout(r, 2)); continue; }
    if (item.startsWith('goto:') || item.startsWith('user:')) {
      const u = item.slice(5);
      d.onPageChanged(u);
      clock.t += READ_SETTLE_MS + 1;
      d.tick();
      continue;
    }
    if (item === READ_SCRIPT) {
      const key = pageKey(current);
      const page = pages[key];
      d.onMessage({ type: 'nav', step: 'read', url: key, text: page ? (typeof page.text === 'function' ? page.text(current) : page.text) : '' });
      if (page?.after) { current = page.after; queue.push(`user:${page.after}`); }
      continue;
    }
    await runScript(item);
  }
  return { results, orders, outcomes, structures, gotos, urls, hosts: FLOW_HOSTS[site] };
}

