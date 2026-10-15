const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
let native, events, loads;
function setup(config = {}, os = 'ios', linked = true) {
  events = new Map(); loads = 0;
  native = {
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
  return require('../dist');
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
