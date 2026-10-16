import { collectPlaceInApp } from './placeInApp';
import { collectWeb, CollectorError } from './webQueue';
import { targetUrlId } from './naverUrl';
import { findMyRank,type ShoppingTarget } from './shopping';
export async function checkPlaceRank(keyword:string,placeId:string){
 const id=targetUrlId(placeId,'place')??placeId.trim();
 if(!keyword.trim()||!/^\d{1,30}$/.test(id))throw new CollectorError('invalid_input');
 return collectPlaceInApp(keyword.trim(),id);
}
export async function checkShoppingRank(keyword:string,target:ShoppingTarget){
 if(!keyword.trim()||!(target.productId??target.mallName??target.titleIncludes)?.trim())throw new CollectorError('invalid_input');
 const items=(await collectWeb('shopping',keyword.trim())).map(x=>({rank:x.rank,productId:x.id,link:x.link,title:x.title,mallName:x.mallName}));
 return {rank:findMyRank(items,target)??null,items};
}
