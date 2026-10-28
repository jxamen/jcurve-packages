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
test('no Android keys still configures iOS server mode and ATT', () => {
  const { app } = manifest(false);
  assert.equal(app['meta-data'].length, 1);
  const ios = { modResults: {} };
  mods.withInfoPlist(ios);
  assert.ok(ios.modResults.NSUserTrackingUsageDescription);
  const delegate = { modResults: { language: 'swift', contents: 'return super.application(application)' } };
  mods.withAppDelegate(delegate);
  assert.match(delegate.modResults.contents, /useAdPopcornRewardServer = false/);
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

test('SnapPlay (0.5.0): off by default when the package is not installed — no photo or camera strings are added', () => {
  mods = {};
  plugin({}, {});
  const ios = { modResults: {} };
  mods.withInfoPlist(ios);
  assert.equal(ios.modResults.NSPhotoLibraryUsageDescription, undefined);
  assert.equal(ios.modResults.NSCameraUsageDescription, undefined);
});

test('SnapPlay (0.5.0): snapPlay:true adds the photo and camera strings, keeps the app\'s own, and is idempotent', () => {
  mods = {};
  plugin({}, { snapPlay: true, photoPermission: '사진 문구' });
  const ios = { modResults: { NSCameraUsageDescription: '앱이 이미 쓰는 카메라 문구' } };
  mods.withInfoPlist(ios);
  assert.equal(ios.modResults.NSPhotoLibraryUsageDescription, '사진 문구');
  assert.equal(ios.modResults.NSCameraUsageDescription, '앱이 이미 쓰는 카메라 문구');
  assert.ok(ios.modResults.NSUserTrackingUsageDescription);
  const again = JSON.stringify(ios.modResults);
  mods.withInfoPlist(ios);
  assert.equal(JSON.stringify(ios.modResults), again);
  mods = {};
  plugin({}, { snapPlay: true });
  const fresh = { modResults: {} };
  mods.withInfoPlist(fresh);
  assert.ok(fresh.modResults.NSPhotoLibraryUsageDescription && fresh.modResults.NSCameraUsageDescription);
});

test('SnapPlay (0.5.0): snapPlay:false never adds them, even if the package is installed', () => {
  mods = {};
  plugin({}, { snapPlay: false });
  const ios = { modResults: {} };
  mods.withInfoPlist(ios);
  assert.equal(ios.modResults.NSPhotoLibraryUsageDescription, undefined);
});

test('SnapPlay (0.5.0): a build setting below the SDK minimum fails the prebuild with the reason', () => {
  const withProps = (props) => ({ plugins: [['expo-build-properties', props]] });
  assert.throws(() => plugin(withProps({ ios: { deploymentTarget: '15.1' } }), { snapPlay: true }), /deploymentTarget is 15\.1; SnapPlay needs 16\.0/);
  assert.throws(() => plugin(withProps({ android: { minSdkVersion: 23 } }), { snapPlay: true }), /minSdkVersion is 23; SnapPlay needs 24/);
  assert.doesNotThrow(() => plugin(withProps({ ios: { deploymentTarget: '16.4' }, android: { minSdkVersion: 26 } }), { snapPlay: true }));
  assert.doesNotThrow(() => plugin(withProps({ ios: { deploymentTarget: '16' } }), { snapPlay: true }));
  assert.doesNotThrow(() => plugin({}, { snapPlay: true }), 'nothing set = the Expo/React Native default, which is above both');
  assert.doesNotThrow(() => plugin(withProps({ ios: { deploymentTarget: '15.1' } }), { snapPlay: false }));
  assert.deepEqual(plugin.snapPlayBuildProblems(withProps({ ios: { deploymentTarget: '15.1' }, android: { minSdkVersion: 21 } })).length, 2);
});
