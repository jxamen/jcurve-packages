import { describe, expect, it } from 'vitest';
import { addTally, chunkOrders, cleanOrder, emptyTally, importMessage, isConnected, normalizeListKey, parseLinkState } from './model';

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

describe('cleanOrder keeps only the allowed fields', () => {
  const base = { orderNo: ' N-100001 ', orderedAt: '2026-10-27 14:03:00', amount: '15,900원', seller: '쿠팡', title: '생수  2L', payment: '카드' };
  it('drops cookies, tokens, recipient and address even when the reader hands them over', () => {
    const out = cleanOrder({ ...base, cookie: 'NID_AUT=abc', token: 't', recipient: '홍길동', address: '서울', phone: '010', password: 'p' });
    expect(out).toEqual({ orderNo: 'N-100001', orderedAt: '2026-10-27 14:03:00', amount: 15900, seller: '쿠팡', title: '생수 2L', payment: '카드' });
    expect(Object.keys(out as object).sort()).toEqual(['amount', 'orderNo', 'orderedAt', 'payment', 'seller', 'title']);
  });
  it('passes the receipt fields (businessNumber digits/dashes, approval, cardIssuer, kind) and drops bad ones', () => {
    const out = cleanOrder({ ...base, businessNumber: '123-45-67890', approval: '12345678', cardIssuer: '신한', kind: 'card', url: 'https://x/?t=1' });
    expect(out).toMatchObject({ businessNumber: '123-45-67890', approval: '12345678', cardIssuer: '신한', kind: 'card' });
    expect(JSON.stringify(out)).not.toContain('https');
    const bad = cleanOrder({ ...base, businessNumber: '123-45 (주)', kind: 'refund' });
    expect(bad && 'businessNumber' in bad).toBe(false);
    expect(bad && 'kind' in bad).toBe(false);
  });
  it('keeps a list row (kind list) without orderNo when it has a listKey, and omits the orderNo field', () => {
    const row = cleanOrder({ orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list', listKey: ' 2026-10-27  14:03|900 ', seller: '컬리' });
    expect(row).toEqual({ orderedAt: '2026-10-27 14:03:22', amount: 900, seller: '컬리', kind: 'list', listKey: '2026-10-27 14:03|900' });
    expect(row && 'orderNo' in row).toBe(false);
    expect(cleanOrder({ orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list', orderNo: '' , listKey: '2026-10-27 14:03|900' })).toMatchObject({ kind: 'list', listKey: '2026-10-27 14:03|900' });
    expect(cleanOrder({ orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list' })).toBeNull();
    expect(cleanOrder({ orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list', listKey: 'L-1' })).toBeNull();
    expect(cleanOrder({ orderedAt: '2026-10-27 14:03:22', amount: 900, listKey: '2026-10-27 14:03|900' })).toBeNull();
  });
  it('a completed order carries the same listKey so the server can replace the list row', () => {
    expect(cleanOrder({ orderNo: 'KR-100001', orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'card', listKey: '2026-10-27 14:03|900' }))
      .toMatchObject({ orderNo: 'KR-100001', kind: 'card', listKey: '2026-10-27 14:03|900' });
    // 모양이 틀린 키는 버리고 주문은 남긴다
    const bad = cleanOrder({ orderNo: 'KR-100001', orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'card', listKey: 'oops' });
    expect(bad && 'listKey' in bad).toBe(false);
  });
  it('normalizes the listKey: date-only 「YYYY-MM-DD|금액」 gets 00:00, wrong shapes are dropped', () => {
    expect(normalizeListKey('2026-10-27|12300')).toBe('2026-10-27 00:00|12300');
    expect(normalizeListKey('2026-10-27 14:03|12300')).toBe('2026-10-27 14:03|12300');
    expect(normalizeListKey('2026-10-27 14:03:22|12300')).toBeUndefined();
    expect(normalizeListKey('2026/10/27|12300')).toBeUndefined();
    expect(normalizeListKey('2026-10-27|12,300')).toBeUndefined();
    expect(normalizeListKey(undefined)).toBeUndefined();
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
    expect(out?.orderNo?.length).toBe(60);
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
    const t = addTally(emptyTally(), [{ result: 'new' }, { result: 'new' }, { result: 'duplicate' }, { result: 'updated' }, { result: 'pouch_full' }, { result: 'weird' }, 7]);
    expect(t).toMatchObject({ new: 2, duplicate: 1, updated: 1, pouch_full: 1, invalid: 2 });
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
