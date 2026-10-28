"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KURLY_DETAIL_SCRIPT = exports.MUSINSA_DETAIL_SCRIPT = exports.NAVER_PAY_DETAIL_SCRIPT = exports.NAVER_SHOP_DETAIL_SCRIPT = exports.DETAIL_BODY = void 0;
const common_1 = require("./common");
/**
 * 주문 상세 화면 읽기(영수증 한 장). 사이트마다 화면 구조를 확인하지 못해서 **글자 라벨 기반**으로 읽는다(전부 「가정」):
 * 화면의 글자 조각들을 순서대로 모은 뒤 「주문번호 · 결제일시/주문일시 · 실결제/최종결제/결제금액 · 결제수단 · 판매자/판매처/스토어 · 상품명」 라벨을 찾고,
 * 같은 조각 안의 「라벨: 값」 이나 바로 뒤 조각(최대 3개 안, 다른 라벨을 만나면 멈춤)을 값으로 쓴다. dt/dd · th/td · span 쌍 · 「라벨 값」 한 줄을 모두 받는다.
 * 배송지 · 수령인 · 연락처 같은 라벨은 값을 읽지 않고 「여기서 멈춘다」는 표시로만 쓴다.
 * 주문번호는 주소의 orderNo=… 나 마지막 숫자 경로도 대신 받고, 결제 일시는 화면 어디든 `20xx.MM.DD HH:mm(:ss)` 모양 첫 글자열도 대신 받는다. 금액은 라벨이 있을 때만 읽는다(추측하지 않음).
 */
const DETAIL_BODY = (defaultSeller) => String.raw `
var DEFAULT_SELLER=${JSON.stringify(defaultSeller ?? '')};
if(H.q('input[type="password"]')||/login|signin/i.test(String(location.pathname||'')))return {order:null,note:'login_needed'};
var L={
 orderNo:['주문번호','주문 번호'],
 at:['결제일시','결제 일시','결제일','주문일시','주문 일시','주문일자','주문일','결제완료일시'],
 amount:['실결제금액','실 결제금액','최종결제금액','최종 결제금액','총 결제금액','총결제금액','결제금액','결제 금액'],
 pay:['결제수단','결제 수단','결제방법','결제 방법'],
 seller:['판매자','판매처','스토어명','스토어','상호','가맹점','판매업체','브랜드'],
 title:['상품명','주문상품','주문 상품','상품정보','상품 정보']
};
var STOP=/^(주문\s?번호|주문\s?일시|주문\s?일자|주문일|결제\s?일시|결제\s?완료\s?일시|결제일|결제\s?수단|결제\s?방법|결제\s?금액|최종\s?결제\s?금액|실\s?결제\s?금액|총\s?결제\s?금액|판매자|판매처|스토어명?|상호|가맹점|판매업체|브랜드|상품명|주문\s?상품|상품\s?정보|배송지|배송\s?정보|수령인|받는\s?분|받는\s?사람|수취인|연락처|휴대폰|전화번호|주소|배송\s?메모|요청\s?사항)\s*[:：]?$/;
function collect(){
  var out=[];var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n;
  while((n=w.nextNode())&&out.length<2000){
    var p=n.parentElement;if(p&&/^(script|style|noscript|template)$/i.test(p.tagName))continue;
    var t=(n.nodeValue||'').replace(/\s+/g,' ').trim();if(t&&t.length<=300)out.push(t);
  }
  return out;
}
function hasContent(){var x=collect();return x.some(function(t){return /주문\s?번호|결제\s?금액|결제\s?일시|주문\s?일시/.test(t);});}
function valueFor(texts,labels,ok){
  for(var li=0;li<labels.length;li++){
    var lab=labels[li];
    for(var i=0;i<texts.length;i++){
      var t=texts[i];
      if(t===lab||t===lab+':'||t===lab+'：'){
        for(var j=i+1;j<Math.min(i+4,texts.length);j++){var v=texts[j];if(STOP.test(v))break;if(ok(v))return v;}
      }else if(t.indexOf(lab)===0){
        var rest=t.slice(lab.length).replace(/^\s*[:：]?\s*/,'');
        if(rest&&ok(rest))return rest;
      }
    }
  }
  return null;
}
return H.waitFor(hasContent,4000).then(function(){
  var texts=collect();
  if(texts.length===0)return {order:null,note:'no_detail_found'};
  var orderNo=valueFor(texts,L.orderNo,function(v){return /^[0-9A-Za-z\-]{6,40}$/.test(v)&&/\d/.test(v);});
  if(!orderNo){
    var q=String(location.search||'').match(/[?&](?:orderNo|order_no|orderId|orderid|ordNo|orderNumber)=([0-9A-Za-z\-]{6,40})/i);
    var pm=String(location.pathname||'').match(/\/(\d{8,24})(?:[\/?#]|$)/);
    orderNo=q?q[1]:(pm?pm[1]:null);
  }
  var at=valueFor(texts,L.at,function(v){return H.kst(v)!==null;});
  if(!at){var m=texts.join(' | ').match(/20\d{2}\s?[.\-\/]\s?\d{1,2}\s?[.\-\/]\s?\d{1,2}[^\d|]{0,3}\d{1,2}:\d{2}(?::\d{2})?/);at=m?m[0]:null;}
  var amount=valueFor(texts,L.amount,function(v){return /\d/.test(v)&&H.money(v)!=null;});
  var payment=valueFor(texts,L.pay,function(v){return v.length<=30&&!STOP.test(v);});
  var seller=valueFor(texts,L.seller,function(v){return v.length<=80&&!STOP.test(v);})||DEFAULT_SELLER||undefined;
  var title=valueFor(texts,L.title,function(v){return v.length<=200&&!STOP.test(v);});
  return {order:{orderNo:orderNo,orderedAt:at,amount:amount,seller:seller,title:title,payment:payment}};
});
`;
exports.DETAIL_BODY = DETAIL_BODY;
const detail = (site, defaultSeller) => (0, common_1.buildDetailScript)(site, (0, exports.DETAIL_BODY)(defaultSeller));
exports.NAVER_SHOP_DETAIL_SCRIPT = detail('naver_shop');
exports.NAVER_PAY_DETAIL_SCRIPT = detail('naver_pay');
exports.MUSINSA_DETAIL_SCRIPT = detail('musinsa');
exports.KURLY_DETAIL_SCRIPT = detail('kurly', '마켓컬리');
