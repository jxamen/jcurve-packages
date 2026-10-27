const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel, tick, hasSheet} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const combos = (over = {}, date = TODAY()) => api.normalizeTodayCombos({date, bundles: [{goal: 1000, missions: [mission('b1', 1000)]}], ...over});
const props = (extra = {}) => ({onClose() {}, onPressMission() {}, ...extra});
const badges = tree => walk(tree).filter(n => n.type === 'View' && n.props.style && n.props.style.width === 30 && n.props.style.borderRadius === 15).map(n => texts(n)[0]);

test('done (server): numbers and strings become short unique keys, at most 500; nothing usable means no field', () => {
  assert.deepEqual(combos({done: [352216486, '812644940', '812644940', '', null, {}, 'x'.repeat(80)]}).done, ['352216486', '812644940']);
  assert.equal(combos({done: Array.from({length: 900}, (_, i) => String(1000 + i))}).done.length, 500);
  for (const bad of [undefined, null, [], 'x', 5, {}, [null, '', undefined, 'y'.repeat(65)]]) assert.equal(combos({done: bad}).done, undefined);
  assert.deepEqual(api.normalizeTodayCombos({date: TODAY(), ...combos({done: ['1']})}).done, ['1'], 'normalizing twice is the same');
});

test('autoDoneIds: a mission is paid when its campaignKey (or its id when the id is the key) is in done; across easy, steps and singles', () => {
  const data = combos({
    bundles: [{goal: 1000, missions: [mission('h1', 1000, {campaignKey: '111'})]}, {goal: 5000, missions: [mission('222', 5000)]}],
    singles: [{goal: 1000, missions: [mission('333', 1008)]}],
    easy: {missions: [mission('e1', 100, {campaignKey: '444'}), mission('e2', 120)]},
    done: ['111', '222', '444', '999'],
  });
  assert.deepEqual([...api.autoDoneIds(data)].sort(), ['222', 'e1', 'h1'], 'h1 by campaignKey 111, 222 by id, e1 by campaignKey 444');
  assert.equal(api.autoDoneIds(combos()).size, 0);
  assert.equal(api.autoDoneIds(null).size, 0);
});

test('guide: paid rows are done on their own — at the bottom, ✓, out of the remaining sum, numbers counted again, check filled and not tappable; hand ticks still work', () => withReact(({host}) => {
  const ticks = [];
  const data = combos({easy: {missions: [mission('e1', 100, {campaignKey: '1001'}), mission('e2', 200, {campaignKey: '1002'}), mission('e3', 300, {campaignKey: '1003'}), mission('e4', 400, {campaignKey: '1004'})]}, done: ['1002']});
  const tree = host.render(() => api.ComboGuideScreen(props({combos: data, onToggleDone: id => ticks.push(id)})));
  assert.deepEqual(badges(tree), ['1', '2', '3', '✓'], 'e1 e3 e4 numbered, the paid e2 last with ✓');
  const all = texts(tree);
  assert.ok(all.includes('남은 합계') && all.includes('+800P'), 'sum without the paid row (100 + 300 + 400)');
  const paidCheck = byLabel(tree, '일 e2 완료 표시');
  assert.equal(paidCheck.props.accessibilityState.checked, true);
  assert.equal(paidCheck.props.accessibilityState.disabled, true);
  assert.equal(paidCheck.props.disabled, true, 'a paid row cannot be un-ticked');
  assert.equal(byLabel(tree, '일 e2, 완료').props.disabled, true);
  // a hand tick on another row works as before
  byLabel(tree, '일 e3 완료 표시').props.onPress();
  assert.deepEqual(ticks, ['e3']);
}));

test('guide: hand-ticked and paid rows together; everything done says so; a paid row is done even without onToggleDone', () => withReact(({host}) => {
  const data = combos({easy: {missions: [mission('e1', 100, {campaignKey: '1001'}), mission('e2', 200, {campaignKey: '1002'})]}, done: ['1001']});
  const some = host.render(() => api.ComboGuideScreen(props({combos: data, done: new Set(['e2'])})));
  assert.ok(texts(some).includes('모두 마쳤어요'), 'e1 paid + e2 ticked = all done');
  const plain = host.render(() => api.ComboGuideScreen(props({combos: data})));
  assert.deepEqual(badges(plain), ['1', '✓']);
  assert.equal(walk(plain).some(n => n.props?.accessibilityRole === 'checkbox'), false, 'no check without a toggle');
}));

test('entry: a hand tick is kept per member and per campaign key across days (the next day\'s rows have other ids but the same key)', () => withReact(async ({make}) => {
  api.resetDoneMemory();
  const store = new Map();
  const storage = {getItem: async k => store.get(k) ?? null, setItem: async (k, v) => { store.set(k, v); }};
  const dayOne = combos({easy: {missions: [mission('h-mon', 100, {name: '첫째', campaignKey: '5001'}), mission('h-mon2', 200, {name: '둘째', campaignKey: '5002'})]}});
  const host = make();
  const mount = load => host.render(() => api.ComboEntry({placement: 'chance', load, loadKey: 9, storage, campaigns: null}));
  const loadOne = async () => ({ok: true, combos: dayOne});
  mount(loadOne); host.flush(); await tick(); mount(loadOne); host.flush(); await tick();
  api.requestOpenCombos();
  let tree = mount(loadOne);
  walk(tree).find(n => n.props?.accessibilityLabel === '첫째 완료 표시').props.onPress();
  await tick();
  assert.deepEqual(JSON.parse(store.get('jcurve.combos.done:9')).ids, ['5001'], 'stored by the campaign key, not the row id');
  // a later day: new row ids (hashes), the same campaign keys; a new entry on the same device storage
  const dayTwo = combos({easy: {missions: [mission('h-tue', 100, {name: '첫째', campaignKey: '5001'}), mission('h-tue2', 300, {name: '셋째', campaignKey: '5003'})]}});
  const host2 = make();
  const loadTwo = async () => ({ok: true, combos: dayTwo});
  const mount2 = () => host2.render(() => api.ComboEntry({placement: 'chance', load: loadTwo, loadKey: 9, storage, campaigns: null}));
  mount2(); host2.flush(); await tick(); mount2(); host2.flush(); await tick();
  api.requestOpenCombos();
  tree = mount2();
  assert.equal(byLabel(tree, '첫째, 완료').props.disabled, true, 'still done the next day');
  assert.ok(texts(tree).includes('남은 합계') && texts(tree).includes('+300P'));
  assert.equal(walk(tree).find(n => n.props?.accessibilityLabel === '첫째 완료 표시').props.accessibilityState.checked, true);
  // and the member can tap it again to undo
  walk(tree).find(n => n.props?.accessibilityLabel === '첫째 완료 표시').props.onPress();
  tree = mount2();
  assert.ok(byLabel(tree, '1번 첫째', true), 'back in the list as number 1');
}));

// ---- fetching again for the server's done list ----
const withClock = () => {
  const real = Date.now; let skew = 0; Date.now = () => real() + skew;
  return {jump(ms) { skew += ms; }, restore() { Date.now = real; }};
};
const refreshSetup = async ({make, rn}, replies) => {
  let calls = 0;
  const load = async () => { const reply = replies[Math.min(calls, replies.length - 1)]; calls++; return reply; };
  const appState = [];
  rn.AppState = {addEventListener: (type, cb) => { appState.push(cb); return {remove() {}}; }};
  const host = make();
  const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load, loadKey: 3, campaigns: null}));
  mount(); host.flush(); await tick(15); mount(); host.flush(); await tick(15);
  // this harness' setters do not re-render by themselves: render again so the effects that a trigger started can run
  const settle = async () => { mount(); host.flush(); await tick(15); mount(); host.flush(); await tick(15); };
  return {mount, host, appState, settle, calls: () => calls, event: type => { const sub = rn.__subs.find(s => s[1] === 'JCurveOfferwallEvent'); sub[2]({type}); }};
};

test('refresh: opening the sheet, the app coming back to the front, and the SDK detail closing each fetch the combos again — at most once per few seconds', () => withReact(async ctx => {
  const clock = withClock();
  try {
    const data = {ok: true, combos: combos({easy: {missions: [mission('e1', 100, {campaignKey: '1001'})]}})};
    const s = await refreshSetup(ctx, [data]);
    assert.equal(s.calls(), 1, 'the first load');
    api.requestOpenCombos(); await s.settle();
    assert.equal(s.calls(), 1, 'opening right after the first load does not fetch twice');
    clock.jump(3000);
    s.appState.forEach(cb => cb('active')); await s.settle();
    assert.equal(s.calls(), 2, 'app back to the front');
    s.appState.forEach(cb => cb('active')); await s.settle();
    assert.equal(s.calls(), 2, 'a second one at once is skipped');
    s.appState.forEach(cb => cb('background')); await s.settle();
    assert.equal(s.calls(), 2, 'only "active" counts');
    clock.jump(3000);
    s.event('detailClosed'); await s.settle();
    assert.equal(s.calls(), 3, 'the SDK detail screen closed');
    clock.jump(3000);
    s.event('customNativeClickSuccess'); await s.settle();
    assert.equal(s.calls(), 3, 'other bridge events are ignored');
  } finally { clock.restore(); }
}, {nativeModules: {JCurveOfferwallModule: {}}}));

test('refresh: the sheet opening later (after the gap) fetches again; the new done list is shown; a failed refresh keeps the rows on screen', () => withReact(async ctx => {
  const clock = withClock();
  try {
    const before = {ok: true, combos: combos({easy: {missions: [mission('e1', 100, {name: '첫째', campaignKey: '1001'}), mission('e2', 200, {name: '둘째', campaignKey: '1002'})]}})};
    const after = {ok: true, combos: combos({easy: {missions: [mission('e1', 100, {name: '첫째', campaignKey: '1001'}), mission('e2', 200, {name: '둘째', campaignKey: '1002'})]}, done: ['1001']})};
    const s = await refreshSetup(ctx, [before, after, {ok: false, reason: 'network'}]);
    clock.jump(3000);
    api.requestOpenCombos();
    await s.settle();
    let tree = s.mount();
    assert.equal(hasSheet(tree), true);
    assert.equal(s.calls(), 2, 'refetched on open');
    assert.deepEqual(badges(tree), ['1', '✓'], 'the server now says the first campaign was paid: it sank and the number restarted');
    assert.ok(texts(tree).includes('남은 합계') && texts(tree).includes('+200P'));
    // a failing refresh (network) must not empty the sheet
    clock.jump(3000);
    s.appState.forEach(cb => cb('active')); await s.settle();
    tree = s.mount();
    assert.equal(s.calls(), 3);
    assert.equal(hasSheet(tree), true, 'the sheet is still there');
    assert.deepEqual(badges(tree), ['1', '✓'], 'with the rows it had');
  } finally { clock.restore(); }
}, {nativeModules: {JCurveOfferwallModule: {}}}));

test('refresh: without AppState or the native bridge nothing throws and the sheet-open refresh still works', () => withReact(async ({make}) => {
  const clock = withClock();
  try {
    let calls = 0;
    const data = {ok: true, combos: combos({easy: {missions: [mission('e1', 100)]}})};
    const load = async () => { calls++; return data; };
    const host = make();
    const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load, loadKey: 4, campaigns: null}));
    mount(); host.flush(); await tick(15); mount(); host.flush(); await tick(15);
    clock.jump(3000);
    api.requestOpenCombos(); mount(); host.flush(); await tick(15); mount(); host.flush(); await tick(15);
    assert.equal(calls, 2);
  } finally { clock.restore(); }
}));
