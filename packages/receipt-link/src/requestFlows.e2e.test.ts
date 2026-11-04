/**
 * 요청 흐름 통합 시험(네이버) — 구동기 + 흐름(naverApiFlow) + 실제 웹뷰 스크립트를 가짜 페이지 위에서 처음부터 끝까지 돌린다(틀은 e2eHarness.ts). 값은 모두 가짜.
 */
import { describe, expect, it } from 'vitest';
import { runFlow, type Page, type Router } from './e2eHarness';
import { tailOf } from './naverApiFlow';

/* ---------------- 네이버 ---------------- */
const TID = '20261020111111111111';
const PAYID = '20261020222222222222';
const po = (n: number): string => `PD2026102000${String(n).padStart(6, '0')}`;
const orderNo = (n: number): string => `20261020${String(n).padStart(8, '0')}`;
const naverItem = (n: number, at: string) => ({ orderNo: orderNo(n), productOrderNo: po(n), orderDateTime: at, productName: `상품${n}`, productAmount: 1000 * n, merchantName: `상점${n}` });
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
const CARD = {
  trade: { cardCompanyName: '삼성카드', approvalNo: '12345678', cardNo: '1234-****', approvalDateTime: '2026-10-20T10:04:43', cancelDateTime: null, productName: '가짜 상품', productOrderNo: po(1) },
  seller: { name: '가짜상점', representative: '홍길동', businessNo: '123-45-67890' },
  merchant: { name: '네이버파이낸셜' },
  paymentDetails: { approvalAmount: 12300, cancelAmount: 0 },
};

describe('네이버 — 구동기 + 흐름 + 실제 스크립트(가짜 페이지)', () => {
  const pages: Record<string, Page> = {
    'shopping.naver.com/my/order': { text: '주문 내역 1,000원 주문' },
    'pay.naver.com/history': { text: '결제내역 1,000원' },
  };
  const router: Router = (url) => {
    if (url.includes('/my/order/api/npay/order-histories')) {
      return { json: { contents: [naverItem(1, '2026-10-25 12:00:00'), naverItem(2, '2026-10-24 12:00:00'), naverItem(3, '2026-10-23 12:00:00')], last: true, totalPages: 1 } };
    }
    if (url.includes('/web-api/receipts/card-single')) return { json: CARD };
    if (url.endsWith(`/receipts/issue-history?orderNo=${orderNo(1)}`)) return { text: issueHtml({ orderNo: orderNo(1), orderReceipt: { productOrderReceipts: [{ productOrderNo: po(1), cardReceiptPresent: true, tid: TID, payId: PAYID }] } }) };
    if (url.endsWith(`/receipts/issue-history?orderNo=${orderNo(2)}`)) return { text: issueHtml({ orderNo: orderNo(2), orderReceipt: { productOrderReceipts: [{ productOrderNo: po(2), cardReceiptPresent: false }] } }) };
    if (url.endsWith(`/receipts/issue-history?orderNo=${orderNo(3)}`)) return { status: 500 };
    return { status: 404 };
  };

  it('목록 → 최신순 영수증 요청 → 줄별 결과(가져옴 · 영수증 없음 · 못 가져옴) · 완성 주문 · 구동기가 끝낸다', async () => {
    const r = await runFlow('naver', pages, router);
    expect(r.results).toHaveLength(1);
    expect(r.results[0].reason).toBe('all-rows');
    // 이동은 출처 페이지(쇼핑 · 결제) + 카드영수증 없는 주문의 주문상세용 orders 출처 한 번 · 결제로 돌아오기, 요청은 모두 허용 호스트
    expect(r.gotos).toEqual(['https://shopping.naver.com/my/order', 'https://pay.naver.com/history?page=1',
      `https://orders.pay.naver.com/order/status/${orderNo(1)}?returnUrl=${encodeURIComponent('https://pay.naver.com/pc/history')}`, 'https://pay.naver.com/history?page=1']);
    // 목록 행 3 + 완성 주문 1
    expect(r.orders.filter((o) => o.kind === 'list')).toHaveLength(3);
    const cards = r.orders.filter((o) => o.kind === 'card');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ orderNo: orderNo(1), seller: '가짜상점', businessNumber: '123-45-67890', approval: '12345678', cardIssuer: '삼성카드', orderedAt: '2026-10-20 10:04:43', amount: 12300 });
    // 줄별 마지막 결과
    const last = new Map<string, string>();
    for (const e of r.outcomes) last.set(e.key, e.outcome.state === 'failed' ? `failed:${e.outcome.code}` : e.outcome.state);
    // 「카드영수증」 링크가 없는 주문은 「영수증 없음」(대표님 11-02 ④ — 실패가 아님)
    expect([...last.values()].sort()).toEqual(['done', 'failed:network', 'none']);
    // 요청 주소(대표님 원문 형식) 확인
    expect(r.urls.some((u) => u === 'GET https://shopping.naver.com/my/order/api/npay/order-histories?page=1')).toBe(true);
    expect(r.urls.some((u) => u === `GET https://pay.naver.com/web-api/receipts/card-single?payId=${PAYID}&tid=${TID}&productOrderNo=${po(1)}&isFromPayCenter=false`)).toBe(true);
    // 영수증 원문 칸은 세부(detail)에 그대로(대표님 14:26 — 카드번호는 사이트가 가린 값 그대로), 쿠키는 없다
    const card = r.orders.find((o) => o.kind === 'card');
    expect(card?.detail).toMatchObject({ cardCompany: '삼성카드', sellerRepresentative: '홍길동', cardNo: '1234-****', merchantName: '네이버파이낸셜', approvalAmount: 12300 });
    expect(JSON.stringify(r.orders)).not.toMatch(/NID_|cookie/i);
  }, 20000);

  it('이미 가져온 주문(뒤 4자리 + 날짜)은 영수증을 요청하지 않고 목록 행도 다시 올리지 않는다', async () => {
    const r = await runFlow('naver', pages, router, { sinceLatest: false }, { tails: [tailOf(orderNo(1), '2026-10-25 12:00:00')] });
    expect(r.results[0].reason).toBe('all-rows');
    expect(r.urls.some((u) => u.includes(`/receipts/issue-history?orderNo=${orderNo(1)}`))).toBe(false);
    expect(r.urls.some((u) => u.includes(`/receipts/issue-history?orderNo=${orderNo(2)}`))).toBe(true);
    expect(r.orders.filter((o) => o.kind === 'list').map((o) => o.orderNo).sort()).toEqual([orderNo(2), orderNo(3)]);
  }, 30000);

  it('한 줄만 다시(onlyKeys) — 그 주문만 요청한다', async () => {
    const key = `${orderNo(2).slice(-4)}|2026-10-24 12:00|2000`;
    const r = await runFlow('naver', pages, router, { onlyKeys: [key] });
    expect(r.results[0].reason).toBe('all-rows');
    expect(r.urls.filter((u) => u.includes('/receipts/issue-history'))).toEqual([`GET https://pay.naver.com/receipts/issue-history?orderNo=${orderNo(2)}`]);
    expect(r.orders.filter((o) => o.kind === 'list')).toEqual([]);
    expect(r.outcomes.at(-1)).toMatchObject({ key, outcome: { state: 'none', info: { words: expect.stringMatching(/^osheet-/) } } });   // 이 주문은 카드영수증이 없는 결제(11-02 ④ — 실패가 아니라 「영수증 없음」)
  }, 30000);
});

describe('네이버 · 새 네이버페이 수집 길(npv2) — 흐름 → 구동기 → 실제 스크립트까지 v2 가 간다(10-29 16:23 rl15 실기록: page · miss 줄 0)', () => {
  const at = Date.parse('2026-10-26T09:30:00+09:00');
  const NEXT = (page: number, total: number, items: unknown[]) => ({ buildId: 'FAKEBID1102', props: { pageProps: { dehydratedState: { queries: [{ state: { data: { pageParams: [{ page: String(page) }], pages: [{ curPage: page, totalPage: total, items }] } } }] } } } });
  const page1Items = [{ _id: 'a', date: at, serviceType: 'PAY', orderDetailUrl: 'https://m.pay.naver.com/o/123456', additionalData: { uniqueKey: 'u' } }];
  const page2Items = [{ _id: 'b', date: at, product: { price: 4500 }, additionalData: { orderNo: '2026102600000077' } }];
  const pages: Record<string, Page> = {
    'shopping.naver.com/my/order': { text: '주문 내역 1,000원 주문' },
    'pay.naver.com/history?page=1': { text: '결제내역', nextData: NEXT(1, 2, page1Items) },
    'pay.naver.com/history?page=2': { text: '결제내역', nextData: NEXT(2, 2, page2Items) },
  };
  const router: Router = (url) => {
    // 내역 2쪽부터는 _next/data 로 간다(r3, 10-30) — 내역이 SPA 라 ?page=n 이동으로는 다음 묶음이 안 온다
    if (url.includes('/_next/data/') && url.includes('history.json?page=1')) return { json: NEXT(1, 2, page1Items).props };
    if (url.includes('/_next/data/') && url.includes('history.json?page=2')) return { json: NEXT(2, 2, page2Items).props };
    if (url.includes('/my/order/api/npay/order-histories')) return { json: { contents: [naverItem(1, '2026-10-25 12:00:00')], last: true, totalPages: 1 } };
    if (url.endsWith(`/receipts/issue-history?orderNo=${orderNo(1)}`)) return { text: issueHtml({ orderNo: orderNo(1), orderReceipt: { productOrderReceipts: [{ productOrderNo: po(1), cardReceiptPresent: true, tid: TID, payId: PAYID }] } }) };
    if (url.includes('/receipts/issue-history?orderNo=2026102600000077')) return { text: issueHtml({ x: { tid: TID, payId: PAYID, productOrderNo: po(7) } }) };
    if (url.includes('/web-api/receipts/card-single')) return { json: CARD };
    return { status: 404 };
  };
  it('npv2 면 npscan 머리에 page n/N 과 miss 모양 줄이 있고, 다음 쪽은 _next/data 로 읽어(r3) 그 줄의 영수증을 받는다', async () => {
    const r = await runFlow('naver', pages, router, { npv2: true });
    const scans = r.structures.filter((x) => x.where === 'rcpt-npscan-s200');
    expect(scans[0]?.lines.find((l) => l.startsWith('rows '))).toContain('page 2/2');   // _next/data 가 전체 쪽을 한 스캔에 읽으므로 마지막 쪽 번호가 찍힌다(r3)
    expect(scans[0]?.lines.some((l) => l.startsWith('miss st=PAY'))).toBe(true);
    expect(r.urls.some((u) => u.includes('/_next/data/') && u.includes('history.json?page=2'))).toBe(true);   // 다음 쪽은 _next/data 로 읽는다(r3)
    expect(r.gotos).toContain('https://pay.naver.com/history?page=2');   // 셸이면 쪽 번호를 바꿔 리로드 후 재스캔(r4)
    expect(r.orders.some((o) => o.kind === 'card' && o.orderNo === '2026102600000077')).toBe(true);
  }, 30000);
  it('npv2 가 아니면 첫 쪽만 · page 칸 없음', async () => {
    const r = await runFlow('naver', pages, router);
    const scans = r.structures.filter((x) => x.where === 'rcpt-npscan-s200');
    expect(scans[0]?.lines.find((l) => l.startsWith('rows '))).not.toContain('page');
    expect(r.gotos).not.toContain('https://pay.naver.com/history?page=2');
  }, 30000);
});
