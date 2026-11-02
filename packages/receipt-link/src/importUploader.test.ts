import { describe, expect, it } from 'vitest';
import { createUploader, type UploadProgress, type UploaderSend } from './importUploader';
import { emptyTally, type ImportTally, type OrderInput } from './model';

const NOW = Date.UTC(2026, 9, 28, 0, 0);
const raw = (i: number, extra: Record<string, unknown> = {}) => ({
  orderNo: 'RC-' + String(100000 + i), orderedAt: '2026-10-27 14:03:22', amount: 1000 + i, payment: '카드', kind: 'card', ...extra,
});
const tallyOf = (over: Partial<ImportTally>): ImportTally => ({ ...emptyTally(), ...over });

/** 받은 묶음을 기록하고 모두 new 로 답하는 가짜 서버 */
function server(opts: { failTimes?: number; result?: (o: OrderInput, i: number) => keyof ImportTally; status?: number; code?: string } = {}) {
  const calls: OrderInput[][] = [];
  let fails = opts.failTimes ?? 0;
  const send: UploaderSend = async (orders) => {
    calls.push(orders);
    if (fails > 0) {
      fails--;
      throw Object.assign(new Error('x'), { status: opts.status ?? 500, code: opts.code ?? 'http_500' });
    }
    const t = emptyTally();
    orders.forEach((o, i) => { t[(opts.result ? opts.result(o, i) : 'new')]++; });
    return { tally: t, unreadable: 0 };
  };
  return { send, calls };
}

describe('읽는 대로 올리기 (createUploader)', () => {
  it('add 하는 대로 바로 올리고, 이미 올린 주문은 다시 올리지 않는다', async () => {
    const s = server();
    const seen: UploadProgress[] = [];
    const u = createUploader({ send: s.send, nowMs: NOW, onChange: (p) => seen.push(p) });
    u.add([raw(1), raw(2)]);
    await u.flush();
    u.add([raw(2), raw(3)]);
    await u.flush();
    expect(s.calls.map((c) => c.map((o) => o.orderNo))).toEqual([['RC-100001', 'RC-100002'], ['RC-100003']]);
    expect(u.progress()).toMatchObject({ read: 3, sent: 3, pending: 0, failed: false });
    expect(seen.some((p) => p.sent === 2)).toBe(true);
  });

  it('올리는 동안 쌓인 주문은 다음 요청에 묶어 50건 이하로 올린다', async () => {
    const calls: number[] = [];
    let release: (() => void) | null = null;
    const send: UploaderSend = (orders) => {
      calls.push(orders.length);
      const t = tallyOf({ new: orders.length });
      if (calls.length === 1) return new Promise((res) => { release = () => res({ tally: t, unreadable: 0 }); });
      return Promise.resolve({ tally: t, unreadable: 0 });
    };
    const u = createUploader({ send, nowMs: NOW });
    u.add([raw(1)]);
    expect(calls).toEqual([1]);
    u.add(Array.from({ length: 70 }, (_, i) => raw(10 + i)));
    u.add([raw(200)]);
    expect(calls).toEqual([1]);          // 첫 요청이 끝나기 전에는 새 요청을 겹쳐 보내지 않는다
    (release as unknown as () => void)();
    await u.flush();
    await u.flush();
    expect(calls).toEqual([1, 50, 21]);
    expect(u.progress()).toMatchObject({ read: 72, sent: 72, pending: 0 });
  });

  it('실패한 묶음은 줄에 남고 다음 add 에서 다시 올린다(순서 유지)', async () => {
    const s = server({ failTimes: 1 });
    const u = createUploader({ send: s.send, nowMs: NOW });
    u.add([raw(1), raw(2)]);
    await u.flush();
    expect(u.progress()).toMatchObject({ read: 2, sent: 0, pending: 2, failed: true });
    u.add([raw(3)]);
    await u.flush();
    expect(s.calls.map((c) => c.map((o) => o.orderNo))).toEqual([['RC-100001', 'RC-100002'], ['RC-100001', 'RC-100002', 'RC-100003']]);
    expect(u.progress()).toMatchObject({ sent: 3, pending: 0, failed: false });
  });

  it('끝낼 때(finish) 남은 것을 올리고, 한 번 실패해도 한 번 더 시도한다', async () => {
    const s = server({ failTimes: 1 });
    const u = createUploader({ send: s.send, nowMs: NOW });
    u.add([raw(1)]);
    const r = await u.finish();
    expect(s.calls).toHaveLength(2);
    expect(r.pending).toBe(0);
    expect(r.result).toMatchObject({ read: 1, sent: 1, added: 1, duplicates: 0, rejected: 0 });
    expect(r.result.note).toBeUndefined();
  });

  it('끝낼 때 서버가 거절한 까닭별 개수(tally)를 돌려준다 — 컬리 6건이 전부 거절된 까닭을 구조 기록으로 남기는 근거', async () => {
    const s = server({ result: (_o, i) => (i < 2 ? 'out_of_range' : i === 2 ? 'amount' : 'new') });
    const u = createUploader({ send: s.send, nowMs: NOW });
    u.add([raw(1), raw(2), raw(3), raw(4)]);
    const r = await u.finish();
    expect(r.tally).toMatchObject({ new: 1, out_of_range: 2, amount: 1, invalid: 0 });
    expect(r.result.rejected).toBe(3);
    expect(r.unreadable).toBe(0);
  });

  it('계속 실패하면 finish 가 못 올린 수를 알려 준다(화면은 「다시 보내기」)', async () => {
    const s = server({ failTimes: 99 });
    const u = createUploader({ send: s.send, nowMs: NOW });
    u.add([raw(1), raw(2)]);
    const r = await u.finish();
    expect(r.pending).toBe(2);
    expect(r.result.sent).toBe(0);
    s.calls.length = 0;
    const again = createUploader({ send: server().send, nowMs: NOW });
    again.add([raw(1)]);
    expect((await again.finish()).pending).toBe(0);
  });

  it('주문을 하나도 못 읽고 끝나면 no_orders', async () => {
    const u = createUploader({ send: server().send, nowMs: NOW });
    const r = await u.finish();
    expect(r.result).toMatchObject({ read: 0, sent: 0, note: 'no_orders' });
  });

  it('서버가 read_disabled(403)를 주면 더 올리지 않는다', async () => {
    const s = server({ failTimes: 1, status: 403, code: 'read_disabled' });
    const u = createUploader({ send: s.send, nowMs: NOW });
    u.add([raw(1)]);
    await u.flush();
    expect(u.progress()).toMatchObject({ readOff: true, pending: 0 });
    u.add([raw(2)]);
    await u.flush();
    expect(s.calls).toHaveLength(1);
  });

  it('주머니가 가득 차면(pouch_full) 남은 것은 보내지 않고 같은 사유로 센다', async () => {
    const s = server({ result: (_o, i) => (i === 0 ? 'new' : 'pouch_full') });
    const u = createUploader({ send: s.send, nowMs: NOW });
    u.add([raw(1), raw(2)]);
    await u.flush();
    u.add([raw(3)]);
    await u.flush();
    expect(s.calls).toHaveLength(1);
    expect(u.progress().full).toBe(true);
    const r = await u.finish();
    expect(r.result).toMatchObject({ added: 1, rejected: 2 });
  });

  it('검사에서 틀린 주문 · 1년 밖 주문은 올리지 않고 세기만 한다', async () => {
    const s = server();
    const u = createUploader({ send: s.send, nowMs: NOW });
    u.add([raw(1), raw(2, { orderedAt: '2024-01-01 10:00:00' }), raw(3, { amount: 0 }), raw(4, { noSeconds: true })]);
    const r = await u.finish();
    expect(s.calls.flat().map((o) => o.orderNo)).toEqual(['RC-100001']);
    expect(r.result).toMatchObject({ read: 2, sent: 1, rejected: 3 });
  });

  it('서버가 duplicate 로 답하면 중복으로 센다(같은 영수증이 사진 영수증 · 다른 주문에 이미 있음)', async () => {
    const s = server({ result: (o) => (o.orderNo === 'RC-100002' ? 'duplicate' : 'new') });
    const u = createUploader({ send: s.send, nowMs: NOW });
    u.add([raw(1), raw(2)]);
    const r = await u.finish();
    expect(r.result).toMatchObject({ sent: 2, added: 1, duplicates: 1, rejected: 0 });
  });
});

describe('목록 행(kind list)과 완성본 올리기', () => {
  const K = (n: number) => `2026-10-27 14:0${n}|900`;
  const list = (key: string, extra: Record<string, unknown> = {}) => ({ orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list', listKey: key, ...extra });

  it('목록 행은 orderNo 없이 kind · listKey 와 함께 그대로 올리고, 완성본이 오면 다시 올린다(서버가 바꿔 넣는다)', async () => {
    const s = server({ result: (o) => (o.kind === 'list' ? 'new' : 'updated') });
    const u = createUploader({ send: s.send, nowMs: NOW });
    u.add([list(K(1)), list(K(2), { orderNo: 'KR-300002' })]);
    await u.flush();
    expect(s.calls[0]).toEqual([
      { orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list', listKey: K(1) },
      { orderedAt: '2026-10-27 14:03:22', amount: 900, kind: 'list', listKey: K(2), orderNo: 'KR-300002' },
    ]);
    expect('orderNo' in s.calls[0][0]).toBe(false);
    u.add([raw(1, { orderNo: 'KR-300001', listKey: K(1) }), raw(2, { orderNo: 'KR-300002' })]);
    const r = await u.finish();
    expect(s.calls[1].map((o) => o.orderNo)).toEqual(['KR-300001', 'KR-300002']);
    expect(s.calls[1].every((o) => o.kind === 'card')).toBe(true);
    // updated 는 성공이다 — 중복도 거절도 아니다
    expect(r.result).toMatchObject({ read: 4, sent: 4, added: 2, duplicates: 0, rejected: 0 });
    expect(u.progress().read).toBe(2);
  });
});
