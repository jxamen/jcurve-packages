import { describe, expect, it } from 'vitest';
import { addTally, chunkOrders, cleanOrder, emptyTally, importMessage, isConnected, LINK_LABEL, parseLinkState, TEST_LINK_PLATFORMS } from './model';

describe('order link state', () => {
  it('reads the server state defensively', () => {
    const s = parseLinkState({ windowDays: 30, consentVersion: '2026-10-28', links: { naver: { linkedAt: '2026-10-28 11:00:00', revokedAt: null, lastImportAt: null, importedTotal: 3 }, other: { linkedAt: 'x' } } });
    expect(Object.keys(s.links)).toEqual(['naver']);
    expect(isConnected(s, 'naver')).toBe(true);
    expect(isConnected(s, 'coupang')).toBe(false);
    expect(parseLinkState(null).links).toEqual({});
    expect(parseLinkState(null).windowDays).toBe(30);
  });
  it('treats a revoked link as not connected', () => {
    const s = parseLinkState({ links: { coupang: { linkedAt: 'a', revokedAt: 'b', lastImportAt: null, importedTotal: 0 } } });
    expect(isConnected(s, 'coupang')).toBe(false);
  });
});

describe('cleanOrder keeps only the six allowed fields', () => {
  const base = { orderNo: ' N-100001 ', orderedAt: '2026-10-27 14:03:00', amount: '15,900원', seller: '쿠팡', title: '생수  2L', payment: '카드' };
  it('drops cookies, tokens, recipient and address even when the reader hands them over', () => {
    const out = cleanOrder({ ...base, cookie: 'NID_AUT=abc', token: 't', recipient: '홍길동', address: '서울', phone: '010', password: 'p' });
    expect(out).toEqual({ orderNo: 'N-100001', orderedAt: '2026-10-27 14:03:00', amount: 15900, seller: '쿠팡', title: '생수 2L', payment: '카드' });
    expect(Object.keys(out as object).sort()).toEqual(['amount', 'orderNo', 'orderedAt', 'payment', 'seller', 'title']);
  });
  it('rejects a missing or malformed number, date or amount', () => {
    expect(cleanOrder({ ...base, orderNo: '' })).toBeNull();
    expect(cleanOrder({ ...base, orderedAt: 'not-a-date' })).toBeNull();
    expect(cleanOrder({ ...base, amount: '무료' })).toBeNull();
    expect(cleanOrder({ ...base, amount: -1 })).toBeNull();
    expect(cleanOrder({ ...base, amount: 2_000_000_000 })).toBeNull();
    expect(cleanOrder(null)).toBeNull();
  });
  it('clips long texts and omits empty optional fields', () => {
    const out = cleanOrder({ orderNo: 'A'.repeat(100), orderedAt: '2026-10-27T14:03:00+09:00', amount: 100, title: 'x'.repeat(500), seller: '  ' });
    expect(out?.orderNo.length).toBe(60);
    expect(out?.title?.length).toBe(200);
    expect(out && 'seller' in out).toBe(false);
  });
});

describe('batching and result tally', () => {
  it('chunks by 50', () => {
    expect(chunkOrders(Array.from({ length: 120 }, (_, i) => i)).map(c => c.length)).toEqual([50, 50, 20]);
    expect(chunkOrders([])).toEqual([]);
  });
  it('counts results and treats unknown values as invalid', () => {
    const t = addTally(emptyTally(), [{ result: 'new' }, { result: 'new' }, { result: 'duplicate' }, { result: 'pouch_full' }, { result: 'weird' }, 7]);
    expect(t).toMatchObject({ new: 2, duplicate: 1, pouch_full: 1, invalid: 2 });
    expect(addTally(t, undefined)).toEqual(t);
  });
  it('explains the outcome in plain Korean', () => {
    expect(importMessage({ ...emptyTally(), new: 3 })).toBe('새 주문 3건을 영수증 보상으로 담았어요.');
    expect(importMessage(emptyTally())).toBe('새로 담을 주문이 없어요.');
    const m = importMessage({ ...emptyTally(), new: 5, pouch_full: 3, duplicate: 2, taken: 1, out_of_range: 4 }, 1);
    expect(m).toContain('용돈 주머니가 가득 차서 3건');
    expect(m).toContain('이미 가져온 2건');
    expect(m).toContain('다른 계정에서 이미 받은 1건');
    expect(m).toContain('읽을 수 없는 5건');
  });
});

describe('server limits and import texts (0.1.0)', () => {
  it('reads ordersPerRequest and amountMax from the server and falls back for an old server', () => {
    const s = parseLinkState({ ordersPerRequest: 20, amountMax: 3_000_000 });
    expect([s.ordersPerRequest, s.amountMax]).toEqual([20, 3_000_000]);
    const old = parseLinkState({});
    expect([old.ordersPerRequest, old.amountMax]).toEqual([50, null]);
    expect(parseLinkState({ ordersPerRequest: 500 }).ordersPerRequest).toBe(50);      // 서버가 50 보다 크게 말해도 앱은 50 을 넘기지 않는다
    expect(parseLinkState({ ordersPerRequest: 0, amountMax: -1 })).toMatchObject({ ordersPerRequest: 50, amountMax: null });
  });
  it('lets an app word where the reward goes (no 용돈 주머니 outside 영테크)', () => {
    const texts = { added: (n: number) => `${n}건 바로 적립했어요.`, capacityFull: (n: number) => `${n}건은 한도라 못 담았어요.` };
    expect(importMessage({ ...emptyTally(), new: 2 }, 0, texts)).toBe('2건 바로 적립했어요.');
    expect(importMessage({ ...emptyTally(), pouch_full: 4 }, 0, texts)).toContain('4건은 한도라 못 담았어요.');
    expect(importMessage({ ...emptyTally(), new: 1, pouch_full: 1 })).toContain('용돈 주머니');   // 기본 문구는 영테크 그대로
  });
});

describe('platform order and names (영테크 28c41110 sync)', () => {
  it('chips go 네이버 · 쿠팡 · 컬리 · 무신사 and the shown name is 「컬리」', () => {
    expect(TEST_LINK_PLATFORMS).toEqual(['naver', 'coupang', 'kurly', 'musinsa']);
    expect(LINK_LABEL.kurly).toBe('컬리');
    expect(Object.values(LINK_LABEL)).not.toContain('마이컬리');
  });
});
