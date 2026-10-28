// 0.6.4 — the AdPopcorn wall's 20 s load timer (ClassicScreen inside OfferwallScreen): it runs only with a member and while the wall is shown; a failed wall gets one
// automatic try when it is shown again; a loaded wall is never reloaded for having been hidden. (에그머니 1.1.8 A32: 찬스1 「찬스를 불러오지 못했어요」 came from the
// clock running while the member was still null and while 찬스2 was up.)
const { test, afterEach, beforeEach, mock } = require('node:test');
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
const { OfferwallScreen, wallTimerShouldRun, wallAutoRetryOnShow, CLASSIC_WALL_TIMEOUT_MS } = require('../dist/OfferwallScreen');
const chance = require('../dist/chanceProviders');
const { isWallLoaded } = require('../dist/wallSignal');

const USN = 'a'.repeat(64);
let tree; let retries;
const added = [];
const base = () => ({ usn: USN, onClose() {}, onRetry() { retries++; } });
function secondTab() {
  const provider = { id: 'second', name: '스냅플레이', kind: 'launcher', available: () => true, prepare: async () => ({ ok: true }), open: async () => ({ ok: true }) };
  chance.registerChanceProvider(provider); added.push(provider.id);
}
const flush = () => act(async () => { await new Promise((r) => setImmediate(r)); });
async function mount(extra = {}) { wall = { mounts: 0, unmounts: 0 }; retries = 0; await act(() => { tree = create(React.createElement(OfferwallScreen, { ...base(), ...extra })); }); }
const update = (extra) => act(() => { tree.update(React.createElement(OfferwallScreen, { ...base(), ...extra })); });
const advance = (ms) => act(async () => { mock.timers.tick(ms); });
const texts = () => tree.root.findAllByType('Text').map((n) => [].concat(n.props.children).join(''));
const failed = () => texts().includes('찬스를 불러오지 못했어요');
const tabs = () => tree.root.findAll((n) => n.type === 'Pressable' && n.props.accessibilityRole === 'tab');
const press = async (node) => { await act(async () => { node.props.onPress(); }); await flush(); };
const retryButton = () => tree.root.findAll((n) => n.type === 'Pressable' && n.props.accessibilityRole === 'button' && n.findAllByType('Text').some((t) => t.props.children === '다시 시도'))[0];

beforeEach(() => { mock.timers.enable({ apis: ['setTimeout'] }); });
afterEach(async () => {
  if (tree) await act(() => tree.unmount()); tree = undefined;
  for (const id of added.splice(0)) chance.unregisterChanceProvider(id);
  mock.timers.reset();
});

test('the timer rule: runs only with a member, while shown, before the wall has loaded or failed', () => {
  const run = (over) => wallTimerShouldRun({ usn: USN, hidden: false, loaded: false, error: false, ...over });
  assert.equal(run({}), true);
  assert.equal(run({ usn: null }), false);
  assert.equal(run({ usn: '' }), false);
  assert.equal(run({ hidden: true }), false);
  assert.equal(run({ loaded: true }), false);
  assert.equal(run({ error: true }), false);
  assert.equal(CLASSIC_WALL_TIMEOUT_MS, 20000);
});

test('the auto-retry rule: only on the step from hidden to shown, only while failed, only once', () => {
  const again = (over) => wallAutoRetryOnShow({ wasHidden: true, hidden: false, error: true, retried: false, ...over });
  assert.equal(again({}), true);
  assert.equal(again({ wasHidden: false }), false, 'was already shown');
  assert.equal(again({ hidden: true }), false, 'still hidden');
  assert.equal(again({ error: false }), false, 'nothing failed');
  assert.equal(again({ retried: true }), false, 'the one automatic try is used');
});

test('no member yet: the clock does not run — 25 s later there is no error — and it starts from zero when the member arrives', async () => {
  await mount({ usn: null });
  await advance(25000);
  assert.equal(failed(), false, 'nothing to load for, nothing failed');
  await update({ usn: USN });
  await advance(19999);
  assert.equal(failed(), false, 'the 20 s count from the member\'s arrival');
  await advance(2);
  assert.equal(failed(), true, 'and a wall that still has not loaded then fails as before');
});

test('hidden behind 찬스2: the clock stops (no error however long), and shows again → a fresh 20 s from that moment', async () => {
  secondTab();
  await mount();
  await advance(15000);                      // 15 s into the load…
  await press(tabs()[1]);                    // …the member goes to 찬스2
  await advance(120000);
  assert.equal(failed(), false, 'no error while the wall is not on screen');
  await press(tabs()[0]);                    // back
  await advance(19999);
  assert.equal(failed(), false, 'the count restarted: the 15 s from before are not held against it');
  await advance(2);
  assert.equal(failed(), true);
  assert.equal(wall.mounts, 1, 'the wall was never remounted by all this');
});

test('a wall that failed gets one automatic try when it is shown again (no onRetry, the app does its own); the next failure waits for the button', async () => {
  secondTab();
  await mount();
  await advance(20001);
  assert.equal(failed(), true);
  assert.deepEqual([wall.mounts, wall.unmounts], [1, 1], 'the failed wall is taken off');
  await press(tabs()[1]); await press(tabs()[0]);
  assert.equal(failed(), false, 'tried again by itself');
  assert.deepEqual([wall.mounts, wall.unmounts], [2, 1]);
  assert.equal(retries, 0, 'the automatic try does not call onRetry');
  await advance(20001);
  assert.equal(failed(), true, 'and it can fail again');
  await press(tabs()[1]); await press(tabs()[0]);
  assert.equal(failed(), true, 'no second automatic try for the same trouble');
  assert.equal(wall.mounts, 2);
  await press(retryButton());
  assert.equal(failed(), false, 'the button still works');
  assert.equal(wall.mounts, 3);
  assert.equal(retries, 1, 'and it calls onRetry as before');
});

test('the button counts as the retry too: after pressing it, a new failure is not retried by itself when the wall is shown again', async () => {
  secondTab();
  await mount();
  await advance(20001);
  await press(retryButton());
  assert.equal(failed(), false);
  await advance(20001);
  assert.equal(failed(), true);
  await press(tabs()[1]); await press(tabs()[0]);
  assert.equal(failed(), true);
  assert.equal(wall.mounts, 2);
});

test('a successful load gives the next trouble its automatic try again', async () => {
  secondTab();
  await mount();
  await advance(20001);                       // fail
  await press(tabs()[1]); await press(tabs()[0]);   // auto try #1 …
  await act(async () => { wall.props.onLoaded(); });  // … loads
  assert.equal(failed(), false);
  assert.equal(isWallLoaded(), true);
});

test('a loaded wall is left alone: hiding and showing it never reloads it, and the old clock cannot fail it', async () => {
  secondTab();
  await mount();
  await act(async () => { wall.props.onLoaded(); });
  await advance(60000);
  assert.equal(failed(), false);
  await press(tabs()[1]); await advance(60000); await press(tabs()[0]);
  await advance(60000);
  assert.equal(failed(), false);
  assert.deepEqual([wall.mounts, wall.unmounts], [1, 0], 'mounted once, never remounted');
});

test('a native error report while hidden is also given its automatic try when the wall is shown again', async () => {
  secondTab();
  await mount();
  await press(tabs()[1]);
  await act(async () => { wall.props.onError(); });   // the view reports a failure while 찬스2 is up
  await press(tabs()[0]);
  assert.equal(failed(), false, 'retried on showing');
  assert.equal(wall.mounts, 2);
});
