import { describe, expect, it, vi } from 'vitest';
import { linkRecordEntries, linkSourceLabel, claimErrorCode, claimErrorMessage, consentLines, createReceiptLinkApi, linkStatus, LOGIN_URL, ORDER_URL, receiptErrorMessage } from './appKit';
import { parseLinkState } from './model';

const err = (code: string, status: number, serverMessage?: string) => Object.assign(new Error(code), { code, status, serverMessage });
const fakeHttp = () => ({ get: vi.fn(), post: vi.fn() });
const order = (i: number) => ({ orderNo: 'N-' + String(100000 + i), orderedAt: '2026-10-27 14:03:00', amount: 1000 + i });

describe('appKit — 앱이 부르기만 하는 부분', () => {
  it('사이트 주소 · 연결 상태 · 동의 문구(앱 이름을 넣는다)', () => {
    for (const p of ['naver', 'coupang', 'musinsa', 'kurly', 'daiso', 'oliveyoung'] as const) {
      expect(LOGIN_URL[p]).toMatch(/^https:\/\//);
      expect(ORDER_URL[p]).toMatch(/^https:\/\//);
    }
    const s = parseLinkState({ links: { naver: { linkedAt: '2026-10-28 10:00:00', revokedAt: null, lastImportAt: '2026-10-28 10:05:00' }, daiso: { linkedAt: '2026-11-05 18:06:11', revokedAt: null } } });
    expect(linkStatus(s, 'naver')).toBe('연결됨 · 2026.10.28');
    expect(linkStatus(s, 'daiso')).toBe('로그인 필요');   // 동의만 — 첫 불러오기 전(1.2.2)
    expect(linkStatus(s, 'coupang')).toBe('연결 안 됨');
    const text = consentLines('kurly', '사임캐시').join('\n');
    expect(text).toContain('사임캐시가 회원님의 마켓컬리 주문내역');
    expect(text).not.toContain('영테크');
    for (const w of ['주문번호', '결제수단', '아이디와 비밀번호', '연결 끊기', '수취인']) expect(text).toContain(w);
  });

  it('상태 읽기 — 404 면 null, 그 밖 오류는 그대로', async () => {
    const h = fakeHttp();
    const a = createReceiptLinkApi(h);
    h.get.mockRejectedValueOnce(err('not_found', 404));
    expect(await a.fetchLinkState()).toBeNull();
    h.get.mockRejectedValueOnce(err('http_500', 500));
    await expect(a.fetchLinkState()).rejects.toMatchObject({ status: 500 });
  });

  it('주문 보내기 — 깨끗한 주문만 50건씩 slow 로, 주머니가 차면 멈춘다', async () => {
    const h = { ...fakeHttp(), slow: vi.fn() };
    const a = createReceiptLinkApi(h);
    h.slow.mockImplementation((_p: string, b: { orders: unknown[] }) => Promise.resolve({ results: b.orders.map(() => ({ result: 'new' })) }));
    const raw = [...Array.from({ length: 60 }, (_, i) => ({ ...order(i), cookie: 'secret', address: 'x' })), { orderNo: '' }];
    const r = await a.sendOrders('naver', raw);
    expect(h.slow.mock.calls.map((c) => (c[1] as { orders: unknown[] }).orders.length)).toEqual([50, 10]);
    expect(JSON.stringify(h.slow.mock.calls)).not.toMatch(/secret|address/);
    expect(r).toMatchObject({ tally: { new: 60 }, unreadable: 1 });
    h.slow.mockReset();
    h.slow.mockResolvedValueOnce({ results: Array.from({ length: 50 }, (_, i) => ({ result: i < 2 ? 'new' : 'pouch_full' })) });
    const full = await a.sendOrders('coupang', Array.from({ length: 120 }, (_, i) => order(i)));
    expect(h.slow).toHaveBeenCalledTimes(1);
    expect(full.tally).toMatchObject({ new: 2, pouch_full: 118 });
  });

  it('slow 가 없으면 post 로 보낸다 · 동의 · 철회 · 적립 경로', async () => {
    const h = fakeHttp();
    const a = createReceiptLinkApi(h);
    h.post.mockResolvedValue({ links: {}, results: [{ result: 'new' }], ok: true, given: 300, pouchRoom: 4 });
    await a.sendOrders('kurly', [order(1)]);
    await a.consentLink('naver');
    await a.revokeLink('coupang');
    await a.claimOrder(42);
    expect(h.post.mock.calls.map((c) => c[0])).toEqual(['receipt-orders', 'receipt-link', 'receipt-link/revoke', 'receipt-orders/42/claim']);
    expect(h.post.mock.calls[1][1]).toEqual({ platform: 'naver', consent: true });
  });

  it('영수증 보기 — 모양이 틀리면 bad_receipt', async () => {
    const h = fakeHttp();
    h.get.mockResolvedValueOnce({ ok: true });
    await expect(createReceiptLinkApi(h).getOrderReceipt(43)).rejects.toThrow('bad_receipt');
    expect(h.get).toHaveBeenCalledWith('receipt-orders/43');
  });

  it('오류 문구 — 앱 ApiError 모양(status · code · serverMessage)을 클래스 없이 읽는다', () => {
    expect(receiptErrorMessage(err('not_found', 404))).toBe('영수증을 찾지 못했어요. 목록을 다시 불러와 주세요');
    expect(receiptErrorMessage(new Error('bad_receipt'))).toBe('영수증을 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요');
    expect(claimErrorMessage(err('http_409', 409, 'duplicate_receipt'))).toBe('이미 올린 영수증이에요');
    expect(claimErrorMessage(err('limit', 429))).toBe('오늘 영수증 등록 한도를 모두 사용했어요');
    expect(claimErrorMessage(new Error('x'))).toBe('적립하지 못했어요. 잠시 뒤 다시 눌러 주세요');
    expect(claimErrorCode(err('', 500))).toBe('http_500');
    expect(claimErrorCode(new Error('x'))).toBe('unknown');
  });

  it('내 기록에 넣을 전자 영수증 — 카드 · 구매만, 그 달만, 출처 글자 · 최신순', () => {
    const base = { orderNo: '****', title: '상품', claimedAt: null, duplicate: false };
    const orders = [
      { ...base, id: 1, platform: 'naver', seller: '가게A', amount: 1000, orderedAt: '2026-10-05 09:10', claimed: false, kind: 'card' as const },
      { ...base, id: 2, platform: 'kurly', seller: '', amount: 2000, orderedAt: '2026-10-20 21:00', claimed: true, kind: 'purchase' as const },
      { ...base, id: 3, platform: 'coupang', seller: '가게C', amount: 3000, orderedAt: '2026-10-21 10:00', claimed: false, kind: 'list' as const },
      { ...base, id: 4, platform: 'musinsa', seller: '가게D', amount: 4000, orderedAt: '2026-09-30 10:00', claimed: false, kind: 'card' as const },
    ];
    const r = linkRecordEntries(orders, '2026-10');
    expect(r.map((e) => e.orderId)).toEqual([2, 1]);
    expect(r[0]).toMatchObject({ id: 'link-2', date: '2026-10-20', time: '21:00', store: '상품', source: '마켓컬리 · 구매영수증', claimed: true });
    expect(r[1].source).toBe('네이버 · 카드영수증');
    expect(linkSourceLabel({ platform: 'musinsa', kind: 'card' })).toBe('무신사 · 카드영수증');
  });
});
