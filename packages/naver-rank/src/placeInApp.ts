import { collectWeb,CollectorError,type WebRow } from './webQueue';
import { placePayloads } from './placePayloads';
import { blockReason } from './webQueue';
export type PlaceTop={id:string;name:string;photo:string|null;reviews:number|null};
export type PlaceCollection={rank:number|null;total:number;top:PlaceTop[]};
export type PlaceCategory=keyof typeof placePayloads;
export function placeCategory(path:string,label=''):PlaceCategory {
 for(const cat of ['restaurant','hospital','hairshop','nailshop','accommodation'] as const)if(path.includes('/'+cat+'/'))return cat;
 const map:[PlaceCategory,RegExp][]=[['nailshop',/네일/],['hairshop',/미용|헤어|뷰티|피부관리|왁싱|속눈썹|태닝|반영구|메이크업/],['hospital',/병원|의원|치과|한의|정형|피부과|성형|클리닉/],['accommodation',/숙박|호텔|모텔|펜션|게스트|리조트/],['restaurant',/음식|맛집|식당|한식|일식|중식|양식|분식|카페|고기|치킨|피자|뷔페|횟집|국수|찌개|술집/]];
 return map.find(([,pattern])=>pattern.test(label))?.[0]??'place';
}
export function placePayload(keyword:string,page:number,category:PlaceCategory='place'){
 const off=(Math.random()*20000-10000)/10000000;
 const x=(126.9779692+off).toFixed(14),y=(37.5662952+off).toFixed(14);
 const bounds=[126.9679692+off/2,37.5562952+off/2,126.9879692+off/2,37.5762952+off/2].map(n=>n.toFixed(14)).join(';');
 const body=JSON.parse(JSON.stringify(placePayloads[category]).replaceAll('{#x}',x).replaceAll('{#y}',y).replaceAll('{#bounds}',bounds));
 body[0].variables.input.query=keyword;body[0].variables.input.start=(page-1)*50+1;
 return body;
}
export function parsePlaceGraphql(value:unknown,status=200):{total:number;items:PlaceTop[]}{
 const roots=Array.isArray(value)?value:[value];
 const text=JSON.stringify(value);
 const blocked=blockReason(text,'');
 if(status===429||status===405||blocked)throw new CollectorError(status===429?'blocked_limit':blocked||'captcha');
 if(status!==200)throw new CollectorError('http_4xx');
 if(roots.some(r=>r?.errors?.length))throw new CollectorError(/429|405|captcha|forbidden|denied/i.test(text)?'captcha':'graphql');
 const data=roots[0]?.data;const node=data?.restaurants?.businesses??data?.businesses;
 if(!node||!Array.isArray(node.items)||!Number.isFinite(Number(node.total)))throw new CollectorError('schema');
 const items:PlaceTop[]=node.items.filter((it:Record<string,unknown>)=>!it.isAd&&!it.adId&&!it.advertisement).map((it:Record<string,unknown>)=>{
  if(!/^\d+$/.test(String(it.id))||typeof it.name!=='string')throw new CollectorError('schema');
  return {id:String(it.id),name:it.name,photo:typeof it.imageUrl==='string'?it.imageUrl:typeof it.thumUrl==='string'?it.thumUrl:null,reviews:it.visitorReviewCount==null?null:Number(String(it.visitorReviewCount).replaceAll(',',''))};
 });
 return {total:Number(node.total),items};
}
export async function scanPlacePages(keyword:string,placeId:string,category:PlaceCategory,request:(body:unknown)=>Promise<{status:number;body:unknown}>,wait:(ms:number)=>Promise<void>):Promise<PlaceCollection>{
 let all:PlaceTop[]=[],total=0;const seen=new Set<string>();
 const template=placePayload(keyword,1,category);
 for(let page=1;page<=6;page++){
  if(page>1)await wait(3000);
  const body=JSON.parse(JSON.stringify(template));body[0].variables.input.start=(page-1)*50+1;
  const response=await request(body);const parsed=parsePlaceGraphql(response.body,response.status);total=parsed.total;
  if(parsed.items.some(it=>seen.has(it.id)))throw new CollectorError('repeated_page');
  parsed.items.forEach(it=>seen.add(it.id));all.push(...parsed.items);all=all.slice(0,300);
  const index=all.findIndex(it=>it.id===placeId);
  if(index>=0)return {rank:index+1,total,top:all.slice(0,5)};
  if(!parsed.items.length)break;
 }
 return {rank:null,total,top:all.slice(0,5)};
}
export async function collectPlaceInApp(keyword:string,placeId:string):Promise<PlaceCollection>{
 const rows=await collectWeb('place',keyword,placeId);
 const top=rows.filter(row=>row.id&&row.title).slice(0,5).map(row=>({id:row.id,name:row.title,photo:row.photo??null,reviews:row.reviews??null}));
 return {rank:rows.find(row=>row.id===placeId)?.rank??null,total:rows[0]?.total??0,top};
}
export function placeRows(result:PlaceCollection,placeId:string):WebRow[]{
 const rows=result.top.map((it,i)=>({id:it.id,title:it.name,rank:i+1,link:'',mallName:'',total:result.total,photo:it.photo,reviews:it.reviews}));
 if(result.rank&&!rows.some(it=>it.id===placeId))rows.push({id:placeId,title:'',rank:result.rank,link:'',mallName:'',total:result.total,photo:null,reviews:null});
 // Preserve the total even for a valid empty list; sentinel is removed from top at the caller.
 if(!rows.length)rows.push({id:'',title:'',rank:0,link:'',mallName:'',total:result.total,photo:null,reviews:null});
 return rows;
}
