/**
 * 올리브영 통합 시험 — 구동기 + 흐름(oliveyoungApiFlow) + 실제 웹뷰 스크립트(siteFetchScript: html · form · xhr 요청 포함)를 가짜 페이지(노드 vm · 가짜 fetch) 위에서 처음부터 끝까지 돌린다(틀은 e2eHarness.ts).
 * 태그 · 속성 · 응답 키 이름은 11-05 서버 크롬 실측(presets 21) 그대로, 값은 가짜. 확인: 이동(출처 한 번 + 카드마다 KSNET 화면) · 요청 순서 · 취소 제외 · 카드(KSNET 매출전표) · 현금영수증 · 매장 구매영수증 매핑 · 구조 기록 이름 · KSNET 실패 때 구매영수증으로.
 */
import { describe, expect, it } from 'vitest';
import { runFlow, type Reply, type Router } from './e2eHarness';
import { KSNET_JSON_URL, KSNET_VIEW_URL, OY_HOME_URL, OY_LOGIN_URL } from './oliveyoungApiFlow';
import { outcomeKey } from './runOutcome';

const pages = {
  'www.oliveyoung.co.kr/store/main/main.do': { text: '올리브영 홈' },
  'ksta.ksnet.co.kr/mint/tsk/pgi01/mad/pgimad19m1.jsp': { text: '일반영수증 카드매출전표' },
};
/** 로그인 화면 — 읽힌 뒤 사용자가 로그인하고 홈으로 돌아온 것으로 친다 */
const withLogin = { ...pages, 'www.oliveyoung.co.kr/store/login/loginform.do': { text: '올리브영 로그인', after: OY_HOME_URL } };
/** 비로그인 — JSON 자리에 로그인 화면 HTML 이 200 으로 온다(비밀번호 입력란) */
const LOGIN_HTML: Reply = { text: '<html><body><form action="/store/login/loginProc.do"><input type="text" name="loginId"><input type="password" name="password"></form></body></html>' };
const ON1 = 'O100000001';   // 카드(KSNET)
const ON2 = 'O100000002';   // 취소
const ON3 = 'O100000003';   // 현금영수증
const ST1 = 'S200000001';   // 매장
const T = (y: number, mo: number, d: number, h: number): number => Date.UTC(y, mo - 1, d, h - 9, 0, 0);   // 한국 시각 → 밀리초
const onlineRows = [
  { ordNo: ON1, ordGoodsSeq: 1, ordDtime: T(2026, 10, 27, 10), goodsNm: '립밤', itemNm: '01', ordQty: 1, cnclQty: 0, rtgsQty: 0, realQty: 1, salePrc: 12000, ordPrgsStatCd: '50', ordPrgsStatCdViewNm: '배송완료' },
  { ordNo: ON2, ordGoodsSeq: 1, ordDtime: T(2026, 10, 26, 12), goodsNm: '마스크', ordQty: 1, cnclQty: 1, rtgsQty: 0, realQty: 0, salePrc: 5000, ordPrgsStatCdViewNm: '주문취소' },
  { ordNo: ON3, ordGoodsSeq: 1, ordDtime: T(2026, 10, 25, 9), goodsNm: '토너', ordQty: 1, cnclQty: 0, rtgsQty: 0, realQty: 1, salePrc: 8000, ordPrgsStatCdViewNm: '배송완료' },
];
const DEAL_HTML = `<table><tbody>
<tr data-ord-no="${ON1}" data-goods-no="G1"><td>2026.10.27</td><td>립밤</td><td class="colorOrange"><strong>12,000</strong>원</td><td><button class="ButtonBasic" id="cardReceipt" data-shop-sys-no="ABC%3D" data-mers-no="M1" data-van-cd="02" data-pay-sct-cd="11" data-hash-value="h">카드영수증</button></td><td>-</td><td><button id="dealDetail">거래명세서</button></td></tr>
<tr data-ord-no="${ON3}" data-goods-no="G3"><td>2026.10.25</td><td>토너</td><td class="colorOrange"><strong>8,000</strong></td><td>-</td><td><button class="ButtonBasic" id="cashReceipt" data-cr-conf-no="C1" data-trade-dtime="20261025090000" data-van-cd="02" data-hash-value="h">현금영수증</button></td><td>-</td></tr>
</tbody></table>`;
const STORE_HTML = `<ul><li><p>2026.10.15</p><span>강남점</span><a href="#" class="btnDetail" data-oper-dt="20261015" data-origin-bizpl-cd="B1" data-pos-no="1" data-receipt-no="R1" data-deal-sp="D" data-frst-receipt-no="F1" onclick="goOrderDetail('${ST1}','Y'); return false;">상세</a><em><strong>매장구매완료</strong></em></li></ul>`;
const storeRows = [{ ordNo: ST1, ordDtime: T(2026, 10, 15, 14), strNm: '강남점', goodsNm: '마스크팩', totRealQty: 1, totSalePrc: 4500, ordPrgsStatCd: '60', ordPrgsStatCdViewNm: '매장구매완료', offlineOrderYn: 'Y' }];
const detailHtml = (total: string, pay: string): string => `<html><body><div class="pay"><dl><dt>총 결제금액</dt><dd><strong>${total}</strong>원</dd><dt>결제수단</dt><dd>${pay}</dd></dl></div></body></html>`;
const KS_VIEW_HTML = `<html><head><script>var param = { pg_deal_numb : '123456789012', screen : 'pgimad19m0' };</script></head><body>일반영수증</body></html>`;
const KS_JSON = { response_header: { result_code: '0', result_msg: '정상 처리되었습니다.' }, response_data: { pg_deal_numb: '123456789012', appr_numb: 'A777', appr_date: '20261027', appr_time: '100005', amount: '12000', svos: '10909', vat: '1091', card_numb: '1234****', make_comp_gove_name: '국민카드', canc_yn: 'N', shop_name: 'CJ올리브영주식회사', entr_numb: '809-81-01574' } };

type Call = { method: string; url: string; body?: string };
function server(over: Partial<{ ksView: Reply; ksJson: Reply }> = {}): { router: Router; calls: Call[] } {
  const calls: Call[] = [];
  const router: Router = (url, init) => {
    calls.push({ method: init.method ?? 'GET', url, body: init.body });
    const u = new URL(url);
    const p = u.pathname;
    const page = Number(u.searchParams.get('pageIdx') ?? '1');
    if (p.endsWith('/getOrderListJSON.do')) {
      if (u.searchParams.get('searchOrderType') === '20') return { json: page === 1 ? storeRows : [] };
      return { json: page === 1 ? onlineRows : [] };
    }
    if (p.endsWith('/getDealList.do')) return { text: DEAL_HTML };   // 2쪽도 같은 줄 → 새 줄 없음으로 멈춘다
    if (p.endsWith('/getOrderList.do')) return { text: STORE_HTML };
    if (p.endsWith('/getOrderDetail.do')) {
      const no = u.searchParams.get('ordNo');
      if (no === ON1) return { text: detailHtml('12,000', '국민카드 / 일시불(2026.10.27 10:00:05)') };
      if (no === ON3) return { text: detailHtml('8,000', '현금 (2026.10.25 09:00:10)') };
      return { status: 404, text: 'no' };
    }
    if (p.endsWith('/getOfflineOrderDetail.do')) return u.searchParams.get('ordNo') === `D${ST1}` && u.searchParams.get('operDt') === '20261015' ? { text: detailHtml('4,500', '신한카드') } : { status: 404, text: 'no' };
    if (url.startsWith(KSNET_VIEW_URL(''))) return over.ksView ?? { text: KS_VIEW_HTML };
    if (url === KSNET_JSON_URL) return over.ksJson ?? { json: KS_JSON };
    return { status: 404, text: 'nope' };
  };
  return { router, calls };
}

describe('올리브영 요청 흐름(통합)', () => {
  it('출처 한 번 → 온라인 JSON · 거래증빙 HTML · 매장 HTML+JSON · 상세 → 마지막에 카드마다 KSNET 화면 이동 + 원문 + 매출전표 JSON(폼) — 카드 · 현금영수증 · 매장 구매영수증', async () => {
    const { router, calls } = server();
    const r = await runFlow('oliveyoung', pages, router);
    expect(r.results[0]?.reason).toBe('all-rows');
    expect(r.gotos).toEqual([OY_HOME_URL, KSNET_VIEW_URL('ABC%3D')]);
    const paths = calls.map((c) => `${c.method} ${new URL(c.url).pathname}${/pageIdx=(\d+)/.test(c.url) ? `?p=${/pageIdx=(\d+)/.exec(c.url)![1]}` : ''}${c.url.includes('searchOrderType=20') ? '&store' : ''}`);
    expect(paths).toEqual([
      'GET /store/mypage/getOrderListJSON.do?p=1', 'GET /store/mypage/getOrderListJSON.do?p=2',
      'GET /store/mypage/getDealList.do?p=1', 'GET /store/mypage/getDealList.do?p=2',
      'GET /store/mypage/getOrderList.do&store', 'GET /store/mypage/getOrderListJSON.do?p=1&store', 'GET /store/mypage/getOrderListJSON.do?p=2&store',
      'GET /store/mypage/getOrderDetail.do', 'GET /store/mypage/getOrderDetail.do', 'GET /store/mypage/getOfflineOrderDetail.do',
      'GET /mint/tsk/pgi01/mad/pgimad19m1.jsp', 'POST /kfm/JsonChannelService.do',
    ]);
    // 날짜 칸은 YYYYMMDD · 1년
    expect(calls[0]!.url).toMatch(/searchMonth=-12&startDate=2025\d{4}&endDate=20261029&pageIdx=1$/);
    // KSNET JSON 은 폼 본문 param=<URL 인코딩 JSON>
    const ks = calls.find((c) => c.url === KSNET_JSON_URL)!;
    expect(ks.body?.startsWith('param=%7B')).toBe(true);
    expect(JSON.parse(decodeURIComponent(ks.body!.slice(6)))).toMatchObject({ request_header: { deal_code: 'S0PGIMAD19I001' }, request_data: { pg_deal_numb: '123456789012' } });
    // 목록 행 → 완성본
    expect(r.orders.filter((o) => o.kind === 'list').map((o) => [o.orderNo, o.amount])).toEqual([[ON1, 12000], [ON3, 8000], [ST1, 4500]]);
    const done = r.orders.filter((o) => o.kind !== 'list');
    expect(done.map((o) => [o.orderNo, o.kind, o.amount, o.payment, o.orderedAt, o.seller])).toEqual([
      [ON3, 'purchase', 8000, '현금영수증', '2026-10-25 09:00:10', '올리브영'],
      [ST1, 'purchase', 4500, '카드', '2026-10-15 14:00:00', '올리브영 강남점'],
      [ON1, 'card', 12000, '카드', '2026-10-27 10:00:05', '올리브영'],
    ]);
    expect(done[2]).toMatchObject({ approval: 'A777', cardIssuer: '국민카드', businessNumber: '809-81-01574', listKey: '2026-10-27 10:00|12000', detail: { cardCompany: '국민카드', approvalNo: 'A777', approvalAt: '2026-10-27 10:00:05', supplyAmount: 10909, taxAmount: 1091, totalAmount: 12000, merchantName: 'CJ올리브영주식회사', merchantBusinessNo: '809-81-01574' } });
    expect(done[0]!.detail).toMatchObject({ totalAmount: 8000, merchantName: '올리브영' });
    // 줄별 결과
    const last = new Map(r.outcomes.map((e) => [e.key, e.outcome]));
    expect(last.get(outcomeKey(ON2, '2026-10-26 12:00:00', 5000))).toEqual({ state: 'none', why: 'cancelled' });
    expect(last.get(outcomeKey(ON1, '2026-10-27 10:00:00', 12000))).toEqual({ state: 'done' });
    expect(last.get(outcomeKey(ST1, '2026-10-15 14:00:00', 4500))).toEqual({ state: 'done' });
    // 구조 기록 — 값 없이 이름만
    expect(r.structures.map((s) => s.where)).toEqual(['oy-online-list', 'oy-deal-list', 'oy-store-list', 'oy-store-json', 'oy-online-detail', 'oy-ksnet-slip']);
    expect(r.structures.flatMap((s) => s.lines).join('\n')).not.toMatch(/ABC%3D|A777|809-81-01574|123456789012/);
    expect(r.results[0]?.stats.reasons).toMatchObject({ 'online-rows': 3, 'deal-rows': 2, 'online-cancelled': 1, 'store-rows': 1, 'ksnet-cards': 1 });
  });

  it('KSNET 매출전표를 못 받으면(거래번호 없음 · JSON 오류) 상세의 총 결제금액으로 구매영수증을 만든다', async () => {
    const a = await runFlow('oliveyoung', pages, server({ ksView: { text: '<html>TRANS. NO. 없음</html>' } }).router);
    expect(a.orders.filter((o) => o.orderNo === ON1 && o.kind !== 'list').map((o) => [o.kind, o.amount, o.payment])).toEqual([['purchase', 12000, '카드']]);
    expect(a.results[0]?.stats.reasons).toMatchObject({ 'ksnet-no-dealno': 1 });
    const b = await runFlow('oliveyoung', pages, server({ ksJson: { json: { response_header: { result_code: '9' } } } }).router);
    expect(b.orders.filter((o) => o.orderNo === ON1 && o.kind !== 'list').map((o) => o.kind)).toEqual(['purchase']);
    expect(b.results[0]?.stats.reasons).toMatchObject({ 'ksnet-json-code-9': 1 });
  });

  it('이미 서버에 있는 주문은 건너뛰고 · onlyKeys 면 그 줄만', async () => {
    const a = await runFlow('oliveyoung', pages, server().router, {}, { orderNos: [ON1, ST1] });
    expect(a.orders.filter((o) => o.kind !== 'list').map((o) => o.orderNo)).toEqual([ON3]);
    expect(a.gotos).toEqual([OY_HOME_URL]);
    const b = await runFlow('oliveyoung', pages, server().router, { onlyKeys: [outcomeKey(ON1, '2026-10-27 10:00:00', 12000)] });
    expect(b.orders.map((o) => [o.orderNo, o.kind])).toEqual([[ON1, 'card']]);
  });

  it('비로그인이면 목록 JSON 자리에 로그인 화면이 오거나 로그인 주소로 되돌려진다 — 로그인 화면으로 보내고, 로그인 뒤 끝까지 읽는다(1.2.3, 대표님 11-05 18:06)', async () => {
    for (const first of [LOGIN_HTML, { redirected: true, url: OY_LOGIN_URL, text: '' } as Reply]) {
      let seen = false;
      const base = server();
      const router: Router = (url, init) => { if (!seen && url.includes('/getOrderListJSON.do')) { seen = true; return first; } return base.router(url, init); };
      const r = await runFlow('oliveyoung', withLogin, router);
      expect(r.gotos.slice(0, 2)).toEqual([OY_HOME_URL, OY_LOGIN_URL]);
      expect(r.results[0]?.reason).toBe('all-rows');
      expect(r.orders.filter((o) => o.kind !== 'list').map((o) => o.orderNo).sort()).toEqual([ON1, ON3, ST1].sort());
    }
  }, 120000);

  it('로그인 화면으로 보냈는데 사용자가 로그인하지 않으면 끝내지 않고 기다린다', async () => {
    const router: Router = () => LOGIN_HTML;
    const r = await runFlow('oliveyoung', { ...pages, 'www.oliveyoung.co.kr/store/login/loginform.do': { text: '올리브영 로그인' } }, router);
    expect(r.gotos).toEqual([OY_HOME_URL, OY_LOGIN_URL]);
    expect(r.results).toHaveLength(0);
  }, 60000);
});
