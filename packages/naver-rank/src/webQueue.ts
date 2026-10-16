import { authorize, recordUsage } from './license';
import { randomDelay } from './webThrottle';
export type Channel='shopping'|'place';
export type WebRow={id:string;link:string;title:string;mallName:string;rank:number;total?:number;photo?:string|null;reviews?:number|null};
export class CollectorError extends Error { constructor(public code:string,public evidence=''){super((code==='blocked_limit'?'잠시 뒤 다시 확인해 주세요': ['captcha','blocked_login','blocked_limit'].includes(code)?'네이버가 잠시 막았어요': '네이버 검색 결과를 확인할 수 없어요')+' ['+code+']');} }
export type Job={channel:Channel;keyword:string;placeId?:string;resolve:(rows:WebRow[])=>void;reject:(e:Error)=>void};
let collector:((job:Job)=>void)|undefined;
let queue=Promise.resolve();
export function attachCollector(handler:(job:Job)=>void){collector=handler;return()=>{collector=undefined;};}
export function collectWeb(channel:Channel,keyword:string,placeId?:string):Promise<WebRow[]>{
 let started=false;
 const task=queue.catch(()=>{}).then(async()=>{await authorize();await recordUsage(channel);return new Promise<WebRow[]>((resolve,reject)=>{if(!collector)return reject(new CollectorError('unavailable'));started=true;collector({channel,keyword,placeId,resolve,reject});});});
 queue=task.then(()=>{},()=>{}).then(()=>started?new Promise<void>(r=>setTimeout(r,randomDelay(20,40))):undefined);return task;
}
export function blockReason(text:string,url:string){
 if(/captcha|캡차|자동입력|보안 확인|보안문자/i.test(text+' '+url))return 'captcha';
 if(/nid\.naver\.com\/nidlogin|로그인이 필요|로그인해 주세요/i.test(url+' '+text))return 'blocked_login';
 if(/접속.{0,5}제한|비정상적인 접근|서비스 이용이 제한|요청이 너무 많/i.test(text))return 'blocked_limit';
}
