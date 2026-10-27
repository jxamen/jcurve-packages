const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel, hasType, tick} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const combosOf = (missions, goal = 1000, date = TODAY()) => api.normalizeTodayCombos({date, bundles: [{goal, missions}]});
const camp = (campaignKey, name, reward) => ({campaignKey, name, ...(reward === undefined ? {} : {reward})});

test('campaign names: exact, then without spaces/punctuation, then without bracketed parts; unsure gives null', () => {
  const list = [camp('1', '신한 SOL페이 앱'), camp('2', '[공식] 짱구 게임 방범대'), camp('3', 'AnyPop : Zoo Blast'), camp('4', 'Zoo Blast (Global)'), camp('5', 'Zoo Blast (KR)')];
  assert.equal(api.findCampaignKey(list, '신한 SOL페이 앱'), '1');
  assert.equal(api.findCampaignKey(list, '신한SOL페이앱'), '1');
  assert.equal(api.findCampaignKey(list, '신한 sol페이 앱!'), '1');
  assert.equal(api.findCampaignKey(list, '짱구 게임 방범대'), '2', 'bracketed prefix dropped');
  assert.equal(api.findCampaignKey(list, 'anypop zoo blast'), '3');
  assert.equal(api.findCampaignKey(list, 'Zoo Blast'), null, 'two different campaigns look the same: do not guess');
  assert.equal(api.findCampaignKey(list, '없는 캠페인'), null);
  assert.equal(api.findCampaignKey(list, ''), null);
  assert.equal(api.findCampaignKey([], 'x'), null);
  assert.equal(api.findCampaignKey([camp('9', 'Same'), camp('9', 'same')], 'SAME'), '9', 'the same key twice is not ambiguous');
  assert.equal(api.normalizeCampaignName('[공식] Foo-Bar_1!'), '공식foobar1');
});

test('campaign list from native is cleaned: key and name required, deduped, trimmed', () => {
  const out = api.cleanCampaigns([camp('1', ' 이름 ', '1,008'), camp('1', '중복'), camp('', '키 없음'), camp('2', ''), null, 'x', {campaignKey: 3, name: '숫자 키'}, camp('4', 'a'.repeat(300))]);
  assert.deepEqual(out.map(c => c.campaignKey), ['1', '4']);
  assert.deepEqual(out[0], {campaignKey: '1', name: '이름', reward: '1,008'});
  assert.equal(out[1].name.length, 120);
  assert.deepEqual(api.cleanCampaigns('nope'), []);
  assert.equal(api.cleanCampaigns(Array.from({length: 900}, (_, i) => camp(`k${i}`, `n${i}`))).length, 500);
});

test('native detection never throws and needs the module AND its methods', () => withReact(async () => {
  assert.equal(api.nativeCampaignApi(), null);
  assert.equal(api.nativeCopyText(), null);
}));

test('native detection: with the bridge it lists (cleaned) and opens (true only when the SDK took it) and copies', () => {
  const calls = [];
  const mod = {
    loadCustomCampaigns: async max => { calls.push(['list', max]); return [camp('7', '이름')]; },
    openCampaignDetail: async key => { calls.push(['open', key]); return key === '7'; },
    setClipboard: async text => { calls.push(['copy', text]); return true; },
  };
  return withReact(async () => {
    const bridge = api.nativeCampaignApi();
    assert.deepEqual(await bridge.list(), [camp('7', '이름')]);
    assert.equal(await bridge.open('7'), true);
    assert.equal(await bridge.open('8'), false);
    assert.equal(await api.nativeCopyText()('복사'), true);
    assert.deepEqual(calls, [['list', 100], ['open', '7'], ['open', '8'], ['copy', '복사']]);
  }, {nativeModules: {JCurveOfferwallModule: mod}});
});

test('native detection: a module without the methods, or one that throws on lookup, counts as not available', async () => {
  await withReact(async () => { assert.equal(api.nativeCampaignApi(), null); assert.equal(api.nativeCopyText(), null); },
    {nativeModules: {JCurveOfferwallModule: {loadCustomCampaigns: async () => []}}});
  await withReact(async ({rn}) => {
    Object.defineProperty(rn, 'NativeModules', {get() { throw new Error('boom'); }});
    assert.equal(api.nativeCampaignApi(), null);
    assert.equal(api.nativeCopyText(), null);
  });
});

test('done marks: parse only this day, keep per member, persist as {d, ids}', () => withReact(async ({make}) => {
  const day = '2026-10-27';
  assert.deepEqual(api.parseDone(JSON.stringify({d: day, ids: ['a', 'b', 3, '']}), day), ['a', 'b']);
  assert.deepEqual(api.parseDone(JSON.stringify({d: '2026-10-26', ids: ['a']}), day), []);
  for (const bad of [null, undefined, '', 'x', '{}', '[]', JSON.stringify({d: day, ids: 'a'})]) assert.deepEqual(api.parseDone(bad, day), []);
  assert.equal(api.doneStorageKey(5), 'jcurve.combos.done:5');

  const store = new Map();
  const storage = {getItem: async k => store.get(k) ?? null, setItem: async (k, v) => { store.set(k, v); }};
  const view = make();
  const read = (scope, date = day) => view.render(() => api.useDoneMissions({storage, scope, date}));
  assert.equal(read(1).done.size, 0);
  view.flush(); await tick();
  read(1).toggle('a');
  assert.deepEqual([...read(1).done], ['a']);
  await tick();
  assert.deepEqual(JSON.parse(store.get('jcurve.combos.done:1')), {d: day, ids: ['a']});
  read(1).toggle('b'); read(1).toggle('a'); // untick a
  assert.deepEqual([...read(1).done], ['b']);
  // another member on the same phone starts empty and writes its own key
  assert.equal(read(2).done.size, 0);
  assert.equal(store.get('jcurve.combos.done:2'), undefined);
  // next day: nothing is done any more, even though yesterday's value is still stored
  assert.equal(read(1, '2026-10-28').done.size, 0);
  // a fresh view (app restart) loads what was saved for that member and day
  const restarted = make();
  restarted.render(() => api.useDoneMissions({storage, scope: 1, date: day})); restarted.flush(); await tick();
  assert.deepEqual([...restarted.render(() => api.useDoneMissions({storage, scope: 1, date: day})).done], ['b']);
}));

test('done marks: without storage they live in memory; a failing store never throws', () => withReact(async ({make}) => {
  const view = make();
  const read = storage => view.render(() => api.useDoneMissions({storage, scope: 1, date: '2026-10-27'}));
  read().toggle('x');
  assert.deepEqual([...read().done], ['x']);
  const broken = {getItem: async () => { throw new Error('io'); }, setItem: () => { throw new Error('io'); }};
  const other = make();
  other.render(() => api.useDoneMissions({storage: broken, scope: 1, date: '2026-10-27'})); other.flush(); await tick();
  const hook = other.render(() => api.useDoneMissions({storage: broken, scope: 1, date: '2026-10-27'}));
  hook.toggle('y');
  assert.deepEqual([...other.render(() => api.useDoneMissions({storage: broken, scope: 1, date: '2026-10-27'})).done], ['y']);
}));

test('guide: done rows sink, dim and drop out of the remaining sum; numbers restart; ticking works', () => withReact(({host}) => {
  const combos = combosOf([mission('a', 400), mission('b', 300), mission('c', 500)]);
  const ticked = [];
  const props = {combos, onClose() {}, onPressMission() {}, done: new Set(['a']), onToggleDone: id => ticked.push(id)};
  const tree = host.render(() => api.ComboGuideScreen(props));
  const names = walk(tree).filter(n => n.type === 'Text' && /^일 [abc]$/.test(n.children[0])).map(n => n.children[0]);
  assert.deepEqual(names, ['일 b', '일 c', '일 a'], 'remaining rows first, done last');
  const all = texts(tree);
  assert.ok(all.includes('남은 합계') && all.includes('800P'), 'sum counts only what is left (300 + 500)');
  assert.ok(all.includes('✓') && all.includes('완료'));
  assert.ok(byLabel(tree, '1번 일 b', true) && byLabel(tree, '2번 일 c', true), 'numbers restart for the remaining rows');
  const doneRow = byLabel(tree, '일 a, 완료');
  assert.equal(doneRow.props.disabled, true);
  const strike = walk(tree).find(n => n.type === 'Text' && n.children[0] === '일 a');
  assert.equal(strike.props.style.textDecorationLine, 'line-through');
  const marks = walk(tree).filter(n => n.type === 'Pressable' && n.props.accessibilityRole === 'checkbox');
  assert.equal(marks.length, 3);
  assert.equal(marks.find(n => n.props.accessibilityLabel === '일 a 완료 표시').props.accessibilityState.checked, true);
  marks.find(n => n.props.accessibilityLabel === '일 b 완료 표시').props.onPress();
  assert.deepEqual(ticked, ['b']);
  assert.ok(all.some(t => t.includes('동그라미')), 'the page says how to tick');
}));

test('guide: everything done says so; without onToggleDone the marks are inert and there is no tick hint', () => withReact(({host}) => {
  const combos = combosOf([mission('a', 1000)]);
  const finished = texts(host.render(() => api.ComboGuideScreen({combos, onClose() {}, onPressMission() {}, done: new Set(['a']), onToggleDone() {}})));
  assert.ok(finished.includes('모두 마쳤어요'));
  assert.equal(finished.includes('합계') || finished.includes('남은 합계'), false);
  const plain = host.render(() => api.ComboGuideScreen({combos, onClose() {}, onPressMission() {}}));
  assert.equal(texts(plain).some(t => t.includes('동그라미')), false);
  assert.equal(walk(plain).find(n => n.props?.accessibilityRole === 'checkbox').props.disabled, true);
  assert.ok(texts(plain).includes('합계'));
}));

test('guide: the same campaign in two bundles is one mark (same id)', () => withReact(({host}) => {
  const combos = api.normalizeTodayCombos({date: TODAY(), bundles: [
    {goal: 1000, missions: [mission('same', 1000)]}, {goal: 5000, missions: [mission('same', 2000), mission('other', 3000)]},
  ]});
  const done = new Set(['same']);
  const first = texts(host.render(() => api.ComboGuideScreen({combos, onClose() {}, onPressMission() {}, done})));
  assert.ok(first.includes('모두 마쳤어요'));
}));

// ---- the tap flow inside the entry ----
const mountChance = (host, extra = {}) => host.render(() => api.ComboEntry({placement: 'chance', load: async () => ({ok: true, combos: combosOf([mission('abc123def456', 1008, {name: '신한 SOL페이 앱'})])}), loadKey: 1, usn: 'a'.repeat(64), ...extra}));
const startChance = async (make, extra) => {
  const host = make();
  mountChance(host, extra); host.flush(); await tick();
  mountChance(host, extra); // data arrived
  host.flush();
  assert.equal(api.requestOpenCombos(), true);
  const tree = mountChance(host, extra);
  return {host, tree, again: () => mountChance(host, extra)};
};
const tapRow = tree => byLabel(tree, '1번 ', true).props.onPress();

test('tap: the key is found by name in the SDK list and that campaign opens; no toast, the guide stays', () => withReact(async ({make}) => {
  const calls = [];
  const bridge = {list: async () => [camp('352216486', '신한 SOL페이 앱', '1008')], open: async key => { calls.push(key); return true; }};
  const {tree, again} = await startChance(make, {campaigns: bridge, copyText: () => calls.push('copy')});
  tapRow(tree); await tick(10);
  assert.deepEqual(calls, ['352216486']);
  const after = again();
  assert.equal(hasType(after, 'Animated.View'), true, 'guide is still open for the next campaign');
  assert.equal(texts(after).some(t => t.includes('찾아 주세요')), false);
}));

test('tap: the list is read once and handed to reportCampaigns; a server id that is a key works too', () => withReact(async ({make}) => {
  let listed = 0; const reported = []; const opened = [];
  const bridge = {list: async () => { listed++; return [camp('abc123def456', '이름이 다름')]; }, open: async key => { opened.push(key); return true; }};
  const {tree} = await startChance(make, {campaigns: bridge, reportCampaigns: list => reported.push(list)});
  tapRow(tree); await tick(10); tapRow(tree); await tick(10);
  assert.equal(listed, 1);
  assert.equal(reported.length, 1);
  assert.deepEqual(reported[0], [camp('abc123def456', '이름이 다름')]);
  assert.deepEqual(opened, ['abc123def456', 'abc123def456'], 'name does not match, the row id is a key in the list');
}));

test('tap: nothing found or the SDK refuses -> name toast, copied when possible, the guide closes on the Chance tab', () => withReact(async ({make}) => {
  const copied = [];
  const refusing = {list: async () => [camp('1', '신한 SOL페이 앱')], open: async () => false};
  const {tree, again} = await startChance(make, {campaigns: refusing, copyText: text => { copied.push(text); return true; }});
  tapRow(tree); await tick(10);
  const after = again();
  assert.deepEqual(copied, ['신한 SOL페이 앱']);
  assert.ok(texts(after).includes('"신한 SOL페이 앱" 를 찾아 주세요 · 이름을 복사했어요'));
  assert.equal(hasType(after, 'Animated.View'), false, 'the wall below is revealed');
  const toast = walk(after).find(n => n.props?.pointerEvents === 'none');
  assert.equal(toast.props.style.top, 60, 'sits under the chip row');
}));

test('tap: without a bridge (old binary) there is no copy and the message does not claim one', () => withReact(async ({make}) => {
  const {tree, again} = await startChance(make, {});
  tapRow(tree); await tick(10);
  const after = again();
  assert.ok(texts(after).includes('"신한 SOL페이 앱" 를 찾아 주세요'));
  assert.equal(texts(after).some(t => t.includes('복사')), false);
}));

test('tap: a copy that fails or says false is not reported as copied; a throwing bridge falls back too', () => withReact(async ({make}) => {
  const broken = {list: async () => { throw new Error('x'); }, open: async () => { throw new Error('y'); }};
  for (const copyText of [() => false, async () => false, () => { throw new Error('z'); }]) {
    const {tree, again} = await startChance(make, {campaigns: broken, copyText});
    tapRow(tree); await tick(10);
    const after = again();
    assert.ok(texts(after).includes('"신한 SOL페이 앱" 를 찾아 주세요'));
    api.listenForComboRequests({priority: 0, open() {}})(); // drop leftovers
  }
}));

test('tap: onPressMission takes the tap over completely', () => withReact(async ({make}) => {
  const got = [];
  const {tree} = await startChance(make, {onPressMission: (m, b) => got.push([m.name, b.goal]), campaigns: {list: async () => { throw new Error('unused'); }, open: async () => { throw new Error('unused'); }}});
  tapRow(tree); await tick(10);
  assert.deepEqual(got, [['신한 SOL페이 앱', 1000]]);
}));

test('tap: a numeric server id is tried when the SDK list is empty or unavailable', () => withReact(async ({make}) => {
  const opened = [];
  const bridge = {list: async () => [], open: async key => { opened.push(key); return key === '352216486'; }};
  const host = make();
  const props = {campaigns: bridge};
  const load = async () => ({ok: true, combos: combosOf([mission('352216486', 1008, {name: '아무 이름'})])});
  const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load, loadKey: 1, usn: 'a'.repeat(64), ...props}));
  mount(); host.flush(); await tick(); mount(); host.flush();
  api.requestOpenCombos();
  tapRow(mount()); await tick(10);
  assert.deepEqual(opened, ['352216486']);
  const hashId = combosOf([mission('abc123def456', 1008)]); // a 12-hex hash id is never tried as a key
  assert.ok(hashId);
}));

// Records timers longer than 100 ms instead of running them (short ones, like the harness's tick, still run for real).
const fakeLongTimers = () => {
  const real = global.setTimeout;
  const captured = [];
  global.setTimeout = (fn, ms, ...rest) => {
    if (ms > 100) { captured.push([fn, ms]); return {}; }
    return real(fn, ms, ...rest);
  };
  return {captured, restore() { global.setTimeout = real; }};
};

test('tap: the toast goes away by itself', () => withReact(async ({make}) => {
  const {tree, again} = await startChance(make, {campaigns: {list: async () => [], open: async () => false}});
  const timers = fakeLongTimers();
  try {
    tapRow(tree);
    await tick(10);
    assert.ok(texts(again()).some(t => t.includes('찾아 주세요')));
    const hide = timers.captured.find(([, ms]) => ms === 4500);
    assert.ok(hide, 'a 4.5 second timer hides the toast');
    hide[0]();
    assert.equal(texts(again()).some(t => t.includes('찾아 주세요')), false);
  } finally { timers.restore(); }
}));

test('tap (Home): the fallback shows the name inside the full-screen guide, then opens the whole list', () => withReact(async ({make, opened}) => {
  const host = make();
  api.configureOfferwall({appKey: 'k', hashKey: 'h'});
  const load = async () => ({ok: true, combos: api.normalizeTodayCombos({date: TODAY(), display: {chance: 'chip', home: 'banner'}, bundles: [{goal: 1000, missions: [mission('abc123def456', 1008, {name: '신한 SOL페이 앱'})]}]})});
  const mount = () => host.render(() => api.ComboEntry({placement: 'home', load, loadKey: 1, usn: 'a'.repeat(64), campaigns: null, copyText: () => true}));
  mount(); host.flush(); await tick(); mount(); host.flush();
  byLabel(mount(), '쉽게 1만P 모으기, ', true).props.onPress();
  const tree = mount();
  assert.ok(hasType(tree, 'Modal'));
  const timers = fakeLongTimers();
  try {
    tapRow(tree);
    await tick(10);
    assert.ok(texts(mount()).includes('"신한 SOL페이 앱" 를 찾아 주세요 · 이름을 복사했어요'));
    const openWall = timers.captured.find(([, ms]) => ms === 700);
    assert.ok(openWall, 'waits 0.7s so the name can be read, then opens the list');
    assert.deepEqual(opened, [], 'not before that');
    openWall[0]();
    assert.deepEqual(opened, ['wall'], 'the whole list opens');
  } finally { timers.restore(); }
}));

test('entry: done marks survive through the entry per member and show as 남은 합계', () => withReact(async ({make}) => {
  const store = new Map();
  const storage = {getItem: async k => store.get(k) ?? null, setItem: async (k, v) => { store.set(k, v); }};
  const load = async () => ({ok: true, combos: combosOf([mission('a', 600, {name: '첫째'}), mission('b', 400, {name: '둘째'})])});
  const host = make();
  const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load, loadKey: 77, storage, campaigns: null}));
  mount(); host.flush(); await tick(); mount(); host.flush(); await tick();
  api.requestOpenCombos();
  let tree = mount();
  walk(tree).find(n => n.props?.accessibilityLabel === '첫째 완료 표시').props.onPress();
  tree = mount();
  assert.ok(texts(tree).includes('남은 합계') && texts(tree).includes('400P'));
  await tick();
  assert.equal(JSON.parse(store.get('jcurve.combos.done:77')).ids[0], 'a');
}));
