const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, byLabel, tick} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const norm = (over = {}) => api.normalizeTodayCombos({date: TODAY(), bundles: [{goal: 1000, missions: [mission('b1', 1000)]}], ...over});
const ids = list => list.map(m => m.id);

test('soldout (server): rows whose campaignKey (or id, a number too) is listed are gone; the step keeps its goal with the rows left', () => {
  const data = norm({
    bundles: [
      {goal: 1000, missions: [mission('a', 700, {campaignKey: '1'}), mission('b', 500, {campaignKey: '2'}), mission('c', 600, {campaignKey: '3'})]},
      {goal: 5000, missions: [mission('999', 5200), mission('e', 100, {campaignKey: '5'})]},
    ],
    soldout: ['1', 999],
  });
  assert.deepEqual(data.bundles.map(b => b.goal), [1000], 'the 5천P step lost its big row (the id is the key) and cannot reach its goal: gone');
  assert.deepEqual(ids(data.bundles[0].missions), ['b', 'c']);
  assert.equal(data.bundles[0].total, 1100, 'the total is the rows that are left');
});

test('soldout: a step that falls short of its goal is dropped; no step left means no combos at all', () => {
  const two = norm({
    bundles: [
      {goal: 1000, missions: [mission('a', 1000, {campaignKey: '1'})]},
      {goal: 5000, missions: [mission('b', 3000, {campaignKey: '2'}), mission('c', 2500, {campaignKey: '3'}), mission('d', 100, {campaignKey: '4'})]},
    ],
    soldout: ['1', '3'],
  });
  assert.equal(two, null, 'both steps fell below their goals');
  const one = norm({
    bundles: [
      {goal: 1000, missions: [mission('a', 1000, {campaignKey: '1'})]},
      {goal: 5000, missions: [mission('b', 3000, {campaignKey: '2'}), mission('c', 2500, {campaignKey: '3'})]},
    ],
    soldout: ['1'],
  });
  assert.deepEqual(one.bundles.map(b => b.goal), [5000], 'only the 1천P step is gone');
});

test('soldout: singles and easy lose the row (the easy total follows; an empty box or tab disappears)', () => {
  const data = norm({
    singles: [{goal: 1000, missions: [mission('s1', 1008, {campaignKey: '444'}), mission('s2', 1010, {campaignKey: '555'})]}],
    easy: {missions: [mission('e1', 100, {campaignKey: '666'}), mission('e2', 120, {campaignKey: '777'})]},
    soldout: ['444', '777'],
  });
  assert.deepEqual(ids(data.singles[0].missions), ['s2']);
  assert.deepEqual(ids(data.easy.missions), ['e1']);
  assert.equal(data.easy.total, 100);
  const none = norm({
    singles: [{goal: 1000, missions: [mission('s1', 1008, {campaignKey: '444'})]}],
    easy: {missions: [mission('e1', 100, {campaignKey: '666'})]},
    soldout: ['444', '666'],
  });
  assert.equal(none.singles, undefined, 'the single box is hidden when it has nothing');
  assert.equal(none.easy, undefined, 'and so is the easy tab');
});

test('soldout: a row this member was already paid for today stays (as a done row); junk or a missing list changes nothing; normalizing twice is the same', () => {
  const data = norm({
    bundles: [{goal: 1000, missions: [mission('a', 1000, {campaignKey: '1'}), mission('b', 600, {campaignKey: '2'})]}],
    soldout: ['1', '2'], done: ['1'],
  });
  assert.deepEqual(ids(data.bundles[0].missions), ['a'], 'a was paid today (kept), b is sold out (gone)');
  assert.deepEqual([...api.autoDoneIds(data)], ['a']);
  assert.deepEqual(api.normalizeTodayCombos(data), data);
  for (const bad of [undefined, null, [], 'x', 5, {}, [null, '', {}, true, 'y'.repeat(65)]]) assert.deepEqual(norm({soldout: bad}), norm(), JSON.stringify(bad));
});

// ---- the entry: a refused or quickly closed detail page is reported, and the combos are fetched again ----

const fakeTimers = () => {
  const real = global.setTimeout;
  const captured = [];
  global.setTimeout = (fn, ms, ...rest) => {
    if (ms > 100) { captured.push({fn, ms, cleared: false}); return captured[captured.length - 1]; }
    return real(fn, ms, ...rest);
  };
  const realClear = global.clearTimeout;
  global.clearTimeout = handle => { if (handle && typeof handle === 'object' && 'fn' in handle) handle.cleared = true; else realClear(handle); };
  const waiting = () => captured.filter(x => !x.cleared && x.ms === api.COMBO_SIGNAL_REFRESH_MS);
  return {
    fireRefresh() { for (const t of waiting()) { t.cleared = true; t.fn(); } },
    pending: () => waiting().length,
    restore() { global.setTimeout = real; global.clearTimeout = realClear; },
  };
};
const withClock = () => {
  const real = Date.now; let skew = 0; Date.now = () => real() + skew;
  return {jump(ms) { skew += ms; }, restore() { Date.now = real; }};
};

const rows = (soldout = []) => norm({
  bundles: [{goal: 1000, missions: [mission('abc123def456', 1008, {name: '신한 SOL페이 앱', campaignKey: '352216486'}), mission('def456abc123', 1100, {name: '토스 앱', campaignKey: '777'})]}],
  soldout,
});

// One Chance-tab entry with two rows; `replies` are the combos the server gives, in order (the last one repeats).
const start = async ({make, rn}, {bridge, extra = {}, replies = [rows()]} = {}) => {
  const host = make();
  const state = {loads: 0};
  const load = async () => { const combos = replies[Math.min(state.loads, replies.length - 1)]; state.loads += 1; return {ok: true, combos}; };
  const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load, loadKey: 1, usn: 'a'.repeat(64), campaigns: bridge, ...extra}));
  mount(); host.flush(); await tick();
  mount(); host.flush();
  return {
    state, host,
    again: () => { host.flush(); return mount(); },
    tap: async () => { assert.equal(api.requestOpenCombos(), true); const tree = mount(); byLabel(tree, '1번 ', true).props.onPress(); await tick(20); },
    closeDetail: () => { const sub = rn.__subs.find(s => s[1] === 'JCurveOfferwallEvent'); sub[2]({type: 'detailClosed'}); },
  };
};
const refusing = {list: async () => [], open: async () => false};
const opening = {list: async () => [], open: async () => true};
const NATIVE = {nativeModules: {JCurveOfferwallModule: {}}};

test('open failed: a refused detail page is reported once per key (result, key, platform, wait); an opened one is not', () => withReact(async ctx => {
  const signals = [];
  const s = await start(ctx, {bridge: refusing, extra: {onDetailSignal: f => signals.push(f)}});
  await s.tap();
  assert.equal(signals.length, 1);
  assert.deepEqual({...signals[0], ms: typeof signals[0].ms}, {result: 'open_failed', campaignKey: '352216486', platform: 'android', ms: 'number'});
  await s.tap();
  assert.equal(signals.length, 1, 'the same key is not reported again in this visit');
  const opened = [];
  const ok = await start(ctx, {bridge: opening, extra: {onDetailSignal: f => opened.push(f)}});
  await ok.tap();
  assert.deepEqual(opened, []);
}, NATIVE));

test('open failed: the app never hides the row itself; a failing or missing report callback breaks nothing', () => withReact(async ctx => {
  const diags = [];
  for (const onDetailSignal of [undefined, () => { throw new Error('x'); }, async () => { throw new Error('y'); }]) {
    const s = await start(ctx, {bridge: refusing, extra: {onDetailSignal, onDiagnostic: d => diags.push(d)}});
    await s.tap();
  }
  assert.equal(diags.length, 3, 'the tap diagnostic still arrives');
  assert.deepEqual(diags.map(d => d.open), [false, false, false]);
}, NATIVE));

test('closed fast: a detail page that opened and closed within 15 s is reported (result closed_fast, key, platform, how long it stayed); a longer stay is not', () => withReact(async ctx => {
  const clock = withClock();
  try {
    const signals = [];
    const s = await start(ctx, {bridge: opening, extra: {onDetailSignal: f => signals.push(f)}});
    await s.tap();
    assert.deepEqual(signals, [], 'nothing while the page is open');
    clock.jump(4000);
    s.closeDetail();
    assert.equal(signals.length, 1);
    assert.equal(signals[0].result, 'closed_fast');
    assert.equal(signals[0].campaignKey, '352216486');
    assert.equal(signals[0].platform, 'android');
    assert.ok(signals[0].ms >= 4000 && signals[0].ms < 6000, `ms ${signals[0].ms}`);
    s.closeDetail();
    assert.equal(signals.length, 1, 'a close with no page opened before it says nothing');
    const slow = [];
    const t = await start(ctx, {bridge: opening, extra: {onDetailSignal: f => slow.push(f)}});
    await t.tap();
    clock.jump(api.COMBO_CLOSED_FAST_MS + 1000);
    t.closeDetail();
    assert.deepEqual(slow, [], 'a page that stayed open longer than the limit is a normal visit');
  } finally { clock.restore(); }
}, NATIVE));

test('closed fast: once per key per visit; other bridge events and a refused open do not count as a close', () => withReact(async ctx => {
  const signals = [];
  const s = await start(ctx, {bridge: opening, extra: {onDetailSignal: f => signals.push(f)}});
  await s.tap(); s.closeDetail();
  await s.tap(); s.closeDetail();
  assert.deepEqual(signals.map(x => x.result), ['closed_fast'], 'the second quick close of the same key is not sent again');
  const sub = ctx.rn.__subs.find(x => x[1] === 'JCurveOfferwallEvent');
  sub[2]({type: 'customNativeClickSuccess'});
  assert.equal(signals.length, 1);
  const refused = [];
  const r = await start(ctx, {bridge: refusing, extra: {onDetailSignal: f => refused.push(f)}});
  await r.tap(); r.closeDetail();
  assert.deepEqual(refused.map(x => x.result), ['open_failed'], 'a page that never opened cannot close fast');
}, NATIVE));

test('detail signal: a few seconds later the combos are fetched again, and a soldout list from the server takes the row off the sheet', () => withReact(async ctx => {
  const timers = fakeTimers();
  try {
    const signals = [];
    const s = await start(ctx, {bridge: refusing, replies: [rows(), rows(['352216486'])], extra: {onDetailSignal: f => signals.push(f)}});
    const before = s.state.loads;
    await s.tap();
    assert.equal(signals.length, 1);
    assert.equal(timers.pending(), 1, 'a refetch is waiting');
    assert.equal(s.state.loads, before, 'not yet');
    timers.fireRefresh();
    // this harness' setters do not re-render by themselves: render again so the effects that the refetch started can run
    s.again(); await tick(15); s.again(); await tick(15);
    assert.equal(s.state.loads, before + 1, 'fetched again');
    assert.equal(api.requestOpenCombos(), true);
    s.again(); await tick(15);
    const all = texts(s.again());
    assert.equal(all.includes('신한 SOL페이 앱'), false, 'the sold-out row is gone');
    assert.ok(all.includes('토스 앱'), 'the other row stays');
  } finally { timers.restore(); }
}, NATIVE));
