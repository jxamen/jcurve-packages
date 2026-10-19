import { describe, expect, it, vi } from 'vitest';
import { createInboxApi, createInboxStore, relativeTime, type InboxItem } from './core';
const item: InboxItem = { id: 1, kind: 'general', title: '제목', body: '본문', data: {}, link: null, read: false, readAt: null, sentAt: '2026-10-20T12:00:00+09:00' };
const setup = () => { const api = { list: vi.fn().mockResolvedValue({ ok: true, items: [item], unread: 1, next: 30 }), unread: vi.fn().mockResolvedValue(0), read: vi.fn().mockResolvedValue(0) }; return { api, store: createInboxStore(api) }; };
describe('api', () => {
 it('uses exact push-inbox paths, cursor and explicit ids', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, items: [], unread: 2 }); const api = createInboxApi(fetch);
  await api.list(); await api.list(0); expect(await api.unread()).toBe(2); expect(await api.read([1,2])).toBe(2);
  expect(fetch.mock.calls).toEqual([['GET','me/push-inbox'],['GET','me/push-inbox?cursor=0'],['GET','me/push-inbox/unread'],['POST','me/push-inbox/read',{ids:[1,2]}]]);
 });
 it('supports a custom base path for every endpoint', async () => {
  const fetch = vi.fn().mockResolvedValue({ok:true,items:[],unread:1}); const api = createInboxApi(fetch,{basePath:'custom/inbox/'});
  await api.list(30); await api.unread(); await api.read([1],true);
  expect(fetch.mock.calls).toEqual([['GET','custom/inbox?cursor=30'],['GET','custom/inbox/unread'],['POST','custom/inbox/read',{ids:[1]}]]);
 });
 it('never calls fetch for empty or omitted ids, even with all=true', async () => {
  const fetch = vi.fn().mockResolvedValue({ok:true,items:[],unread:7}); const api = createInboxApi(fetch);
  expect(await api.read([])).toBe(0); expect(fetch).not.toHaveBeenCalled();
  await api.list(); fetch.mockClear();
  for (const ids of [[], undefined]) for (const all of [false,true]) expect(await api.read(ids,all)).toBe(7);
  expect(await api.read()).toBe(7); expect(fetch).not.toHaveBeenCalled();
 });
 it('rejects unsuccessful responses', async () => { await expect(createInboxApi(async () => ({ok:false})).list()).rejects.toThrow(); });
});
describe('relative time', () => {
 const now = new Date('2026-10-20T12:00:00+09:00');
 it.each([[59,'방금'],[59*60,'59분 전'],[23*3600,'23시간 전'],[25*3600,'어제'],[48*3600,'10월 18일']])('%s seconds', (seconds, text) => expect(relativeTime(new Date(+now-seconds*1000).toISOString(),now)).toBe(text));
 it('handles different year', () => expect(relativeTime('2025-12-31T12:00:00+09:00',new Date('2026-01-02T12:00:00+09:00'))).toBe('12월 31일'));
 it('handles minute and hour boundaries', () => { expect(relativeTime(new Date(+now-60000).toISOString(),now)).toBe('1분 전'); expect(relativeTime(new Date(+now-3600000).toISOString(),now)).toBe('1시간 전'); });
});
describe('screen state', () => {
 it('removes destination rows immediately and opens once', async () => { const {api,store}=setup(); await store.load(); const open=vi.fn(); const row={...item,data:{screen:'shopping'}}; let resolve!: (n:number)=>void; api.read.mockImplementation(()=>new Promise(r=>resolve=r)); store.press(row,open); expect(store.getSnapshot().items).toEqual([]); expect(store.getSnapshot().unread).toBe(0); expect(open).toHaveBeenCalledWith(row); store.press(row,open); expect(open).toHaveBeenCalledTimes(1); resolve(0); });
 it('expands ordinary rows then removes on collapse without opening', async () => { const {api,store}=setup(); await store.load(); const open=vi.fn(); store.press(item,open); expect(store.getSnapshot().expanded).toEqual([1]); expect(store.getSnapshot().items).toHaveLength(1); expect(api.read).not.toHaveBeenCalled(); store.press(item,open); expect(store.getSnapshot().items).toEqual([]); expect(api.read).toHaveBeenCalledWith([1],false); expect(open).not.toHaveBeenCalled(); });
 it('reads expanded rows when leaving only once', async () => { const {api,store}=setup(); await store.load(); store.press(item,vi.fn()); store.leave(); store.leave(); expect(store.getSnapshot().items).toEqual([]); expect(api.read).toHaveBeenCalledTimes(1); });
 it('does not read collapsed rows when leaving', async () => { const {api,store}=setup(); await store.load(); store.leave(); expect(api.read).not.toHaveBeenCalled(); });
 it.each(['go','url','screen'])('opens destination %s', async key => { const {store}=setup(); await store.load(); const open=vi.fn(); store.press({...item,data:{[key]:'target'}},open); expect(open).toHaveBeenCalledTimes(1); });
 it('keeps removed rows hidden in stale list responses', async () => { const {store}=setup(); await store.load(); await store.markRead(item); await store.load(); expect(store.getSnapshot().items).toEqual([]); });
 it('keeps removal when unread refresh fails', async () => { const {api,store}=setup(); await store.load(); api.unread.mockRejectedValue(Error()); await store.markRead(item); expect(store.getSnapshot().items).toEqual([]); expect(store.getSnapshot().error).toBe(false); });
 it('uses next cursor, deduplicates and stops at end', async () => { const {api,store}=setup(); await store.load(); api.list.mockResolvedValueOnce({ok:true,items:[item,{...item,id:2}],unread:1}); await store.load(true); expect(api.list).toHaveBeenLastCalledWith(30); expect(store.getSnapshot().items).toHaveLength(2); await store.load(true); expect(api.list).toHaveBeenCalledTimes(2); });
 it('handles empty inbox', async () => { const {api,store}=setup(); api.list.mockResolvedValue({ok:true,items:[],unread:0}); await store.load(); expect(store.getSnapshot()).toMatchObject({items:[],unread:0,error:false,loading:false}); });
 it('handles errors and retry', async () => { const {api,store}=setup(); api.list.mockRejectedValueOnce(Error()); await store.load(); expect(store.getSnapshot().error).toBe(true); await store.load(); expect(store.getSnapshot().error).toBe(false); });
 it('rolls back a failed optimistic read', async () => { const {api,store}=setup(); await store.load(); api.read.mockRejectedValueOnce(Error()); await store.markRead(item); expect(store.getSnapshot()).toMatchObject({unread:1,error:true}); expect(store.getSnapshot().items[0]).toEqual(item); });
 it('ignores stale pages after a refresh', async () => { const {api,store}=setup(); let resolve!: (v:any)=>void; api.list.mockImplementationOnce(()=>new Promise(r=>resolve=r)); const first=store.load(); await store.load(); resolve({ok:true,items:[],unread:0}); await first; expect(store.getSnapshot().items).toHaveLength(1); });
});

const missingErrors = [
 ...['status', 'statusCode'].flatMap(key => [404, 501, 405].map(status => ({ [key]: status }))),
 ...[404, 501, 405].map(status => ({ response: { status } })),
 ...['http_404', 'http_501', 'not_found'].map(code => ({ code })),
 new Error('HTTP 404 missing'), new Error('HTTP 501 missing'),
 { ok: false, error: 'not_found' }, { response: { data: { ok: false, error: 'not_found' } } },
];
describe('missing routes', () => {
 it.each(missingErrors)('returns empty list and zero unread for %j', async err => {
  const api = createInboxApi(vi.fn().mockRejectedValue(err));
  expect(await api.list()).toEqual({ok:true,items:[],unread:0});
  expect(await api.unread()).toBe(0);
  const store = createInboxStore(api); await store.load();
  expect(store.getSnapshot()).toMatchObject({items:[],unread:0,error:false,loading:false});
 });
 it.each(missingErrors)('handles directly implemented APIs for %j', async err => {
  const {api,store}=setup(); await store.load();
  api.list.mockRejectedValue(err); await store.load();
  expect(store.getSnapshot()).toMatchObject({items:[],expanded:[],unread:0,next:undefined,error:false,loading:false});
 });
 it.each(missingErrors)('preserves last unread when read route is missing for %j', async err => {
  const fetch = vi.fn().mockResolvedValueOnce({ok:true,items:[],unread:7}).mockRejectedValue(err);
  const api = createInboxApi(fetch); await api.list(); expect(await api.read([1])).toBe(7);
 });
 it('handles parsed not_found responses on every endpoint', async () => {
  const api = createInboxApi(async () => ({ok:false,error:'not_found'}));
  expect(await api.list()).toEqual({ok:true,items:[],unread:0});
  expect(await api.unread()).toBe(0); expect(await api.read([1])).toBe(0);
 });
 it.each([{status:500},{status:502},{status:401},{status:403},new Error('Network request failed'),new Error('1404 5010')])('preserves real errors for %j', async err => {
  const api = createInboxApi(vi.fn().mockRejectedValue(err));
  await expect(api.list()).rejects.toBe(err); await expect(api.unread()).rejects.toBe(err); await expect(api.read([1])).rejects.toBe(err);
  const store=createInboxStore(api); await store.load(); expect(store.getSnapshot().error).toBe(true);
 });
});
