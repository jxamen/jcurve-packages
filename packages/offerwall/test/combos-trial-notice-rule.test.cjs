const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, byLabel, tick} = require('./harness.cjs');
const api = require('../dist');

// 0.6.1 — display.trial_notice: the server chooses when the 「무료체험」 tab asks 「해지 알림 켜고 참여하기」.
const TODAY = () => api.kstDate();
const KEY = '1781115240';
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const combosOf = (display) => api.normalizeTodayCombos({
  date: TODAY(), ...(display === undefined ? {} : {display: {chance: 'chip', ...display}}),
  bundles: [{goal: 1000, missions: [mission('b1', 1000, {name: '일반 미션', campaignKey: '777'})]}],
  trials: [{campaignKey: KEY, name: '집핏', points: 1080, trial_days: 7, charge_amount: 29900}], trial_keys: [KEY],
});
const memoryStorage = (seed = {}) => { const m = new Map(Object.entries(seed)); return {map: m, getItem: async k => m.get(k) ?? null, setItem: async (k, v) => { m.set(k, v); }}; };
const AGREED = {'jcurve.combos.trialNotice:1': JSON.stringify({agreed: true})};
const DECLINED_TODAY = () => ({'jcurve.combos.trialNoticeNo:1': JSON.stringify({d: TODAY()})});

const start = async ({make}, {combos, storage}) => {
  const host = make();
  const bridge = {list: async () => [], open: async () => true};
  const mount = () => host.render(() => api.ComboEntry({
    placement: 'chance', load: async () => ({ok: true, combos}), loadKey: 1, usn: 'a'.repeat(64), campaigns: bridge, storage,
    onTrialConsent: () => {}, onTrialNotify: async () => 'on',
  }));
  mount(); host.flush(); await tick(20); mount(); host.flush(); await tick(20);
  const settle = async () => { for (let i = 0; i < 3; i += 1) { host.flush(); mount(); await tick(15); } host.flush(); return mount(); };
  assert.equal(api.requestOpenCombos(), true);
  await settle();
  // walk into the tab, and back out to the first tab so it can be entered again
  return {
    host, mount, settle, storage,
    enter: async () => { byLabel(mount(), '무료체험').props.onPress(); return settle(); },
    leave: async () => { byLabel(mount(), '1단계 1천P').props.onPress(); return settle(); },
  };
};
const asked = tree => texts(tree).includes(api.COMBO_CONSENT_TITLE);

test('the switch is read from display.trial_notice (and trialNotice, so normalizing twice is stable); anything else means "as before"', () => {
  assert.equal(combosOf({trial_notice: 'always'}).display.trialNotice, 'always');
  assert.equal(combosOf({trial_notice: 'daily'}).display.trialNotice, 'daily');
  for (const odd of ['sometimes', 1, null, '', 'ALWAYS']) assert.equal(combosOf({trial_notice: odd}).display.trialNotice, undefined);
  assert.equal(combosOf().display.trialNotice, undefined);
  const once = combosOf({trial_notice: 'daily'});
  assert.equal(api.normalizeTodayCombos(once).display.trialNotice, 'daily');
});

test('default (no switch): already pressed 「켜고 참여하기」 → never asked again; 「괜찮아요」 today → not asked today (0.3.13 rules unchanged)', () => withReact(async ctx => {
  const agreed = await start(ctx, {combos: combosOf(), storage: memoryStorage(AGREED)});
  assert.equal(asked(await agreed.enter()), false);
  const declined = await start(ctx, {combos: combosOf(), storage: memoryStorage(DECLINED_TODAY())});
  assert.equal(asked(await declined.enter()), false);
  const fresh = await start(ctx, {combos: combosOf(), storage: memoryStorage()});
  assert.equal(asked(await fresh.enter()), true);
}));

test('always: asked on every walk-in — even after 「켜고 참여하기」 on this device and after 「괜찮아요」 today', () => withReact(async ctx => {
  const s = await start(ctx, {combos: combosOf({trial_notice: 'always'}), storage: memoryStorage({...AGREED, ...DECLINED_TODAY()})});
  assert.equal(asked(await s.enter()), true, 'first walk-in');
  byLabel(s.mount(), '괜찮아요').props.onPress();
  assert.equal(asked(await s.settle()), false, 'closed');
  await s.leave();
  assert.equal(asked(await s.enter()), true, 'asked again on the next walk-in, the same day');
}));

test('daily: asked on the first walk-in of the day even after 「켜고 참여하기」 — and not again that day whatever the answer was; a new day asks again', () => withReact(async ctx => {
  const s = await start(ctx, {combos: combosOf({trial_notice: 'daily'}), storage: memoryStorage(AGREED)});
  assert.equal(asked(await s.enter()), true, 'first walk-in today');
  byLabel(s.mount(), '해지 알림 켜고 참여하기').props.onPress();
  await tick(30); await s.settle();
  await s.leave();
  assert.equal(asked(await s.enter()), false, 'answered today: not again today');
  const nextDay = await start(ctx, {combos: combosOf({trial_notice: 'daily'}), storage: memoryStorage({...AGREED, 'jcurve.combos.trialNoticeNo:1': JSON.stringify({d: '2000-01-01'})})});
  assert.equal(asked(await nextDay.enter()), true, 'a new day');
}));

test('daily with 「괜찮아요」: also once a day', () => withReact(async ctx => {
  const s = await start(ctx, {combos: combosOf({trial_notice: 'daily'}), storage: memoryStorage()});
  assert.equal(asked(await s.enter()), true);
  byLabel(s.mount(), '괜찮아요').props.onPress();
  await s.settle(); await s.leave();
  assert.equal(asked(await s.enter()), false);
}));

test('the rule only decides when the tab asks: a tap on a trial row still follows the saved 「켜고 참여하기」 (no extra question on the row)', () => withReact(async ctx => {
  const s = await start(ctx, {combos: combosOf({trial_notice: 'always'}), storage: memoryStorage(AGREED)});
  const tree = await s.enter();
  assert.equal(asked(tree), true);
  byLabel(s.mount(), '괜찮아요').props.onPress();
  const after = await s.settle();
  assert.equal(asked(after), false, 'no row-level question');
}));
