import { describe, expect, it } from 'vitest';
import { refillTails, amountLine, cleanTitle, displayLine, displayName, endReasonText, formatDate, formatDateTime, formatWon, kindLabel, listCounts, parseClaimResult, parseOrderList, parseOrderReceipt, receiptRows, rowLabel, rowState, rowViews, sortOrders, summaryLine, tallyPending, type LinkOrder, type RunView } from './ordersModel';
import { outcomeKey, type Outcome } from './runOutcome';

const row = (over: Partial<LinkOrder> = {}): LinkOrder => ({
  id: 1, platform: 'coupang', orderNo: 'C-1', seller: '쿠팡', title: '생수', amount: 1000, orderedAt: '2026-10-20 10:00', claimed: false, claimedAt: null, kind: null, duplicate: false, ...over,
});

describe('주문 목록 모양 (parseOrderList)', () => {
  it('서버 응답을 받아 주문 · 포인트 · 적립 가능 수를 채운다', () => {
    const r = parseOrderList({ ok: true, point: 300, claimable: 2, orders: [
      { id: 5, platform: 'naver', orderNo: 'N-**1', seller: '스토어', title: '과자', amount: 12300.7, orderedAt: '2026-10-27 14:03', claimed: true, claimedAt: '2026-10-27 15:00', kind: 'card', duplicate: true },
    ] });
    expect(r.point).toBe(300);
    expect(r.claimable).toBe(2);
    expect(r.orders).toEqual([{ id: 5, platform: 'naver', orderNo: 'N-**1', seller: '스토어', title: '과자', amount: 12300, orderedAt: '2026-10-27 14:03', claimed: true, claimedAt: '2026-10-27 15:00', kind: 'card', duplicate: true }]);
  });
  it('모양이 틀린 주문은 버리고, 없는 숫자는 0, 알 수 없는 칸은 옮기지 않는다', () => {
    const r = parseOrderList({ orders: [
      { id: 0, orderedAt: '2026-10-27 14:03', amount: 1 },
      { id: 2, orderedAt: '', amount: 1 },
      { id: 3, orderedAt: '2026-10-27 14:03', amount: 'x' },
      { id: 4, orderedAt: '2026-10-27 14:03', amount: 500, cookie: 'secret', address: 'x' },
      null,
    ] });
    expect(r.orders.map((o) => o.id)).toEqual([4]);
    expect(Object.keys(r.orders[0]).sort()).toEqual(['amount', 'claimed', 'claimedAt', 'duplicate', 'id', 'kind', 'orderNo', 'orderedAt', 'platform', 'seller', 'title']);
    expect(r.point).toBe(0);
    expect(r.claimable).toBe(0);
    expect(parseOrderList(undefined)).toEqual({ orders: [], point: 0, claimable: 0 });
  });
  it('종류(kind)와 중복(duplicate)을 읽는다 — 모르는 종류는 null, duplicate 는 true 일 때만 true', () => {
    const r = parseOrderList({ orders: [
      { id: 1, orderedAt: '2026-10-27 14:03', amount: 1, kind: 'card', duplicate: false },
      { id: 2, orderedAt: '2026-10-27 14:03', amount: 1, kind: 'purchase', duplicate: true },
      { id: 3, orderedAt: '2026-10-27 14:03', amount: 1, kind: 'list' },
      { id: 4, orderedAt: '2026-10-27 14:03', amount: 1, kind: 'refund', duplicate: 'yes' },
    ] });
    expect(r.orders.map((o) => [o.kind, o.duplicate])).toEqual([['card', false], ['purchase', true], ['list', false], [null, false]]);
  });
  it('적립 결과는 given · pouchRoom 만 읽는다', () => {
    expect(parseClaimResult({ ok: true, given: 300, pouch: [{ secret: 1 }], pouchRoom: 3 })).toEqual({ given: 300, pouchRoom: 3 });
    expect(parseClaimResult({})).toEqual({ given: 0, pouchRoom: 0 });
  });
});

describe('화면 글자 (displayLine · formatWon · summaryLine)', () => {
  it('「2026.10.20 판매처 · 상품명」 — 연도까지, 월 · 일은 두 자리', () => {
    expect(displayLine(row({ orderedAt: '2026-10-27 14:03', seller: '쿠팡', title: '생수' }))).toBe('2026.10.27 쿠팡 · 생수');
    expect(displayLine(row({ orderedAt: '2026-01-05 09:00', seller: '', title: '생수' }))).toBe('2026.01.05 생수');
    expect(displayLine(row({ orderedAt: '2026-01-05 09:00', seller: '스토어', title: '' }))).toBe('2026.01.05 스토어');
  });
  it('제목이 비었거나 화면 글자뿐이면 억지로 채우지 않고 날짜만 — 「자세히 보기」는 화면에도 나오지 않는다', () => {
    expect(displayLine(row({ orderedAt: '2026-10-20 10:00', seller: '', title: '' }))).toBe('2026.10.20');
    expect(displayLine(row({ orderedAt: '2026-10-20 10:00', seller: '', title: '자세히 보기' }))).toBe('2026.10.20');
    expect(displayLine(row({ orderedAt: '2026-10-20 10:00', seller: '', title: '더보기 · 영수증' }))).toBe('2026.10.20');
    expect(displayLine(row({ orderedAt: '2026-10-20 10:00', seller: '', title: '생수 2L 자세히 보기' }))).toBe('2026.10.20 생수 2L');
  });
  it('판매처와 상품명이 겹치면 한 번만 — 대표님 캡처의 세 줄(10-29 08:54)', () => {
    // 「삼성공식파트너 문성전자 · 삼성공식파트너 문성전…」: 상품명이 판매처로 시작하면 상품명(판매처가 들어 있다) 한 줄
    expect(displayLine(row({ orderedAt: '2026-08-14 10:00', seller: '삼성공식파트너 문성전자', title: '삼성공식파트너 문성전자 비스포크 냉장고' }))).toBe('2026.08.14 삼성공식파트너 문성전자 비스포크 냉장고');
    // 「줄스클럽 · 줄스클럽 · 배송비 무료」: 배송비 부가 줄을 빼고 판매처와 같으면 한 번
    expect(displayLine(row({ orderedAt: '2026-08-09 10:00', seller: '줄스클럽', title: '줄스클럽 · 배송비 무료' }))).toBe('2026.08.09 줄스클럽');
    // 「웰스 · 웰스」: 판매처와 같은 상품명은 한 번
    expect(displayLine(row({ orderedAt: '2026-08-04 10:00', seller: '웰스', title: '웰스' }))).toBe('2026.08.04 웰스');
    expect(displayLine(row({ orderedAt: '2026-08-04 10:00', seller: '웰스', title: '웰스 · 웰스' }))).toBe('2026.08.04 웰스');
  });
  it('이름 합치기 규칙 — 띄어쓰기 무시 · 판매처가 더 길면 판매처 · 다르면 둘 다 · 한쪽이 비면 다른 쪽', () => {
    expect(displayName('삼성공식 파트너', '삼성공식파트너')).toBe('삼성공식 파트너');
    expect(displayName('웰스파트너', '웰스')).toBe('웰스파트너');
    expect(displayName('스토어', '과자 세트')).toBe('스토어 · 과자 세트');
    expect(displayName('', '과자 세트')).toBe('과자 세트');
    expect(displayName('스토어', '')).toBe('스토어');
    expect(displayName('스토어', '배송비 3,000원')).toBe('스토어');
    expect(displayName('스토어', '무료배송 · 과자')).toBe('스토어 · 과자');
    expect(displayName('', '')).toBe('');
  });
  it('금액은 천 단위 쉼표와 「원」', () => {
    expect(formatWon(12300)).toBe('12,300원');
    expect(formatWon(0)).toBe('0원');
    expect(formatWon(1234567)).toBe('1,234,567원');
    expect(formatWon(999)).toBe('999원');
  });
  it('요약 줄 「적립 가능 n건 · 건당 p원」(포인트는 P)', () => {
    expect(summaryLine(3, 300)).toBe('적립 가능 3건 · 건당 300P');
    expect(summaryLine(0, 300)).toBe('적립 가능 0건 · 건당 300P');
  });
});

describe('날짜 (formatDate)', () => {
  it('연도까지 「2026.10.20」, 월 · 일은 두 자리로 맞춘다', () => {
    expect(formatDate('2026-10-20 10:00')).toBe('2026.10.20');
    expect(formatDate('2025-1-5')).toBe('2025.01.05');
    expect(formatDate('2025-12-31T23:59:00')).toBe('2025.12.31');
  });
  it('모양이 틀리면 빈 글자(억지로 채우지 않는다)', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('10/20')).toBe('');
    expect(formatDate('어제')).toBe('');
  });
});

describe('제목 정리 (cleanTitle)', () => {
  it('화면 글자(자세히 보기 · 더보기 · 영수증 · 결제상세 …)만 지운다', () => {
    expect(cleanTitle('자세히 보기')).toBe('');
    expect(cleanTitle('더보기')).toBe('');
    expect(cleanTitle('영수증')).toBe('');
    expect(cleanTitle('결제상세')).toBe('');
    expect(cleanTitle('영수증 조회')).toBe('');
    expect(cleanTitle('더보기 영수증 결제상세')).toBe('');
  });
  it('상품 이름 곁에 섞인 화면 글자를 지우고 이름은 그대로 둔다', () => {
    expect(cleanTitle('생수 2L 자세히 보기')).toBe('생수 2L');
    expect(cleanTitle('[스토어] 과자 · 더보기')).toBe('[스토어] 과자');
    expect(cleanTitle('결제상세 | 노트북 거치대')).toBe('노트북 거치대');
    expect(cleanTitle('  라면   5개  ')).toBe('라면 5개');
  });
  it('낱말이 아닌 곳은 지우지 않는다 — 「영수증용지」 같은 상품 이름', () => {
    expect(cleanTitle('영수증용지 3롤')).toBe('영수증용지 3롤');
    expect(cleanTitle('더보기좋은책')).toBe('더보기좋은책');
  });
  it('빈 제목은 빈 글자', () => {
    expect(cleanTitle('')).toBe('');
    expect(cleanTitle('   ')).toBe('');
  });
});

describe('정렬 (sortOrders)', () => {
  it('적립 안 한 것이 먼저, 그 안에서는 최근 주문이 먼저', () => {
    const list = [
      row({ id: 1, orderedAt: '2026-10-20 10:00', claimed: true }),
      row({ id: 2, orderedAt: '2026-10-21 10:00' }),
      row({ id: 3, orderedAt: '2026-10-25 10:00' }),
      row({ id: 4, orderedAt: '2026-10-22 10:00', claimed: true }),
    ];
    const before = list.map((o) => o.id);
    expect(sortOrders(list).map((o) => o.id)).toEqual([3, 2, 4, 1]);
    expect(list.map((o) => o.id)).toEqual(before);
  });
  it('같은 시각이면 id 가 큰 것이 먼저', () => {
    expect(sortOrders([row({ id: 1 }), row({ id: 9 })]).map((o) => o.id)).toEqual([9, 1]);
  });
  it('적립 시각(claimedAt)만 있어도 적립한 줄로 보고 뒤로 보낸다', () => {
    expect(sortOrders([row({ id: 1, orderedAt: '2026-10-25 10:00', claimedAt: '2026-10-26 09:00' }), row({ id: 2, orderedAt: '2026-10-20 10:00' })]).map((o) => o.id)).toEqual([2, 1]);
  });
});

describe('줄 상태 (rowState · kindLabel)', () => {
  it('적립 완료 > 이미 올린 영수증 > 영수증 가져오는 중(list) > 광고 보고 적립 순으로 가른다', () => {
    expect(rowState(row({ claimed: true, duplicate: true, kind: 'list' }))).toBe('claimed');
    expect(rowState(row({ duplicate: true, kind: 'card' }))).toBe('duplicate');
    expect(rowState(row({ kind: 'list' }))).toBe('pending');
    expect(rowState(row({ kind: 'card' }))).toBe('ready');
    expect(rowState(row({ kind: null }))).toBe('ready');
  });
  it('적립 시각(claimedAt)이 있으면 claimed 가 꺼져 있어도 적립 완료', () => {
    expect(rowState(row({ claimed: false, claimedAt: '2026-10-27 15:00', kind: 'card' }))).toBe('claimed');
    expect(rowState(row({ claimed: false, claimedAt: null, kind: 'card' }))).toBe('ready');
  });
  it('종류 글자는 카드영수증 · 구매영수증만(목록 행 · 모름은 없음)', () => {
    expect(kindLabel(row({ kind: 'card' }))).toBe('카드영수증');
    expect(kindLabel(row({ kind: 'purchase' }))).toBe('구매영수증');
    expect(kindLabel(row({ kind: 'list' }))).toBe('');
    expect(kindLabel(row({ kind: null }))).toBe('');
  });
});

describe('줄마다 상태 (rowViews) — 대기 / 가져오는 중 / 가져옴 ✓ / 못 가져옴(까닭) / 적립 완료', () => {
  const list = [
    row({ id: 1, orderedAt: '2026-10-25 10:00', kind: 'list' }),
    row({ id: 2, orderedAt: '2026-10-24 10:00', kind: 'list' }),
    row({ id: 3, orderedAt: '2026-10-23 10:00', kind: 'card' }),
    row({ id: 4, orderedAt: '2026-10-22 10:00', kind: 'purchase', claimedAt: '2026-10-26 09:00' }),
    row({ id: 5, orderedAt: '2026-10-21 10:00', kind: 'card', duplicate: true }),
    row({ id: 6, orderedAt: '2026-10-20 10:00', kind: 'list' }),
  ];
  const states = (run: RunView | null): Record<number, string> => Object.fromEntries([...rowViews(list, run)].map(([id, v]) => [id, v.state]));

  it('서버에 「영수증 없음」(kind none)으로 남은 줄 — 읽기 중이든 끝났든 「영수증 없음」, 다시 가져오기 단추 없음 · 목록 수에서 가져온 줄로 세지 않는다', () => {
    const withNone = [...list, row({ id: 7, orderedAt: '2026-10-19 10:00', kind: 'none' })];
    expect(rowState(withNone[6])).toBe('none');
    for (const run of [null, { stage: 'list' as const, reason: '' }, { stage: 'ended' as const, reason: 'receipt-bounced' }]) {
      expect(rowViews(withNone, run).get(7)).toEqual({ state: 'none', reason: '영수증이 없는 결제예요' });
    }
    expect(listCounts(withNone)).toEqual({ total: 7, fetched: 3, claimable: 1 });
    expect(parseOrderList({ orders: [{ id: 9, orderedAt: '2026-10-27 14:03', amount: 1, kind: 'none' }] }).orders[0].kind).toBe('none');
  });

  it('목록을 읽는 단계 — 영수증을 못 가져온 줄은 모두 「대기」, 가져온 줄은 바로 가져옴 ✓', () => {
    expect(states({ stage: 'list', reason: '' })).toEqual({ 1: 'waiting', 2: 'waiting', 3: 'fetched', 4: 'claimed', 5: 'duplicate', 6: 'waiting' });
  });

  it('영수증 단계 — 가장 위(최신) 대기 줄 하나만 「가져오는 중」, 나머지는 「대기」', () => {
    expect(states({ stage: 'receipt', reason: '' })).toEqual({ 1: 'fetching', 2: 'waiting', 3: 'fetched', 4: 'claimed', 5: 'duplicate', 6: 'waiting' });
  });

  it('가져오는 줄이 가져옴 ✓ 로 바뀌면 다음 최신 대기 줄이 가져오는 중이 된다', () => {
    const next = list.map((o) => (o.id === 1 ? { ...o, kind: 'card' as const } : o));
    const v = rowViews(next, { stage: 'receipt', reason: '' });
    expect(v.get(1)?.state).toBe('fetched');
    expect(v.get(2)?.state).toBe('fetching');
    expect(v.get(6)?.state).toBe('waiting');
  });

  it('끝났는데 아직 목록 행인 줄은 전부 「못 가져옴」+ 쉬운 말 까닭 — 「가져오는 중」에 남기지 않는다', () => {
    const v = rowViews(list, { stage: 'ended', reason: 'receipt-bounced' });
    for (const id of [1, 2, 6]) expect(v.get(id)).toEqual({ state: 'failed', reason: '영수증 화면을 못 열었어요', retry: true });
    expect([...v.values()].some((x) => x.state === 'fetching' || x.state === 'waiting')).toBe(false);
    // 가져온 줄 · 적립 완료 · 이미 올린 영수증은 그대로
    expect([v.get(3)?.state, v.get(4)?.state, v.get(5)?.state]).toEqual(['fetched', 'claimed', 'duplicate']);
  });

  it('읽기 정보가 없으면(읽는 중이 아닌 화면) 목록 행도 가져오는 중이 아니다', () => {
    expect(states(null)).toMatchObject({ 1: 'failed', 2: 'failed', 6: 'failed' });
    // 두루뭉술한 「읽지 못했어요」 대신 다음 할 일을 말한다
    expect(rowViews(list, null).get(1)?.reason).toBe('가져오지 못했어요 · 가져오기를 눌러 다시 시도해 주세요');
  });

  it('줄 수는 목록과 같다', () => {
    expect(rowViews(list, { stage: 'receipt', reason: '' }).size).toBe(list.length);
  });
});

describe('끝난 까닭 글자 (endReasonText)', () => {
  it('까닭 코드를 쉬운 말로 — 영문 코드 · 번호는 글자에 없다', () => {
    expect(endReasonText('no-row-menu')).toBe('영수증 메뉴를 못 찾았어요');
    expect(endReasonText('no-receipt-menu')).toBe('영수증 메뉴를 못 찾았어요');
    expect(endReasonText('receipt-bounced')).toBe('영수증 화면을 못 열었어요');
    expect(endReasonText('login-required')).toBe('로그인이 풀렸어요');
    expect(endReasonText('login-timeout')).toBe('로그인이 풀렸어요');
    expect(endReasonText('issue-failed')).toBe('연달아 가져오지 못해 멈췄어요');
    expect(endReasonText('timeouts')).toBe('사이트 응답이 늦어 멈췄어요');
    expect(endReasonText('site-cap')).toBe('시간이 다 돼 멈췄어요');
    expect(endReasonText('stopped')).toBe('중단했어요');
  });
  it('요청 흐름(naverApiFlow)이 내는 끝난 까닭도 쉬운 말이다 — 막힘 · 목록 실패 · 시간 초과', () => {
    expect(endReasonText('blocked')).toBe('사이트가 잠시 막았어요');
    expect(endReasonText('list-failed')).toBe('주문 목록을 받지 못했어요');
    expect(endReasonText('timeout')).toBe('사이트 응답이 늦어 멈췄어요');
    expect(endReasonText('max-steps')).toBe('시간이 다 돼 멈췄어요');
    for (const r of ['shop-lost', 'pay-lost', 'unexpected-page']) expect(endReasonText(r)).toBe('사이트 화면이 달라 멈췄어요');
    expect(endReasonText('cross-origin')).toBe('사이트가 영수증 요청을 받아 주지 않았어요');
    expect(endReasonText('first-page-only')).toBe('주문 목록 첫 쪽까지만 가져왔어요');
    expect(endReasonText('list-shape')).toBe('주문 목록 모양이 달라 읽지 못했어요');
    expect(endReasonText('fetch-refused')).toBe('허용되지 않은 주소라 멈췄어요');
  });
  it('그 밖(모르는 코드 · 빈 코드 · 정상 끝)은 다음 할 일을 말하고, 「읽지 못했어요」처럼 두루뭉술하게 말하지 않는다', () => {
    for (const r of ['all-rows', 'unknown', '']) expect(endReasonText(r)).toBe('가져오지 못했어요 · 가져오기를 눌러 다시 시도해 주세요');
    for (const r of ['no-row-menu', 'receipt-bounced', 'login-required', 'timeouts', 'issue-failed', 'stopped', 'unknown', '']) {
      expect(endReasonText(r)).not.toMatch(/[a-z]/);
      expect(endReasonText(r)).not.toContain('읽지 못했어요');
    }
  });
});

describe('머리 숫자 (listCounts) · 줄 글자 (rowLabel · amountLine)', () => {
  it('목록 전체 · 가져온 건 · 적립 가능 — 적립 완료와 이미 올린 영수증은 적립 가능에 넣지 않는다', () => {
    const list = [
      row({ id: 1, kind: 'list' }),
      row({ id: 2, kind: 'card' }),
      row({ id: 3, kind: 'purchase' }),
      row({ id: 4, kind: 'card', claimed: true }),
      row({ id: 5, kind: 'card', claimedAt: '2026-10-26 09:00' }),
      row({ id: 6, kind: 'card', duplicate: true }),
    ];
    expect(listCounts(list)).toEqual({ total: 6, fetched: 5, claimable: 2 });
    expect(listCounts([])).toEqual({ total: 0, fetched: 0, claimable: 0 });
  });
  it('줄 오른쪽 글자', () => {
    expect(rowLabel({ state: 'waiting', reason: '' })).toBe('대기');
    expect(rowLabel({ state: 'fetching', reason: '' })).toBe('가져오는 중…');
    expect(rowLabel({ state: 'failed', reason: '로그인이 풀렸어요' })).toBe('못 가져옴');
    expect(rowLabel({ state: 'none', reason: '영수증이 없는 결제예요' })).toBe('영수증 없음');
    expect(rowLabel({ state: 'claimed', reason: '' })).toBe('적립 완료');
    expect(rowLabel({ state: 'fetched', reason: '' })).toBe('');
  });
  it('금액 줄 — 가져온 줄은 「가져옴 ✓」, 아직인 줄은 금액만', () => {
    expect(amountLine(row({ amount: 5000, kind: 'card' }), { state: 'fetched', reason: '' })).toBe('5,000원 · 카드영수증 · 가져옴 ✓');
    expect(amountLine(row({ amount: 5000, kind: 'list' }), { state: 'waiting', reason: '' })).toBe('5,000원');
    expect(amountLine(row({ amount: 5000, kind: 'card', claimed: true }), { state: 'claimed', reason: '' })).toBe('5,000원 · 카드영수증');
  });
});

describe('줄 결과(outcomes) — 흐름이 알린 줄마다의 상태 · 까닭 · 다시 가져오기', () => {
  // 서버 목록의 주문번호는 앞이 별로 가려져 뒤 4자리만 보인다 — 흐름의 16자리와 같은 키(뒤4자리 · 분 단위 일시 · 금액)로 잇는다
  const list = [
    row({ id: 1, orderNo: '************1111', orderedAt: '2026-10-25 10:00', amount: 5000, kind: 'list' }),
    row({ id: 2, orderNo: '************2222', orderedAt: '2026-10-24 10:00', amount: 6000, kind: 'list' }),
    row({ id: 3, orderNo: '************3333', orderedAt: '2026-10-23 10:00', amount: 7000, kind: 'list' }),
    row({ id: 4, orderNo: '************4444', orderedAt: '2026-10-22 10:00', amount: 8000, kind: 'list' }),
    row({ id: 5, orderNo: '************5555', orderedAt: '2026-10-21 10:00', amount: 9000, kind: 'card' }),
  ];
  const key = (id: number): string => { const o = list.find((x) => x.id === id)!; return outcomeKey(o.orderNo, o.orderedAt, o.amount); };
  const outcomes: Record<string, Outcome> = {
    [key(1)]: { state: 'none' },
    [key(2)]: { state: 'failed', code: 'blocked' },
    [key(3)]: { state: 'fetching' },
  };
  const reading: RunView = { stage: 'receipt', reason: '', outcomes };

  it('키는 16자리 주문번호와 가려진 주문번호가 같다(뒤 4자리 · 분 단위 일시 · 금액)', () => {
    expect(outcomeKey('1234567890121111', '2026-10-25 10:00:37', 5000)).toBe(outcomeKey('************1111', '2026-10-25 10:00', 5000));
  });

  it('읽는 중 — 알린 결과를 그대로 보이고, 결과가 아직 없는 줄은 「대기」(가장 위 줄을 가져오는 중으로 짐작하지 않는다)', () => {
    const v = rowViews(list, reading);
    expect(v.get(1)).toEqual({ state: 'none', reason: '영수증이 없는 결제예요' });
    expect(v.get(2)).toEqual({ state: 'failed', reason: '사이트가 잠시 막았어요', retry: true });
    expect(v.get(3)).toEqual({ state: 'fetching', reason: '' });
    expect(v.get(4)).toEqual({ state: 'waiting', reason: '' });
    expect(v.get(5)).toEqual({ state: 'fetched', reason: '' });
  });

  it('결과를 알리지 않는 사이트(outcomes 없음)는 예전처럼 가장 위 대기 줄을 가져오는 중으로 짐작한다', () => {
    expect(rowViews(list, { stage: 'receipt', reason: '' }).get(1)?.state).toBe('fetching');
  });

  it('실패 까닭은 쉬운 말이고 영문 코드가 없다 — 로그인이 풀린 줄만 다시 가져오기가 없다', () => {
    const codes = ['login', 'blocked', 'no-pair', 'unreadable'] as const;
    const map: Record<string, Outcome> = {};
    list.slice(0, 4).forEach((x, i) => { map[outcomeKey(x.orderNo, x.orderedAt, x.amount)] = { state: 'failed', code: codes[i] }; });
    const v = rowViews(list, { stage: 'ended', reason: 'all-rows', outcomes: map });
    expect([1, 2, 3, 4].map((id) => v.get(id)?.reason)).toEqual(['로그인이 풀렸어요', '사이트가 잠시 막았어요', '영수증 주소를 못 찾았어요', '영수증 내용을 읽지 못했어요']);
    expect([1, 2, 3, 4].map((id) => v.get(id)?.retry)).toEqual([false, true, true, true]);
    for (const x of v.values()) expect(x.reason).not.toMatch(/[a-z]/);
    const net = rowViews(list, { stage: 'ended', reason: 'all-rows', outcomes: { [key(1)]: { state: 'failed', code: 'network' } } });
    expect(net.get(1)).toEqual({ state: 'failed', reason: '인터넷이 불안정해요', retry: true });
  });

  it('영수증 없음은 실패가 아니다 — 끝난 뒤에도 「영수증 없음」으로 남고 다시 가져오기 단추가 없다', () => {
    const v = rowViews(list, { stage: 'ended', reason: 'all-rows', outcomes });
    expect(v.get(1)).toEqual({ state: 'none', reason: '영수증이 없는 결제예요' });
    expect(v.get(1)?.retry).toBeUndefined();
  });

  it('사용자가 중단했으면 결과가 없는 줄은 실패가 아니라 「대기」이고 한 줄씩 가져오기가 열린다(알린 실패는 그대로)', () => {
    const v = rowViews(list, { stage: 'ended', reason: 'stopped', outcomes });
    expect(v.get(2)?.state).toBe('failed');            // 이미 알린 실패는 그대로
    expect(v.get(1)?.state).toBe('none');              // 영수증 없음도 그대로
    expect(v.get(3)).toEqual({ state: 'waiting', reason: '', retry: true });   // 가져오던 줄은 멈췄으니 대기
    expect(v.get(4)).toEqual({ state: 'waiting', reason: '', retry: true });
    expect(rowViews(list, { stage: 'ended', reason: 'stopped' }).get(4)).toEqual({ state: 'waiting', reason: '', retry: true });
  });

  it('흐름이 stopped 로 알린 줄은 실패로 세지 않고 대기', () => {
    const v = rowViews(list, { stage: 'receipt', reason: '', outcomes: { [key(4)]: { state: 'failed', code: 'stopped' } } });
    expect(v.get(4)).toEqual({ state: 'waiting', reason: '', retry: true });
  });

  it('끝났는데 결과도 없는 줄은 끝난 까닭 글자로 못 가져옴 + 다시 가져오기(로그인 풀림만 단추 없음)', () => {
    expect(rowViews(list, { stage: 'ended', reason: 'issue-failed', outcomes: {} }).get(4)).toEqual({ state: 'failed', reason: '연달아 가져오지 못해 멈췄어요', retry: true });
    expect(rowViews(list, { stage: 'ended', reason: 'login-required', outcomes: {} }).get(4)).toEqual({ state: 'failed', reason: '로그인이 풀렸어요', retry: false });
  });

  it('줄 수 합계 — 영수증 없음 · 못 가져옴 · 대기 · 가져오는 중(가져온 줄은 세지 않는다)', () => {
    expect(tallyPending(list, reading)).toEqual({ waiting: 1, fetching: 1, none: 1, failed: 1, cancelled: 0 });
    expect(tallyPending(list, { stage: 'ended', reason: 'stopped', outcomes })).toEqual({ waiting: 2, fetching: 0, none: 1, failed: 1, cancelled: 0 });
    expect(tallyPending([], null)).toEqual({ waiting: 0, fetching: 0, none: 0, failed: 0, cancelled: 0 });
  });
});

describe('영수증 보기 (parseOrderReceipt · receiptRows · formatDateTime)', () => {
  const body = { ok: true, receipt: { seller: '줄스클럽', title: '줄스클럽 · 배송비 무료', amount: 46000.9, orderedAt: '2026-08-09 14:03:22', kind: 'card', cardIssuer: '국민', approval: '12345678', businessNumber: '123-45-67890', cookie: 'x' } };

  it('응답의 영수증 칸만 읽는다 — 모르는 칸은 옮기지 않고 모양이 틀리면 null', () => {
    const r = parseOrderReceipt(body);
    expect(r).toEqual({ seller: '줄스클럽', title: '줄스클럽 · 배송비 무료', amount: 46000, orderedAt: '2026-08-09 14:03:22', kind: 'card', cardIssuer: '국민', approval: '12345678', businessNumber: '123-45-67890' });
    expect(Object.keys(r!)).not.toContain('cookie');
    expect(parseOrderReceipt(undefined)).toBeNull();
    expect(parseOrderReceipt({ receipt: { amount: 1 } })).toBeNull();
    expect(parseOrderReceipt({ receipt: { orderedAt: '2026-08-09 14:03:22', amount: 'x' } })).toBeNull();
    expect(parseOrderReceipt({ receipt: { orderedAt: '2026-08-09 14:03:22', amount: 10, kind: 'refund' } })?.kind).toBeNull();
  });

  it('일시는 초까지 「2026.08.09 14:03:22」 — 초가 없으면 분까지, 모양이 틀리면 빈 글자', () => {
    expect(formatDateTime('2026-08-09 14:03:22')).toBe('2026.08.09 14:03:22');
    expect(formatDateTime('2026-08-09 14:03')).toBe('2026.08.09 14:03');
    expect(formatDateTime('2026-8-9T4:03:05')).toBe('2026.08.09 04:03:05');
    expect(formatDateTime('어제')).toBe('');
  });

  it('표 — 업체명 · 상품명 · 금액 · 일시 · 카드사 · 승인번호 · 사업자등록번호 · 종류, 값이 없는 칸은 줄이 없다', () => {
    const rows = receiptRows(parseOrderReceipt(body)!);
    // 상품명이 업체명과 겹치고 배송비 부가 줄뿐이라 상품명 줄은 없다
    expect(rows.map((x) => x.label)).toEqual(['업체명', '결제 금액', '승인 일시', '카드사', '승인번호', '사업자등록번호', '종류']);
    expect(rows.find((x) => x.label === '결제 금액')?.value).toBe('46,000원');
    expect(rows.find((x) => x.label === '종류')?.value).toBe('카드영수증');
    const none = receiptRows({ seller: '', title: '생수 2L', amount: 1000, orderedAt: '2026-08-09 14:03', kind: null, cardIssuer: '', approval: '', businessNumber: '' });
    expect(none.map((x) => x.label)).toEqual(['상품명', '결제 금액', '승인 일시']);
    expect(none[0].value).toBe('생수 2L');
  });
});

describe('영수증 세부 — 대표님 14:15 원문 칸 전부를 22:30 캡처(IMG_9704) 칸 이름 · 순서로', () => {
  const detail = {
    cardCompany: '롯데', approvalNo: '37649223', cardNo: '4523-****-****-0113', tradeType: '신용', ownerType: '법인', installmentType: '일시불',
    approvalAt: '2026-09-11 11:51:04', productName: '가짜 상품', productOrderNo: 'PD2026091100000001',
    sellerName: '가짜상점', sellerRepresentative: '홍길동', sellerBusinessNo: '123-45-67890', sellerTel: '02-000-0000', sellerAddress: '가짜 주소',
    merchantName: '네이버파이낸셜', merchantBusinessNo: '000-00-00000',
    approvalAmount: 12300, cancelAmount: 0, supplyAmount: 11182, taxAmount: 1118, totalAmount: 12300, cookie: 'x',
    cardExpiredMonth: '**', cardExpiredYear: '**', merchantRepresentative: '김대표',
  };
  const body = { receipt: { seller: '가짜상점', title: '가짜 상품', amount: 12300, orderedAt: '2026-09-11 11:51:04', kind: 'card', cardIssuer: '롯데', approval: '37649223', businessNumber: '123-45-67890', detail } };

  it('세부 칸만 읽고(모르는 칸은 버린다) 표는 캡처 순서 · 「/」로 두 값을 붙인다', () => {
    const r = parseOrderReceipt(body)!;
    expect(Object.keys(r.detail!)).not.toContain('cookie');
    const rows = receiptRows(r);
    expect(rows.map((x) => x.label)).toEqual([
      '카드사/승인번호', '카드번호(유효기간)', '거래종류/할부', '결제일자', '상품명', '상품 주문번호',
      '판매자 정보', '판매자상호', '대표자명', '사업자등록번호', '전화번호', '사업장주소',
      '가맹점 정보', '가맹점명', '대표자명', '사업자등록번호',
      '승인금액', '취소금액', '공급가액', '부가세', '합계',
    ]);
    const v = (label: string) => rows.find((x) => x.label === label)?.value;
    expect(v('카드사/승인번호')).toBe('롯데 / 37649223');
    expect(v('카드번호(유효기간)')).toBe('4523-****-****-0113(**/**)');
    expect(v('거래종류/할부')).toBe('신용(법인) / 일시불');
    expect(v('결제일자')).toBe('2026-09-11 11:51:04');
    expect(v('취소금액')).toBe('0원');
    expect(rows.filter((x) => x.head).map((x) => x.label)).toEqual(['판매자 정보', '가맹점 정보']);
  });

  it('빈 칸은 줄이 없고, 아래 줄이 하나도 없는 소제목도 없다', () => {
    const rows = receiptRows({ ...parseOrderReceipt(body)!, detail: { cardCompany: '롯데', approvalAmount: 1000 } });
    expect(rows.map((x) => x.label)).toEqual(['카드사/승인번호', '결제일자', '상품명', '판매자 정보', '판매자상호', '사업자등록번호', '승인금액']);
    expect(rows[0].value).toBe('롯데 / 37649223');
  });

  it('세부가 없는 줄(어제 옛 방식으로 받은 40건)은 예전 표 그대로', () => {
    const { detail: _d, ...old } = body.receipt;
    expect(receiptRows(parseOrderReceipt({ receipt: old })!).map((x) => x.label)).toEqual(['업체명', '상품명', '결제 금액', '승인 일시', '카드사', '승인번호', '사업자등록번호', '종류']);
  });
});

describe('한 줄 다시 가져오기 중 다른 줄 (대표님 10-29 13:36 「하나 누르면 전체 단추가 사라졌다가 나오고」)', () => {
  const list = [
    row({ id: 1, orderNo: '2026102000000001', orderedAt: '2026-10-25 10:00', kind: 'list' }),
    row({ id: 2, orderNo: '2026102000000002', orderedAt: '2026-10-24 10:00', kind: 'list' }),
    row({ id: 3, orderNo: '2026102000000003', orderedAt: '2026-10-23 10:00', kind: 'list' }),
  ];
  const k = (o: LinkOrder): string => outcomeKey(o.orderNo, o.orderedAt, o.amount);
  const net: Outcome = { state: 'failed', code: 'network' };

  it('누른 줄만 「가져오는 중」 — 나머지 줄은 지난 실행의 「못 가져옴」 + 가져오기 단추 그대로', () => {
    const outcomes = { [k(list[0])]: { state: 'fetching' } as Outcome, [k(list[1])]: net };
    const v = rowViews(list, { stage: 'receipt', reason: '', outcomes, only: [k(list[0])], base: 'all-rows' });
    expect(v.get(1)).toEqual({ state: 'fetching', reason: '' });
    expect(v.get(2)?.state).toBe('failed');
    expect(v.get(2)?.retry).toBe(true);
    // 지난 실행에서 결과가 없던 줄도 단추가 있는 「못 가져옴」으로 남는다(실행 중이라고 「대기」로 바꾸지 않는다)
    expect(v.get(3)?.state).toBe('failed');
    expect(v.get(3)?.retry).toBe(true);
  });

  it('차례를 기다리는 줄(한 줄 실행 밖에서 fetching)은 「대기」', () => {
    const outcomes = { [k(list[0])]: { state: 'fetching' } as Outcome, [k(list[2])]: { state: 'fetching' } as Outcome };
    const v = rowViews(list, { stage: 'receipt', reason: '', outcomes, only: [k(list[0])], base: 'all-rows' });
    expect(v.get(3)).toEqual({ state: 'waiting', reason: '' });
  });

  it('전체 실행(only 없음)은 예전 그대로 — 결과 없는 줄은 실행 중 「대기」', () => {
    const v = rowViews(list, { stage: 'receipt', reason: '', outcomes: {} });
    expect([v.get(2)?.state, v.get(3)?.state]).toEqual(['waiting', 'waiting']);
  });

  it('지난 전체 실행이 중단(stopped)이었으면 나머지 줄은 단추 있는 「대기」', () => {
    const v = rowViews(list, { stage: 'receipt', reason: '', outcomes: { [k(list[0])]: { state: 'fetching' } }, only: [k(list[0])], base: 'stopped' });
    expect(v.get(2)).toEqual({ state: 'waiting', reason: '', retry: true });
  });
});

describe('「영수증 내용 채우기」 대상(refillTails)', () => {
  it('세부가 빈 네이버 카드 줄만 「뒤 4자리|결제 날짜」로 — 세부 있음 · 목록 줄 · 다른 사이트는 뺀다', () => {
    const base = { id: 1, platform: 'naver', seller: '', title: '', amount: 1000, claimed: false, claimedAt: null, duplicate: false };
    expect(refillTails([
      { ...base, orderNo: '****1234', orderedAt: '2026-10-20 10:04', kind: 'card' },
      { ...base, orderNo: '****5678', orderedAt: '2026-10-21 10:04', kind: 'card', hasDetail: true },
      { ...base, orderNo: '****9999', orderedAt: '2026-10-22 10:04', kind: 'list' },
      { ...base, platform: 'coupang', orderNo: '****1111', orderedAt: '2026-10-22 10:04', kind: 'card' },
    ])).toEqual(['1234|2026-10-20']);
  });
});
