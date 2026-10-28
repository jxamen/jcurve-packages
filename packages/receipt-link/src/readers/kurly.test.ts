// @vitest-environment jsdom
/**
 * 마켓컬리 읽기 스크립트 시험.
 *
 * 증거 구분 (kurly.ts 헤더와 같은 기준):
 *  - 이 파일의 주문내역 HTML 조각(li/span 「주문번호」「주문일」「결제금액」「외 N건」「더보기」「주문취소」 버튼) 은 전부 INVENTED(가정).
 *    실제 마이컬리 주문내역 마크업은 공개 자료로 확인하지 못했다. 시험이 통과해도 실제 페이지가 맞는다는 뜻은 아니다.
 *  - 주문번호 16자리 숫자, 20xx.MM.DD HH:mm 날짜, 「N원」 금액 표기 : INVENTED(가정). 개인정보 칸(수취인·주소·전화·카드·이메일)도 INVENTED 이며 실제 구조가 아니다.
 *  - 페이지 경로 /mypage/order : kurly.ts 와 같은 가정(assumed). 시험에서는 history.pushState 로 경로만 바꾼다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KURLY_SCRIPT, KURLY_URL } from './kurly';
import { resetReaders, runReader, setNow } from './testkit';

const ALLOWED = ['orderNo', 'orderedAt', 'amount', 'seller', 'title', 'payment'];

beforeEach(() => {
  vi.restoreAllMocks();
  resetReaders();
  setNow('2026-10-28 12:00');
  window.history.pushState({}, '', '/mypage/order');
  document.body.innerHTML = '';
});
afterEach(() => {
  window.history.pushState({}, '', '/');
});

// INVENTED 카드 조각 — 실제 마크업 아님
const card = (no: string, date: string, amt: string | null, extra = '', title = '유기농 바나나') =>
  `<li class="OrderItem_card"><div><span>주문번호 ${no}</span><span>주문일 ${date}</span></div>` +
  `<div><em>${title} 외 2건</em></div>` +
  (amt == null ? '' : `<div><span>결제금액 ${amt}원</span></div>`) + extra + `</li>`;
const listPage = (...cards: string[]) => `<div class="OrderList"><ul>${cards.join('')}</ul></div>`;

describe('kurly reader', () => {
  it('exports the entry URL', () => {
    expect(KURLY_URL).toBe('https://www.kurly.com/mypage/order');
  });

  it('reads recent paid orders, skips cancelled and amount-less rows, keeps a paid order that has a 주문취소 button, drops old rows and sends six fields only', async () => {
    document.body.innerHTML = listPage(
      card('2026101812345678', '2026.10.27 18:30', '12,300', '<span>신용카드 결제</span>'), // A: 정상
      card('2026101012345679', '2026.10.20 09:05', '5,000', '<span class="status">주문취소</span>'), // B: 상태가 취소 → 건너뜀
      card('2026101512345690', '2026.10.25 10:00', null), // F: 결제금액 없음 → 건너뜀
      card('2026100112345680', '2026.10.01 10:00', '8,800', '<button>주문취소</button>'), // C: 버튼만 취소 → 포함
      card('2026080112345681', '2026.08.01 10:00', '1,000'), // D: 30일 밖 → 마지막이라 여기서 멈춤
    );
    const msg = await runReader(KURLY_SCRIPT, 6000);
    expect(msg).toEqual({
      type: 'orders',
      site: 'kurly',
      orders: [
        { orderNo: '2026101812345678', orderedAt: '2026-10-27 18:30', amount: 12300, seller: '마켓컬리', title: '유기농 바나나', payment: '신용카드' },
        { orderNo: '2026100112345680', orderedAt: '2026-10-01 10:00', amount: 8800, seller: '마켓컬리', title: '유기농 바나나' },
      ],
      done: true,
    });
    for (const o of msg!.orders) expect(Object.keys(o).every((k) => ALLOWED.includes(k))).toBe(true);
  });

  it('pages through 더보기 in one call and the next call sends only the new rows', async () => {
    document.body.innerHTML = listPage(card('2026101812345678', '2026.10.27 18:30', '12,300')) + '<button>더보기</button>';
    const btn = document.querySelector('button') as HTMLButtonElement;
    btn.addEventListener('click', () => {
      document.querySelector('ul')!.insertAdjacentHTML('beforeend', card('2026101512345690', '2026.10.15 08:00', '2,200', '', '두부'));
      btn.remove();
    });
    const first = await runReader(KURLY_SCRIPT, 6000);
    expect(first!.orders.map((o) => o.orderNo)).toEqual(['2026101812345678']);
    expect(first!.done).toBe(false);
    const second = await runReader(KURLY_SCRIPT, 6000);
    expect(second!.orders.map((o) => o.orderNo)).toEqual(['2026101512345690']);
    expect(second!.orders[0].title).toBe('두부');
    expect(second!.done).toBe(true);
  });

  it('logged out on the login path → login_needed', async () => {
    window.history.pushState({}, '', '/login');
    document.body.innerHTML = '<form><input type="text"><input type="password"></form>';
    expect(await runReader(KURLY_SCRIPT)).toMatchObject({ orders: [], done: true, note: 'login_needed' });
  });

  it('password form on the order page with no order text → login_needed', async () => {
    document.body.innerHTML = '<div><input type="password"></div>';
    expect(await runReader(KURLY_SCRIPT, 6000)).toMatchObject({ orders: [], done: true, note: 'login_needed' });
  });

  it('wrong path with no list → wrong_page', async () => {
    window.history.pushState({}, '', '/');
    document.body.innerHTML = '<main>홈</main>';
    expect(await runReader(KURLY_SCRIPT, 6000)).toMatchObject({ orders: [], done: true, note: 'wrong_page' });
  });

  it('right path, no list, no empty-state text → no_list_found', async () => {
    document.body.innerHTML = '<main>마이컬리</main>';
    expect(await runReader(KURLY_SCRIPT, 6000)).toMatchObject({ orders: [], done: true, note: 'no_list_found' });
  });

  it('empty order history → no orders, no note', async () => {
    document.body.innerHTML = '<main><p>주문내역이 없습니다.</p></main>';
    expect(await runReader(KURLY_SCRIPT, 6000)).toEqual({ type: 'orders', site: 'kurly', orders: [], done: true });
  });

  it('privacy: recipient, address, phone, card number and e-mail in the page never reach the posted message', async () => {
    const secrets = ['홍길동', '010-1234-5678', '서울특별시 강남구 테헤란로 1', '4123-5678-9012-3456', 'kid@example.com', 'sess_TOKEN_abc123'];
    // INVENTED 개인정보 칸 — 실제 구조 아님. 카드 안에 같이 들어 있는 경우를 흉내 낸다.
    const privacy =
      `<div class="ship"><p>수취인 ${secrets[0]}</p><p>연락처 ${secrets[1]}</p><p>배송지 ${secrets[2]}</p></div>` +
      `<div class="pay"><p>카드 ${secrets[3]}</p><p>${secrets[4]}</p><p data-token="${secrets[5]}"></p></div>`;
    document.body.innerHTML = listPage(card('2026101812345678', '2026.10.27 18:30', '12,300', privacy));
    const msg = await runReader(KURLY_SCRIPT, 6000);
    expect(msg!.orders).toHaveLength(1);
    const wire = JSON.stringify(msg);
    for (const s of secrets) expect(wire).not.toContain(s);
    expect(msg!.orders[0]).toEqual({ orderNo: '2026101812345678', orderedAt: '2026-10-27 18:30', amount: 12300, seller: '마켓컬리', title: '유기농 바나나' });
  });
});
