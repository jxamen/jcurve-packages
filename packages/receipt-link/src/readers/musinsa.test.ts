// @vitest-environment jsdom
/**
 * 무신사 주문내역 읽기 시험.
 *
 * 픽스처 출처 표시:
 *  - 구조 전체(목록 · 행 · 더보기 버튼 · 「주문번호」「결제금액」「N원」 글자 패턴) → INVENTED. 무신사 실제 HTML 은 공개 근거로 확인되지 않았다.
 *  - 클래스 이름(OrderList_*, Brand_*, GoodsName_*)과 data-order-no 속성 → INVENTED (선택자 대비용 가상 값). 실제 값은 로그인 후 확인 필요.
 *  - 수취인 · 주소 · 전화 · 카드번호 → INVENTED. 실제 개인정보가 아니며, 「보내지 않는다」는 시험용이다.
 *  - 주소(/order/order-list, /login, /main) → 사용자 지정 주소 기준(출처: 과제 지시). 로그아웃 시 실제 리다이렉트는 미확인.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSINSA_SCRIPT, MUSINSA_URL } from './musinsa';
import { resetReaders, runReader, setNow } from './testkit';

const RECIPIENT_FIXTURE = ['홍길동', '서울시 테스트구 가짜로 1', '010-9999-8888', '1234-5678-9012-3456', 'test@example.com'];

const ROW_RECENT = `
<li data-order-no="202610270001" class="OrderList_item__a1">
  <a href="/order/order-detail?orderNo=202610270001">주문상세</a>
  <p>2026.10.27 14:05 주문</p><p>주문번호 202610270001</p>
  <span class="Brand_brand__b2">테스트브랜드</span>
  <span class="GoodsName_name__c3">테스트 티셔츠 외 1건</span>
  <p>결제금액 <b>25,900원</b></p><p>신용카드 결제</p>
  <p>수취인 홍길동 / 서울시 테스트구 가짜로 1 / 010-9999-8888 / 카드 1234-5678-9012-3456 / test@example.com</p>
</li>`;
const ROW_CANCELLED = `
<li data-order-no="202610260002" class="OrderList_item__a1">
  <p>2026.10.26 09:00 주문</p><p>취소완료</p>
  <span class="GoodsName_name__c3">취소된 상품</span><p>결제금액 9,900원</p>
</li>`;
const ROW_MULTI_A = `
<li data-order-no="202610250003" class="OrderList_item__a1">
  <p>2026.10.25 20:10 주문</p>
  <span class="Brand_brand__b2">여러브랜드A</span><span class="GoodsName_name__c3">상품A</span><p>수량 1 8,000원</p>
</li>`;
const ROW_MULTI_B = `
<li data-order-no="202610250003" class="OrderList_item__a1">
  <span class="Brand_brand__b2">여러브랜드B</span><span class="GoodsName_name__c3">상품B</span><p>6,000원</p>
</li>`;
const ROW_OLD = `
<li data-order-no="202608010004" class="OrderList_item__a1">
  <p>2026.08.01 10:00 주문</p><p>결제금액 3,000원</p>
</li>`;

function setPage(path: string, body: string) {
  window.history.pushState({}, '', path);
  document.body.innerHTML = body;
}

beforeEach(() => {
  vi.restoreAllMocks();
  resetReaders();
  setNow('2026-10-28 12:00');
  setPage('/order/order-list', '');
});

describe('musinsa reader', () => {
  it('exports the order-list url', () => {
    expect(MUSINSA_URL).toBe('https://www.musinsa.com/order/order-list');
  });

  it('reads one order per orderNo, skips cancelled, sums item rows, pages with 더보기, stops at the old row', async () => {
    setPage('/order/order-list', `
      <ul>${ROW_RECENT}${ROW_CANCELLED}</ul>
      <button>더보기</button>`);
    // 더보기 를 누르면 나머지 행이 붙는다(가짜 동작)
    const btn = document.querySelector('button')!;
    btn.addEventListener('click', () => {
      document.querySelector('ul')!.insertAdjacentHTML('beforeend', ROW_MULTI_A + ROW_MULTI_B + ROW_OLD);
      btn.remove();
    });
    const msg = await runReader(MUSINSA_SCRIPT);
    expect(msg).toEqual({
      type: 'orders', site: 'musinsa', done: true,
      orders: [
        { orderNo: '202610270001', orderedAt: '2026-10-27 14:05', amount: 25900, seller: '테스트브랜드', title: '테스트 티셔츠 외 1건', payment: '신용카드' },
        { orderNo: '202610250003', orderedAt: '2026-10-25 20:10', amount: 14000, seller: '여러브랜드A', title: '상품A' },
      ],
    });
  });

  it('posts only the six fields and never the recipient, address, phone, card number or email', async () => {
    setPage('/order/order-list', `<ul>${ROW_RECENT}</ul>`);
    const msg = await runReader(MUSINSA_SCRIPT);
    const wire = JSON.stringify(msg);
    for (const secret of RECIPIENT_FIXTURE) expect(wire).not.toContain(secret);
    const allowed = ['orderNo', 'orderedAt', 'amount', 'seller', 'title', 'payment'];
    for (const o of msg!.orders) for (const k of Object.keys(o)) expect(allowed).toContain(k);
  });

  it('logged out: a /login path returns login_needed', async () => {
    setPage('/login', `<form action="/login"><input type="password"></form>`);
    expect(await runReader(MUSINSA_SCRIPT)).toMatchObject({ orders: [], done: true, note: 'login_needed' });
  });

  it('logged out: a password field on any page returns login_needed', async () => {
    setPage('/order/order-list', `<input type="password">`);
    expect(await runReader(MUSINSA_SCRIPT)).toMatchObject({ orders: [], done: true, note: 'login_needed' });
  });

  it('wrong page returns wrong_page', async () => {
    setPage('/main', `<ul>${ROW_RECENT}</ul>`);
    expect(await runReader(MUSINSA_SCRIPT)).toMatchObject({ orders: [], done: true, note: 'wrong_page' });
  });

  it('order page with no rows returns no_list_found', async () => {
    setPage('/order/order-list', `<div>주문 내역이 없습니다</div>`);
    expect(await runReader(MUSINSA_SCRIPT)).toMatchObject({ orders: [], done: true, note: 'no_list_found' });
  });

  it('text fallback: no data attributes, orderNo from 주문번호 text, labeled 결제금액', async () => {
    setPage('/order/order-list', `<div><div>2026.10.27 10:00 주문 주문번호 AB12345678 결제금액 3,000원</div></div>`);
    const msg = await runReader(MUSINSA_SCRIPT);
    expect(msg!.orders).toEqual([{ orderNo: 'AB12345678', orderedAt: '2026-10-27 10:00', amount: 3000 }]);
  });
});
