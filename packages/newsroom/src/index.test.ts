import { describe, expect, it } from 'vitest';
import { NewsroomError, createNewsroom } from './index';

/* eslint-disable @typescript-eslint/no-explicit-any */

function fake(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: Array<{ method: string; url: string; headers: Record<string, string> }> = [];
  const f = (async (url: string, init: any) => {
    calls.push({ method: init.method, url, headers: init.headers });
    const path = init.method + ' ' + url.replace('https://api.test/v1/moneysign', '').split('?')[0];
    const r = routes[path] ?? { status: 404, body: { ok: false } };

    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body } as any;
  }) as unknown as typeof fetch;

  return { f, calls };
}

describe('@jcurve/newsroom', () => {
  it('홈 · 목록은 앱 키만, 빈 칸은 빈 배열로', async () => {
    const { f, calls } = fake({
      'GET /newsroom/home': { body: { ok: true, articles: [{ id: 1 }], cases: [] } },
      'GET /newsroom/cases': { body: { ok: true, items: [{ id: 3 }], next: '3' } },
    });
    const nr = createNewsroom({ base: 'https://api.test/v1/moneysign', token: 'pk', fetch: f, session: () => 'sess' });
    expect(await nr.home()).toEqual({ articles: [{ id: 1 }], cases: [], endings: [], xfiles: [] });
    expect(await nr.cases({ state: 'open' })).toEqual({ items: [{ id: 3 }], next: '3' });
    expect(calls[1].url).toBe('https://api.test/v1/moneysign/newsroom/cases?state=open');
    expect(calls[0].headers['X-App-Token']).toBe('pk');
    expect(calls[0].headers.Authorization).toBeUndefined();
  });

  it('추적은 로그인 토큰을 붙여 PUT · DELETE, 내 추적은 me/newsroom-follows', async () => {
    const { f, calls } = fake({
      'PUT /newsroom/follows/case/5': { body: { ok: true, following: true } },
      'DELETE /newsroom/follows/xfile/2': { body: { ok: true, following: false } },
      'GET /me/newsroom-follows': { body: { ok: true, cases: [{ id: 5 }] } },
    });
    const nr = createNewsroom({ base: 'https://api.test/v1/moneysign/', token: 'pk', fetch: f, session: async () => 'sess' });
    expect(await nr.follow('case', 5)).toBe(true);
    expect(await nr.unfollow('xfile', 2)).toBe(false);
    expect(await nr.following()).toEqual({ cases: [{ id: 5 }], xfiles: [] });
    expect(calls.every((c) => c.headers.Authorization === 'Bearer sess')).toBe(true);
  });

  it('사건 상세 · 기사 · X파일, 꺼진 앱은 NewsroomError 404', async () => {
    const { f } = fake({
      'GET /newsroom/cases/9': { body: { ok: true, case: { id: 9 }, events: [{ id: 1, kind: 'inquiry' }] } },
      'GET /newsroom/articles/4': { body: { ok: true, article: { id: 4, body: '본문' } } },
      'GET /newsroom/xfiles/2': { body: { ok: true, xfile: { id: 2 } } },
    });
    const nr = createNewsroom({ base: 'https://api.test/v1/moneysign', token: 'pk', fetch: f });
    expect(await nr.caseDetail(9)).toEqual({ case: { id: 9 }, events: [{ id: 1, kind: 'inquiry' }], articles: [] });
    expect((await nr.article(4)).body).toBe('본문');
    expect(await nr.xfile(2)).toEqual({ xfile: { id: 2 }, episodes: [] });
    await expect(nr.xfiles()).rejects.toBeInstanceOf(NewsroomError);
  });
});
