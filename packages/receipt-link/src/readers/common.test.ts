// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildScript, HELPERS_JS } from './common';
import { resetReaders, runReader, setNow } from './testkit';

beforeEach(() => { vi.restoreAllMocks(); resetReaders(); setNow('2026-10-28 12:00'); });

const order = (n: number, at = '2026-10-27 10:00') => `{orderNo:'N${n}',orderedAt:'${at}',amount:'${n},000원',seller:'가게',title:'상품'}`;

describe('readers common frame', () => {
  it('posts the six fields only, cleans amounts, drops old and malformed rows, no extra keys', async () => {
    const script = buildScript('musinsa', `return {orders:[
      {orderNo:'A1',orderedAt:'2026-10-27 10:00',amount:'12,300원',seller:'s',title:'t',payment:'카드',recipient:'홍길동',address:'서울',phone:'010'},
      {orderNo:'OLD',orderedAt:'2026-08-01 10:00',amount:1000},
      {orderNo:'',orderedAt:'2026-10-27 10:00',amount:1000},
      {orderNo:'BAD',orderedAt:'어제',amount:1000},
      {orderNo:'NOAMT',orderedAt:'2026-10-27 10:00'}], done:true};`);
    const msg = await runReader(script);
    expect(msg).toEqual({ type: 'orders', site: 'musinsa', orders: [{ orderNo: 'A1', orderedAt: '2026-10-27 10:00', amount: 12300, seller: 's', title: 't', payment: '카드' }], done: true });
  });
  it('sends 50 at a time, done:false until the queue is empty, and the second call sends the next batch without re-reading', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => `{orderNo:'N${i}',orderedAt:'2026-10-27 10:00',amount:${i + 1}}`).join(',');
    const script = buildScript('kurly', `state.reads=(state.reads||0)+1; return {orders:[${rows}], done:true};`);
    const sizes: number[] = []; const dones: boolean[] = [];
    for (let i = 0; i < 3; i++) { const m = (await runReader(script))!; sizes.push(m.orders.length); dones.push(m.done); }
    expect(sizes).toEqual([50, 50, 20]);
    expect(dones).toEqual([false, false, true]);
    expect((window as unknown as { __ytOrders: { kurly: { reads: number } } }).__ytOrders.kurly.reads).toBe(1);
  });
  it('a body that throws or rejects reports note:error and done:true; the note is code-shaped', async () => {
    expect((await runReader(buildScript('naver_pay', `throw new Error('x');`)))).toMatchObject({ orders: [], done: true, note: 'error' });
    resetReaders();
    expect((await runReader(buildScript('naver_pay', `return Promise.reject(new Error('x'));`)))).toMatchObject({ orders: [], done: true, note: 'error' });
    resetReaders();
    expect((await runReader(buildScript('naver_pay', `return {orders:[],done:true,note:'login needed!'};`)))?.note).toBe('loginneeded');
  });
  it('same orderNo is sent once across calls (paging overlap)', async () => {
    const script = buildScript('naver_shop', `state.n=(state.n||0)+1; return {orders:[${order(1)},${order(2)}], done:state.n>1};`);
    const first = (await runReader(script))!;
    const second = (await runReader(script))!;
    expect(first.orders.map((o) => o.orderNo)).toEqual(['N1', 'N2']);
    expect(first.done).toBe(false);
    expect(second.orders).toEqual([]);
    expect(second.done).toBe(true);
  });

  it('seller / title / payment that look personal (phone, long digits, e-mail, address words) are dropped, the order itself is kept', async () => {
    const script = buildScript('naver_shop', `return {orders:[
      {orderNo:'P1',orderedAt:'2026-10-27 10:00',amount:1000,seller:'010-1234-5678',title:'서울시 강남구 역삼동 123',payment:'a@b.com'},
      {orderNo:'P2',orderedAt:'2026-10-27 10:00',amount:2000,seller:'받는분 홍길동',title:'주문 1234567890123',payment:'네이버페이'},
      {orderNo:'P4',orderedAt:'2026-10-27 10:00',amount:4000,seller:'101동 1203호',title:'상품'},
      {orderNo:'P3',orderedAt:'2026-10-27 10:00',amount:3000,seller:'올리브영',title:'롬앤 쥬시 래스팅 틴트 3호',payment:'카드'}], done:true};`);
    const msg = (await runReader(script))!;
    expect(msg.orders).toEqual([
      { orderNo: 'P1', orderedAt: '2026-10-27 10:00', amount: 1000 },
      { orderNo: 'P2', orderedAt: '2026-10-27 10:00', amount: 2000, payment: '네이버페이' },
      { orderNo: 'P4', orderedAt: '2026-10-27 10:00', amount: 4000, title: '상품' },
      { orderNo: 'P3', orderedAt: '2026-10-27 10:00', amount: 3000, seller: '올리브영', title: '롬앤 쥬시 래스팅 틴트 3호', payment: '카드' },
    ]);
  });
  describe('diagnostic shape', () => {
    it('adds a text-free page shape once when nothing could be read, and never when orders were read', async () => {
      document.body.innerHTML = '<div id="app" class="List_wrap__ab12 other" data-testid="x"><ul><li class="Item 한글클래스">주문번호 2026102812345678 2026.10.28 12,300원 홍길동 서울시 010-1234-5678</li></ul></div>';
      const empty = buildScript('kurly', `return {orders:[],done:true,note:'no_list_found'};`);
      const msg = (await runReader(empty))!;
      expect(msg.note).toBe('no_list_found');
      expect(msg.shape?.hits).toEqual({ date: 1, money: 1, longNumber: 1 });
      const outline = msg.shape!.outline.join('\n');
      expect(outline).toContain('div#app.List_wrap__ab12.other[data-testid]');
      expect(JSON.stringify(msg.shape)).not.toMatch(/홍길동|서울|010|2026102812345678|12,300/);
      const again = (await runReader(empty))!;
      expect(again.shape).toBeUndefined();
      resetReaders();
      const ok = (await runReader(buildScript('kurly', `return {orders:[{orderNo:'A1',orderedAt:'2026-10-27 10:00',amount:5000}],done:true};`)))!;
      expect(ok.shape).toBeUndefined();
    });
  });
  describe('helpers', () => {
    const H = new Function(`${HELPERS_JS}; return H;`)() as Record<string, (...a: unknown[]) => unknown>;
    it('kst parses the date shapes the sites use', () => {
      expect(H.kst('2026.10.28 18:30')).toBe('2026-10-28 18:30');
      expect(H.kst('2026-10-28')).toBe('2026-10-28 00:00');
      expect(H.kst('26.10.28')).toBe('2026-10-28 00:00');
      expect(H.kst('2026년 10월 28일 오후')).toBe('2026-10-28 00:00');
      expect(H.kst('10/27')).toBe('2026-10-27 00:00');
      expect(H.kst('2026-10-28T03:30:00Z')).toBe('2026-10-28 12:30');
      expect(H.kst('2026-10-28T18:30:00+09:00')).toBe('2026-10-28 18:30');
      expect(H.kst(Date.parse('2026-10-28T09:05:00+09:00'))).toBe('2026-10-28 09:05');
      expect(H.kst('주문일')).toBeNull();
    });
    it('money and recent', () => {
      expect(H.money('12,300원')).toBe(12300);
      expect(H.money('결제금액 5,000')).toBe(5000);
      expect(H.money('없음')).toBeNull();
      expect(H.recent('2026-10-01 10:00')).toBe(true);
      expect(H.recent('2026-09-20 10:00')).toBe(false);
    });
  });
});
