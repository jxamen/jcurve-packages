const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel} = require('./harness.cjs');
const api = require('../dist');

// the server's own example (앱보조5 10/27 22:31)
const serverRow = (over = {}) => ({
  campaignKey: '1781115240', name: '집핏', icon: 'https://static.example.com/zip.png', points: 1080, joined_at: '2026-10-27T22:32:24+09:00', joined_via: 'consent', agreed: true,
  trial_days: 7, trial_hours: 168, cancel_after_hours: 72, charge_amount: 29900, cancel_from: '2026-10-30T22:32:24+09:00', charge_at: '2026-11-03T22:32:24+09:00', status: '체험 중', cancelled: null, ...over,
});
const body = rows => ({ok: true, trials: rows, now: '2026-10-27T22:32:24+09:00'});

test('my trials: the server body is read as it comes (camelCase out), newest first as sent', () => {
  const list = api.parseMyTrials(body([serverRow(), serverRow({campaignKey: '2', name: '보리챗', status: '지금 해지 가능', cancelled: false, joined_via: 'reward'})]));
  assert.deepEqual(list[0], {
    campaignKey: '1781115240', name: '집핏', points: 1080, icon: 'https://static.example.com/zip.png', joinedAt: '2026-10-27T22:32:24+09:00', joinedVia: 'consent', agreed: true,
    trialDays: 7, trialHours: 168, cancelAfterHours: 72, chargeAmount: 29900, cancelFrom: '2026-10-30T22:32:24+09:00', chargeAt: '2026-11-03T22:32:24+09:00', status: '체험 중', cancelled: null,
  });
  assert.deepEqual(list.map(x => x.campaignKey), ['1781115240', '2']);
  assert.equal(list[1].cancelled, false);
  assert.equal(list[1].joinedVia, 'reward');
});

test('my trials: a body that is not the list shape is null (the screen says it could not load); bad values are left out, never guessed', () => {
  for (const bad of [null, undefined, 'x', 5, [], {}, {ok: false, trials: []}, {ok: true}, {trials: 'x'}]) assert.equal(api.parseMyTrials(bad), null, JSON.stringify(bad));
  assert.deepEqual(api.parseMyTrials({trials: []}), []);
  const list = api.parseMyTrials(body([
    {campaignKey: 7, name: ''}, {name: 'no key'}, null, 3, serverRow({campaignKey: '7'}),
    {campaignKey: '9', name: '이상한 값', icon: 'http://x.example.com/a.png', points: -1, status: '모름', cancelled: 'yes', joined_at: 'yesterday', charge_amount: 1.5, joined_via: 'x'},
  ]));
  assert.deepEqual(list.map(x => x.campaignKey), ['7', '9']);
  assert.equal(list[0].name, '무료체험', 'no name: the plain word');
  assert.deepEqual(list[1], {campaignKey: '9', name: '이상한 값'});
});

test('my trials: dates, 「해지했나요?」 rule and the grey line', () => {
  assert.equal(api.monthDay('2026-10-30T22:32:24+09:00'), '10/30');
  assert.equal(api.monthDay('2026-11-03T00:00:00+09:00'), '11/3');
  assert.equal(api.monthDay(undefined), '');
  assert.equal(api.monthDay('soon'), '');
  assert.equal(api.asksCancelled({status: '체험 중', cancelled: null}), false, 'not yet the time');
  assert.equal(api.asksCancelled({status: '지금 해지 가능', cancelled: null}), true);
  assert.equal(api.asksCancelled({status: '지금 해지 가능', cancelled: false}), true, '아직 → it asks again later');
  assert.equal(api.asksCancelled({status: '지금 해지 가능', cancelled: true}), false);
  assert.equal(api.asksCancelled({status: '결제 시작됨', cancelled: null}), true);
  assert.equal(api.asksCancelled({}), false);
  const [row] = api.parseMyTrials(body([serverRow()]));
  assert.equal(api.myTrialLine(row), '10/27 참여 · 11/3 결제 예정 · 월 29,900원');
  assert.equal(api.myTrialLine({...row, status: '결제 시작됨'}), '10/27 참여 · 11/3 결제 시작 · 월 29,900원');
  assert.equal(api.myTrialLine({campaignKey: '1', name: 'x'}), '');
});

test('open request: with an entry mounted it opens (with the campaign to highlight); the Chance tab wins; without one it waits ten seconds for the first', () => {
  const calls = [];
  const off = api.listenForTrialRequests({priority: 1, open: key => calls.push(['home', key])});
  const off2 = api.listenForTrialRequests({priority: 2, open: key => calls.push(['chance', key])});
  assert.equal(api.requestOpenTrials('1781115240'), true);
  assert.deepEqual(calls, [['chance', '1781115240']]);
  assert.equal(api.requestOpenTrials(), true);
  assert.deepEqual(calls[1], ['chance', undefined]);
  off(); off2();
  // nothing mounted: the request waits
  assert.equal(api.requestOpenTrials('555', 1000), false);
  const late = [];
  const off3 = api.listenForTrialRequests({priority: 2, open: key => late.push(key)}, 1000 + 9000);
  assert.deepEqual(late, ['555'], 'an entry that mounts within ten seconds takes it');
  off3();
  assert.equal(api.requestOpenTrials('556', 1000), false);
  const tooLate = [];
  const off4 = api.listenForTrialRequests({priority: 2, open: key => tooLate.push(key)}, 1000 + 11000);
  assert.deepEqual(tooLate, [], 'too late: forgotten');
  off4();
});

test('consent popup: the question, the campaign name, two answers; the dimmed area and going back answer nothing', () => withReact(({host}) => {
  const answers = [];
  const tree = host.render(() => api.TrialConsentPopup({name: '집핏', onAnswer: a => answers.push(a)}));
  const all = texts(tree);
  assert.ok(all.includes('무료체험이 끝나기 전에 해지 안내를 받으시겠어요?'));
  assert.ok(all.includes('집핏'));
  assert.ok(all.includes('안내 받기') && all.includes('괜찮아요'));
  byLabel(tree, '안내 받기').props.onPress();
  byLabel(tree, '괜찮아요').props.onPress();
  byLabel(tree, '팝업 닫기').props.onPress();
  assert.deepEqual(answers, ['agree', 'decline', 'cancel']);
  const card = walk(tree).find(n => n.props && n.props.accessibilityViewIsModal === true);
  assert.ok(card, 'a modal card for screen readers');
}));

const screenProps = (extra = {}) => ({items: [], onClose() {}, onOpen() {}, onCancelled() {}, ...extra});
const items = () => api.parseMyTrials(body([
  serverRow(),
  serverRow({campaignKey: '2', name: '보리챗', status: '지금 해지 가능', cancelled: null, charge_amount: undefined}),
  serverRow({campaignKey: '3', name: '밀리의서재', status: '결제 시작됨', cancelled: true}),
  serverRow({campaignKey: '4', name: '왓챠', status: '지금 해지 가능', cancelled: false}),
]));

test('my list screen: a row per trial — name, date line, status; 해지했나요? only once the time has come; 해지 완료 when marked', () => withReact(({host}) => {
  const tree = host.render(() => api.ComboTrialsScreen(screenProps({items: items()})));
  const all = texts(tree);
  assert.ok(all.includes('무료체험 확인'), 'the title');
  for (const name of ['집핏', '보리챗', '밀리의서재', '왓챠']) assert.ok(all.includes(name), name);
  assert.ok(all.includes('10/27 참여 · 11/3 결제 예정 · 월 29,900원'));
  assert.ok(all.includes('체험 중') && all.includes('지금 해지 가능') && all.includes('결제 시작됨'));
  assert.ok(all.includes('10/30부터 해지할 수 있어요'), 'before the time: when it can be cancelled');
  assert.equal(all.filter(s => s === '해지했나요?').length, 1, 'only the 보리챗 row asks plainly');
  assert.equal(all.filter(s => s === '해지했나요? (아직이라고 하셨어요)').length, 1, 'the 왓챠 row asks again');
  assert.equal(all.filter(s => s === '해지 완료 ✓').length, 1, 'the 밀리의서재 row is done');
  assert.equal(all.filter(s => s === '했어요').length, 2);
  assert.equal(all.filter(s => s === '아직').length, 2);
  assert.equal(all.some(s => s.includes('아직 참여한 무료체험이 없어요')), false);
}));

test('my list screen: 했어요 / 아직 report the row and the answer; a row tap opens the campaign', () => withReact(({host}) => {
  const got = []; const opened = [];
  const list = items();
  const tree = host.render(() => api.ComboTrialsScreen(screenProps({items: list, onCancelled: (t, v) => got.push([t.campaignKey, v]), onOpen: t => opened.push(t.campaignKey)})));
  const yes = walk(tree).filter(n => n.type === 'Pressable' && n.props.accessibilityLabel === '했어요');
  const no = walk(tree).filter(n => n.type === 'Pressable' && n.props.accessibilityLabel === '아직');
  yes[0].props.onPress(); no[0].props.onPress(); yes[1].props.onPress();
  assert.deepEqual(got, [['2', true], ['2', false], ['4', true]]);
  walk(tree).find(n => n.type === 'Pressable' && n.props.accessibilityLabel.startsWith('집핏')).props.onPress();
  assert.deepEqual(opened, ['1781115240']);
}));

test('my list screen: the pushed campaign is first and highlighted (key case does not matter)', () => withReact(({host}) => {
  const tree = host.render(() => api.ComboTrialsScreen(screenProps({items: items(), focusKey: '4'})));
  const rows = walk(tree).filter(n => n.type === 'Pressable' && typeof n.props.accessibilityLabel === 'string' && /^(집핏|보리챗|밀리의서재|왓챠),/.test(n.props.accessibilityLabel));
  assert.deepEqual(rows.map(n => n.props.accessibilityLabel.split(',')[0]), ['왓챠', '집핏', '보리챗', '밀리의서재']);
  const style = rows[0].props.style({pressed: false});
  assert.equal(style.backgroundColor, api.DEFAULT_COMBO_THEME.accentSoft);
  assert.equal(rows[1].props.style({pressed: false}).backgroundColor, 'transparent');
}));

test('my list screen: loading, failed (with a retry) and empty each say so; close works', () => withReact(({host}) => {
  const loading = host.render(() => api.ComboTrialsScreen(screenProps({items: null, loading: true})));
  assert.ok(texts(loading).includes('불러오고 있어요'));
  let retried = 0; let closed = 0;
  const failed = host.render(() => api.ComboTrialsScreen(screenProps({items: null, failed: true, onRetry: () => { retried += 1; }, onClose: () => { closed += 1; }})));
  assert.ok(texts(failed).some(s => s.includes('목록을 불러오지 못했어요')));
  byLabel(failed, '다시 불러오기').props.onPress();
  byLabel(failed, '닫기').props.onPress();
  assert.deepEqual([retried, closed], [1, 1]);
  const empty = host.render(() => api.ComboTrialsScreen(screenProps({items: []})));
  assert.ok(texts(empty).some(s => s.includes('아직 참여한 무료체험이 없어요')));
}));
