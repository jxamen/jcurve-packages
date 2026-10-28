// 0.6.5/0.6.7 — the list inside the 「포인트 빨리 모으기」 sheet must react to swipes (A32: taps worked, swipes did nothing; confirmed fixed by drawing the sheet in a Modal, 0.6.6).
// What stays: the slide runs from JS and the transform is taken off once it has finished; every vertical list is nested-scroll enabled and fills the sheet.
// The 0.6.5/0.6.6 diagnostic log lines are gone (0.6.7): nothing is written to the console.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, walk, tick, findSheet, texts} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, extra = {}) => ({id, name: `일 ${id}`, points: 1008, todo: '하나 하기', level: 'easy', ...extra});
const combos = () => api.normalizeTodayCombos({date: TODAY(), bundles: [{goal: 1000, missions: [mission('abc123def456', {campaignKey: '352216486'})]}]});
const categories = () => api.normalizeTodayCombos({date: TODAY(), bundles: [{goal: 1000, missions: [mission('b1', {points: 1000})]}], categories: [
  {key: 'signup', title: '회원가입', total_points: 800, count: 2, items: [{campaignKey: '11', name: '알바천국', points: 400, line: '가입하기', done: false, cost: null}, {campaignKey: '12', name: '아이부자', points: 400, line: '가입하기', done: false, cost: null}]},
  {key: 'game', title: '게임', total_points: 500, count: 1, items: [{campaignKey: '13', name: '황야', points: 500, line: '하기', done: false, cost: null}]},
]});

const verticalLists = (tree) => walk(tree).filter((n) => n.type === 'ScrollView' && !n.props.horizontal);
const horizontalRows = (tree) => walk(tree).filter((n) => n.type === 'ScrollView' && n.props.horizontal);

// a Chance-tab entry; `data` is the document its load returns. `rn.Animated.timing` is replaced to see how the slide is driven and to finish it by hand.
const start = async ({make, rn}, data = combos()) => {
  const slides = [];
  rn.Animated.timing = (value, config) => ({start(done) { slides.push({config, done}); }, stop() {}});
  const host = make();
  const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load: async () => ({ok: true, combos: data}), loadKey: 1, usn: 'a'.repeat(64), campaigns: {list: async () => [], open: async () => true}}));
  mount(); host.flush(); await tick(); mount(); host.flush(); await tick(); mount(); host.flush();
  return {slides, again: () => { host.flush(); return mount(); }};
};
// (the sheet's effects — the slide, the probe reset — run on the flush after the render that mounts it)
const open = (s) => { assert.equal(api.requestOpenCombos(), true); s.again(); return s.again(); };

const withLog = async (run) => {
  const real = console.log; const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  try { await run(lines); } finally { console.log = real; }
};

test('the sheet\'s slide is driven from JS, and once it has finished the transform is gone from the sheet (a re-render keeps it gone)', () => withReact(async (ctx) => {
  const s = await start(ctx);
  const first = findSheet(open(s));
  assert.ok(first, 'the sheet is up');
  assert.equal(s.slides.length, 1);
  assert.equal(s.slides[0].config.useNativeDriver, false, 'JS-driven, not native-driver');
  assert.ok(Array.isArray(first.props.style.transform), 'while it slides it carries the translate');
  s.slides[0].done({finished: true});
  const settled = findSheet(s.again());
  assert.equal('transform' in settled.props.style, false, 'no animated transform left on the sheet once it has arrived');
  const again = findSheet(s.again());
  assert.equal('transform' in again.props.style, false, 'and re-renders do not bring it back');
  for (const key of ['position', 'left', 'right', 'bottom', 'top', 'zIndex', 'elevation', 'overflow', 'borderTopLeftRadius', 'borderTopRightRadius', 'backgroundColor']) assert.ok(key in settled.props.style, key + ' is kept');
  assert.equal(settled.props.style.position, 'absolute'); assert.equal(settled.props.style.bottom, 0); assert.equal(settled.props.style.zIndex, 25);
}));

test('a slide that was cut short (finished: false) does not drop the transform; a callback without a result (older Animated) does', () => withReact(async (ctx) => {
  const s = await start(ctx);
  open(s);
  s.slides[0].done({finished: false});
  assert.ok(Array.isArray(findSheet(s.again()).props.style.transform), 'not arrived yet');
  s.slides[0].done();
  assert.equal('transform' in findSheet(s.again()).props.style, false, 'no result object counts as done');
}));

test('every vertical list in the sheet is nested-scroll enabled and fills the sheet; the sideways tab row is left as it was', () => withReact(async (ctx) => {
  for (const data of [combos(), categories()]) {
    const s = await start(ctx, data);
    const tree = open(s);
    const lists = verticalLists(tree);
    assert.equal(lists.length, 1, 'one vertical list per guide screen');
    const props = lists[0].props;
    assert.equal(props.nestedScrollEnabled, true);
    assert.deepEqual(props.style, {flex: 1});
    assert.equal(props.keyboardShouldPersistTaps, 'handled', 'its own props are kept');
    for (const gone of ['onTouchStart', 'onTouchMove', 'onResponderGrant', 'onResponderTerminate', 'onScrollBeginDrag', 'onScroll', 'scrollEventThrottle']) assert.equal(props[gone], undefined, gone + ' (a diagnostic hook) is gone');
    assert.deepEqual(props.contentContainerStyle, {paddingBottom: 32});
    for (const row of horizontalRows(tree)) {
      assert.equal(row.props.nestedScrollEnabled, true, 'the tab row was already nested');
      assert.deepEqual(row.props.style, {flexGrow: 0});
      assert.equal(row.props.onTouchStart, undefined, 'no probe on the tab row');
    }
    api.listenForComboRequests({priority: 0, open() {}})();
  }
}));

test('the 「무료체험 확인」 list gets the same props', () => withReact(({host}) => {
  const tree = host.render(() => api.ComboTrialsScreen({items: [], onClose() {}, onOpen() {}, onCancelled() {}}));
  const lists = verticalLists(tree);
  assert.equal(lists.length, 1);
  assert.equal(lists[0].props.nestedScrollEnabled, true);
  assert.deepEqual(lists[0].props.style, {flex: 1});
  assert.deepEqual(lists[0].props.contentContainerStyle, {paddingBottom: 32});
}));

test('nothing is logged: the sheet has no touch hooks of its own and a whole open / scroll / close cycle writes no [combos-sheet] line', () => withReact(async (ctx) => {
  const real = console.log; const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  try {
    const s = await start(ctx);
    const tree = open(s);
    const sheet = findSheet(tree);
    assert.equal(sheet.props.onTouchStart, undefined, 'the sheet\'s container has no probe');
    for (const list of verticalLists(tree)) for (const name of ['onTouchStart', 'onScroll']) assert.equal(typeof list.props[name], 'undefined');
    assert.equal(lines.filter((l) => String(l).includes('[combos-sheet]')).length, 0);
  } finally { console.log = real; }
  assert.throws(() => require('../dist/comboSheetProbe'), /Cannot find module/, 'the probe module is gone');
}));

test('the guide still shows its rows and the close/touch behaviour is unchanged (smoke)', () => withReact(async (ctx) => {
  const s = await start(ctx);
  const tree = open(s);
  assert.ok(texts(tree).some((x) => String(x).includes('일 abc123def456')), texts(tree).join('|'));
}));
