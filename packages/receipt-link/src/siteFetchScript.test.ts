/**
 * 사이트 요청 동작(fetch) 스크립트 시험 — 스크립트 문자열 자체를 노드 vm 에서 가짜 fetch 로 돌려 본다(값은 모두 가짜).
 * 확인: 요청 모양(GET · POST 본문 · 헤더), 응답 해석 세 가지(json · nextData · text), 줄이기, 상태 갈래, 동시 수 · 간격 · 즉시 멈춤 · 마감, 클릭 · 이동 코드 없음.
 */
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { checkFetchRun, FETCH_PRUNE, type FetchReq, type FetchResult, type FetchRun } from './siteFetch';
import { fetchScript } from './siteFetchScript';

type Reply = { status?: number; json?: unknown; text?: string; reject?: boolean; redirected?: boolean; url?: string; delayMs?: number };
type Call = { url: string; init: { method?: string; headers?: Record<string, string>; body?: string; credentials?: string } };

const run = (reqs: FetchReq[], over: Partial<FetchRun> = {}): FetchRun => ({ reqs, conc: 3, staggerMs: 0, gapMs: 0, timeoutMs: 2000, deadlineMs: 4000, ...over });
const get = (key: string, url: string, as: FetchReq['as'] = 'json'): FetchReq => ({ key, method: 'GET', url, as });

async function exec(r: FetchRun, replies: (url: string) => Reply, opts: { afterStart?: (w: Record<string, unknown>) => void } = {}) {
  const posted: Array<{ type: string; step: string; results: FetchResult[] }> = [];
  const calls: Call[] = [];
  let inflight = 0;
  let maxInflight = 0;
  const win: Record<string, unknown> = { ReactNativeWebView: { postMessage: (s: string) => { posted.push(JSON.parse(s)); } } };
  const ctx: Record<string, unknown> = {
    window: win, location: { host: 'www.example.test' }, setTimeout, clearTimeout, AbortController,
    fetch: (url: string, init: Call['init'] & { signal?: AbortSignal }) => {
      calls.push({ url, init: { method: init.method, headers: init.headers, body: init.body, credentials: init.credentials } });
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      const rep = replies(url);
      return new Promise((resolve, reject) => {
        const finish = () => {
          inflight--;
          if (rep.reject) { reject(new Error('net')); return; }
          const body = rep.text !== undefined ? rep.text : JSON.stringify(rep.json);
          const r: Record<string, unknown> = {
            ok: (rep.status ?? 200) >= 200 && (rep.status ?? 200) < 300, status: rep.status ?? 200, redirected: rep.redirected === true, url: rep.url ?? url,
            json: () => (rep.text !== undefined ? Promise.reject(new Error('json')) : Promise.resolve(rep.json)),
            text: () => Promise.resolve(body),
          };
          r.clone = () => r;
          resolve(r);
        };
        const t = setTimeout(finish, rep.delayMs ?? 0);
        init.signal?.addEventListener?.('abort', () => { clearTimeout(t); inflight--; reject(new Error('abort')); });
      });
    },
  };
  win.window = win;
  vm.runInNewContext(fetchScript(r), ctx);
  opts.afterStart?.(win);
  for (let i = 0; i < 400 && posted.length === 0; i++) await new Promise((res) => setTimeout(res, 5));
  return { posted, calls, maxInflight, win };
}

describe('요청 모양', () => {
  it('GET: credentials include, accept 헤더, 본문 없음', async () => {
    const { calls } = await exec(run([get('a', 'https://api.example.test/orders?size=15')]), () => ({ json: { ok: 1 } }));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.example.test/orders?size=15');
    expect(calls[0].init).toMatchObject({ method: 'GET', credentials: 'include' });
    expect(calls[0].init.headers?.accept).toContain('application/json');
    expect(calls[0].init.body).toBeUndefined();
  });

  it('POST: JSON 본문을 그대로 보내고 content-type 을 application/json 으로 둔다(본문이 없으면 {})', async () => {
    const body = JSON.stringify({ page: 1, limit: 10, address: '' });
    const { calls } = await exec(run([{ key: 'p', method: 'POST', url: '/api/orders', body, as: 'json' }, { key: 'q', method: 'POST', url: '/api/detail', as: 'json' }]), () => ({ json: {} }));
    const p = calls.find((c) => c.url === '/api/orders')!;
    const q = calls.find((c) => c.url === '/api/detail')!;
    expect(p.init).toMatchObject({ method: 'POST', body, credentials: 'include' });
    expect(p.init.headers?.['content-type']).toBe('application/json');
    expect(q.init.body).toBe('{}');
  });

  it('as 가 json 이 아니면 html 도 받는 accept 를 쓰고, accept 를 직접 줄 수도 있다', async () => {
    const { calls } = await exec(run([get('a', '/page', 'nextData'), { ...get('b', '/x', 'text'), accept: 'application/json' }]), () => ({ text: '<html></html>' }));
    expect(calls.find((c) => c.url === '/page')!.init.headers?.accept).toContain('text/html');
    expect(calls.find((c) => c.url === '/x')!.init.headers?.accept).toBe('application/json');
  });
});

describe('응답 해석', () => {
  it('json: 줄인 JSON 을 data 로 — 긴 글자는 자르고 배열은 한도까지', async () => {
    const big = { list: Array.from({ length: FETCH_PRUNE.arr + 50 }, (_, i) => ({ id: i })), name: 'x'.repeat(FETCH_PRUNE.str + 100) };
    const { posted } = await exec(run([get('a', '/j')]), () => ({ json: big }));
    const r = posted[0].results[0];
    expect(r.st).toBe('ok');
    const d = r.data as { list: unknown[]; name: string };
    expect(d.name).toHaveLength(FETCH_PRUNE.str);
    expect(d.list.length).toBeLessThanOrEqual(FETCH_PRUNE.arr);
  });

  it('nextData: HTML 안의 __NEXT_DATA__ JSON 을 data 로, 없으면 shape', async () => {
    const html = '<html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"orders":[{"orderId":"A1"}]}}</script></body></html>';
    const ok = await exec(run([get('a', '/page', 'nextData')]), () => ({ text: html }));
    expect(ok.posted[0].results[0]).toMatchObject({ st: 'ok', data: { props: { orders: [{ orderId: 'A1' }] } } });
    const none = await exec(run([get('a', '/page', 'nextData')]), () => ({ text: '<html>없음</html>' }));
    expect(none.posted[0].results[0].st).toBe('shape');
  });

  it('깊이 20 의 안쪽 칸까지 남긴다(깊은 dehydratedState 의 판매자번호 같은 칸) — 깊이 한도는 24', async () => {
    let deep: Record<string, unknown> = { vendorId: 'A1234567' };
    for (let i = 0; i < 20; i++) deep = { n: deep };
    const { posted } = await exec(run([get('a', '/j')]), () => ({ json: deep }));
    let cur = posted[0].results[0].data as Record<string, unknown>;
    for (let i = 0; i < 20; i++) cur = cur.n as Record<string, unknown>;
    expect(cur).toEqual({ vendorId: 'A1234567' });
  });

  it('text 인데 HTML 안에 __NEXT_DATA__ 가 있으면 글자(text)와 함께 그 JSON 도 data 로 준다', async () => {
    const html = '<html><body><p>영수증</p><script id="__NEXT_DATA__" type="application/json">{"props":{"receipt":{"approvalNo":"1"}}}</script></body></html>';
    const { posted } = await exec(run([get('a', '/r', 'text')]), () => ({ text: html }));
    const r = posted[0].results[0];
    expect(r.text).toBe('영수증');
    expect(r.data).toEqual({ props: { receipt: { approvalNo: '1' } } });
  });

  it('text: HTML 은 script · style · 태그를 걷은 글자로, JSON 본문이면 data 와 원문 text 를 함께', async () => {
    const html = '<html><head><style>.a{}</style><script>var x=1;</script></head><body><p>승인번호 &amp; 12345</p><div>합계 5,000원</div></body></html>';
    const t = await exec(run([get('a', '/r', 'text')]), () => ({ text: html }));
    const r = t.posted[0].results[0];
    expect(r.st).toBe('ok');
    expect(r.text).toBe('승인번호 & 12345 합계 5,000원');
    expect(r.data).toBeUndefined();
    const j = await exec(run([get('a', '/r', 'text')]), () => ({ text: '{"CARD_APP_NO":"1","GOODS_AMT":"5000"}' }));
    expect(j.posted[0].results[0].data).toEqual({ CARD_APP_NO: '1', GOODS_AMT: '5000' });
    expect(j.posted[0].results[0].text).toBe('{"CARD_APP_NO":"1","GOODS_AMT":"5000"}');
  });
});

describe('결과 갈래', () => {
  const st = async (reply: Reply, as: FetchReq['as'] = 'json') => (await exec(run([get('a', '/x', as)]), () => reply)).posted[0].results[0];

  it('401 · 로그인 주소로 되돌려짐 → login, 403 · 429 → blocked, 그 밖 오류 응답 → http(번호), 연결 실패 → net, JSON 아님 → shape', async () => {
    expect((await st({ status: 401 })).st).toBe('login');
    expect((await st({ redirected: true, url: 'https://nid.naver.com/nidlogin.login' })).st).toBe('login');
    expect((await st({ redirected: true, url: 'https://www.example.test/member/login?next=/x' })).st).toBe('login');
    expect((await st({ status: 403 })).st).toBe('blocked');
    expect((await st({ status: 429 })).st).toBe('blocked');
    expect(await st({ status: 500 })).toMatchObject({ st: 'http', status: 500 });
    // 4xx 는 본문의 오류 코드 이름만 why 로(문장 · 값은 싣지 않는다)
    expect(await st({ status: 400, text: '{"code":"INVALID_ORDER","message":"주문 정보가 올바르지 않습니다"}' })).toEqual({ key: 'a', st: 'http', status: 400, why: 'invalid_order' });
    expect(await st({ status: 400, text: '<html>bad</html>' })).toEqual({ key: 'a', st: 'http', status: 400 });
    expect((await st({ reject: true })).st).toBe('net');
    expect((await st({ text: '<html>' })).st).toBe('shape');
    // JSON 자리에 로그인 화면(비밀번호 입력란)이 200 으로 오면 login — 쿠키 없는 세션에 로그인 페이지를 그대로 주는 사이트(1.2.3)
    expect((await st({ text: '<html><body><form action="/store/login/loginProc.do"><input type="text" name="loginId"><input type="password" name="password"></form></body></html>' })).st).toBe('login');
    expect((await st({ text: '<html><body><input type="text" name="q"></body></html>' })).st).toBe('shape');
  });

  it('요청이 안 돌아와도 마감(deadlineMs)에 맞춰 답한다 — 못 받은 건 net', async () => {
    const { posted } = await exec(run([get('a', '/slow')], { timeoutMs: 60_000, deadlineMs: 80 }), () => ({ json: {}, delayMs: 5_000 }));
    expect(posted[0].results).toEqual([{ key: 'a', st: 'net' }]);
  });
});

describe('속도 · 멈춤', () => {
  const many = (n: number): FetchReq[] => Array.from({ length: n }, (_, i) => get(`k${i}`, `/r${i}`));

  it('동시 수는 conc 를 넘지 않고, 결과는 요청 순서 그대로다', async () => {
    const { posted, maxInflight } = await exec(run(many(7), { conc: 3 }), () => ({ json: {}, delayMs: 10 }));
    expect(maxInflight).toBeLessThanOrEqual(3);
    expect(maxInflight).toBeGreaterThan(1);
    expect(posted[0].results.map((r) => r.key)).toEqual(['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6']);
  });

  it('conc 1 + gapMs 면 하나씩, 요청 사이를 쉰다', async () => {
    const t0 = Date.now();
    const { posted, maxInflight } = await exec(run(many(3), { conc: 1, gapMs: 60 }), () => ({ json: {} }));
    expect(maxInflight).toBe(1);
    expect(posted[0].results).toHaveLength(3);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(110);
  });

  it('window.__ytAbortFetch() 를 부르면 아직 안 보낸 요청은 보내지 않는다', async () => {
    const { calls } = await exec(run(many(8), { conc: 1, gapMs: 50 }), () => ({ json: {}, delayMs: 20 }), {
      afterStart: (w) => { setTimeout(() => { (w.__ytAbortFetch as () => void)(); }, 30); },
    });
    await new Promise((res) => setTimeout(res, 250));
    expect(calls.length).toBeLessThan(8);
  });
});

describe('검사 · 클릭 없음', () => {
  it('요청의 모양이 틀리면 스크립트를 만들지 않는다(주소는 https 절대 주소나 / 로 시작하는 경로만)', () => {
    const ok = run([get('a', 'https://api.example.test/x')]);
    expect(() => checkFetchRun(ok)).not.toThrow();
    expect(() => fetchScript(run([get('a', 'http://api.example.test/x')]))).toThrow();
    expect(() => fetchScript(run([get('a', 'javascript:alert(1)')]))).toThrow();
    expect(() => fetchScript(run([{ key: 'a', method: 'GET', url: '/x', as: 'json', body: '{}' }]))).toThrow();
    expect(() => fetchScript(run([]))).toThrow();
    expect(() => fetchScript(run(Array.from({ length: 13 }, (_, i) => get(`k${i}`, '/x'))))).toThrow();
    expect(() => fetchScript(run([get('a', '/x')], { conc: 0 }))).toThrow();
  });

  it('스크립트에 클릭 · 화면 이동 코드가 없다', () => {
    const code = fetchScript(run([get('a', '/x')]));
    for (const banned of ['.click(', 'dispatchEvent', 'location.href', 'location.assign', 'location.replace', 'window.open', '.submit(']) expect(code).not.toContain(banned);
    expect(code).toContain("credentials: 'include'");
  });
});
