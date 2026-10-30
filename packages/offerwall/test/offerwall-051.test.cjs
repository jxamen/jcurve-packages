// 0.6.8 — (1) 「포인트 빨리 모으기」 day key is the Korean day (0시 KST), (2) 찬스2 (SnapPlay) is closed for a member unless the server's
// config says `open: true` (the tab shows 「준비 중입니다」 and is not prepared, listed or opened), (3) the 무료체험 notice lies above the sheet.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const api = require('../dist');

test('0시 KST: the day key flips at 15:00 UTC (= 00:00 Korea) and nowhere else', () => {
  assert.equal(api.kstDate(Date.parse('2026-10-30T14:59:59.999Z')), '2026-10-30', 'one ms before midnight in Korea');
  assert.equal(api.kstDate(Date.parse('2026-10-30T15:00:00.000Z')), '2026-10-31', 'midnight in Korea');
  assert.equal(api.kstDate(Date.parse('2026-10-31T00:00:00.000Z')), '2026-10-31', 'UTC midnight is 09:00 in Korea');
  assert.equal(api.kstDate(Date.parse('2026-12-31T15:00:00.000Z')), '2027-01-01', 'year end');
  const yesterday = {date: '2026-10-30'};
  assert.equal(api.isTodayCombos(yesterday, Date.parse('2026-10-30T14:30:00.000Z')), true);
  assert.equal(api.isTodayCombos(yesterday, Date.parse('2026-10-30T15:00:01.000Z')), false, 'a document from yesterday is not today\'s after 0시');
});

test('찬스2 config: `open` is read only when it is true; anything else (absent, "true", 1) keeps the tab closed', () => {
  const base = {ios: {appId: 'IOS-APP-ID'}, listPlacement: 'chance_list'};
  assert.equal(api.parseSnapPlayConfig(base).open, false, 'absent = closed for everyone');
  assert.equal(api.parseSnapPlayConfig({...base, open: true}).open, true);
  assert.equal(api.parseSnapPlayConfig({...base, open: 'true'}).open, false, 'a string is not the switch');
  assert.equal(api.parseSnapPlayConfig({...base, open: 1}).open, false);
  assert.equal(api.parseSnapPlayConfig({ok: true, config: {...base, open: true}}).open, true, 'the wrapped answer too');
});

test('찬스2 provider: closed until the server lets this member in; a config that is not there yet counts as closed', () => {
  const provider = api.chanceProviderById('snapplay');
  assert.ok(provider, 'the SnapPlay provider is registered');
  api.configureSnapPlay({ok: true, config: {ios: {appId: 'IOS-APP-ID'}, listPlacement: 'chance_list'}});
  assert.equal(provider.closed(), true, 'not on the list');
  api.configureSnapPlay({ok: true, config: {ios: {appId: 'IOS-APP-ID'}, listPlacement: 'chance_list', open: true}});
  assert.equal(provider.closed(), false, 'on the list (허용 목록 · 테스트 회원)');
  api.resetSnapPlay();
  assert.equal(provider.closed(), true, 'after a reset the tab is closed again');
  assert.equal(require('../dist/chanceProviders').isClosedProvider({...provider, closed: () => { throw new Error('x'); }}), true, 'a throwing check is closed');
  assert.equal(require('../dist/chanceProviders').isClosedProvider({...provider, closed: undefined}), false, 'no check = open');
});

// (3) the 무료체험 notice drawn above the 「포인트 빨리 모으기」 sheet: inside the sheet's own Modal (a window above the app), not under it.
const {withReact, walk, byLabel, texts, tick} = require('./harness.cjs');
const KEY = '1781115240';
const combos = () => api.normalizeTodayCombos({
  date: api.kstDate(),
  bundles: [{goal: 1000, missions: [{id: 'b1', name: '일반 미션', points: 1000, todo: '하나 하기', level: 'easy', campaignKey: '777'}]}],
  trials: [{campaignKey: KEY, name: '집핏', points: 1080, trial_days: 7, charge_amount: 29900}], trial_keys: [KEY],
});
const box = (x, y, w, h) => ({x, y, w, h});
test('the 무료체험 notice opens inside the sheet Modal (above the sheet), not in the tree behind it', () => withReact(async (ctx) => {
  const host = ctx.make();
  const node = (b) => ({measureInWindow: (cb) => cb(b.x, b.y, b.w, b.h)});
  const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load: async () => ({ok: true, combos: combos()}), loadKey: 1, usn: 'a'.repeat(64),
    campaigns: {list: async () => [], open: async () => true}, onTrialConsent: () => {}, onTrialNotify: async () => 'on'}));
  mount(); host.flush(); await tick(20); mount(); host.flush(); await tick(20);
  let tree = mount(); host.flush();
  const anchor = walk(tree).find((n) => n.props && n.props.testID === 'jcurve-combo-anchor');
  if (anchor) { anchor.props.ref(node(box(0, 124, 400, 700))); anchor.props.onLayout(); }
  assert.equal(api.requestOpenCombos(), true);
  tree = mount(); host.flush();
  const ma = walk(tree).find((n) => n.props && n.props.testID === 'jcurve-combo-modal-anchor');
  if (ma) { ma.props.ref(node(box(0, 24, 1, 1))); ma.props.onLayout(); }
  tree = mount(); host.flush(); await tick(20); tree = mount(); host.flush();
  byLabel(tree, '무료체험').props.onPress();
  for (let i = 0; i < 3; i += 1) { host.flush(); tree = mount(); await tick(15); }
  const title = api.COMBO_CONSENT_TITLE;
  const modal = walk(tree).find((n) => n.type === 'Modal');
  assert.ok(modal, 'the sheet is in its Modal');
  assert.ok(texts(modal).includes(title), 'the notice sits inside the sheet Modal, above the sheet');
  assert.equal(texts(tree).filter((x) => x === title).length, 1, 'and only once (not also in the tree under the Modal)');
}));
