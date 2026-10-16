import {useEffect,useRef,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {WebView} from 'react-native-webview';
import {CollectorError,withCollectorDiagnostic,reportCollectorFailure,blockReason,type Job} from './webQueue';
import {placeRows,scanPlacePages,placeCategory,type PlaceCategory} from './placeInApp';
import {randomDelay,recordLimit,stopToday} from './webThrottle';
// Capture only successful page-owned GraphQL requests. Tokens/cookies stay in this page.
import { placeTokenScript } from './placeTokenScript';
export function PlaceWebView({job,onDone}:{job:Job;onDone:()=>void}){
 const ref=useRef<WebView>(null),alive=useRef(true),running=useRef(false),retried=useRef(false),sequence=useRef(0);
 const throttling=useRef(false);
 const category=useRef<PlaceCategory>('place');
 const [url,setUrl]=useState('https://m.place.naver.com/place/'+job.placeId+'/home');
 const [visible,setVisible]=useState(false),[error,setError]=useState<CollectorError>();
 const pending=useRef<{id:number;resolve:(v:{status:number;body:unknown})=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}|undefined>(undefined);
 const finish=(e?:Error,rows:Parameters<Job['resolve']>[0]=[])=>{if(!alive.current)return;alive.current=false;clearTimeout(pending.current?.timer);pending.current?.reject(e||new CollectorError('cancelled'));pending.current=undefined;e?job.reject(withCollectorDiagnostic(e,job.diagnostic)):job.resolve(rows);onDone();};
 const fail=(e:unknown)=>{if(!alive.current)return;const reason=e instanceof CollectorError?e:new CollectorError('network');withCollectorDiagnostic(reason,job.diagnostic);if(reason.code==='captcha'||reason.code==='blocked_limit'){void stopToday('place').then(()=>{reportCollectorFailure(reason);finish(reason);});}else if(reason.code==='blocked_login'){reportCollectorFailure(reason);setError(reason);}else finish(reason);};
 const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
 const request=async(body:unknown):Promise<{status:number;body:unknown}>=>{
  job.diagnostic='경로 3/3 · 순위 데이터 요청';
  const once=()=>new Promise<{status:number;body:unknown}>((resolve,reject)=>{if(!alive.current)return reject(new CollectorError('cancelled'));const id=++sequence.current;const timer=setTimeout(()=>{pending.current=undefined;reject(new CollectorError('timeout'));},25000);pending.current={id,resolve,reject,timer};ref.current?.injectJavaScript('window.__placeRequest('+[id,body,job.keyword,category.current].map(v=>JSON.stringify(v)).join(',')+');true;');});
  let response=await once();
  if(response.status===429){const action=await recordLimit(retried.current,'place');if(action==='stop')throw new CollectorError('blocked_limit');retried.current=true;await wait(randomDelay(30,90));response=await once();if(response.status===429){await recordLimit(true,'place');throw new CollectorError('blocked_limit');}}
  if(response.status===405){await wait(3000);response=await once();}
  return response;
 };
 const run=async()=>{if(running.current||!alive.current)return;running.current=true;try{let result=await scanPlacePages(job.keyword,job.placeId!,category.current,request,wait);if(result.rank==null&&category.current!=='place'){category.current='place';await wait(3000);result=await scanPlacePages(job.keyword,job.placeId!,'place',request,wait);}finish(undefined,placeRows(result,job.placeId!));}catch(e){running.current=false;fail(e);}};
 useEffect(()=>{const timer=setTimeout(()=>fail(new CollectorError('token_timeout')),210000);return()=>{alive.current=false;clearTimeout(timer);clearTimeout(pending.current?.timer);pending.current?.reject(new CollectorError('unmounted'));};},[]);
 return <><View pointerEvents={visible?'auto':'none'} style={visible?{position:'absolute',top:0,bottom:0,left:0,right:0,zIndex:1000,backgroundColor:'white',paddingTop:60}:{position:'absolute',width:1,height:1,opacity:0,overflow:'hidden'}}>
 {visible&&<Pressable onPress={()=>{setVisible(false);setError(undefined);ref.current?.reload();}} style={{padding:16}}><Text>닫기 · 현재 페이지로 순위 다시 확인</Text></Pressable>}
 <WebView geolocationEnabled={false} ref={ref} source={{uri:url}} sharedCookiesEnabled thirdPartyCookiesEnabled javaScriptEnabled injectedJavaScriptBeforeContentLoaded={placeTokenScript}
 onShouldStartLoadWithRequest={r=>{try{const u=new URL(r.url);return u.protocol==='https:'&&(u.hostname==='naver.com'||u.hostname.endsWith('.naver.com'));}catch{return r.url==='about:blank';}}}
 onLoadEnd={()=>!throttling.current&&ref.current?.injectJavaScript(`window.ReactNativeWebView.postMessage(JSON.stringify({kind:'page',url:location.href,category:Object.values(window.__APOLLO_STATE__||{}).filter(function(v){return v&&v.__typename==='PlaceDetailBase';}).map(function(v){return v.category;})[0]||'',text:(document.body?document.body.innerText:'').slice(0,4000)}));if(location.hostname==='pcmap.place.naver.com'&&!window.__placeScroll){window.__placeScroll=1;var count=0,t=setInterval(function(){if(window.__placeTokenReady){clearInterval(t);return;}window.scrollBy(0,900);if(++count>=4){clearInterval(t);var next=Array.from(document.querySelectorAll('a')).find(function(a){return a.textContent.trim()==='2';});if(next)next.click();}},1500);}true;`)}
 onHttpError={e=>{if((e.nativeEvent as typeof e.nativeEvent & {isTopFrame?:boolean}).isTopFrame===false)return;if(e.nativeEvent.statusCode===429){if(throttling.current)return;throttling.current=true;ref.current?.stopLoading();void (async()=>{const action=await recordLimit(retried.current,'place');if(action==='stop'){fail(new CollectorError('blocked_limit'));return;}retried.current=true;await wait(randomDelay(30,90));if(alive.current){throttling.current=false;ref.current?.reload();}})();}else if(e.nativeEvent.statusCode>=400)fail(new CollectorError('http_4xx'));}}
 onError={()=>fail(new CollectorError('network'))}
 onMessage={e=>{if(throttling.current)return;try{const data=JSON.parse(e.nativeEvent.data);if(data.kind==='page'){const reason=blockReason(data.text,data.url);if(reason){fail(new CollectorError(reason));return;}if(new URL(data.url).hostname==='m.place.naver.com'){job.diagnostic='경로 2/3 · 검색 페이지 토큰 대기';category.current=placeCategory(new URL(data.url).pathname,data.category);setUrl('https://pcmap.place.naver.com/'+category.current+'/list?query='+encodeURIComponent(job.keyword));}}else if(data.kind==='ready')void run();else if(pending.current&&data.id===pending.current.id){const p=pending.current;pending.current=undefined;clearTimeout(p.timer);data.kind==='response'?p.resolve(data):p.reject(new CollectorError('network'));}}catch{fail(new CollectorError('bridge'));}}}/></View>
 {!!error&&!visible&&<View style={{position:'absolute',bottom:80,left:20,right:20,zIndex:1001,backgroundColor:'white',padding:16}}><Text>{error.message}</Text><Pressable onPress={()=>setVisible(true)} style={{padding:12}}><Text>네이버 화면 보기</Text></Pressable><Pressable onPress={()=>finish(error)} style={{padding:12}}><Text>서버 예비 조회</Text></Pressable></View>}
 </>;
}
