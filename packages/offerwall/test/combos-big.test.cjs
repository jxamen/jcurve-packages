const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel, tick} = require('./harness.cjs');
const api = require('../dist');

// The server's midnight reset (10/28) made the document 777 campaigns: 186 of them also in 「쉬운 미션」, 210 games, ... (0.3.15)
const TODAY = () => api.kstDate();
const item = (key, name, points, extra = {}) => ({campaignKey: key, name, points, line: '가입하기', done: false, cost: null, ...extra});
const TABS = [['trial', '무료체험', 18], ['signup', '회원가입', 120], ['follow', '팔로우·구독', 40], ['install', '앱 설치', 150], ['game', '게임', 210],
  ['shop', '쇼핑', 30], ['insurance', '보험', 15], ['consult', '상담·조회', 25], ['account', '계좌·카드', 40], ['etc', '그 밖', 129]];
const bigDoc = (over = {}) => {
  let n = 0;
  const all = [];
  const categories = TABS.map(([key, title, size]) => {
    const items = Array.from({length: size}, () => { const i = n++; const it = item(String(1700000000 + i), `캠페인 ${i}`, 100 + (i % 90) * 100); all.push(it); return it; });
    return {key, title, total_points: key === 'game' || key === 'shop' || key === 'trial' ? null : items.reduce((s, x) => s + x.points, 0), count: size, items};
  });
  const free = all.slice(18, 18 + 186); // 186 cost-free campaigns, also shown in 「쉬운 미션」
  categories.splice(1, 0, {key: 'easy', title: '쉬운 미션', total_points: free.reduce((s, x) => s + x.points, 0), count: free.length, items: free.map(x => ({...x}))});
  return api.normalizeTodayCombos({
    date: TODAY(), bundles: [{goal: 1000, missions: [{id: 'b1', name: '일반 미션', points: 1000, todo: '하나', level: 'easy', campaignKey: all[18].campaignKey}]}],
    categories, popup: {points: 157090, count: 221}, ...over,
  });
};
const props = (extra = {}) => ({onClose() {}, onPressMission() {}, ...extra});
const open = (host, combos, extra = {}) => host.render(() => api.ComboGuideScreen(props({combos, ...extra})));
const rows = tree => walk(tree).filter(n => n.type === 'Pressable' && typeof n.props.accessibilityLabel === 'string' && /^\d+번 /.test(n.props.accessibilityLabel));
const moreLabel = tree => texts(tree).find(x => x.startsWith('더 보기'));

test('a 777-campaign document: no row is dropped (every tab keeps all its rows, 777 different campaigns)', () => {
  const data = bigDoc();
  assert.deepEqual(data.categories.map(c => [c.key, c.items.length]), [
    ['trial', 18], ['easy', 186], ['signup', 120], ['follow', 40], ['install', 150], ['game', 210], ['shop', 30], ['insurance', 15], ['consult', 25], ['account', 40], ['etc', 129]]);
  assert.equal(api.categoryMissions(data).length, 777, 'a campaign that is in two tabs counts once');
  assert.equal(api.missionRowsOf(data).filter(m => m.campaignKey).length >= 777, true);
});

test('category screen: every tab opens with one page (40) and a 「더 보기」 with the right count; a short tab has none', () => withReact(({host}) => {
  const data = bigDoc();
  // the first tab is the trial tab (18 rows): all of them, no button
  const first = open(host, data);
  assert.equal(rows(first).length, 18);
  assert.equal(moreLabel(first), undefined);
  for (const [key, title, size] of [['easy', '쉬운 미션', 186], ['signup', '회원가입', 120], ['install', '앱 설치', 150], ['game', '게임', 210], ['etc', '그 밖', 129], ['follow', '팔로우·구독', 40], ['shop', '쇼핑', 30]]) {
    byLabel(open(host, data), title).props.onPress();
    const tab = open(host, data);
    assert.equal(rows(tab).length, Math.min(size, api.COMBO_PAGE_ROWS), `${key}: one page`);
    if (size > api.COMBO_PAGE_ROWS) assert.equal(moreLabel(tab), `더 보기 (${size - api.COMBO_PAGE_ROWS}개 남음)`, `${key}: what is left`);
    else assert.equal(moreLabel(tab), undefined, `${key}: nothing to add`);
  }
}));

test('category screen: 「더 보기」 on the 186-row 쉬운 미션 tab adds 40 each time until all are there', () => withReact(({host}) => {
  const data = bigDoc();
  byLabel(open(host, data), '쉬운 미션').props.onPress();
  let tree = open(host, data);
  const seen = [rows(tree).length];
  while (moreLabel(tree)) {
    const left = Number(moreLabel(tree).match(/\d+/)[0]);
    byLabel(tree, `더 보기, ${left}개 남음`).props.onPress();
    tree = open(host, data);
    seen.push(rows(tree).length);
  }
  assert.deepEqual(seen, [40, 80, 120, 160, 186]);
}));

test('steps screen (no categories): the easy tab of 186 missions and the trial tab of 100 show 40 at a time too', () => withReact(({host}) => {
  const missions = Array.from({length: 186}, (_, i) => ({id: `e${i}`, name: `쉬운 ${i}`, points: 100 + i, todo: '하나', level: 'easy', campaignKey: `k${i}`}));
  const trials = Array.from({length: 100}, (_, i) => ({campaignKey: `t${i}`, name: `체험 ${i}`, points: 500 + i, trial_days: 7, charge_amount: 9900}));
  const data = api.normalizeTodayCombos({
    date: TODAY(), bundles: [{goal: 1000, missions: [{id: 'b1', name: '일반', points: 1000, todo: '하나', level: 'easy'}]}],
    easy: {missions, total_points: 1}, trials, trial_keys: trials.map(t => t.campaignKey),
  });
  assert.equal(data.easy.missions.length, 186);
  assert.equal(data.trials.length, 100);
  const first = open(host, data);                         // the easy tab opens first
  assert.equal(rows(first).length, 40);
  assert.equal(moreLabel(first), '더 보기 (146개 남음)');
  byLabel(first, '더 보기, 146개 남음').props.onPress();
  const more = open(host, data);
  assert.equal(rows(more).length, 80);
  assert.equal(moreLabel(more), '더 보기 (106개 남음)');
  // the trial tab has its own count (a tab remembers its own page)
  byLabel(more, '무료체험').props.onPress();
  const trialTab = open(host, data);
  assert.equal(rows(trialTab).length, 40);
  assert.equal(moreLabel(trialTab), '더 보기 (60개 남음)');
  // the 1천P step has 1 row: no button
  byLabel(trialTab, '1단계 1천P').props.onPress();
  const step = open(host, data);
  assert.equal(rows(step).length, 1);
  assert.equal(moreLabel(step), undefined);
}));

test('what the screens ask for on every render is built once per document (and a new document gets its own)', () => {
  const data = bigDoc({done: ['1700000000', '1700000001']});
  assert.equal(api.autoDoneIds(data), api.autoDoneIds(data));
  assert.equal(api.categoryMissions(data), api.categoryMissions(data));
  assert.equal(api.trialMissions(data), api.trialMissions(data));
  assert.equal(api.missionRowsOf(data), api.missionRowsOf(data));
  assert.deepEqual([...api.autoDoneIds(data)].sort(), ['1700000000', '1700000001']);
  const other = bigDoc();
  assert.notEqual(api.autoDoneIds(other), api.autoDoneIds(data));
  assert.equal(api.autoDoneIds(other).size, 0);
  for (const nothing of [null, undefined]) {
    assert.deepEqual(api.categoryMissions(nothing), []);
    assert.deepEqual(api.trialMissions(nothing), []);
    assert.deepEqual(api.missionRowsOf(nothing), []);
    assert.equal(api.autoDoneIds(nothing).size, 0);
  }
});

// ---- the entry: how long the sheet took to open (0.3.15) ----
const NATIVE = {nativeModules: {JCurveOfferwallModule: {}}};
const memoryStorage = () => { const m = new Map(); return {getItem: async k => m.get(k) ?? null, setItem: async (k, v) => { m.set(k, v); }}; };
const startEntry = async ({make}, extra = {}) => {
  const host = make();
  const shownLog = [];
  const mount = () => host.render(() => api.ComboEntry({
    placement: 'chance', load: async () => ({ok: true, combos: bigDocRaw()}), loadKey: 1, usn: 'a'.repeat(64), campaigns: {list: async () => [], open: async () => true}, storage: memoryStorage(),
    onSheetShown: info => shownLog.push(info), ...extra,
  }));
  mount(); host.flush(); await tick(20); mount(); host.flush(); await tick(20);
  const settle = async () => { for (let i = 0; i < 3; i += 1) { host.flush(); mount(); await tick(15); } host.flush(); return mount(); };
  return {host, mount, settle, shownLog};
};
// the raw body the server sends (bigDoc() is already normalized): rebuild it from the normalized document's categories
const bigDocRaw = () => {
  const d = bigDoc();
  return {date: d.date, bundles: d.bundles, categories: d.categories.map(c => ({key: c.key, title: c.title, total_points: c.totalPoints, count: c.count, items: c.items.map(i => ({campaignKey: i.campaignKey, name: i.name, points: i.points, line: i.line ?? '', cost: i.cost ?? null}))})), popup: d.popup};
};

test('onSheetShown: once per opening, after the first paint — milliseconds, tabs, the first page, how many campaigns', () => withReact(async ctx => {
  const s = await startEntry(ctx);
  assert.equal(api.requestOpenCombos(), true);
  await s.settle();
  await tick(30);
  assert.equal(s.shownLog.length, 1, 'once');
  const info = s.shownLog[0];
  assert.deepEqual(Object.keys(info).sort(), ['ms', 'rows', 'tabs', 'total']);
  assert.equal(info.tabs, 11);
  assert.equal(info.rows, 18, 'the first tab (무료체험) has 18 rows, all on the first page');
  assert.equal(info.total, 777);
  assert.ok(Number.isFinite(info.ms) && info.ms >= 0 && info.ms < 5000);
  await s.settle(); await tick(30);
  assert.equal(s.shownLog.length, 1, 'later renders of the open sheet do not report again');
  // (a second opening is timed on its own — the guide screen mounts again, which the test stub of React cannot show: it keeps a removed child's hooks)
}, NATIVE));

test('onSheetShown: not asked for → nothing is timed; a throwing callback does not break the sheet', () => withReact(async ctx => {
  const none = await startEntry(ctx, {onSheetShown: undefined});
  assert.equal(api.requestOpenCombos(), true);
  const tree = await none.settle();
  await tick(30);
  assert.deepEqual(none.shownLog, []);
  assert.ok(texts(tree).includes('무료체험'), 'the sheet is there');
  const throwing = await startEntry(ctx, {onSheetShown: () => { throw new Error('log failed'); }});
  assert.equal(api.requestOpenCombos(Date.now() + 20 * 60_000), true);
  const after = await throwing.settle();
  await tick(30);
  assert.ok(texts(after).includes('무료체험'), 'still there');
}, NATIVE));
