import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createReceiptLinkClient } from './client';
import { consentLines, linkStatus, LOGIN_URL, loadCardState as loadWith } from './card';

const mocks = { get: vi.fn(), post: vi.fn() };
const client = createReceiptLinkClient({ request: mocks });
const loadCardState = () => loadWith(client);
import { parseLinkState } from './model';

describe('order link card', () => {
  beforeEach(() => { mocks.get.mockReset(); mocks.post.mockReset(); });

  it('hides the card (null) when the server switch is off or the state cannot be read', async () => {
    mocks.get.mockRejectedValueOnce({ status: 404 });
    expect(await loadCardState()).toBeNull();
    mocks.get.mockRejectedValueOnce({ status: 500 });
    expect(await loadCardState()).toBeNull();
  });

  it('shows the card with the server state when the switch is on', async () => {
    mocks.get.mockResolvedValueOnce({ windowDays: 30, consentVersion: 'v1', links: { naver: { linkedAt: '2026-10-28 10:00:00', revokedAt: null } } });
    const s = await loadCardState();
    expect(s).not.toBeNull();
    expect(linkStatus(s!, 'naver')).toBe('연결됨 · 2026.10.28');
    expect(linkStatus(s!, 'coupang')).toBe('연결 안 됨');
  });

  it('shows a revoked link as not connected', () => {
    const s = parseLinkState({ links: { coupang: { linkedAt: '2026-10-20T09:00:00+09:00', revokedAt: '2026-10-28T09:00:00+09:00' } } });
    expect(linkStatus(s, 'coupang')).toBe('연결 안 됨');
  });

  it('uses the official login pages of each site', () => {
    expect(LOGIN_URL.naver).toMatch(/^https:\/\/nid\.naver\.com\//);
    expect(LOGIN_URL.coupang).toMatch(/^https:\/\/login\.coupang\.com\//);
  });

  it('consent copy names the six fields, the login rule, and the way out', () => {
    const text = consentLines('naver', { appName: '영테크' }).join('\n');
    for (const word of ['주문번호', '주문일시', '판매처', '상품명', '결제금액', '결제수단', '아이디와 비밀번호', '연결 끊기', '수취인']) {
      expect(text).toContain(word);
    }
    expect(consentLines('coupang', { appName: '영테크' }).join('\n')).toContain('쿠팡 로그인 화면에서 직접');
  });

  it('names the app that asks, and says so when the orders pass the developer server (사임캐시)', () => {
    const own = consentLines('naver', { appName: '사임캐시' }).join('\n');
    expect(own).toContain('사임캐시가 회원님의 네이버 주문내역');
    expect(own).toContain('사임캐시 서버로 보내지 않아요');
    expect(own).not.toContain('영테크');
    const via = consentLines('naver', { appName: '사임캐시', viaDeveloperServer: true }).join('\n');
    expect(via).toContain('앱 서버를 거쳐 연동 서버에 저장돼요');
    expect(via).toContain('수취인');
  });
});
