import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createReceiptLinkClient } from './client';

const mocks = { get: vi.fn(), post: vi.fn() };
const client = createReceiptLinkClient({ request: mocks });
const { fetchLinkState, consentLink, revokeLink, sendOrders } = client;

const order = (i: number) => ({ orderNo: 'N-' + String(100000 + i), orderedAt: '2026-10-27 14:03:00', amount: 1000 + i });

describe('order link client', () => {
  beforeEach(() => { mocks.get.mockClear(); mocks.post.mockClear(); });

  it('returns null when the server switch is off (404) and rethrows other errors', async () => {
    mocks.get.mockRejectedValueOnce({ status: 404 });
    expect(await fetchLinkState()).toBeNull();
    mocks.get.mockRejectedValueOnce({ status: 500 });
    await expect(fetchLinkState()).rejects.toMatchObject({ status: 500 });
  });

  it('sends consent and revoke with only the platform', async () => {
    mocks.post.mockResolvedValue({ links: {} });
    await consentLink('naver');
    await revokeLink('coupang');
    expect(mocks.post.mock.calls[0]).toEqual(['receipt-link', { platform: 'naver', consent: true }]);
    expect(mocks.post.mock.calls[1]).toEqual(['receipt-link/revoke', { platform: 'coupang' }]);
  });

  it('sends only clean orders, 50 at a time, and counts the unreadable ones', async () => {
    mocks.post.mockImplementation((_p: string, body: { orders: unknown[] }) => Promise.resolve({ results: body.orders.map(() => ({ result: 'new' })) }));
    const raw = [...Array.from({ length: 60 }, (_, i) => ({ ...order(i), cookie: 'secret', address: 'x' })), { orderNo: '' }];
    const { tally, unreadable } = await sendOrders('naver', raw);
    expect(mocks.post.mock.calls.map(c => (c[1] as { orders: unknown[] }).orders.length)).toEqual([50, 10]);
    expect(JSON.stringify(mocks.post.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(mocks.post.mock.calls)).not.toContain('address');
    expect(tally.new).toBe(60);
    expect(unreadable).toBe(1);
  });

  it('stops sending once the pouch is full and counts the unsent orders the same way', async () => {
    mocks.post.mockReset();
    mocks.post.mockResolvedValueOnce({ results: Array.from({ length: 50 }, (_, i) => ({ result: i < 2 ? 'new' : 'pouch_full' })) });
    const { tally } = await sendOrders('coupang', Array.from({ length: 120 }, (_, i) => order(i)));
    expect(mocks.post.mock.calls.length).toBe(1);
    expect(tally).toMatchObject({ new: 2, pouch_full: 48 + 70 });
  });
});

describe('order link client — 0.1.0 additions', () => {
  beforeEach(() => { mocks.get.mockReset(); mocks.post.mockReset(); });

  it('uses the server batch size and prefilters amounts above the server cap', async () => {
    mocks.post.mockImplementation((_p: string, body: { orders: unknown[] }) => Promise.resolve({ results: body.orders.map(() => ({ result: 'new' })) }));
    const raw = [...Array.from({ length: 25 }, (_, i) => order(i)), { ...order(99), amount: 5_000_000 }];
    const { tally, unreadable } = await sendOrders('naver', raw, { ordersPerRequest: 10, amountMax: 3_000_000 });
    expect(mocks.post.mock.calls.map(c => (c[1] as { orders: unknown[] }).orders.length)).toEqual([10, 10, 5]);
    expect(tally).toMatchObject({ new: 25, amount: 1 });
    expect(unreadable).toBe(0);
  });

  it('reports disabled (no throw, nothing sent twice) when the app has no order import yet (404)', async () => {
    mocks.post.mockRejectedValueOnce({ status: 404 });
    const out = await sendOrders('naver', [order(1), order(2), { orderNo: '' }]);
    expect(out.disabled).toBe(true);
    expect(out.unreadable).toBe(1);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    mocks.post.mockRejectedValueOnce({ status: 500 });
    await expect(sendOrders('naver', [order(3)])).rejects.toMatchObject({ status: 500 });
  });

  it('probe: true when posted, false on a rejection — the body goes to receipt-link/probe untouched', async () => {
    mocks.post.mockResolvedValueOnce({});
    const body = { platform: 'naver' } as never;
    expect(await client.postProbe(body)).toBe(true);
    expect(mocks.post.mock.calls[0]).toEqual(['receipt-link/probe', body]);
    mocks.post.mockRejectedValueOnce({ status: 422 });
    expect(await client.postProbe(body)).toBe(false);
  });

  it('works with a prefixed request layer (a developer-server adapter maps the same relative paths)', async () => {
    const calls: string[] = [];
    const proxied = createReceiptLinkClient({ request: { get: async (p) => { calls.push('GET bill/server/' + p); return { links: {} }; }, post: async (p) => { calls.push('POST bill/server/' + p); return { links: {} }; } } });
    await proxied.fetchLinkState(); await proxied.consentLink('naver'); await proxied.revokeLink('naver');
    expect(calls).toEqual(['GET bill/server/receipt-link', 'POST bill/server/receipt-link', 'POST bill/server/receipt-link/revoke']);
  });
});
