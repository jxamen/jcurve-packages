import {beforeEach,expect,it,vi} from 'vitest';
const storage=vi.hoisted(()=>({getItem:vi.fn(),setItem:vi.fn()}));
vi.mock('./license',()=>({storage:()=>storage,authorize:async()=>{},recordUsage:async()=>{}}));
import {limitAction,randomDelay,recordLimit} from './webThrottle';
beforeEach(()=>{vi.resetAllMocks();});
it('bounds the retry and product gaps',()=>{
 expect(randomDelay(30,90,()=>0)).toBe(30000);
 expect(randomDelay(30,90,()=>1)).toBe(90000);
 expect(randomDelay(20,40,()=>0)).toBe(20000);
 expect(randomDelay(20,40,()=>1)).toBe(40000);
});
it('allows exactly one retry and suppresses same-day repeated 429s',()=>{
 expect(limitAction(null,'2026-10-16',false)).toBe('retry');
 expect(limitAction('2026-10-15','2026-10-16',false)).toBe('retry');
 expect(limitAction('2026-10-16','2026-10-16',false)).toBe('stop');
 expect(limitAction(null,'2026-10-16',true)).toBe('stop');
});
it('persists the day before retry and fails closed on persistence errors',async()=>{
 storage.getItem.mockResolvedValue(null);storage.setItem.mockResolvedValue(undefined);
 expect(await recordLimit(false)).toBe('retry');
 const day=storage.setItem.mock.calls[0][1];storage.getItem.mockResolvedValue(day);
 expect(await recordLimit(false)).toBe('stop');
 storage.getItem.mockRejectedValue(Error('disk'));
 expect(await recordLimit(false)).toBe('stop');
});

import {attachCollector,collectWeb} from './webQueue';
it('serializes queued shopping jobs with the product cooldown after success and failure',async()=>{
 vi.useFakeTimers();const random=vi.spyOn(Math,'random').mockReturnValue(0.5);
 const seen:string[]=[];const detach=attachCollector(job=>{seen.push(job.keyword);if(job.keyword==='second')job.reject(Error('blocked'));else job.resolve([]);});
 try{
  const first=collectWeb('shopping','first');
  const second=collectWeb('shopping','second');const failed=expect(second).rejects.toThrow('blocked');
  const third=collectWeb('shopping','third');
  await vi.advanceTimersByTimeAsync(0);await first;expect(seen).toEqual(['first']);
  await vi.advanceTimersByTimeAsync(29999);expect(seen).toEqual(['first']);
  await vi.advanceTimersByTimeAsync(1);await failed;expect(seen).toEqual(['first','second']);
  await vi.advanceTimersByTimeAsync(30000);await third;expect(seen).toEqual(['first','second','third']);
  await vi.runAllTimersAsync();
 }finally{detach();random.mockRestore();vi.useRealTimers();}
});
