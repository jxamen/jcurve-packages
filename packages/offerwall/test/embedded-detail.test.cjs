const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
const React = require('react');
const { act, create } = require(process.env.OFFERWALL_TEST_RENDERER || 'react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The shared screen with the real bus, a stand-in wall, and a React Native that says which platform / bridge it is.
const rn = {
  Platform: { OS: 'ios' },
  NativeModules: { JCurveOfferwallModule: {} },
  View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } },
  BackHandler: { addEventListener: () => ({ remove() {} }) },
};
Module._load = function (id, ...args) {
  if (id === 'react-native') return rn;
  if (id === './index' && args[0].filename.endsWith('OfferwallScreen.js')) return { OfferwallView: 'OfferwallView' };
  return original.call(this, id, ...args);
};
const { OfferwallScreen } = require('../dist/OfferwallScreen');
const bus = require('../dist/embeddedDetail');

const props = { usn: 'a'.repeat(64), onClose() {}, onRetry() {} };
let tree;
const mount = async () => { await act(() => { tree = create(React.createElement(OfferwallScreen, props)); }); };
const walls = () => tree.root.findAllByType('OfferwallView');
afterEach(async () => {
  if (tree) await act(() => tree.unmount());
  tree = undefined;
  rn.Platform.OS = 'ios';
  rn.NativeModules = { JCurveOfferwallModule: {} };
});

test('embedded: on iOS with the bridge the screen registers as a wall and unregisters when it goes away', async () => {
  assert.equal(bus.embeddedDetailAvailable(), false);
  await mount();
  assert.equal(bus.embeddedDetailAvailable(), true);
  await act(() => tree.unmount());
  tree = undefined;
  assert.equal(bus.embeddedDetailAvailable(), false);
});

test('embedded: Android, or iOS without the bridge, never registers; the answer is a plain no', async () => {
  rn.Platform.OS = 'android';
  await mount();
  assert.equal(bus.embeddedDetailAvailable(), false);
  assert.equal(await bus.openEmbeddedDetail('777', 20), false);
  assert.equal(walls()[0].props.detailCampaignKey, undefined);
  await act(() => tree.unmount());
  rn.Platform.OS = 'ios';
  rn.NativeModules = {};
  await mount();
  assert.equal(bus.embeddedDetailAvailable(), false);
  assert.equal(bus.embeddedDetailSupported(), false);
});

test('embedded: a request reloads the wall into that detail (new view, key passed, spinner), and loaded answers yes', async () => {
  await mount();
  const beforeLoaded = walls()[0].props.onLoaded;
  assert.equal(walls()[0].props.detailCampaignKey, undefined);
  await act(() => beforeLoaded());
  assert.equal(tree.root.findAllByType('ActivityIndicator').length, 0);
  let answer;
  await act(() => { answer = bus.openEmbeddedDetail('777', 5000); });
  const after = walls()[0];
  assert.equal(after.props.detailCampaignKey, '777');
  assert.notEqual(after.props.onLoaded, beforeLoaded, 'a fresh view (the key changed)');
  assert.equal(tree.root.findAllByType('ActivityIndicator').length, 1, 'loading again');
  await act(() => after.props.onLoaded());
  assert.equal(await answer, true);
  assert.equal(walls()[0].props.detailCampaignKey, '777', 'the detail stays');
  assert.equal(tree.root.findAllByType('ActivityIndicator').length, 0);
});

test('embedded: asking for the same campaign again reloads it (new request each time)', async () => {
  await mount();
  let first;
  await act(() => { first = bus.openEmbeddedDetail('777', 5000); });
  await act(() => walls()[0].props.onLoaded());
  assert.equal(await first, true);
  const seen = walls()[0];
  let second;
  await act(() => { second = bus.openEmbeddedDetail('777', 5000); });
  assert.notEqual(walls()[0], seen);
  await act(() => walls()[0].props.onLoaded());
  assert.equal(await second, true);
});

test('embedded: an error while loading the detail goes back to the list, answers no, and does not show the error page', async () => {
  await mount();
  let answer;
  await act(() => { answer = bus.openEmbeddedDetail('777', 5000); });
  await act(() => walls()[0].props.onError());
  assert.equal(await answer, false);
  assert.equal(walls().length, 1, 'the wall is back');
  assert.equal(walls()[0].props.detailCampaignKey, undefined, 'as the plain list');
  assert.equal(tree.root.findAllByType('Pressable').length, 0, 'no 다시 시도 page');
});

test('embedded: an error of the plain wall still shows the retry page', async () => {
  await mount();
  await act(() => walls()[0].props.onError());
  assert.equal(walls().length, 0);
  assert.equal(tree.root.findAllByType('Pressable').length, 1);
});

test('embedded: no answer in time -> no, and the wall goes back to the plain list', async () => {
  await mount();
  let answer;
  await act(() => { answer = bus.openEmbeddedDetail('777', 30); });
  assert.equal(walls()[0].props.detailCampaignKey, '777');
  await act(async () => { assert.equal(await answer, false); });
  assert.equal(walls()[0].props.detailCampaignKey, undefined);
});

test('embedded: a newer request replaces the older one (older answers no, the wall keeps the newer detail)', async () => {
  await mount();
  let older; let newer;
  await act(() => { older = bus.openEmbeddedDetail('111', 5000); });
  await act(() => { newer = bus.openEmbeddedDetail('222', 5000); });
  assert.equal(await older, false);
  assert.equal(walls()[0].props.detailCampaignKey, '222');
  await act(() => walls()[0].props.onLoaded());
  assert.equal(await newer, true);
});

test('embedded: the wall going away with a request pending answers no; an empty key is a no; late events are ignored', async () => {
  await mount();
  let answer;
  await act(() => { answer = bus.openEmbeddedDetail('777', 5000); });
  await act(() => tree.unmount());
  tree = undefined;
  assert.equal(await answer, false);
  assert.equal(await bus.openEmbeddedDetail('', 20), false);
  assert.doesNotThrow(() => { bus.embeddedDetailLoaded(12345); bus.embeddedDetailFailed(12345); });
});
