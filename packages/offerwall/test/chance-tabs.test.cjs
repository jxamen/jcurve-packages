const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
const React = require('react');
const { act, create } = require(process.env.OFFERWALL_TEST_RENDERER || 'react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let wall;
Module._load = function (id, ...args) {
  if (id === 'react-native') return {
    View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
    BackHandler: { addEventListener: () => ({ remove() {} }) },
  };
  if (id === './index' && args[0].filename.endsWith('OfferwallScreen.js')) return {
    OfferwallView: function WallStub(props) {
      React.useEffect(() => { wall.mounts++; wall.props = props; return () => { wall.unmounts++; }; }, []);
      return React.createElement('NativeWall', { usn: props.usn });
    },
  };
  return original.call(this, id, ...args);
};
const { OfferwallScreen } = require('../dist/OfferwallScreen');
const chance = require('../dist/chanceProviders');
const { isWallLoaded } = require('../dist/wallSignal');

const USN = 'a'.repeat(64);
const base = { usn: USN, onClose() {}, onRetry() {} };
let tree;
const added = [];
function launcher(extra = {}) {
  const calls = { open: [], prepare: [] };
  const provider = {
    id: 'second', name: '스냅플레이', kind: 'launcher', available: () => true,
    prepare: async (ctx) => { calls.prepare.push(ctx); return { ok: true }; },
    open: async (ctx) => { calls.open.push(ctx); return extra.result ?? { ok: true }; },
    ...extra.provider,
  };
  chance.registerChanceProvider(provider); added.push(provider.id);
  return { provider, calls };
}
const flush = () => act(async () => { await new Promise((r) => setImmediate(r)); });
async function mount(extra = {}) { wall = { mounts: 0, unmounts: 0 }; await act(() => { tree = create(React.createElement(OfferwallScreen, { ...base, ...extra })); }); }
const tabs = () => tree.root.findAll((n) => n.type === 'Pressable' && n.props.accessibilityRole === 'tab');
const texts = () => tree.root.findAllByType('Text').map((n) => [].concat(n.props.children).join(''));
const press = async (node) => { await act(async () => { node.props.onPress(); }); await flush(); };
const wallRoot = () => tree.root.findAllByType('View').find((n) => n.props.style && n.props.style.flex === 1 && n.props.style.backgroundColor === '#fff' && 'paddingTop' in n.props.style && n !== tree.root.findAllByType('View')[0]);
afterEach(async () => {
  if (tree) await act(() => tree.unmount()); tree = undefined;
  for (const id of added.splice(0)) chance.unregisterChanceProvider(id);
});

test('one provider (the AdPopcorn wall only): no tab bar, no extra controls — the screen as it was', async () => {
  await mount();
  assert.equal(tabs().length, 0);
  assert.equal(tree.root.findAll((n) => n.props.accessibilityRole === 'tablist').length, 0);
  assert.equal(tree.root.findAllByType('Pressable').length, 0);
  assert.equal(tree.root.findAllByType('Text').length, 0);
  assert.equal(tree.root.findAllByType('NativeWall').length, 1);
});

test('two providers: 「찬스1 · 찬스2」 tabs appear, 찬스1 selected, provider names hidden by default', async () => {
  launcher();
  await mount();
  assert.deepEqual(tabs().map((t) => t.props.accessibilityLabel), ['찬스1', '찬스2']);
  assert.deepEqual(tabs().map((t) => t.props.accessibilityState.selected), [true, false]);
  assert.equal(texts().some((s) => s.includes('스냅플레이') || s.includes('애드팝콘')), false);
  assert.equal(tree.root.findAllByType('NativeWall').length, 1);
});

test('names can be shown under the tabs when the app asks', async () => {
  launcher();
  await mount({ showProviderNames: true });
  assert.deepEqual(texts(), ['찬스1', '애드팝콘', '찬스2', '스냅플레이']);
});

test('the tabs appear when a provider becomes available later — without remounting the wall', async () => {
  let on = false;
  launcher({ provider: { available: () => on } });
  await mount();
  assert.equal(tabs().length, 0);
  await act(async () => { on = true; chance.notifyChanceProviders(); });
  assert.equal(tabs().length, 2);
  assert.deepEqual([wall.mounts, wall.unmounts], [1, 0]);
  await act(async () => { on = false; chance.notifyChanceProviders(); });
  assert.equal(tabs().length, 0);
  assert.deepEqual([wall.mounts, wall.unmounts], [1, 0]);
});

test('the launcher is warmed up with the member while the member is on 찬스1', async () => {
  const { calls } = launcher();
  await mount({ displayName: 'N**' });
  await flush();
  assert.deepEqual(calls.prepare, [{ usn: USN, displayName: 'N**' }]);
  assert.deepEqual(calls.open, []);
});

test('pressing 찬스2 opens the SDK at once; the wall stays mounted but hidden and reports "gone" to the chips; back on 찬스1 it is shown again', async () => {
  const { calls } = launcher();
  await mount({ displayName: 'N**' });
  await act(async () => { wall.props.onLoaded(); });
  assert.equal(isWallLoaded(), true);
  await press(tabs()[1]);
  assert.deepEqual(calls.open, [{ usn: USN, displayName: 'N**' }]);
  assert.deepEqual(tabs().map((t) => t.props.accessibilityState.selected), [false, true]);
  assert.equal(isWallLoaded(), false);
  assert.deepEqual([wall.mounts, wall.unmounts], [1, 0]);
  const hidden = tree.root.findAllByType('View').filter((n) => n.props.style && n.props.style.display === 'none');
  assert.equal(hidden.length, 1);
  assert.ok(texts().includes('찬스 열기'), 'the launcher panel shows the open button after the SDK screen was closed');
  await press(tabs()[0]);
  assert.equal(isWallLoaded(), true);
  assert.equal(tree.root.findAllByType('View').some((n) => n.props.style && n.props.style.display === 'none'), false);
  assert.deepEqual([wall.mounts, wall.unmounts], [1, 0]);
});

test('a wall that finishes loading while 찬스2 is up does not bring the chips back', async () => {
  launcher();
  await mount();
  await press(tabs()[1]);
  await act(async () => { wall.props.onLoaded(); });
  assert.equal(isWallLoaded(), false);
  await press(tabs()[0]);
  assert.equal(isWallLoaded(), true);
});

test('the open button reopens; pressing the selected 찬스2 tab again does nothing', async () => {
  const { calls } = launcher();
  await mount();
  await press(tabs()[1]);
  await press(tabs()[1]);
  assert.equal(calls.open.length, 1);
  await press(tree.root.findAll((n) => n.type === 'Pressable' && n.props.accessibilityLabel === '찬스 열기')[0]);
  assert.equal(calls.open.length, 2);
});

test('autoOpenLauncher={false}: the tab only selects, the button opens', async () => {
  const { calls } = launcher();
  await mount({ autoOpenLauncher: false });
  await press(tabs()[1]);
  assert.equal(calls.open.length, 0);
  await press(tree.root.findAll((n) => n.type === 'Pressable' && n.props.accessibilityLabel === '찬스 열기')[0]);
  assert.equal(calls.open.length, 1);
});

test('an open that fails shows its message with a retry button, and never an empty screen or a throw', async () => {
  launcher({ result: { ok: false, reason: 'not_ready', message: '잠시 후 다시 시도해 주세요' } });
  await mount();
  await press(tabs()[1]);
  assert.ok(texts().includes('잠시 후 다시 시도해 주세요'));
  assert.equal(tree.root.findAll((n) => n.type === 'Pressable' && n.props.accessibilityLabel === '다시 열기').length, 1);
  assert.equal(tabs().length, 2);
});

test('an open that throws or hangs a rejected promise is handled the same way', async () => {
  launcher({ provider: { open: () => Promise.reject(new Error('boom')) } });
  await mount();
  await press(tabs()[1]);
  assert.ok(texts().includes('잠시 후 다시 시도해 주세요'));
});

test('no member yet: pressing 찬스2 does not call the SDK and says so', async () => {
  const { calls } = launcher();
  await mount({ usn: null });
  await press(tabs()[1]);
  assert.equal(calls.open.length, 0);
  assert.ok(texts().includes('잠시 후 다시 시도해 주세요'));
});

test('while the launcher is the selected tab and it stops being available, the screen goes back to the plain wall', async () => {
  let on = true;
  launcher({ provider: { available: () => on } });
  await mount();
  await press(tabs()[1]);
  await act(async () => { on = false; chance.notifyChanceProviders(); });
  assert.equal(tabs().length, 0);
  assert.equal(tree.root.findAllByType('View').some((n) => n.props.style && n.props.style.display === 'none'), false);
  assert.deepEqual([wall.mounts, wall.unmounts], [1, 0]);
});

test('texts and colors can be set by the app', async () => {
  launcher();
  await mount({ tabColor: '#0a7', launcherCopy: { open: '스냅 열기', title: '제목' } });
  await press(tabs()[1]);
  assert.ok(texts().includes('스냅 열기') && texts().includes('제목'));
  assert.equal(tabs()[1].props.style.borderBottomColor, '#0a7');
});

test('top inset is applied once: on the outer box when there are tabs', async () => {
  launcher();
  await mount({ topInset: 24 });
  const views = tree.root.findAllByType('View');
  assert.equal(views[0].props.style.paddingTop, 24);
  assert.equal(views[0].props.style.flex, 1);
});

test('the bundle carries the marks the publish check looks for', () => {
  const screen = require('../dist/OfferwallScreen');
  assert.equal(screen.OFFERWALL_SCREEN_MARK, 'jcurve-offerwall-screen:headerless-v1');
  assert.equal(screen.OFFERWALL_CHANCE_TABS_MARK, 'jcurve-offerwall-chance-tabs:v1');
});
