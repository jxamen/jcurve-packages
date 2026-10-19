import { describe, expect, it } from 'vitest';
import { countdown, partnerLine, realRecent, rewardName, won } from './format';
import { createMockShoppingApi } from './mock';
import { createHttpShoppingApi } from './http';
import { DEFAULT_THEME } from './types';

const theme = { ...DEFAULT_THEME, appName: '당근캐시', pointName: '포인트' };

describe('쇼핑 글', () => {
  it('남은 시간 hh:mm:ss, 끝나면 null', () => {
    expect(countdown(3_723_000, 0)).toBe('01:02:03');
    expect(countdown(1000, 1000)).toBeNull();
  });
  it('제휴처 한 줄은 앱 포인트 이름 · 할인권으로', () => {
    expect(partnerLine({ id: 'toss', name: '토스쇼핑', rateText: '3%', rewardKind: 'point' }, theme)).toBe('구매 금액의 3%를 포인트로 드려요');
    expect(partnerLine({ id: 'c', name: '쿠팡', rateText: '1.2%', rewardKind: 'coupon' }, theme)).toBe('구매 금액의 1.2%를 할인권으로 드려요');
    expect(rewardName('point', theme)).toBe('포인트');
    expect(partnerLine({ id: 'c', name: '쿠팡', rateText: '2%', rewardKind: 'coupon', rewardLabel: '캐시' }, theme)).toBe('구매 금액의 2%를 캐시로 드려요');   // 서버 설정값이 먼저
    expect(won(14900)).toBe('14,900원');
  });
  it('보상 없는 제휴처는 안내 원문만 표시한다', () => {
    expect(partnerLine({ id: 'sharing', name: '쇼핑', rateText: '추천 상품 둘러보기', rewardKind: 'none' }, theme)).toBe('추천 상품 둘러보기');
  });
  it('적립 기록 띠는 실제 기록만 — 이름이나 금액이 없으면 버린다(가짜 문구 금지)', () => {
    expect(realRecent(undefined)).toEqual([]);
    expect(realRecent([{ maskedName: '', amount: 100, unit: '원', at: 1 }, { maskedName: '따뜻한****', amount: 0, unit: '원', at: 1 }])).toEqual([]);
    expect(realRecent([{ maskedName: '따뜻한****', amount: 100, unit: '원', at: 1 }])).toHaveLength(1);
  });
  it('목업은 「목업」 표시가 붙고 적립 기록은 비어 있다', async () => {
    const api = createMockShoppingApi(0);
    const home = await api.home();
    expect(home.recent).toEqual([]);
    expect((await api.products({ partnerId: 'toss' })).items.every(p => p.title.startsWith('[목업]'))).toBe(true);
    expect((await api.notice('all')).every(n => n.title.startsWith('[목업]'))).toBe(true);
  });
  it('서버 경로 — 이동 링크는 POST, 조회는 제휴처 · 분류를 붙인다', async () => {
    const calls: Array<[string, unknown]> = [];
    const api = createHttpShoppingApi(async <T,>(path: string, init?: { method?: string; body?: unknown }) => { calls.push([path, init?.body ?? null]); return ({ items: [], url: 'https://x', home: {}, deals: null, info: null, sections: [] } as unknown) as T; });
    await api.products({ partnerId: 'coupang', categoryId: 'food' });
    await api.link({ partnerId: 'toss', productId: 'p1' });
    const bad = createHttpShoppingApi(async <T,>() => ({ ok: false, error: 'signup_required' } as unknown as T));
    await expect(bad.link({ partnerId: 'coupang' })).rejects.toMatchObject({ code: 'signup_required' });
    expect(calls).toEqual([['shopping/products?partner=coupang&category=food', null], ['shopping/link', { partner: 'toss', product: 'p1' }]]);
  });
});
