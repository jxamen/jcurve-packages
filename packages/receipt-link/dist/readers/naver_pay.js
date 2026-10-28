"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NAVER_PAY_SCRIPT = exports.NAVER_PAY_URL = void 0;
/**
 * 네이버페이 결제내역 읽기 스크립트 (naver_pay).
 *
 * 근거 표시 규칙: 「확인」은 공개 자료로 실제 확인한 것, 「가정」은 확인하지 못해 방어용으로 둔 것이다.
 *  - 진입 URL https://pay.naver.com/pc/history : 가정 (앱 요청서가 준 주소. 공개 검색에서 이 경로를 실제로 확인하지 못함.
 *    한 한국어 고객지원 글은 모바일 결제내역을 new-m.pay.naver.com/pcpay?page=1 로 안내함 — 확인 아님, 참고만).
 *  - 구매자용 결제내역 JSON 엔드포인트 : 가정 없음. 공개 자료에서 찾지 못했다(네이버페이 공개 API 문서는 가맹점용 주문·정산 API뿐).
 *    그래서 이 읽기는 JSON을 부르지 않고 DOM 과 글자 패턴만 쓴다.
 *  - 로그인 안 됨 : 가정 — 로그인 페이지가 nid.naver.com 으로 넘어가는 것을 가정. 「nidlogin」 로그인 링크도 힌트로 본다.
 *  - 행(row) 찾기 : 가정 — 「날짜 + N원 금액」이 함께 든 가장 안쪽 요소를 한 건으로 본다. 특정 클래스 이름에 기대지 않는다.
 *  - 「더보기」 버튼 : 가정 — 글자가 「더보기」로 시작하는 버튼/링크를 다음 쪽으로 본다.
 *  - 주문번호 : 가정 — 행 글자에 「주문번호」 라벨 뒤 10~24자리 숫자가 있을 때 그 숫자를 쓴다(네이버쇼핑 주문번호와 같은 것이어야 한다).
 *    없으면 그 행을 버린다(결제번호로 대신하면 네이버 쇼핑과 번호가 달라 같은 주문이 두 번 적립될 수 있다 — 10-28 결정, 필요하면 앱보조5 가 되돌릴 수 있다).
 *  - 금액 : 가정 — 「실결제금액 / 결제금액 / 총 결제」 라벨 뒤 첫 금액, 없으면 행의 첫 「N원」.
 *  - 취소·환불 행 : 행 글자에 「취소」「환불」이 있으면 건너뛴다(확인 아님, 방어 규칙).
 *  - 판매처·상품명 : 가정 — 행 안 잎 요소 글자 중 날짜·금액·라벨·개인정보 같지 않은 첫 두 개.
 *
 * 개인정보: 여섯 칸만 만든다. 수령인·주소·연락처·카드번호·이메일 이 붙은 잎 요소는 라벨(바로 앞 형제) 또는 글자 패턴으로 버린다.
 *
 * 출력 note 코드: login_needed · wrong_page · no_list_found · error (fetch_failed 는 이 읽기가 fetch 를 쓰지 않아 나오지 않는다).
 */
const common_1 = require("./common");
exports.NAVER_PAY_URL = 'https://pay.naver.com/pc/history';
const BODY = String.raw `
var host = String(location.hostname || '');
if (/^nid\.naver\.com$/.test(host)) return {orders: [], done: true, note: 'login_needed'};
if (!/(^|\.)pay\.naver\.com$/.test(host)) return {orders: [], done: true, note: 'wrong_page'};

var DATE_RE = /20\d{2}\s?[.\-\/년]\s?\d{1,2}\s?[.\-\/월]\s?\d{1,2}|\b\d{1,2}\.\s?\d{1,2}(?![\d,])/;
var PRIV = /수령|받는\s?분|받는\s?사람|배송지|주소|연락|전화|휴대|이메일|e-?mail|카드\s?번호|\*{3,}|@|\d{2,4}-\d{3,4}-\d{3,4}|\d{7,}/i;
var LABEL = /주문\s?번호|결제\s?번호|결제|상세|영수증|더보기|취소|환불|구매확정|리뷰|배송|포인트|머니|카드|계좌|원$|^\d|^[\d.:,\s]+$/;

function isRowCand(el){
  var t = H.text(el);
  return t.length >= 8 && t.length <= 900 && DATE_RE.test(t) && /\d\s?원/.test(t);
}
function rowsOf(){
  var all = H.qa('li, tr, article, div', document.body).filter(isRowCand);
  return all.filter(function(a){ return !all.some(function(b){ return b !== a && a.contains(b); }); });
}
function loginHint(){
  return /nid\.naver\.com|\/login/i.test(String(location.href || '')) || !!H.q('a[href*="nidlogin"], form[action*="nidlogin"]');
}
function leaves(el){
  var out = [];
  H.qa('*', el).forEach(function(c){
    if (c.children && c.children.length) return;
    var t = H.text(c);
    if (t) out.push({t: t, el: c});
  });
  return out;
}
function okSeg(c){
  var t = c.t;
  if (t.length < 2 || t.length > 60) return false;
  if (PRIV.test(t) || LABEL.test(t)) return false;
  var prev = c.el.previousElementSibling;
  if (prev && PRIV.test(H.text(prev))) return false;
  return true;
}
function extract(el){
  var t = H.text(el);
  if (/취소|환불/.test(t)) return null;
  var dm = t.match(/20\d{2}\s?[.\-\/년]\s?\d{1,2}\s?[.\-\/월]\s?\d{1,2}/) || t.match(/\b\d{1,2}\.\s?\d{1,2}(?![\d,])/);
  if (!dm) return null;
  var tm = t.match(/\d{1,2}:\d{2}/);
  var orderedAt = H.kst(dm[0] + (tm ? ' ' + tm[0] : ''));
  if (!orderedAt) return null;
  var am = t.match(/(?:실결제(?:\s?금액)?|결제\s?금액|총\s?결제(?:\s?금액)?)\D{0,8}?(\d{1,3}(?:,\d{3})+|\d+)\s?원/) || t.match(/(\d{1,3}(?:,\d{3})+|\d+)\s?원/);
  var amount = am ? H.money(am[1]) : null;
  if (amount == null) return null;
  var om = t.match(/주문\s?번호\D{0,10}?(\d{10,24})/);
  var orderNo = om ? om[1] : null;   // 결제번호로 대신하지 않는다: 네이버 쇼핑과 같은 주문이 다른 번호로 나가 두 번 적립될 수 있다(앱보조5 요구: 같은 주문은 같은 번호)
  if (!orderNo) return null;
  var segs = leaves(el).filter(okSeg);
  var pay = t.match(/신용카드|체크카드|카드|계좌이체|휴대폰|무통장|네이버\s?페이\s?포인트|네이버\s?포인트|네이버\s?머니|포인트|머니/);
  var out = {orderNo: orderNo, orderedAt: orderedAt, amount: amount};
  if (segs[0]) out.seller = segs[0].t;
  if (segs[1]) out.title = segs[1].t;
  if (pay) out.payment = pay[0].replace(/\s/g, '');
  return out;
}
function moreBtn(){
  var bs = H.qa('button, a, [role="button"]', document.body);
  for (var i = 0; i < bs.length; i++) {
    var b = bs[i];
    if (/^더보기/.test(H.text(b)) && !b.disabled && b.getAttribute('aria-disabled') !== 'true') return b;
  }
  return null;
}
function rowsNow(){
  var out = [];
  rowsOf().forEach(function(el){ var r = extract(el); if (r) out.push(r); });
  return out;
}

state.pages = state.pages || 0;
return H.waitFor(function(){ return rowsOf().length ? true : null; }, 6000).then(function(ok){
  if (!ok) return {orders: [], done: true, note: loginHint() ? 'login_needed' : 'no_list_found'};
  var rows = rowsNow();
  var allOld = rows.length > 0 && rows.every(function(r){ return !H.recent(r.orderedAt); });
  var more = moreBtn();
  if (!more || allOld || state.pages >= 10) return {orders: rows, done: true};
  var before = rowsOf().length;
  state.pages += 1;
  more.click();
  return H.waitFor(function(){ return rowsOf().length > before ? true : null; }, 1500).then(function(grew){
    return {orders: rows, done: !grew};
  });
});
`;
exports.NAVER_PAY_SCRIPT = (0, common_1.buildScript)('naver_pay', BODY);
