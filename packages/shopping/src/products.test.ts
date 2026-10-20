import { expect, it, vi } from 'vitest';
import { ProductPager } from './products';
import type { Product, ProductPage } from './types';
const p = (id: string): Product => ({ id, partnerId: 'toss', title: id, reward: 0, rewardKind: 'none' });
it('appends two pages, deduplicates and locks concurrent requests', async () => {
  let finish!: (page: ProductPage) => void;
  const fetch = vi.fn().mockResolvedValueOnce({ items: [p('1')], next: '20' }).mockImplementationOnce(() => new Promise(r => { finish = r; }));
  const publish = vi.fn();
  const pager = new ProductPager(fetch, publish);
  await pager.reset({ partnerId: 'all', categoryId: 'a' });
  const request = pager.more(); await pager.more();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][0]).toEqual({ partnerId: 'all', categoryId: 'a', cursor: '20' });
  expect(publish).toHaveBeenLastCalledWith({ items: [p('1')], loadingMore: true });
  finish({ items: [p('1'), p('2')], next: null }); await request;
  expect(publish).toHaveBeenLastCalledWith({ items: [p('1'), p('2')], loadingMore: false });
  await pager.more(); expect(fetch).toHaveBeenCalledTimes(2);
});
it('category reset starts at first page and discards an old pending page', async () => {
  let finish!: (page: ProductPage) => void;
  const fetch = vi.fn().mockResolvedValueOnce({ items: [p('1')], next: '20' }).mockImplementationOnce(() => new Promise(r => { finish = r; })).mockResolvedValueOnce({ items: [p('new')], next: null });
  const publish = vi.fn(); const pager = new ProductPager(fetch, publish);
  await pager.reset({ partnerId: 'toss', categoryId: 'a' });
  const old = pager.more();
  await pager.reset({ partnerId: 'toss', categoryId: 'b' });
  finish({ items: [p('old')], next: '40' }); await old;
  expect(fetch.mock.calls[2][0]).toEqual({ partnerId: 'toss', categoryId: 'b' });
  expect(publish).toHaveBeenLastCalledWith({ items: [p('new')], loadingMore: false });
});
