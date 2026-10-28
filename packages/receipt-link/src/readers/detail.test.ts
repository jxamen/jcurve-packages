// @vitest-environment jsdom
// 상세 화면 읽기 — 사이트별 실제 구조는 확인하지 못했다. 아래 화면은 모두 「라벨 + 값」 배치를 흉내 낸 가상 구조(dt/dd · th/td · 한 조각 안 「라벨: 값」 · span 쌍)다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allPosted, resetReaders, runDetail, setNow } from './testkit';
import { KURLY_DETAIL_SCRIPT, NAVER_SHOP_DETAIL_SCRIPT, NAVER_PAY_DETAIL_SCRIPT, MUSINSA_DETAIL_SCRIPT } from './detail';

beforeEach(() => { vi.restoreAllMocks(); resetReaders(); delete (window as unknown as { __ytDetail?: unknown }).__ytDetail; setNow('2026-10-28 20:00'); document.body.innerHTML = ''; window.history.replaceState({}, '', '/'); });

const PRIVATE = '<dt>수령인</dt><dd>홍길동</dd><dt>배송지</dt><dd>서울시 강남구 역삼동 123-4 101동 1203호</dd><dt>연락처</dt><dd>010-1234-5678</dd>';
const dl = (inner: string) => `<dl>${inner}</dl>`;

describe('detail reader (generic label based)', () => {
  it('dt/dd layout: reads the six fields with seconds and never touches recipient, address or phone', async () => {
    document.body.innerHTML = dl(`<dt>주문번호</dt><dd>2026102712345678</dd><dt>결제일시</dt><dd>2026.10.27 18:30:45</dd>
      <dt>상품금액</dt><dd>20,000원</dd><dt>최종 결제금액</dt><dd>12,300원</dd><dt>결제수단</dt><dd>네이버페이</dd><dt>판매자</dt><dd>올리브영</dd><dt>상품명</dt><dd>롬앤 쥬시 래스팅 틴트</dd>${PRIVATE}`);
    const msg = await runDetail(NAVER_SHOP_DETAIL_SCRIPT);
    expect(msg).toEqual({ type: 'detail', site: 'naver_shop', ok: true, orderNo: '2026102712345678', orderedAt: '2026-10-27 18:30:45', secKnown: true, amount: 12300, seller: '올리브영', title: '롬앤 쥬시 래스팅 틴트', payment: '네이버페이' });
    expect(JSON.stringify(allPosted)).not.toMatch(/홍길동|역삼동|1203호|010-1234|20,000/);
  });

  it('th/td layout and "label: value" in one text piece both work', async () => {
    document.body.innerHTML = `<table><tr><th>주문번호</th><td>M20261027001</td></tr><tr><th>주문일시</th><td>2026-10-27 09:05</td></tr><tr><th>결제금액</th><td>5,500원</td></tr></table><p>판매자: 무신사 스토어</p><p>결제수단 : 신용카드</p>`;
    const msg = await runDetail(MUSINSA_DETAIL_SCRIPT);
    expect(msg).toMatchObject({ ok: true, orderNo: 'M20261027001', orderedAt: '2026-10-27 09:05:00', secKnown: false, amount: 5500, seller: '무신사 스토어', payment: '신용카드' });
  });

  it('prefers 실결제금액 over 결제금액, ignores discounts (negative) and a date-only value becomes 00:00:00 with secKnown false', async () => {
    document.body.innerHTML = dl(`<dt>주문번호</dt><dd>2026102700000009</dd><dt>결제일</dt><dd>2026.10.27</dd><dt>결제금액</dt><dd>15,000원</dd><dt>실결제금액</dt><dd>-1,000원</dd><dt>실결제금액</dt><dd>14,000원</dd>`);
    const msg = await runDetail(NAVER_PAY_DETAIL_SCRIPT);
    expect(msg).toMatchObject({ ok: true, orderedAt: '2026-10-27 00:00:00', secKnown: false, amount: 14000 });
  });

  it('falls back to orderNo= in the address and to the first date-time anywhere on the page', async () => {
    window.history.replaceState({}, '', '/my/order/detail?orderNo=2026102700000077');
    document.body.innerHTML = `<div>영수증</div><div>2026.10.27 21:11:09 에 결제했어요</div>` + dl('<dt>결제금액</dt><dd>3,300원</dd>');
    const msg = await runDetail(NAVER_SHOP_DETAIL_SCRIPT);
    expect(msg).toMatchObject({ ok: true, orderNo: '2026102700000077', orderedAt: '2026-10-27 21:11:09', secKnown: true, amount: 3300 });
  });

  it('kurly: seller defaults to 마켓컬리 when the page names none', async () => {
    document.body.innerHTML = dl('<dt>주문번호</dt><dd>1027-000123</dd><dt>결제일시</dt><dd>2026.10.27 07:00:01</dd><dt>최종결제금액</dt><dd>41,900원</dd>');
    expect(await runDetail(KURLY_DETAIL_SCRIPT)).toMatchObject({ ok: true, seller: '마켓컬리', orderNo: '1027-000123' });
  });

  it('personal-looking text in a labelled value is dropped from seller / title / payment, the receipt itself is kept', async () => {
    document.body.innerHTML = dl('<dt>주문번호</dt><dd>2026102700000010</dd><dt>결제일시</dt><dd>2026.10.27 10:00:00</dd><dt>결제금액</dt><dd>1,000원</dd><dt>판매자</dt><dd>010-9999-8888</dd><dt>상품명</dt><dd>배송지 서울시 강남구 역삼동</dd>');
    const msg = (await runDetail(NAVER_SHOP_DETAIL_SCRIPT))!;
    expect(msg).toMatchObject({ ok: true, amount: 1000 });
    expect(msg).not.toHaveProperty('seller'); expect(msg).not.toHaveProperty('title');
  });

  it('login page → ok:false login_needed; a page with no labels → no_detail_found with a text-free shape (once)', async () => {
    document.body.innerHTML = '<form><input type="password"></form>';
    expect(await runDetail(NAVER_SHOP_DETAIL_SCRIPT)).toEqual({ type: 'detail', site: 'naver_shop', ok: false, note: 'login_needed' });
    delete (window as unknown as { __ytDetail?: unknown }).__ytDetail;
    document.body.innerHTML = '<div class="Receipt_wrap__x1" data-testid="r">hello</div>';
    const msg = (await runDetail(NAVER_PAY_DETAIL_SCRIPT, 8000))! as { ok: boolean; note: string; shape?: { outline: string[] } };
    expect(msg.ok).toBe(false);
    expect(['no_detail_found', 'no_order_no']).toContain(msg.note);
    expect(msg.shape?.outline.join('\n')).toContain('div.Receipt_wrap__x1[data-testid]');
  }, 20000);

  it('missing amount is a failure (never guessed), with note no_amount', async () => {
    document.body.innerHTML = dl('<dt>주문번호</dt><dd>2026102700000011</dd><dt>결제일시</dt><dd>2026.10.27 10:00:00</dd><dt>상품명</dt><dd>상품</dd>');
    expect(await runDetail(NAVER_SHOP_DETAIL_SCRIPT)).toMatchObject({ ok: false, note: 'no_amount' });
  });

  it('sends hello (kind detail) once before the result', async () => {
    document.body.innerHTML = dl('<dt>주문번호</dt><dd>2026102700000012</dd><dt>결제일시</dt><dd>2026.10.27 10:00:00</dd><dt>결제금액</dt><dd>900원</dd>');
    await runDetail(NAVER_SHOP_DETAIL_SCRIPT);
    expect(allPosted[0]).toMatchObject({ type: 'hello', kind: 'detail', site: 'naver_shop' });
    expect(allPosted.filter((m) => m.type === 'hello')).toHaveLength(1);
  });
});
