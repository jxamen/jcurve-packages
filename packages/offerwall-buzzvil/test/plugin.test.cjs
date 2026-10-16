const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const original=Module._load;
let mods;
Module._load=function(id,...args){
 if(id==='expo/config-plugins')return Object.fromEntries(['withProjectBuildGradle','withInfoPlist'].map(name=>[name,(config,callback)=>{mods[name]=callback;return config}]));
 return original.call(this,id,...args);
};
const plugin=require('../app.plugin');Module._load=original;
test('Expo plugin preserves ATT text and adds all required v6 mediation repositories once',()=>{
 mods={};plugin({});
 const plist={modResults:{NSUserTrackingUsageDescription:'existing user-approved text'}};
 mods.withInfoPlist(plist);assert.equal(plist.modResults.NSUserTrackingUsageDescription,'existing user-approved text');
 const gradle={modResults:{language:'groovy',contents:'allprojects { repositories { google(); mavenCentral() } }'}};
 mods.withProjectBuildGradle(gradle);const first=gradle.modResults.contents;mods.withProjectBuildGradle(gradle);
 assert.equal(gradle.modResults.contents,first);
 for(const host of ['dl.buzzvil.com','devrepo.kakao.com','cauly.github.io','artifact.bytedance.com'])assert.ok(first.includes(host));
 assert.throws(()=>mods.withProjectBuildGradle({modResults:{language:'kotlin',contents:''}}),/Groovy/);
});
