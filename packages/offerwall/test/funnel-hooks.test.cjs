const {test} = require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
test('real screen/view hooks: StrictMode replay, duplicate load, SDK close and unmount emit once', async () => {
 const original=Module._load;let current;const listeners=new Map();
 const react={
  useRef(value){const i=current.cursor++;return current.slots[i]??(current.slots[i]={current:value});},
  useState(value){const h=current;const i=h.cursor++;if(!(i in h.slots))h.slots[i]=value;return [h.slots[i],v=>{h.slots[i]=v}];},
  useEffect(cb,deps){const h=current;const i=h.cursor++;if(!h.slots[i]||deps.some((v,j)=>v!==h.slots[i][j])) {h.slots[i]=deps;h.effects.push(cb);}},
  createElement(type,props){return {type,props}},
 };
 Module._load=function(id,...args){
  if(id==='react')return react;
  if(id==='react-native')return {Platform:{OS:'android'},NativeModules:{RNAdPopcornRewardModule:{}},UIManager:{getViewManagerConfig:()=>({})},requireNativeComponent:()=> 'NativeWall'};
  if(id==='react-native-adpopcorn-reward')return {default:{setUserId(){},addListener(name,cb){listeners.set(name,cb);return {remove(){listeners.delete(name)}}}}};
  return original.call(this,id,...args);
 };
 const harness=()=>({slots:[],cursor:0,effects:[],render(fn){current=this;this.cursor=0;return fn()}});
 try {
  const api=require('../dist');api.configureOfferwall({appKey:'test-app',hashKey:'test-hash'});
  const events=[];api.configureOfferwallFunnel((...e)=>events.push(e));api.setOfferwallFunnelContext('*android','123');
  const screen=harness();const visit=screen.render(()=>api.useChanceFunnel());const se=screen.effects[0];const cleanup=se();cleanup();const screenCleanup=se();
  const view=harness();const props={usn:'a'.repeat(64),funnel:visit};view.render(()=>api.OfferwallView(props));
  const ve=view.effects[0];const dispose=ve();dispose();const viewCleanup=ve();await Promise.resolve();
  const element=view.render(()=>api.OfferwallView(props));assert.equal(element.type,'NativeWall');
  element.props.onLoaded();element.props.onLoaded();listeners.get('OnClosedOfferWallPage')();
  viewCleanup();screenCleanup();await Promise.resolve();
  assert.deepEqual(events,[['chance_tab_open','shown:user:android'],['offerwall_open','loaded:user:android'],['offerwall_close','sdk_close:user:android']]);
 } finally {Module._load=original;}
});
