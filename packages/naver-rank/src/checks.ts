import { collectPlaceInApp } from './placeInApp';
import { collectWeb, CollectorError } from './webQueue';
import { targetUrlId } from './naverUrl';
import { storage } from './license';
import { koreanDay } from './webThrottle';
import { targetUrlId as shoppingId } from './naverUrl';
import { findMyRank,type ShoppingTarget } from './shopping';
export async function checkPlaceRank(keyword:string,placeId:string){
 const id=targetUrlId(placeId,'place')??placeId.trim();
 if(!keyword.trim()||!/^\d{1,30}$/.test(id))throw new CollectorError('invalid_input');
 return collectPlaceInApp(keyword.trim(),id);
}
type ShoppingResult={rank:number|null;items:import('./shopping').ShoppingItem[];timestamp:number;cached:boolean};
const memory=new Map<string,ShoppingResult>();
const pending=new Map<string,Promise<ShoppingResult>>();
export async function checkShoppingRank(keyword:string,target:ShoppingTarget):Promise<ShoppingResult>{
 const value=(target.productId??target.mallName??target.titleIncludes)?.trim();
 if(!keyword.trim()||!value)throw new CollectorError('invalid_input');
 const normalized:ShoppingTarget=target.productId!==undefined?{productId:shoppingId(value,'shop')??value}:target.mallName!==undefined?{mallName:value}:{titleIncludes:value};
 const key='rank.shopping.daily.'+encodeURIComponent(JSON.stringify([keyword.trim(),normalized]));
 const valid=(result:ShoppingResult|undefined)=>result&&koreanDay(result.timestamp)===koreanDay();
 if(valid(memory.get(key)))return {...memory.get(key)!,cached:true};
 if(pending.has(key))return pending.get(key)!;
 const task=(async()=>{
  try{const saved=JSON.parse(await storage().getItem(key)??'null') as ShoppingResult|null;if(saved&&Number.isFinite(saved.timestamp)&&Array.isArray(saved.items)&&valid(saved)){memory.set(key,saved);return {...saved,cached:true};}}catch{}
  const convert=(rows:import('./webQueue').WebRow[])=>rows.map(x=>({rank:x.rank,productId:x.id,link:x.link,title:x.title,mallName:x.mallName}));
  const items=convert(await collectWeb('shopping',keyword.trim(),undefined,rows=>findMyRank(convert(rows),normalized)!==undefined));
  const result={rank:findMyRank(items,normalized)??null,items,timestamp:Date.now(),cached:false};
  memory.set(key,result);
  try{await storage().setItem(key,JSON.stringify(result));}catch{}
  return result;
 })();
 pending.set(key,task);
 try{return await task;}finally{pending.delete(key);}
}
