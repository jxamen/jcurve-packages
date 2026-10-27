const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel, tick, hasSheet} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const bundle = (goal, ...missions) => ({goal, missions: missions.length ? missions : [mission(`b${goal}`, goal)]});
const combos = (over = {}) => api.normalizeTodayCombos({date: TODAY(), bundles: [bundle(1000), bundle(5000), bundle(10000)], ...over});
const easyOf = (...missions) => ({total_points: 99999, missions});
const props = (extra = {}) => ({onClose() {}, onPressMission() {}, ...extra});
const pills = tree => walk(tree).filter(n => n.type === 'Pressable' && /^(쉽게 모으기|\d단계 )/.test(n.props.accessibilityLabel || '')).map(n => n.props.accessibilityLabel);

test('easy: kept in order, any points, total recomputed from the kept rows (the server number is ignored)', () => {
  const out = combos({easy: easyOf(mission('e1', 102), mission('e2', 150), mission('e1', 999), {id: 'bad', name: '', points: 5}, mission('e3', 0), mission('e4', 48))});
  assert.deepEqual(out.easy.missions.map(m => [m.id, m.points]), [['e1', 102], ['e2', 150], ['e4', 48]]);
  assert.equal(out.easy.total, 300);
});

test('easy: every different mission is kept (no cut at 15 or 20), up to a sanity limit of 300; absent or unusable data means no easy at all', () => {
  const many = Array.from({length: 30}, (_, i) => mission(`m${i}`, 100 + i));
  assert.equal(combos({easy: easyOf(...many)}).easy.missions.length, 30);
  assert.equal(combos({easy: easyOf(...many, ...many)}).easy.missions.length, 30, 'the same mission twice is one');
  const huge = Array.from({length: 700}, (_, i) => mission(`n${i}`, 100));
  assert.equal(combos({easy: easyOf(...huge)}).easy.missions.length, 300);
  assert.equal(api.comboPopupContent(combos({easy: easyOf(...many)})).sub.startsWith('쉬운 미션 30개'), true, 'the popup says the same count');
  for (const bad of [undefined, null, 5, 'x', [], {}, {missions: 'x'}, {missions: []}, easyOf({id: 'x'}), easyOf(mission('z', -5))]) {
    assert.equal(combos({easy: bad}).easy, undefined, JSON.stringify(bad));
  }
});

test('easy: the campaignKey of a row is kept so the app can open it directly', () => {
  const out = combos({easy: easyOf(mission('e1', 102, {campaignKey: '352216486'}), mission('e2', 150, {campaign_key: '77'}))});
  assert.deepEqual(out.easy.missions.map(m => m.campaignKey), ['352216486', '77']);
});

test('easy: the sample has an easy list that survives normalizing, with its total', () => {
  const out = api.normalizeTodayCombos({date: TODAY(), ...api.TODAY_COMBOS_SAMPLE});
  assert.equal(out.easy.missions.length, 4);
  assert.equal(out.easy.total, api.TODAY_COMBOS_SAMPLE.easy.total);
  assert.equal(api.COMBO_EASY_NAME, '쉽게 모으기');
});

test('guide: 쉽게 모으기 is the first tab and what opens; rows, 하러 가기 and the 다 하면 total show; no steps content', () => withReact(({host}) => {
  const data = combos({singles: [{goal: 1000, missions: [mission('s1', 1008)]}], easy: easyOf(mission('e1', 102, {name: '삼성생명 인스타그램'}), mission('e2', 150, {name: '메디필 공식 채널'}))});
  const tree = host.render(() => api.ComboGuideScreen(props({combos: data})));
  assert.deepEqual(pills(tree), ['쉽게 모으기', '1단계 1천P', '2단계 5천P', '3단계 1만P']);
  assert.equal(byLabel(tree, '쉽게 모으기').props.accessibilityState.selected, true);
  const all = texts(tree);
  assert.equal(all.includes('쉬운 것부터 가볍게 모아요'), false, 'no big headline paragraph any more');
  assert.ok(all.includes('쉽게 모으기') && all.includes('다 하면') && all.includes('+252P'), 'total of what is left');
  assert.ok(all.includes('삼성생명 인스타그램') && all.includes('+102P'));
  assert.equal(all.includes('하러 가기 ›'), false, 'the whole row is the button: no big 하러 가기 button');
  assert.match(byLabel(tree, '1번 삼성생명 인스타그램', true).props.accessibilityLabel, /하러 가기/, 'screen readers still hear it');
  assert.ok(byLabel(tree, '1번 삼성생명 인스타그램', true) && byLabel(tree, '2번 메디필 공식 채널', true));
  assert.equal(all.includes('1,000P 모으기'), false);
  assert.equal(all.includes('한 번에 끝내기'), false, 'singles belong to the steps');
  assert.equal(all.includes('1천 → 5천 → 1만P 차례로 모아요'), false);
}));

test('guide: switching to a step and back works; steps keep their own look (bundle, singles, 합계)', () => withReact(({host}) => {
  const data = combos({singles: [{goal: 1000, missions: [mission('s1', 1008, {name: '신한 SOL페이 앱'})]}], easy: easyOf(mission('e1', 102))});
  const p = props({combos: data});
  byLabel(host.render(() => api.ComboGuideScreen(p)), '1단계 1천P').props.onPress();
  let all = texts(host.render(() => api.ComboGuideScreen(p)));
  assert.ok(all.includes('합계') && all.includes('한 번에 끝내기') && all.includes('신한 SOL페이 앱'));
  assert.equal(byLabel(host.render(() => api.ComboGuideScreen(p)), '1단계 1천P').props.accessibilityState.selected, true);
  assert.equal(all.includes('1천 → 5천 → 1만P 차례로 모아요'), false, 'no headline paragraph');
  assert.equal(all.includes('다 하면'), false);
  byLabel(host.render(() => api.ComboGuideScreen(p)), '쉽게 모으기').props.onPress();
  all = texts(host.render(() => api.ComboGuideScreen(p)));
  assert.ok(all.includes('다 하면') && all.includes('+102P'));
}));

test('guide: tapping an easy row reports the mission with an easy bundle (goal 0, its total)', () => withReact(({host}) => {
  const got = [];
  const data = combos({easy: easyOf(mission('e1', 102), mission('e2', 150))});
  const tree = host.render(() => api.ComboGuideScreen(props({combos: data, onPressMission: (m, b) => got.push([m.id, b.goal, b.total, b.missions.length])})));
  byLabel(tree, '2번 일 e2', true).props.onPress();
  assert.deepEqual(got, [['e2', 0, 252, 2]]);
}));

test('guide: done marks work in the easy tab; remaining sum, finished message; a mark is shared with the same id elsewhere', () => withReact(({host}) => {
  const data = combos({easy: easyOf(mission('e1', 102), mission('e2', 150))});
  const some = texts(host.render(() => api.ComboGuideScreen(props({combos: data, done: new Set(['e1']), onToggleDone() {}}))));
  assert.ok(some.includes('남은 합계') && some.includes('+150P') && some.includes('✓'));
  const all = texts(host.render(() => api.ComboGuideScreen(props({combos: data, done: new Set(['e1', 'e2']), onToggleDone() {}}))));
  assert.ok(all.includes('모두 마쳤어요'));
  assert.equal(all.includes('다 하면'), false);
  const ticks = [];
  const tree = host.render(() => api.ComboGuideScreen(props({combos: data, onToggleDone: id => ticks.push(id)})));
  byLabel(tree, '일 e2 완료 표시').props.onPress();
  assert.deepEqual(ticks, ['e2']);
  assert.equal(texts(tree).some(t => t.includes('동그라미')), false, 'no instruction paragraph any more');
}));

test('guide: without easy nothing changes (1단계 first and selected, no 쉽게 모으기 pill); easy with one step still gets two tabs', () => withReact(({host}) => {
  const plain = host.render(() => api.ComboGuideScreen(props({combos: combos()})));
  assert.deepEqual(pills(plain), ['1단계 1천P', '2단계 5천P', '3단계 1만P']);
  assert.equal(byLabel(plain, '1단계 1천P').props.accessibilityState.selected, true);
  const one = api.normalizeTodayCombos({date: TODAY(), bundles: [bundle(1000)], easy: easyOf(mission('e1', 102))});
  assert.deepEqual(pills(host.render(() => api.ComboGuideScreen(props({combos: one})))), ['쉽게 모으기', '1단계 1천P']);
  const single = api.normalizeTodayCombos({date: TODAY(), bundles: [bundle(1000)]});
  assert.deepEqual(pills(host.render(() => api.ComboGuideScreen(props({combos: single})))), [], 'one step and no easy: no tabs, as before');
}));

test('guide: easy tab disappearing after a refresh falls back to a valid tab', () => withReact(({host}) => {
  const withEasy = combos({easy: easyOf(mission('e1', 102))});
  byLabel(host.render(() => api.ComboGuideScreen(props({combos: withEasy}))), '3단계 1만P').props.onPress();
  const without = host.render(() => api.ComboGuideScreen(props({combos: combos()})));
  assert.ok(['1단계 1천P', '2단계 5천P', '3단계 1만P'].some(l => byLabel(without, l)?.props.accessibilityState.selected === true), 'some step is selected, never an empty list');
  assert.ok(texts(without).includes('합계'));
}));

test('entry: the first row of the easy tab goes straight to the SDK with its server key and reports one diagnostic', () => withReact(async ({make}) => {
  const opened = []; const diags = [];
  const data = combos({easy: easyOf(mission('e1', 102, {name: '삼성생명 인스타그램', campaignKey: '352216486'}))});
  const host = make();
  const bridge = {list: async () => [], open: async key => { opened.push(key); return true; }};
  const mount = () => host.render(() => api.ComboEntry({
    placement: 'chance', load: async () => ({ok: true, combos: data}), loadKey: 1, usn: 'a'.repeat(64), campaigns: bridge, onDiagnostic: d => diags.push(d),
  }));
  mount(); host.flush(); await tick(); mount(); host.flush();
  assert.equal(api.requestOpenCombos(), true);
  const tree = mount();
  assert.equal(byLabel(tree, '쉽게 모으기').props.accessibilityState.selected, true);
  byLabel(tree, '1번 삼성생명 인스타그램', true).props.onPress(); await tick(20);
  assert.deepEqual(opened, ['352216486']);
  assert.equal(diags.length, 1);
  assert.equal(diags[0].mission, 'e1');
  assert.equal(diags[0].how, 'server_key');
  assert.equal(hasSheet(mount()), true, 'the guide stays open');
}));
