const {test, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const f = require('../dist/funnel');
afterEach(() => f.resetOfferwallFunnelContext());
test('one entry, SDK result, close despite duplicate callbacks and close paths', () => {
 const events=[]; f.setOfferwallFunnelContext('*android;123',123);
 const v=f.createChanceFunnel((...e)=>events.push(e));
 v.enter();v.enter();const a=v.begin('android');a.loaded();a.loaded();a.fail('sdk_error');v.close();v.close();
 assert.deepEqual(events,[['chance_tab_open','shown:test:android'],['offerwall_open','loaded:test:android'],['offerwall_close','screen_exit:test:android']]);
});
test('each retry gets one terminal result and stale callbacks cannot change it', () => {
 const events=[];const v=f.createChanceFunnel((...e)=>events.push(e));v.enter();
 const first=v.begin('android');first.fail('not_ready');const second=v.begin('android');first.loaded();second.loaded();v.close();
 assert.deepEqual(events.map(e=>e[1].split(':')[0]),['shown','not_ready','loaded','screen_exit']);
});
test('leaving during load cancels once; no SDK invocation means no invented open', () => {
 const events=[];const v=f.createChanceFunnel((...e)=>events.push(e));v.enter();const a=v.begin('ios');v.close();a.loaded();
 assert.equal(events[1][1],'cancelled:unknown:unknown');
 const w=f.createChanceFunnel((...e)=>events.push(e));w.enter();w.close();assert.equal(events.filter(e=>e[0]==='offerwall_open').length,1);
});
test('iOS attachment is never labeled campaign load', () => {
 const events=[];const v=f.createChanceFunnel((...e)=>events.push(e));v.enter();v.begin('ios').loaded();v.close();assert.equal(events[1][1],'attached:unknown:unknown');
});
test('synchronous and asynchronous sender errors do not affect flow', async () => {
 for(const sender of [()=>{throw Error('offline')},()=>Promise.reject(Error('offline'))]) {
  const v=f.createChanceFunnel(sender);assert.doesNotThrow(()=>{v.enter();v.begin('android').loaded();v.close()});
 }
 await new Promise(resolve=>setImmediate(resolve));
});
test('context strips identity and list; public tokens are not tester identities', () => {
 for(const [raw,id,expected] of [['*android,123',456,'user:android'],['* 123',123,'test:all'],['*ios;*android',123,'user:both'],['123',123,'test:list'],['',123,'user:off'],[null,123,'unknown:unknown']]) {
  f.setOfferwallFunnelContext(raw,id);let prop;const v=f.createChanceFunnel((e,p)=>prop=p);v.enter();assert.equal(prop,'shown:'+expected);assert.ok(prop.length<=40);v.close();
 }
});
test('timeout is terminal and a delayed success does not double count', t => {
 t.mock.timers.enable({apis:['setTimeout']});const events=[];const v=f.createChanceFunnel((...e)=>events.push(e));v.enter();const a=v.begin('android');t.mock.timers.tick(20001);a.loaded();v.close();assert.equal(events.length,3);assert.equal(events[1][1],'timeout:unknown:unknown');
});
