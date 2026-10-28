/**
 * 사이트별 주문 읽기 스크립트의 공통 틀. 웹뷰 안에서 실행되는 자바스크립트 문자열 하나(`script`)를 만든다.
 *
 * 앱 쪽 약속(영테크 harness, 앱보조5): 스크립트는 즉시실행함수, 외부 의존 없음. 읽은 결과를
 *   window.ReactNativeWebView.postMessage(JSON.stringify({ type:'orders', site, orders:[{orderNo, orderedAt, amount, seller, title, payment}], done, note? }))
 * 로 보낸다. 한 번에 최대 50건, 최근 30일 것만. 더 있으면 done:false — 앱이 같은 스크립트를 다시 부르면 다음 묶음을 보낸다.
 * 못 읽으면 orders:[] 와 note(짧은 영문/숫자 코드: login_needed · no_list_found · wrong_page · error · fetch_failed …).
 *
 * 개인정보: 보내는 칸은 위 여섯 개뿐이다. 수취인 · 주소 · 전화 · 카드번호 · 쿠키 · 토큰은 읽어도 여기서 버려지고(`clean`), 사이트별 본문(body)도 읽지 않는다.
 */
export const ORDER_SITES = ['naver_shop', 'naver_pay', 'musinsa', 'kurly'] as const;
export type OrderSite = (typeof ORDER_SITES)[number];
/** 앱으로 가는 주문 한 건 — 이 여섯 칸이 전부 */
export type ReaderOrder = { orderNo: string; orderedAt: string; amount: number; seller?: string; title?: string; payment?: string; detailUrl?: string };
/** 상세 화면 읽기 결과(`detailScript`) — 한 건. 초까지(`orderedAt` 'YYYY-MM-DD HH:mm:ss')가 필요하다(중복 판정이 주문번호 + 금액 + 결제 일시(초)). 화면에 초가 없으면 `secKnown:false` 이고 초는 00. 못 읽으면 `ok:false` + note. */
export type DetailMessage =
  | { type: 'detail'; site: OrderSite; ok: true; orderNo: string; orderedAt: string; secKnown: boolean; amount: number; seller?: string; title?: string; payment?: string }
  | { type: 'detail'; site: OrderSite; ok: false; note: string; shape?: ReaderShape };
/** 목록 주문의 `detailUrl` 로 허용하는 주소(사이트별 도메인) — 이 밖의 주소는 버린다 */
export const SITE_HOSTS: Record<OrderSite, RegExp> = {
  naver_shop: /(^|\.)naver\.com$/, naver_pay: /(^|\.)naver\.com$/, musinsa: /(^|\.)musinsa\.com$/, kurly: /(^|\.)kurly\.com$/,
};
/** `shape` 는 목록을 못 읽었을 때(note 가 no_list_found · wrong_page · error) 한 번만 붙는 진단용 화면 모양(요소 이름 · 클래스 · data- 이름 · 날짜/금액/긴 숫자 글자가 몇 개인지 — 글자 내용은 없음). 앱이 모르는 칸은 무시해도 된다. */
export type ReaderShape = { host: string; path: string; outline: string[]; hits: { date: number; money: number; longNumber: number } };
export type OrdersMessage = { type: 'orders'; site: OrderSite; orders: ReaderOrder[]; done: boolean; note?: string; shape?: ReaderShape };
export const READER_WINDOW_DAYS = 30;
export const READER_BATCH = 50;

/**
 * 본문(body) 안에서 `H` 로 쓰는 도우미들. 본문은 `(state, H)` 를 받는 함수 몸통이고 `{ orders, done, note? }` 또는 그것의 Promise 를 돌려준다.
 *  - orders : 이번에 읽은 주문들(여섯 칸, 모자란 칸은 `clean` 이 거른다). 50건보다 많아도 된다 — 틀이 50건씩 나눠 보낸다.
 *  - done   : 더 읽을 쪽이 없으면 true. false 면 앱이 같은 스크립트를 다시 부르고, 본문은 `state`(같은 페이지에서 유지되는 객체)에 커서를 두고 이어 읽는다.
 *  - H.text(el) 공백 정리한 글자 · H.money('12,300원') → 12300 · H.kst('2026.10.28 18:30' | '10/28' | 1761640000000 | Date) → 'YYYY-MM-DD HH:mm'(KST) 또는 null ·
 *    H.recent(orderedAt) 최근 30일 안인가 · H.sleep(ms) · H.waitFor(fn, ms) 조건이 참이 될 때까지(없으면 null) · H.q(sel, root) / H.qa(sel, root) · H.now()
 */
export const HELPERS_JS = String.raw`
var WINDOW_DAYS=${READER_WINDOW_DAYS}, BATCH=${READER_BATCH};
var H={};
H.now=function(){return H._now?H._now():Date.now();};
H.text=function(el){if(el==null)return '';var t=typeof el==='string'?el:(el.textContent||'');return t.replace(/\s+/g,' ').trim();};
H.money=function(s){if(typeof s==='number')return isFinite(s)&&s>=0?Math.floor(s):null;if(typeof s!=='string')return null;var m=s.replace(/,/g,'').match(/-?\d+/);if(!m)return null;var n=parseInt(m[0],10);return n>=0?n:null;};
function p2(n){return (n<10?'0':'')+n;}
H.fmt=function(ms){var d=new Date(ms+9*3600000);return d.getUTCFullYear()+'-'+p2(d.getUTCMonth()+1)+'-'+p2(d.getUTCDate())+' '+p2(d.getUTCHours())+':'+p2(d.getUTCMinutes());};
H.kst=function(v){
  if(v==null||v==='')return null;
  if(v instanceof Date)return isNaN(v.getTime())?null:H.fmt(v.getTime());
  if(typeof v==='number')return v>1e11?H.fmt(v):null;
  if(typeof v!=='string')return null;
  var s=v.trim();
  if(/^\d{12,13}$/.test(s))return H.fmt(parseInt(s,10));
  var iso=s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/);
  if(iso){var off=iso[7];if(!off)return iso[1]+'-'+iso[2]+'-'+iso[3]+' '+iso[4]+':'+iso[5];
    var ms=Date.parse(iso[1]+'-'+iso[2]+'-'+iso[3]+'T'+iso[4]+':'+iso[5]+':'+(iso[6]||'00')+(off==='Z'?'Z':(off.indexOf(':')<0?off.slice(0,3)+':'+off.slice(3):off)));
    return isNaN(ms)?null:H.fmt(ms);}
  var m=s.match(/(?:(\d{4})|(\d{2}))\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})\s*일?(?:[^\d]{0,6}(\d{1,2})\s*:\s*(\d{2}))?/);
  var y,mo,d,hh,mi;
  if(m){y=m[1]?parseInt(m[1],10):2000+parseInt(m[2],10);mo=parseInt(m[3],10);d=parseInt(m[4],10);hh=m[5]?parseInt(m[5],10):0;mi=m[6]?parseInt(m[6],10):0;}
  else{var md=s.match(/^(\d{1,2})\s*[.\/월]\s*(\d{1,2})\s*일?(?:[^\d]{0,6}(\d{1,2})\s*:\s*(\d{2}))?/);
    if(!md)return null;var nowK=new Date(H.now()+9*3600000);y=nowK.getUTCFullYear();mo=parseInt(md[1],10);d=parseInt(md[2],10);hh=md[3]?parseInt(md[3],10):0;mi=md[4]?parseInt(md[4],10):0;
    if(Date.UTC(y,mo-1,d)-3*86400000>nowK.getTime())y-=1;}
  if(mo<1||mo>12||d<1||d>31||hh>23||mi>59)return null;
  return y+'-'+p2(mo)+'-'+p2(d)+' '+p2(hh)+':'+p2(mi);
};
H.secOf=function(v){
  if(v instanceof Date)return isNaN(v.getTime())?null:v.getUTCSeconds();
  if(typeof v==='number')return v>1e11?new Date(v).getUTCSeconds():null;
  if(typeof v!=='string')return null;
  var s=v.trim();
  if(/^\d{12,13}$/.test(s))return new Date(parseInt(s,10)).getUTCSeconds();
  var m=s.match(/\d{1,2}\s*:\s*\d{2}\s*:\s*(\d{2})/);return m?parseInt(m[1],10):null;
};
H.kstSec=function(v){var b=H.kst(v);if(b==null)return null;var sc=H.secOf(v);return b+':'+p2(sc==null?0:sc);};
H.recent=function(at){if(typeof at!=='string')return false;var m=at.match(/^(\d{4})-(\d{2})-(\d{2})/);if(!m)return false;
  var t=Date.UTC(+m[1],+m[2]-1,+m[3])-9*3600000; var nowMs=H.now(); return t<=nowMs+86400000 && t>=nowMs-(WINDOW_DAYS+1)*86400000;};
H.sleep=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
H.waitFor=function(fn,ms){var left=Math.ceil((ms||4000)/150);return new Promise(function(res){(function tick(){var v;try{v=fn();}catch(e){v=null;}if(v)return res(v);if(--left<=0)return res(null);setTimeout(tick,150);})();});};
H.q=function(sel,root){try{return (root||document).querySelector(sel);}catch(e){return null;}};
H.qa=function(sel,root){try{return Array.prototype.slice.call((root||document).querySelectorAll(sel));}catch(e){return [];}};
function clip(v,max){if(typeof v!=='string')return undefined;var t=v.replace(/\s+/g,' ').trim();return t?t.slice(0,max):undefined;}
var PII=/(\d{2,4}[-. ]\d{3,4}[-. ]\d{4})|\d{9,}|@|(수령|받는\s?분|배송지|연락처|휴대폰\s?번호|주소|전화)|([가-힣]{1,6}(시|도)\s?[가-힣]{1,6}(구|군|시)\s?[가-힣0-9]{1,8}(동|읍|면|로|길))|(\d{1,4}동\s?\d{1,4}호)/;
function safeText(v,max){var s=clip(v,max);return s&&!PII.test(s)?s:undefined;}
var HOSTMAP={naver_shop:/(^|\.)naver\.com$/,naver_pay:/(^|\.)naver\.com$/,musinsa:/(^|\.)musinsa\.com$/,kurly:/(^|\.)kurly\.com$/};
function cleanUrl(h){
  if(typeof h!=='string'||!h||h.length>400)return undefined;
  var u;try{u=new URL(h,location.href);}catch(e){return undefined;}
  var HOSTRE=HOSTMAP[typeof SITE==='string'?SITE:''];
  if(u.protocol!=='https:'||(HOSTRE&&!HOSTRE.test(u.hostname))||/login|logout|signin|signup/i.test(u.pathname))return undefined;
  u.hash='';return u.href.length<=400?u.href:undefined;
}
H.detailUrl=function(no){try{
  var as=H.qa('a[href]');
  for(var i=0;i<as.length;i++){var h=as[i].getAttribute('href')||'';if(h.indexOf(no)>=0){var r=cleanUrl(h);if(r)return r;}}
  var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n;
  while((n=w.nextNode())){
    if((n.nodeValue||'').indexOf(no)<0)continue;
    var el=n.parentElement;
    for(var up=0;el&&up<6;up++,el=el.parentElement){
      var tx=String(el.textContent||'');
      if(tx.length>600||(tx.match(/\d{12,20}/g)||[]).some(function(x){return x!==no;}))break;   // 이웃 주문이 섞인 칸까지는 올라가지 않는다 — 남의 영수증 주소를 붙이면 안 된다
      var links=el.querySelectorAll?el.querySelectorAll('a[href]'):[];
      if(links.length>12)break;
      for(var k=0;k<links.length;k++){var hr=links[k].getAttribute('href')||'';if(/order|detail|receipt|view|status|history|pay/i.test(hr)){var r2=cleanUrl(hr);if(r2)return r2;}}
    }
    break;
  }
  return undefined;}catch(e){return undefined;}};
function clean(o){
  if(!o||typeof o!=='object')return null;
  var no=clip(o.orderNo==null?'':String(o.orderNo),60);
  var at=typeof o.orderedAt==='string'&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(o.orderedAt)?o.orderedAt:null;
  var amt=H.money(o.amount);
  if(!no||!at||amt==null||amt>1000000000||!H.recent(at))return null;
  var out={orderNo:no,orderedAt:at,amount:amt};
  var du=cleanUrl(o.detailUrl);if(du)out.detailUrl=du;
  var s=safeText(o.seller,80);if(s)out.seller=s;var t=safeText(o.title,200);if(t)out.title=t;var p=safeText(o.payment,30);if(p)out.payment=p;
  return out;
}
H.shape=function(){try{
  var body=document.body;if(!body)return null;var out=[];
  function cls(el){return (el.getAttribute('class')||'').split(/\s+/).filter(Boolean).slice(0,3).join('.');}
  function safe(s){return s.replace(/[가-힣]/g,'가').replace(/[^A-Za-z0-9_\-:.#\[\],가]/g,'').slice(0,60);}
  function tag(el){var s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;var c=cls(el);if(c)s+='.'+c;var d=[];for(var i=0;i<el.attributes.length&&d.length<3;i++){var n=el.attributes[i].name;if(n.indexOf('data-')===0)d.push(n);}if(d.length)s+='['+d.join(',')+']';return safe(s);}
  function walk(el,d){if(out.length>=150||d>6)return;out.push(d+':'+tag(el));var ch=el.children||[];for(var i=0;i<ch.length&&i<12;i++)walk(ch[i],d+1);}
  walk(body,0);
  var txt=body.textContent||'';
  return {host:String(location.host||'').slice(0,60),path:String(location.pathname||'').replace(/\d{5,}/g,':n').slice(0,100),outline:out,hits:{date:(txt.match(/20\d{2}[.\-]\d{1,2}[.\-]\d{1,2}/g)||[]).length,money:(txt.match(/\d[\d,]*\s*원/g)||[]).length,longNumber:(txt.match(/\d{12,20}/g)||[]).length}};
}catch(e){return null;}};
function postRaw(m){try{window.ReactNativeWebView.postMessage(JSON.stringify(m));}catch(e){}}
function hello(kind){
  var path='';try{path=String(location.pathname||'').replace(/\d{5,}/g,':n').slice(0,100);}catch(e){}
  postRaw({type:'hello',kind:kind,site:SITE,host:String(location.host||'').slice(0,60),path:path,ready:String(document.readyState||'')});
}
function post(site,orders,done,note,shape){
  var m={type:'orders',site:site,orders:orders,done:done};if(note)m.note=String(note).replace(/[^A-Za-z0-9_]/g,'').slice(0,40);
  if(shape)m.shape=shape;
  try{window.ReactNativeWebView.postMessage(JSON.stringify(m));}catch(e){}
}
`;

/** 사이트 본문을 틀에 끼워 웹뷰에서 돌릴 스크립트 문자열을 만든다. */
export function buildScript(site: OrderSite, body: string): string {
  return `(function(){try{
var SITE=${JSON.stringify(site)};
${HELPERS_JS}
var G=(window.__ytOrders=window.__ytOrders||{});var state=(G[SITE]=G[SITE]||{queue:[],finished:false,seen:{}});
if(!state.helloSent){state.helloSent=true;hello('list');}
function emit(res){
  var rows=[];(res&&res.orders||[]).forEach(function(o){if(o&&typeof o==='object'&&o.detailUrl==null&&o.orderNo!=null){o.detailUrl=H.detailUrl(String(o.orderNo));}var c=clean(o);if(c&&!state.seen[c.orderNo]){state.seen[c.orderNo]=1;rows.push(c);}});
  state.queue=state.queue.concat(rows);
  if(res&&res.done===true)state.finished=true;
  var send=state.queue.slice(0,BATCH);state.queue=state.queue.slice(BATCH);
  var done=state.finished&&state.queue.length===0;
  var shape=null;if(send.length===0&&!state.shapeSent&&/^(no_list_found|wrong_page|error)$/.test(String(res&&res.note||''))){state.shapeSent=true;shape=H.shape();}
  post(SITE,send,done,res&&res.note,shape);
}
if(state.queue.length>0||state.finished){emit({orders:[],done:state.finished});return;}
var run=function(state,H){
${body}
};
var r;try{r=run(state,H);}catch(e){emit({orders:[],done:true,note:'error'});return;}
Promise.resolve(r).then(emit,function(){emit({orders:[],done:true,note:'error'});});
}catch(e){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'orders',site:${JSON.stringify(site)},orders:[],done:true,note:'error'}));}catch(_){}}})(); true;`;
}

/**
 * 주문 상세 화면 읽기 틀 — 앱이 목록 주문의 `detailUrl` 을 하나씩 열고 이 스크립트를 돌린다. 한 화면 = 영수증 한 장.
 * 본문은 `(state, H)` 를 받아 `{ order: { orderNo, orderedAt, amount, seller?, title?, payment? } | null, note? }` 또는 그 Promise 를 돌려준다.
 * 앱으로 가는 것: `{ type:'detail', site, ok:true, orderNo, orderedAt('YYYY-MM-DD HH:mm:ss'), secKnown, amount, seller?, title?, payment? }` 또는
 * `{ type:'detail', site, ok:false, note, shape? }`(주문번호 · 결제 일시 · 금액 중 하나라도 못 읽으면 실패 — 목록 값을 그대로 쓸지는 앱이 정한다).
 * 수취인 · 주소 · 전화 · 카드번호는 읽지도 보내지도 않는다(여섯 칸 밖은 버리고, 판매처/상품/결제수단에 섞인 개인 정보 모양 글자는 지운다).
 */
export function buildDetailScript(site: OrderSite, body: string): string {
  return `(function(){try{
var SITE=${JSON.stringify(site)};
${HELPERS_JS}
var G=(window.__ytDetail=window.__ytDetail||{});var state=(G[SITE]=G[SITE]||{});
if(!state.helloSent){state.helloSent=true;hello('detail');}
function fin(res){
  var o=res&&res.order,out=null,note=res&&res.note;
  if(o&&typeof o==='object'){
    var no=clip(o.orderNo==null?'':String(o.orderNo),60);
    var at=H.kstSec(o.orderedAt);
    var amt=H.money(o.amount);
    if(no&&at&&amt!=null&&amt<=1000000000){
      out={type:'detail',site:SITE,ok:true,orderNo:no,orderedAt:at,secKnown:H.secOf(o.orderedAt)!=null,amount:amt};
      var s=safeText(o.seller,80);if(s)out.seller=s;var t=safeText(o.title,200);if(t)out.title=t;var p=safeText(o.payment,30);if(p)out.payment=p;
    }else{note=note||(!no?'no_order_no':!at?'no_date':'no_amount');}
  }
  if(!out){
    out={type:'detail',site:SITE,ok:false,note:String(note||'no_detail_found').replace(/[^A-Za-z0-9_]/g,'').slice(0,40)};
    if(!state.shapeSent&&/^(no_detail_found|no_order_no|no_date|no_amount|error)$/.test(out.note)){state.shapeSent=true;var sh=H.shape();if(sh)out.shape=sh;}
  }
  postRaw(out);
}
var run=function(state,H){
${body}
};
var r;try{r=run(state,H);}catch(e){fin({order:null,note:'error'});return;}
Promise.resolve(r).then(fin,function(){fin({order:null,note:'error'});});
}catch(e){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'detail',site:${JSON.stringify(site)},ok:false,note:'error'}));}catch(_){}}})(); true;`;
}
