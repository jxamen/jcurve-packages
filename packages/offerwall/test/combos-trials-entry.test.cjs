const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel, tick} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const KEY = '352216486';
const trialRow = (key, extra = {}) => ({campaignKey: key, name: `체험 ${key}`, points: 1080, trial_days: 7, charge_amount: 29900, ...extra});
const combosOf = (over = {}) => api.normalizeTodayCombos({
  date: TODAY(),
  bundles: [{goal: 1000, missions: [mission('abc123def456', 1008, {name: '집핏 앱', campaignKey: KEY}), mission('def456abc123', 1100, {name: '토스 앱', campaignKey: '777'})]}],
  trial_keys: [KEY], ...over,
});
const serverRow = (over = {}) => ({
  campaignKey: '1781115240', name: '집핏', points: 1080, joined_at: '2026-10-27T22:32:24+09:00', joined_via: 'consent', agreed: true, trial_days: 7, charge_amount: 29900,
  cancel_from: '2026-10-30T22:32:24+09:00', charge_at: '2026-11-03T22:32:24+09:00', status: '지금 해지 가능', cancelled: null, ...over,
});

const start = async ({make, rn}, {combos = combosOf(), extra = {}, opened = []} = {}) => {
  const host = make();
  const bridge = {list: async () => [], open: async key => { opened.push(key); return true; }};
  const load = async () => ({ok: true, combos});
  const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load, loadKey: 1, usn: 'a'.repeat(64), campaigns: bridge, ...extra}));
  mount(); host.flush(); await tick();
  mount(); host.flush();
  return {
    host, again: () => { host.flush(); return mount(); },
    settle: async () => { for (let i = 0; i < 3; i += 1) { host.flush(); mount(); await tick(15); } host.flush(); return mount(); },
    openSheet: () => { assert.equal(api.requestOpenCombos(), true); return mount(); },
    tapFirst: async () => { const tree = mount(); byLabel(tree, '1번 ', true).props.onPress(); await tick(20); },
  };
};
const NATIVE = {nativeModules: {JCurveOfferwallModule: {}}};

test('consent: a trial campaign asks first (the question, both answers go on to the campaign), the answer is sent once; the others open at once', () => withReact(async ctx => {
  const opened = []; const sent = [];
  const s = await start(ctx, {opened, extra: {onTrialConsent: (key, agree) => { sent.push([key, agree]); }}});
  s.openSheet();
  await s.tapFirst();
  assert.deepEqual(opened, [], 'nothing opens before the answer');
  assert.ok(texts(s.again()).includes(api.COMBO_CONSENT_TITLE));
  byLabel(s.again(), '안내 받고 참여하기').props.onPress();
  await tick(20);
  assert.deepEqual(opened, [], 'the toast first: the campaign opens after a moment');
  assert.ok(texts(s.again()).includes('해지 알림을 맞춰 뒀어요'), 'the toast');
  await tick(api.COMBO_CONSENT_TOAST_MS + 100);
  assert.deepEqual(sent, [[KEY, true]]);
  assert.deepEqual(opened, [KEY], 'then the campaign opens');
  assert.equal(texts(s.again()).includes(api.COMBO_CONSENT_TITLE), false, 'the question is gone');
  // asked once: the same campaign again goes straight in
  await s.tapFirst();
  assert.deepEqual(opened, [KEY, KEY]);
  assert.equal(sent.length, 1);
  // a campaign that is not a trial never asks
  const tree = s.again();
  byLabel(tree, '2번 ', true).props.onPress();
  await tick(20);
  assert.deepEqual(opened, [KEY, KEY, '777']);
  assert.equal(sent.length, 1);
}, NATIVE));

test('consent: 안내 없이 참여하기 is sent as "no" and the campaign opens; dismissing answers nothing and does not open it (asked again next time)', () => withReact(async ctx => {
  const opened = []; const sent = [];
  const s = await start(ctx, {opened, extra: {onTrialConsent: (key, agree) => { sent.push([key, agree]); }}});
  s.openSheet();
  await s.tapFirst();
  byLabel(s.again(), '팝업 닫기').props.onPress();
  await tick(20);
  assert.deepEqual([opened, sent], [[], []], 'dismissed: no answer, no campaign');
  await s.tapFirst();
  assert.ok(texts(s.again()).includes('안내 받고 참여하기'), 'asked again');
  byLabel(s.again(), '안내 없이 참여하기').props.onPress();
  await tick(20);
  assert.equal(texts(s.again()).includes('해지 알림을 맞춰 뒀어요'), false, 'no toast for 안내 없이');
  assert.deepEqual(sent, [[KEY, false]]);
  assert.deepEqual(opened, [KEY]);
}, NATIVE));

test('consent: not asked when the server already has the answer, when the app gives no onTrialConsent, or when the sending fails (the campaign still opens)', () => withReact(async ctx => {
  const opened = []; const sent = [];
  const known = await start(ctx, {opened, combos: combosOf({trial_consent: {[KEY]: false}}), extra: {onTrialConsent: (k, a) => { sent.push([k, a]); }}});
  known.openSheet(); await known.tapFirst();
  assert.deepEqual(opened, [KEY]);
  assert.deepEqual(sent, []);
  const plain = [];
  const without = await start(ctx, {opened: plain});
  without.openSheet(); await without.tapFirst();
  assert.deepEqual(plain, [KEY], 'no prop: a trial opens like any other');
  const failing = [];
  for (const onTrialConsent of [() => { throw new Error('x'); }, async () => { throw new Error('y'); }]) {
    const s = await start(ctx, {opened: failing, extra: {onTrialConsent}});
    s.openSheet(); await s.tapFirst();
    byLabel(s.again(), '안내 받고 참여하기').props.onPress();
    await tick(api.COMBO_CONSENT_TOAST_MS + 100);
  }
  assert.deepEqual(failing, [KEY, KEY]);
}, NATIVE));

test('trial tab: a tap on a row of the 「무료체험」 tab asks, then opens that campaign', () => withReact(async ctx => {
  const opened = []; const sent = [];
  const combos = combosOf({trials: [trialRow('1781115240', {name: '집핏'})], trial_keys: ['1781115240']});
  const s = await start(ctx, {opened, combos, extra: {onTrialConsent: (key, agree) => { sent.push([key, agree]); }}});
  s.openSheet();
  byLabel(s.again(), '무료체험').props.onPress();
  byLabel(s.again(), '1번 집핏', true).props.onPress();
  await tick(20);
  assert.deepEqual(opened, []);
  assert.ok(texts(s.again()).includes('7일 무료 · 이후 월 29,900원'), 'the popup says the campaign\'s terms');
  byLabel(s.again(), '안내 받고 참여하기').props.onPress();
  await tick(api.COMBO_CONSENT_TOAST_MS + 100);
  assert.deepEqual(sent, [['1781115240', true]]);
  assert.deepEqual(opened, ['1781115240']);
}, NATIVE));

const loaded = rows => async () => ({ok: true, trials: rows, now: '2026-10-27T22:40:00+09:00'});

test('「무료체험 확인」: the button is there only when the app can load the list and the server turned trials on; it opens the member\'s list', () => withReact(async ctx => {
  const calls = [];
  const on = await start(ctx, {combos: combosOf({trials: [trialRow('1')]}), extra: {loadTrials: () => { calls.push('load'); return loaded([serverRow()])(); }}});
  const tree = on.again();
  assert.ok(byLabel(tree, '무료체험 확인'), 'the button');
  assert.ok(byLabel(tree, '포인트 빨리 모으기'), 'next to the chip');
  const off = await start(ctx, {combos: combosOf({trials: [trialRow('1')]})});
  assert.equal(walk(off.again()).some(n => n.props && n.props.accessibilityLabel === '무료체험 확인'), false, 'no loadTrials: no button');
  const nothing = await start(ctx, {combos: combosOf({trial_keys: undefined}), extra: {loadTrials: loaded([])}});
  assert.equal(walk(nothing.again()).some(n => n.props && n.props.accessibilityLabel === '무료체험 확인'), false, 'server has no trials: no button');
  assert.deepEqual(calls, []);
  byLabel(on.again(), '무료체험 확인').props.onPress();
  const list = await on.settle();
  assert.deepEqual(calls, ['load']);
  const all = texts(list);
  assert.ok(all.includes('집핏') && all.includes('지금 해지 가능'));
  assert.ok(all.includes('해지했나요?'));
}, NATIVE));

test('「무료체험 확인」: 했어요 shows 해지 완료 at once and is sent; a failed send loads the list again; 아직 is sent as false', () => withReact(async ctx => {
  const sent = []; let loads = 0; let failNext = false;
  const loadTrials = async () => { loads += 1; return {ok: true, trials: [serverRow(), serverRow({campaignKey: '2', name: '보리챗'})]}; };
  const onTrialCancelled = (key, value) => { sent.push([key, value]); if (failNext) return Promise.reject(new Error('down')); };
  const s = await start(ctx, {combos: combosOf({trials: [trialRow('1')]}), extra: {loadTrials, onTrialCancelled}});
  byLabel(s.again(), '무료체험 확인').props.onPress();
  await s.settle();
  assert.equal(loads, 1);
  const yes = walk(s.again()).filter(n => n.type === 'Pressable' && n.props.accessibilityLabel === '했어요');
  yes[0].props.onPress();
  const after = texts(s.again());
  assert.equal(after.filter(x => x === '해지 완료 ✓').length, 1, 'shown at once');
  assert.deepEqual(sent, [['1781115240', true]]);
  const no = walk(s.again()).filter(n => n.type === 'Pressable' && n.props.accessibilityLabel === '아직');
  failNext = true;
  no[0].props.onPress();
  await s.settle();
  assert.deepEqual(sent[1], ['2', false]);
  assert.equal(loads, 2, 'a failed send: the list is loaded again');
}, NATIVE));

test('「무료체험 확인」: a row opens its campaign (no consent question for what was joined already); a push request opens the list with that campaign first', () => withReact(async ctx => {
  const opened = []; const sent = [];
  const loadTrials = loaded([serverRow(), serverRow({campaignKey: '2', name: '보리챗', status: '체험 중'})]);
  const s = await start(ctx, {opened, combos: combosOf({trials: [trialRow('1')], trial_keys: ['1781115240']}), extra: {loadTrials, onTrialConsent: (k, a) => { sent.push([k, a]); }}});
  assert.equal(api.requestOpenTrials('2'), true, 'a push asks for the list');
  const shown = await s.settle();
  const rows = walk(shown).filter(n => n.type === 'Pressable' && typeof n.props.accessibilityLabel === 'string' && /^(집핏|보리챗),/.test(n.props.accessibilityLabel));
  assert.deepEqual(rows.map(n => n.props.accessibilityLabel.split(',')[0]), ['보리챗', '집핏'], 'the pushed campaign first');
  rows[1].props.onPress();
  await tick(20);
  assert.deepEqual(opened, ['1781115240'], 'a key of trial_keys, yet no question: it was joined already');
  assert.deepEqual(sent, []);
}, NATIVE));

test('「무료체험 확인」: the list can fail to load and be retried; a body of the wrong shape counts as a failure; closing works', () => withReact(async ctx => {
  let mode = 'fail'; let loads = 0;
  const loadTrials = async () => { loads += 1; if (mode === 'fail') throw new Error('network'); if (mode === 'shape') return {ok: true}; return {ok: true, trials: [serverRow()]}; };
  const s = await start(ctx, {combos: combosOf({trials: [trialRow('1')]}), extra: {loadTrials}});
  byLabel(s.again(), '무료체험 확인').props.onPress();
  assert.ok(texts(await s.settle()).some(x => x.includes('목록을 불러오지 못했어요')));
  mode = 'shape';
  byLabel(s.again(), '다시 불러오기').props.onPress();
  assert.ok(texts(await s.settle()).some(x => x.includes('목록을 불러오지 못했어요')), 'wrong shape = failed');
  mode = 'ok';
  byLabel(s.again(), '다시 불러오기').props.onPress();
  assert.ok(texts(await s.settle()).includes('집핏'));
  assert.equal(loads, 3);
  byLabel(s.again(), '닫기', true).props.onPress();
  assert.equal(texts(s.again()).includes('집핏'), false, 'closed');
}, NATIVE));

test('chip row: the two buttons share height, width, font size and rounding; sized to the room between the wall\'s title and the right edge — both shrink together; never touching the title', () => {
  const room = width => width - api.COMBO_CHIP_RIGHT - api.COMBO_TITLE_END - api.COMBO_TITLE_GAP;
  const widths = [360, 375, 390, 402, 411, 430, 480, 540];
  for (const width of widths) {
    const fit = api.comboChipFit(width, api.COMBO_CHIP_RIGHT);
    assert.ok(2 * fit.width + api.COMBO_CHIP_GAP <= room(width), `${width}: two equal buttons and the gap fit (${2 * fit.width + api.COMBO_CHIP_GAP} <= ${room(width)})`);
    assert.equal(fit.height, api.COMBO_CHIP_PAIR_HEIGHT);
    assert.ok(fit.size >= 10.5, `${width}: still readable`);
  }
  const sizes = widths.map(w => api.comboChipFit(w, api.COMBO_CHIP_RIGHT).size);
  assert.deepEqual(sizes, [...sizes].sort((a, b) => a - b), 'a wider phone never gets smaller words');
  assert.equal(api.comboChipFit(540, api.COMBO_CHIP_RIGHT).chipLabel, '포인트 빨리 모으기', 'a wide screen (tablet): the full name');
  for (const width of [402, 411]) assert.deepEqual([api.comboChipFit(width, api.COMBO_CHIP_RIGHT).chipLabel, api.comboChipFit(width, api.COMBO_CHIP_RIGHT).pillLabel], ['빨리 모으기', '무료체험'], `${width}`);
  assert.deepEqual([api.comboChipFit(360, api.COMBO_CHIP_RIGHT).chipLabel, api.comboChipFit(360, api.COMBO_CHIP_RIGHT).pillLabel], ['모으기', '체험'], '360: the short words');
  assert.equal(api.COMBO_CHIP_GAP, 8);
});

test('chip row: the button sits right beside the chip (8 apart), and the full names stay for screen readers even when the words are short', () => withReact(async ctx => {
  const s = await start(ctx, {combos: combosOf({trials: [trialRow('1')]}), extra: {loadTrials: loaded([])}});
  const tree = s.again();
  const row = walk(tree).find(n => n.type === 'View' && n.props.style && n.props.style.flexDirection === 'row' && n.props.style.position === 'absolute' && n.props.style.gap === 8);
  assert.ok(row, 'one row with an 8 point gap');
  const chip = byLabel(tree, '포인트 빨리 모으기');
  const pill = byLabel(tree, '무료체험 확인');
  assert.ok(chip && pill, 'both found by their full names');
  assert.deepEqual(texts(chip).filter(x => x !== '›' && x !== '✕'), ['빨리 모으기'], 'the harness phone is 400 wide: the short words');
  assert.deepEqual(texts(pill), ['무료체험']);
  const cs = chip.props.style({pressed: false}); const ps = pill.props.style({pressed: false});
  assert.deepEqual([cs.width, cs.height, cs.borderRadius], [ps.width, ps.height, ps.borderRadius], 'same width, height and rounding');
  const textSize = node => walk(node).find(n => n.type === 'Text').props.style.fontSize;
  assert.equal(textSize(chip), textSize(pill), 'same font size');
}, NATIVE));
