import { authorize, recordUsage } from './license';
import { randomDelay,isStopped,stopToday } from './webThrottle';
export type Channel='shopping'|'place';
export type WebRow={id:string;link:string;title:string;mallName:string;rank:number;total?:number;photo?:string|null;reviews?:number|null};
export class CollectorError extends Error { constructor(public code:string,public evidence=''){super((code==='timeout'?'90초 안에 확인하지 못했어요. 잠시 후 다시 시도해 주세요':['blocked_limit','captcha'].includes(code)?'네이버가 잠시 막았어요. 내일 다시 확인돼요': ['captcha','blocked_login','blocked_limit'].includes(code)?'네이버가 잠시 막았어요': '네이버 검색 결과를 확인할 수 없어요')+' ['+code+']');} }
export function withCollectorDiagnostic(error:Error,diagnostic?:string){if(diagnostic&&!error.message.includes(' · 경로 '))error.message+=' · '+diagnostic;return error;}
export type Job={channel:Channel;keyword:string;placeId?:string;signal:AbortSignal;diagnostic?:string;resolve:(rows:WebRow[])=>void;reject:(e:Error)=>void};
let collector:((job:Job)=>void)|undefined;
let queue=Promise.resolve();
export function attachCollector(handler:(job:Job)=>void){collector=handler;return()=>{collector=undefined;};}
export function collectWeb(channel:Channel,keyword:string,placeId?:string):Promise<WebRow[]>{
 let started=false;
 const controller=new AbortController();
 let timer:ReturnType<typeof setTimeout>;
 const deadline=new Promise<WebRow[]>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new CollectorError('timeout'));},90000);});
 const task=queue.catch(()=>{}).then(async()=>{
  if(controller.signal.aborted)throw new CollectorError('timeout');
  await authorize();
  if(controller.signal.aborted)throw new CollectorError('timeout');
  if(await isStopped(channel))throw new CollectorError('blocked_limit');
  await recordUsage(channel);
  if(controller.signal.aborted)throw new CollectorError('timeout');
  return new Promise<WebRow[]>((resolve,reject)=>{if(!collector)return reject(new CollectorError('unavailable'));started=true;collector({channel,keyword,placeId,signal:controller.signal,resolve,reject:e=>{if(e instanceof CollectorError&&['blocked_limit','captcha'].includes(e.code)){void stopToday(channel).then(()=>reject(e));}else reject(e);}});});
 });
 const result=Promise.race([task,deadline]).finally(()=>clearTimeout(timer));
 queue=result.then(()=>{},()=>{}).then(()=>started?new Promise<void>(r=>setTimeout(r,randomDelay(20,40))):undefined);return result;
}
export function blockReason(text:string,url:string){
 if(/쇼핑\s*서비스\s*접속이\s*일시적으로\s*제한/.test(text))return 'blocked_limit';
 if(/captcha|캡차|자동입력|보안 확인|보안문자/i.test(text+' '+url))return 'captcha';
 if(/nid\.naver\.com\/nidlogin|로그인이 필요|로그인해 주세요/i.test(url+' '+text))return 'blocked_login';
 if(/접속.{0,12}제한|비정상적인 접근|서비스 이용이 제한|요청이 너무 많/i.test(text))return 'blocked_limit';
}

const failureListeners=new Set<(error:CollectorError)=>void>();
export function subscribeCollectorFailure(listener:(error:CollectorError)=>void){failureListeners.add(listener);return()=>{failureListeners.delete(listener);};}
export function reportCollectorFailure(error:CollectorError){for(const listener of failureListeners)listener(error);}
