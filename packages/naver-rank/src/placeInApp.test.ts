import {it,expect,vi} from 'vitest';
vi.mock('@react-native-async-storage/async-storage',()=>({default:{}}));
import {parsePlaceGraphql,placeCategory,placePayload,scanPlacePages,placeRows} from './placeInApp';
const item=(id:number)=>({id:String(id),name:'업체 '+id,visitorReviewCount:'1,234'});
const page=(start:number,count=50,restaurant=false)=>{const businesses={total:600,items:Array.from({length:count},(_,i)=>item(start+i))};return [{data:restaurant?{restaurants:{businesses}}:{businesses}}];};
it('uses source queries and safe variables with 50-item pagination',()=>{const b=placePayload('"강남\\카페',3,'hairshop');expect(b[0].variables.input).toMatchObject({query:'"강남\\카페',start:101,display:50});expect(b[0].query).toContain('hairshopList');});
it('parses both source response roots, review counts and missing photos',()=>{for(const restaurant of [false,true])expect(parsePlaceGraphql(page(1,1,restaurant)).items[0]).toEqual({id:'1',name:'업체 1',photo:null,reviews:1234});});
it('excludes ads from organic rank and top five',async()=>{const body=page(1,6);body[0].data.businesses!.items.unshift({...item(999),isAd:true} as ReturnType<typeof item>);const result=await scanPlacePages('카페','6','place',async()=>({status:200,body}),async()=>{});expect(result.rank).toBe(6);expect(result.top.map(i=>i.id)).toEqual(['1','2','3','4','5']);});
it('finds rank 300 after six pages and observes request spacing',async()=>{const request=vi.fn(async(body:any)=>({status:200,body:page(body[0].variables.input.start)}));const wait=vi.fn(async()=>{});expect(await scanPlacePages('카페','300','place',request,wait)).toMatchObject({rank:300,total:600});expect(request).toHaveBeenCalledTimes(6);expect(wait.mock.calls).toHaveLength(5);expect(wait).toHaveBeenCalledWith(3000);});
it('limits traversal to 300 and distinguishes outside',async()=>{const request=vi.fn(async(body:any)=>({status:200,body:page(body[0].variables.input.start)}));expect(await scanPlacePages('카페','301','place',request,async()=>{})).toMatchObject({rank:null});expect(request).toHaveBeenCalledTimes(6);});
it('ends on a valid empty list',async()=>{const request=vi.fn(async()=>({status:200,body:page(1,0)}));expect(await scanPlacePages('카페','1','place',request,async()=>{})).toMatchObject({rank:null});expect(request).toHaveBeenCalledTimes(1);});
it.each([405,429])('detects blocked HTTP %s',status=>expect(()=>parsePlaceGraphql(page(1),status)).toThrow());
it.each(['보안 확인 captcha','서비스 이용이 제한','로그인이 필요'])('detects provider block %s',text=>expect(()=>parsePlaceGraphql(text)).toThrow());
it('rejects GraphQL errors and malformed schema instead of outside',()=>{expect(()=>parsePlaceGraphql([{errors:[{message:'Forbidden'}]}])).toThrow();expect(()=>parsePlaceGraphql([{data:{}}])).toThrow();});
it('rejects repeated pages',async()=>{await expect(scanPlacePages('카페','999','place',async()=>({status:200,body:page(1)}),async()=>{})).rejects.toThrow('[repeated_page]');});
it('keeps total and target rank across bridge rows',()=>{expect(placeRows({rank:300,total:600,top:[]},'300')[0]).toMatchObject({id:'300',rank:300,total:600});});

it('uses source category URL and Korean category mapping',()=>{expect(placeCategory('/restaurant/1/home','미용')).toBe('restaurant');expect(placeCategory('/place/1/home','속눈썹')).toBe('hairshop');expect(placeCategory('/place/1/home','네일')).toBe('nailshop');});
