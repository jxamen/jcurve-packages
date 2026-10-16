import { randomDelay } from './webThrottle';
export const SHOPPING_PAGE_SIZE=40;
export const SHOPPING_MAX_RANK=100;
export const SHOPPING_MAX_PAGES=Math.ceil(SHOPPING_MAX_RANK/SHOPPING_PAGE_SIZE);
export function shoppingNextPage(page:number,found:boolean){return found||page>=SHOPPING_MAX_PAGES?undefined:page+1;}
export function shoppingFallback(code:string,page:number,attempts:number,manual:boolean){return page===1&&attempts<2&&!manual&&['network','http_4xx'].includes(code);}
export const shoppingPageDelay=(random=Math.random)=>randomDelay(3,6,random);
