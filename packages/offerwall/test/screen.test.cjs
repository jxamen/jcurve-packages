const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
const React = require('react');
const { act, create } = require(process.env.OFFERWALL_TEST_RENDERER || 'react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let back, removed, tree;
Module._load = function(id, ...args) {
  if (id === 'react-native') return {
    View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
    StyleSheet: { absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } },
    BackHandler: { addEventListener: (_event, fn) => { back = fn; return { remove: () => { removed++; } }; } },
  };
  if (id === './index' && args[0].filename.endsWith('OfferwallScreen.js')) return { OfferwallView: 'OfferwallView' };
  return original.call(this, id, ...args);
};
const { OfferwallScreen } = require('../dist/OfferwallScreen');
const props = { usn: 'a'.repeat(64), onClose() {}, onRetry() {} };
async function mount(extra = {}) { removed = 0; await act(() => { tree = create(React.createElement(OfferwallScreen, { ...props, ...extra })); }); }
afterEach(async () => { if (tree) await act(() => tree.unmount()); tree = undefined; });

test('headerless SDK fills host safe area without doubling top padding', async () => {
  await mount();
  assert.equal(tree.root.findAllByType('Text').length, 0);
  assert.equal(tree.root.findAllByType('Pressable').length, 0);
  assert.equal(tree.root.findAllByType('View')[0].props.style.paddingTop, 0);
  assert.equal(tree.root.findAllByType('OfferwallView').length, 1);
  await act(() => tree.update(React.createElement(OfferwallScreen, { ...props, topInset: 24 })));
  assert.equal(tree.root.findAllByType('View')[0].props.style.paddingTop, 24);
});
test('loaded SDK removes spinner and cancels loading timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await mount();
  await act(() => tree.root.findByType('OfferwallView').props.onLoaded());
  await act(() => t.mock.timers.tick(21000));
  assert.equal(tree.root.findAllByType('ActivityIndicator').length, 0);
  assert.equal(tree.root.findAllByType('Pressable').length, 0);
});
test('timeout offers retry, remounts SDK and preserves retry callback', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let retries = 0;
  await mount({ onRetry: () => { retries++; } });
  await act(() => t.mock.timers.tick(20000));
  assert.equal(tree.root.findAllByType('OfferwallView').length, 0);
  assert.equal(tree.root.findAllByType('Text')[0].props.children, '찬스를 불러오지 못했어요');
  await act(() => tree.root.findByType('Pressable').props.onPress());
  assert.equal(retries, 1);
  assert.equal(tree.root.findAllByType('OfferwallView').length, 1);
  assert.equal(tree.root.findAllByType('ActivityIndicator').length, 1);
});
test('native failure is retryable; null member never mounts the SDK', async () => {
  await mount({ usn: null });
  assert.equal(tree.root.findAllByType('OfferwallView').length, 0);
  await act(() => tree.update(React.createElement(OfferwallScreen, props)));
  await act(() => tree.root.findByType('OfferwallView').props.onError());
  assert.equal(tree.root.findAllByType('OfferwallView').length, 0);
  assert.equal(tree.root.findAllByType('Pressable').length, 1);
});
test('Android back invokes host navigation and listener is removed on exit', async () => {
  let closed = 0;
  await mount({ onClose: () => { closed++; } });
  assert.equal(back(), true);
  assert.equal(closed, 1);
  await act(() => tree.unmount()); tree = undefined;
  assert.equal(removed, 1);
});
