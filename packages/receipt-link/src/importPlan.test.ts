import { describe, expect, it } from 'vitest';
import { createCollector, isLoginUrl, isOnSite, kstStamp, MAX_TOTAL, parseReaderMessage, readFlowOrders, SITES_FOR_PLATFORM, WINDOW_DAYS } from './importPlan';
import { ORDER_PAGES } from './readers';

const NOW = Date.UTC(2026, 9, 28, 0, 0); // KST 2026-10-28 09:00
const order = (no: string, orderedAt = '2026-10-20 12:00', extra: Record<string, unknown> = {}) => ({ orderNo: no, orderedAt, amount: 12000, ...extra });
const msg = (site: string, orders: unknown[], done = true, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: 'orders', site, orders, done, ...extra });

describe('reader sites', () => {
  it('maps platforms to reader sites (coupang only once the server switch is on)', () => {
    expect(SITES_FOR_PLATFORM).toEqual({ naver: ['naver_shop', 'naver_pay'], musinsa: ['musinsa'], kurly: ['kurly'], coupang: ['coupang'] });
  });

  it('naver_shop reads the Naver Shopping order list page, and every script ends with true;', () => {
    expect(ORDER_PAGES.naver_shop.url).toBe('https://shopping.naver.com/my/order');
    for (const p of Object.values(ORDER_PAGES)) expect(p.script.trimEnd().endsWith('true;')).toBe(true);
  });

  it('has exactly the five reader keys (coupang is gated by the server switch in the view)', () => {
    expect(Object.keys(ORDER_PAGES).sort()).toEqual(['coupang', 'kurly', 'musinsa', 'naver_pay', 'naver_shop']);
    for (const p of Object.values(ORDER_PAGES)) {
      expect(p.url.startsWith('https://')).toBe(true);
      expect(p.script).toContain('ReactNativeWebView.postMessage');
    }
  });
});

describe('parseReaderMessage', () => {
  it('parses a valid message and keeps only the six order fields', () => {
    const r = parseReaderMessage(msg('kurly', [order('KR-100001', '2026-10-20 12:00', { seller: '  컬리  ', title: '우유', payment: '카드', cookie: 'secret', address: 'x' })]));
    expect(r).not.toBeNull();
    expect(r!.site).toBe('kurly');
    expect(r!.done).toBe(true);
    expect(r!.dropped).toBe(0);
    expect(r!.orders).toEqual([{ orderNo: 'KR-100001', orderedAt: '2026-10-20 12:00', amount: 12000, seller: '컬리', title: '우유', payment: '카드' }]);
    expect(JSON.stringify(r)).not.toContain('secret');
  });

  it('strips non-alnum characters from orderNo and checks its length (5-40)', () => {
    const r = parseReaderMessage(msg('musinsa', [order('M#12 34-5'), order('ABC'), order('X'.repeat(41))]));
    expect(r!.orders.map((o) => o.orderNo)).toEqual(['M1234-5']);
    expect(r!.dropped).toBe(2);
  });

  it('drops bad items and counts them: date, amount, orderNo type', () => {
    const r = parseReaderMessage(msg('naver_shop', [
      order('NS-00001', '2026-13-01 10:00'),
      order('NS-00002', '2026-10-20T10:00'),
      order('NS-00003', '2026-10-20 10:00', { amount: 0 }),
      order('NS-00004', '2026-10-20 10:00', { amount: 12.5 }),
      { orderNo: 12345, orderedAt: '2026-10-20 10:00', amount: 1000 },
      order('NS-00005', '2026-10-20 10:00', { amount: '12000' }),
      order('NS-00006', '2026-10-20 10:00', { amount: 3000 }),
    ]));
    expect(r!.orders.map((o) => o.orderNo)).toEqual(['NS-00006']);
    expect(r!.dropped).toBe(6);
  });

  it('trims and truncates seller (80), title (200), payment (30); drops non-string values', () => {
    const r = parseReaderMessage(msg('kurly', [order('KR-200001', '2026-10-20 12:00', { seller: 'a'.repeat(100), title: 'b'.repeat(300), payment: 7, })]));
    const o = r!.orders[0];
    expect(o.seller).toHaveLength(80);
    expect(o.title).toHaveLength(200);
    expect(o.payment).toBeUndefined();
  });

  it('rejects anything that is not a well-formed orders message', () => {
    expect(parseReaderMessage('not json')).toBeNull();
    expect(parseReaderMessage(JSON.stringify({ type: 'probe', raw: {} }))).toBeNull();
    expect(parseReaderMessage(msg('bogus', []))).toBeNull();
    expect(parseReaderMessage(msg('naver', []))).toBeNull();
    expect(parseReaderMessage(JSON.stringify({ type: 'orders', site: 'kurly', orders: [], done: 'yes' }))).toBeNull();
    expect(parseReaderMessage(JSON.stringify({ type: 'orders', site: 'kurly', orders: 'x', done: true }))).toBeNull();
    expect(parseReaderMessage(msg('kurly', Array.from({ length: 51 }, (_, i) => order('KR-' + (300000 + i)))))).toBeNull();
    expect(parseReaderMessage(null as unknown as string)).toBeNull();
  });

  it('keeps a short note and drops anything else from it', () => {
    expect(parseReaderMessage(msg('kurly', [], true, { note: 'login_needed' }))!.note).toBe('login_needed');
    expect(parseReaderMessage(msg('kurly', [], true, { note: '<b>no list</b>' }))!.note).toBe('bnolistb');
  });
});

describe('order collector', () => {
  it('dedupes the same orderNo across naver_shop and naver_pay', () => {
    const c = createCollector(NOW);
    c.add(parseReaderMessage(msg('naver_shop', [order('NV-500001'), order('NV-500002')]))!);
    c.add(parseReaderMessage(msg('naver_pay', [order('NV-500002'), order('NV-500003')]))!);
    const r = c.finish();
    expect(r.orders.map((o) => o.orderNo).sort()).toEqual(['NV-500001', 'NV-500002', 'NV-500003']);
    expect(r.read).toBe(4);
    expect(r.duplicates).toBe(1);
    expect(r.rejected).toBe(0);
  });

  it('keeps only the last 365 days in KST', () => {
    expect(WINDOW_DAYS).toBe(365);
    expect(kstStamp(NOW - 365 * 86_400_000)).toBe('2025-10-28 09:00');
    const c = createCollector(NOW);
    c.add(parseReaderMessage(msg('kurly', [
      order('KR-600001', '2025-10-28 08:59'),
      order('KR-600002', '2025-10-28 09:00'),
      order('KR-600003', '2026-10-27 23:59'),
    ]))!);
    const r = c.finish();
    expect(r.orders.map((o) => o.orderNo).sort()).toEqual(['KR-600002', 'KR-600003']);
    expect(r.rejected).toBe(1);
  });

  it('caps the total at MAX_TOTAL, keeping the newest, and counts the rest as rejected', () => {
    const c = createCollector(NOW);
    const total = MAX_TOTAL + 10;
    const many = Array.from({ length: total }, (_, i) => order('MU-' + String(700000 + i), `2026-10-${String(1 + (i % 27)).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:00`));
    for (let i = 0; i < total; i += 50) c.add(parseReaderMessage(msg('musinsa', many.slice(i, i + 50), false))!);
    const r = c.finish();
    expect(r.orders).toHaveLength(MAX_TOTAL);
    expect(r.rejected).toBe(10);
    const sorted = r.orders.map((o) => o.orderedAt);
    expect([...sorted].sort((a, b) => b.localeCompare(a))).toEqual(sorted);
  });

  it('is stable when finished more than once', () => {
    const c = createCollector(NOW);
    c.add(parseReaderMessage(msg('kurly', [order('KR-700001')]))!);
    expect(c.finish()).toEqual(c.finish());
  });
});

describe('isLoginUrl', () => {
  it('recognises the login pages of each site and not the order pages', () => {
    expect(isLoginUrl('https://nid.naver.com/nidlogin.login?url=x')).toBe(true);
    expect(isLoginUrl('https://www.musinsa.com/auth/login')).toBe(true);
    expect(isLoginUrl('https://www.kurly.com/member/login')).toBe(true);
    expect(isLoginUrl('https://pay.naver.com/pc/history')).toBe(false);
    expect(isLoginUrl('https://www.musinsa.com/order/order-list')).toBe(false);
  });
});

describe('isOnSite (SPA moves inside the order site)', () => {
  it('same host is on site, another host (or a bad address) is not', () => {
    const siteUrl = ORDER_PAGES.naver_shop.url;
    expect(isOnSite('https://shopping.naver.com/my/order/detail?x=1', siteUrl)).toBe(true);
    expect(isOnSite('https://nid.naver.com/nidlogin.login', siteUrl)).toBe(false);
    expect(isOnSite('', siteUrl)).toBe(false);
    expect(isOnSite('https://shopping.naver.com/my/order', '')).toBe(false);
  });
});

describe('flow orders (readFlowOrders) — 영수증을 건건이 읽은 주문', () => {
  const full = { orderNo: '20261027NP1234567', orderedAt: '2026-10-27 14:03:22', amount: 12300, seller: '화원노리', payment: '카드', businessNumber: '123-45-67890', approval: '12345678', cardIssuer: '신한', kind: 'card' };

  it('keeps the ten allowed fields and nothing else (cookie, token, url, address are dropped)', () => {
    const r = readFlowOrders([{ ...full, cookie: 'secret', receiptUrl: 'https://x/?t=1', address: '서울', title: '꽃다발' }]);
    expect(r.dropped).toBe(0);
    expect(r.orders).toEqual([{ ...full, title: '꽃다발' }]);
    expect(JSON.stringify(r)).not.toContain('secret');
    expect(JSON.stringify(r)).not.toContain('receiptUrl');
  });

  it('accepts orderedAt with or without seconds and rejects impossible times', () => {
    const r = readFlowOrders([
      { ...full, orderNo: 'OK-0001', orderedAt: '2026-10-27 14:03' },
      { ...full, orderNo: 'OK-0002', orderedAt: '2026-10-27 14:03:59' },
      { ...full, orderNo: 'BAD-001', orderedAt: '2026-10-27 14:03:60' },
      { ...full, orderNo: 'BAD-002', orderedAt: '2026-10-27 24:00:00' },
      { ...full, orderNo: 'BAD-003', orderedAt: '2026-02-30 10:00:00' },
      { ...full, orderNo: 'BAD-004', orderedAt: '2026-10-27T14:03:22' },
    ]);
    expect(r.orders.map((o) => o.orderNo)).toEqual(['OK-0001', 'OK-0002']);
    expect(r.dropped).toBe(4);
  });

  it('drops orders flagged noSeconds (the receipt showed no seconds)', () => {
    const r = readFlowOrders([{ ...full, noSeconds: true }, { ...full, orderNo: 'OK-0003' }]);
    expect(r.orders.map((o) => o.orderNo)).toEqual(['OK-0003']);
    expect(r.dropped).toBe(1);
  });

  it('drops only the bad optional field, never the order: businessNumber (digits/dashes up to 20), approval 40, cardIssuer 30, kind', () => {
    const r = readFlowOrders([
      { ...full, orderNo: 'OPT-0001', businessNumber: '123-45-67890 (주)', approval: '9'.repeat(60), cardIssuer: '가'.repeat(50), kind: 'refund' },
      { ...full, orderNo: 'OPT-0002', businessNumber: '1'.repeat(21) },
      { ...full, orderNo: 'OPT-0003', businessNumber: '1234567890', kind: 'purchase' },
    ]);
    expect(r.orders).toHaveLength(3);
    expect(r.orders[0].businessNumber).toBeUndefined();
    expect(r.orders[0].kind).toBeUndefined();
    expect(r.orders[0].approval).toHaveLength(40);
    expect(r.orders[0].cardIssuer).toHaveLength(30);
    expect(r.orders[1].businessNumber).toBeUndefined();
    expect(r.orders[2]).toMatchObject({ businessNumber: '1234567890', kind: 'purchase' });
  });

  it('is empty for anything that is not a list', () => {
    expect(readFlowOrders(undefined)).toEqual({ orders: [], dropped: 0 });
    expect(readFlowOrders({ orders: [full] })).toEqual({ orders: [], dropped: 0 });
  });
});

describe('collector.accept — 읽는 대로 받기', () => {
  it('returns only the newly accepted orders and counts duplicates / out of window', () => {
    const c = createCollector(NOW);
    const a = c.accept({ orders: [{ orderNo: 'AC-00001', orderedAt: '2026-10-27 10:00:00', amount: 1000 }, { orderNo: 'AC-00002', orderedAt: '2024-01-01 10:00:00', amount: 1000 }], dropped: 1 });
    expect(a.map((o) => o.orderNo)).toEqual(['AC-00001']);
    const b = c.accept({ orders: [{ orderNo: 'AC-00001', orderedAt: '2026-10-27 10:00:00', amount: 1000 }, { orderNo: 'AC-00003', orderedAt: '2026-10-26 10:00:00', amount: 1000 }], dropped: 0 });
    expect(b.map((o) => o.orderNo)).toEqual(['AC-00003']);
    expect(c.size()).toBe(2);
    expect(c.finish()).toMatchObject({ read: 4, duplicates: 1, rejected: 2 });
  });

  it('stops accepting at MAX_TOTAL', () => {
    const c = createCollector(NOW);
    const batch = (from: number, n: number) => ({ orders: Array.from({ length: n }, (_, i) => ({ orderNo: 'CAP-' + String(100000 + from + i), orderedAt: '2026-10-27 10:00:00', amount: 1000 })), dropped: 0 });
    expect(c.accept(batch(0, MAX_TOTAL - 1))).toHaveLength(MAX_TOTAL - 1);
    expect(c.accept(batch(MAX_TOTAL, 5))).toHaveLength(1);
    expect(c.size()).toBe(MAX_TOTAL);
    expect(c.finish().rejected).toBe(4);
  });
});

describe('목록 행(kind list)과 완성본', () => {
  const NOWL = Date.UTC(2026, 9, 28, 0, 0);
  const K = (n: number) => `2026-10-27 14:0${n}|900`;
  const row = (extra: Record<string, unknown> = {}) => ({ orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list', ...extra });

  it('keeps a list row without orderNo (empty string too) when it has a valid listKey, and drops one with neither', () => {
    const r = readFlowOrders([
      row({ orderNo: '', listKey: K(1), seller: '컬리', needsReceipt: true, productOrderNo: '2026102712345678' }),
      row(),
      row({ listKey: 'L-1' }),
      row({ orderNo: '123', listKey: K(2) }),
      row({ orderNo: 'KR-100001', listKey: ' 2026-10-27  14:03|900 ' }),
    ]);
    expect(r.orders).toEqual([
      { orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list', listKey: K(1), seller: '컬리' },
      { orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list', listKey: K(2) },
      { orderNo: 'KR-100001', orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list', listKey: '2026-10-27 14:03|900' },
    ]);
    expect('orderNo' in r.orders[0]).toBe(false);
    expect(JSON.stringify(r.orders)).not.toContain('needsReceipt');
    expect(JSON.stringify(r.orders)).not.toContain('productOrderNo');
    expect(r.dropped).toBe(2);
  });

  it('coupang date-only listKey 「YYYY-MM-DD|금액」 is normalized to 「YYYY-MM-DD 00:00|금액」 on both the list row and the completed order', () => {
    const r = readFlowOrders([
      row({ orderedAt: '2026-10-27 00:00:00', listKey: '2026-10-27|900' }),
      { orderNo: '1234567890123', orderedAt: '2026-10-27 09:15:33', amount: 900, kind: 'card', listKey: '2026-10-27|900' },
    ]);
    expect(r.orders[0].listKey).toBe('2026-10-27 00:00|900');
    expect(r.orders[1].listKey).toBe('2026-10-27 00:00|900');
  });

  it('a completed order replaces the list row (same listKey, or same orderNo) instead of counting as a duplicate', () => {
    const c = createCollector(NOWL);
    const a = c.accept({ orders: readFlowOrders([row({ listKey: K(1) }), row({ orderNo: 'KR-200002', listKey: K(2) })]).orders, dropped: 0 });
    expect(a).toHaveLength(2);
    const b = c.accept({ orders: readFlowOrders([
      { orderNo: 'KR-200001', orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'card', listKey: K(1) },
      { orderNo: 'KR-200002', orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'purchase' },
    ]).orders, dropped: 0 });
    expect(b.map((o) => o.orderNo)).toEqual(['KR-200001', 'KR-200002']);
    expect(c.size()).toBe(2);
    // 이미 완성된 것을 목록 행이나 같은 완성본으로 또 내면 중복이다
    const d = c.accept({ orders: readFlowOrders([row({ orderNo: 'KR-200001' , listKey: K(1) }), { orderNo: 'KR-200002', orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'purchase' }]).orders, dropped: 0 });
    expect(d).toEqual([]);
    expect(c.finish().duplicates).toBe(2);
  });

  it('a list row stored under its own orderNo is still replaced by a completed order with a different orderNo and the same listKey (naver: shop orderNo vs payment id)', () => {
    const c = createCollector(NOWL);
    c.accept({ orders: readFlowOrders([row({ orderNo: '2026102712345678', listKey: K(1) })]).orders, dropped: 0 });
    const b = c.accept({ orders: readFlowOrders([{ orderNo: '20261027NP1234567', orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'card', listKey: K(1) }]).orders, dropped: 0 });
    expect(b.map((o) => o.orderNo)).toEqual(['20261027NP1234567']);
    expect(c.size()).toBe(1);
  });

  it('two completed orders sharing one listKey are both kept (only the first replaces the list row)', () => {
    const c = createCollector(NOWL);
    c.accept({ orders: readFlowOrders([row({ listKey: K(1) })]).orders, dropped: 0 });
    const b = c.accept({ orders: readFlowOrders([
      { orderNo: 'CP-100001', orderedAt: '2026-10-27 09:00:01', amount: 900, kind: 'card', listKey: K(1) },
      { orderNo: 'CP-100002', orderedAt: '2026-10-27 09:00:02', amount: 900, kind: 'card', listKey: K(1) },
    ]).orders, dropped: 0 });
    expect(b).toHaveLength(2);
    expect(c.size()).toBe(2);
  });
});
