const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, byLabel, tick, hasSheet} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const combosOf = (missions) => api.normalizeTodayCombos({date: TODAY(), display: {chance: 'chip', home: 'banner'}, bundles: [{goal: 1000, missions}]});

const startWith = async (make, missionExtra, extra, placement = 'chance') => {
  const host = make();
  const load = async () => ({ok: true, combos: combosOf([mission('abc123def456', 1008, {name: '스탁매니저', ...missionExtra})])});
  const mount = () => host.render(() => api.ComboEntry({placement, load, loadKey: 1, usn: 'a'.repeat(64), ...extra}));
  mount(); host.flush(); await tick();
  mount(); host.flush();
  assert.equal(api.requestOpenCombos(), true);
  const tree = mount();
  return {tree, again: mount, tap: async (wait = 30) => { byLabel(tree, '1번 ', true).props.onPress(); await tick(wait); }};
};
// Records timers longer than 100 ms instead of running them (the 10 s wait for the embedded detail), short ones still run.
const fakeLongTimers = () => {
  const real = global.setTimeout;
  const captured = [];
  global.setTimeout = (fn, ms, ...rest) => {
    if (ms > 100) { captured.push([fn, ms]); return {}; }
    return real(fn, ms, ...rest);
  };
  return {captured, restore() { global.setTimeout = real; }};
};
// A stand-in for the Chance tab's wall: says what it was asked to show and answers like the native view would.
const fakeWall = (answer) => {
  const shown = [];
  const off = api.registerEmbeddedWall(request => {
    shown.push(request);
    if (request && answer) setTimeout(() => answer(request), 5);
  });
  return {shown, off};
};
const bridgeOf = (opened, result = true) => ({list: async () => [], open: async key => { opened.push(key); return result; }});

test('embedded tap: the wall shows the detail, the sheet closes, the chip stays, the SDK full-screen detail is not used', () => withReact(async ({make}) => {
  const opened = []; const diags = [];
  const wall = fakeWall(request => api.embeddedDetailLoaded(request.nonce));
  try {
    const {again, tap} = await startWith(make, {campaignKey: '352216486'}, {campaigns: bridgeOf(opened), onDiagnostic: d => diags.push(d)});
    await tap();
    assert.deepEqual(wall.shown.map(r => r && r.key), ['352216486']);
    assert.deepEqual(opened, [], 'no native full-screen detail');
    const after = again();
    assert.equal(hasSheet(after), false, 'the sheet closes so the detail is visible');
    assert.ok(byLabel(after, '포인트 빨리 모으기'), 'the chip is still there');
    assert.equal(diags.length, 1);
    assert.deepEqual([diags[0].via, diags[0].embedded, diags[0].how, diags[0].open, diags[0].key], ['embedded', 'loaded', 'server_key', true, '352216486']);
    assert.equal(typeof diags[0].embeddedMs, 'number');
  } finally { wall.off(); }
}));

test('embedded tap: the wall fails -> the wall is put back and the SDK full-screen detail opens the same key; the sheet stays', () => withReact(async ({make}) => {
  const opened = []; const diags = [];
  const wall = fakeWall(request => api.embeddedDetailFailed(request.nonce));
  try {
    const {again, tap} = await startWith(make, {campaignKey: '352216486'}, {campaigns: bridgeOf(opened), onDiagnostic: d => diags.push(d)});
    await tap();
    assert.deepEqual(wall.shown.map(r => r && r.key), ['352216486', null], 'asked, then back to the list');
    assert.deepEqual(opened, ['352216486']);
    assert.equal(hasSheet(again()), true);
    assert.deepEqual([diags[0].via, diags[0].embedded, diags[0].open], ['native', 'failed', true]);
  } finally { wall.off(); }
}));

test('embedded tap: no answer within 10 s -> back to the list and the SDK full-screen detail', () => withReact(async ({make}) => {
  const opened = []; const diags = [];
  const wall = fakeWall(null);
  const timers = fakeLongTimers();
  try {
    const {tap} = await startWith(make, {campaignKey: '352216486'}, {campaigns: bridgeOf(opened), onDiagnostic: d => diags.push(d)});
    await tap(10);
    assert.deepEqual(opened, [], 'still waiting for the wall');
    const waiting = timers.captured.find(([, ms]) => ms === api.EMBEDDED_DETAIL_TIMEOUT_MS);
    assert.ok(waiting, 'the wait is 10 s');
    waiting[0]();
    await tick(30);
    assert.deepEqual(wall.shown.map(r => r && r.key), ['352216486', null]);
    assert.deepEqual(opened, ['352216486']);
    assert.deepEqual([diags[0].via, diags[0].embedded], ['native', 'failed']);
  } finally { timers.restore(); wall.off(); }
}));

test('embedded tap: a second tap while the first detail is still loading is ignored', () => withReact(async ({make}) => {
  const opened = [];
  const wall = fakeWall(null);
  const timers = fakeLongTimers();
  try {
    const {tree, tap} = await startWith(make, {campaignKey: '352216486'}, {campaigns: bridgeOf(opened)});
    await tap(10);
    byLabel(tree, '1번 ', true).props.onPress(); await tick(10);
    assert.equal(wall.shown.filter(Boolean).length, 1, 'only one request reached the wall');
  } finally { timers.restore(); wall.off(); }
}));

test('embedded tap: without a mounted wall (Android, old binary) nothing changes: the SDK full-screen detail, the sheet stays', () => withReact(async ({make}) => {
  const opened = []; const diags = [];
  const {again, tap} = await startWith(make, {campaignKey: '352216486'}, {campaigns: bridgeOf(opened), onDiagnostic: d => diags.push(d)});
  await tap();
  assert.deepEqual(opened, ['352216486']);
  assert.equal(hasSheet(again()), true);
  assert.equal(diags[0].via, 'native');
  assert.equal(diags[0].embedded, undefined, 'the wall was never asked');
}));

test('embedded tap: Home has no wall below, so it uses the SDK full-screen detail even when a wall is mounted', () => withReact(async ({make}) => {
  const opened = [];
  const wall = fakeWall(request => api.embeddedDetailLoaded(request.nonce));
  try {
    const {tap} = await startWith(make, {campaignKey: '352216486'}, {campaigns: bridgeOf(opened)}, 'home');
    await tap();
    assert.deepEqual(opened, ['352216486']);
    assert.deepEqual(wall.shown, []);
  } finally { wall.off(); }
}));

test('embedded tap: a name-matched key (from the SDK list) also goes through the wall', () => withReact(async ({make}) => {
  const opened = []; const diags = [];
  const wall = fakeWall(request => api.embeddedDetailLoaded(request.nonce));
  try {
    const bridge = {list: async () => [{campaignKey: '222', name: '스탁매니저'}], open: async key => { opened.push(key); return true; }};
    const {tap} = await startWith(make, {}, {campaigns: bridge, onDiagnostic: d => diags.push(d)});
    await tap(60);
    assert.deepEqual(wall.shown.map(r => r && r.key), ['222']);
    assert.deepEqual(opened, []);
    assert.deepEqual([diags[0].how, diags[0].via], ['name', 'embedded']);
  } finally { wall.off(); }
}));
