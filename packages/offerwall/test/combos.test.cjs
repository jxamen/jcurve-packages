const {test} = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const api = require('../dist');
const NOON_KST = Date.UTC(2026, 9, 27, 3, 0, 0); // 2026-10-27 12:00 KST

const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const raw = (over = {}) => ({date: '2026-10-27', bundles: [{goal: 1000, missions: [mission('a', 600), mission('b', 450)]}], ...over});

test('normalize: keeps good rows, recomputes totals, sorts, fills display defaults', () => {
  const out = api.normalizeTodayCombos({date: '2026-10-27', bundles: [
    {goal: 5000, total: 1, missions: [mission('x', 3000), mission('y', '2500')]},
    {goal: 1000, missions: [mission('a', 600), mission('b', 450), {id: 'a', name: '중복', points: 9}, {id: 'c', name: '', points: 5}, {id: 'd', name: '점수 없음', points: 0}, null, 'x']},
  ]});
  assert.deepEqual(out.bundles.map(b => [b.goal, b.total, b.missions.length]), [[1000, 1050, 2], [5000, 5500, 2]]);
  assert.deepEqual(out.display, {chance: 'card', home: 'off'});
  assert.equal(out.date, '2026-10-27');
});

test('normalize: a bundle that cannot reach its goal is dropped, junk gives null', () => {
  const out = api.normalizeTodayCombos(raw({bundles: [{goal: 1000, missions: [mission('a', 400)]}, {goal: 5000, missions: [mission('b', 5000)]}]}));
  assert.deepEqual(out.bundles.map(b => b.goal), [5000]);
  for (const bad of [null, undefined, 'x', 3, [], {}, {bundles: 'x'}, {bundles: [{goal: 1000, missions: []}]}, {bundles: [{goal: 0, missions: [mission('a', 5)]}]}]) {
    assert.equal(api.normalizeTodayCombos(bad), null);
  }
});

test('normalize: clamps text, level, minutes and display values from the server', () => {
  const out = api.normalizeTodayCombos(raw({
    display: {chance: 'banner', home: 'banner'},
    bundles: [{goal: 1000, missions: [{id: 7, name: `${'가'.repeat(60)}\n줄`, points: 1000, todo: 'a\u0000b', level: 'weird', minutes: 999}]}],
  }));
  const m = out.bundles[0].missions[0];
  assert.equal(m.id, '7');
  assert.equal(m.name.length, 40);
  assert.equal(m.todo, 'a b');
  assert.equal(m.level, 'normal');
  assert.equal('minutes' in m, false);
  assert.deepEqual(out.display, {chance: 'banner', home: 'banner'});
  assert.deepEqual(api.normalizeTodayCombos(raw({display: {chance: 'x', home: 'card'}})).display, {chance: 'card', home: 'off'});
});

test('Korean calendar day flips at 00:00 KST and yesterday is not "today"', () => {
  assert.equal(api.kstDate(Date.UTC(2026, 9, 26, 14, 59, 59)), '2026-10-26');
  assert.equal(api.kstDate(Date.UTC(2026, 9, 26, 15, 0, 0)), '2026-10-27');
  const combos = api.normalizeTodayCombos(raw());
  assert.equal(api.isTodayCombos(combos, NOON_KST), true);
  assert.equal(api.isTodayCombos(combos, NOON_KST + 24 * 3600 * 1000), false);
  assert.equal(api.isTodayCombos({...combos, date: undefined}, NOON_KST + 99 * 3600 * 1000), true);
});

test('point and goal labels', () => {
  assert.equal(api.formatPoints(1050), '1,050P');
  assert.equal(api.formatPoints(12345678), '12,345,678P');
  assert.deepEqual([1000, 5000, 10000, 20000, 1500, 500].map(api.formatGoal), ['1천P', '5천P', '1만P', '2만P', '1,500P', '500P']);
});

test('route matcher accepts in-app and scheme forms only for offerwall/combos', () => {
  for (const ok of ['offerwall/combos', '/offerwall/combos', ' offerwall/combos/ ', 'offerwall/combos?from=push', 'myapp://offerwall/combos#x', 'kr.co.app://offerwall/combos']) assert.equal(api.isCombosRoute(ok), true, ok);
  for (const no of ['offerwall', 'offerwall/combos2', 'offerwall/combo', 'chance', 'https://x.kr/offerwall/combos', '', null, undefined, 5, {}]) assert.equal(api.isCombosRoute(no), false, String(no));
  assert.equal(api.COMBOS_ROUTE, 'offerwall/combos');
});

test('fetch: unwraps combos / data / bare bodies and rejects failures and stale days', async () => {
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
  assert.deepEqual(await api.fetchTodayCombos({url: 'u', fetcher: async () => ({ok: false, json: async () => ({})})}), {ok: false, reason: 'bad_response'});
  assert.deepEqual(await api.fetchTodayCombos({url: 'u', fetcher: async () => { throw new Error('offline'); }}), {ok: false, reason: 'network'});
  let seen;
  await api.fetchTodayCombos({url: 'https://x/c', headers: {'X-App-Token': 't'}, fetcher: async (u, init) => { seen = [u, init.headers, init.cache]; return {ok: true, json: async () => good}; }});
  assert.deepEqual(seen, ['https://x/c', {'X-App-Token': 't'}, 'no-store']);
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

// ---- UI: render with a tiny React, check the produced tree ----
function withReact(run) {
  const original = Module._load;
  const opened = [];
  const rn = {
    Platform: {OS: 'android'},
    NativeModules: {RNAdPopcornRewardModule: {}},
    UIManager: {getViewManagerConfig: () => ({})},
    requireNativeComponent: () => 'NativeWall',
    BackHandler: {addEventListener: () => ({remove() {}})},
    View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal', SafeAreaView: 'SafeAreaView',
  };
  const native = {setUserId() {}, setStyle() {}, openOfferwall: () => opened.push('wall'), addListener: () => ({remove() {}})};
  let current;
  const react = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity)}),
    useRef: v => { const i = current.cursor++; return current.slots[i] ??= {current: v}; },
    useState: init => {
      const h = current, i = h.cursor++;
      if (!(i in h.slots)) h.slots[i] = typeof init === 'function' ? init() : init;
      return [h.slots[i], v => { h.slots[i] = typeof v === 'function' ? v(h.slots[i]) : v; }];
    },
    useEffect: (cb, deps) => {
      const h = current, i = h.cursor++, prev = h.slots[i];
      if (!prev || !deps || deps.some((d, j) => d !== prev.deps[j])) { prev?.cleanup?.(); h.slots[i] = {deps, cleanup: undefined, run: cb}; h.pending.push(h.slots[i]); }
    },
  };
  Module._load = function (id, ...rest) {
    if (id === 'react') return react;
    if (id === 'react-native') return rn;
    if (id === 'react-native-adpopcorn-reward') return {default: native};
    return original.call(this, id, ...rest);
  };
  const made = [];
  const make = () => {
    const h = {
      slots: [], cursor: 0, pending: [],
      render(fn) { current = this; this.cursor = 0; return fn(); },
      flush() { for (const e of this.pending.splice(0)) e.cleanup = e.run(); },
    };
    made.push(h);
    return h;
  };
  // Unmount everything so one test's listeners never answer the next test's requests.
  const dispose = () => { for (const h of made) for (const s of h.slots) if (typeof s?.cleanup === 'function') s.cleanup(); };
  return Promise.resolve(run({host: make(), make, opened, rn})).finally(() => { dispose(); Module._load = original; });
}
const texts = node => node == null || typeof node === 'boolean' ? [] : typeof node === 'string' ? [node] : [...(node.children || [])].flatMap(texts);
const walk = (node, out = []) => { if (node && typeof node === 'object') { out.push(node); (node.children || []).forEach(c => walk(c, out)); } return out; };
const expand = node => { // resolve function components one level at a time
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expand(node.type({...node.props, children: node.children}));
  return {...node, children: (node.children || []).map(expand)};
};

test('screen: shows each goal with its rows and the sum, and taps report the item', () => withReact(({host}) => {
  const combos = api.normalizeTodayCombos(raw({bundles: [
    {goal: 1000, missions: [mission('a', 600, {minutes: 2}), mission('b', 450, {level: 'hard'})]},
    {goal: 5000, missions: [mission('c', 5200)]},
  ]}));
  const picked = [];
  const tree = host.render(() => expand(api.TodayComboScreen({combos, onClose() {}, onPressMission: (m, b) => picked.push([m.id, b.goal])})));
  const all = texts(tree);
  for (const want of ['1천P 채우기', '5천P 채우기', '일 a', '+600P', '쉬움', '약 2분', '조금 걸려요', '1,050P', '5,200P']) assert.ok(all.includes(want), want);
  assert.equal(all.some(t => /오퍼월|캠페인|SDK|찬스/.test(t)), false, 'no in-app jargon on the page');
  const rows = walk(tree).filter(n => n.type === 'Pressable' && n.props.onPress && n.props.accessibilityLabel);
  rows.find(n => n.props.accessibilityLabel.startsWith('일 b')).props.onPress();
  assert.deepEqual(picked, [['b', 1000]]);
}));

test('screen: loading and empty messages, no rows', () => withReact(({host}) => {
  const loading = texts(host.render(() => expand(api.TodayComboScreen({combos: null, loading: true, onClose() {}}))));
  assert.ok(loading.includes('오늘의 조합을 불러오고 있어요'));
  const empty = texts(host.render(() => expand(api.TodayComboScreen({combos: null, onClose() {}}))));
  assert.ok(empty.some(t => t.includes('준비하고 있어요')));
  assert.equal(empty.some(t => t.includes('채우기')), false);
}));

test('screen: without a callback, usn opens the whole list and a missing usn makes rows inert', () => withReact(({host, opened}) => {
  const combos = api.normalizeTodayCombos(raw());
  api.configureOfferwall({appKey: 'k', hashKey: 'h'});
  const usn = 'a'.repeat(64);
  const withUsn = expand(host.render(() => api.TodayComboScreen({combos, onClose() {}, usn})));
  const row = walk(withUsn).find(n => n.type === 'Pressable' && n.props.accessibilityLabel?.startsWith('일 a'));
  assert.equal(row.props.disabled, false);
  row.props.onPress();
  assert.deepEqual(opened, ['wall']);
  const noUsn = host.render(() => api.TodayComboScreen({combos, onClose() {}}));
  assert.equal(walk(noUsn).find(n => n.type === 'Pressable' && n.props.accessibilityLabel?.startsWith('일 a')).props.disabled, true);
}));

test('hook: nothing without url unless sample; sample is ready; url loads and stale/failed stay empty', () => withReact(async ({make}) => {
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
  } finally { global.fetch = realFetch; }
}));

test('entry: card by default, banner on Home only when the server says so, popup request opens the page once', () => withReact(({make}) => {
  const sampleProps = {sample: true};
  const chance = make();
  let tree = chance.render(() => api.TodayComboEntry({placement: 'chance', ...sampleProps}));
  const kinds = t => walk(expand(t)).filter(n => n.props?.accessibilityLabel?.startsWith('오늘의 포인트 조합')).length;
  assert.equal(kinds(tree), 1);
  assert.equal(walk(tree).some(n => n.type === 'Modal'), false);
  chance.flush();
  assert.equal(api.requestOpenCombos(), true);
  tree = chance.render(() => api.TodayComboEntry({placement: 'chance', ...sampleProps}));
  const modal = walk(tree).find(n => n.type === 'Modal');
  assert.ok(modal, 'page opens over the current screen');
  assert.ok(texts(expand(tree)).includes('1천P 채우기'));
  modal.props.onRequestClose();
  tree = chance.render(() => api.TodayComboEntry({placement: 'chance', ...sampleProps}));
  assert.equal(walk(tree).some(n => n.type === 'Modal'), false);

  const home = make();
  const homeTree = home.render(() => api.TodayComboEntry({placement: 'home', ...sampleProps}));
  assert.equal(kinds(homeTree), 1, 'sample turns the Home banner on');
  home.flush();
  // Chance tab (priority 2) takes the request, Home stays closed.
  assert.equal(api.requestOpenCombos(), true);
  assert.equal(walk(home.render(() => api.TodayComboEntry({placement: 'home', ...sampleProps}))).some(n => n.type === 'Modal'), false);
  assert.equal(walk(chance.render(() => api.TodayComboEntry({placement: 'chance', ...sampleProps}))).some(n => n.type === 'Modal'), true);
}));

test('entry: server "off" hides the card but the Chance tab still answers popup requests', () => withReact(async ({make}) => {
  const realFetch = global.fetch;
  try {
    global.fetch = async () => ({ok: true, json: async () => ({ok: true, combos: raw({date: api.kstDate(), display: {chance: 'off', home: 'off'}})})});
    const chance = make();
    chance.render(() => api.TodayComboEntry({placement: 'chance', url: 'u'})); chance.flush();
    await new Promise(r => setTimeout(r, 5));
    let tree = chance.render(() => api.TodayComboEntry({placement: 'chance', url: 'u'}));
    assert.equal(tree, null, 'nothing visible while off');
    assert.equal(api.requestOpenCombos(), true);
    tree = chance.render(() => api.TodayComboEntry({placement: 'chance', url: 'u'}));
    assert.ok(walk(tree).some(n => n.type === 'Modal'));
    const home = make();
    assert.equal(home.render(() => api.TodayComboEntry({placement: 'home', url: 'u'})), null);
  } finally { global.fetch = realFetch; }
}));
