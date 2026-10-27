const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel} = require('./harness.cjs');
const api = require('../dist');

const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const TODAY = () => api.kstDate();
const bundle = (goal, ...missions) => ({goal, missions: missions.length ? missions : [mission(`b${goal}`, goal)]});
const combos = (over = {}) => api.normalizeTodayCombos({
  date: TODAY(),
  bundles: [bundle(1000), bundle(5000), bundle(10000)],
  ...over,
});
const entry = (goal, ...missions) => ({goal, missions});

test('singles: grouped by goal, several entries per goal merge, sorted, kept next to the bundles', () => {
  const out = combos({singles: [
    entry(5000, mission('s5a', 5400)), entry(1000, mission('s1a', 1008)), entry(1000, mission('s1b', 2592)), entry(1000, mission('s1c', 2880)),
  ]});
  assert.deepEqual(out.singles.map(s => [s.goal, s.missions.map(m => m.id)]), [[1000, ['s1a', 's1b', 's1c']], [5000, ['s5a']]]);
});

test('singles: a mission must reach the goal on its own; one that falls short is dropped (a wrong promise otherwise)', () => {
  const out = combos({singles: [entry(1000, mission('short', 999), mission('exact', 1000), mission('more', 4000))]});
  assert.deepEqual(out.singles[0].missions.map(m => m.id), ['exact', 'more']);
  assert.equal(combos({singles: [entry(5000, mission('short', 4999))]}).singles, undefined, 'nothing left: no singles at all');
});

test('singles: goals without a bundle step are dropped; at most 6 different missions per goal; duplicates by id once', () => {
  const out = combos({singles: [
    entry(2000, mission('nowhere', 2500)),
    entry(1000, ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => mission(`m${n}`, 1100))),
    entry(1000, mission('m1', 1100), mission('m2', 1100)),
  ]});
  assert.deepEqual(out.singles.map(s => s.goal), [1000]);
  assert.deepEqual(out.singles[0].missions.map(m => m.id), ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);
});

test('singles: absent, wrong type or junk entries give no singles and never break the bundles', () => {
  for (const bad of [undefined, null, 'x', 5, {}, [], [null], ['x'], [{}], [{goal: 1000}], [{goal: 1000, missions: 'x'}], [{goal: 0, missions: [mission('a', 5000)]}], [entry(1000, null, 'x', {id: 'z'})]]) {
    const out = combos({singles: bad});
    assert.equal(out.singles, undefined, JSON.stringify(bad));
    assert.equal(out.bundles.length, 3);
  }
  assert.equal(combos().singles, undefined);
});

test('singles: same field rules as bundles (clamped text, level, minutes, campaignKey) and a huge number never passes', () => {
  const out = combos({singles: [entry(1000, {id: 7, name: '가'.repeat(60), points: '2000', todo: 'a\u0000b · 결제 필요', level: 'weird', minutes: 999, campaign_key: '352216486'}, mission('big', Number.MAX_SAFE_INTEGER))]});
  const m = out.singles[0].missions[0];
  assert.equal(m.id, '7');
  assert.equal(m.name.length, 40);
  assert.equal(m.todo, 'a b · 결제 필요');
  assert.equal(m.level, 'normal');
  assert.equal('minutes' in m, false);
  assert.equal(m.campaignKey, '352216486');
  assert.equal(out.singles[0].missions.length, 1, 'the unsafe number was rejected');
});

test('singles: at most 60 entries are looked at (hostile size)', () => {
  const many = Array.from({length: 500}, (_, i) => entry(1000, mission(`x${i}`, 2000)));
  assert.ok(combos({singles: many}).singles[0].missions.length <= 6);
});

test('the sample has singles that reach their goals, one needing a payment', () => {
  const sample = api.TODAY_COMBOS_SAMPLE;
  assert.ok(sample.singles.length >= 2);
  for (const group of sample.singles) {
    assert.ok(sample.bundles.some(b => b.goal === group.goal), `a bundle exists for ${group.goal}`);
    for (const m of group.missions) assert.ok(m.points >= group.goal, m.name);
  }
  assert.ok(sample.singles.some(g => g.missions.some(m => m.todo.includes('결제 필요'))));
});

// ---- the guide ----
const props = (extra = {}) => ({onClose() {}, onPressMission() {}, ...extra});

test('guide: 「한 번에 끝내기」 sits under the chosen step with rows in the same look, and follows the step tabs', () => withReact(({host}) => {
  const data = combos({singles: [entry(1000, mission('s1a', 1008, {name: '신한 SOL페이 앱', todo: '신규 회원가입하기'}), mission('s1b', 2592, {name: '연말 환급받기', todo: '무료로 조회하기'})), entry(5000, mission('s5a', 5400, {name: '짱구 게임 방범대'}))]});
  const p = props({combos: data});
  let tree = host.render(() => api.ComboGuideScreen(p));
  let all = texts(tree);
  assert.ok(all.includes('1,000P 모으기') && all.includes('한 번에 끝내기'));
  assert.ok(all.includes('아래 중 하나만 해도 1,000P를 채워요'));
  assert.ok(all.includes('신한 SOL페이 앱') && all.includes('+1,008P') && all.includes('신규 회원가입하기'));
  assert.ok(all.includes('연말 환급받기') && all.includes('+2,592P') && all.includes('무료로 조회하기'));
  assert.equal(all.includes('짱구 게임 방범대'), false, 'the 5천 singles belong to the 2단계 tab');
  assert.ok(byLabel(tree, '1번 신한 SOL페이 앱', true) && byLabel(tree, '2번 연말 환급받기', true), 'each row has its own 하러 가기');
  byLabel(tree, '2단계 5천P').props.onPress();
  tree = host.render(() => api.ComboGuideScreen(p));
  all = texts(tree);
  assert.ok(all.includes('5,000P 모으기') && all.includes('짱구 게임 방범대') && all.includes('아래 중 하나만 해도 5,000P를 채워요'));
  assert.equal(all.includes('신한 SOL페이 앱'), false);
}));

test('guide: a step without singles (or a server that sends none) shows no box', () => withReact(({host}) => {
  const none = texts(host.render(() => api.ComboGuideScreen(props({combos: combos()}))));
  assert.equal(none.includes('한 번에 끝내기'), false);
  const onlyFirst = combos({singles: [entry(1000, mission('s1a', 1008))]});
  const p = props({combos: onlyFirst});
  assert.ok(texts(host.render(() => api.ComboGuideScreen(p))).includes('한 번에 끝내기'));
  byLabel(host.render(() => api.ComboGuideScreen(p)), '2단계 5천P').props.onPress();
  assert.equal(texts(host.render(() => api.ComboGuideScreen(p))).includes('한 번에 끝내기'), false, 'the 5천 step has none: the box is hidden');
}));

test('guide: tapping a single reports that mission with a one-mission bundle of its goal', () => withReact(({host}) => {
  const got = [];
  const data = combos({singles: [entry(1000, mission('s1a', 1008), mission('s1b', 2592))]});
  const tree = host.render(() => api.ComboGuideScreen(props({combos: data, onPressMission: (m, b) => got.push([m.id, b.goal, b.total, b.missions.length])})));
  byLabel(tree, '2번 일 s1b', true).props.onPress();
  assert.deepEqual(got, [['s1b', 1000, 2592, 1]]);
}));

test('guide: ticking works in the box; the same campaign in the bundle and the box is one mark; done singles sink', () => withReact(({host}) => {
  const data = combos({
    bundles: [bundle(1000, mission('same', 1100, {name: '같은 캠페인'}), mission('other', 500, {name: '다른 것'}))],
    singles: [entry(1000, mission('same', 1100, {name: '같은 캠페인'}), mission('solo', 1500, {name: '혼자 끝내기'}))],
  });
  const ticked = [];
  const mk = done => host.render(() => api.ComboGuideScreen(props({combos: data, done: new Set(done), onToggleDone: id => ticked.push(id)})));
  const tree = mk([]);
  const marks = walk(tree).filter(n => n.props?.accessibilityRole === 'checkbox' && n.props.accessibilityLabel === '혼자 끝내기 완료 표시');
  assert.equal(marks.length, 1);
  marks[0].props.onPress();
  assert.deepEqual(ticked, ['solo']);
  const after = mk(['same']);
  const doneRows = walk(after).filter(n => n.type === 'Pressable' && n.props.accessibilityLabel === '같은 캠페인, 완료');
  assert.equal(doneRows.length, 2, 'ticked once, shown done in both places');
  const order = walk(after).filter(n => n.type === 'Text' && ['같은 캠페인', '혼자 끝내기', '다른 것'].includes(n.children[0])).map(n => n.children[0]);
  assert.deepEqual(order, ['다른 것', '같은 캠페인', '혼자 끝내기', '같은 캠페인'], 'done rows go last inside each box');
}));

test('guide: a 「결제 필요」 todo is shown as it comes', () => withReact(({host}) => {
  const data = combos({singles: [entry(1000, mission('pay', 2000, {name: '쇼핑몰 첫 구매', todo: '첫 구매하기 · 결제 필요'}))]});
  assert.ok(texts(host.render(() => api.ComboGuideScreen(props({combos: data})))).includes('첫 구매하기 · 결제 필요'));
}));

test('guide: no singles box and no 합계 change for a plain bundle response (compatible with servers that never send singles)', () => withReact(({host}) => {
  const all = texts(host.render(() => api.ComboGuideScreen(props({combos: combos()}))));
  assert.ok(all.includes('합계') && all.includes('1,000P 모으기'));
  assert.equal(all.some(t => t.includes('하나만 해도')), false);
}));
