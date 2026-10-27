const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, walk, byLabel, tick, hasSheet} = require('./harness.cjs');
const api = require('../dist');

const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const load = (display = {chance: 'chip', home: 'banner'}) => async () => ({ok: true, combos: api.normalizeTodayCombos({date: api.kstDate(), display, bundles: [{goal: 1000, missions: [mission('a', 1008)]}]})});
const memoryStore = (seed = {}) => { const m = new Map(Object.entries(seed)); return {m, getItem: async k => m.get(k) ?? null, setItem: async (k, v) => { m.set(k, v); }}; };

const mountEntry = async (make, props) => {
  const host = make();
  const mount = () => host.render(() => api.ComboEntry({load: load(), loadKey: 5, usn: 'a'.repeat(64), campaigns: null, ...props}));
  mount(); host.flush(); await tick(); mount(); host.flush(); await tick(); mount(); host.flush(); await tick(15);
  return {host, mount};
};
const chipWrapper = tree => walk(tree).find(n => n.type === 'Animated.View' && n.props.style && 'opacity' in n.props.style && n.props.style.bottom !== 0);

test('seen flag: only a value written for exactly today counts', () => {
  const today = '2026-10-27';
  assert.equal(api.parseSeen(JSON.stringify({d: today}), today), true);
  for (const bad of [null, undefined, '', 'x', '{}', JSON.stringify({d: '2026-10-26'}), JSON.stringify({d: 7}), '[]']) assert.equal(api.parseSeen(bad, today), false, String(bad));
  assert.equal(api.seenStorageKey(7), 'jcurve.combos.seen:7');
});

test('blink: an unseen chip fades 1 <-> 0.55 in 650 ms steps (a 1.3 s cycle) on the native driver', () => withReact(async ({make, rn}) => {
  api.resetSeenMemory();
  const {mount} = await mountEntry(make, {placement: 'chance', storage: memoryStore()});
  assert.equal(rn.__anim.running, 1, 'one loop is running');
  assert.deepEqual(rn.__anim.steps.map(s => [s.toValue, s.duration, s.useNativeDriver]), [[0.55, 650, true], [1, 650, true]]);
  const wrapper = chipWrapper(mount());
  assert.ok(wrapper, 'the chip sits in an Animated.View that carries the opacity');
}));

test('blink: the device asks to reduce motion -> the chip stays still', () => withReact(async ({make, rn}) => {
  api.resetSeenMemory();
  await mountEntry(make, {placement: 'chance', storage: memoryStore()});
  assert.equal(rn.__anim.running, 0);
  assert.equal(rn.__anim.loops, 0, 'never started');
}, {reduceMotion: true}));

test('blink: it also stops when the setting is switched on while the app is open, and does not start before it was read', () => withReact(async ({make, rn}) => {
  api.resetSeenMemory();
  const host = make();
  const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load: load(), loadKey: 5, usn: 'a'.repeat(64), campaigns: null, storage: memoryStore()}));
  mount(); host.flush();
  assert.equal(rn.__anim.loops, 0, 'still until the accessibility setting has been read');
  await tick(15);
  mount(); host.flush(); await tick(15); mount(); host.flush(); await tick(15); mount(); host.flush();
  assert.equal(rn.__anim.running, 1);
  for (const listener of rn.__reduce.listeners) listener(true);
  mount(); host.flush();
  assert.equal(rn.__anim.running, 0, 'switched to reduce motion: stopped');
}));

test('blink: opening the guide once stops it for the day and writes the day to the device', () => withReact(async ({make, rn}) => {
  api.resetSeenMemory();
  const storage = memoryStore();
  const {host, mount} = await mountEntry(make, {placement: 'chance', storage});
  assert.equal(rn.__anim.running, 1);
  byLabel(mount(), '포인트 빨리 모으기').props.onPress(); // open the sheet
  const open = mount(); host.flush();
  assert.equal(hasSheet(open), true);
  await tick(10);
  assert.equal(rn.__anim.running, 0, 'stopped as soon as it was opened');
  assert.deepEqual(JSON.parse(storage.m.get('jcurve.combos.seen:5')), {d: api.kstDate()});
  byLabel(mount(), '포인트 빨리 모으기').props.onPress(); // close again
  mount(); host.flush(); await tick(10);
  assert.equal(rn.__anim.running, 0, 'closing does not start it again');
}));

test('blink: already opened today (stored) -> no blink at all; a value from yesterday -> blinks again', () => withReact(async ({make, rn}) => {
  api.resetSeenMemory();
  await mountEntry(make, {placement: 'chance', storage: memoryStore({'jcurve.combos.seen:5': JSON.stringify({d: api.kstDate()})})});
  assert.equal(rn.__anim.loops, 0);
  api.resetSeenMemory();
  await mountEntry(make, {placement: 'chance', storage: memoryStore({'jcurve.combos.seen:5': JSON.stringify({d: '2000-01-01'})})});
  assert.equal(rn.__anim.running, 1, 'a new day starts blinking again');
}));

test('blink: each member has their own flag', () => withReact(async ({make, rn}) => {
  api.resetSeenMemory();
  const storage = memoryStore({'jcurve.combos.seen:other': JSON.stringify({d: api.kstDate()})});
  await mountEntry(make, {placement: 'chance', storage, loadKey: 5});
  assert.equal(rn.__anim.running, 1, 'another member having opened it does not stop this one');
}));

test('blink: without storage the flag lives in memory for the session, and the Home banner shares it with the chip', () => withReact(async ({make, rn}) => {
  api.resetSeenMemory();
  const chance = await mountEntry(make, {placement: 'chance'});
  const home = await mountEntry(make, {placement: 'home'});
  assert.equal(rn.__anim.running, 2, 'chip and banner both blink');
  byLabel(chance.mount(), '포인트 빨리 모으기').props.onPress(); // opened from the Chance tab
  chance.mount(); chance.host.flush();
  await tick(15);
  home.mount(); home.host.flush(); await tick(10);
  home.mount(); home.host.flush();
  assert.equal(rn.__anim.running, 0, 'the banner stopped too');
}));

test('blink: the banner on Home blinks the same way', () => withReact(async ({make, rn}) => {
  api.resetSeenMemory();
  const {mount} = await mountEntry(make, {placement: 'home', storage: memoryStore()});
  assert.equal(rn.__anim.running, 1);
  assert.ok(chipWrapper(mount()), 'the banner is wrapped in the animated opacity view');
}));

test('blink: nothing blinks while the chip is hidden (server off) or before there is data', () => withReact(async ({make, rn}) => {
  api.resetSeenMemory();
  await mountEntry(make, {placement: 'chance', load: load({chance: 'off', home: 'off'}), storage: memoryStore()});
  assert.equal(rn.__anim.loops, 0);
  const host = make();
  host.render(() => api.ComboEntry({placement: 'chance', load: () => new Promise(() => {}), loadKey: 5, storage: memoryStore()}));
  host.flush(); await tick(15);
  assert.equal(rn.__anim.loops, 0, 'no data yet: no chip, no blink');
}));

test('blink: a storage that fails never breaks the chip (it just keeps blinking until opened)', () => withReact(async ({make, rn}) => {
  api.resetSeenMemory();
  const broken = {getItem: async () => { throw new Error('io'); }, setItem: () => { throw new Error('io'); }};
  const {host, mount} = await mountEntry(make, {placement: 'chance', storage: broken});
  assert.equal(rn.__anim.running, 1);
  byLabel(mount(), '포인트 빨리 모으기').props.onPress();
  mount(); host.flush(); await tick(10);
  assert.equal(rn.__anim.running, 0, 'opened: stopped for this session even though it could not be saved');
}));

test('blink: usePulse rests at full opacity when it is not active', () => withReact(async ({make}) => {
  const host = make();
  const value = host.render(() => api.usePulse(false));
  host.flush(); await tick(10);
  assert.equal(value.v, 1);
}));
