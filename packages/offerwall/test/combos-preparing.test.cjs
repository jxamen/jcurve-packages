const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel, tick} = require('./harness.cjs');
const api = require('../dist');

// The iPhone list (앱보조5, 10/28 01:01): only campaigns with an iPhone key come down (5 at first), with `preparing` and a `notice`; `bundles` may be empty (0.3.16)
const TODAY = () => api.kstDate();
const NOTICE = '아이폰 목록을 준비 중이에요';
const item = (key, name, points, extra = {}) => ({campaignKey: key, name, points, line: '가입하기', done: false, cost: null, ...extra});
const five = () => [1, 2, 3, 4, 5].map(i => item(`17000000${i}`, `아이폰 ${i}`, 100 * i));
const iosDoc = (over = {}) => ({date: TODAY(), display: {chance: 'chip', home: 'banner'}, preparing: true, notice: NOTICE, bundles: [],
  categories: [{key: 'signup', title: '회원가입', total_points: 1500, count: 5, items: five()}], popup: {points: 1500, count: 5}, ...over});

test('preparing: a document with category rows and no bundles is a document (the chip must stay), with the notice kept', () => {
  const data = api.normalizeTodayCombos(iosDoc());
  assert.ok(data, 'not rejected');
  assert.deepEqual(data.bundles, []);
  assert.equal(data.categories[0].items.length, 5);
  assert.equal(data.preparing, true);
  assert.equal(data.notice, NOTICE);
  assert.equal(api.hasComboRows(data), true);
  assert.equal(api.comboNoticeOf(data), NOTICE);
  // `bundles` missing altogether is the same
  const {bundles, ...noBundles} = iosDoc();
  assert.ok(api.normalizeTodayCombos(noBundles));
});

test('preparing: nothing at all is still a document while the server says it is preparing — and only then', () => {
  const empty = api.normalizeTodayCombos(iosDoc({categories: [], popup: undefined}));
  assert.ok(empty);
  assert.deepEqual([empty.bundles.length, empty.categories, empty.preparing, empty.notice], [0, undefined, true, NOTICE]);
  assert.equal(api.hasComboRows(empty), false, 'no rows to list');
  // not preparing: as before, a document without any usable row is junk
  for (const junk of [{date: TODAY(), bundles: [], categories: []}, {date: TODAY(), preparing: false, bundles: []}, {date: TODAY(), preparing: 'true', bundles: []}, {date: TODAY()}, {bundles: 'x'}, {}, null, 'x', 3]) {
    assert.equal(api.normalizeTodayCombos(junk), null, JSON.stringify(junk));
  }
});

test('preparing: the notice is kept only while preparing, cleaned and short; Android documents (no preparing) are untouched', () => {
  assert.equal(api.normalizeTodayCombos(iosDoc({preparing: false})).notice, undefined, 'a notice without preparing is not shown');
  assert.equal(api.normalizeTodayCombos(iosDoc({preparing: false})).preparing, undefined);
  assert.equal(api.normalizeTodayCombos(iosDoc({notice: null})).notice, undefined);
  assert.equal(api.normalizeTodayCombos(iosDoc({notice: '  아이폰\n목록을 준비 중이에요  '})).notice, '아이폰 목록을 준비 중이에요');
  assert.equal(api.normalizeTodayCombos(iosDoc({notice: 'x'.repeat(200)})).notice.length, 80);
  const android = api.normalizeTodayCombos({date: TODAY(), bundles: [{goal: 1000, missions: [{id: 'a', name: '일 a', points: 1000, todo: '하나', level: 'easy'}]}], preparing: false, notice: null});
  assert.deepEqual(Object.keys(android).filter(k => k === 'preparing' || k === 'notice'), []);
  assert.equal(api.comboNoticeOf(android), '');
  assert.equal(api.comboNoticeOf(null), '');
});

test('preparing: the fetch result is ok (not bad_response) for these documents, stale or not', async () => {
  assert.equal(api.parseCombosBody({ok: true, combos: iosDoc()}).ok, true);
  assert.equal(api.parseCombosBody({ok: true, combos: iosDoc({categories: [], popup: undefined})}).ok, true);
  const old = api.parseCombosBody({ok: true, combos: iosDoc({date: '2026-10-26'})}, Date.UTC(2026, 9, 27, 3, 0, 0));
  assert.deepEqual([old.ok, old.stale], [true, true]);
  assert.equal(old.combos.notice, NOTICE, 'an earlier day\'s document keeps its notice too');
});

const props = (extra = {}) => ({onClose() {}, onPressMission() {}, ...extra});
const open = (host, combos) => host.render(() => api.ComboGuideScreen(props({combos})));

test('guide: the notice is the first thing on the category screen; without it nothing extra is there', () => withReact(({host}) => {
  const tree = open(host, api.normalizeTodayCombos(iosDoc()));
  assert.ok(texts(tree).includes(NOTICE));
  assert.ok(texts(tree).includes('아이폰 1'), 'the rows are listed under it');
  const normal = open(host, api.normalizeTodayCombos(iosDoc({preparing: false, notice: null})));
  assert.equal(texts(normal).includes(NOTICE), false);
}));

test('guide: with no rows at all it shows the notice and no second 「지금은 준비하고 있어요」 message', () => withReact(({host}) => {
  const tree = open(host, api.normalizeTodayCombos(iosDoc({categories: [], popup: undefined})));
  assert.ok(texts(tree).includes(NOTICE));
  assert.equal(texts(tree).some(x => x.includes('지금은 준비하고 있어요')), false);
  assert.equal(walk(tree).filter(n => n.type === 'Pressable' && typeof n.props.accessibilityLabel === 'string' && /^\d+번 /.test(n.props.accessibilityLabel)).length, 0, 'no rows');
}));

// ---- the entry: the chip stays, no popup for nothing ----
const NATIVE = {nativeModules: {JCurveOfferwallModule: {}}};
const memoryStorage = () => { const m = new Map(); return {getItem: async k => m.get(k) ?? null, setItem: async (k, v) => { m.set(k, v); }}; };
const startEntry = async ({make}, body) => {
  const host = make();
  const mount = () => host.render(() => api.ComboEntry({
    placement: 'chance', load: async () => ({ok: true, combos: body}), loadKey: 1, usn: 'a'.repeat(64), campaigns: {list: async () => [], open: async () => true}, storage: memoryStorage(),
  }));
  mount(); host.flush(); await tick(20); mount(); host.flush(); await tick(20);
  const settle = async () => { for (let i = 0; i < 3; i += 1) { host.flush(); mount(); await tick(15); } host.flush(); return mount(); };
  return {host, mount, settle};
};
const chipTexts = tree => texts(tree).filter(x => x.includes('포인트 빨리 모으기'));

test('entry: the chip is there for a short or empty iPhone list, and opening it shows the notice', () => withReact(async ctx => {
  for (const body of [iosDoc(), iosDoc({categories: [], popup: undefined})]) {
    const s = await startEntry(ctx, body);
    const tree = await s.settle();
    assert.ok(chipTexts(tree).length > 0, 'the chip stays');
    assert.equal(api.requestOpenCombos(Date.now() + Math.floor(Math.random() * 1e6)), true);
    const sheet = await s.settle();
    assert.ok(texts(sheet).includes(NOTICE), 'the notice at the top of the sheet');
  }
}, NATIVE));

test('hasComboRows: false for a list with nothing to show (the entry uses it to skip the recommendation popup and the home banner), true otherwise', async () => {
  const empty = api.normalizeTodayCombos(iosDoc({categories: [], popup: undefined}));
  const some = api.normalizeTodayCombos(iosDoc());
  assert.equal(api.hasComboRows(empty), false);
  assert.equal(api.hasComboRows(some), true);
  assert.equal(api.hasComboRows(null), false);
});
