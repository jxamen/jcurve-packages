const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, walk, byLabel, tick} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const combos = () => api.normalizeTodayCombos({date: TODAY(), bundles: [{goal: 1000, missions: [{id: 'abc123def456', name: '일 1', points: 1008, todo: '하나 하기', level: 'easy', campaignKey: '352216486'}]}]});
const chipBox = tree => walk(tree).find(n => n.props && n.props.style && n.props.style.position === 'absolute' && n.props.style.zIndex === 30);
const sheetBox = tree => walk(tree).find(n => n.props && n.props.style && n.props.style.position === 'absolute' && n.props.style.zIndex === 25);

const start = async ({make}, extra = {}) => {
  const host = make();
  const load = async () => ({ok: true, combos: combos()});
  const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load, loadKey: 1, usn: 'a'.repeat(64), campaigns: {list: async () => [], open: async () => true}, ...extra}));
  mount(); host.flush(); await tick();
  mount(); host.flush();
  return {host, again: () => { host.flush(); return mount(); }};
};

test('tab inset: the chip row sits at its own top when there are no tabs, and moves down by the tab row height when the screen reports one', () => withReact(async (ctx) => {
  api.setChanceTabInset(0);
  const s = await start(ctx);
  assert.equal(chipBox(s.again()).props.style.top, 6, 'COMBO_CHIP_TOP without tabs');
  api.setChanceTabInset(45);
  assert.equal(chipBox(s.again()).props.style.top, 51, 'under the 45px tab row — back on the wall\'s header row');
  api.setChanceTabInset(0);
  assert.equal(chipBox(s.again()).props.style.top, 6, 'tabs gone: back');
}));

test('tab inset: a host-given chipTop is kept and the inset is added on top of it', () => withReact(async (ctx) => {
  api.setChanceTabInset(46);
  const s = await start(ctx, {chipTop: 10});
  assert.equal(chipBox(s.again()).props.style.top, 56);
  api.setChanceTabInset(0);
}));

test('tab inset: the guide sheet starts below the tab row too (it must not cover the tabs)', () => withReact(async (ctx) => {
  api.setChanceTabInset(45);
  const s = await start(ctx);
  assert.equal(api.requestOpenCombos(), true);
  const tree = s.again();
  assert.equal(sheetBox(tree).props.style.top, api.COMBO_SHEET_TOP + 45);
  assert.ok(byLabel(tree, '포인트 빨리 모으기'), 'the chip stays');
  api.setChanceTabInset(0);
}));

test('tab inset: non-numeric, negative or zero values mean "no tabs", and listeners hear only real changes', () => {
  const heard = [];
  const stop = api.onChanceTabInset(v => heard.push(v));
  api.setChanceTabInset(0); api.setChanceTabInset(45.4); api.setChanceTabInset(45); api.setChanceTabInset(-3); api.setChanceTabInset(NaN); api.setChanceTabInset(46);
  stop();
  api.setChanceTabInset(0);
  assert.deepEqual(heard, [45, 0, 46]);
  assert.equal(api.getChanceTabInset(), 0);
});
