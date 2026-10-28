// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://www.kurly.com/mypage/order"}
/**
 * 마켓컬리 — 대표님 캡처의 실제 화면 글자(앱보조5 전달, 10-28 저녁)를 흉내 낸 시험.
 * 실제: 목록 「주문 내역」 · 「3년 ▾」 · 묶음 머리 「2025.09.28」 + 「주문번호 13자리」(옆 「>」) · 「배송완료 9.29(월) 03:08」 · 「총 7건 주문 펼쳐보기」,
 *       상세 「결제 정보」(「결제금액 73,050원」 「결제방법 네이버페이(포인트)」) · 「주문 정보」(「주문번호」 · 「결제 일시 2025.09.28 21:56:37」) · 「배송 정보」(읽지 않음).
 * 가상: 위 글자 사이의 요소 구조(어떤 태그 · 클래스인지), 상품 이름, 링크 주소, 금액 숫자.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allPosted, resetReaders, runDetail, runReader, setNow } from './testkit';
import { KURLY_DETAIL_SCRIPT } from './detail';
import { KURLY_SCRIPT } from './kurly';

beforeEach(() => { vi.restoreAllMocks(); resetReaders(); delete (window as unknown as { __ytDetail?: unknown }).__ytDetail; setNow('2026-10-28 20:00'); document.body.innerHTML = ''; });

const LIST = `<main><h2>주문 내역</h2><button>3년 ▾</button>
 <section><h3>2026.10.27</h3>
   <div><span>주문번호</span><span>1027123456789</span><a href="/mypage/order/view/1027123456789">&gt;</a></div>
   <p>배송완료 10.28(수) 03:08</p><p>[KF365] 애호박 1개 외 2건</p></section>
 <section><h3>2026.10.20</h3>
   <div>주문번호 1020987654321</div><p>배송완료 10.21(수) 03:10</p><p>우유 900ml</p><a href="/mypage/order/view/1020987654321">보기</a></section>
 <section><h3>2026.10.15</h3><div>주문번호 1015000000001</div><p>주문취소 완료</p><p>상품</p></section>
 <section><h3>2025.09.28</h3><div>주문번호 0928111122223</div><p>배송완료 9.29(월) 03:08</p></section>
 <button>총 7건 주문 펼쳐보기</button></main>`;

describe('kurly list on the real captured text', () => {
  it('reads order number + order date from the group headers, skips cancelled and old groups, sends no amount but needsDetail and the detail link', async () => {
    document.body.innerHTML = LIST;
    const msg = (await runReader(KURLY_SCRIPT))!;
    expect(msg.done).toBe(true);
    expect(msg.orders).toEqual([
      { orderNo: '1027123456789', orderedAt: '2026-10-27 00:00', needsDetail: true, seller: '마켓컬리', title: '[KF365] 애호박 1개 외 2건', detailUrl: 'https://www.kurly.com/mypage/order/view/1027123456789' },
      { orderNo: '1020987654321', orderedAt: '2026-10-20 00:00', needsDetail: true, seller: '마켓컬리', title: '우유 900ml', detailUrl: 'https://www.kurly.com/mypage/order/view/1020987654321' },
    ]);
    expect(allPosted[0]).toMatchObject({ type: 'hello', kind: 'list', site: 'kurly' });
  });

  it('while the newest groups are recent it presses 「펼쳐보기」, and sends done:false until nothing more appears', async () => {
    document.body.innerHTML = `<main><h2>주문 내역</h2><section><h3>2026.10.27</h3><div>주문번호 1027123456789</div></section><button id="more">총 7건 주문 펼쳐보기</button></main>`;
    document.getElementById('more')!.addEventListener('click', () => {
      document.querySelector('main')!.insertAdjacentHTML('beforeend', `<section><h3>2026.10.10</h3><div>주문번호 1010222233334</div></section>`);
      document.getElementById('more')!.remove();
    });
    const first = (await runReader(KURLY_SCRIPT))!;
    expect(first.done).toBe(false);
    const second = (await runReader(KURLY_SCRIPT))!;
    expect([...first.orders, ...second.orders].map((o) => o.orderNo).sort()).toEqual(['1010222233334', '1027123456789']);
    expect(second.done).toBe(true);
  });

  it('falls back to the first-pass layout reader when the real-text layout finds nothing', async () => {
    document.body.innerHTML = `<ul><li><span>주문번호 2026102700000099</span><span>주문일 2026.10.27 10:00</span><span>결제금액 5,000원</span></li></ul>`;
    window.history.replaceState({}, '', '/mypage/order');
    const msg = (await runReader(KURLY_SCRIPT))!;
    expect(msg.orders.map((o) => o.orderNo)).toEqual(['2026102700000099']);
    expect(msg.orders[0].amount).toBe(5000);
  });
});

describe('kurly detail on the real captured text', () => {
  const DETAIL = `<h2>주문 상세</h2>
    <section><h3>결제 정보</h3><dl><dt>상품금액</dt><dd>80,000원</dd><dt>할인금액</dt><dd>-6,950원</dd><dt>총 결제금액</dt><dd>99,999원</dd><dt>결제금액</dt><dd>73,050원</dd><dt>결제방법</dt><dd>네이버페이(포인트)</dd></dl><a href="#">영수증보기</a></section>
    <section><h3>주문 정보</h3><dl><dt>주문번호</dt><dd>0928111122223</dd><dt>결제 일시</dt><dd>2025.09.28 21:56:37</dd></dl></section>
    <section><h3>배송 정보</h3><dl><dt>받는 분</dt><dd>홍길동</dd><dt>연락처</dt><dd>010-1111-2222</dd><dt>주소</dt><dd>서울시 강남구 역삼동 1-2 101동 1203호</dd></dl></section>`;

  it('결제금액 (not 총 결제금액), 결제방법, 주문번호 and 결제 일시 with seconds → secKnown:true; delivery info never read', async () => {
    document.body.innerHTML = DETAIL;
    const msg = await runDetail(KURLY_DETAIL_SCRIPT);
    expect(msg).toEqual({ type: 'detail', site: 'kurly', ok: true, orderNo: '0928111122223', orderedAt: '2025-09-28 21:56:37', secKnown: true, amount: 73050, seller: '마켓컬리', payment: '네이버페이(포인트)' });
    expect(JSON.stringify(allPosted)).not.toMatch(/홍길동|010-1111|역삼동|1203호|99,999/);
  });

  it('the same labels written as one text piece ("결제금액 73,050원") are read too', async () => {
    document.body.innerHTML = `<div>결제금액 73,050원</div><div>결제방법 카드</div><div>주문번호 0928111122223</div><div>결제 일시 2025.09.28 21:56:37</div>`;
    expect(await runDetail(KURLY_DETAIL_SCRIPT)).toMatchObject({ ok: true, orderNo: '0928111122223', amount: 73050, secKnown: true, payment: '카드' });
  });
});
