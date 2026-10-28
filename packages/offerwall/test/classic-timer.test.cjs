// 0.2.3-ut1 — the wall's 20 s load timer does not run while there is no member (usn null): the app's open() may not have finished, and nothing has failed yet.
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
    View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } },
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

const USN = 'a'.repeat(64);
let tree;
const props = (extra = {}) => ({ usn: USN, onClose() {}, onRetry() {}, ...extra });
async function mount(extra) { wall = { mounts: 0, unmounts: 0 }; await act(() => { tree = create(React.createElement(OfferwallScreen, props(extra))); }); }
const update = (extra) => act(() => { tree.update(React.createElement(OfferwallScreen, props(extra))); });
const advance = (ms) => act(async () => { mock.timers.tick(ms); });
const failed = () => tree.root.findAllByType('Text').some((n) => [].concat(n.props.children).join('') === '찬스를 불러오지 못했어요');

beforeEach(() => { mock.timers.enable({ apis: ['setTimeout'] }); });
afterEach(async () => { if (tree) await act(() => tree.unmount()); tree = undefined; mock.timers.reset(); });

test('no member yet: 25 s later there is no error, and the 20 s start from the member\'s arrival', async () => {
  await mount({ usn: null });
  await advance(25000);
  assert.equal(failed(), false);
  assert.equal(wall.mounts, 0, 'no wall is made without a member');
  await update({ usn: USN });
  await advance(19999);
  assert.equal(failed(), false);
  await advance(2);
  assert.equal(failed(), true, 'a wall that still has not loaded 20 s after the member came fails as before');
});

test('with a member from the start nothing changes: still an error after 20 s without a load, and none once it has loaded', async () => {
  await mount();
  await advance(19999);
  assert.equal(failed(), false);
  await advance(2);
  assert.equal(failed(), true);
  await act(() => { tree.unmount(); }); tree = undefined;
  await mount();
  await act(async () => { wall.props.onLoaded(); });
  await advance(60000);
  assert.equal(failed(), false, 'a loaded wall is never failed by the old clock');
});

test('the retry button still starts a new wall and a new 20 s', async () => {
  let retried = 0;
  await mount({ onRetry() { retried++; } });
  await advance(20001);
  assert.equal(failed(), true);
  const button = tree.root.findAll((n) => n.type === 'Pressable' && n.findAllByType('Text').some((t) => t.props.children === '다시 시도'))[0];
  await act(async () => { button.props.onPress(); });
  assert.equal(retried, 1);
  assert.equal(failed(), false);
  assert.equal(wall.mounts, 2);
  await advance(20001);
  assert.equal(failed(), true);
});
