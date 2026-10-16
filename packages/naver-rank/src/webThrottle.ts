import { storage } from './license';
import type { Channel } from './webQueue';
const memory=new Map<string,string>();
const key=(channel:Channel)=>'rank.'+channel+'.last429';
export const koreanDay=(now=Date.now())=>new Date(now+9*3600000).toISOString().slice(0,10);
export const randomDelay=(min:number,max:number,random=Math.random)=>Math.round((min+(max-min)*random())*1000);
export function limitAction(lastDay:string|null,today:string,retried:boolean):'retry'|'stop'{return retried||lastDay===today?'stop':'retry';}
export async function isStopped(channel:Channel){
 const today=koreanDay();
 if(memory.get(key(channel))===today)return true;
 try{const saved=await storage().getItem(key(channel));return saved?.split('-').map(v=>v.padStart(2,'0')).join('-')===today;}catch{return true;}
}
export async function stopToday(channel:Channel){
 const today=koreanDay();memory.set(key(channel),today);
 // Keep the current process stopped even if persistence fails.
 try{await storage().setItem(key(channel),today);}catch{}
}
export async function recordLimit(retried:boolean,channel:Channel='shopping'){
 const stopped=await isStopped(channel);
 await stopToday(channel); // Reserve the only retry before waiting; restarts cannot reset it.
 return limitAction(stopped?koreanDay():null,koreanDay(),retried);
}
