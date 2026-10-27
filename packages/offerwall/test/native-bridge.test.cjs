const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, walk, tick} = require('./harness.cjs');
const api = require('../dist');

// [exported function, native method, arguments]
const WRAPPERS = [
  ['openCampaignDetail', 'openCampaignDetail', ['352216486']],
  ['tryParticipateCampaign', 'tryParticipateCampaign', ['352216486']],
  ['loadCustomCampaigns', 'loadCustomCampaigns', [50]],
  ['clickCustomCampaign', 'clickCustomCampaign', ['k1']],
  ['destroyCustomCampaigns', 'destroyCustomCampaigns', []],
  ['loadCustomNativeAds', 'loadCustomNativeAds', ['placement-1']],
  ['impressionCustomNativeAd', 'impressionCustomNativeAd', ['n1']],
  ['clickCustomNativeAd', 'clickCustomNativeAd', ['n1']],
  ['completeCustomNativeAd', 'completeCustomNativeAd', []],
  ['loadCustomCpm', 'loadCustomCpm', [20]],
  ['impressionCustomCpm', 'impressionCustomCpm', ['c1']],
  ['clickCustomCpm', 'clickCustomCpm', ['c1']],
  ['getEarnableTotalRewardInfo', 'getEarnableTotalRewardInfo', []],
  ['getBridgeTotalRewardInfo', 'getBridgeTotalRewardInfo', ['bridge-1']],
  ['openOfferwallWithFilter', 'openOfferwallWithFilter', [{gender: 'F'}]],
  ['closeOfferwall', 'closeOfferwall', []],
  ['setUserAgreement', 'setUserAgreement', [true]],
  ['useFlagShowWhenLocked', 'useFlagShowWhenLocked', [false]],
  ['setClipboard', 'setClipboard', ['복사']],
  ['setWebTap', 'setWebTap', [{enabled: false}]],
];

test('every wrapper is listed and exported', () => {
  assert.deepEqual(WRAPPERS.map(w => w[0]).sort(), [...api.OFFERWALL_NATIVE_METHODS].sort());
  for (const [fn] of WRAPPERS) assert.equal(typeof api[fn], 'function', fn);
  assert.equal(typeof api.getOfferwallNativeCapabilities, 'function');
  assert.equal(typeof api.addOfferwallNativeListener, 'function');
});

test('without the bridge (an older binary) everything rejects E_UNSUPPORTED and nothing throws', () => withReact(async () => {
  assert.equal(api.hasNativeBridge(), false);
  for (const [fn, , args] of WRAPPERS) {
    await assert.rejects(() => api[fn](...args), e => e.code === 'E_UNSUPPORTED', fn);
  }
  await assert.rejects(() => api.getOfferwallNativeCapabilities(), e => e.code === 'E_UNSUPPORTED');
  const off = api.addOfferwallNativeListener(() => {});
  assert.equal(typeof off, 'function');
  off();
}));

test('with the bridge every wrapper forwards its arguments and returns the native answer', () => {
  const calls = [];
  const mod = Object.fromEntries([...WRAPPERS.map(w => w[1]), 'getCapabilities'].map(name => [name, async (...args) => { calls.push([name, ...args]); return `answer:${name}`; }]));
  return withReact(async () => {
    assert.equal(api.hasNativeBridge(), true);
    for (const [fn, name, args] of WRAPPERS) assert.equal(await api[fn](...args), `answer:${name}`, fn);
    assert.deepEqual(calls.map(c => c[0]), WRAPPERS.map(w => w[1]));
    assert.deepEqual(calls[2], ['loadCustomCampaigns', 50]);
    assert.deepEqual(calls[14], ['openOfferwallWithFilter', {gender: 'F'}]);
    assert.equal(await api.getOfferwallNativeCapabilities(), 'answer:getCapabilities');
    await api.loadCustomCampaigns();
    assert.deepEqual(calls.at(-1), ['loadCustomCampaigns', 100], 'default list size');
  }, {nativeModules: {JCurveOfferwallModule: mod}});
});

test('a native rejection or a synchronous throw reaches the caller as a rejection', () => withReact(async () => {
  await assert.rejects(() => api.openCampaignDetail('x'), e => e.code === 'E_FAILED');
  await assert.rejects(() => api.setClipboard('x'), /boom/);
}, {nativeModules: {JCurveOfferwallModule: {
  openCampaignDetail: () => Promise.reject(Object.assign(new Error('failed'), {code: 'E_FAILED'})),
  setClipboard: () => { throw new Error('boom'); },
}}}));

test('events: listens through NativeEventEmitter (iOS counts listeners there) and unsubscribes', () => {
  const mod = {};
  return withReact(async ({rn}) => {
    const seen = [];
    const off = api.addOfferwallNativeListener(e => seen.push(e.type));
    assert.equal(rn.__subs.length, 1);
    assert.equal(rn.__subs[0][0], mod);
    assert.equal(rn.__subs[0][1], 'JCurveOfferwallEvent');
    rn.__subs[0][2]({type: 'detailClosed'});
    assert.deepEqual(seen, ['detailClosed']);
    off();
    assert.equal(rn.__removed, 1);
  }, {nativeModules: {JCurveOfferwallModule: mod}});
});

// ---- the embedded list view gets the new props only when the bridge exists ----
const renderView = async (nativeModules, props, viewConfig) => {
  let element;
  await withReact(async ({host}) => {
    api.configureOfferwall({appKey: 'k', hashKey: 'h'});
    const usn = 'a'.repeat(64);
    const mount = () => host.render(() => api.OfferwallView({usn, ...props}));
    mount(); host.flush(); await tick();
    element = mount();
  }, {nativeModules, viewConfig});
  return element;
};

test('OfferwallView: new view props only go to binaries that have the bridge', async () => {
  const props = {campaignKeys: ['1', '2'], detailCampaignKey: '352216486'};
  const old = await renderView({}, props);
  assert.equal(old.type, 'NativeWall');
  assert.equal('campaignKeys' in old.props || 'detailCampaignKey' in old.props, false, 'an older binary would reject unknown view props');
  const fresh = await renderView({JCurveOfferwallModule: {}}, props);
  assert.deepEqual(fresh.props.campaignKeys, ['1', '2']);
  assert.equal(fresh.props.detailCampaignKey, '352216486');
  const plain = await renderView({JCurveOfferwallModule: {}}, {});
  assert.equal('campaignKeys' in plain.props || 'detailCampaignKey' in plain.props, false, 'nothing extra unless asked');
  const empty = await renderView({JCurveOfferwallModule: {}}, {campaignKeys: [], detailCampaignKey: ''});
  assert.equal('campaignKeys' in empty.props || 'detailCampaignKey' in empty.props, false);
  assert.ok(walk(old).length >= 1);
});

test('OfferwallView (0.4.0): the detail event props go only to a view whose native props list them', async () => {
  const handlers = {onDetailOpened() {}, onDetailClosed() {}, detailCampaignKey: '352216486'};
  // a 0.3.0 binary: the module is there but its view has no detail events — the props are not passed (they could break an older view)
  const v030 = await renderView({JCurveOfferwallModule: {}}, handlers, {NativeProps: {usn: 'String', detailCampaignKey: 'String', onLoaded: 'bool'}});
  assert.equal('onDetailOpened' in v030.props || 'onDetailClosed' in v030.props, false);
  assert.equal(v030.props.detailCampaignKey, '352216486');
  // a 0.4.0 binary
  const v040 = await renderView({JCurveOfferwallModule: {}}, handlers, {NativeProps: {usn: 'String', onDetailOpened: 'bool', onDetailClosed: 'bool'}});
  assert.equal(v040.props.onDetailOpened, handlers.onDetailOpened);
  assert.equal(v040.props.onDetailClosed, handlers.onDetailClosed);
  // a binary with no module at all (0.2.x) never gets them, whatever its view says
  const v02 = await renderView({}, handlers, {NativeProps: {onDetailOpened: 'bool', onDetailClosed: 'bool'}});
  assert.equal('onDetailOpened' in v02.props || 'detailCampaignKey' in v02.props, false);
  // nothing asked, nothing passed
  const none = await renderView({JCurveOfferwallModule: {}}, {}, {NativeProps: {onDetailOpened: 'bool', onDetailClosed: 'bool'}});
  assert.equal('onDetailOpened' in none.props, false);
});

test('no native lookup runs at import time (safe to ship by OTA to older binaries)', () => {
  const Module = require('node:module');
  const original = Module._load;
  let touched = false;
  Module._load = function (id, ...rest) { if (id === 'react-native') touched = true; return original.call(this, id, ...rest); };
  try {
    delete require.cache[require.resolve('../dist/native.js')];
    delete require.cache[require.resolve('../dist/campaigns.js')];
    require('../dist/native.js'); require('../dist/campaigns.js');
  } finally { Module._load = original; }
  assert.equal(touched, false);
});
