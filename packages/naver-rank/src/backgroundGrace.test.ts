import {afterEach,expect,it,vi} from 'vitest';
import {backgroundGrace} from './backgroundGrace';
import {CollectorError} from './webQueue';
afterEach(()=>vi.useRealTimers());
function collection(){
 let resolve!:(value:string)=>void,reject!:(e:Error)=>void;
 const result=new Promise<string>((yes,no)=>{resolve=yes;reject=no;});
 const fail=vi.fn(()=>reject(new CollectorError('background')));
 const grace=backgroundGrace(fail);
 return {result,fail,grace,complete:()=>{grace.dispose();resolve('success');}};
}
it('ignores inactive, preserves the job through brief background and succeeds after active',async()=>{
 vi.useFakeTimers();const c=collection();
 c.grace.change('inactive');await vi.advanceTimersByTimeAsync(11000);expect(c.fail).not.toHaveBeenCalled();
 c.grace.change('background');await vi.advanceTimersByTimeAsync(9999);
 c.grace.change('active');await vi.advanceTimersByTimeAsync(10000);
 c.complete();await expect(c.result).resolves.toBe('success');expect(c.fail).not.toHaveBeenCalled();
});
it('fails at ten seconds in background despite duplicate or inactive events',async()=>{
 vi.useFakeTimers();const c=collection();const rejected=expect(c.result).rejects.toMatchObject({code:'background'});
 c.grace.change('background');await vi.advanceTimersByTimeAsync(5000);
 c.grace.change('background');c.grace.change('inactive');await vi.advanceTimersByTimeAsync(4999);expect(c.fail).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(1);await rejected;expect(c.fail).toHaveBeenCalledTimes(1);c.grace.dispose();
});
it('uses a fresh grace period after active and cancels timers on completion',async()=>{
 vi.useFakeTimers();const c=collection();
 c.grace.change('background');await vi.advanceTimersByTimeAsync(9000);c.grace.change('active');
 c.grace.change('background');await vi.advanceTimersByTimeAsync(9000);expect(c.fail).not.toHaveBeenCalled();
 c.complete();c.grace.change('background');await vi.runAllTimersAsync();
 await expect(c.result).resolves.toBe('success');expect(c.fail).not.toHaveBeenCalled();
});
