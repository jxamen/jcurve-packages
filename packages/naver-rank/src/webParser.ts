import { parseShoppingPage } from './shopping';
import { parsePlacePage } from './place';
import { targetUrlId } from './naverUrl';
import type { WebRow } from './webQueue';
export function shoppingLinkId(link:string){
 try{const url=new URL(link);if(/^(cr\d*\.shopping|msearch\.shopping|search\.shopping)\.naver\.com$/.test(url.hostname))return url.searchParams.get('nv_mid')||url.searchParams.get('nvMid')||undefined;}catch{}
 return targetUrlId(link,'shop');
}
/** Only result links inside result cards; never count arbitrary page navigation links. */
export function parseCollectorHtml(html:string,channel:'shopping'|'place',page:number):WebRow[]{
 if(channel==='shopping'){
  try {return parseShoppingPage(html,page).map(x=>({id:x.productId,link:x.link,title:x.title,mallName:x.mallName,rank:x.rank}));} catch { /* rendered result cards */ }
  const rows:WebRow[]=[];const seen=new Set<string>();
  const decode=(v:string)=>v.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  // Restrict fallback to explicitly identified product anchors/cards, excluding menus.
  for(const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*(?:data-product-id|data-nlog-area=["'][^"']*shp_tli[^"']*["']|class=["'][^"']*(?:product_item|productItem|shopping_item))[^>]*)>([\s\S]*?)<\/\1>/gi)){
   const attrs=match[2],body=match[3];
   const link=decode((attrs+' '+body).match(/href=["']([^"']+)["']/i)?.[1]||'');
   const id=attrs.match(/data-product-id=["'](\d+)["']/)?.[1]||shoppingLinkId(link);
   if(!id||seen.has(id))continue;seen.add(id);
   rows.push({id,link,title:body.replace(/<[^>]*>/g,' ').trim(),mallName:'',rank:(page-1)*40+rows.length+1});
  }
  if(!rows.length)throw Error('empty');return rows;
 }
 return parsePlacePage(html,page).map(x=>({...x,link:'',title:'',mallName:''}));
}
