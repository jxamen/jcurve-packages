import { storage } from './license';
const key='rank.shopping.last429';
export const randomDelay=(min:number,max:number,random=Math.random)=>Math.round((min+(max-min)*random())*1000);
export function limitAction(lastDay:string|null,today:string,retried:boolean):'retry'|'stop'{return retried||lastDay===today?'stop':'retry';}
export async function recordLimit(retried:boolean){
 const now=new Date();const day=[now.getFullYear(),now.getMonth()+1,now.getDate()].join('-');
 // Fail closed if local persistence is unavailable: avoid an unbounded retry after restart.
 try{const last=await storage().getItem(key);await storage().setItem(key,day);return limitAction(last,day,retried);}catch{return 'stop';}
}
