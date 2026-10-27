const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel, tick} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const KEY = '1781115240';
const OTHER = '777';
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const trial = (key, name) => ({campaignKey: key, name, points: 1080, trial_days: 7, charge_amount: 29900});
const item = (key, name, points, extra = {}) => ({campaignKey: key, name, points, line: '가입하기', done: false, cost: null, ...extra});
// the steps screen with a 무료체험 tab, and the category screen with a trial category
const stepsCombos = (over = {}) => api.normalizeTodayCombos({
  date: TODAY(),
  bundles: [{goal: 1000, missions: [mission('b1', 1000, {name: '일반 미션', campaignKey: OTHER})]}],
  trials: [trial(KEY, '집핏')], trial_keys: [KEY], ...over,
});
const catCombos = () => stepsCombos({categories: [
  {key: 'signup', title: '회원가입', total_points: 100, count: 1, items: [item('11', '알바천국', 100)]},
  {key: 'trial', title: '무료체험', total_points: null, count: 1, items: [item(KEY, '집핏', 1080, {line: '무료체험 신청하기', cost: '체험 뒤 월 29,900원', trial_days: 7, charge_amount: 29900})]},
]});
const NATIVE = {nativeModules: {JCurveOfferwallModule: {}}};
const memoryStorage = (seed = {}) => { const m = new Map(Object.entries(seed)); return {map: m, getItem: async k => m.get(k) ?? null, setItem: async (k, v) => { m.set(k, v); }}; };

// One Chance-tab entry; `events` records what the app was asked to do, in order.
const start = async ({make}, {combos = stepsCombos(), storage = memoryStorage(), extra = () => ({}), consent = true} = {}) => {
  const host = make();
  const events = [];
  const bridge = {list: async () => [], open: async key => { events.push(['open', key]); return true; }};
  const mount = () => host.render(() => api.ComboEntry({
    placement: 'chance', load: async () => ({ok: true, combos}), loadKey: 1, usn: 'a'.repeat(64), campaigns: bridge, storage,
    ...(consent ? {onTrialConsent: (key, agree) => { events.push(['consent', key, agree]); }} : {}), ...extra(events),
  }));
  mount(); host.flush(); await tick(20); mount(); host.flush(); await tick(20);
  const settle = async () => { for (let i = 0; i < 3; i += 1) { host.flush(); mount(); await tick(15); } host.flush(); return mount(); };
  assert.equal(api.requestOpenCombos(), true);
  await settle();
  return {events, host, mount, settle, storage, enterTab: async label => { byLabel(mount(), label).props.onPress(); return settle(); }};
};
const asked = tree => texts(tree).includes(api.COMBO_CONSENT_TITLE);

test('tab popup: walking into the 무료체험 tab asks once (the whole tab, not a row): the title, the body, the tab line and two buttons', () => withReact(async ctx => {
  const s = await start(ctx);
  assert.equal(asked(await s.settle()), false, 'not before the tab is entered');
  const tree = await s.enterTab('무료체험');
  assert.equal(asked(tree), true);
  const all = texts(tree);
  assert.ok(all.includes(api.COMBO_CONSENT_BODY));
  assert.ok(all.includes('여기 있는 체험은 끝나면 자동 결제돼요.\n끝나기 전에 해지 알림을 보내 드려요.'), 'the line for the tab, instead of one campaign');
  assert.ok(all.includes('해지 알림 켜고 참여하기') && all.includes('괜찮아요'));
  assert.equal(api.COMBO_CONSENT_AGREE, '해지 알림 켜고 참여하기');
}, NATIVE));

test('tab popup: the same on the category screen\'s 무료체험 tab; other tabs never ask', () => withReact(async ctx => {
  const s = await start(ctx, {combos: catCombos()});
  assert.equal(asked(await s.settle()), false, 'the first tab (회원가입): no question');
  assert.equal(asked(await s.enterTab('무료체험')), true, 'the trial category: the question');
}, NATIVE));

test('tab popup: 해지 알림 켜고 참여하기 — the app sees to the phone\'s notifications, the choice is kept, a toast says how it went; nothing is saved for any campaign yet', () => withReact(async ctx => {
  const storage = memoryStorage();
  const s = await start(ctx, {storage, extra: events => ({onTrialNotify: async () => { events.push(['notify']); return 'on'; }})});
  await s.enterTab('무료체험');
  byLabel(s.mount(), '해지 알림 켜고 참여하기').props.onPress();
  const after = await s.settle();
  assert.deepEqual(s.events, [['notify']], 'the notifications were seen to once; no consent is sent yet');
  assert.equal(asked(after), false, 'the popup is gone');
  assert.ok(texts(after).includes('해지 알림을 맞춰 뒀어요'), 'the toast');
  assert.ok([...storage.map.values()].some(v => v.includes('"agreed":true')), 'kept on the device');
  // walking out and in again: no second question
  await s.enterTab('1단계 1천P');
  assert.equal(asked(await s.enterTab('무료체험')), false, 'the choice is known');
}, NATIVE));

test('tab popup: notifications that stayed off (or cannot be asked) change only the toast', () => withReact(async ctx => {
  for (const result of ['off', 'none']) {
    const s = await start(ctx, {extra: () => ({onTrialNotify: async () => result})});
    await s.enterTab('무료체험');
    byLabel(s.mount(), '해지 알림 켜고 참여하기').props.onPress();
    const after = await s.settle();
    assert.ok(texts(after).includes('알림이 꺼져 있어 안내를 못 받아요'), `${result}: the off toast`);
    assert.equal(texts(after).includes('해지 알림을 맞춰 뒀어요'), false);
  }
  const failing = await start(ctx, {extra: () => ({onTrialNotify: async () => { throw new Error('boom'); }})});
  await failing.enterTab('무료체험');
  byLabel(failing.mount(), '해지 알림 켜고 참여하기').props.onPress();
  assert.ok(texts(await failing.settle()).includes('알림이 꺼져 있어 안내를 못 받아요'), 'a failing check counts as "cannot ask"');
}, NATIVE));

test('after 해지 알림 켜고 참여하기: tapping a trial row saves that campaign\'s consent by itself and opens it at once, with no question; other rows are untouched', () => withReact(async ctx => {
  const s = await start(ctx, {extra: () => ({onTrialNotify: async () => 'on'})});
  await s.enterTab('무료체험');
  byLabel(s.mount(), '해지 알림 켜고 참여하기').props.onPress();
  await s.settle();
  byLabel(s.mount(), '1번 집핏', true).props.onPress();
  await tick(30);
  assert.deepEqual(s.events, [['consent', KEY, true], ['open', KEY]], 'consent agree=true, then the campaign');
  assert.equal(asked(await s.settle()), false);
  // a second tap: the answer is known, not sent again
  byLabel(s.mount(), '1번 집핏', true).props.onPress();
  await tick(30);
  assert.deepEqual(s.events.slice(2), [['open', KEY]]);
}, NATIVE));

test('without that choice a tap on a trial row asks nothing and saves nothing — it just opens the campaign', () => withReact(async ctx => {
  const s = await start(ctx);
  await s.enterTab('무료체험');
  byLabel(s.mount(), '괜찮아요').props.onPress();
  await s.settle();
  byLabel(s.mount(), '1번 집핏', true).props.onPress();
  await tick(30);
  assert.deepEqual(s.events, [['open', KEY]], 'no consent, no popup');
  assert.equal(asked(await s.settle()), false);
}, NATIVE));

test('괜찮아요 (and the dimmed area) mean not again today: kept for the day, and a new day asks again', () => withReact(async ctx => {
  const storage = memoryStorage();
  const s = await start(ctx, {storage});
  await s.enterTab('무료체험');
  byLabel(s.mount(), '괜찮아요').props.onPress();
  assert.equal(asked(await s.settle()), false);
  assert.ok([...storage.map.entries()].some(([k, v]) => k.includes('trialNoticeNo') && v.includes(TODAY())), 'declined today is kept');
  await s.enterTab('1단계 1천P');
  assert.equal(asked(await s.enterTab('무료체험')), false, 'the same day: not again');
  // the dimmed area is the same as 괜찮아요
  const other = await start(ctx, {storage: memoryStorage()});
  await other.enterTab('무료체험');
  byLabel(other.mount(), '팝업 닫기').props.onPress();
  assert.equal(asked(await other.settle()), false);
  // another day (a stored "no" from yesterday) asks again
  const nextDay = await start(ctx, {storage: memoryStorage({'jcurve.combos.trialNoticeNo:1': JSON.stringify({d: '2000-01-01'})})});
  assert.equal(asked(await nextDay.enterTab('무료체험')), true);
}, NATIVE));

test('the choice survives a restart (same storage): after 해지 알림 켜고 참여하기 the tab does not ask again', () => withReact(async ctx => {
  const storage = memoryStorage();
  const first = await start(ctx, {storage, extra: () => ({onTrialNotify: async () => 'on'})});
  await first.enterTab('무료체험');
  byLabel(first.mount(), '해지 알림 켜고 참여하기').props.onPress();
  await first.settle();
  const second = await start(ctx, {storage});
  assert.equal(asked(await second.enterTab('무료체험')), false, 'a new launch remembers it');
  byLabel(second.mount(), '1번 집핏', true).props.onPress();
  await tick(30);
  assert.deepEqual(second.events, [['consent', KEY, true], ['open', KEY]], 'and a tap saves the consent by itself');
}, NATIVE));

test('no question without onTrialConsent, and the button for the member\'s own list never asks', () => withReact(async ctx => {
  const plain = await start(ctx, {consent: false});
  assert.equal(asked(await plain.enterTab('무료체험')), false, 'the app does not do consent: nothing is asked');
  const mine = await start(ctx, {extra: () => ({loadTrials: async () => ({ok: true, trials: []})})});
  byLabel(mine.mount(), '무료체험 확인').props.onPress();
  assert.equal(asked(await mine.settle()), false, '「무료체험」 button (my list): no popup');
}, NATIVE));
