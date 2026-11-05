/**
 * 다이소 통합 시험 — 구동기 + 흐름(daisoApiFlow) + 실제 웹뷰 스크립트(siteFetchScript)를 가짜 페이지(노드 vm · 가짜 fetch) 위에서 처음부터 끝까지 돌린다(틀은 e2eHarness.ts).
 * 응답 키 이름은 11-05 서버 크롬 실측(presets 21) 그대로, 값은 가짜. 확인: 이동 한 번(출처 페이지) · 요청 순서(온라인 목록 → 상세 → 매장 12달 → 전자영수증) · 취소 제외 · 완성 주문 매핑 · 구조 기록 이름.
 */
import { describe, expect, it } from 'vitest';
import { runFlow, type Reply, type Router } from './e2eHarness';
import { DAISO_DETAIL_URL, DAISO_HOME_URL, DAISO_LIST_URL, DAISO_STORE_LIST_URL, DAISO_STORE_RECEIPT_URL } from './daisoApiFlow';
import { outcomeKey } from './runOutcome';

const pages = { 'www.daisomall.co.kr/': { text: '다이소몰 홈' } };
const body = (b?: string): Record<string, unknown> => JSON.parse(b ?? '{}') as Record<string, unknown>;
const ON1 = '2026102712345';
const ON2 = '2026102612346';
const ON3 = '2026102512347';
const SS1 = 'SS20261020001';
const SS2 = 'SS20261018002';
const listRow = (orNo: string, at: string, am: number, over: Record<string, unknown> = {}) => ({ orNo, orStsCd: '21', orStsCdNm: '결제완료', pyCmptDtm: at, orCnclDtm: null, strNm: '다이소몰', totalCnt: 3, orderProd: [{ exhPdNm: `상품${orNo.slice(-1)}`, orQy: 1, orAm: am, cnclSeCd: '' }], ...over });

type Call = { url: string; body: Record<string, unknown> };
function server(): { router: Router; calls: Call[] } {
  const calls: Call[] = [];
  const router: Router = (url, init) => {
    const c: Call = { url, body: body(init.body) };
    calls.push(c);
    if (url === DAISO_LIST_URL) {
      if (c.body.currentPage === 1) return { json: { data: [listRow(ON1, '2026-10-27 09:59:30', 5000), listRow(ON2, '2026-10-26 12:00:00', 7000, { orCnclDtm: '2026-10-26 13:00:00', orStsCdNm: '취소완료' }), listRow(ON3, '2026-10-25 08:30:00', 3000)] } };
      return { json: { data: [] } };
    }
    if (url === DAISO_DETAIL_URL) {
      if (c.body.orNo === ON1) return { json: { data: { or: { orNo: ON1, orStsCdNm: '결제완료' }, orPyAm: { totPyAm: 5000 }, orPymt: { pymtCdNm: '신용카드', credCoCdNm: '국민카드', pyApvDtm: '2026-10-27 10:00:00', pyRctwUrl: 'https://pg.example/x' } } } };
      if (c.body.orNo === ON3) return { json: { data: { or: { orNo: ON3, pyCmptDtm: '2026-10-25 08:30:00' }, orPyAm: { totPyAm: 3000 }, orPymt: { pymtCdNm: '다이소머니' } } } };
      return { status: 404, text: 'no' };
    }
    if (url === DAISO_STORE_LIST_URL) {
      if (c.body.strtDt === '20261001') return { json: { data: { orOffineList: [{ ssNum: SS1, saleDay: '20261020', saleTim: '153012', strNm: '강남점', salDiv: '91', saleAmt: 909, addTax: 91 }, { ssNum: SS2, saleDay: '20261018', saleTim: '110000', strNm: '강남점', salDiv: '92', saleAmt: 2000, addTax: 200 }], hasNext: false } } };
      return { json: { data: { orOffineList: [], hasNext: false } } };
    }
    if (url === DAISO_STORE_RECEIPT_URL) {
      if (c.body.ssNum === SS1) return { json: { data: { orMOfflineorVO: { saleDtm: '2026-10-20 15:30:12', saleAmt: 909, addTax: 91, cardAmt: 1000, cashAmt: 0, strNm: '강남점', bzmnNo: '123-45-67890', salDiv: '91' }, orDOfflineorVOList: [{ gdsNam: '수납함' }], orOfflineorApprVOList: [{ apprWay: '신용카드', apprAmt: 1000, apprYmd: '20261020', apprTm: '153012', apprNo: 'A12345', cardNm: '신한카드' }] } } };
      return { json: { data: null } };
    }
    return { status: 404, text: 'nope' } as Reply;
  };
  return { router, calls };
}

describe('다이소 요청 흐름(통합)', () => {
  it('출처 페이지 한 번 → 목록 1년 15줄씩 → 상세 → 매장 12달 → 전자영수증, 취소는 빼고 카드 · 구매 · 매장 카드 영수증을 만든다', async () => {
    const { router, calls } = server();
    const r = await runFlow('daiso', pages, router);
    expect(r.gotos).toEqual([DAISO_HOME_URL]);
    expect(r.results[0]?.reason).toBe('all-rows');
    // 요청 순서 · 본문 — 목록은 1쪽(3건 ≥ totalCnt 3 이라 2쪽 안 부름), 상세 2건(취소 제외), 매장 목록 12달(이번 달부터), 영수증 1건(92 취소 제외)
    const urls = calls.map((c) => c.url);
    expect(urls.filter((u) => u === DAISO_LIST_URL)).toHaveLength(1);
    expect(calls[0]!.body).toMatchObject({ currentPage: 1, pageSize: 15, selectedDate: '12', orStsCd: '', searchKeyword: '' });
    expect(String(calls[0]!.body.strtDt)).toMatch(/^2025\d{4}$/);
    expect(String(calls[0]!.body.endDt)).toBe('20261029');
    expect(calls.filter((c) => c.url === DAISO_DETAIL_URL).map((c) => c.body.orNo)).toEqual([ON1, ON3]);
    const months = calls.filter((c) => c.url === DAISO_STORE_LIST_URL).map((c) => `${c.body.strtDt}-${c.body.endDt}`);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('20261001-20261029');
    expect(months[1]).toBe('20260901-20260930');
    expect(months[11]).toBe('20251101-20251130');
    expect(calls.filter((c) => c.url === DAISO_STORE_LIST_URL).every((c) => c.body.usePaging === true && c.body.rows === 15 && c.body.pageIndex === 0)).toBe(true);
    expect(calls.filter((c) => c.url === DAISO_STORE_RECEIPT_URL).map((c) => c.body.ssNum)).toEqual([SS1]);
    // 주문: 목록 행(list) 먼저, 그다음 완성본
    const lists = r.orders.filter((o) => o.kind === 'list').map((o) => o.orderNo);
    expect(lists).toEqual([ON1, ON3, SS1]);
    const done = r.orders.filter((o) => o.kind !== 'list');
    expect(done.map((o) => [o.orderNo, o.kind, o.amount, o.payment, o.orderedAt, o.cardIssuer, o.seller])).toEqual([
      [ON1, 'card', 5000, '카드', '2026-10-27 10:00:00', '국민카드', '다이소몰'],
      [ON3, 'purchase', 3000, '포인트·기타', '2026-10-25 08:30:00', undefined, '다이소몰'],
      [SS1, 'card', 1000, '카드', '2026-10-20 15:30:12', '신한카드', '다이소 강남점'],
    ]);
    expect(done[2]).toMatchObject({ approval: 'A12345', businessNumber: '123-45-67890', listKey: '2026-10-20 15:30|1000', detail: { approvalNo: 'A12345', supplyAmount: 909, taxAmount: 91, merchantBusinessNo: '123-45-67890' } });
    expect(done[0]!.listKey).toBe('2026-10-27 09:59|5000');
    // 줄별 결과: 취소는 「취소된 주문」, 나머지는 가져옴
    const last = new Map(r.outcomes.map((e) => [e.key, e.outcome]));
    expect(last.get(outcomeKey(ON2, '2026-10-26 12:00:00', 7000))).toEqual({ state: 'none', why: 'cancelled' });
    expect(last.get(outcomeKey(ON1, '2026-10-27 09:59:30', 5000))).toEqual({ state: 'done' });
    expect(last.get(outcomeKey(SS1, '2026-10-20 15:30:12', 1000))).toEqual({ state: 'done' });
    // 구조 기록(키 이름만, 값 없음) — 응답마다 한 번
    expect(r.structures.map((s) => s.where)).toEqual(['daiso-list', 'daiso-detail', 'daiso-store-list', 'daiso-store-receipt']);
    expect(r.structures[0]).toMatchObject({ host: 'fapi.daisomall.co.kr', path: '/or/orb/selOr' });
    expect(r.structures.flatMap((s) => s.lines).join('\n')).not.toMatch(/123-45-67890|A12345|국민카드/);
    expect(r.results[0]?.stats.reasons).toMatchObject({ 'list-rows': 3, 'list-cancelled': 1, 'store-rows': 2, 'store-cancelled': 1 });
  });

  it('이미 서버에 있는 주문(번호 · 꼬리 · listKey)은 건너뛰고 · onlyKeys 면 그 줄만 다시 받는다', async () => {
    const a = await runFlow('daiso', pages, server().router, {}, { orderNos: [ON1], listKeys: ['2026-10-20 15:30|1000'] });
    expect(a.orders.filter((o) => o.kind !== 'list').map((o) => o.orderNo)).toEqual([ON3]);
    const only = outcomeKey(SS1, '2026-10-20 15:30:12', 1000);
    const b = await runFlow('daiso', pages, server().router, { onlyKeys: [only] });
    expect(b.orders.map((o) => [o.orderNo, o.kind])).toEqual([[SS1, 'card']]);
  });

  it('첫 목록 요청이 로그인 필요(401)면 로그인 화면을 보이고, 같은 출처 페이지로 돌아오면 다시 목록부터', async () => {
    let first = true;
    const base = server();
    const router: Router = (url, init) => { if (url === DAISO_LIST_URL && first) { first = false; return { status: 401, text: '' }; } return base.router(url, init); };
    const r = await runFlow('daiso', pages, router);
    expect(r.results[0]?.reason).toBe('all-rows');
    expect(base.calls.filter((c) => c.url === DAISO_LIST_URL)).toHaveLength(1);
  }, 60000);
});
