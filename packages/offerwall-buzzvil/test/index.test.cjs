const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const original=Module._load, fetchBefore=global.fetch;
let opened=0, reset=0, linked=true, os='ios';
const bridge={open:async()=>{opened++},reset:()=>{reset++}};
function api(){
 opened=0; reset=0; linked=true; os='ios';
 Module._load=function(id,...args){if(id==='react-native')return {Platform:{OS:os},NativeModules:linked?{JCurveBuzzvil:bridge}:{}};return original.call(this,id,...args)};
 delete require.cache[require.resolve('../dist')];return require('../dist');
}
afterEach(()=>{Module._load=original;global.fetch=fetchBefore});
const good={ok:true,config:{ios:{appId:'test-app',unitId:'test-unit'},android:{appId:'android-app',unitId:'android-unit'}}};
const opts={configUrl:'https://api.test/config/buzzvil',headers:{'X-App-Token':'test-token'}};
test('missing keys or module never invoke native open',async()=>{
 const a=api();assert.equal((await a.openOfferwall({usn:'a'.repeat(64)})).reason,'not_ready');
 for(const body of [{ok:true,config:{}},{ok:true,config:{ios:{appId:'test'}}},good]){
  if(body===good)linked=false;global.fetch=async()=>({ok:true,json:async()=>body});
  assert.equal((await a.initializeOfferwall(opts)).reason,'not_ready');assert.equal(opened,0);
 }
});
test('OS isolation, alias validation and native open',async()=>{
 const a=api();global.fetch=async()=>({ok:true,json:async()=>good});
 assert.deepEqual(await a.initializeOfferwall(opts),{ok:true});
 assert.equal((await a.openOfferwall({usn:'user@example.com'})).reason,'invalid_usn');
 assert.deepEqual(await a.openOfferwall({usn:'a'.repeat(64)}),{ok:true});assert.equal(opened,1);
 os='web';assert.equal((await a.initializeOfferwall(opts)).reason,'not_ready');
});
test('reset invalidates in-flight settings and previously usable keys',async()=>{
 const a=api();let done;global.fetch=()=>new Promise(r=>{done=r});
 const loading=a.initializeOfferwall(opts);a.resetOfferwall();done({ok:true,json:async()=>good});
 assert.equal((await loading).reason,'not_ready');assert.equal((await a.openOfferwall({usn:'a'.repeat(64)})).reason,'not_ready');assert.ok(reset>=2);
});
test('failed refresh clears usable keys',async()=>{
 const a=api();global.fetch=async()=>({ok:true,json:async()=>good});await a.initializeOfferwall(opts);
 global.fetch=async()=>{throw Error('offline')};assert.equal((await a.initializeOfferwall(opts)).reason,'not_ready');
 assert.equal((await a.openOfferwall({usn:'a'.repeat(64)})).reason,'not_ready');assert.equal(opened,0);
});
