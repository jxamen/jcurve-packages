// Run with STEPS_TOOLS pointing to an installation of esbuild, playwright, React and react-native-web.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.STEPS_TOOLS + '/package.json');
const { build } = require('esbuild');
const { chromium } = require('playwright');
const base = process.cwd();
const original = process.env.CARROT_SOURCE;
const out = process.env.STEPS_OUT;
const fixture = `export const state = { ok:true,day:'2026-10-20',today_steps:3450,daily_max:25,earned_today:10,stages:[1000,2000,3000,4000,5000].map((threshold,i)=>({stage_id:String(i),threshold,points:5,claimed:i<2,available:true,ad_purpose:'steps_'+i})) };`;
const mocks = {
 source: `export const readToday=async()=>({status:'ready',steps:3450,days:[],sensorOnly:false}); export const watchSteps=()=>()=>{}; export const requestStepsPermission=async()=> 'granted';`,
 '@jcurve/steps': `export {canClaimStage} from '${base}/packages/steps/src/stages'; export {syncToday} from '${base}/packages/steps/src/sync'; export const configureStepsStorage=()=>{}; export const readToday=async()=>({status:'ready',steps:3450,days:[],sensorOnly:false}); export const watchSteps=()=>()=>{}; export const requestStepsPermission=async()=> 'granted';`,
 '../storage': 'export const getJson=async()=>null; export const setJson=async()=>{};',
 '../api': fixture + ` export class ApiError extends Error {} export const fetchStepsStages=async()=>state;export const claimStepsStage=async()=>({...state,gained:5,balance:15});export const syncSteps=async()=>({});`,
 '../ads/flow': `export const adSeen=async()=>false;export const showAd=async()=>({earned:true});export const withSsv=f=>f();export const sayError=()=>'';`,
 '../store': `export const useApp=()=>({member:{id:1},refresh:async()=>{},holdClaim:()=>{},settleClaim:()=>{}});`,
 '../stepsGate': `export const ensureStepsVersion=async()=>true;`,
 './HarvestNative': `import React from 'react';import {View,Text} from 'react-native';export function HarvestNative(){return <View style={{marginTop:16,marginHorizontal:16,height:100,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'}}><Text>네이티브 광고 영역 (동일 슬롯)</Text></View>}`,
 '../ads/config': 'export const ADMOB={};',
};
const plugin = { name:'fixture', setup(b) {
 b.onResolve({filter:/.*/},args=> {
 if(args.path==='react' || args.path.startsWith('react/')) return {path:require.resolve(args.path)};
 if(args.path==='react-native') return {path:require.resolve('react-native-web')};
 if(args.path==='./source' && args.importer.endsWith('StepsScreen.tsx')) return {path:'source',namespace:'mock'};
 if(mocks[args.path]) return {path:args.path,namespace:'mock'};
 if(args.path==='../ui/PageHeader') return {path:path.dirname(original)+'/../ui/PageHeader.tsx'};
 if(args.path==='../ui/theme') return {path:path.dirname(original)+'/../ui/theme.ts'};
 });
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:base}));
}};
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {View} from 'react-native';import {StepsScreen as Carrot} from '${original}';import {StepsScreen as Package} from '${base}/packages/steps/src/StepsScreen';import {HarvestNative} from './HarvestNative';${fixture}const api={fetchStages:async()=>state,claimStage:async()=>({...state,gained:5,balance:15}),sync:async()=>({})};createRoot(document.getElementById('root')).render(<div style={{display:'flex'}}><div style={{width:390,height:844,display:'flex'}}><Carrot onClose={()=>{}}/></div><div style={{width:390,height:844,display:'flex'}}><Package api={api} memberId={1} showRewardedAd={async()=>({earned:true})} onClose={()=>{}} adSlot={<HarvestNative/>}/></div></div>);`;
await build({stdin:{contents:entry,loader:'tsx',resolveDir:base},bundle:true,outfile:out+'/compare.js',plugins:[plugin],nodePaths:[process.env.STEPS_TOOLS+'/node_modules'],define:{'process.env.NODE_ENV':'"production"'},jsx:'automatic'});
fs.writeFileSync(out+'/compare.html',`<html><meta charset="utf-8"><style>html,body{margin:0}#root{height:844px}</style><div id="root"></div><script src="compare.js"></script></html>`);
const browser=await chromium.launch({headless:true}); const page=await browser.newPage({viewport:{width:780,height:844},deviceScaleFactor:1});
page.on('pageerror', e=>console.error(e)); page.on('console',m=>console.log(m.text()));
await page.goto('file://'+out+'/compare.html'); await page.waitForTimeout(1500); await page.screenshot({path:out+'/compare-carrot-vs-package.png'});
const boxes=await page.locator('#root > div > div').evaluateAll(nodes=>nodes.map(n=>n.innerText));
fs.writeFileSync(out+'/compare-text.json',JSON.stringify(boxes,null,2)); await browser.close();
