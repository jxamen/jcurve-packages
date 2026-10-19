import { describe, expect, it } from 'vitest';
import { proofDday, dealEndsAt, countdown, partnerLine, realRecent, rewardName, num, won } from './format';
import { createHttpShoppingApi, parseProofInfo } from './http';
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


describe('구매 인증', () => {
  it('확정 대기는 시간 차가 아닌 현지 달력 날짜로 계산한다', () => {
    const now = new Date(2026, 9, 20, 23, 59).getTime();
    expect(proofDday(new Date(2026, 9, 23, 0, 1).getTime(), now)).toBe('D-3');
    expect(proofDday(new Date(2026, 9, 20, 0).getTime(), now)).toBe('D-day');
    expect(proofDday(new Date(2026, 9, 19).getTime(), now)).toBe('D-day');
    expect(proofDday(new Date(2027, 0, 1).getTime(), new Date(2026, 11, 31).getTime())).toBe('D-1');
  });

  it('안내 404만 숨기며 제출 서버 오류 코드를 보존한다', async () => {
    const missing = createHttpShoppingApi(async () => { throw Object.assign(new Error('missing'), { status: 404 }); });
    expect(await missing.proof!.info('toss')).toBeNull();
    const failed = createHttpShoppingApi(async () => { throw Object.assign(new Error('offline'), { code: 'network' }); });
    await expect(failed.proof!.info('toss')).rejects.toMatchObject({ code: 'network' });
    // Node의 FormData와 다른 RN 파일 descriptor 계약을 작은 대역으로 확인한다.
    const original = globalThis.FormData;
    class NativeFormData {
      fields: Array<[string, unknown]> = [];
      append(name: string, value: unknown) { this.fields.push([name, value]); }
    }
    globalThis.FormData = NativeFormData as unknown as typeof FormData;
    try {
      const calls: Array<[string, unknown]> = [];
      const api = createHttpShoppingApi(async <T,>(path: string, init?: { method?: string; body?: unknown }) => {
        calls.push([path, init]);
        return { error: 'duplicate' } as T;
      });
      const image = { uri: 'file:///order.png', name: 'order.png', type: 'image/png' };
      await expect(api.proof!.submit({ partnerId: 'toss', image, orderNo: 'a1', amount: 0 })).rejects.toMatchObject({ code: 'duplicate' });
      expect(calls).toEqual([['shopping/proofs', { method: 'POST', body: { fields: [['partner', 'toss'], ['image', image], ['orderNo', 'a1'], ['amount', '0']] } }]]);
      await api.proof!.info('a b');
      await api.proof!.list();
      expect(calls.slice(1)).toEqual([['shopping/proof/info?partner=a%20b', undefined], ['shopping/proofs', undefined]]);
    } finally { globalThis.FormData = original; }
  });
});

describe('구매 인증 안내 모양 검사', () => {
  it('선택 서버 글과 중첩 목록을 원문 그대로 통과시킨다', async () => {
    const info = { rateText: '서버 비율', title: null, subtitle: '서버 부제', payoutText: '서버 지급 안내', steps: [{ title: '첫 단계', desc: null }, { title: '다음 단계' }], faq: [{ q: '질문', a: '답변' }], notice: [{ title: '안내', items: ['원문', { text: '내용', sub: ['세부'] }] }], cta: '서버 버튼' };
    expect(parseProofInfo(info)).toMatchObject(info);
    const api = createHttpShoppingApi(async <T,>() => ({ info }) as T);
    expect(await api.proof!.info('partner')).toMatchObject(info);
  });
  it('없는 값은 undefined이며 잘못된 모양만 제외한다', () => {
    const info = parseProofInfo({ rateText: '비율', subtitle: 1, payoutText: {}, steps: [{ title: 3 }], faq: [{ q: '질문' }], notice: [{ title: '안내', items: [false] }], cta: false });
    expect(info).toEqual({ rateText: '비율', title: undefined, subtitle: undefined, payoutText: undefined, cta: undefined, guide: undefined, confirmDays: undefined, dailyMax: undefined, steps: undefined, faq: undefined, notice: undefined });
    expect(parseProofInfo({ rateText: '비율' })?.steps).toBeUndefined();
    expect(parseProofInfo(null)).toBeNull();
    expect(parseProofInfo({ rateText: 1 })).toBeNull();
    expect(parseProofInfo({ rateText: '비율', subtitle: null, payoutText: null, cta: null, steps: [], faq: [], notice: [] })).toMatchObject({ subtitle: null, payoutText: null, cta: null, steps: [], faq: [], notice: [] });
  });
});


describe('0.1.6 서버 계약', () => {
  it.each([undefined, null, NaN, Infinity, -Infinity, '14900', '', {}, false])('숫자가 아닌 값 %s는 가격으로 만들지 않는다', value => {
    expect(won(value)).toBe('');
    expect(num(value)).toBe('');
  });

  it('ok 응답의 데이터 키와 선택 가격을 그대로 읽는다', async () => {
    const item = { id: 'manual', partnerId: 'a b', title: '가격 없는 상품', reward: 0, rewardKind: 'none' as const };
    const themes = [{ id: 'theme', title: '수동 목록', items: [item] }];
    const calls: string[] = [];
    const api = createHttpShoppingApi(async <T,>(path: string) => {
      calls.push(path);
      return { ok: true, themes, items: [item], next: 'next', home: { partners: [] }, deals: null, info: null, sections: [] } as T;
    });
    expect(await api.themes!('a b')).toEqual(themes);
    expect(calls[0]).toBe('shopping/themes?partner=a%20b');
    expect(await api.products({ partnerId: 'all' })).toMatchObject({ items: [item], next: 'next' });
    expect(await api.home()).toEqual({ partners: [] });
    const empty = createHttpShoppingApi(async <T,>() => ({ ok: true }) as T);
    expect(await empty.themes!('all')).toEqual([]);
  });

  it.each([{ status: 404 }, { statusCode: 404 }, { code: '404' }])('선택 안내 404는 숨긴다: %s', async error => {
    const api = createHttpShoppingApi(async () => { throw error; });
    expect(await api.notice('all')).toEqual([]);
    expect(await api.couponInfo('partner')).toBeNull();
  });

  it('선택 안내의 다른 오류는 숨기지 않는다', async () => {
    const error = Object.assign(new Error('offline'), { code: 'network' });
    const api = createHttpShoppingApi(async () => { throw error; });
    await expect(api.notice('all')).rejects.toBe(error);
    await expect(api.couponInfo('partner')).rejects.toBe(error);
  });
});


describe('하루특가 종료 시각', () => {
  const now = Date.parse('2026-10-20T14:59:58Z'); // 한국 23:59:58
  const midnight = Date.parse('2026-10-20T15:00:00Z');
  it.each([undefined, null, NaN, Infinity, -Infinity, 0, now - 1, now])('없는 · 잘못된 · 지난 시각 %s는 다음 한국 자정', endsAt => {
    expect(dealEndsAt(endsAt, now)).toBe(midnight);
  });
  it('런타임에서 숫자가 아닌 값도 한국 자정으로 처리한다', () => {
    expect(dealEndsAt('123' as unknown as number, now)).toBe(midnight);
  });
  it('유효한 미래 시각은 유지하고 자정 경계에서 다음 날로 넘어간다', () => {
    expect(dealEndsAt(now + 1000, now)).toBe(now + 1000);
    expect(dealEndsAt(undefined, midnight)).toBe(midnight + 86_400_000);
    expect(dealEndsAt(null, Date.parse('2026-12-31T15:00:00Z'))).toBe(Date.parse('2027-01-01T15:00:00Z'));
  });
  it('확정한 종료 시각은 만료 때 0으로 끝난다', () => {
    const end = dealEndsAt(undefined, now);
    expect(countdown(end, now)).toBe('00:00:02');
    expect(countdown(end, end)).toBeNull();
    expect(countdown(end, end + 1000)).toBeNull();
  });
  it('deals의 경로 · 원본 응답과 빈 응답 계약을 유지한다', async () => {
    const deals = { items: [] };
    const paths: string[] = [];
    const api = createHttpShoppingApi(async <T,>(path: string) => { paths.push(path); return { deals } as T; });
    expect(await api.deals('a b')).toBe(deals);
    expect(paths).toEqual(['shopping/deals?partner=a%20b']);
    const empty = createHttpShoppingApi(async <T,>() => ({}) as T);
    expect(await empty.deals('toss')).toBeNull();
  });
});
