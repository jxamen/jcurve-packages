const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, byLabel, tick, hasSheet} = require('./harness.cjs');
const api = require('../dist');

const TODAY = () => api.kstDate();
const mission = (id, points, extra = {}) => ({id, name: `일 ${id}`, points, todo: '하나 하기', level: 'easy', ...extra});
const bundle = goal => ({goal, missions: [mission(`b${goal}`, goal)]});
const dataOf = (extra = {}) => api.normalizeTodayCombos({
  date: TODAY(), bundles: [bundle(1000), bundle(5000), bundle(10000)],
  easy: {missions: [mission('e1', 102), mission('e2', 198), mission('e3', 300)]}, ...extra,
});
const memory = (seed = {}) => {
  const map = new Map(Object.entries(seed));
  return {map, getItem: async k => (map.has(k) ? map.get(k) : null), setItem: async (k, v) => { map.set(k, v); }};
};
// Records timers longer than 100 ms (the popup's delay) instead of running them; short ones still run.
const fakeLongTimers = () => {
  const real = global.setTimeout;
  const captured = [];
  global.setTimeout = (fn, ms, ...rest) => {
    if (ms > 100) { captured.push({fn, ms, cleared: false}); return captured[captured.length - 1]; }
    return real(fn, ms, ...rest);
  };
  const realClear = global.clearTimeout;
  global.clearTimeout = handle => { if (handle && typeof handle === 'object' && 'fn' in handle) handle.cleared = true; else realClear(handle); };
  return {
    captured,
    fire() { for (const t of captured.filter(x => !x.cleared && x.ms === api.COMBO_POPUP_DELAY_MS)) { t.cleared = true; t.fn(); } },
    restore() { global.setTimeout = real; global.clearTimeout = realClear; },
  };
};
const popupShown = tree => texts(tree).includes('추천 보기');

// A Chance-tab entry whose data and stored flags have been read.
const start = async (make, {data = dataOf(), storage = memory(), placement = 'chance', loadKey = 7} = {}) => {
  const host = make();
  const mount = () => host.render(() => api.ComboEntry({placement, load: async () => ({ok: true, combos: data}), loadKey, usn: 'a'.repeat(64), storage, campaigns: null}));
  mount(); host.flush(); await tick(15);
  mount(); host.flush(); await tick(15);
  return {host, mount, storage, again: () => { const tree = mount(); host.flush(); return tree; }};
};

test('popup: wall loaded -> after a short wait a recommendation popup shows with the server numbers; the chip stays', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const {again} = await start(make);
    assert.equal(popupShown(again()), false, 'not before the wall has loaded');
    api.notifyWallLoaded();
    assert.equal(popupShown(again()), false, 'and not at once');
    timers.fire();
    const tree = again();
    assert.equal(popupShown(tree), true);
    const all = texts(tree);
    assert.ok(all.includes('포인트 빨리 모으기'));
    assert.ok(all.includes('쉬운 미션 3개로 +600P'));
    assert.ok(all.includes('1천 · 5천 · 1만P 길 추천'));
    assert.ok(all.includes('닫기'));
    assert.ok(byLabel(tree, '포인트 빨리 모으기'), 'the header chip is still there');
    assert.equal(hasSheet(tree), false);
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('popup: 추천 보기 closes the popup and opens the guide sheet; the chip stays', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const {again} = await start(make);
    api.notifyWallLoaded(); again(); timers.fire();
    byLabel(again(), '추천 보기').props.onPress();
    const tree = again();
    assert.equal(popupShown(tree), false);
    assert.equal(hasSheet(tree), true);
    assert.ok(byLabel(tree, '포인트 빨리 모으기'));
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('popup: 닫기 (and the dimmed area) just close it; it does not come back that day, not even after the app is reopened', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const storage = memory();
    const first = await start(make, {storage});
    api.notifyWallLoaded(); first.again(); timers.fire();
    assert.equal(popupShown(first.again()), true);
    byLabel(first.again(), '닫기').props.onPress();
    assert.equal(popupShown(first.again()), false);
    assert.equal(hasSheet(first.again()), false);
    await tick(15);
    assert.ok([...storage.map.keys()].some(k => k.startsWith('jcurve.combos.popup:')), 'remembered on the device');
    // the tab is entered again / the app restarted: new entry, same device storage
    api.notifyWallGone();
    const second = await start(make, {storage});
    api.notifyWallLoaded(); second.again(); timers.fire();
    assert.equal(popupShown(second.again()), false);
    // the dimmed area closes it as well
    const other = await start(make, {storage: memory(), loadKey: 8});
    api.notifyWallGone(); api.notifyWallLoaded(); other.again(); timers.fire();
    assert.equal(popupShown(other.again()), true);
    byLabel(other.again(), '팝업 닫기').props.onPress();
    assert.equal(popupShown(other.again()), false);
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('popup: only for the member it was shown to (another member on the same device still gets it)', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const storage = memory();
    const a = await start(make, {storage, loadKey: 1});
    api.notifyWallLoaded(); a.again(); timers.fire(); a.again();
    api.notifyWallGone();
    const b = await start(make, {storage, loadKey: 2});
    api.notifyWallLoaded(); b.again(); timers.fire();
    assert.equal(popupShown(b.again()), true);
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('popup: leaving before the wait is over cancels it (wall gone)', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const {again} = await start(make);
    api.notifyWallLoaded(); again();
    api.notifyWallGone(); again();
    timers.fire();
    assert.equal(popupShown(again()), false);
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('popup: the server can switch it off (display.chance_popup = off); on or missing keeps it', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    assert.equal(dataOf().display.popup, undefined);
    assert.equal(api.normalizeTodayCombos({date: TODAY(), display: {chance_popup: 'on'}, bundles: [bundle(1000)]}).display.popup, undefined);
    const off = dataOf({display: {chance: 'chip', home: 'off', chance_popup: 'off'}});
    assert.equal(off.display.popup, 'off');
    const {again} = await start(make, {data: off});
    api.notifyWallLoaded(); again(); timers.fire();
    assert.equal(popupShown(again()), false);
    assert.ok(byLabel(again(), '포인트 빨리 모으기'), 'the chip is not affected');
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('popup: not on a day the guide was already opened (chip, main popup, push)', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const storage = memory({[api.seenStorageKey(7)]: JSON.stringify({d: TODAY()})});
    const {again} = await start(make, {storage});
    api.notifyWallLoaded(); again(); timers.fire();
    assert.equal(popupShown(again()), false);
    // yesterday's mark does not count
    const old = memory({[api.seenStorageKey(7)]: JSON.stringify({d: '2000-01-01'})});
    api.notifyWallGone();
    const fresh = await start(make, {storage: old});
    api.notifyWallLoaded(); fresh.again(); timers.fire();
    assert.equal(popupShown(fresh.again()), true);
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('main-popup path: a request to open the guide opens the sheet at once and the recommendation popup never shows that day', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const storage = memory();
    const {again} = await start(make, {storage});
    assert.equal(api.requestOpenCombos(), true); // what the app calls after goTab('offerwall') from a main popup / push
    assert.equal(hasSheet(again()), true, 'the sheet is open straight away');
    api.notifyWallLoaded(); again(); timers.fire();
    assert.equal(popupShown(again()), false, 'no second introduction');
    await tick(15);
    assert.ok([...storage.map.keys()].some(k => k.startsWith('jcurve.combos.popup:')), 'counted as shown today');
    // after closing the sheet it still does not come
    byLabel(again(), '닫기').props.onPress();
    again(); timers.fire();
    assert.equal(popupShown(again()), false);
    assert.equal(hasSheet(again()), false);
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('main-popup path: the request arriving BEFORE the entry exists (tab still switching) opens the sheet and suppresses the popup too', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    assert.equal(api.requestOpenCombos(), false, 'nobody mounted yet: it waits');
    const {again} = await start(make);
    assert.equal(hasSheet(again()), true);
    api.notifyWallLoaded(); again(); timers.fire();
    assert.equal(popupShown(again()), false);
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('popup: Home never shows it, and neither does an entry without data', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const home = await start(make, {placement: 'home', data: dataOf({display: {chance: 'chip', home: 'banner'}})});
    api.notifyWallLoaded(); home.again(); timers.fire();
    assert.equal(popupShown(home.again()), false);
    api.notifyWallGone();
    const host = make();
    const tree = host.render(() => api.ComboEntry({placement: 'chance', load: async () => ({ok: false}), loadKey: 9, storage: memory(), campaigns: null}));
    host.flush(); await tick(15);
    api.notifyWallLoaded(); timers.fire();
    assert.equal(popupShown(host.render(() => api.ComboEntry({placement: 'chance', load: async () => ({ok: false}), loadKey: 9, storage: memory(), campaigns: null}))), false);
    assert.equal(tree == null || !popupShown(tree), true);
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('popup text: easy missions and sum first, then the goal path; without easy it names the path; always one line at least', () => {
  assert.deepEqual(api.comboPopupLines(dataOf()), ['쉬운 미션 3개로 +600P', '1천 · 5천 · 1만P 길 추천']);
  const noEasy = api.normalizeTodayCombos({date: TODAY(), bundles: [bundle(1000), bundle(5000)]});
  assert.deepEqual(api.comboPopupLines(noEasy), ['1천 · 5천P 길을 차례로 모아 보세요']);
  const single = api.normalizeTodayCombos({date: TODAY(), bundles: [bundle(10000)], easy: {missions: [mission('e1', 1234)]}});
  assert.deepEqual(api.comboPopupLines(single), ['쉬운 미션 1개로 +1,234P', '1만P 길 추천']);
});

test('wall signal: loaded / gone reach listeners once per change; a throwing listener does not stop the others', () => {
  const seen = [];
  const off1 = api.onWallState(() => { throw new Error('bad'); });
  const off2 = api.onWallState(v => seen.push(v));
  api.notifyWallGone(); // already gone: no event
  api.notifyWallLoaded(); api.notifyWallLoaded(); api.notifyWallGone();
  assert.deepEqual(seen, [true, false]);
  assert.equal(api.isWallLoaded(), false);
  off1(); off2();
  api.notifyWallLoaded();
  assert.deepEqual(seen, [true, false], 'unsubscribed');
  api.notifyWallGone();
});

// ---- chance_popup: "always" (test accounts: every direct entry) ----
const alwaysData = () => dataOf({display: {chance: 'chip', home: 'off', chance_popup: 'always'}});

test('always: the server value is kept, survives a second normalizing, and unknown values mean the daily default', () => {
  assert.equal(alwaysData().display.popup, 'always');
  assert.equal(api.normalizeTodayCombos({date: TODAY(), ...alwaysData()}).display.popup, 'always', 'normalizing twice is the same');
  assert.equal(dataOf({display: {chance: 'chip', home: 'off', chance_popup: 'sometimes'}}).display.popup, undefined);
  assert.equal(dataOf({display: {chance: 'chip', home: 'off', chance_popup: 'off'}}).display.popup, 'off');
});

test('always: shows although the guide was opened today and the popup was already shown today', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const storage = memory({
      [api.seenStorageKey(7)]: JSON.stringify({d: TODAY()}),
      [api.popupStorageKey(7)]: JSON.stringify({d: TODAY()}),
    });
    const {again} = await start(make, {data: alwaysData(), storage});
    assert.equal(popupShown(again()), false, 'still waits for the wall');
    api.notifyWallLoaded(); again(); timers.fire();
    const tree = again();
    assert.equal(popupShown(tree), true);
    assert.ok(texts(tree).includes('쉬운 미션 3개로 +600P'));
    assert.ok(byLabel(tree, '포인트 빨리 모으기'), 'chip stays');
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('always: every new visit to the Chance tab gets it; within one visit it comes once, even if the wall reloads', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const storage = memory();
    const visit1 = await start(make, {data: alwaysData(), storage});
    api.notifyWallLoaded(); visit1.again(); timers.fire();
    assert.equal(popupShown(visit1.again()), true);
    byLabel(visit1.again(), '닫기').props.onPress();
    assert.equal(popupShown(visit1.again()), false);
    // the wall reloads inside the same visit (retry): no second popup
    api.notifyWallGone(); visit1.again(); api.notifyWallLoaded(); visit1.again(); timers.fire();
    assert.equal(popupShown(visit1.again()), false);
    // leaving and entering the tab again = a new entry: it shows again, same device storage
    api.notifyWallGone();
    const visit2 = await start(make, {data: alwaysData(), storage});
    api.notifyWallLoaded(); visit2.again(); timers.fire();
    assert.equal(popupShown(visit2.again()), true);
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('always: 추천 보기 still opens the sheet; a main-popup / push entry still gets the sheet with no popup', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const direct = await start(make, {data: alwaysData()});
    api.notifyWallLoaded(); direct.again(); timers.fire();
    byLabel(direct.again(), '추천 보기').props.onPress();
    assert.equal(hasSheet(direct.again()), true);
    api.notifyWallGone();
    const viaMain = await start(make, {data: alwaysData(), loadKey: 8});
    assert.equal(api.requestOpenCombos(), true);
    assert.equal(hasSheet(viaMain.again()), true);
    api.notifyWallLoaded(); viaMain.again(); timers.fire();
    assert.equal(popupShown(viaMain.again()), false, 'no popup on this path, even for test accounts');
  } finally { timers.restore(); api.notifyWallGone(); }
}));

test('always: Home and an entry without data still never show it; on / off / missing are unchanged', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const home = await start(make, {placement: 'home', data: dataOf({display: {chance: 'chip', home: 'banner', chance_popup: 'always'}})});
    api.notifyWallLoaded(); home.again(); timers.fire();
    assert.equal(popupShown(home.again()), false);
    api.notifyWallGone();
    // daily default still respects the stored mark
    const daily = await start(make, {data: dataOf({display: {chance: 'chip', home: 'off', chance_popup: 'on'}}), storage: memory({[api.popupStorageKey(7)]: JSON.stringify({d: TODAY()})})});
    api.notifyWallLoaded(); daily.again(); timers.fire();
    assert.equal(popupShown(daily.again()), false);
    api.notifyWallGone();
    // off still means never
    const off = await start(make, {data: dataOf({display: {chance: 'chip', home: 'off', chance_popup: 'off'}})});
    api.notifyWallLoaded(); off.again(); timers.fire();
    assert.equal(popupShown(off.again()), false);
  } finally { timers.restore(); api.notifyWallGone(); }
}));
