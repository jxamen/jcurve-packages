import { describe, expect, it } from 'vitest';
import { MarketFeedError, createMarketFeed } from './index';

/* eslint-disable @typescript-eslint/no-explicit-any */

function fake(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const f = (async (url: string, init: any) => {
    calls.push({ url, headers: init.headers });
    const path = url.replace('https://api.test/v1/moneysign', '').split('?')[0];
    const r = routes[path] ?? { status: 404, body: { ok: false } };

    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body } as any;
  }) as unknown as typeof fetch;

  return { f, calls };
}

describe('@jcurve/marketfeed', () => {
  it('앱 키를 붙여 marketfeed 경로를 부르고 빈 값 질문은 빼고 보낸다', async () => {
    const { f, calls } = fake({ '/marketfeed/disclosures': { body: { ok: true, items: [{ id: 3, title: '공시' }], next: '3' } } });
    const feed = createMarketFeed({ base: 'https://api.test/v1/moneysign/', token: 'pk', fetch: f });
    const p = await feed.disclosures({ code: '005930', q: '', before: undefined, limit: 2 });
    expect(p).toEqual({ items: [{ id: 3, title: '공시' }], next: '3' });
    expect(calls[0].url).toBe('https://api.test/v1/moneysign/marketfeed/disclosures?code=005930&limit=2');
    expect(calls[0].headers['X-App-Token']).toBe('pk');
  });

  it('한글 검색어는 인코딩하고, 빈 검색어는 부르지 않는다', async () => {
    const { f, calls } = fake({ '/marketfeed/companies': { body: { ok: true, items: [{ code: '005930', name: '삼성전자' }] } } });
    const feed = createMarketFeed({ base: 'https://api.test/v1/moneysign', token: 'pk', fetch: f });
    expect(await feed.companies('  ')).toEqual([]);
    expect(calls).toHaveLength(0);
    expect((await feed.companies('삼성'))[0].code).toBe('005930');
    expect(calls[0].url).toContain('q=' + encodeURIComponent('삼성'));
  });

  it('묶음 하나 · next 없으면 next 칸 없음', async () => {
    const { f } = fake({
      '/marketfeed/issues/7': { body: { ok: true, issue: { id: 7, headline: 'h' }, articles: [{ id: 1 }] } },
      '/marketfeed/news': { body: { ok: true, items: [] } },
    });
    const feed = createMarketFeed({ base: 'https://api.test/v1/moneysign', token: 'pk', fetch: f });
    expect(await feed.issue(7)).toEqual({ issue: { id: 7, headline: 'h' }, articles: [{ id: 1 }] });
    expect(await feed.news()).toEqual({ items: [] });
  });

  it('꺼진 앱(404)은 MarketFeedError 로', async () => {
    const { f } = fake({});
    const feed = createMarketFeed({ base: 'https://api.test/v1/moneysign', token: 'pk', fetch: f });
    await expect(feed.issues()).rejects.toBeInstanceOf(MarketFeedError);
    await expect(feed.issues()).rejects.toMatchObject({ status: 404 });
  });
});
