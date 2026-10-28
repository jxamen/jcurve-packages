/**
 * 마켓컬리 주문내역 읽기 스크립트 (kurly). 본문은 `(state, H)` 를 받는 함수 몸통이고 buildScript 틀이 감싼다.
 *
 * 증거 등급 (공개 자료 조사 결과, 2026-10-28):
 *  - 페이지 URL https://www.kurly.com/mypage/order : 「마이컬리 > 주문내역」 메뉴가 있다는 것은 고객센터 정책 문구에서 확인(confirmed, kurly.com 고객센터 문구).
 *    그 외 URL 구조(/mypage/order 경로 자체)는 assumed — 공개 자료로 직접 확인하지 못함.
 *  - 페이지 HTML / __NEXT_DATA__ / 청크 이름 / api.kurly.com 주문 엔드포인트 : 공개 자료에서 확인 못 함(assumed).
 *    WebFetch 로 받은 본문에는 script 태그도, api.kurly.com 경로도 없었다(페이지 본문 텍스트만 받음).
 *    공개 검색으로 찾은 api.kurly.com 은 상품 검색/상품 조회 용도(Apify 액터, k-skill 프로젝트)뿐, 주문내역 API 는 찾지 못함.
 *    그래서 이 파일은 JSON API 층을 쓰지 않고 DOM + 글자 패턴만 쓴다. 나중에 실물로 확인된 JSON 이 있으면 층을 추가할 것.
 *  - 「상품명 외 N건」 표기 : 사용자 지시서에 적힌 대로 가정(assumed, 지시 문구). 공개 자료로는 확인 못 함.
 *  - 「주문번호」「주문일」「결제금액」 라벨 : assumed — 공개 자료로 확인 못 함. 라벨 글자 자체를 기준으로 한 글자 패턴 방식이다.
 *  - 「더보기」 버튼 : assumed.
 *  - 주문 목록 = 최신순 정렬 : assumed (그래서 마지막 카드가 30일을 넘으면 더 안 읽는다).
 *  - 로그아웃 시 동작 : 공개 자료로 확인 못 함(assumed). 로그인 경로(/login 등)나 password 입력칸이 보이면 login_needed 로 본다.
 *
 * 개인정보: 정규식으로 뽑은 여섯 칸만 만든다. 카드 전체 글자를 밖으로 내보내지 않는다. 수취인·주소·전화·카드번호는 읽지 않는다.
 * 주문취소(주문취소 · 취소완료 · 결제취소 글자가 상태 칸에 있는 주문)는 건너뛴다. 버튼 글자 「주문취소」는 상태가 아니므로 버튼을 떼어낸 뒤 본다.
 */
import { buildScript } from './common';

export const KURLY_URL = 'https://www.kurly.com/mypage/order';

export const KURLY_BODY = String.raw`
function rd(el){return H.text(el);}
function cnt(t){var m=(t||'').match(/주문번호\s*[:：]?\s*[0-9A-Za-z-]{6,30}/g);return m?m.length:0;}
// 「주문번호」 글자가 정확히 한 번 들어 있는 가장 작은 요소를 찾고, 그 위로 올라가며 주문번호가 하나인 가장 큰 상자를 카드로 본다.
function findCards(){
  var res=[];
  H.qa('body *').forEach(function(el){
    if(cnt(el.textContent)!==1)return;
    var kids=el.children||[];
    for(var i=0;i<kids.length;i++){if(cnt(kids[i].textContent)===1)return;}
    var card=el;
    while(card.parentElement&&cnt(card.parentElement.textContent)===1)card=card.parentElement;
    if(res.indexOf(card)<0)res.push(card);
  });
  return res;
}
function orderDate(t){
  var m=t.match(/주문일[^\d]{0,8}(20\d{2}[.\-]\d{1,2}[.\-]\d{1,2})(?:[^\d]{0,4}(\d{1,2}:\d{2}))?/)||t.match(/(20\d{2}[.\-]\d{1,2}[.\-]\d{1,2})(?:[^\d]{0,4}(\d{1,2}:\d{2}))?/);
  if(!m)return null;
  return H.kst(m[1]+(m[2]?' '+m[2]:''));
}
function parseCard(card){
  var t=rd(card);
  var no=t.match(/주문번호\s*[:：]?\s*([0-9A-Za-z-]{6,30})/);
  if(!no)return {skip:'no_no'};
  var clone=card.cloneNode(true);
  H.qa('button,a,input,select,textarea,[role="button"]',clone).forEach(function(n){if(n.parentNode)n.parentNode.removeChild(n);});
  if(/주문취소|취소완료|결제취소/.test(rd(clone)))return {skip:'cancelled'};
  var am=t.match(/결제금액\s*[:：]?\s*([\d,]+)\s*원?/);
  if(!am)return {skip:'no_amount'};
  var at=orderDate(t);
  if(!at)return {skip:'no_date'};
  var out={orderNo:no[1],orderedAt:at,amount:H.money(am[1]),seller:'마켓컬리'};
  var tEl=H.qa('*',card).filter(function(e){
    return /외\s*\d+\s*건/.test(rd(e))&&!Array.prototype.some.call(e.children||[],function(k){return /외\s*\d+\s*건/.test(rd(k));});
  })[0];
  if(tEl){var tm=rd(tEl).match(/^([\s\S]+?)\s*외\s*\d+\s*건\s*$/);if(tm)out.title=tm[1];}
  var pm=t.match(/(신용카드|체크카드|카카오페이|네이버페이|토스페이|삼성페이|애플페이|휴대폰결제|계좌이체|무통장입금)/);
  if(pm)out.payment=pm[1];
  return {row:out};
}
function lastDate(list){for(var i=list.length-1;i>=0;i--){var d=orderDate(rd(list[i]));if(d)return d;}return null;}
function isEmptyText(){return /주문내역이\s*없|주문\s*내역이\s*없/.test(rd(document.body));}
function hasLoginForm(){return H.qa('input').some(function(i){return i.type==='password';});}
function run(){
  var list=findCards();
  var orders=[];
  list.forEach(function(c){var r=parseCard(c);if(r.row)orders.push(r.row);});
  var ld=lastDate(list);
  var older=!!ld&&!H.recent(ld);
  var more=H.qa('button,a').filter(function(b){return /^\s*더보기\s*$/.test(rd(b));})[0];
  if(!older&&more&&(state.clicks||0)<30){
    state.clicks=(state.clicks||0)+1;
    var before=list.length;
    more.click();
    return H.waitFor(function(){return findCards().length>before||null;},4000).then(function(v){return {orders:orders,done:!v};});
  }
  return {orders:orders,done:true};
}
var path=(window.location&&window.location.pathname)||'';
if(/\/login|\/signin/i.test(path))return {orders:[],done:true,note:'login_needed'};
if(findCards().length===0){
  if(isEmptyText())return {orders:[],done:true};
  if(hasLoginForm()&&!/주문번호/.test(rd(document.body)))return {orders:[],done:true,note:'login_needed'};
  return H.waitFor(function(){return findCards().length||null;},2500).then(function(v){
    if(v)return run();
    if(isEmptyText())return {orders:[],done:true};
    if(hasLoginForm())return {orders:[],done:true,note:'login_needed'};
    if(!/mypage/i.test(path))return {orders:[],done:true,note:'wrong_page'};
    return {orders:[],done:true,note:'no_list_found'};
  });
}
return run();
`;

export const KURLY_SCRIPT = buildScript('kurly', KURLY_BODY);
