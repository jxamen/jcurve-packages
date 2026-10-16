import { backgroundGrace } from './backgroundGrace';
import { PlaceWebView } from './placeWebView';
import { useEffect,useRef,useState } from 'react';
import { AppState,Pressable,Text,View } from 'react-native';
import { WebView } from 'react-native-webview';
import { attachCollector,reportCollectorFailure,blockReason,CollectorError,withCollectorDiagnostic,type WebRow } from './webQueue';
import { parseCollectorHtml,shoppingLinkId } from './webParser';
import { targetUrlId } from './naverUrl';
import { safeEvidence,shoppingUrl } from './webDiagnostics';
import { randomDelay,recordLimit,stopToday } from './webThrottle';

// A navigation gets one six-second observation window. Never send raw text to logs.
const script=`(function(){if(window.__rankTimer)return;var start=Date.now(),scrolled=false;window.__rankTimer=setInterval(function(){var text=document.body?document.body.innerText:'';var links=Array.from(document.querySelectorAll('a[data-nlog-area*="shp_tli"][href], [data-product-id] a[href], a[data-product-id], [class*="product_item"] a[href], [class*="productItem"] a[href], [class*="shopping_item"] a[href], li.VLTHu a[href], li.UEzoS a[href]')).map(function(a){return {href:a.href,title:a.innerText,id:(a.closest('[data-product-id]')||a).getAttribute('data-product-id')};});var elapsed=Date.now()-start;if(elapsed<6000&&!/접속.{0,12}제한|서비스 이용이 제한/.test(text)){if(!scrolled){scrolled=true;window.scrollTo(0,document.body?document.body.scrollHeight:0);}return;}clearInterval(window.__rankTimer);window.__rankTimer=null;window.ReactNativeWebView.postMessage(JSON.stringify({url:location.href,title:document.title,text:text,html:document.documentElement.outerHTML,links:links}));},400);})();true;`;
let nextShoppingRoute=0;
export function NaverRankHost(){
 const [job,setJob]=useState<Parameters<Parameters<typeof attachCollector>[0]>[0]>();
 const [visible,setVisible]=useState(false),[failure,setFailure]=useState<CollectorError>();
 const ref=useRef<WebView>(null),active=useRef(job),rows=useRef<WebRow[]>([]);
 const page=useRef(1),route=useRef(0),attempts=useRef(1),prepared=useRef(false),manual=useRef(false),http=useRef(200),navigation=useRef(false);
 active.current=job;
 const pending=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),waiting=useRef(false),retried=useRef(false);
 const cancelWait=()=>{clearTimeout(pending.current);pending.current=undefined;waiting.current=false;};
 const later=(ms:number,action:()=>void)=>{cancelWait();waiting.current=true;pending.current=setTimeout(()=>{waiting.current=false;if(active.current)action();},ms);};
 const finish=(error?:Error)=>{const current=active.current;if(!current)return;cancelWait();active.current=undefined;error?current.reject(withCollectorDiagnostic(error,current.diagnostic)):current.resolve(rows.current);setJob(undefined);setVisible(false);setFailure(undefined);};
 const navigate=()=>{const current=active.current;if(!current)return;http.current=200;navigation.current=true;current.diagnostic='경로 '+(route.current+1)+'/3 · 검색 페이지 '+page.current+' 로드';const url=current.channel==='shopping'?shoppingUrl(current.keyword,page.current,route.current):'https://m.place.naver.com/place/list?query='+encodeURIComponent(current.keyword)+'&page='+page.current;ref.current?.injectJavaScript('location.href='+JSON.stringify(url)+';true;');};
 const fail=async(code:string,title='',text='')=>{
  if(waiting.current||failure)return;
  const error=new CollectorError(code,safeEvidence(title,text));withCollectorDiagnostic(error,active.current?.diagnostic);
  console.info('[rank.web]',JSON.stringify({code,titleAndExcerpt:error.evidence,route:route.current,page:page.current,status:http.current}));
  if(active.current?.channel==='shopping'&&http.current===429&&!manual.current){
   waiting.current=true;const current=active.current;const action=await recordLimit(retried.current);
   if(active.current!==current)return;waiting.current=false;
   if(action==='retry'){retried.current=true;later(randomDelay(30,90),navigate);return;}
   nextShoppingRoute=(route.current+1)%3;finish(new CollectorError('blocked_limit','HTTP 429 · 잠시 뒤 다시 확인해 주세요. 다음 예약 시간에 재개합니다.'));return;
  }
  if(active.current&&['blocked_limit','captcha'].includes(code)){const current=active.current;waiting.current=true;await stopToday(current.channel);if(active.current===current){reportCollectorFailure(error);finish(error);}return;}
  if(active.current?.channel==='shopping'&&attempts.current<2&&!manual.current&&!['blocked_limit','captcha','blocked_login'].includes(code)){attempts.current++;route.current=(route.current+1)%3;page.current=1;rows.current=[];later(10000,navigate);return;}
  if(active.current?.channel==='shopping')nextShoppingRoute=(route.current+1)%3;
  reportCollectorFailure(error);setFailure(error);
 };
 useEffect(()=>attachCollector(next=>{cancelWait();retried.current=false;rows.current=[];page.current=1;route.current=next.channel==='shopping'?nextShoppingRoute:0;attempts.current=1;prepared.current=false;manual.current=false;setFailure(undefined);setVisible(false);next.diagnostic=next.channel==='place'?'경로 1/3 · 상세 페이지 로드':'경로 '+(route.current+1)+'/3 · 쇼핑 초기 페이지 로드';setJob(next);}),[]);
 useEffect(()=>{if(!job)return;const abort=()=>finish(new CollectorError('timeout'));job.signal.addEventListener('abort',abort);if(job.signal.aborted)abort();const grace=backgroundGrace(()=>finish(new CollectorError('background')));const sub=AppState.addEventListener('change',grace.change);grace.change(AppState.currentState);return()=>{grace.dispose();job.signal.removeEventListener('abort',abort);sub.remove();};},[job]);
 useEffect(()=>()=>{cancelWait();active.current?.reject(new CollectorError('unmounted'));},[]);
 if(!job)return null;
 if(job.channel==='place')return <PlaceWebView key={job.keyword+job.placeId} job={job} onDone={()=>{active.current=undefined;setJob(undefined);}}/>;
 return <><View pointerEvents={visible?'auto':'none'} style={visible?{position:'absolute',top:0,bottom:0,left:0,right:0,zIndex:1000,backgroundColor:'white',paddingTop:60,paddingBottom:30}:{position:'absolute',width:1,height:1,opacity:0,overflow:'hidden'}}>
 {visible&&<Pressable accessibilityRole="button" style={{padding:16}} onPress={()=>{setVisible(false);manual.current=false;setFailure(undefined);ref.current?.injectJavaScript(script);}}><Text>닫기 · 현재 페이지로 순위 다시 확인</Text></Pressable>}
 <WebView geolocationEnabled={false} ref={ref} style={{flex:1}} source={{uri:'https://shopping.naver.com/ns/home'}} applicationNameForUserAgent="Version/18.0 Mobile/15E148 Safari/604.1" sharedCookiesEnabled thirdPartyCookiesEnabled javaScriptEnabled
 onShouldStartLoadWithRequest={request=>{try{const u=new URL(request.url);return u.protocol==='https:'&&(u.hostname==='naver.com'||u.hostname.endsWith('.naver.com'));}catch{return request.url==='about:blank';}}}
 onLoadStart={()=>{navigation.current=false;http.current=200;}}
 onLoadEnd={()=>{if(active.current)active.current.diagnostic='경로 '+(route.current+1)+'/3 · '+(prepared.current?'검색 결과 추출':'쇼핑 초기 페이지 준비');if(navigation.current||waiting.current)return;if(!prepared.current){prepared.current=true;later(2500,navigate);return;}if(!manual.current&&!waiting.current)ref.current?.injectJavaScript(script);}}
 onHttpError={event=>{if((event.nativeEvent as typeof event.nativeEvent & {isTopFrame?:boolean}).isTopFrame===false)return;http.current=event.nativeEvent.statusCode;if(http.current===429&&!manual.current){prepared.current=true;ref.current?.stopLoading();void fail('blocked_limit','', '요청이 너무 많');}}}
 onError={()=>{if(!prepared.current){prepared.current=true;navigate();}else fail('empty');}}
 onMessage={event=>{
  if(manual.current||navigation.current||waiting.current||failure)return;
  try{
   const data=JSON.parse(event.nativeEvent.data);let parsed:WebRow[]=[];
   try{parsed=parseCollectorHtml(data.html,job.channel,page.current);}catch{
    const seen=new Set<string>();for(const link of data.links??[]){const id=link.id||(job.channel==='shopping'?shoppingLinkId(link.href):targetUrlId(link.href,'place'));if(!id||seen.has(id))continue;seen.add(id);parsed.push({id,link:link.href,title:link.title,mallName:'',rank:(page.current-1)*(job.channel==='shopping'?40:30)+parsed.length+1});}
   }
   const blocked=blockReason(data.text,data.url);
   // A rendered result wins over incidental footer/login/CAPTCHA words.
   if(blocked==='blocked_limit'||blocked==='captcha'){void fail(blocked,data.title,data.text);return;}
   if(http.current===429){void fail('blocked_limit',data.title,data.text);return;}
   if(!parsed.length){fail(blocked||(http.current>=400?'http_4xx':'empty'),data.title,data.text);return;}
   if(rows.current.some(old=>parsed.some(row=>row.id===old.id))){fail('empty',data.title,data.text);return;}
   setFailure(undefined);const max=job.channel==='shopping'?200:100;
   rows.current.push(...parsed.filter(row=>row.rank<=max));
   if(job.channel==='shopping'||rows.current.length>=max||parsed.length<30)finish();else{page.current++;navigate();}
  }catch{fail('empty');}
 }}/></View>
 {failure&&!visible&&<View style={{position:'absolute',bottom:80,left:20,right:20,zIndex:1001,backgroundColor:'white',padding:16,borderWidth:1,borderColor:'#ddd'}}><Text>{failure.message}</Text><Text style={{fontSize:11,marginVertical:8}}>{failure.evidence}</Text><Pressable accessibilityRole="button" style={{padding:12}} onPress={()=>{cancelWait();manual.current=true;rows.current=[];page.current=1;setVisible(true);}}><Text>네이버 화면 보기</Text></Pressable><Pressable accessibilityRole="button" style={{padding:12}} onPress={()=>finish(failure)}><Text>확인 종료</Text></Pressable></View>}
 </>;
}
