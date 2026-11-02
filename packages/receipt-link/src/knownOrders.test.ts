import { describe, expect, it } from 'vitest';
import { fetchKnown, KNOWN_FETCH_TIMEOUT_MS, knownFromOrders } from './knownOrders';
import type { LinkOrder } from './ordersModel';

const row = (over: Partial<LinkOrder> = {}): LinkOrder => ({
  id: 1, platform: 'naver', orderNo: '************5678', seller: '화원노리', title: '꽃다발', amount: 12300, orderedAt: '2026-10-27 14:03', claimed: false, claimedAt: null, kind: 'card', duplicate: false, ...over,
});

describe('known 채우기 (knownFromOrders)', () => {
  it('영수증으로 보강된 행(card · purchase · 종류 모름)의 listKey 를 모은다 — 적립 완료 · 이미 올린 영수증 포함', () => {
    const k = knownFromOrders([
      row({ id: 1, kind: 'card' }),
      row({ id: 2, kind: 'purchase', orderedAt: '2026-10-26 09:15', amount: 4500 }),
      row({ id: 3, kind: 'card', claimed: true, claimedAt: '2026-10-27 15:00', orderedAt: '2026-10-25 18:40', amount: 900 }),
      row({ id: 4, kind: 'card', duplicate: true, orderedAt: '2026-10-24 11:11', amount: 700 }),
      row({ id: 5, kind: null, orderedAt: '2026-10-23 08:00', amount: 300 }),
    ], 'naver');
    expect(k?.listKeys).toEqual(['2026-10-27 14:03|12300', '2026-10-26 09:15|4500', '2026-10-25 18:40|900', '2026-10-24 11:11|700', '2026-10-23 08:00|300']);
  });

  it('보강 안 된 list 행은 넣지 않는다 — 흐름이 다시 보강해야 한다', () => {
    const k = knownFromOrders([row({ id: 1, kind: 'list', orderNo: '2026102712345678' }), row({ id: 2, kind: 'card', orderedAt: '2026-10-26 09:15', amount: 4500 })], 'naver');
    expect(k).toEqual({ orderNos: [], listKeys: ['2026-10-26 09:15|4500'], tails: ['5678|2026-10-26'] });
    expect(knownFromOrders([row({ kind: 'list' })], 'naver')).toBeUndefined();
  });

  it('주문번호는 16자리 숫자 그대로일 때만 넣는다 — 서버가 가린 값(***5678)이나 빈 칸이면 listKey 만', () => {
    const k = knownFromOrders([
      row({ id: 1, orderNo: '2026102712345678' }),
      row({ id: 2, orderNo: '************5678', orderedAt: '2026-10-20 10:00', amount: 100 }),
      row({ id: 3, orderNo: '', orderedAt: '2026-10-19 10:00', amount: 200 }),
    ], 'naver');
    expect(k?.orderNos).toEqual(['2026102712345678']);
    expect(k?.listKeys).toHaveLength(3);
  });

  it('tails — 가려진 주문번호의 뒤 4자리와 날짜로 이미 가져온 주문을 가린다(영수증의 결제 시각 · 금액이 목록과 달라도 맞는다). 주문번호가 빈 줄은 만들지 않는다', () => {
    const k = knownFromOrders([
      row({ id: 1, orderNo: '2026102712345678' }),
      row({ id: 2, orderNo: '************4321', orderedAt: '2026-10-20 10:00', amount: 100 }),
      row({ id: 3, orderNo: '', orderedAt: '2026-10-19 10:00', amount: 200 }),
      row({ id: 4, orderNo: '************4321', kind: 'list', orderedAt: '2026-10-18 10:00', amount: 300 }),
    ], 'naver');
    expect(k?.tails).toEqual(['5678|2026-10-27', '4321|2026-10-20']);
  });

  it('이 곳(platform)의 행만 쓴다 · 같은 키는 한 번만 · 시각이나 금액이 모양에 안 맞으면 키를 만들지 않는다', () => {
    const k = knownFromOrders([
      row({ id: 1, platform: 'coupang' }),
      row({ id: 2 }),
      row({ id: 3 }),
      row({ id: 4, orderedAt: '10/27', amount: 100 }),
      row({ id: 5, amount: 0, orderedAt: '2026-10-22 10:00' }),
    ], 'naver');
    expect(k).toEqual({ orderNos: [], listKeys: ['2026-10-27 14:03|12300'], tails: ['5678|2026-10-27'] });
    expect(knownFromOrders([], 'naver')).toBeUndefined();
  });
});

describe('서버 목록 한 번 받기 (fetchKnown)', () => {
  it('받은 목록으로 known 을 채우고, 목록은 한 번만 부른다', async () => {
    let calls = 0;
    const k = await fetchKnown(async () => { calls++; return { orders: [row()] }; }, 'naver');
    expect(calls).toBe(1);
    expect(k).toEqual({ orderNos: [], listKeys: ['2026-10-27 14:03|12300'], tails: ['5678|2026-10-27'] });
  });

  it('목록 받기가 실패하면 known 없이 시작한다(전체 처리)', async () => {
    expect(await fetchKnown(async () => { throw new Error('offline'); }, 'naver')).toBeUndefined();
  });

  it('목록이 너무 늦으면 기다리지 않고 known 없이 시작한다', async () => {
    expect(KNOWN_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
    const never = () => new Promise<{ orders: LinkOrder[] }>(() => undefined);
    const started = Date.now();
    expect(await fetchKnown(never, 'naver', 30)).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('목록이 아직 비었으면 known 없음', async () => {
    expect(await fetchKnown(async () => ({ orders: [] }), 'naver')).toBeUndefined();
  });
});
