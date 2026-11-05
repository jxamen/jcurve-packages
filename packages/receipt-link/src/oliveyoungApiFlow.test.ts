/**
 * 올리브영 흐름 — HTML · JSON 읽기(순수 함수) 시험. 태그 · 속성 이름은 11-05 서버 크롬 실측(presets 21) 그대로, 값은 가짜.
 */
import { describe, expect, it } from 'vitest';
import { htmlText, ksnetBody, ksnetDealNumb, oyDealRows, oyGroups, oyStoreRows, oyTotal, readKsnetSlip } from './oliveyoungApiFlow';

const DEAL_HTML = `<table><tbody>
<tr data-ord-no="O100000001" data-goods-no="G1"><td>2026.10.27</td><td>립밤</td><td class="colorOrange"><strong>12,000</strong>원</td>
<td><button type="button" class="ButtonBasic" id="cardReceipt" data-shop-sys-no="ABC%3D" data-mers-no="M1" data-van-cd="02" data-pay-sct-cd="11" data-hash-value="h">카드영수증</button></td><td>-</td><td><button id="dealDetail">거래명세서</button></td></tr>
<tr data-ord-no="O100000003" data-goods-no="G3"><td>2026.10.25</td><td>토너</td><td class="colorOrange"><strong>8,000</strong></td>
<td>-</td><td><button class="ButtonBasic" id="cashReceipt" data-cr-conf-no="C1" data-trade-dtime="20261025100000" data-van-cd="02" data-hash-value="h">현금영수증</button></td><td>-</td></tr>
<tr><td>머리글 줄(주문번호 없음)</td></tr>
</tbody></table>`;

const STORE_HTML = `<ul><li class="order"><p>2026.10.15</p><span>강남점</span><span>마스크팩</span>
<a href="#" class="btn btnDetail" data-oper-dt="20261015" data-origin-bizpl-cd="B1" data-pos-no="1" data-receipt-no="R1" data-deal-sp="D" data-frst-receipt-no="F1" onclick="goOrderDetail('S200000001','Y'); return false;">상세보기</a>
<em><strong>매장구매완료</strong></em></li>
<li><a class="btnDetail" onclick="goOrderDetail('O100000001','')">온라인 주문 상세</a><strong>배송완료</strong></li></ul>`;

describe('올리브영 거래증빙서류 HTML', () => {
  it('tr[data-ord-no] 마다 총 결제금액 · 카드(data-van-cd · data-shop-sys-no) · 현금(data-cr-conf-no)', () => {
    const rows = oyDealRows(DEAL_HTML);
    expect(rows).toEqual([
      { ordNo: 'O100000001', total: 12000, card: true, vanCd: '02', shopSysNo: 'ABC%3D', paySctCd: '11', cash: false, crConfNo: '' },
      { ordNo: 'O100000003', total: 8000, card: false, vanCd: '', shopSysNo: '', paySctCd: '', cash: true, crConfNo: 'C1' },
    ]);
    expect(oyDealRows('<html></html>')).toEqual([]);
  });
});

describe('올리브영 매장 목록 HTML', () => {
  it('a.btnDetail 마다 goOrderDetail(주문번호, Y) · data-* 상세 칸 · 같은 토막의 상태 글자', () => {
    const rows = oyStoreRows(STORE_HTML);
    expect(rows).toEqual([
      { ordNo: 'S200000001', store: true, operDt: '20261015', originBizplCd: 'B1', posNo: '1', receiptNo: 'R1', dealSp: 'D', frstReceiptNo: 'F1', status: '매장구매완료' },
      { ordNo: 'O100000001', store: false, operDt: '', originBizplCd: '', posNo: '', receiptNo: '', dealSp: '', frstReceiptNo: '', status: '배송완료' },
    ]);
  });
});

describe('올리브영 상세 글자 · KSNET', () => {
  it('「총 결제금액 N」 · 결제수단 줄 시각(YYYY.MM.DD HH:MM:SS) · 결제수단 이름', () => {
    const html = '<div class="pay"><dl><dt>총 상품금액</dt><dd>13,000</dd><dt>쿠폰할인금액</dt><dd>1,000</dd><dt>총 결제금액</dt><dd><strong>12,000</strong>원</dd><dt>결제수단</dt><dd>국민카드 / 일시불(2026.10.27 10:00:05)</dd></dl></div>';
    expect(oyTotal(html)).toEqual({ total: 12000, paidAt: '2026-10-27 10:00:05', method: '국민카드 / 일시불' });
    expect(oyTotal('<p>결제 정보 없음</p>')).toEqual({});
    expect(htmlText('<script>var a = "총 결제금액 1";</script><b>안녕</b>&amp;<i> 세계 </i>')).toBe('안녕 & 세계');
  });
  it('매출전표 화면 원문의 pg_deal_numb · JSON 본문은 param= 뒤 URL 인코딩(대표님 본문 그대로)', () => {
    expect(ksnetDealNumb("<script>var p = { pg_deal_numb : '123456789012', x: 1 };</script>")).toBe('123456789012');
    expect(ksnetDealNumb('<p>TRANS. NO. 123456789012</p>')).toBeNull();
    const body = ksnetBody('123456789012');
    expect(body.startsWith('param=%7B')).toBe(true);
    expect(JSON.parse(decodeURIComponent(body.slice(6)))).toEqual({ request_header: { deal_code: 'S0PGIMAD19I001', screen_id: 'pgimad19m0', requ_trm_sele_code: 'S', ssgbcd: 'A', non_certi_deal_yn: 'Y', file_proc_gbcd: null, tp_node_code: null, syst_code: 'PGI01', cross_domain_yn: 'N' }, request_data: { pg_deal_numb: '123456789012' } });
  });
  it('매출전표 JSON: result_code 0 · 승인번호 · 승인 일시(appr_date+appr_time) · 금액 · 카드사 · 상점 · 사업자번호 · 취소', () => {
    const slip = readKsnetSlip({ response_header: { result_code: '0', result_msg: '정상 처리되었습니다.' }, response_data: { pg_deal_numb: '123456789012', appr_numb: 'A777', appr_date: '20261027', appr_time: '100005', amount: '12000', svos: '10909', vat: '1091', card_numb: '1234****', make_comp_gove_name: '국민카드', canc_yn: 'N', shop_name: 'CJ올리브영주식회사', entr_numb: '809-81-01574' } });
    expect(slip).toEqual({ ok: true, code: '0', approval: 'A777', paidAt: '2026-10-27 10:00:05', amount: 12000, supply: 10909, tax: 1091, issuer: '국민카드', merchant: 'CJ올리브영주식회사', businessNumber: '809-81-01574', cancelled: false });
    expect(readKsnetSlip({ response_header: { result_code: '9' } })).toMatchObject({ ok: false, code: '9' });
    expect(readKsnetSlip({ response_header: { result_code: '0' }, response_data: { canc_yn: 'Y', amount: 1 } }).cancelled).toBe(true);
  });
});

describe('올리브영 상품 줄 묶기', () => {
  const T = Date.UTC(2026, 9, 27, 1, 0, 0);
  it('ordNo 로 묶고 날짜(ordDtime ms → 한국 시각) · 제목 · 매장 · 금액 합 · 취소 규칙(상태 글자 또는 모든 줄 realQty 0 + 취소/반품 수량)', () => {
    const g = oyGroups([
      { ordNo: 'O100000001', ordGoodsSeq: 1, ordDtime: T, goodsNm: '립밤', realQty: 1, salePrc: 12000, ordPrgsStatCdViewNm: '배송완료' },
      { ordNo: 'O100000001', ordGoodsSeq: 2, ordDtime: T, goodsNm: '토너', realQty: 1, salePrc: 3000, ordPrgsStatCdViewNm: '배송완료' },
      { ordNo: 'O100000002', ordGoodsSeq: 1, ordDtime: T, goodsNm: '마스크', realQty: 0, cnclQty: 1, ordQty: 1, salePrc: 5000, ordPrgsStatCdViewNm: '배송완료' },
      { ordNo: 'O100000004', ordGoodsSeq: 1, ordDtime: T, goodsNm: '선크림', realQty: 1, salePrc: 9000, ordPrgsStatCdViewNm: '주문취소' },
      { ordNo: 'S200000001', ordDtime: T, strNm: '강남점', goodsNm: '마스크팩', totSalePrc: 4500, ordPrgsStatCdViewNm: '매장구매완료' },
      { ordNo: 'bad' },
    ]);
    expect(g.map((x) => [x.ordNo, x.cancelled, x.orderedAt, x.title, x.amount, x.seller])).toEqual([
      ['O100000001', false, '2026-10-27 10:00:00', '립밤 외 1건', 15000, undefined],
      ['O100000002', true, '2026-10-27 10:00:00', '마스크', 5000, undefined],
      ['O100000004', true, '2026-10-27 10:00:00', '선크림', 9000, undefined],
      ['S200000001', false, '2026-10-27 10:00:00', '마스크팩', 4500, '올리브영 강남점'],
    ]);
  });
});
