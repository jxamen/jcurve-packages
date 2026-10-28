"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUSINSA_SCRIPT = exports.MUSINSA_BODY = exports.MUSINSA_URL = void 0;
const common_1 = require("./common");
/**
 * 무신사 주문내역 목록. 출처: 사용자 지정 주소. 공개 페이지 본문은 확인되지 않음(WebFetch 가 제목만 돌려줌) — 아래 본문의 모든 선택자는 "assumed — defensive fallback".
 * 로그아웃 시 동작: 공개 근거 없음 — 본문은 로그인 페이지 경로(/login)나 비밀번호 입력칸을 보면 login_needed 로 끝낸다(assumed).
 */
exports.MUSINSA_URL = 'https://www.musinsa.com/order/order-list';
/**
 * 본문(BODY)은 (state, H) 를 받는 함수 몸통. 무신사 내부 JSON 엔드포인트는 공개 근거가 없어 쓰지 않는다(확인되면 1단계로 추가).
 * 1) DOM: data-order-no / 주문상세 링크(orderNo= 또는 /order-detail/<no>) — assumed
 * 2) 글자 패턴: 「주문번호 …」 · 「20xx.MM.DD」 · 「결제금액 N,NNN원」 · 첫 「N,NNN원」 — assumed
 * 3) 더보기 버튼 반복 클릭, 가장 오래된 행이 30일 밖이면 멈춤.
 * 취소완료 · 반품완료 · 환불완료 가 붙은 행은 건너뛴다.
 * 개인정보: 행 글자는 정규식으로만 읽고 저장하지 않는다. 보내는 칸은 여섯 개뿐(틀이 거른다).
 */
exports.MUSINSA_BODY = String.raw `
var P=String(location.pathname||'');
var pw=H.q('input[type="password"]');
var loginForm=H.q('form[action*="login"]');
if(pw||loginForm||/\/login/i.test(P)) return {orders:[],done:true,note:'login_needed'};
if(!/order/i.test(P)) return {orders:[],done:true,note:'wrong_page'};

var ROW_SEL='[data-order-no],[data-orderno],[data-order-number],[class*="OrderItem"],[class*="order-item"],[class*="OrderList"] li,li[class*="order"]';
var BRAND_SEL='[data-brand-name],[data-brand],[class*="brand"],[class*="Brand"]';
var NAME_SEL='[data-goods-name],[data-product-name],[class*="goods-name"],[class*="GoodsName"],[class*="product-name"],[class*="ProductName"]';
var SKIP_RE=/(취소|반품|환불)\s*완료|전체\s*(취소|환불)/;
var DATE_RE=/(20\d{2})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})(?:[^\d]{1,8}(\d{1,2}):(\d{2}))?/;

function rowsOf(){
  var all=H.qa(ROW_SEL);
  if(all.length) return all.filter(function(el){return !all.some(function(o){return o!==el&&o.contains(el);});});
  var c=H.qa('li,article,tr,div,section').filter(function(el){var t=H.text(el);return t.length>10&&t.length<900&&DATE_RE.test(t)&&/\d\s*원/.test(t);});
  return c.filter(function(el){return !c.some(function(o){return o!==el&&el.contains(o);});});
}

function parseRow(el){
  var t=H.text(el);
  var no=el.getAttribute('data-order-no')||el.getAttribute('data-orderno')||el.getAttribute('data-order-number')||'';
  if(!no){
    var links=H.qa('a[href]',el);
    for(var i=0;i<links.length&&!no;i++){
      var href=String(links[i].getAttribute('href')||'');
      var m=href.match(/[?&](?:orderNo|order_no|orderno)=([0-9A-Za-z_-]{4,40})/i)||href.match(/\/order(?:-detail)?\/([0-9A-Za-z_-]{6,40})/i);
      if(m) no=m[1];
    }
  }
  if(!no){var m2=t.match(/주문\s*번호\s*:?\s*([0-9A-Za-z_-]{6,40})/); if(m2) no=m2[1];}
  var d=t.match(DATE_RE);
  var at=d?H.kst(d[1]+'.'+d[2]+'.'+d[3]+(d[4]?' '+d[4]+':'+d[5]:'')):null;
  var am=t.match(/결제\s*금액\s*:?\s*([\d,]+)\s*원/);
  var amount=am?H.money(am[1]):null;
  var labeled=amount!=null;
  if(amount==null){var a2=t.match(/([\d,]+)\s*원/); if(a2) amount=H.money(a2[1]);}
  var br=el.querySelector(BRAND_SEL), nm=el.querySelector(NAME_SEL);
  var pay=t.match(/(신용카드|체크카드|무통장입금|계좌이체|가상계좌|네이버페이|카카오페이|토스페이|간편결제)/);
  return {orderNo:no,orderedAt:at,amount:amount,labeled:labeled,seller:br?H.text(br):undefined,title:nm?H.text(nm):undefined,payment:pay?pay[1]:undefined,skip:SKIP_RE.test(t)};
}

function build(){
  var els=rowsOf();
  if(!els.length) return null;
  var byNo={},out=[],parsed=els.map(parseRow),dates={};
  parsed.forEach(function(r){if(r.orderNo&&r.orderedAt&&!dates[r.orderNo])dates[r.orderNo]=r.orderedAt;});
  parsed.forEach(function(r){
    if(r.orderNo&&!r.orderedAt) r.orderedAt=dates[r.orderNo]||null;
    if(!r.orderNo||r.skip||!r.orderedAt||r.amount==null) return;
    var o=byNo[r.orderNo];
    if(!o){o=byNo[r.orderNo]={orderNo:r.orderNo,orderedAt:r.orderedAt,amount:0,seller:r.seller,title:r.title,payment:r.payment,_lab:false};out.push(o);}
    if(r.labeled){o.amount=r.amount;o._lab=true;}
    else if(!o._lab){o.amount+=r.amount;}
    if(!o.title&&r.title) o.title=r.title;
    if(!o.seller&&r.seller) o.seller=r.seller;
    if(!o.payment&&r.payment) o.payment=r.payment;
  });
  return out.map(function(o){return {orderNo:o.orderNo,orderedAt:o.orderedAt,amount:o.amount,seller:o.seller,title:o.title,payment:o.payment};});
}

function moreBtn(){
  var bs=H.qa('button,a');
  for(var i=0;i<bs.length;i++){var t=H.text(bs[i]); if(t.length<12&&/더\s*보기/.test(t)) return bs[i];}
  return null;
}
function finish(){
  var o=build();
  if(o==null) return {orders:[],done:true,note:'no_list_found'};
  return {orders:o,done:true};
}
function step(n){
  var rows=rowsOf().map(parseRow);
  var passedWindow=rows.some(function(r){return r.orderedAt&&!H.recent(r.orderedAt);});
  var b=moreBtn();
  if(passedWindow||!b||n>=30) return finish();
  var before=rowsOf().length;
  b.click();
  return H.waitFor(function(){return rowsOf().length>before;},5000).then(function(v){return v?step(n+1):finish();});
}
return step(0);
`;
exports.MUSINSA_SCRIPT = (0, common_1.buildScript)('musinsa', exports.MUSINSA_BODY);
