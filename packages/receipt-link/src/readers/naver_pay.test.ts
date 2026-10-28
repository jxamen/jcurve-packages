// @vitest-environment jsdom
/**
 * 시험 자료 출처 표시.
 *  - 진짜 구조를 본뜬 것: 없음. 네이버페이 결제내역 페이지는 로그인 뒤에만 보여서 실제 HTML 을 볼 수 없었다.
 *    공개 자료에서도 구매자용 결제내역 마크업이나 JSON 응답 모양을 확인하지 못했다.
 *  - 지어낸 것(가정): 아래 HTML 의 행 구조(li > div > span), 「날짜 · 주문번호 · 실결제금액 · 결제수단」 라벨 배열,
 *    「더보기」 버튼, 수령인·주소·연락처·카드번호·이메일 줄. 모두 방어 로직을 시험하려고 꾸민 것이다.
 *  - location 은 vi.stubGlobal 로 pay.naver.com 이라고 흉내 낸다(jsdom 기본 주소는 localhost).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVER_PAY_SCRIPT, NAVER_PAY_URL } from './naver_pay';
import { resetReaders, runReader, setNow } from './testkit';

const PAY_LOC = { hostname: 'pay.naver.com', href: 'https://pay.naver.com/pc/history' };

// 가정 구조: 행마다 날짜·주문번호 한 줄, 판매처·상품 한 줄, 금액·결제수단 한 줄, 그리고 개인정보 줄.
const row = (at: string, orderNo: string, amount: string, extra = '') => `
  <li>
    <div><span>${at}</span><span>주문번호 ${orderNo}</span></div>
    <div><span>스마트스토어 가게</span><span>유기농 사과 2kg</span></div>
    <div><span>실결제금액</span><span>${amount}</span></div>
    <div><span>신용카드</span></div>
    ${extra}
  </li>`;

const PRIVATE_ROW = `
    <div><span>수령인</span><span>홍길동</span></div>
    <div><span>주소 서울시 강남구 테헤란로 1</span></div>
    <div><span>연락처 010-1234-5678</span></div>
    <div><span>카드번호 1234-****-****-5678</span></div>
    <div><span>이메일 hong@example.com</span></div>`;

beforeEach(() => {
  vi.restoreAllMocks();
  resetReaders();
  setNow('2026-10-28 12:00');
  vi.stubGlobal('location', PAY_LOC);
});
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

describe('naver_pay reader', () => {
  it('uses the history page URL from the research note', () => {
    expect(NAVER_PAY_URL).toBe('https://pay.naver.com/pc/history');
  });

  it('reads recent paid rows, skips cancelled and old rows, posts only the six fields, no private text', async () => {
    document.body.innerHTML = `<ul>
      ${row('2026.10.27 14:05', '2026102712345678', '12,300원', PRIVATE_ROW)}
      ${row('2026.10.26 09:00', '2026102600000001', '3,000원 취소')}
      ${row('2026.08.01 10:00', '2026080100000002', '1,000원')}
    </ul>`;
    const msg = await runReader(NAVER_PAY_SCRIPT);
    expect(msg).toEqual({
      type: 'orders',
      site: 'naver_pay',
      done: true,
      orders: [{
        orderNo: '2026102712345678',
        orderedAt: '2026-10-27 14:05',
        amount: 12300,
        seller: '스마트스토어 가게',
        title: '유기농 사과 2kg',
        payment: '신용카드',
      }],
    });
    const text = JSON.stringify(msg);
    for (const secret of ['홍길동', '서울', '강남', '010-1234', '1234-****', 'hong@example', '수령', '주소', '연락처', '카드번호']) {
      expect(text).not.toContain(secret);
    }
    expect(Object.keys(msg!.orders[0]).sort()).toEqual(['amount', 'orderNo', 'orderedAt', 'payment', 'seller', 'title']);
  });

  it('drops a row that shows only a 결제번호 (a different number from naver_shop would credit the same order twice)', async () => {
    document.body.innerHTML = `<ul><li>
      <div><span>2026.10.27 10:00</span><span>결제번호 20261027555501</span></div>
      <div><span>오프라인 가게</span></div>
      <div><span>결제금액 5,000원</span></div></li></ul>`;
    const msg = await runReader(NAVER_PAY_SCRIPT);
    expect(msg!.orders).toEqual([]);
  });

  it('a list where every row is older than 30 days stops at once with no orders', async () => {
    document.body.innerHTML = `<ul>${row('2026.08.01 10:00', '2026080100000002', '1,000원')}</ul><button>더보기</button>`;
    const msg = await runReader(NAVER_PAY_SCRIPT);
    expect(msg).toMatchObject({ orders: [], done: true });
  });

  it('wrong page (not pay.naver.com) reports wrong_page', async () => {
    vi.stubGlobal('location', { hostname: 'example.com', href: 'https://example.com/' });
    document.body.innerHTML = `<ul>${row('2026.10.27 14:05', '2026102712345678', '12,300원')}</ul>`;
    expect(await runReader(NAVER_PAY_SCRIPT)).toMatchObject({ orders: [], done: true, note: 'wrong_page' });
  });

  it('redirected to the Naver login host reports login_needed', async () => {
    vi.stubGlobal('location', { hostname: 'nid.naver.com', href: 'https://nid.naver.com/nidlogin.login' });
    document.body.innerHTML = '<form><input name="id"></form>';
    expect(await runReader(NAVER_PAY_SCRIPT)).toMatchObject({ orders: [], done: true, note: 'login_needed' });
  });

  it('login link on a pay page with no rows reports login_needed', async () => {
    document.body.innerHTML = '<a href="https://nid.naver.com/nidlogin.login?svctype=1">로그인</a>';
    expect(await runReader(NAVER_PAY_SCRIPT, 8000)).toMatchObject({ orders: [], done: true, note: 'login_needed' });
  }, 10000);

  it('no rows and no login hints reports no_list_found', async () => {
    document.body.innerHTML = '<p>내역이 없습니다</p>';
    expect(await runReader(NAVER_PAY_SCRIPT, 8000)).toMatchObject({ orders: [], done: true, note: 'no_list_found' });
  }, 10000);

  it('「더보기」 loads the next page: first call asks for more, second call with no growth finishes', async () => {
    document.body.innerHTML = `<ul id="l">${row('2026.10.27 14:05', '2026102712345678', '12,300원')}</ul><button id="more">더보기</button>`;
    let clicks = 0;
    document.getElementById('more')!.addEventListener('click', () => {
      clicks += 1;
      if (clicks === 1) document.getElementById('l')!.insertAdjacentHTML('beforeend', row('2026.10.20 09:00', '2026102000000009', '2,000원'));
    });
    const first = await runReader(NAVER_PAY_SCRIPT, 6000);
    expect(first!.done).toBe(false);
    expect(first!.orders.map((o) => o.orderNo)).toEqual(['2026102712345678']);
    const second = await runReader(NAVER_PAY_SCRIPT, 6000);
    expect(second!.orders.map((o) => o.orderNo)).toEqual(['2026102000000009']);
    expect(second!.done).toBe(true);
    expect(clicks).toBe(2);
  }, 15000);
});
