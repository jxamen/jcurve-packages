// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://order.pay.naver.com/orderStatus"}
/**
 * 픽스처 출처 표시:
 *  - 전부 가상(invented). 실제 네이버 주문목록 HTML 은 확인하지 못했다(공개 자료 조회 막힘).
 *  - 클래스 이름(OrderItem__…)과 「실결제금액」「더보기」「주문 내역이 없」 문구는 모두 추정(assumed)이다.
 *  - 픽스처에 수령인 · 주소 · 전화 · 카드번호 · 이메일을 일부러 넣었다(개인정보 시험용). 실제 값이 아니다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVER_SHOP_SCRIPT, NAVER_SHOP_URL } from './naver_shop';
import { resetReaders, runReader, setNow } from './testkit';

const ORDER_LIST = `
<div class="OrderList__wrap">
  <ul class="OrderList__list">
    <li class="OrderItem__item">
      <div class="OrderItem__head"><span class="OrderItem__date">2026.10.27 (화) 14:05</span> <span>주문번호 2026102712345678</span></div>
      <div class="OrderItem__store">예시스토어</div>
      <div class="OrderItem__product"><span class="OrderItem__productName">테스트 상품 A 외 1건</span></div>
      <div class="OrderItem__pay">결제수단 네이버페이 · 실결제금액 12,300원</div>
      <div class="OrderItem__receiver"><span>수령인 홍길동</span><span>서울특별시 강남구 테헤란로 1</span><span>010-1234-5678</span></div>
      <div class="OrderItem__card">카드 4111-1111-1111-1111 test@example.com</div>
    </li>
    <li class="OrderItem__item">
      <div class="OrderItem__head"><span class="OrderItem__date">2026.10.20 (화)</span> <span>주문번호 2026101012345679</span></div>
      <div class="OrderItem__store">다른스토어</div>
      <div class="OrderItem__product"><span>테스트 상품 B</span></div>
      <div class="OrderItem__pay">결제금액 5,000원</div>
    </li>
    <li class="OrderItem__item">
      <div class="OrderItem__head"><span class="OrderItem__date">2026.08.01 (토)</span> <span>주문번호 2026080112345670</span></div>
      <div class="OrderItem__pay">결제금액 9,900원</div>
    </li>
  </ul>
</div>`;

beforeEach(() => {
  vi.restoreAllMocks();
  resetReaders();
  setNow('2026-10-28 12:00');
  document.body.innerHTML = '';
});

describe('naver_shop reader', () => {
  it('exports a Naver order-list URL and a script string', () => {
    expect(NAVER_SHOP_URL).toMatch(/^https:\/\/[^/]*naver\.com\//);
    expect(typeof NAVER_SHOP_SCRIPT).toBe('string');
    expect(NAVER_SHOP_SCRIPT).toContain('naver_shop');
  });

  it('reads the six fields from DOM blocks and drops orders older than 30 days', async () => {
    document.body.innerHTML = ORDER_LIST;
    const msg = await runReader(NAVER_SHOP_SCRIPT);
    expect(msg).toEqual({
      type: 'orders',
      site: 'naver_shop',
      orders: [
        { orderNo: '2026102712345678', orderedAt: '2026-10-27 14:05', amount: 12300, seller: '예시스토어', title: '테스트 상품 A 외 1건', payment: '네이버페이' },
        { orderNo: '2026101012345679', orderedAt: '2026-10-20 00:00', amount: 5000, seller: '다른스토어', title: '테스트 상품 B' },
      ],
      done: true,
    });
  });

  it('privacy: recipient, address, phone, card number and email in the page never reach the message', async () => {
    document.body.innerHTML = ORDER_LIST;
    const msg = await runReader(NAVER_SHOP_SCRIPT);
    const raw = JSON.stringify(msg);
    for (const secret of ['홍길동', '테헤란로', '서울특별시', '010-1234-5678', '4111', 'test@example.com', '수령인']) {
      expect(raw).not.toContain(secret);
    }
    for (const o of msg!.orders) {
      expect(Object.keys(o).every((k) => ['orderNo', 'orderedAt', 'amount', 'seller', 'title', 'payment'].includes(k))).toBe(true);
    }
  });

  it('logged out (password form present) reports login_needed and no orders', async () => {
    document.body.innerHTML = '<form><input type="password" name="pw"></form>';
    const msg = await runReader(NAVER_SHOP_SCRIPT);
    expect(msg).toMatchObject({ orders: [], done: true, note: 'login_needed' });
  });

  it('empty order list text gives done with no note', async () => {
    document.body.innerHTML = '<div class="OrderList__wrap"><p>주문 내역이 없습니다.</p></div>';
    const msg = await runReader(NAVER_SHOP_SCRIPT);
    expect(msg).toMatchObject({ orders: [], done: true });
    expect(msg!.note).toBeUndefined();
  });

  it('a page with no order blocks and no empty text reports no_list_found', async () => {
    document.body.innerHTML = '<div class="Header">환영합니다</div>';
    const msg = await runReader(NAVER_SHOP_SCRIPT);
    expect(msg).toMatchObject({ orders: [], done: true, note: 'no_list_found' });
  });

  it('「더보기」 pages: first call clicks and asks for more, second call sends only the new order', async () => {
    document.body.innerHTML = `
      <ul class="OrderList__list">
        <li class="OrderItem__item"><span>2026.10.27 (화) 10:00</span> <span>주문번호 2026102712345678</span><div class="OrderItem__pay">결제금액 1,000원</div></li>
      </ul>
      <button>더보기</button>`;
    const btn = document.querySelector('button')!;
    btn.addEventListener('click', () => {
      btn.remove();
      document.querySelector('ul')!.insertAdjacentHTML('beforeend',
        '<li class="OrderItem__item"><span>2026.10.26 (월) 09:00</span> <span>주문번호 2026102612345670</span><div class="OrderItem__pay">결제금액 2,000원</div></li>');
    });
    const first = await runReader(NAVER_SHOP_SCRIPT);
    expect(first!.done).toBe(false);
    expect(first!.orders.map((o) => o.orderNo)).toEqual(['2026102712345678']);
    const second = await runReader(NAVER_SHOP_SCRIPT);
    expect(second!.done).toBe(true);
    expect(second!.orders.map((o) => o.orderNo)).toEqual(['2026102612345670']);
  });
});
