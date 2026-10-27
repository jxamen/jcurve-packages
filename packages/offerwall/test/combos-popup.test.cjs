const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, texts, walk, byLabel, tick, hasSheet} = require('./harness.cjs');
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
const api_el = type => ({type, props: {}, children: []});

// A Chance-tab entry whose data and stored flags have been read.
const start = async (make, {data = dataOf(), storage = memory(), placement = 'chance', loadKey = 7, entry = {}} = {}) => {
  const host = make();
  const mount = () => host.render(() => api.ComboEntry({placement, load: async () => ({ok: true, combos: data}), loadKey, usn: 'a'.repeat(64), storage, campaigns: null, ...entry}));
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
    assert.equal(all.join('').includes('오늘 +600P\n모을 수 있어요'), true, 'big-number headline from the server sum');
    assert.ok(all.includes('쉬운 미션 3개'));
    assert.ok(all.includes('선착순 · 캠페인마다 인원이 차면 끝나요'), 'the first-come notice');
    assert.equal(all.includes('닫기'), false, 'no 닫기 text any more');
    assert.ok(all.includes('✕') && byLabel(tree, '닫기'), 'the ✕ closes (screen readers still hear 닫기)');
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

test('popup content: the easy sum is the big number; the subtitle counts the missions and says how long one takes (middle of the given minutes)', () => {
  assert.deepEqual(api.comboPopupContent(dataOf()), {before: '오늘 ', amount: '+600P', after: ' 모을 수 있어요', sub: '쉬운 미션 3개', notice: '선착순 · 캠페인마다 인원이 차면 끝나요'});
  const timed = (...mins) => api.normalizeTodayCombos({date: TODAY(), bundles: [bundle(1000)], easy: {missions: mins.map((m, i) => mission(`t${i}`, 100 + i, m ? {minutes: m} : {}))}});
  assert.equal(api.comboPopupContent(timed(3, 3, 5, 3)).sub, '쉬운 미션 4개 · 하나에 3분이면 끝');
  assert.equal(api.comboPopupContent(timed(5, 3, 10)).sub, '쉬운 미션 3개 · 하나에 5분이면 끝', 'the middle one, not the shortest');
  assert.equal(api.comboPopupContent(timed(0, 4)).sub, '쉬운 미션 2개 · 하나에 4분이면 끝', 'missions without minutes are skipped');
  assert.equal(api.comboPopupContent(timed(0, 0)).sub, '쉬운 미션 2개');
});

test('popup content: without an easy list the top goal is the number and the path is the subtitle', () => {
  const noEasy = api.normalizeTodayCombos({date: TODAY(), bundles: [bundle(1000), bundle(5000), bundle(10000)]});
  assert.deepEqual(api.comboPopupContent(noEasy), {before: '오늘 ', amount: '1만P', after: '까지 모을 수 있어요', sub: '1천 · 5천 · 1만P 길을 차례로 모아 보세요', notice: api.COMBO_POPUP_NOTICE});
  const one = api.normalizeTodayCombos({date: TODAY(), bundles: [bundle(1000)]});
  assert.equal(api.comboPopupContent(one).amount, '1천P');
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
    assert.equal(texts(tree).join('').includes('+600P'), true);
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

// ---- popup design: big picture, big number, wide button, small 닫기 link, darker backdrop ----
const popupTree = async (make, entry = {}, rnSetup) => {
  const timers = fakeLongTimers();
  try {
    const {again} = await start(make, {entry});
    api.notifyWallLoaded(); again(); timers.fire();
    return again();
  } finally { timers.restore(); api.notifyWallGone(); }
};

test('popup design: a headline with the sum as a big number, one subtitle line, a first-come pill, ONE wide button, a ✕ at the top right (no 닫기 link), over a darker backdrop', () => withReact(async ({make}) => {
  const tree = await popupTree(make);
  const header = walk(tree).find(n => n.type === 'Text' && n.props.accessibilityRole === 'header');
  assert.ok(header, 'the headline is a header');
  assert.equal(texts(header).join(''), '오늘 +600P\n모을 수 있어요', 'two lines on purpose: the number, then the rest');
  const amount = walk(header).find(n => n.type === 'Text' && n.children[0] === '+600P');
  assert.ok(amount.props.style.fontSize >= 30, 'the number is big');
  assert.ok(amount.props.style.fontSize > header.props.style.fontSize * 1.5, 'much bigger than the words around it');
  assert.equal(header.props.style.fontSize, 20);
  assert.ok(texts(tree).includes('쉬운 미션 3개'), 'one subtitle line');
  const open = byLabel(tree, '추천 보기');
  const openStyle = open.props.style({pressed: false});
  assert.equal(openStyle.alignSelf, 'stretch', 'wide button');
  assert.equal(openStyle.height, 52);
  assert.equal(openStyle.backgroundColor, api.DEFAULT_COMBO_THEME.accent, 'accent colour');
  const close = byLabel(tree, '닫기');
  assert.deepEqual(texts(close), ['✕']);
  const closeStyle = close.props.style;
  assert.deepEqual([closeStyle.position, closeStyle.top, closeStyle.right], ['absolute', 10, 10], 'top right of the card');
  assert.ok(closeStyle.width >= 32 && closeStyle.height >= 32, 'a finger-sized target');
  assert.equal(texts(tree).includes('닫기'), false, 'no 닫기 text link');
  const pill = walk(tree).find(n => n.type === 'View' && texts(n).join('') === '선착순 · 캠페인마다 인원이 차면 끝나요' && n.props.style && n.props.style.backgroundColor === api.DEFAULT_COMBO_THEME.accentSoft);
  assert.ok(pill, 'a pill under the subtitle');
  const scrim = byLabel(tree, '팝업 닫기');
  assert.equal(scrim.props.style.backgroundColor, 'rgba(0,0,0,0.55)', 'darker than before (0.4)');
}));

test('popup design: it scales in (an animated card with scale + opacity), and the card carries the picture block on top', () => withReact(async ({make}) => {
  const tree = await popupTree(make);
  const card = walk(tree).find(n => n.type === 'Animated.View' && n.props.accessibilityViewIsModal === true);
  assert.ok(card, 'animated card');
  assert.ok(card.props.style.transform && card.props.style.transform[0] && 'scale' in card.props.style.transform[0], 'scale');
  assert.ok('opacity' in card.props.style);
  assert.equal(card.props.style.borderRadius, 24);
  assert.equal(card.props.style.maxWidth, 320);
  const picture = walk(card).find(n => n.type === 'View' && n.props.style && n.props.style.height === 132);
  assert.ok(picture, 'picture block on top of the text');
  assert.equal(picture.props.style.backgroundColor, api.DEFAULT_COMBO_THEME.accentSoft);
}));

test('popup design: without art a coin is drawn from plain views (a P); with the app\'s art the picture is that image, three times (main + two small)', () => withReact(async ({make, rn}) => {
  rn.Image = 'Image';
  const plain = await popupTree(make);
  assert.equal(walk(plain).some(n => n.type === 'Image'), false);
  assert.ok(texts(plain).includes('P'), 'the drawn coin');
  const art = {uri: 'coin.png'};
  const withArt = await popupTree(make, {popupArt: art});
  const images = walk(withArt).filter(n => n.type === 'Image');
  assert.equal(images.length, 3);
  assert.ok(images.every(n => n.props.source === art));
  assert.deepEqual(images.map(n => n.props.style.width).sort((a, b) => b - a), [96, 40, 40], 'one big, two small');
  assert.equal(texts(withArt).includes('P'), false, 'no drawn coin when the art is given');
}));

test('popup ad: the app\'s ad is drawn under the 추천 보기 button, after the button and inside the scrolling card; none given = nothing there', () => withReact(async ({make, rn}) => {
  rn.Image = 'Image';
  const withAd = await popupTree(make, {popupAd: () => api_el('AppAd')});
  const nodes = walk(withAd);
  const button = nodes.find(n => n.type === 'Pressable' && n.props.accessibilityLabel === '추천 보기');
  const ad = nodes.find(n => n.type === 'AppAd');
  assert.ok(ad, 'the ad is in the popup');
  assert.ok(nodes.indexOf(ad) > nodes.indexOf(button), 'under the button');
  const scroller = nodes.find(n => n.type === 'ScrollView');
  assert.ok(walk(scroller).includes(ad) && walk(scroller).includes(button), 'inside the scrolling content');
  assert.equal(walk(scroller).some(n => n.props && n.props.accessibilityLabel === '닫기'), false, 'the ✕ is outside the scroller so it stays put');
  const without = await popupTree(make);
  assert.equal(walk(without).some(n => n.type === 'AppAd'), false);
}));

test('popup ad: an ad that renders nothing (null) leaves no extra element; the card is capped to the screen height so a tall ad scrolls', () => withReact(async ({make}) => {
  const tree = await popupTree(make, {popupAd: () => null});
  const card = walk(tree).find(n => n.type === 'Animated.View' && n.props.accessibilityViewIsModal === true);
  assert.equal(card.props.style.maxHeight, Math.round(800 * 0.86), 'the harness screen is 800 high: 86 % of it');
  const scroller = walk(card).find(n => n.type === 'ScrollView');
  assert.equal(scroller.props.bounces, false);
  assert.equal(scroller.props.showsVerticalScrollIndicator, false);
}));

test('popup ✕: tapping it closes the popup (and the dimmed area too); the sheet does not open', () => withReact(async ({make}) => {
  const timers = fakeLongTimers();
  try {
    const {again} = await start(make);
    api.notifyWallLoaded(); again(); timers.fire();
    assert.equal(popupShown(again()), true);
    byLabel(again(), '닫기').props.onPress();
    assert.equal(popupShown(again()), false);
    assert.equal(hasSheet(again()), false);
  } finally { timers.restore(); api.notifyWallGone(); }
}));
