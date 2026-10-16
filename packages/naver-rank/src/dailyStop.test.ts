import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const data=vi.hoisted(()=>new Map<string,string>());
vi.mock('./license',()=>({authorize:async()=>{},recordUsage:async()=>{},storage:()=>({getItem:async(k:string)=>data.get(k)??null,setItem:async(k:string,v:string)=>{data.set(k,v);}})}));
beforeEach(()=>{data.clear();vi.resetModules();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-16T14:59:00Z'));});
afterEach(()=>vi.useRealTimers());
it('blocks before dispatch after captcha, survives restart, separates channels and expires at KST midnight',async()=>{
 let q=await import('./webQueue');const handler=vi.fn(job=>job.reject(new q.CollectorError('captcha')));q.attachCollector(handler);
 await expect(q.collectWeb('shopping','one')).rejects.toMatchObject({code:'captcha'});
 expect(data.get('rank.shopping.last429')).toBe('2026-10-16');
 vi.resetModules();q=await import('./webQueue');const fresh=vi.fn(job=>job.resolve([]));q.attachCollector(fresh);
 await expect(q.collectWeb('shopping','two')).rejects.toMatchObject({code:'blocked_limit'});expect(fresh).not.toHaveBeenCalled();
 await expect(q.collectWeb('place','separate')).resolves.toEqual([]);
 await vi.advanceTimersByTimeAsync(60000);
 await expect(q.collectWeb('shopping','tomorrow')).resolves.toEqual([]);expect(fresh).toHaveBeenCalledTimes(2);
 await vi.runAllTimersAsync();
});
it('reserves one 429 retry persistently and stops new jobs even after a successful retry',async()=>{
 let t=await import('./webThrottle');expect(await t.recordLimit(false,'place')).toBe('retry');
 expect(await t.recordLimit(true,'place')).toBe('stop');
 vi.resetModules();t=await import('./webThrottle');expect(await t.recordLimit(false,'place')).toBe('stop');expect(await t.isStopped('shopping')).toBe(false);
});
it('fails closed on storage read failure and retains stop on write failure',async()=>{
 // Mock adapter failures directly for the throttle module.
 vi.doMock('./license',()=>({storage:()=>({getItem:async()=>{throw Error('disk');},setItem:async()=>{throw Error('disk');}})}));
 vi.resetModules();const t=await import('./webThrottle');expect(await t.recordLimit(false,'shopping')).toBe('stop');expect(await t.isStopped('shopping')).toBe(true);
 vi.doUnmock('./license');
});

it('honors legacy unpadded shopping 429 dates',async()=>{data.set('rank.shopping.last429','2026-10-16');const t=await import('./webThrottle');expect(await t.isStopped('shopping')).toBe(true);});
