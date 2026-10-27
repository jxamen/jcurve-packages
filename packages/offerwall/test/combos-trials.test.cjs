const {test} = require('node:test');
const assert = require('node:assert/strict');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const norm = (over = {}) => api.normalizeTodayCombos({date: TODAY(), bundles: [{goal: 1000, missions: [mission('b1', 1000)]}], ...over});
// what the server sends today (앱보조5 10/27 22:31)
const trial = (key, extra = {}) => ({campaignKey: key, name: `체험 ${key}`, icon: `https://static.example.com/${key}.png`, points: 1080, trial_days: 7, trial_hours: 168, charge_amount: 29900, cancel_after_hours: 72, ...extra});

test('trials (server): the fields are read as the server sends them; nothing is added to the sums or the steps', () => {
  const data = norm({trials: [trial('1781115240'), trial('2')], trial_keys: ['1171869189', 'ABCdef'], trial_consent: {'1781115240': true, '114426912': false}});
  assert.deepEqual(data.trials[0], {
    campaignKey: '1781115240', name: '체험 1781115240', points: 1080, icon: 'https://static.example.com/1781115240.png',
    trialDays: 7, trialHours: 168, chargeAmount: 29900, cancelAfterHours: 72,
  });
  assert.equal(data.trials.length, 2);
  assert.deepEqual(data.trialKeys, ['1171869189', 'abcdef'], 'keys are kept in lower case');
  assert.deepEqual(data.trialConsent, {'1781115240': true, '114426912': false});
  assert.equal(data.bundles[0].total, 1000, 'the trials are not in any sum');
  assert.equal(data.easy, undefined);
});

test('trials: a row needs key, name and points; every other value is optional (missing = absent, never 0 or undefined); https icons only; one row per key', () => {
  const data = norm({
    trials: [
      {campaignKey: '1', name: '보리챗', points: 500},
      trial('2', {icon: 'http://insecure.example.com/x.png'}),
      trial('3', {icon: 'javascript:alert(1)'}),
      trial('4', {points: 0}), trial('5', {name: ''}), {name: 'no key', points: 100}, trial('', {}), null, 5, 'x',
      trial('1'),
      trial(6, {trial_days: 'x', trial_hours: -3, charge_amount: 1.5, cancel_after_hours: null}),
    ],
  });
  assert.deepEqual(data.trials.map(x => x.campaignKey), ['1', '2', '3', '6']);
  assert.deepEqual(data.trials[0], {campaignKey: '1', name: '보리챗', points: 500}, 'no optional key at all');
  assert.equal('icon' in data.trials[1], false, 'http icon dropped');
  assert.equal('icon' in data.trials[2], false, 'script icon dropped');
  assert.deepEqual(Object.keys(data.trials[3]).sort(), ['campaignKey', 'name', 'points'].concat(['icon']).sort(), 'junk numbers are dropped, a numeric key becomes a string');
  assert.equal(data.trials[3].campaignKey, '6');
});

test('trials: absent, empty or unusable data leaves no field; consent keeps only real booleans; the list is capped', () => {
  for (const bad of [undefined, null, [], 'x', 5, {}, [null, {}]]) {
    const data = norm({trials: bad, trial_keys: bad, trial_consent: bad});
    assert.equal(data.trials, undefined, JSON.stringify(bad));
    assert.equal(data.trialKeys, undefined);
    assert.equal(data.trialConsent, undefined);
  }
  const consent = norm({trial_consent: {a: true, b: false, c: 'yes', d: 1, e: null, f: {}, ['k'.repeat(80)]: true}}).trialConsent;
  assert.deepEqual(consent, {a: true, b: false});
  assert.equal(norm({trials: Array.from({length: 300}, (_, i) => trial(String(1000 + i)))}).trials.length, 100);
  assert.deepEqual(api.normalizeTodayCombos(norm({trials: [trial('1')], trial_keys: ['9'], trial_consent: {'9': true}})), norm({trials: [trial('1')], trial_keys: ['9'], trial_consent: {'9': true}}), 'normalizing twice is the same');
});

test('trials: a sold-out key leaves the list (unless this member was paid for it today)', () => {
  const data = norm({trials: [trial('1'), trial('2'), trial('3')], soldout: ['1', '3'], done: ['3']});
  assert.deepEqual(data.trials.map(x => x.campaignKey), ['2', '3']);
});

test('trialLine: 「7일 무료 · 이후 월 16,500원」; whole days said as days; hours; no price; nothing known', () => {
  assert.equal(api.trialLine({trialDays: 7, chargeAmount: 16500}), '7일 무료 · 이후 월 16,500원');
  assert.equal(api.trialLine({trialDays: 7, trialHours: 168, chargeAmount: 29900}), '7일 무료 · 이후 월 29,900원');
  assert.equal(api.trialLine({trialHours: 168, chargeAmount: 9900}), '7일 무료 · 이후 월 9,900원', 'whole days from hours');
  assert.equal(api.trialLine({trialHours: 36}), '36시간 무료');
  assert.equal(api.trialLine({trialDays: 30}), '30일 무료', 'no price known: not said');
  assert.equal(api.trialLine({}), '무료체험');
  assert.equal(api.formatWon(1234567), '1,234,567원');
});

test('consent: asked for a trial campaign (by trial_keys or the trials list) until it was answered — on the server or in this visit; never for others', () => {
  const data = norm({trials: [trial('111')], trial_keys: ['222', 'AAB'], trial_consent: {'333': false}});
  assert.equal(api.isTrialKey(data, '111'), true, 'in the trials list');
  assert.equal(api.isTrialKey(data, '222'), true, 'in trial_keys');
  assert.equal(api.isTrialKey(data, 'aab'), true);
  assert.equal(api.isTrialKey(data, 'AAb'), true, 'case does not matter');
  assert.equal(api.isTrialKey(data, '999'), false);
  assert.equal(api.isTrialKey(data, undefined), false);
  assert.equal(api.isTrialKey(null, '111'), false);
  assert.equal(api.needsTrialConsent(data, '111'), true);
  assert.equal(api.needsTrialConsent(data, '999'), false, 'not a trial');
  const answered = norm({trial_keys: ['333', '444'], trial_consent: {'333': false}});
  assert.equal(api.needsTrialConsent(answered, '333'), false, 'the server has the answer (even a "no")');
  assert.equal(api.needsTrialConsent(answered, '444'), true);
  assert.equal(api.needsTrialConsent(answered, '444', new Map([['444', true]])), false, 'answered in this visit');
  assert.equal(api.needsTrialConsent(answered, '444', {'444': false}), false);
});

// ---- the 「무료체험」 tab in the guide ----
const {withReact, texts, walk, byLabel} = require('./harness.cjs');
const props = (extra = {}) => ({onClose() {}, onPressMission() {}, ...extra});
const tabLabels = tree => walk(tree).filter(n => n.type === 'Pressable' && n.props.accessibilityState && 'selected' in n.props.accessibilityState).map(n => n.props.accessibilityLabel);
const withTrials = (over = {}) => norm({
  easy: {missions: [mission('e1', 100, {campaignKey: '5001'})]},
  trials: [trial('1781115240', {name: '집핏', points: 1080, charge_amount: 29900}), trial('114426912', {name: '보리챗', points: 500, charge_amount: undefined, cancel_after_hours: undefined}), trial('333', {name: '밀리의서재', points: 700, trial_days: 14, charge_amount: 9900})],
  ...over,
});

test('trial tab: 「무료체험」 is the last tab (after 쉽게 모으기 and the steps) and only when the server sent trials', () => withReact(({host}) => {
  const tree = host.render(() => api.ComboGuideScreen(props({combos: withTrials()})));
  assert.deepEqual(tabLabels(tree), ['쉽게 모으기', '1단계 1천P', '무료체험']);
  const without = host.render(() => api.ComboGuideScreen(props({combos: norm({easy: {missions: [mission('e1', 100)]}})})));
  assert.deepEqual(tabLabels(without), ['쉽게 모으기', '1단계 1천P']);
  const only = host.render(() => api.ComboGuideScreen(props({combos: withTrials({easy: undefined})})));
  assert.deepEqual(tabLabels(only), ['1단계 1천P', '무료체험']);
}));

test('trial tab: the tab bar scrolls sideways; its content is the cancel note and the numbered rows (name, 「7일 무료 · 이후 월 …원」, +P) with no sum', () => withReact(({host}) => {
  const tree = host.render(() => api.ComboGuideScreen(props({combos: withTrials()})));
  const bar = walk(tree).find(n => n.type === 'ScrollView' && n.props.horizontal === true);
  assert.ok(bar, 'a sideways scrolling tab row');
  byLabel(tree, '무료체험').props.onPress();
  const on = host.render(() => api.ComboGuideScreen(props({combos: withTrials()})));
  const all = texts(on);
  assert.ok(all.includes('끝나기 전에 해지하면 무료 · 해지 안내를 받을 수 있어요'), 'the one-line note');
  assert.ok(all.includes('집핏') && all.includes('보리챗') && all.includes('밀리의서재'));
  assert.ok(all.includes('7일 무료 · 이후 월 29,900원'));
  assert.ok(all.includes('14일 무료 · 이후 월 9,900원'));
  assert.ok(all.includes('7일 무료'), 'no price known: the price part is left out');
  assert.ok(all.includes('+1,080P') && all.includes('+500P') && all.includes('+700P'));
  assert.equal(all.includes('합계') || all.includes('남은 합계') || all.includes('다 하면'), false, 'no sum for trials');
  assert.equal(all.some(s => s.includes('준비하고 있어요')), false);
  const numbers = walk(on).filter(n => n.type === 'View' && n.props.style && n.props.style.width === 30 && n.props.style.borderRadius === 15).map(n => texts(n)[0]);
  assert.deepEqual(numbers, ['1', '2', '3']);
}));

test('trial tab: a tap goes to onPressTrial with the trial; without it onPressMission gets the row as a mission; the check marks work like the others', () => withReact(({host}) => {
  const trialsTapped = []; const missionsTapped = []; const ticks = [];
  const combos = withTrials();
  const mount = extra => host.render(() => api.ComboGuideScreen(props({combos, onToggleDone: id => ticks.push(id), ...extra})));
  byLabel(mount({}), '무료체험').props.onPress();
  const first = mount({onPressTrial: x => trialsTapped.push(x)});
  byLabel(first, '1번 집핏', true).props.onPress();
  assert.deepEqual(trialsTapped.map(x => x.campaignKey), ['1781115240']);
  assert.equal(trialsTapped[0].chargeAmount, 29900);
  const fallback = mount({onPressMission: m => missionsTapped.push(m)});
  byLabel(fallback, '2번 보리챗', true).props.onPress();
  assert.equal(missionsTapped[0].id, '114426912');
  assert.equal(missionsTapped[0].campaignKey, '114426912');
  byLabel(fallback, '집핏 완료 표시').props.onPress();
  assert.deepEqual(ticks, ['1781115240']);
}));

test('trial tab: a trial the server paid today is a done row (✓, at the bottom, numbers start again); ticks work by key', () => withReact(({host}) => {
  const combos = withTrials({done: ['114426912']});
  const mount = (extra = {}) => host.render(() => api.ComboGuideScreen(props({combos, ...extra})));
  byLabel(mount(), '무료체험').props.onPress();
  const tree = mount({done: new Set(['333'])});
  const numbers = walk(tree).filter(n => n.type === 'View' && n.props.style && n.props.style.width === 30 && n.props.style.borderRadius === 15).map(n => texts(n)[0]);
  assert.deepEqual(numbers, ['1', '✓', '✓'], 'one open row first, then the paid and the ticked ones');
  assert.deepEqual(api.autoDoneIds(combos).has('114426912'), true);
}));

test('trial tab: the other tabs are unchanged (a step still shows its sum); a selected index past the end falls back to the last tab', () => withReact(({host}) => {
  const combos = withTrials();
  const tree = host.render(() => api.ComboGuideScreen(props({combos})));
  assert.ok(texts(tree).includes('다 하면'), 'the easy tab opens first, with its sum');
  assert.equal(texts(tree).includes('끝나기 전에 해지하면 무료 · 해지 안내를 받을 수 있어요'), false);
}));
