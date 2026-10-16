import {afterEach,expect,it,vi} from 'vitest';
vi.mock('./license',()=>({storage:()=>({getItem:async()=>null,setItem:async()=>{}}),authorize:vi.fn(async()=>{}),recordUsage:vi.fn(async()=>{})}));
import {collectWeb,attachCollector} from './webQueue';
afterEach(()=>vi.useRealTimers());
it('aborts an active collection at 90 seconds including manual or retry waits',async()=>{
 vi.useFakeTimers();let signal:AbortSignal|undefined;
 const detach=attachCollector(job=>{signal=job.signal;});
 const result=collectWeb('shopping','검색');
 const rejected=expect(result).rejects.toMatchObject({code:'timeout'});
 await vi.advanceTimersByTimeAsync(89999);expect(signal?.aborted).toBe(false);
 await vi.advanceTimersByTimeAsync(1);await rejected;expect(signal?.aborted).toBe(true);detach();
 await vi.runAllTimersAsync();
});
it('expires queued jobs without starting another WebView',async()=>{
 vi.useFakeTimers();const handler=vi.fn();const detach=attachCollector(handler);
 const first=collectWeb('shopping','첫째');const second=collectWeb('shopping','둘째');
 const checks=[expect(first).rejects.toMatchObject({code:'timeout'}),expect(second).rejects.toMatchObject({code:'timeout'})];
 await vi.advanceTimersByTimeAsync(90000);await Promise.all(checks);await vi.runAllTimersAsync();expect(handler).toHaveBeenCalledTimes(1);detach();
});
