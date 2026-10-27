const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, byLabel, tick, hasSheet} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const combosOf = (missions, goal = 1000) => api.normalizeTodayCombos({date: TODAY(), bundles: [{goal, missions}]});
const camp = (campaignKey, name) => ({campaignKey, name});

// One Chance-tab entry with a single mission row, opened and tapped.
const startWith = async (make, missionExtra, id, extra) => {
  const host = make();
  const load = async () => ({ok: true, combos: combosOf([mission(id, 1008, {name: '신한 SOL페이 앱', ...missionExtra})])});
  const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load, loadKey: 1, usn: 'a'.repeat(64), ...extra}));
  mount(); host.flush(); await tick();
  mount(); host.flush();
  assert.equal(api.requestOpenCombos(), true);
  const tree = mount();
  return {tree, again: mount, tap: async () => { byLabel(tree, '1번 ', true).props.onPress(); await tick(20); }};
};

test('diag tap: the server key opens the campaign at once, before any list answers; one report', () => withReact(async ({make}) => {
  const opened = []; const diags = [];
  let release; const slow = new Promise(r => { release = r; });
  const bridge = {list: () => slow, open: async key => { opened.push(key); return true; }};
  const {tap, again} = await startWith(make, {campaignKey: '352216486'}, 'abc123def456', {campaigns: bridge, onDiagnostic: d => diags.push(d)});
  await tap(); // the list is still pending
  assert.deepEqual(opened, ['352216486']);
  release([]);
  assert.equal(diags.length, 1);
  assert.equal(diags[0].how, 'server_key');
  assert.equal(diags[0].key, '352216486');
  assert.equal(diags[0].open, true);
  assert.equal(diags[0].attempts, 1);
  assert.equal(diags[0].bridge, true);
  assert.equal(hasSheet(again()), true, 'the guide stays for the next campaign');
}));

test('diag tap: a numeric mission id is the server key when no campaignKey came; a hash id is not', () => withReact(async ({make}) => {
  const opened = []; const diags = [];
  const bridge = {list: async () => [], open: async key => { opened.push(key); return true; }};
  const numeric = await startWith(make, {}, '352216486', {campaigns: bridge, onDiagnostic: d => diags.push(d)});
  await numeric.tap();
  assert.deepEqual(opened, ['352216486']);
  assert.equal(diags[0].how, 'server_key');
  api.listenForComboRequests({priority: 0, open() {}})();
  const hashed = await startWith(make, {}, 'abc123def456', {campaigns: bridge, onDiagnostic: d => diags.push(d)});
  await hashed.tap();
  assert.deepEqual(opened, ['352216486'], 'a 12-hex hash id is never given to the SDK as a key');
  assert.equal(diags[1].how, 'none');
}));

test('diag tap: a refused server key moves on to the name in the list, then reports both tries', () => withReact(async ({make}) => {
  const opened = []; const diags = [];
  const bridge = {list: async () => [camp('222', '신한 SOL페이 앱')], open: async key => { opened.push(key); return key === '222'; }};
  const {tap} = await startWith(make, {campaignKey: '111'}, 'abc123def456', {campaigns: bridge, onDiagnostic: d => diags.push(d)});
  await tap();
  assert.deepEqual(opened, ['111', '222']);
  assert.equal(diags[0].how, 'name');
  assert.equal(diags[0].key, '222');
  assert.equal(diags[0].attempts, 2);
  assert.equal(diags[0].open, true);
  assert.equal(diags[0].listCount, 1);
}));

test('diag tap: the same key is never tried twice (campaignKey equal to a numeric id)', () => withReact(async ({make}) => {
  const opened = [];
  const bridge = {list: async () => [], open: async key => { opened.push(key); return false; }};
  const {tap} = await startWith(make, {campaignKey: '352216486'}, '352216486', {campaigns: bridge});
  await tap();
  assert.deepEqual(opened, ['352216486']);
}));

test('diag tap: fallback reports why the list was empty (error), the SDK answer, and whether the name was copied', () => withReact(async ({make}) => {
  const diags = [];
  const bridge = {list: async () => { throw new Error('NullPointerException at list'); }, open: async () => false};
  const {tap, again} = await startWith(make, {campaignKey: '111'}, 'abc123def456', {campaigns: bridge, copyText: () => true, onDiagnostic: d => diags.push(d)});
  await tap();
  const d = diags[0];
  assert.equal(d.t, 'tap');
  assert.equal(d.how, 'server_key', 'the last key tried');
  assert.equal(d.open, false);
  assert.equal(d.listCount, 0);
  assert.match(d.listError, /NullPointerException/);
  assert.equal(d.copied, true);
  assert.ok(texts(again()).includes('"신한 SOL페이 앱" 를 찾아 주세요 · 이름을 복사했어요'), 'the fallback still shows');
}));

test('diag tap: no key at all and no bridge -> open "skipped", bridge false', () => withReact(async ({make}) => {
  const diags = [];
  const {tap} = await startWith(make, {}, 'abc123def456', {campaigns: null, onDiagnostic: d => diags.push(d)});
  await tap();
  assert.equal(diags.length, 1);
  assert.equal(diags[0].bridge, false);
  assert.equal(diags[0].open, 'skipped');
  assert.equal(diags[0].how, 'none');
  assert.equal(diags[0].attempts, 0);
}));

test('diag tap: the list sample is the first 5 names, cut to 40 characters; a throwing open is reported as an error', () => withReact(async ({make}) => {
  const diags = [];
  const names = ['가'.repeat(60), '나', '다', '라', '마', '바', '사'];
  const bridge = {list: async () => names.map((n, i) => camp(String(500 + i), n)), open: async () => { throw new Error('boom '.repeat(40)); }};
  const {tap} = await startWith(make, {campaignKey: '111'}, 'abc123def456', {campaigns: bridge, onDiagnostic: d => diags.push(d)});
  await tap();
  const d = diags[0];
  assert.equal(d.listCount, 7);
  assert.equal(d.listSample.length, 5);
  assert.equal(d.listSample[0].length, 40);
  assert.equal(d.open, 'error');
  assert.ok(d.openError.length <= 80, 'error text is short');
}));

test('diag tap: carries no member, device or advertising id, and a failing or rejecting handler never breaks the tap', () => withReact(async ({make}) => {
  const diags = [];
  const bridge = {list: async () => [], open: async () => true};
  const {tap} = await startWith(make, {campaignKey: '111'}, 'abc123def456', {campaigns: bridge, onDiagnostic: d => diags.push(d)});
  await tap();
  const allowed = new Set(['t', 'mission', 'name', 'bridge', 'listCount', 'listError', 'listSample', 'how', 'key', 'attempts', 'open', 'openError', 'openMs', 'copied', 'ms', 'via', 'embedded', 'embeddedMs']);
  assert.deepEqual(Object.keys(diags[0]).filter(k => !allowed.has(k)), []);
  assert.equal(JSON.stringify(diags[0]).includes('a'.repeat(64)), false, 'the wall usn is not in it');
  for (const onDiagnostic of [() => { throw new Error('x'); }, async () => { throw new Error('y'); }]) {
    api.listenForComboRequests({priority: 0, open() {}})();
    const calls = [];
    const again = await startWith(make, {campaignKey: '111'}, 'abc123def456', {campaigns: {list: async () => [], open: async key => { calls.push(key); return true; }}, onDiagnostic});
    await again.tap();
    assert.deepEqual(calls, ['111']);
  }
}));

test('diag tap: onPressMission takes over and no report is made', () => withReact(async ({make}) => {
  const diags = []; const got = [];
  const {tap} = await startWith(make, {campaignKey: '111'}, 'abc123def456', {
    onPressMission: m => got.push(m.id), onDiagnostic: d => diags.push(d),
    campaigns: {list: async () => [], open: async () => true},
  });
  await tap();
  assert.deepEqual(got, ['abc123def456']);
  assert.deepEqual(diags, []);
}));

test('diag tap: a "no" that took as long as the native timeout stops further tries (the page may still be loading), then falls back', () => withReact(async ({make}) => {
  const realNow = Date.now; let skew = 0; Date.now = () => realNow() + skew;
  try {
    const opened = []; const diags = [];
    const bridge = {list: async () => [camp('222', '신한 SOL페이 앱')], open: async key => { opened.push(key); skew += 5000; return false; }};
    const {tap, again} = await startWith(make, {campaignKey: '111'}, 'abc123def456', {campaigns: bridge, copyText: () => true, onDiagnostic: d => diags.push(d)});
    await tap();
    assert.deepEqual(opened, ['111'], 'no second page after a slow refusal');
    assert.equal(diags[0].open, false);
    assert.ok(diags[0].openMs >= 4500);
    assert.ok(texts(again()).some(t => t.includes('찾아 주세요')), 'the name is still shown');
  } finally { Date.now = realNow; }
}));
