const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
let native, events, loads;
function setup(config = {}, os = 'ios', linked = true) {
  events = new Map(); loads = 0;
  native = {
    setLogEnable(enable) { this.logEnabled = enable; },
    setAppKey(...args) { this.keys = args; },
    setUserId(usn) { this.usn = usn; },
    openOfferwall() { this.opened = this.usn; },
    getOfferwallTotalRewardInfo() {},
    addListener(name, cb) { events.set(name, cb); return { remove() { events.delete(name); } }; },
  };
  Module._load = function(id, ...args) {
    if (id === 'expo-constants') return { default: { expoConfig: { extra: { jcurveOfferwall: config } } } };
    if (id === 'react-native') return { Platform: { OS: os }, NativeModules: linked ? { RNAdPopcornRewardModule: {} } : {} };
    if (id === 'react-native-adpopcorn-reward') { loads++; return { default: native }; }
    return original.call(this, id, ...args);
  };
  delete require.cache[require.resolve('../dist')];
  const api = require('../dist');
  if (os === 'ios' && (config.appKey || config.hashKey)) api.configureOfferwall(config);
  return api;
}
afterEach(() => { Module._load = original; });
const keys = { appKey: 'test-app', hashKey: 'test-hash' };
const usn = 'a'.repeat(64);
test('empty or partial keys return 준비 중 without loading SDK', async () => {
  for (const c of [{}, { appKey: 'test-app' }]) {
    const api = setup(c);
    assert.equal(api.openOfferwall({ usn }).message, '준비 중');
    assert.equal((await api.getOfferwallTotalRewardInfo({ usn })).message, '준비 중');
    api.onOfferwallClosed(() => assert.fail())();
    assert.equal(loads, 0);
  }
});
test('unlinked SDK / web remains buildable and unavailable', () => {
  assert.equal(setup(keys, 'ios', false).openOfferwall({ usn }).reason, 'not_ready');
  assert.equal(setup(keys, 'web').openOfferwall({ usn }).reason, 'not_ready');
});
test('iOS initializes keys and sets server alias before opening', () => {
  const api = setup(keys);
  assert.deepEqual(api.openOfferwall({ usn }), { ok: true });
  assert.deepEqual(native.keys, ['test-app', 'test-hash']);
  assert.equal(native.opened, usn);
  assert.equal(api.openOfferwall({ usn: 'user@example.com' }).reason, 'invalid_usn');
});
test('Android uses manifest keys', () => {
  setup(keys, 'android').openOfferwall({ usn });
  assert.equal(native.keys, undefined);
  assert.equal(native.opened, usn);
});
test('reward query waits for event and cleans listener', async () => {
  const api = setup(keys);
  const result = api.getOfferwallTotalRewardInfo({ usn });
  const info = { queryResult: true, totalCount: 3, totalReward: '100' };
  events.get('OnOfferwallTotalRewardInfo')(info);
  assert.deepEqual(await result, { ok: true, info });
  assert.equal(events.size, 0);
});
test('reward query timeout cleans listener', async () => {
  const api = setup(keys);
  assert.equal((await api.getOfferwallTotalRewardInfo({ usn, timeoutMs: 1 })).reason, 'sdk_error');
  assert.equal(events.size, 0);
});
test('close subscription unsubscribes', () => {
  const api = setup(keys);
  let count = 0;
  const remove = api.onOfferwallClosed(() => count++);
  events.get('OnClosedOfferWallPage')();
  remove();
  assert.equal(count, 1);
  assert.equal(events.size, 0);
});

test('server iOS keys initialize without bundled keys and failures clear old keys', async () => {
  const api = setup();
  const before = global.fetch;
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.test/v1/carrot/content/config/adpopcorn');
      assert.equal(options.headers['X-App-Token'], 'test-token');
      return { ok: true, json: async () => ({ ok: true, config: {
        android: { mediaKey: 'android-media', hashKey: 'android-hash' },
        ios: { mediaKey: 'ios-media', hashKey: 'ios-hash' },
      } }) };
    };
    assert.deepEqual(await api.initializeOfferwall({ configUrl: 'https://api.test/v1/carrot/content/config/adpopcorn', headers: { 'X-App-Token': 'test-token' } }), { ok: true });
    assert.deepEqual(api.openOfferwall({ usn }), { ok: true });
    assert.deepEqual(native.keys, ['ios-media', 'ios-hash']);
    assert.equal(native.logEnabled, false);
    global.fetch = async () => { throw new Error('offline'); };
    assert.equal((await api.initializeOfferwall({ configUrl: 'https://api.test', headers: {} })).reason, 'not_ready');
    assert.equal(api.openOfferwall({ usn }).reason, 'not_ready');
  } finally { global.fetch = before; }
});
test('reset discards an in-flight configuration response', async () => {
  const api = setup();
  const before = global.fetch;
  let resolve;
  try {
    global.fetch = () => new Promise(r => { resolve = r; });
    const loading = api.initializeOfferwall({ configUrl: 'https://api.test', headers: {} });
    api.resetOfferwall();
    resolve({ ok: true, json: async () => ({ ok: true, config: { ios: { mediaKey: 'old-app', hashKey: 'old-hash' } } }) });
    assert.equal((await loading).reason, 'not_ready');
    assert.equal(api.openOfferwall({ usn }).reason, 'not_ready');
  } finally { global.fetch = before; }
});
