const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
let native, events, loads, reactHooks, viewLinked = true;
let embedded;   // ExponentConstants.manifest(빌드에 박힌 설정) — undefined 면 모듈 없음
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
    if (id === 'react' && reactHooks) return reactHooks;
    if (id === 'expo-constants') return { default: { expoConfig: { extra: { jcurveOfferwall: config } } } };
    if (id === 'expo-modules-core') return { requireOptionalNativeModule: (name) => (name === 'ExponentConstants' && embedded !== undefined ? { manifest: embedded } : null) };
    if (id === 'react-native') return { UIManager: { getViewManagerConfig() { return viewLinked ? {} : null; } }, requireNativeComponent: () => 'EmbeddedNativeView', Platform: { OS: os }, NativeModules: linked ? { RNAdPopcornRewardModule: {} } : {} };
    if (id === 'react-native-adpopcorn-reward') { loads++; return { default: native }; }
    return original.call(this, id, ...args);
  };
  delete require.cache[require.resolve('../dist')];
  const api = require('../dist');
  if (os === 'ios' && (config.appKey || config.hashKey)) api.configureOfferwall(config);
  return api;
}
afterEach(() => { Module._load = original; reactHooks = undefined; viewLinked = true; embedded = undefined; });
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

function viewHarness(api) {
  let state = null, effect;
  reactHooks = {
    useState: () => [state, value => { state = value; }],
    useRef: value => ({ current: value }),
    useEffect: callback => { effect = callback; },
    createElement: (type, props) => ({ type, props }),
  };
  return props => {
    api.OfferwallView(props);
    effect();
    return api.OfferwallView(props);
  };
}
test('embedded view uses the server alias without opening a modal', () => {
  const api = setup(keys);
  const render = viewHarness(api);
  const view = render({ usn });
  assert.equal(view.type, 'EmbeddedNativeView');
  assert.equal(view.props.usn, usn);
  assert.equal(native.usn, usn);
  assert.equal(native.opened, undefined);
  // A changed identity must never render the previous alias while effects are pending.
  assert.equal(api.OfferwallView({ usn: 'b'.repeat(64) }), null);
});
test('embedded view fails closed on invalid alias, missing keys or old binary', () => {
  for (const mode of ['invalid', 'keys', 'binary', 'native-error']) {
    const api = setup(mode === 'keys' ? {} : keys);
    viewLinked = mode !== 'binary';
    if (mode === 'native-error') native.setUserId = () => { throw Error('native'); };
    const failures = [];
    const view = viewHarness(api)({ usn: mode === 'invalid' ? 'raw-member' : usn, onError: e => failures.push(e) });
    assert.equal(view, null);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].ok, false);
    assert.equal(native.opened, undefined);
  }
});

// ── 0.2.2 키 고르기: expoConfig → 빌드에 박힌 설정 → 서버 ──
test('OTA 를 하나도 안 받은 내장 번들 — expoConfig 와 내장 설정이 같다: expoConfig 로 연다', () => {
  embedded = JSON.stringify({ extra: { jcurveOfferwall: keys } });
  const api = setup(keys, 'android');
  assert.deepEqual(api.builtOfferwallKeys(), { appKey: 'test-app', hasAppKey: true, hasHashKey: true, source: 'expoConfig' });
  assert.deepEqual(api.openOfferwall({ usn }), { ok: true });
});
test('OTA 를 받아 expoConfig 키가 빈 문자열 — 빌드에 박힌 키(안드 JSON 문자열)로 연다(준비 중이 아니다)', () => {
  embedded = JSON.stringify({ extra: { jcurveOfferwall: keys } });
  const api = setup({ appKey: '', hashKey: '' }, 'android');
  assert.deepEqual(api.openOfferwall({ usn }), { ok: true });
  const b = api.builtOfferwallKeys();
  assert.deepEqual(b, { appKey: 'test-app', hasAppKey: true, hasHashKey: true, source: 'embedded' });
  assert.equal(JSON.stringify(b).includes('test-hash'), false, 'hashKey 값은 내보내지 않는다');
});
test('iOS 내장 설정은 객체로 온다', () => {
  embedded = { extra: { jcurveOfferwall: { appKey: ' ios-app ', hashKey: 'h' } } };
  assert.deepEqual(setup({}, 'ios').builtOfferwallKeys(), { appKey: 'ios-app', hasAppKey: true, hasHashKey: true, source: 'embedded' });
});
test('1 · 2 가 다 비면 서버 키(fetcher) — 받은 키로 안드 SDK 도 연다 · 실패 · 깨진 응답은 조용히 none', async () => {
  embedded = '{not json';
  const api = setup({ appKey: '', hashKey: '' }, 'android');
  assert.equal(api.openOfferwall({ usn }).message, '준비 중');
  assert.deepEqual(await api.resolveOfferwallKeys(async () => { throw new Error('net'); }), { appKey: '', hasAppKey: false, hasHashKey: false, source: 'none' });
  assert.equal((await api.resolveOfferwallKeys(async () => ({ ok: false }))).source, 'none');
  const r = await api.resolveOfferwallKeys(async () => ({ ok: true, config: { android: { mediaKey: ' srv-app ', hashKey: 'srv-hash' }, ios: {} } }));
  assert.deepEqual(r, { appKey: 'srv-app', hasAppKey: true, hasHashKey: true, source: 'server' });
  assert.deepEqual(api.openOfferwall({ usn }), { ok: true });
});
test('resolveOfferwallKeys 는 1 · 2 가 있으면 서버를 부르지 않는다', async () => {
  embedded = JSON.stringify({ extra: { jcurveOfferwall: keys } });
  let called = 0;
  const r = await setup({}, 'android').resolveOfferwallKeys(async () => { called++; return {}; });
  assert.equal(r.source, 'embedded');
  assert.equal(called, 0);
});
test('모듈이 없으면(웹 · Expo Go) none — 예외 없이', () => {
  const api = setup({}, 'android');
  Module._load = function(id, ...args) { if (id === 'expo-constants') throw new Error('none'); if (id === 'expo-modules-core') return {}; if (id === 'react-native') return { Platform: { OS: 'android' }, NativeModules: {} }; return original.call(this, id, ...args); };
  assert.deepEqual(api.builtOfferwallKeys(), { appKey: '', hasAppKey: false, hasHashKey: false, source: 'none' });
});
