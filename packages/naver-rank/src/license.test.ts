import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {configure,authorize,recordUsage} from './license';
import {collectWeb} from './webQueue';
let data:Map<string,string>;
const fetcher=vi.fn();
const apiKey=Array.from({length:32},()=>Math.random().toString(36).slice(2,3)).join('');
const appId='kr.co.jcurve.test';
const ok=()=>new Response(JSON.stringify({valid:true,appId,scopes:['sdk_rank'],expiresAt:new Date(Date.now()+10*86400000).toISOString()}));
beforeEach(()=>{data=new Map();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-16T01:00:00Z'));fetcher.mockReset();vi.stubGlobal('fetch',fetcher);configure({apiKey,appId,storage:{getItem:async k=>data.get(k)??null,setItem:async(k,v)=>{data.set(k,v);}}});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('verifies once a day and requires scope, expiry and app binding',async()=>{
 fetcher.mockImplementation(async()=>ok());await authorize();await authorize();expect(fetcher).toHaveBeenCalledTimes(1);
 vi.advanceTimersByTime(86400000);await authorize();expect(fetcher).toHaveBeenCalledTimes(2);
 for(const body of [{valid:false},{valid:true,appId:'other',scopes:['sdk_rank']},{valid:true,appId,scopes:[]}]){
  data.clear();fetcher.mockResolvedValue(new Response(JSON.stringify(body)));await expect(authorize()).rejects.toMatchObject({code:'license_invalid'});
 }
});
it('allows outage grace only up to 24h after daily renewal is due',async()=>{
 fetcher.mockImplementation(async()=>ok());await authorize();fetcher.mockRejectedValue(Error('offline'));
 vi.advanceTimersByTime(25*3600000);await authorize();vi.advanceTimersByTime(24*3600000);await expect(authorize()).rejects.toMatchObject({code:'license_invalid'});
});
it('explicit denial removes grace and key rotation never reuses cache',async()=>{
 fetcher.mockImplementation(async()=>ok());await authorize();vi.advanceTimersByTime(86400000);
 fetcher.mockResolvedValue(new Response('{}',{status:403}));await expect(authorize()).rejects.toMatchObject({code:'license_invalid'});
 fetcher.mockRejectedValue(Error('offline'));await expect(authorize()).rejects.toMatchObject({code:'license_invalid'});
});
it('fails before collecting with missing key',async()=>{
 configure({apiKey:'',appId,storage:{getItem:async()=>null,setItem:async()=>{}}});await expect(collectWeb('shopping','private query')).rejects.toMatchObject({code:'license_invalid'});
});
it('reports only cumulative counts, retries pending days, enforces quota',async()=>{
 fetcher.mockRejectedValueOnce(Error('offline'));await recordUsage('place');vi.advanceTimersByTime(86400000);
 fetcher.mockResolvedValue(new Response('{}'));await recordUsage('shopping');
 const bodies=fetcher.mock.calls.map(c=>JSON.parse(c[1].body));expect(bodies.every(b=>Object.keys(b).sort().join(',')==='appId,date,installationId,place,shopping')).toBe(true);
 expect(bodies.at(-2)).toMatchObject({place:1,shopping:0});expect(bodies.at(-1)).toMatchObject({place:0,shopping:1});
 fetcher.mockResolvedValue(new Response('{}',{status:429}));await expect(recordUsage('place')).rejects.toMatchObject({code:'license_limit'});
});

it('keeps an explicit daily quota denial during offline retry',async()=>{
 fetcher.mockResolvedValue(new Response('{}',{status:429}));await expect(recordUsage('place')).rejects.toMatchObject({code:'license_limit'});
 fetcher.mockRejectedValue(Error('offline'));await expect(recordUsage('shopping')).rejects.toMatchObject({code:'license_limit'});
 expect(fetcher).toHaveBeenCalledTimes(1);
 vi.advanceTimersByTime(86400000);await recordUsage('shopping');
});
it('does not reuse license or usage state after key rotation',async()=>{
 fetcher.mockImplementation(async()=>ok());await authorize();await recordUsage('place');
 configure({apiKey:apiKey+'x',appId,storage:{getItem:async k=>data.get(k)??null,setItem:async(k,v)=>{data.set(k,v);}}});
 fetcher.mockRejectedValue(Error('offline'));await expect(authorize()).rejects.toMatchObject({code:'license_invalid'});
});
