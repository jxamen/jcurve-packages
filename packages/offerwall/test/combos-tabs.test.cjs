const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel, tick} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const item = (key, name, points, extra = {}) => ({campaignKey: key, name, points, line: '가입하기', done: false, cost: null, ...extra});
const cat = (key, title, total, items) => ({key, title, total_points: total, count: items.length, items});
const serverCategories = () => [
  cat('signup', '회원가입', 100, [item('1', '알바천국', 100)]),
  cat('trial', '무료체험', null, [item('2', '집핏', 1080, {cost: '체험 뒤 월 29,900원', trial_days: 7, charge_amount: 29900})]),
  cat('game', '게임', 5000, [item('3', '황야의 생존자', 5000, {line: '멀티미션 달성하기 · 30일 안'})]),
  cat('shop', '쇼핑', null, [item('4', '메디필', 2592, {cost: '3만원 이상 구매'})]),
];
const norm = (over = {}) => api.normalizeTodayCombos({date: TODAY(), bundles: [{goal: 1000, missions: [mission('b1', 1000)]}], categories: serverCategories(), ...over});
const props = (extra = {}) => ({onClose() {}, onPressMission() {}, ...extra});
const open = (host, combos, extra = {}) => host.render(() => api.ComboGuideScreen(props({combos, ...extra})));
const selectedOf = tree => walk(tree).filter(n => n.type === 'Pressable' && n.props.accessibilityState && n.props.accessibilityState.selected === true).map(n => n.props.accessibilityLabel);

test('tabs: the chosen tab is remembered by its key, not its place — a refetch that adds or removes tabs keeps the member on the same one', () => withReact(({host, make}) => {
  // categories: 게임 chosen; then 무료체험 (before it) disappears and a new tab comes first
  const first = norm();
  byLabel(open(host, first), '게임').props.onPress();
  assert.deepEqual(selectedOf(open(host, first)), ['게임']);
  const later = norm({categories: [cat('install', '앱 설치', 10, [item('70', 'z', 10)]), ...serverCategories().filter(c => c.key !== 'trial')]});
  assert.deepEqual(selectedOf(open(host, later)), ['게임'], 'still the game tab although its place changed');
  const gone = norm({categories: serverCategories().filter(c => c.key !== 'game')});
  assert.deepEqual(selectedOf(open(host, gone)), ['회원가입'], 'its tab is gone: the first one');
  // steps: 5천P chosen; then the easy tab appears in front
  const steps = make();
  const base = {date: TODAY(), bundles: [{goal: 1000, missions: [mission('a', 1000)]}, {goal: 5000, missions: [mission('b', 5000)]}]};
  const noEasy = api.normalizeTodayCombos(base);
  byLabel(steps.render(() => api.ComboGuideScreen(props({combos: noEasy}))), '2단계 5천P').props.onPress();
  const withEasy = api.normalizeTodayCombos({...base, easy: {missions: [mission('e', 100)]}});
  const tree = steps.render(() => api.ComboGuideScreen(props({combos: withEasy})));
  assert.deepEqual(selectedOf(tree), ['2단계 5천P'], 'an easy tab came in front: the same step stays chosen');
}));

test('tabs: the chips are easy to hit — a bigger touch area, a colour change at once, and the sideways row does not take the tap', () => withReact(({host}) => {
  const tree = open(host, norm());
  const chip = byLabel(tree, '게임');
  assert.deepEqual(chip.props.hitSlop, api.COMBO_TAB_HIT_SLOP);
  assert.ok(api.COMBO_TAB_HIT_SLOP.top >= 8 && api.COMBO_TAB_HIT_SLOP.left >= 4);
  const style = pressed => chip.props.style({pressed});
  assert.equal(style(false).height, 36);
  assert.notEqual(style(true).backgroundColor, style(false).backgroundColor, 'pressed looks different at once');
  const row = walk(tree).find(n => n.type === 'ScrollView' && n.props.horizontal === true);
  assert.equal(row.props.keyboardShouldPersistTaps, 'always');
  assert.equal(row.props.nestedScrollEnabled, true);
  assert.equal(row.props.directionalLockEnabled, true);
  const outer = walk(tree).find(n => n.type === 'ScrollView' && !n.props.horizontal);
  assert.equal(outer.props.keyboardShouldPersistTaps, 'handled');
}));

test('popup numbers: combos.popup (points, count) word the popup as 「오늘 +N P 모을 수 있어요 · 미션 n개」; without it the easy wording as before', () => {
  const easy = {missions: [mission('e1', 100), mission('e2', 200)]};
  const withPopup = norm({popup: {points: 123456, count: 87}, easy});
  assert.deepEqual(withPopup.popup, {points: 123456, count: 87});
  assert.deepEqual(api.comboPopupContent(withPopup), {before: '오늘 ', amount: '+123,456P', after: ' 모을 수 있어요', sub: '미션 87개', notice: api.COMBO_POPUP_NOTICE});
  const without = norm({easy});
  assert.equal(without.popup, undefined);
  assert.equal(api.comboPopupContent(without).amount, '+300P');
  assert.ok(api.comboPopupContent(without).sub.startsWith('쉬운 미션 2개'), 'the old wording for the old data');
  assert.equal(api.comboPopupContent(norm({popup: {points: 5000}})).sub, '', 'no count: no subtitle');
  for (const bad of [undefined, null, 5, 'x', {}, {points: 0, count: 3}, {points: -1}, {points: 'x'}]) assert.equal(norm({popup: bad}).popup, undefined, JSON.stringify(bad));
  assert.deepEqual(api.normalizeTodayCombos(withPopup).popup, {points: 123456, count: 87}, 'normalizing twice is the same');
});
