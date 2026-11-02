/**
 * 네이버 영수증 요청 스크립트 시험 — 스크립트 문자열 자체를 노드 vm 에서 가짜 fetch 로 돌려 본다(값은 모두 가짜).
 * 확인: 요청 주소 모양(대표님 23:20 A형 · 23:23 B형), 허용 필드만 내보냄, 짝 얻기(/web-api/receipts/{주문번호}), 실패 갈래, 동시 수 상한, 즉시 멈춤, 클릭 · 이동 코드 없음.
 */
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { checkReceiptsRun, receiptsScript, RECEIPTS_BATCH, RECEIPTS_CONC, type ReceiptJob, type ReceiptResult, type ReceiptsRun } from './naverReceiptsScript';

const TID = '20261020111111111111';
const PAYID = '20261020222222222222';
const NP = '20261020NP1673267';
const PO = 'PD2026102000012345';
const ORDER = '2026102012345678';

type Reply = { status?: number; json?: unknown; text?: string; raw?: string; reject?: boolean; redirected?: boolean; url?: string; delayMs?: number };

/** 영수증 목록 화면(대표님 22:28 원문 길) 응답 — 대표님 14:19 원문 모양의 「카드영수증」 링크를 담은 HTML. data 안에서 tid · payId · productOrderNo 가 한 객체에 있는 곳마다 링크 하나(가짜) */
const issueHtml = (data: unknown): string => {
  const links: string[] = [];
  const walk = (o: unknown): void => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    const r = o as Record<string, unknown>;
    if (r.tid !== undefined && r.payId !== undefined && r.productOrderNo !== undefined) {
      links.push(`<a class="btn" href="/receipts/preview/card?tid=${String(r.tid)}&amp;productOrderNo=${String(r.productOrderNo)}&amp;exitType=back&amp;payId=${String(r.payId)}" data-nlog-click="rec.card">카드영수증</a>`);
    }
    Object.values(r).forEach(walk);
  };
  walk(data);
  return `<html><body><div id="__next">${links.join('')}</div><script id="__NEXT_DATA__" type="application/json">{"props":{}}</script></body></html>`;
};

const run = (over: Partial<ReceiptsRun> & { jobs: ReceiptJob[] }): ReceiptsRun => ({ conc: 4, staggerMs: 0, gapMs: 0, timeoutMs: 2000, deadlineMs: 4000, ...over });

/** 스크립트를 돌리고 {step:'receipts'} 답과 부른 주소들을 돌려준다. replies 는 주소(쿼리 포함) 앞부분 → 응답 */
async function exec(r: ReceiptsRun, replies: (url: string) => Reply, opts: { host?: string; path?: string; nextData?: unknown; nextRaw?: string; anchors?: string[]; labels?: string[]; openUrl?: string; afterStart?: (ctx: Record<string, unknown>) => void } = {}) {
  const posted: Array<{ type: string; step: string; results: ReceiptResult[] }> = [];
  const urls: string[] = [];
  const inits: Array<Record<string, unknown>> = [];
  let inflight = 0;
  let maxInflight = 0;
  const win: Record<string, unknown> = { ReactNativeWebView: { postMessage: (s: string) => { posted.push(JSON.parse(s)); } }, open: () => null };
  const ctx: Record<string, unknown> = {
    window: win,
    location: { host: opts.host ?? 'pay.naver.com', pathname: opts.path ?? '/' },
    document: {
      getElementById: (id: string) => (id === '__NEXT_DATA__' && opts.nextRaw !== undefined ? { textContent: opts.nextRaw } : id === '__NEXT_DATA__' && opts.nextData !== undefined ? { textContent: JSON.stringify(opts.nextData) } : null),
      // 화면에 그려진 링크 · 버튼(간편결제 화면 시험용)
      querySelectorAll: (sel: string) => (sel.includes('/receipts/preview/card') ? (opts.anchors ?? []).map((h) => ({ getAttribute: () => h, textContent: '' })) : (opts.labels ?? []).map((t) => ({ getAttribute: () => '', textContent: t, click: () => { if (/영수증/.test(t) && opts.openUrl) (win.open as (u: string) => void)(opts.openUrl); } }))),
    },
    setTimeout, clearTimeout,
    AbortController,
    fetch: (url: string, init?: { signal?: AbortSignal } & Record<string, unknown>) => {
      urls.push(url);
      inits.push((init ?? {}) as Record<string, unknown>);
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      const rep = replies(url);
      return new Promise((resolve, reject) => {
        const finish = () => {
          inflight--;
          if (rep.reject) { reject(new Error('net')); return; }
          resolve({
            ok: (rep.status ?? 200) >= 200 && (rep.status ?? 200) < 300, status: rep.status ?? 200, redirected: rep.redirected === true, url: rep.url ?? url,
            json: () => (rep.text !== undefined ? Promise.reject(new Error('json')) : Promise.resolve(rep.json)),
            // text() 는 실제 응답처럼 원문 그대로 — rep.raw 가 있으면 그대로(큰 숫자 시험)
            text: () => Promise.resolve(rep.raw !== undefined ? rep.raw : rep.text !== undefined ? rep.text : url.startsWith('/receipts/issue-history') ? issueHtml(rep.json) : JSON.stringify(rep.json)),
          });
        };
        const t = setTimeout(finish, rep.delayMs ?? 0);
        init?.signal?.addEventListener?.('abort', () => { clearTimeout(t); inflight--; reject(new Error('abort')); });
      });
    },
  };
  win.window = win;
  vm.runInNewContext(receiptsScript(r), ctx);
  opts.afterStart?.(win);
  for (let i = 0; i < 2400 && posted.length === 0; i++) await new Promise((res) => setTimeout(res, 5));
  return { posted, urls, inits, maxInflight, win };
}

const CARD = {
  trade: { cardCompanyName: '삼성카드', approvalNo: '12345678', cardNo: '1234-****-****-5678', type: '신용', ownerType: '개인', installmentType: '일시불', approvalDateTime: '2026-10-20T10:04:43', cancelDateTime: null, productName: '가짜 상품', productOrderNo: PO, productType: 'GENERAL' },
  seller: { name: '가짜상점', representative: '홍길동', businessNo: '123-45-67890', telNo: '02-000-0000', address: '가짜 주소' },
  merchant: { name: '네이버파이낸셜', businessNo: '000-00-00000' },
  paymentDetails: { approvalAmount: 12300, cancelAmount: 0, supplyAmount: 11182, taxAmount: 1118, totalAmount: 12300 },
};

describe('요청 형식', () => {
  it('B형: 목록에 짝(payId · tid · productOrderNo)이 있으면 바로 card-single 한 번 — 주소가 대표님 23:23 형식과 같다', async () => {
    const { posted, urls } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO, payId: PAYID, tid: TID }] }), () => ({ json: CARD }));
    expect(urls).toEqual([`/web-api/receipts/card-single?payId=${PAYID}&tid=${TID}&productOrderNo=${PO}&isFromPayCenter=false`]);
    expect(posted[0].results[0]).toMatchObject({ key: 'k1', st: 'ok' });
  });

  it('A형: paymentId(NP) + tid 만 있으면 svcInfType=PD 형식(대표님 23:20)', async () => {
    const { urls } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, paymentId: NP, tid: TID }] }), () => ({ json: CARD }));
    expect(urls).toEqual([`/web-api/receipts/card-single?svcInfType=PD&paymentId=${NP}&tid=${TID}&isFromPayCenter=false`]);
  });

  it('응답에서 원문 칸만 내보낸다 — 대표님 14:26 「원문 칸 전부」(카드번호 · 대표자 · 전화 · 주소 · 가맹점 포함), 원문에 없는 칸은 나가지 않는다', async () => {
    const { posted } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO, payId: PAYID, tid: TID }] }), () => ({ json: CARD }));
    const slip = posted[0].results[0].slip;
    // 대표님 14:15 원문 칸 전부(카드번호는 사이트가 가린 값 그대로) — 원문에 없는 칸(productType)은 옮기지 않는다
    expect(slip).toEqual({ approvalNo: '12345678', cardCompany: '삼성카드', approvalAt: '2026-10-20T10:04:43', cancelAt: undefined, productName: '가짜 상품', sellerName: '가짜상점', businessNo: '123-45-67890', amount: 12300, cancelAmount: 0,
      cardNo: '1234-****-****-5678', tradeType: '신용', ownerType: '개인', installmentType: '일시불', productOrderNo: PO,
      sellerRepresentative: '홍길동', sellerTel: '02-000-0000', sellerAddress: '가짜 주소', merchantName: '네이버파이낸셜', merchantBusinessNo: '000-00-00000',
      supplyAmount: 11182, taxAmount: 1118, totalAmount: 12300 });
    expect(JSON.stringify(posted)).not.toContain('GENERAL');
  });

  it('짝이 목록에 없으면 대표님 22:28 원문 길(/receipts/issue-history?orderNo=) 화면을 요청으로 받아 그 HTML 의 「카드영수증」 링크(14:19 원문)에서 tid · productOrderNo · payId 를 읽고 card-single 을 부른다', async () => {
    const receipt = { orderNo: ORDER, orderReceipt: { productOrderReceipts: [{ productOrderNo: PO, cardReceiptPresent: true, tid: TID, payId: PAYID }, { productOrderNo: 'PD2026102099999999', cardReceiptPresent: false }] } };
    const { urls, posted } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO }] }), (u) => (u.includes('card-single') ? { json: CARD } : { json: receipt }));
    expect(urls).toEqual([`/receipts/issue-history?orderNo=${ORDER}`, `/web-api/receipts/card-single?payId=${PAYID}&tid=${TID}&productOrderNo=${PO}&isFromPayCenter=false`]);
    expect(posted[0].results[0].st).toBe('ok');
  });

});

describe('결과 갈래', () => {
  const job: ReceiptJob = { key: 'k1', orderNo: ORDER, productOrderNo: PO };
  const st = async (reply: (u: string) => Reply) => (await exec(run({ jobs: [job] }), reply)).posted[0].results[0].st;

  it('영수증 목록 화면에 「카드영수증」 링크가 없으면 「영수증 없음」 — 실패가 아니다(대표님 11-02 ④)', async () => {
    // 카드영수증이 원래 없는 결제는 「영수증 없음」으로 건너뛴다(실패 아님)
    expect(await st(() => ({ json: { orderReceipt: { productOrderReceipts: [{ productOrderNo: PO, cardReceiptPresent: false }] } } }))).toBe('none');
    expect(await st(() => ({ json: { orderNo: ORDER, orderReceipt: {} } }))).toBe('none');
    expect(await st(() => ({ json: { orderReceipt: { productOrderReceipts: [{ productOrderNo: PO, cardReceiptPresent: true }] } } }))).toBe('none');
  });

  it('401 · 로그인 주소로 되돌려짐 → login, 403 · 429 → blocked, 500 · 연결 실패 → net, 링크 없는 화면 → nopair', async () => {
    expect(await st(() => ({ status: 401 }))).toBe('login');
    expect(await st(() => ({ redirected: true, url: 'https://nid.naver.com/nidlogin.login' }))).toBe('login');
    expect(await st(() => ({ status: 403 }))).toBe('blocked');
    expect(await st(() => ({ status: 429 }))).toBe('blocked');
    expect(await st(() => ({ status: 500 }))).toBe('net');
    expect(await st(() => ({ reject: true }))).toBe('net');
    expect(await st(() => ({ text: '<html>' }))).toBe('none');   // 영수증 목록 화면은 HTML — 링크도 orderReceipt 짝도 없으면 「영수증 없음」
  });

  it('영수증 응답에 승인 시각이 없으면 shape', async () => {
    const j: ReceiptJob = { key: 'k1', orderNo: ORDER, productOrderNo: PO, payId: PAYID, tid: TID };
    expect((await exec(run({ jobs: [j] }), () => ({ json: { trade: {}, seller: {}, paymentDetails: {} } }))).posted[0].results[0].st).toBe('shape');
  });

  it('pay.naver.com 이 아닌 곳에서 돌면 요청 없이 전부 net', async () => {
    const { posted, urls } = await exec(run({ jobs: [job] }), () => ({ json: CARD }), { host: 'shopping.naver.com' });
    expect(urls).toEqual([]);
    expect(posted[0].results[0].st).toBe('net');
  });

  it('요청이 안 돌아와도 마감(deadlineMs)에 맞춰 답한다 — 못 받은 건 net', async () => {
    const j: ReceiptJob = { key: 'k1', orderNo: ORDER, productOrderNo: PO, payId: PAYID, tid: TID };
    const { posted } = await exec(run({ jobs: [j], timeoutMs: 60_000, deadlineMs: 80 }), () => ({ json: CARD, delayMs: 5_000 }));
    expect(posted[0].results).toEqual([{ key: 'k1', st: 'net' }]);
  });
});

describe('속도 · 멈춤', () => {
  const many = (n: number): ReceiptJob[] => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, orderNo: ORDER, productOrderNo: PO, payId: PAYID, tid: TID }));

  it('동시에 부르는 수는 conc 를 넘지 않고, 결과는 작업 순서 그대로다', async () => {
    const { posted, maxInflight } = await exec(run({ jobs: many(7), conc: 3 }), () => ({ json: CARD, delayMs: 10 }));
    expect(maxInflight).toBeLessThanOrEqual(3);
    expect(maxInflight).toBeGreaterThan(1);
    expect(posted[0].results.map((r) => r.key)).toEqual(['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6']);
  });

  it('conc 1 + gapMs 면 하나씩, 요청 사이를 쉰다(막혔을 때의 느린 길)', async () => {
    const t0 = Date.now();
    const { posted, maxInflight } = await exec(run({ jobs: many(3), conc: 1, gapMs: 60 }), () => ({ json: CARD }));
    expect(maxInflight).toBe(1);
    expect(posted[0].results).toHaveLength(3);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(110);
  });

  it('window.__ytAbortReceipts() 를 부르면 아직 안 보낸 요청은 보내지 않는다', async () => {
    let called = false;
    const { urls, win } = await exec(run({ jobs: many(8), conc: 1, gapMs: 50 }), () => ({ json: CARD, delayMs: 20 }), {
      afterStart: (w) => { setTimeout(() => { (w.__ytAbortReceipts as () => void)(); called = true; }, 30); },
    });
    await new Promise((res) => setTimeout(res, 250));
    expect(called).toBe(true);
    expect(typeof win.__ytAbortReceipts).toBe('function');
    expect(urls.length).toBeLessThan(8);
  });
});

describe('검사 · 클릭 없음', () => {
  it('작업의 모양이 틀리면 스크립트를 만들지 않는다(주소에 들어가는 값은 숫자 · PD · NP 모양만)', () => {
    const ok: ReceiptsRun = run({ jobs: [{ key: 'k', orderNo: ORDER }] });
    expect(() => checkReceiptsRun(ok)).not.toThrow();
    expect(() => receiptsScript({ ...ok, jobs: [{ key: 'k', orderNo: '12ab' }] })).toThrow();
    expect(() => receiptsScript({ ...ok, jobs: [{ key: 'k', orderNo: ORDER, tid: '1&x=2' }] })).toThrow();
    expect(() => receiptsScript({ ...ok, jobs: [] })).toThrow();
    expect(() => receiptsScript({ ...ok, conc: 0 })).toThrow();
    expect(() => receiptsScript({ ...ok, jobs: Array.from({ length: 17 }, () => ({ key: 'k', orderNo: ORDER })) })).toThrow();
  });

  it('묶음 · 동시 수 상수가 구동기 감시(20초)보다 짧게 끝나도록 잡혀 있다', () => {
    expect(RECEIPTS_BATCH).toBeLessThanOrEqual(16);
    expect(RECEIPTS_CONC).toBeLessThanOrEqual(8);
  });

  it('스크립트는 화면을 이동시키지 않고 클릭도 없다 — 11-02 부터 네이버는 전부 HTTP(버튼 눌러 주소 받기는 지웠다)', () => {
    const code = receiptsScript(run({ jobs: [{ key: 'k', orderNo: ORDER }] }));
    for (const banned of ['dispatchEvent', 'location.href =', 'location.assign', 'location.replace', 'form.submit', '.submit(', '.click()', 'window.open =']) expect(code).not.toContain(banned);
    expect(code).toContain("credentials: 'include'");
  });
});

describe('10-29 12:00 실행 뒤 보강 — 후보 고르기 · 형식 재시도 · 실패 진단', () => {
  const PO_NUM = '2026102000012345';
  // 구조 기록(행 140)의 모양: 상품 영수증이 배송비 겹(orderReceipt.deliveryFeeReceipts[]) 안에 있고, 그 겹도 tid · payNo 를 가진다
  const nested = (po: string, card = true) => ({
    orderNo: ORDER,
    orderReceipt: { deliveryFeeReceipts: [{ orderDeliveryFeeNo: 'x', cardReceiptPresent: true, tid: '20261020333333333333', payId: '20261020444444444444', productOrderReceipts: [{ productOrderNo: po, cardReceiptPresent: card, tid: TID, payId: PAYID }] }] },
  });


  it('목록 번호와 맞는 상품이 없어도 상품 번호가 있는 첫 카드 영수증을 고른다(배송비 겹이 아니라)', async () => {
    const { urls } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: '2026102099999999' }] }), (u) => (u.includes('card-single') ? { json: CARD } : { json: nested(PO) }));
    expect(urls[1]).toContain(`payId=${PAYID}&tid=${TID}&productOrderNo=${PO}`);
  });




  it('거절(4xx) · 5xx · 연결 실패 모두 다시 부르지 않는다(원문 밖 재시도 없음, 대표님 10-29 13:46)', async () => {
    const four = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO_NUM, payId: PAYID, tid: TID }] }), () => ({ status: 400 }));
    expect(four.urls).toHaveLength(1);
    const { urls } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO_NUM, payId: PAYID, tid: TID }] }), () => ({ status: 500 }));
    expect(urls).toHaveLength(1);
  });

  it('거절당하면 진단을 단다 — 부른 칸 이름 · 값의 자릿수 모양(값 없음) · HTTP 번호 · 시도 횟수', async () => {
    const { posted } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO_NUM, payId: PAYID, tid: TID }] }), () => ({ status: 404 }));
    const r = posted[0].results[0];
    expect(r).toMatchObject({ st: 'net', status: 404, diag: { w: 'card', status: 404 } });
    expect(r.diag?.lines).toEqual(expect.arrayContaining(['sent payId,tid,productOrderNo', 'tries 1', 'fmt payId : n20', 'fmt tid : n20', 'fmt productOrderNo : n16']));
    const raw = JSON.stringify(posted);
    for (const v of [PAYID, TID, PO, PO_NUM, ORDER]) expect(raw).not.toContain(v);
  });

  it('「카드영수증」 링크가 0개면 anchor 0 · 화면 크기 · __NEXT_DATA__ · orderReceipt 유무만 진단으로 남기고 「영수증 없음」 — 값은 없다(대표님 11-02 ④)', async () => {
    const { posted, urls } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO }] }), () => ({ json: { orderNo: ORDER } }));
    const r = posted[0].results[0];
    expect(urls).toEqual([`/receipts/issue-history?orderNo=${ORDER}`]);
    expect(r.st).toBe('none');
    expect(r.diag).toMatchObject({ w: 'issue', status: 200 });
    expect(r.diag?.lines).toEqual(['anchor 0', 'html 0KB', 'nextdata yes', 'orderReceipt no']);
  });

  it('링크가 여러 개면 첫 링크로 부르고, href 의 &amp; 를 풀어 읽는다 · 같은 출처가 아닌 href 는 그대로 쓰지 않고 같은 모양의 같은 출처 주소를 Referer 로 쓴다', async () => {
    const html = '<a href="https://evil.example.com/receipts/preview/card?tid=' + TID + '&amp;productOrderNo=' + PO + '&amp;exitType=back&amp;payId=' + PAYID + '" data-nlog-click="rec.card">카드영수증</a>'
      + '<a href="/receipts/preview/card?tid=20261020999999999999&amp;productOrderNo=PD2026102000099999&amp;exitType=back&amp;payId=20261020888888888888">카드영수증</a>';
    const { urls, inits } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO }] }), (u) => (u.includes('card-single') ? { json: CARD } : { raw: html }));
    expect(urls[1]).toBe(`/web-api/receipts/card-single?payId=${PAYID}&tid=${TID}&productOrderNo=${PO}&isFromPayCenter=false`);
    expect(inits[1].referrer).toBe(`https://pay.naver.com/receipts/preview/card?tid=${TID}&productOrderNo=${PO}&exitType=back&payId=${PAYID}`);
  });

  it('진단은 한 번 실행에 3줄까지만 단다', async () => {
    const jobs: ReceiptJob[] = [1, 2, 3, 4, 5].map((n) => ({ key: `k${n}`, orderNo: `202610200000000${n}`, productOrderNo: PO, payId: PAYID, tid: TID }));
    const { posted } = await exec(run({ jobs }), () => ({ status: 404 }));
    expect(posted[0].results.filter((x) => x.diag)).toHaveLength(3);
    expect(posted[0].results.every((x) => x.st === 'net' && x.status === 404)).toBe(true);
  });
});

describe('네이버페이 내역 읽기(scan) — 이 페이지의 __NEXT_DATA__ 에서 대표님 23:20 원문 이름 paymentId · tid 로만 짝을 찾는다', () => {
  const NP2 = '20261021NP9988776655';
  const TID2 = '20261021555555555555';
  const scanRun = (over: Partial<ReceiptsRun> = {}) => run({ jobs: [], scan: true, ...over });
  // 두 번째는 값 모양은 맞지만 이름이 다르다(pid · someTid) — 이름이 원문과 다르면 쓰지 않는다
  const DATA = { props: { pageProps: { dehydratedState: { queries: [{ state: { data: { pages: [{ items: [
    { when: '2026-10-20', paymentId: NP, tid: TID, name: '가짜1' },
    { when: '2026-10-21', pid: NP2, someTid: TID2, name: '가짜2' },
    { when: '2026-10-22', other: 'abc', name: '짝 아님' },
  ] }] } } }] } } }, runtimeConfig: { URL: { A: 'x' } } };

  it('이름이 paymentId · tid 인 짝만 svcInfType=PD 형식 card-single 로 부르고(이름이 다르면 값 모양이 맞아도 쓰지 않는다), 결과 key 는 np:<결제 번호>', async () => {
    const { posted, urls } = await exec(scanRun(), () => ({ json: CARD }), { nextData: DATA });
    expect(urls).toEqual([`/web-api/receipts/card-single?svcInfType=PD&paymentId=${NP}&tid=${TID}&isFromPayCenter=false`]);
    const res = posted[0].results;
    expect(res.filter((x) => x.key.startsWith('np:') && x.key !== 'np:scan').map((x) => [x.key, x.st])).toEqual([[`np:${NP}`, 'ok']]);
    expect(res.find((x) => x.key === 'np:scan')).toMatchObject({ st: 'none', found: 1, diag: { w: 'npscan', status: 200 } });
  });

  it('npscan 진단에 이 화면 데이터의 키 이름 트리(값 없음)를 단다 — paymentId · tid 이름의 경로를 찾으려고(대표님 14:31 ③)', async () => {
    const { posted } = await exec(scanRun(), () => ({ json: CARD }), { nextData: DATA });
    const lines = posted[0].results.find((x) => x.key === 'np:scan')?.diag?.lines ?? [];
    expect(lines).toContain('tree pageProps.dehydratedState.queries[].state.data.pages[].items[].paymentId : string');
    expect(lines).toContain('tree pageProps.dehydratedState.queries[].state.data.pages[].items[].someTid : string');
    // 값은 없다
    expect(lines.join(' ')).not.toContain(NP);
    expect(lines.join(' ')).not.toContain('가짜1');
    expect(lines.every((l) => l.length <= 200)).toBe(true);
  });

  it('이미 가져온 결제 번호(skip)는 부르지 않는다', async () => {
    const { urls, posted } = await exec(scanRun({ skip: [NP] }), () => ({ json: CARD }), { nextData: DATA });
    expect(urls).toEqual([]);
    expect(posted[0].results.find((x) => x.key === 'np:scan')?.found).toBe(0);
  });

  it('scan 진단에는 값이 아니라 어디에 어떤 모양이 있는지만 남는다(hit 경로 : 자릿수 모양)', async () => {
    const { posted } = await exec(scanRun(), () => ({ json: CARD }), { nextData: DATA });
    const lines = posted[0].results.find((x) => x.key === 'np:scan')?.diag?.lines ?? [];
    expect(lines).toEqual(expect.arrayContaining(['has true', 'cut false', 'pairs 1', 'queued 1']));
    // 원문 이름(paymentId · tid)이 있는 경로만 남는다 — 이름이 다른 칸(pid · someTid)은 기록하지 않는다
    expect(lines.filter((l) => l.startsWith('hit '))).toEqual(['hit pageProps.dehydratedState.queries[0].state.data.pages[0].items[0].paymentId : n8a2n7', 'hit pageProps.dehydratedState.queries[0].state.data.pages[0].items[0].tid : n20']);
    const raw = JSON.stringify(lines);
    for (const v of [NP, NP2, TID, TID2, '가짜1']) expect(raw).not.toContain(v);
  });

  it('payId · tid · productOrderNo 묶음은 네이버페이 내역에서 쓰지 않는다(23:20 원문은 paymentId · tid 뿐)', async () => {
    const data = { props: { list: [{ payId: PAYID, tid: TID, productOrderNo: PO }] } };
    const { urls } = await exec(scanRun(), () => ({ json: CARD }), { nextData: data });
    expect(urls).toEqual([]);
  });

  it('__NEXT_DATA__ 가 없거나 짝이 없으면 요청 없이 끝나고 found 0 · has 를 알린다', async () => {
    const none = await exec(scanRun(), () => ({ json: CARD }));
    expect(none.urls).toEqual([]);
    expect(none.posted[0].results).toEqual([expect.objectContaining({ key: 'np:scan', found: 0, diag: expect.objectContaining({ lines: ['has false', 'cut false', 'pairs 0', 'queued 0', 'rows 0 miss 0'] }) })]);
    const empty = await exec(scanRun(), () => ({ json: CARD }), { nextData: { props: { a: 1 } } });
    expect(empty.urls).toEqual([]);
    expect(empty.posted[0].results[0]).toMatchObject({ key: 'np:scan', found: 0 });
  });

  it('주문 줄 요청과 같은 실행에서 함께 돌고(scan 은 뒤에 붙음), 짝은 200개까지만(한 실행에 간편결제 전부)', async () => {
    const many = { props: { items: Array.from({ length: 201 }, (_, n) => ({ paymentId: `202610${String(10 + (n % 20)).padStart(2, '0')}NP${String(1000000000 + n)}`, tid: `2026101${String(100000000000 + n)}` })) } };
    const { posted, urls } = await exec(scanRun({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO, payId: PAYID, tid: TID }] }), () => ({ json: CARD }), { nextData: many });
    expect(urls.length).toBe(201);
    expect(posted[0].results[0].key).toBe('k1');
    expect(posted[0].results.at(-1)).toMatchObject({ key: 'np:scan', found: 200 });
  });

  it('scan 검사 — jobs 0건은 scan 일 때만, skip 은 영숫자 8~30자 600개까지', () => {
    expect(() => checkReceiptsRun(run({ jobs: [] }))).toThrow('bad jobs');
    expect(() => checkReceiptsRun(scanRun())).not.toThrow();
    expect(() => checkReceiptsRun(scanRun({ skip: ['short'] }))).toThrow('bad skip');
    expect(() => checkReceiptsRun(scanRun({ skip: ['20261020NP1673267', "x'; alert(1) //aaaaaaaa"] }))).toThrow('bad skip');
    expect(() => checkReceiptsRun(scanRun({ skip: Array.from({ length: 601 }, () => '2026102012345678') }))).toThrow('bad skip');
  });
});

describe('Codex 검토 반영 — 20자리 숫자 아이디 · Referer', () => {

  it('__NEXT_DATA__ 의 숫자 tid(20자리)도 문자열로 읽는다', async () => {
    const NPX = '20261020NP1673267';
    const nextRaw = `{"props":{"items":[{"paymentId":"${NPX}","tid":${TID}}]}}`;
    const { urls } = await exec(run({ jobs: [], scan: true }), () => ({ json: CARD }), { nextRaw });
    expect(urls).toEqual([`/web-api/receipts/card-single?svcInfType=PD&paymentId=${NPX}&tid=${TID}&isFromPayCenter=false`]);
  });

  it('16자리 미만 숫자(금액 등)는 그대로 숫자로 읽는다', async () => {
    const raw = JSON.stringify(CARD).replace('"approvalAmount":12300', '"approvalAmount":12300');
    const { posted } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO, payId: PAYID, tid: TID }] }), () => ({ raw }));
    expect(posted[0].results[0].slip?.amount).toBe(12300);
  });

  it('card-single 은 대표님 브라우저와 같은 Referer(영수증 보기 화면 주소, 같은 출처)로, 주문번호 조회는 영수증 목록 화면 주소로 부른다', async () => {
    const receipt = { orderReceipt: { productOrderReceipts: [{ productOrderNo: PO, cardReceiptPresent: true, tid: TID, payId: PAYID }] } };
    const { inits } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO }] }), (u) => (u.includes('card-single') ? { json: CARD } : { json: receipt }));
    // 영수증 목록 화면 요청은 원문에 Referer 가 없어 붙이지 않는다(같은 출처 쿠키만)
    expect(inits[0]).toMatchObject({ credentials: 'include' });
    expect(inits[0].referrer).toBeUndefined();
    expect(inits[1]).toMatchObject({ referrer: `https://pay.naver.com/receipts/preview/card?tid=${TID}&productOrderNo=${PO}&exitType=back&payId=${PAYID}`, referrerPolicy: 'unsafe-url' });
    const np = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, paymentId: NP, tid: TID }] }), () => ({ json: CARD }));
    expect(np.inits[0]).toMatchObject({ referrer: `https://pay.naver.com/receipts/preview/card?svcInfType=PD&paymentId=${NP}&tid=${TID}` });
  });

  it('scan 에서 노드 한도를 넘기면 cut true 로 알린다', async () => {
    const big = { props: { items: Array.from({ length: 40000 }, (_, i) => ({ a: i })) } };
    const { posted } = await exec(run({ jobs: [], scan: true }), () => ({ json: CARD }), { nextData: big });
    expect(posted[0].results[0].diag?.lines).toContain('cut true');
  });
});


describe('링크 없는 issue-history — __NEXT_DATA__ 의 orderReceipt 에서 짝(tid · productOrderNo · payNo/firstOriginalPayNo)을 읽는다(11-02 대표님 확인)', () => {
  const orcHtml = (orc: unknown) => `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { x: { orderReceipt: orc } } } })}</script></body></html>`;
  it('링크가 없어도 orderReceipt 에 짝이 있으면 그 값 그대로 card-single 을 부른다(다른 출처를 부르지 않는다)', async () => {
    const { posted, urls } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO }] }),
      (u) => (u.includes('card-single') ? { json: CARD } : { raw: orcHtml({ tid: TID, productOrderNo: PO, payNo: PAYID }) }));
    expect(urls).toEqual([`/receipts/issue-history?orderNo=${ORDER}`, `/web-api/receipts/card-single?payId=${PAYID}&tid=${TID}&productOrderNo=${PO}&isFromPayCenter=false`]);
    expect(posted[0].results[0].st).toBe('ok');
  });
  it('orderReceipt 에 payNo 가 없으면 firstOriginalPayNo 를 읽는다', async () => {
    const { urls } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER }] }),
      (u) => (u.includes('card-single') ? { json: CARD } : { raw: orcHtml({ tid: TID, productOrderNo: PO, firstOriginalPayNo: PAYID }) }));
    expect(urls[1]).toContain(`payId=${PAYID}&tid=${TID}`);
  });
  it('링크도 orderReceipt 짝도 없으면 「영수증 없음」(실패 아님) — 구조만 남긴다', async () => {
    const { posted } = await exec(run({ jobs: [{ key: 'k1', orderNo: ORDER, productOrderNo: PO }] }), () => ({ raw: orcHtml({ productOrderNo: PO }) }));
    expect(posted[0].results[0]).toMatchObject({ st: 'none', diag: { w: 'issue' } });
  });
});

describe('pinfo — 간편결제 · 외부몰 네이버페이 짝 얻기(11-02 대표님 확인 길, 전부 HTTP) — orders.pay.naver.com 출처에서만', () => {
  const PID = '20261026NP1234567890';
  const TIDI = '20261026333333333333';
  const INFO = { result: { payTypeCode: 'CARD', receipt: { card: { url: `https://pay.naver.com/receipts/preview/card?svcInfType=PD&paymentId=${PID}&tid=${TIDI}` } } } };
  it('payment/detail/info 를 부르고 receipt.card.url 의 tid 로 pair 를 돌려준다 — 주소에 paymentId · yearMonthFormatDate', async () => {
    const { posted, urls } = await exec(run({ jobs: [{ key: 'k1', orderNo: '20261026123456', pinfo: true, paymentId: PID }] }), () => ({ json: INFO }), { host: 'orders.pay.naver.com' });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(new RegExp(`^https://orders\\.pay\\.naver\\.com/orderApi/payment/detail/info\\?paymentId=${PID}&yearMonthFormatDate=\\d{4}-\\d{2}$`));
    expect(posted[0].results[0]).toMatchObject({ st: 'pair', tid: TIDI, paymentId: PID });
  });
  it('pinfo 작업은 orders.pay.naver.com 에서만 — 다른 출처면 부르지 않는다', async () => {
    const { posted, urls } = await exec(run({ jobs: [{ key: 'k1', orderNo: '20261026123456', pinfo: true, paymentId: PID }] }), () => ({ json: INFO }));
    expect(urls).toEqual([]);
    expect(posted[0].results[0].st).toBe('net');
  });
  it('막히면 그 주문은 실패(재시도 없음) · receipt.card 가 원래 없으면 「영수증 없음」', async () => {
    const { posted } = await exec(run({ jobs: [{ key: 'k1', orderNo: '20261026123456', pinfo: true, paymentId: PID }] }), () => ({ status: 500 }), { host: 'orders.pay.naver.com' });
    expect(posted[0].results[0]).toMatchObject({ st: 'nopair', diag: { w: 'pinfo' } });
    const noCard = await exec(run({ jobs: [{ key: 'k1', orderNo: '20261026123456', pinfo: true, paymentId: PID }] }), () => ({ json: { result: { receipt: {} } } }), { host: 'orders.pay.naver.com' });
    expect(noCard.posted[0].results[0].st).toBe('none');
  });
  it('pinfo 작업에는 paymentId 가 꼭 있다', () => {
    expect(() => receiptsScript(run({ jobs: [{ key: 'k', orderNo: '20261026123456', pinfo: true }] }))).toThrow('bad pinfo');
  });
});

describe('네이버페이 내역 줄(대표님 15:36 ⓑ) — items[] 의 additionalData.orderNo · payId · productOrderNo · date · additionalData.orderAmount', () => {
  const DATA = { props: { pageProps: { dehydratedState: { queries: [{ state: { data: { pages: [{ items: [
    { _id: 'a', date: 1761700000000, additionalData: { orderNo: '2026102900000001', payId: PAYID, productOrderNo: '2026102900000011', orderAmount: 12300 } },
    { _id: 'b', date: 1761700000000, additionalData: { orderNo: 'NOT-16', orderAmount: 100 } },
    { _id: 'c', orderDetailUrl: 'https://orders.pay.naver.com/order/status/2026102900000003?returnUrl=x', additionalData: { orderAmount: 100 } },
  ] }] } } }] } } } };
  it('이름 그대로 읽은 줄만 np:scan rows 로(주문번호 없으면 miss) · 첫 줄 키 이름 전체를 진단에', async () => {
    const { posted } = await exec(run({ jobs: [], scan: true }), () => ({ json: CARD }), { nextData: DATA });
    const scan = posted[0].results.find((x) => x.key === 'np:scan');
    // 두 번째는 주문번호 모양이 틀려 빼고, 세 번째는 orderDetailUrl 의 /order/status/<16자리> 로 · 시각 없이
    expect(scan?.rows).toEqual([
      { orderNo: '2026102900000001', at: 1761700000000, amount: 12300, payId: PAYID, productOrderNo: '2026102900000011' },
      { orderNo: '2026102900000003', amount: 100 },
    ]);
    expect(scan?.diag?.lines).toContain('rows 2 miss 1');
    expect(scan?.diag?.lines).toContain('item additionalData.orderNo');
  });
});

describe('네이버페이 내역 줄 v2(npv2) — 쪽 번호 · product.price · buttons[] 영수증 주소 · 못 찾은 줄 모양', () => {
  const TIDB = '20261026222222222222';
  const DATA = { buildId: 'test-build', props: { pageProps: { dehydratedState: { queries: [{ state: { data: { pageParams: [{ page: '1' }], pages: [{ curPage: 1, totalPage: 4, items: [
    { _id: 'a', date: 1761700000000, serviceType: 'ORDER', orderDetailUrl: 'https://orders.pay.naver.com/x?orderNo=2026102900000021', product: { price: 7700 }, additionalData: { payId: PAYID } },
    { _id: 'b', date: 1761700000000, serviceType: 'PAY', product: { price: 3300 }, buttons: [{ type: 'RECEIPT', url: '/receipts/preview/card?svcInfType=PD&paymentId=20261026NP1234567890&tid=' + TIDB }], additionalData: { payId: PAYID } },
    { _id: 'c', date: 1761700000000, serviceType: 'PAY', orderDetailUrl: 'https://m.pay.naver.com/o/123456', buttons: [{ type: 'X', name: '상세' }], additionalData: { uniqueKey: 'u' } },
  ] }] } } }] } } } };
  it('v2 에서만 쿼리 orderNo · product.price · 버튼 짝을 읽고, 못 찾은 줄은 모양(값 없음)을 남기고 쪽 번호를 알린다', async () => {
    const { posted } = await exec(run({ jobs: [], scan: true, v2: true }), () => ({ json: CARD }), { nextData: DATA });
    const scan = posted[0].results.find((x) => x.key === 'np:scan');
    expect(scan).toMatchObject({ page: 1, pages: 4 });
    expect(scan?.rows).toEqual([
      { orderNo: '2026102900000021', at: 1761700000000, amount: 7700, payId: PAYID },
      { tid: TIDB, paymentId: '20261026NP1234567890', at: 1761700000000, amount: 3300, payId: PAYID },
    ]);
    const lines = scan?.diag?.lines ?? [];
    const miss = lines.find((l) => l.startsWith('miss '));
    expect(miss).toContain('st=PAY');
    expect(miss).toContain('od=https://m.pay.naver.com/o/n6');
    expect(miss).toContain('ad=uniqueKey');
    expect(lines.join(' ')).not.toContain('123456');

    const old = await exec(run({ jobs: [], scan: true }), () => ({ json: CARD }), { nextData: DATA });
    expect(old.posted[0].results.find((x) => x.key === 'np:scan')?.rows ?? []).toEqual([]);
  });
});

describe('간편결제(SIMPLE_PAYMENT) 줄 — 실기록 orderDetailUrl /instantPay/detail/<결제번호> (10-29 16:36)', () => {
  const PID = '20261026NP1234567890';
  it('v2 내역 읽기는 그 줄을 주소 경로 그대로 · 결제번호와 함께 rows 로 낸다', async () => {
    const DATA = { buildId: 'test-build', props: { pageProps: { dehydratedState: { queries: [{ state: { data: { pages: [{ curPage: 1, totalPage: 1, items: [
      { _id: 'a', date: 1761700000000, serviceType: 'SIMPLE_PAYMENT', product: { price: 9900 }, orderDetailUrl: `https://orders.pay.naver.com/instantPay/detail/${PID}?backUrl=x`, buttons: [{ code: 'P', text: '포인트 받기', url: `https://orders.pay.naver.com/instantPay/receivePoint/${PID}` }] },
    ] }] } } }] } } } };
    const { posted } = await exec(run({ jobs: [], scan: true, v2: true }), () => ({ json: CARD }), { nextData: DATA });
    const scan = posted[0].results.find((x) => x.key === 'np:scan');
    expect(scan?.rows).toEqual([{ instant: `/instantPay/detail/${PID}?backUrl=x`, paymentId: PID, at: 1761700000000, amount: 9900 }]);
    expect(scan?.diag?.lines.find((l) => l.startsWith('rows '))).toContain('instant 1');
  });
});

describe('내역 줄 수 상한 없음(10-31 실기록 774줄 중 앞 200줄만 읽던 문제)', () => {
  it('200줄을 넘어도 전부 rows 로 싣는다', async () => {
    const items = Array.from({ length: 260 }, (_, i) => ({ _id: 'r' + i, date: 1761700000000 - i * 1000, product: { price: 1000 + i }, additionalData: { orderNo: String(2026102600000000 + i) } }));
    const DATA = { props: { pageProps: { dehydratedState: { queries: [{ state: { data: { pages: [{ curPage: 1, totalPage: 1, items }] } } }] } } } };
    const { posted } = await exec(run({ jobs: [], scan: true }), () => ({ json: CARD }), { nextData: DATA });
    const scan = posted[0].results.find((x) => x.key === 'np:scan');
    expect(scan?.rows?.length).toBe(260);
    expect(scan?.diag?.lines.find((l) => l.startsWith('rows '))).toContain('rows 260 miss 0');
  });
});

describe('간편결제 항목 안의 tid · paymentId(이름 그대로) — 있으면 그 화면을 띄우지 않는다', () => {
  it('rows 에 tid · paymentId 로 싣고 instantPair 로 센다 · 첫 간편결제 항목 키 이름을 진단에', async () => {
    const PID = '20261026NP1234567890';
    const DATA = { buildId: 'test-build', props: { pageProps: { dehydratedState: { queries: [{ state: { data: { pages: [{ curPage: 1, totalPage: 1, items: [
      { _id: 'a', date: 1761700000000, serviceType: 'SIMPLE_PAYMENT', product: { price: 9900 }, orderDetailUrl: `https://orders.pay.naver.com/instantPay/detail/${PID}`, additionalData: { tid: '20261026444444444444' } },
    ] }] } } }] } } } };
    const { posted } = await exec(run({ jobs: [], scan: true, v2: true }), () => ({ json: CARD }), { nextData: DATA });
    const scan = posted[0].results.find((x) => x.key === 'np:scan');
    expect(scan?.rows).toEqual([{ tid: '20261026444444444444', paymentId: PID, at: 1761700000000, amount: 9900 }]);
    expect(scan?.diag?.lines.find((l) => l.startsWith('rows '))).toContain('instantPair 1');
    expect(scan?.diag?.lines).toContain('inst additionalData.tid : string');
  });
});
