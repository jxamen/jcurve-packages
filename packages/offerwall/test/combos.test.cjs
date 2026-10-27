const {test} = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const api = require('../dist');
const NOON_KST = Date.UTC(2026, 9, 27, 3, 0, 0); // 2026-10-27 12:00 KST
const TODAY = '2026-10-27';

const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const raw = (over = {}) => ({date: TODAY, bundles: [{goal: 1000, missions: [mission('a', 600), mission('b', 450)]}], ...over});

test('name is one constant', () => {
  assert.equal(api.COMBO_NAME, '포인트 빨리 모으기');
});

test('normalize: keeps good rows, recomputes totals, sorts, fills display defaults', () => {
  const out = api.normalizeTodayCombos({date: TODAY, bundles: [
    {goal: 5000, total: 1, missions: [mission('x', 3000), mission('y', '2500')]},
    {goal: 1000, missions: [mission('a', 600), mission('b', 450), {id: 'a', name: '중복', points: 9}, {id: 'c', name: '', points: 5}, {id: 'd', name: '점수 없음', points: 0}, null, 'x']},
  ]});
  assert.deepEqual(out.bundles.map(b => [b.goal, b.total, b.missions.length]), [[1000, 1050, 2], [5000, 5500, 2]]);
  assert.deepEqual(out.display, {chance: 'chip', home: 'off'});
  assert.equal(out.date, TODAY);
});

test('normalize: a bundle that cannot reach its goal is dropped, junk gives null, at most 4 bundles', () => {
  const out = api.normalizeTodayCombos(raw({bundles: [{goal: 1000, missions: [mission('a', 400)]}, {goal: 5000, missions: [mission('b', 5000)]}]}));
  assert.deepEqual(out.bundles.map(b => b.goal), [5000]);
  for (const bad of [null, undefined, 'x', 3, [], {}, {bundles: 'x'}, {bundles: [{goal: 1000, missions: []}]}, {bundles: [{goal: 0, missions: [mission('a', 5)]}]}]) {
    assert.equal(api.normalizeTodayCombos(bad), null);
  }
  const many = api.normalizeTodayCombos(raw({bundles: [1, 2, 3, 4, 5, 6].map(n => ({goal: n * 100, missions: [mission(`m${n}`, n * 100)]}))}));
  assert.deepEqual(many.bundles.map(b => b.goal), [100, 200, 300, 400]);
  // The live server sent alternatives (several bundles per goal): keep the first valid one per goal, not the first four entries.
  const alt = (goal, tag, points = goal) => ({goal, missions: [mission(`${tag}`, points)]});
  const live = api.normalizeTodayCombos(raw({bundles: [
    alt(1000, 'a1'), alt(1000, 'a2'), alt(1000, 'a3'), alt(1000, 'a4'), alt(5000, 'b1'), alt(5000, 'b2'), alt(10000, 'c1'), alt(10000, 'c2'),
  ]}));
  assert.deepEqual(live.bundles.map(b => [b.goal, b.missions[0].id]), [[1000, 'a1'], [5000, 'b1'], [10000, 'c1']]);
  // A broken first entry for a goal does not hide the next valid one; missions are collected past invalid rows up to 12.
  const skip = api.normalizeTodayCombos(raw({bundles: [alt(1000, 'short', 10), alt(1000, 'good')]}));
  assert.deepEqual(skip.bundles.map(b => b.missions[0].id), ['good']);
  const rows = api.normalizeTodayCombos(raw({bundles: [{goal: 1000, missions: [...Array.from({length: 20}, () => null), ...Array.from({length: 20}, (_, i) => mission(`r${i}`, 100))]}]}));
  assert.equal(rows.bundles[0].missions.length, 12);
});

test('normalize: clamps text, level, minutes, display and hostile numbers', () => {
  const out = api.normalizeTodayCombos(raw({
    display: {chance: 'off', home: 'banner'},
    bundles: [{goal: 1000, missions: [{id: 7, name: `${'가'.repeat(60)}\n줄`, points: 1000, todo: 'a\u0000b', level: 'weird', minutes: 999}]}],
  }));
  const m = out.bundles[0].missions[0];
  assert.equal(m.id, '7');
  assert.equal(m.name.length, 40);
  assert.equal(m.todo, 'a b');
  assert.equal(m.level, 'normal');
  assert.equal('minutes' in m, false);
  assert.deepEqual(out.display, {chance: 'off', home: 'banner'});
  assert.deepEqual(api.normalizeTodayCombos(raw({display: {chance: 'x', home: 'card'}})).display, {chance: 'chip', home: 'off'});
  assert.deepEqual(api.normalizeTodayCombos(raw({display: {chance: 'card', home: 'off'}})).display, {chance: 'chip', home: 'off'});
  const huge = {goal: 1000, missions: [mission('a', Number.MAX_SAFE_INTEGER), mission('b', Number.MAX_SAFE_INTEGER), mission('c', 1e15), mission('d', 10_000_001)]};
  assert.equal(api.normalizeTodayCombos(raw({bundles: [huge]})), null);
  const edge = api.normalizeTodayCombos(raw({bundles: [{goal: 1000, missions: [mission('a', 10_000_000)]}]}));
  assert.equal(edge.bundles[0].total, 10_000_000);
});

test('Korean calendar day flips at 00:00 KST; yesterday and a missing date are not "today"', () => {
  assert.equal(api.kstDate(Date.UTC(2026, 9, 26, 14, 59, 59)), '2026-10-26');
  assert.equal(api.kstDate(Date.UTC(2026, 9, 26, 15, 0, 0)), '2026-10-27');
  const combos = api.normalizeTodayCombos(raw());
  assert.equal(api.isTodayCombos(combos, NOON_KST), true);
  assert.equal(api.isTodayCombos(combos, NOON_KST + 24 * 3600 * 1000), false);
  assert.equal(api.isTodayCombos({...combos, date: undefined}, NOON_KST), false);
  assert.equal(api.msUntilKstMidnight(NOON_KST), 12 * 3600 * 1000);
  assert.equal(api.msUntilKstMidnight(Date.UTC(2026, 9, 26, 15, 0, 0)), 24 * 3600 * 1000);
});

test('point and goal labels', () => {
  assert.equal(api.formatPoints(1050), '1,050P');
  assert.equal(api.formatPoints(12345678), '12,345,678P');
  assert.deepEqual([1000, 5000, 10000, 20000, 1500, 500].map(api.formatGoal), ['1천P', '5천P', '1만P', '2만P', '1,500P', '500P']);
});

test('route matcher accepts in-app and scheme forms of offerwall/combos and the popup action "combos"', () => {
  for (const ok of ['offerwall/combos', '/offerwall/combos', ' offerwall/combos/ ', 'offerwall/combos?from=push', 'myapp://offerwall/combos#x', 'kr.co.app://offerwall/combos', 'combos', ' combos ']) assert.equal(api.isCombosRoute(ok), true, ok);
  for (const no of ['offerwall', 'offerwall/combos2', 'offerwall/combo', 'combo', 'combos2', 'chance', 'https://x.kr/offerwall/combos', '', null, undefined, 5, {}]) assert.equal(api.isCombosRoute(no), false, String(no));
  assert.equal(api.COMBOS_ROUTE, 'offerwall/combos');
  assert.equal(api.COMBOS_POPUP_ACTION, 'combos');
});

test('fetch: unwraps combos / data / bare bodies and rejects failures, stale days and dateless bodies', async () => {
  const reply = body => ({fetcher: async () => ({ok: true, json: async () => body}), now: NOON_KST});
  const good = raw();
  for (const body of [good, {ok: true, combos: good}, {ok: true, data: good}]) {
    const r = await api.fetchTodayCombos({url: 'u', ...reply(body)});
    assert.equal(r.ok, true);
    assert.equal(r.combos.bundles[0].total, 1050);
  }
  assert.deepEqual(await api.fetchTodayCombos({url: 'u', ...reply({ok: false, combos: good})}), {ok: false, reason: 'bad_response'});
  assert.deepEqual(await api.fetchTodayCombos({url: 'u', ...reply({ok: true})}), {ok: false, reason: 'bad_response'});
  assert.deepEqual(await api.fetchTodayCombos({url: 'u', ...reply(raw({date: '2026-10-26'}))}), {ok: false, reason: 'stale'});
  const {date, ...dateless} = good;
  assert.deepEqual(await api.fetchTodayCombos({url: 'u', ...reply(dateless)}), {ok: false, reason: 'stale'});
  assert.deepEqual(await api.fetchTodayCombos({url: 'u', fetcher: async () => ({ok: false, json: async () => ({})}), now: NOON_KST}), {ok: false, reason: 'bad_response'});
  assert.deepEqual(await api.fetchTodayCombos({url: 'u', fetcher: async () => { throw new Error('offline'); }}), {ok: false, reason: 'network'});
  let seen;
  await api.fetchTodayCombos({url: 'https://x/c', headers: {'X-App-Token': 't'}, now: NOON_KST, fetcher: async (u, init) => { seen = [u, init.headers, init.cache]; return {ok: true, json: async () => good}; }});
  assert.deepEqual(seen, ['https://x/c', {'X-App-Token': 't'}, 'no-store']);
});

test('load: the app\'s own request function is used; throws, timeouts, bad and stale bodies are failures', async () => {
  const good = raw();
  assert.equal(api.parseCombosBody(good, NOON_KST).ok, true);
  assert.deepEqual(api.parseCombosBody(null), {ok: false, reason: 'bad_response'});
  assert.deepEqual(api.parseCombosBody({ok: false}), {ok: false, reason: 'bad_response'});
  assert.deepEqual(api.parseCombosBody(raw({date: '2026-10-26'}), NOON_KST), {ok: false, reason: 'stale'});
  assert.equal((await api.loadTodayCombos({load: async () => ({ok: true, combos: good}), now: NOON_KST})).ok, true);
  assert.deepEqual(await api.loadTodayCombos({load: async () => { throw new Error('401'); }}), {ok: false, reason: 'network'});
  assert.deepEqual(await api.loadTodayCombos({load: () => new Promise(() => {}), timeoutMs: 20}), {ok: false, reason: 'network'});
  assert.deepEqual(await api.loadTodayCombos({load: async () => ({ok: true}), now: NOON_KST}), {ok: false, reason: 'bad_response'});
});

test('open requests: wait for the first listener, expire after 10s, Chance tab beats Home, one screen only', () => {
  const log = [];
  assert.equal(api.requestOpenCombos(1000), false);
  const offHome = api.listenForComboRequests({priority: 1, open: () => log.push('home')}, 5000);
  assert.deepEqual(log, ['home']);
  offHome();
  assert.equal(api.requestOpenCombos(20000), false);
  const offLate = api.listenForComboRequests({priority: 1, open: () => log.push('late')}, 20000 + 10001);
  assert.deepEqual(log, ['home']);
  offLate();
  const offA = api.listenForComboRequests({priority: 1, open: () => log.push('home2')});
  const offB = api.listenForComboRequests({priority: 2, open: () => log.push('chance')});
  assert.equal(api.requestOpenCombos(), true);
  assert.deepEqual(log, ['home', 'chance']);
  offB();
  assert.equal(api.requestOpenCombos(), true);
  assert.deepEqual(log, ['home', 'chance', 'home2']);
  offA();
  assert.equal(api.requestOpenCombos(), false);
  api.listenForComboRequests({priority: 1, open() {}}, Date.now() + 20000)(); // clear any waiting request
});

test('open requests: equal priority goes to the most recently mounted listener', () => {
  const log = [];
  const off1 = api.listenForComboRequests({priority: 2, open: () => log.push('old')});
  const off2 = api.listenForComboRequests({priority: 2, open: () => log.push('new')});
  api.requestOpenCombos();
  off2();
  api.requestOpenCombos();
  off1();
  assert.deepEqual(log, ['new', 'old']);
});

test('theme: the app token family maps onto the look, missing keys fall back', () => {
  const t = api.comboThemeFromTokens({
    C: {bg: '#111111', card: '#222222', tree: '#AAAAAA', treeDark: '#BBBBBB', treeSoft: '#CCCCCC', point: '#DDDDDD', text: '#EEEEEE'},
    R: {card: 30, chip: 99}, F: {body: 18, title: 24}, shadow: {elevation: 9},
  });
  assert.deepEqual([t.bg, t.card, t.accent, t.accentText, t.accentSoft, t.point, t.text], ['#111111', '#222222', '#AAAAAA', '#BBBBBB', '#CCCCCC', '#DDDDDD', '#EEEEEE']);
  assert.equal(t.sub, api.DEFAULT_COMBO_THEME.sub);
  assert.deepEqual([t.radius.card, t.radius.chip, t.radius.slot], [30, 99, api.DEFAULT_COMBO_THEME.radius.slot]);
  assert.deepEqual([t.font.body, t.font.title, t.font.small], [18, 24, api.DEFAULT_COMBO_THEME.font.small]);
  assert.deepEqual(t.shadow, {elevation: 9});
  assert.deepEqual(api.comboThemeFromTokens({}), api.DEFAULT_COMBO_THEME);
});

// ---- UI: render with a tiny React, check the produced tree (shared stand-ins live in harness.cjs) ----
const {withReact, texts, walk, byLabel, hasType, tick, findSheet, hasSheet} = require('./harness.cjs');

const THREE = () => api.normalizeTodayCombos(raw({bundles: [
  {goal: 1000, missions: [mission('a', 600, {minutes: 2}), mission('b', 450, {level: 'hard'})]},
  {goal: 5000, missions: [mission('c', 5200)]},
  {goal: 10000, missions: [mission('d', 10000)]},
]}));

test('guide: path of steps, shows the chosen bundle with big goal + sum, rows report the item', () => withReact(({host}) => {
  const combos = THREE();
  const picked = [];
  const props = {combos, onClose() {}, onPressMission: (m, b) => picked.push([m.id, b.goal])};
  let tree = host.render(() => api.ComboGuideScreen(props));
  const all = texts(tree);
  for (const want of ['포인트 빨리 모으기', '1천P', '5천P', '1만P', '합계', '1,050P', '일 a', '+600P']) assert.ok(all.includes(want), want);
  for (const gone of ['1천 → 5천 → 1만P 차례로 모아요', '1,000P 모으기', '쉬움 · 약 2분', '조금 걸려요', '하러 가기 ›']) assert.equal(all.includes(gone), false, `${gone} is not on the page any more`);
  assert.equal(byLabel(tree, '1단계 1천P').props.accessibilityState.selected, true);
  assert.match(byLabel(tree, '1번 일 a', true).props.accessibilityLabel, /하러 가기/);
  assert.equal(all.includes('5,000P 모으기'), false, 'only the chosen step is listed');
  assert.equal(all.some(t => /오퍼월|캠페인|SDK|찬스/.test(t)), false, 'no in-app jargon on the page');
  assert.equal(all.some(t => t.includes('쌓여요')), false, 'no promise wording');
  assert.ok(all.some(t => t.includes('합계는 표시된 항목을 모두 마쳤을 때 기준')));
  byLabel(tree, '2번 일 b', true).props.onPress();
  assert.deepEqual(picked, [['b', 1000]]);
  assert.equal(all.includes(api.COMBO_LIST_HINT), false, 'no list hint when a tap opens the item itself');
  byLabel(tree, '2단계 5천P').props.onPress();
  tree = host.render(() => api.ComboGuideScreen(props));
  const second = texts(tree);
  assert.ok(second.includes('5,200P') && second.includes('+5,200P'));
  assert.equal(byLabel(tree, '2단계 5천P').props.accessibilityState.selected, true);
  assert.equal(second.includes('1,050P'), false, 'the first step is not listed any more');
}));

test('guide: sheet variant has the name and a 닫기 button, page variant a back arrow', () => withReact(({host}) => {
  const combos = THREE();
  let closed = 0;
  const sheet = host.render(() => api.ComboGuideScreen({combos, onClose: () => closed++, variant: 'sheet', usn: 'a'.repeat(64)}));
  assert.ok(texts(sheet).includes('닫기') && texts(sheet).includes('포인트 빨리 모으기'));
  byLabel(sheet, '닫기').props.onPress();
  assert.equal(closed, 1);
  const page = host.render(() => api.ComboGuideScreen({combos, onClose: () => closed++, usn: 'a'.repeat(64)}));
  assert.ok(texts(page).includes('‹') && !texts(page).includes('닫기'));
}));

test('guide: loading and empty messages, no rows', () => withReact(({host}) => {
  assert.ok(texts(host.render(() => api.ComboGuideScreen({combos: null, loading: true, onClose() {}}))).includes('불러오고 있어요'));
  const empty = texts(host.render(() => api.ComboGuideScreen({combos: null, onClose() {}})));
  assert.ok(empty.some(t => t.includes('준비하고 있어요')));
  assert.equal(empty.some(t => t.includes('모으기') && t !== '포인트 빨리 모으기'), false);
}));

test('guide: without a callback, usn opens the whole list (with a hint); no usn makes rows inert', () => withReact(({host, opened}) => {
  const combos = api.normalizeTodayCombos(raw());
  api.configureOfferwall({appKey: 'k', hashKey: 'h'});
  const usn = 'a'.repeat(64);
  const withUsn = host.render(() => api.ComboGuideScreen({combos, onClose() {}, usn}));
  const row = byLabel(withUsn, '1번 일 a', true);
  assert.equal(row.props.disabled, false);
  assert.ok(texts(withUsn).includes(api.COMBO_LIST_HINT));
  assert.ok(row.props.accessibilityLabel.endsWith('하러 가기'));
  row.props.onPress();
  assert.deepEqual(opened, ['wall']);
  const noUsn = host.render(() => api.ComboGuideScreen({combos, onClose() {}}));
  assert.equal(byLabel(noUsn, '1번 일 a', true).props.disabled, true);
  assert.equal(texts(noUsn).includes('하러 가기 ›'), false);
}));

test('hook: nothing without url unless sample; sample is ready; url loads; stale and failed stay empty', () => withReact(async ({make}) => {
  const off = make();
  assert.deepEqual([off.render(() => api.useTodayCombos({})).status, off.render(() => api.useTodayCombos({})).combos], ['empty', null]);
  const sample = make();
  const s = sample.render(() => api.useTodayCombos({sample: true}));
  assert.equal(s.status, 'ready');
  assert.equal(s.combos.bundles.length, 3);
  for (const b of s.combos.bundles) assert.ok(b.total >= b.goal);

  const realFetch = global.fetch;
  try {
    const good = raw({date: api.kstDate()});
    global.fetch = async () => ({ok: true, json: async () => ({ok: true, combos: good})});
    const live = make();
    assert.equal(live.render(() => api.useTodayCombos({url: 'u'})).status, 'loading');
    live.flush();
    await new Promise(r => setTimeout(r, 5));
    const done = live.render(() => api.useTodayCombos({url: 'u'}));
    assert.equal(done.status, 'ready');
    assert.equal(done.combos.bundles[0].total, 1050);

    global.fetch = async () => ({ok: true, json: async () => ({ok: true, combos: raw({date: '2000-01-01'})})});
    const stale = make();
    stale.render(() => api.useTodayCombos({url: 'u'})); stale.flush();
    await new Promise(r => setTimeout(r, 5));
    assert.equal(stale.render(() => api.useTodayCombos({url: 'u'})).status, 'empty');

    global.fetch = async () => ({ok: true, json: async () => ({ok: true, combos: (({date, ...rest}) => rest)(good)})});
    const dateless = make();
    dateless.render(() => api.useTodayCombos({url: 'u'})); dateless.flush();
    await new Promise(r => setTimeout(r, 5));
    assert.equal(dateless.render(() => api.useTodayCombos({url: 'u'})).status, 'empty');
  } finally { global.fetch = realFetch; }
}));

test('hook: a new url or member never shows the previous rows, and midnight re-fetches', () => withReact(async ({make}) => {
  const realFetch = global.fetch, realTimeout = global.setTimeout;
  const timers = [];
  let calls = 0;
  try {
    global.fetch = async () => { calls++; return {ok: true, json: async () => ({ok: true, combos: raw({date: api.kstDate()})})}; };
    global.setTimeout = (fn, ms) => { timers.push([fn, ms]); return timers.length; };
    const live = make();
    const props = {url: 'u', headers: {a: '1'}};
    live.render(() => api.useTodayCombos(props)); live.flush();
    await new Promise(r => realTimeout(r, 5));
    assert.equal(live.render(() => api.useTodayCombos(props)).status, 'ready');
    // another member (different headers): the old rows disappear at once, before any new response
    const next = live.render(() => api.useTodayCombos({url: 'u', headers: {a: '2'}}));
    assert.deepEqual([next.status, next.combos], ['loading', null]);
    // midnight timer: one armed for the next Korean midnight (+5s), firing it fetches again
    const midnight = timers.slice().sort((a, b) => b[1] - a[1])[0]; // the fetch timeout is 8s; midnight is the long one
    assert.ok(midnight && midnight[1] > 8000 && midnight[1] <= 24 * 3600 * 1000 + 5000, 'a midnight timer is armed');
    assert.ok(Math.abs(midnight[1] - (api.msUntilKstMidnight() + 5000)) < 3000);
    const before = calls;
    midnight[0]();
    live.render(() => api.useTodayCombos(props)); live.flush();
    assert.ok(calls > before, 'fetched again after the timer fired');
  } finally { global.fetch = realFetch; global.setTimeout = realTimeout; }
}));

test('hook (load): uses the latest load function; a different loadKey drops the previous member at once', () => withReact(async ({make}) => {
  const today = api.kstDate();
  const calls = [];
  const loaderFor = who => async () => { calls.push(who); return {ok: true, combos: raw({date: today})}; };
  const live = make();
  const read = (who, key) => live.render(() => api.useTodayCombos({load: loaderFor(who), loadKey: key}));
  assert.equal(read('m1', 1).status, 'loading');
  live.flush();
  await new Promise(r => setTimeout(r, 5));
  assert.equal(read('m1', 1).status, 'ready');
  assert.deepEqual(calls, ['m1']);
  const next = read('m2', 2); // another member signs in on the same mounted tab
  assert.deepEqual([next.status, next.combos], ['loading', null]);
  live.flush();
  await new Promise(r => setTimeout(r, 5));
  assert.deepEqual(calls, ['m1', 'm2']);
  assert.equal(read('m2', 2).status, 'ready');
  const rerender = read('m3-same-key', 2); // a new function identity alone does not refetch
  live.flush();
  assert.equal(rerender.status, 'ready');
  assert.deepEqual(calls, ['m1', 'm2']);
  const failing = make();
  failing.render(() => api.useTodayCombos({load: async () => { throw new Error('x'); }, loadKey: 1})); failing.flush();
  await new Promise(r => setTimeout(r, 5));
  assert.equal(failing.render(() => api.useTodayCombos({load: async () => { throw new Error('x'); }, loadKey: 1})).status, 'empty');
}));

test('entry (Chance tab): chip over the header row, sheet rises over the wall, chip toggles, no Modal, no card', () => withReact(({make}) => {
  const chance = make();
  const mount = (extra = {}) => chance.render(() => api.ComboEntry({placement: 'chance', sample: true, ...extra}));
  let tree = mount();
  const chipBox = walk(tree).find(n => n.type === 'View' && n.props.pointerEvents === 'box-none');
  assert.deepEqual([chipBox.props.style.position, chipBox.props.style.top, chipBox.props.style.right], ['absolute', 6, 52]);
  assert.equal('backgroundColor' in chipBox.props.style || 'padding' in chipBox.props.style, false, 'no band or padding around the chip');
  assert.ok(texts(tree).includes('포인트 빨리 모으기') && texts(tree).includes('›'));
  assert.equal(hasType(tree, 'Modal') || hasSheet(tree), false);
  assert.equal(walk(tree).some(n => n.props?.accessibilityLabel?.startsWith('오늘의 포인트 조합')), false, 'no card above the wall');
  assert.deepEqual([mount({chipTop: 20, chipRight: 70})].map(t => walk(t).find(n => n.props.pointerEvents === 'box-none').props.style).map(s => [s.top, s.right])[0], [20, 70]);
  chance.flush();

  assert.equal(api.requestOpenCombos(), true); // popup / push / link
  tree = mount();
  assert.ok(hasSheet(tree), 'sheet is in the tree, over the wall');
  assert.equal(hasType(tree, 'Modal'), false);
  assert.equal(findSheet(tree).props.style.top, 52);
  assert.ok(texts(tree).includes('쉽게 모으기') && texts(tree).includes('✕') && texts(tree).includes('닫기'), 'the sample has an easy list: it opens first');
  const chip = byLabel(tree, '포인트 빨리 모으기');
  assert.equal(chip.props.accessibilityState.expanded, true);
  chip.props.onPress(); // tapping the chip again closes
  tree = mount();
  assert.equal(hasSheet(tree), false);
  assert.ok(texts(tree).includes('›'));

  byLabel(tree, '포인트 빨리 모으기').props.onPress(); // open by the chip itself
  tree = mount();
  assert.ok(hasSheet(tree));
  const closers = walk(tree).filter(n => n.type === 'Pressable' && n.props.accessibilityLabel === '닫기'); // backdrop and the 닫기 button
  assert.equal(closers.length, 2);
  closers[0].props.onPress();
  tree = mount();
  assert.equal(hasSheet(tree), false);
}));

test('entry (Chance tab): server off hides the chip but popups still open the sheet; nothing without data', () => withReact(async ({make}) => {
  const realFetch = global.fetch;
  try {
    global.fetch = async () => ({ok: true, json: async () => ({ok: true, combos: raw({date: api.kstDate(), display: {chance: 'off', home: 'off'}})})});
    const chance = make();
    const mount = () => chance.render(() => api.ComboEntry({placement: 'chance', url: 'u'}));
    mount(); chance.flush();
    await new Promise(r => setTimeout(r, 5));
    let tree = mount();
    assert.equal(tree, null, 'nothing visible while off');
    assert.equal(api.requestOpenCombos(), true);
    tree = mount();
    assert.ok(hasSheet(tree));
    assert.equal(walk(tree).some(n => n.props?.pointerEvents === 'box-none'), false, 'no chip while off');
    const home = make();
    assert.equal(home.render(() => api.ComboEntry({placement: 'home', url: 'u'})), null);
    const none = make();
    assert.equal(none.render(() => api.ComboEntry({placement: 'chance'})), null, 'no url, no sample: nothing');
  } finally { global.fetch = realFetch; }
}));

test('entry (Home): banner only when the server turns it on; it opens the guide as a full screen', () => withReact(({make}) => {
  const home = make();
  const mount = () => home.render(() => api.ComboEntry({placement: 'home', sample: true}));
  let tree = mount();
  assert.ok(byLabel(tree, '포인트 빨리 모으기, ', true), 'sample turns the Home banner on');
  assert.ok(texts(tree).includes('보기 ›') && texts(tree).includes('1천P') && texts(tree).includes('1만P'));
  assert.equal(hasType(tree, 'Modal'), false);
  home.flush();
  byLabel(tree, '포인트 빨리 모으기, ', true).props.onPress();
  tree = mount();
  assert.ok(hasType(tree, 'Modal'));
  assert.ok(texts(tree).includes('‹'), 'page variant with a back arrow');
  walk(tree).find(n => n.type === 'Modal').props.onRequestClose();
  assert.equal(hasType(mount(), 'Modal'), false);
}));

test('entry: a popup request while only Home is mounted opens Home; the Chance tab wins when both are mounted', () => withReact(({make}) => {
  const home = make(), chance = make();
  const mountHome = () => home.render(() => api.ComboEntry({placement: 'home', sample: true}));
  const mountChance = () => chance.render(() => api.ComboEntry({placement: 'chance', sample: true}));
  mountHome(); home.flush();
  assert.equal(api.requestOpenCombos(), true);
  assert.equal(hasType(mountHome(), 'Modal'), true);
  walk(mountHome()).find(n => n.type === 'Modal').props.onRequestClose();
  mountChance(); chance.flush();
  assert.equal(api.requestOpenCombos(), true);
  assert.equal(hasSheet(mountChance()), true);
  assert.equal(hasType(mountHome(), 'Modal'), false);
}));
