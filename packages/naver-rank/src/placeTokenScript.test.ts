import {it,expect,vi} from 'vitest';
import {runInNewContext} from 'node:vm';
import {placeTokenScript} from './placeTokenScript';
it('captures a successful page token and sends exact headers with page cookies',async()=>{
 const messages:any[]=[];
 const fetch=vi.fn(async()=>({status:200,clone:()=>({json:async()=>[{data:{businesses:{items:[],total:0}}}]}),text:async()=>JSON.stringify([{data:{businesses:{items:[],total:0}}}])}));
 function XHR(){};XHR.prototype.open=function(){};XHR.prototype.setRequestHeader=function(){};XHR.prototype.send=function(){};
 const window:any={fetch,ReactNativeWebView:{postMessage:(s:string)=>messages.push(JSON.parse(s))}};
 runInNewContext(placeTokenScript,{window,Headers,XMLHttpRequest:XHR,btoa,unescape,encodeURIComponent});
 await window.fetch('https://pcmap-api.place.naver.com/graphql',{headers:new Headers({'x-wtm-ncaptcha-token':'ephemeral-test-token'})});
 await new Promise(r=>setTimeout(r,0));
 expect(messages).toEqual([{kind:'ready'}]);
 await window.__placeRequest(7,[{query:'source-query'}],'강남 카페','place');
 const [url,init]=fetch.mock.calls.at(-1)! as unknown as [string,RequestInit];
 expect(url).toBe('https://pcmap-api.place.naver.com/graphql');expect(init.credentials).toBe('include');
 const headers=init.headers as Record<string,string>;expect(headers['x-wtm-ncaptcha-token']).toBe('ephemeral-test-token');
 expect(JSON.parse(Buffer.from(headers['X-Wtm-Graphql'],'base64').toString())).toEqual({arg:'강남 카페',type:'place',source:'place'});
 expect(messages[1]).toMatchObject({kind:'response',id:7,status:200});expect(JSON.stringify(messages)).not.toContain('ephemeral-test-token');
});
