import { describe, expect, it } from 'vitest';
import { failItems, updateIdOf, type FailOrder } from './failLog';

describe('실패 기록 줄', () => {
  const orders = new Map<string, FailOrder>([
    ['a', { orderNo: '21100000000001', title: '상품A', orderedAt: '2026-10-19 12:52:42', amount: 12900 }],
    ['b', { orderNo: '21100000000002', orderedAt: '2026-10-18 10:00:00', amount: 5000 }],
    ['c', { orderNo: '21100000000003', orderedAt: '2026-10-17 10:00:00', amount: 7000 }],
    ['d', { orderNo: '21100000000004', orderedAt: '2026-10-16 10:00:00', amount: 9000 }],
  ]);

  it('못 가져옴 · 영수증 없음 · 끝까지 못 받은 줄만, 흐름 진단 + 실행 정보를 싣는다(가져옴 · 취소는 뺀다)', () => {
    const items = failItems({
      a: { state: 'failed', code: 'unreadable', info: { stage: 'read', via: 'nav', len: 300, words: 'bw-a-l6' } },
      b: { state: 'fetching' },
      c: { state: 'done' },
      d: { state: 'none', why: 'cancelled' },
    }, orders, 'closed', { os: 'ios', update_id: 'u1' });
    expect(items).toEqual([
      { order_no: '21100000000001', title: '상품A', ordered_at: '2026-10-19 12:52:42', amount: 12900, outcome: 'failed', code: 'unreadable', stage: 'read', moved_on: true, info: { stage: 'read', via: 'nav', len: 300, words: 'bw-a-l6', os: 'ios', update_id: 'u1' } },
      { order_no: '21100000000002', title: null, ordered_at: '2026-10-18 10:00:00', amount: 5000, outcome: 'left', code: 'closed', stage: 'request', moved_on: false, info: { os: 'ios', update_id: 'u1' } },
    ]);
  });

  it('진단 없는 쇼핑몰은 까닭 코드로 단계를 정한다', () => {
    expect(failItems({ a: { state: 'failed', code: 'no-pair' } }, orders, 'x', {})[0].stage).toBe('detail');
  });

  it('업데이트 ID 는 CJS/ESM 둘 다', () => {
    expect(updateIdOf({ updateId: 'x' })).toBe('x');
    expect(updateIdOf({ default: { updateId: 'y' } })).toBe('y');
    expect(updateIdOf(null)).toBe('');
  });
});
