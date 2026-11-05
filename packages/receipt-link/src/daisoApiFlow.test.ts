/**
 * 다이소 흐름 — 응답 읽기(순수 함수) 시험. 응답 키 이름은 11-05 서버 크롬 실측(presets 21) 그대로, 값은 가짜.
 */
import { describe, expect, it } from 'vitest';
import { daisoCancelled, daisoListOrder, daisoListRows, daisoStoreAmount, daisoStoreOrder, daisoStoreRows, daisoTotalCount, readDaisoDetail, readDaisoStoreReceipt } from './daisoApiFlow';

const listRow = (over: Record<string, unknown> = {}) => ({
  orNo: '2026102712345', orStsCd: '21', orStsCdNm: '결제완료', pyCmptDtm: '2026-10-27 09:59:30', orCnclDtm: null, strNm: '다이소몰', totalCnt: 3,
  orderProd: [{ exhPdNm: '수납함', orQy: 2, orAm: 4000, cnclSeCd: '' }, { exhPdNm: '행주', orQy: 1, orAm: 1000, cnclSeCd: '' }],
  ...over,
});

describe('다이소 온라인 목록', () => {
  it('data[] 가 주문 배열 · 첫 줄 totalCnt', () => {
    const rows = daisoListRows({ data: [listRow(), listRow({ orNo: '2026102712346' })] });
    expect(rows).toHaveLength(2);
    expect(daisoTotalCount(rows)).toBe(3);
    expect(daisoListRows({ data: null })).toEqual([]);
    expect(daisoTotalCount([])).toBeNull();
  });
  it('줄 → 목록 주문: 주문번호 orNo · 결제 완료 시각 · 금액 = 상품 orAm 합 · 제목 「첫 상품 외 n건」', () => {
    expect(daisoListOrder(listRow())).toMatchObject({ orderNo: '2026102712345', orderedAt: '2026-10-27 09:59:30', amount: 5000, title: '수납함 외 1건', seller: '다이소몰', kind: 'list', needsReceipt: true, listKey: '2026-10-27 09:59|5000' });
    expect(daisoListOrder(listRow({ orderProd: [] }))).toBeNull();
    expect(daisoListOrder(listRow({ pyCmptDtm: '' }))).toBeNull();
  });
  it('취소: orCnclDtm 있음 · 상태 글자에 취소 · 상품 줄이 모두 취소 구분 — 아니면 받는다', () => {
    expect(daisoCancelled(listRow())).toBe(false);
    expect(daisoCancelled(listRow({ orCnclDtm: '2026-10-27 10:10:00' }))).toBe(true);
    expect(daisoCancelled(listRow({ orStsCdNm: '취소완료' }))).toBe(true);
    expect(daisoCancelled(listRow({ orderProd: [{ orAm: 1000, cnclSeCd: '01' }, { orAm: 2000, cnclSeCd: '02' }] }))).toBe(true);
    expect(daisoCancelled(listRow({ orderProd: [{ orAm: 1000, cnclSeCd: '01' }, { orAm: 2000, cnclSeCd: '' }] }))).toBe(false);
  });
});

describe('다이소 온라인 상세', () => {
  it('카드 결제: orPyAm.totPyAm 금액 · orPymt 카드사 · 승인 시각', () => {
    const d = readDaisoDetail({ data: { or: { orNo: '2026102712345', orStsCdNm: '결제완료', orCnclDtm: null }, orPyAm: { totPyAm: 5000 }, orPymt: { pymtCdNm: '신용카드', credCoCdNm: '국민카드', pyApvDtm: '2026-10-27 10:00:00', pyAm: 5000, pyRctwUrl: 'https://x/y' } } });
    expect(d).toEqual({ found: true, card: true, cancelled: false, amount: 5000, paidAt: '2026-10-27 10:00:00', issuer: '국민카드' });
  });
  it('카드가 아니면 purchase 감 · 취소 표시 · 빈 응답은 found false', () => {
    expect(readDaisoDetail({ data: { or: { pyCmptDtm: '2026-10-27 09:59:30' }, orPyAm: { totPyAm: 3000 }, orPymt: { pymtCdNm: '다이소머니' } } })).toMatchObject({ card: false, amount: 3000, paidAt: '2026-10-27 09:59:30' });
    expect(readDaisoDetail({ data: { or: { orCnclDtm: '2026-10-28 01:00:00' }, orPyAm: { totPyAm: 3000 } } }).cancelled).toBe(true);
    expect(readDaisoDetail({ data: {} }).found).toBe(false);
  });
});

describe('다이소 매장', () => {
  const storeRow = (over: Record<string, unknown> = {}) => ({ ssNum: 'SS20261020001', saleDay: '20261020', saleTim: '153012', strNm: '강남점', salDiv: '91', saleAmt: 909, addTax: 91, ...over });
  it('목록 응답: data.orOffineList(API 철자) · hasNext · nextPageIndex', () => {
    expect(daisoStoreRows({ data: { orOffineList: [storeRow()], hasNext: true, nextPageIndex: 1 } })).toMatchObject({ rows: [{ ssNum: 'SS20261020001' }], hasNext: true, next: 1 });
    expect(daisoStoreRows({ data: { orOffineList: [], hasNext: false } })).toEqual({ rows: [], hasNext: false, next: null });
  });
  it('결제 금액 = saleAmt + addTax(실측 909 + 91 = 1,000) · 줄 → 목록 주문(주문번호 ssNum · saleDay+saleTim)', () => {
    expect(daisoStoreAmount(storeRow())).toBe(1000);
    expect(daisoStoreOrder(storeRow())).toMatchObject({ orderNo: 'SS20261020001', orderedAt: '2026-10-20 15:30:12', amount: 1000, seller: '다이소 강남점', kind: 'list', listKey: '2026-10-20 15:30|1000' });
    expect(daisoStoreOrder(storeRow({ saleTim: '1530' }))?.orderedAt).toBe('2026-10-20 15:30:00');
    expect(daisoStoreOrder(storeRow({ saleAmt: 0, addTax: 0 }))).toBeNull();
  });
  it('전자영수증: orMOfflineorVO + 승인 줄 → 카드 · 승인번호 · 사업자번호 · 세부 칸, 없으면 null', () => {
    const rc = readDaisoStoreReceipt({ data: { orMOfflineorVO: { saleDtm: '2026-10-20 15:30:12', saleAmt: 909, addTax: 91, cardAmt: 1000, cashAmt: 0, strNm: '강남점', bzmnNo: '123-45-67890', salDiv: '91' }, orDOfflineorVOList: [{ gdsNam: '수납함', saleQty: 1 }], orOfflineorApprVOList: [{ apprWay: '신용카드', apprAmt: 1000, apprYmd: '20261020', apprTm: '153012', apprNo: 'A12345', cardNm: '신한카드' }] } });
    expect(rc).toMatchObject({ card: true, cancelled: false, amount: 1000, paidAt: '2026-10-20 15:30:12', issuer: '신한카드', approval: 'A12345', businessNumber: '123-45-67890', seller: '다이소 강남점' });
    expect(rc?.detail).toEqual({ cardCompany: '신한카드', approvalNo: 'A12345', approvalAt: '2026-10-20 15:30:12', merchantName: '다이소 강남점', merchantBusinessNo: '123-45-67890', totalAmount: 1000, supplyAmount: 909, taxAmount: 91 });
    expect(readDaisoStoreReceipt({ data: { orMOfflineorVO: { saleAmt: 909, addTax: 91, cardAmt: 0, cashAmt: 1000, saleDtm: '2026-10-20 15:30:12' }, orOfflineorApprVOList: [] } })).toMatchObject({ card: false, amount: 1000 });
    expect(readDaisoStoreReceipt({ data: null })).toBeNull();
  });
});
