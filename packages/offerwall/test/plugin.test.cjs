const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
let mods;
Module._load = function(id, ...args) {
  if (id === 'expo/config-plugins') return Object.fromEntries(['withAndroidManifest', 'withInfoPlist', 'withAppDelegate'].map(name => [name, (config, callback) => {
    mods[name] = callback;
    return config;
  }]));
  return original.call(this, id, ...args);
};
const plugin = require('../app.plugin');
Module._load = original;
function manifest(ready) {
  mods = {};
  const config = plugin({}, ready ? { appKey: 'test-app', hashKey: 'test-hash' } : {});
  const modResults = { manifest: { application: [{ 'meta-data': [{ $: { 'android:name': 'other', 'android:value': 'kept' } }] }] } };
  mods.withAndroidManifest({ modResults });
  return { config, app: modResults.manifest.application[0] };
}
test('Android keys and server mode are idempotent and preserve other metadata', () => {
  const { app } = manifest(true);
  const mod = { modResults: { manifest: { application: [app] } } };
  mods.withAndroidManifest(mod);
  const rows = app['meta-data'];
  assert.equal(rows.length, 4);
  assert.equal(rows.find(x => x.$['android:name'] === 'adpopcorn_reward_server_type').$['android:value'], 'server');
  const ios = { modResults: {} };
  mods.withInfoPlist(ios);
  assert.ok(ios.modResults.NSUserTrackingUsageDescription);
});
test('no keys adds no native settings', () => {
  const { app } = manifest(false);
  assert.equal(app['meta-data'].length, 1);
  const ios = { modResults: {} };
  mods.withInfoPlist(ios);
  assert.deepEqual(ios.modResults, {});
});
test('Swift and ObjC server mode inserted once and removable', () => {
  for (const [language, source] of [
    ['swift', 'import Expo\nfunc application() -> Bool {\n  return super.application(application, didFinishLaunchingWithOptions: launchOptions)\n}\n'],
    ['objc', '#import "AppDelegate.h"\n- (BOOL)application {\n  return [super application:application didFinishLaunchingWithOptions:launchOptions];\n}\n'],
  ]) {
    const first = plugin.setServerMode(source, language, true);
    assert.match(first, /useAdPopcornRewardServer/);
    assert.equal(plugin.setServerMode(first, language, true), first);
    assert.equal(plugin.setServerMode(first, language, false), source);
  }
});
