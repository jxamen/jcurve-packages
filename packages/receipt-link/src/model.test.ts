import { describe, expect, it } from 'vitest';
import { addTally, chunkOrders, cleanOrder, effectiveReadDays, emptyTally, importMessage, isConnected, isLinked, LINK_STAGE_LABEL, linkStage, normalizeListKey, parseLinkState } from './model';

describe('order link state', () => {
  it('reads the server state defensively', () => {
    const s = parseLinkState({ windowDays: 30, consentVersion: '2026-10-28', links: { naver: { linkedAt: '2026-10-28 11:00:00', revokedAt: null, lastImportAt: null, importedTotal: 3 }, other: { linkedAt: 'x' } } });
    expect(Object.keys(s.links)).toEqual(['naver']);
    expect(isConnected(s, 'naver')).toBe(true);
    expect(isConnected(s, 'coupang')).toBe(false);
    expect(parseLinkState(null).links).toEqual({});
    expect(parseLinkState(null).windowDays).toBe(30);
  });

  it('keeps only positive per-platform read days from the server', () => {
    expect(parseLinkState({ readDays: { naver: 365, kurly: 1095, coupang: 0, musinsa: 'x' } }).readDays).toEqual({ naver: 365, kurly: 1095 });
    expect(parseLinkState(null).readDays).toEqual({});
  });
  it('연동 칩 단계: 동의 전 none · 동의만 하면 login(「로그인 필요」) · 첫 불러오기(lastImportAt)까지 끝나야 linked(「연동」) · 철회는 none (대표님 11-05 18:06)', () => {
    const s = parseLinkState({ links: {
      naver: { linkedAt: '2026-11-05 18:06:11', revokedAt: null, lastImportAt: '2026-11-05 18:20:00', importedTotal: 0 },
      daiso: { linkedAt: '2026-11-05 18:06:11', revokedAt: null, lastImportAt: null, importedTotal: 0 },
      kurly: { linkedAt: '2026-11-01 10:00:00', revokedAt: '2026-11-02 10:00:00', lastImportAt: '2026-11-01 10:05:00', importedTotal: 4 },
    } });
    expect(linkStage(s, 'naver')).toBe('linked');
    expect(linkStage(s, 'daiso')).toBe('login');
    expect(linkStage(s, 'kurly')).toBe('none');
    expect(linkStage(s, 'coupang')).toBe('none');
    expect(isConnected(s, 'daiso')).toBe(true);   // 동의는 했다(다시 동의 화면을 띄우지 않는다)
    expect(isLinked(s, 'daiso')).toBe(false);     // 하지만 「연동」은 아니다
    expect(isLinked(s, 'naver')).toBe(true);
    expect(LINK_STAGE_LABEL).toEqual({ none: '미연동', login: '로그인 필요', linked: '연동' });
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
  it('keeps a 「영수증 없음」 row (kind none) like a list row — listKey alone is enough, detail is dropped', () => {
    expect(cleanOrder({ orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'none', listKey: '2026-10-27 14:03|900' })).toEqual({ orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'none', listKey: '2026-10-27 14:03|900' });
    expect(cleanOrder({ orderNo: 'KR-100001', orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'none', needsReceipt: true })).toEqual({ orderNo: 'KR-100001', orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'none' });
    expect(cleanOrder({ orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'none' })).toBeNull();
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

describe('effectiveReadDays — 서버가 받아 주는 기간까지만 읽는다', () => {
  it('컬리 1095 일 설정이어도 서버 받는 기간 365 로 자른다(1년 넘은 주문은 서버가 out_of_range 로 거절)', () => {
    const s = parseLinkState({ windowDays: 365, links: {}, readDays: { naver: 365, kurly: 1095 } });
    expect(effectiveReadDays(s, 'kurly')).toBe(365);
    expect(effectiveReadDays(s, 'naver')).toBe(365);
  });
  it('설정이 받는 기간보다 짧으면 그대로, 설정이 없으면 undefined(흐름 기본값)', () => {
    const s = parseLinkState({ windowDays: 365, links: {}, readDays: { coupang: 90 } });
    expect(effectiveReadDays(s, 'coupang')).toBe(90);
    expect(effectiveReadDays(s, 'musinsa')).toBeUndefined();
    expect(effectiveReadDays(null, 'kurly')).toBeUndefined();
  });
  it('서버가 받는 기간을 안 보낸 기본값(30)이면 자르지 않는다 — 읽기 기간이 30 일로 줄어드는 사고 방지', () => {
    const s = parseLinkState({ links: {}, readDays: { kurly: 1095 } });
    expect(s.windowDays).toBe(30);
    expect(effectiveReadDays(s, 'kurly')).toBe(1095);
  });
  it('서버가 받는 기간을 늘리면(1095) 그만큼 읽는다', () => {
    const s = parseLinkState({ windowDays: 1095, links: {}, readDays: { kurly: 1095 } });
    expect(effectiveReadDays(s, 'kurly')).toBe(1095);
  });
});
