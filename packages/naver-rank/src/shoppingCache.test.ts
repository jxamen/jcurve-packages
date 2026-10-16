import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const state=vi.hoisted(()=>({data:new Map<string,string>(),collect:vi.fn()}));
vi.mock('./license',()=>({storage:()=>({getItem:async(k:string)=>state.data.get(k)??null,setItem:async(k:string,v:string)=>{state.data.set(k,v);}})}));
vi.mock('./webQueue',()=>({collectWeb:state.collect,CollectorError:class extends Error{constructor(public code:string){super(code);}}}));
beforeEach(()=>{state.data.clear();state.collect.mockReset();vi.resetModules();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-16T14:58:00Z'));state.collect.mockResolvedValue([{id:'123',rank:1,title:'상품',mallName:'몰',link:'https://smartstore.naver.com/s/products/123'}]);});
afterEach(()=>vi.useRealTimers());
it('deduplicates concurrent/repeated normalized keyword-product checks and preserves check time after restart',async()=>{
 let sdk=await import('./checks');
 const [first,parallel]=await Promise.all([sdk.checkShoppingRank(' 키워드 ',{productId:'123'}),sdk.checkShoppingRank('키워드',{productId:'https://smartstore.naver.com/s/products/123'})]);
 expect(first.rank).toBe(1);expect(parallel.timestamp).toBe(first.timestamp);expect(state.collect).toHaveBeenCalledTimes(1);
 const match=state.collect.mock.calls[0][3];expect(match([{id:'123',rank:1,title:'',mallName:'',link:''}])).toBe(true);expect(match([{id:'456',rank:1,title:'',mallName:'',link:''}])).toBe(false);
 await vi.advanceTimersByTimeAsync(30000);
 expect(await sdk.checkShoppingRank('키워드',{productId:'123'})).toMatchObject({cached:true,timestamp:first.timestamp});
 vi.resetModules();sdk=await import('./checks');
 expect(await sdk.checkShoppingRank('키워드',{productId:'123'})).toMatchObject({cached:true,timestamp:first.timestamp});expect(state.collect).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(120000);
 await sdk.checkShoppingRank('키워드',{productId:'123'});expect(state.collect).toHaveBeenCalledTimes(2);
 await sdk.checkShoppingRank('다른키워드',{productId:'123'});await sdk.checkShoppingRank('키워드',{productId:'456'});expect(state.collect).toHaveBeenCalledTimes(4);
});
it('caches outside-range results but never caches errors',async()=>{
 const sdk=await import('./checks');state.collect.mockResolvedValue([]);
 expect((await sdk.checkShoppingRank('outside',{productId:'123'})).rank).toBeNull();
 expect((await sdk.checkShoppingRank('outside',{productId:'123'})).cached).toBe(true);expect(state.collect).toHaveBeenCalledTimes(1);
 state.collect.mockRejectedValue(Error('blocked_limit'));
 await expect(sdk.checkShoppingRank('error',{productId:'123'})).rejects.toThrow();
 await expect(sdk.checkShoppingRank('error',{productId:'123'})).rejects.toThrow();expect(state.collect).toHaveBeenCalledTimes(3);
});
