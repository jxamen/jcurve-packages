// 사용: node verify-single-flight.cjs <풀어 둔 package 폴더>   (npm pack 한 tgz 를 풀면 package/)
// 가짜 react-native · react-native-health-connect 로 requestStepsPermission 의 single-flight 를 확인한다.
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');
const dir = path.resolve(process.argv[2]);
const original = Module._load;
let asks = 0, release;
const appState = { currentState: 'active', addEventListener: (_n, cb) => { appState._cb = cb; return { remove() { appState._cb = null; } }; } };
const hc = {
  getSdkStatus: async () => 3,
  initialize: async () => true,
  requestPermission: () => { asks++; return new Promise((r) => { release = r; }); },
  getGrantedPermissions: async () => [{ recordType: 'Steps', accessType: 'read' }],
};
Module._load = function (id, ...rest) {
  if (id === 'react-native') return { Platform: { OS: 'android' }, NativeModules: { HealthConnect: {} }, AppState: appState, InteractionManager: { runAfterInteractions: (cb) => { setTimeout(cb, 5); return {}; } } };
  if (id === 'react-native-health-connect') return hc;
  if (id === 'expo-modules-core') throw new Error('absent');
  if (id === 'expo-sensors') return { Pedometer: { isAvailableAsync: async () => true, getPermissionsAsync: async () => ({ granted: true }), requestPermissionsAsync: async () => ({ granted: true }) } };
  if (id === '@react-native-async-storage/async-storage') return { default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } };
  return original.call(this, id, ...rest);
};
const { requestStepsPermission } = require(path.join(dir, 'dist/source.js'));
(async () => {
  let explained = 0;
  const explain = async () => { explained++; return true; };
  const a = requestStepsPermission(explain);
  const b = requestStepsPermission(explain);   // second tap while the dialog is up
  const c = requestStepsPermission(explain);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(asks, 1, 'one native dialog request for three concurrent callers');
  release({});
  const results = await Promise.all([a, b, c]);
  assert.deepEqual(results, ['granted', 'granted', 'granted']);
  assert.equal(explained, 1, 'the explanation is shown once');
  const d = requestStepsPermission(explain);   // after it finished a new request is possible again
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(asks, 2);
  release({});
  assert.equal(await d, 'granted');
  // app in the background: the native request waits until the app is active again (or ~0.8 s), then goes out once
  appState.currentState = 'background';
  const f = requestStepsPermission(explain);
  await new Promise((r) => setTimeout(r, 60));
  const before = asks;
  appState.currentState = 'active'; appState._cb && appState._cb('active');
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(before, 2, 'no native request while the app is in the background');
  assert.equal(asks, 3, 'one request after the app became active');
  release({});
  assert.equal(await f, 'granted');
  // a declined explanation returns the current state and does not leave the guard stuck
  const e = await requestStepsPermission(async () => false);
  assert.equal(e, 'granted');
  console.log('OK single-flight:', path.basename(path.dirname(dir)) + '/' + path.basename(dir), 'asks=' + asks, 'explained=' + explained);
})().catch((err) => { console.error('FAIL', err.message); process.exit(1); }).finally(() => { Module._load = original; });
