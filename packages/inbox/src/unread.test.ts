import { expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({ count: 0, effect: undefined as undefined | (() => any), active: undefined as undefined | ((state:string)=>void) }));
vi.mock('react', () => ({ default: {}, useState: () => [harness.count, (n:number) => { harness.count=n; }], useEffect: (fn:()=>any) => { harness.effect=fn; } }));
vi.mock('react-native', () => ({ AppState: { addEventListener: (_:string, fn:(state:string)=>void) => { harness.active=fn; return {remove:vi.fn()}; } } }));
import { useInboxUnread } from './index';
import { createInboxApi } from './core';
const flush = async () => { for(let i=0;i<8;i++) await Promise.resolve(); };
it('starts at zero, keeps prior count for failures, clears missing routes, and ignores stale results after cleanup', async () => {
 harness.count=0;
 const unread=vi.fn().mockRejectedValue(new Error('network'));
 const api={unread,list:vi.fn(),read:vi.fn()};
 expect(useInboxUnread(api)).toBe(0); const cleanup=harness.effect!(); await flush(); expect(harness.count).toBe(0);
 unread.mockResolvedValue(7); harness.active!('active'); await flush(); expect(harness.count).toBe(7);
 unread.mockRejectedValue({status:500}); harness.active!('active'); await flush(); expect(harness.count).toBe(7);
 unread.mockRejectedValue({status:404}); harness.active!('active'); await flush(); expect(harness.count).toBe(0);
 cleanup(); unread.mockResolvedValue(9); harness.active!('active'); await flush(); expect(harness.count).toBe(0);
});
it.each([{status:404},{statusCode:501},{response:{status:405}},{code:'http_404'},new Error('HTTP 501'),{ok:false,error:'not_found'}])('clears badge through adapter for %j', async err => {
 harness.count=8;
 useInboxUnread(createInboxApi(vi.fn().mockRejectedValue(err))); const cleanup=harness.effect!(); await flush(); expect(harness.count).toBe(0); cleanup();
});
