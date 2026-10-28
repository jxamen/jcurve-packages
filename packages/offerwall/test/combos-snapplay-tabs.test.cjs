// 0.6.2 — 「포인트 빨리 모으기」 per Chance tab: 찬스1 (AdPopcorn) keeps its list, 찬스2 (SnapPlay) has its own (GET offerwall/combos?source=snapplay), and a tap on a
// 찬스2 row opens that ad through the SDK (openAdItem) — or says it is closed, or falls back to the 찬스2 tab.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const {withReact, texts, byLabel, tick, hasSheet, walk} = require('./harness.cjs');
const api = require('../dist');

const USN = 'a'.repeat(64);
const TODAY = () => api.kstDate();
const mission = (id, extra = {}) => ({id, name: `미션 ${id}`, points: 1008, todo: '하나 하기', level: 'easy', ...extra});
const combosOf = (missions) => api.normalizeTodayCombos({date: TODAY(), bundles: [{goal: 1000, missions}]});
const adpopBody = () => ({ok: true, combos: combosOf([mission('abc123def456', {name: '애드팝콘 미션', campaignKey: '352216486'})])});
const snapBody = (keys) => ({ok: true, combos: combosOf(keys.map(k => mission(k, {name: `스냅 ${k}`, points: 600, campaignKey: k})))});

// One fake SDK for the whole file (the package keeps the module it first finds), steered through `env`.
const env = {};
let initCb;
const sdk = {
  onInitCompleted(cb) { initCb = cb; return {remove() {}}; },
  onLoginRequested() { return {remove() {}}; },
  async setAppIdForAndroid() {}, async setAppIdForIOS() {},
  async initSdk() { setTimeout(() => initCb({flag: true}), 0); },
  async setUserName() {}, async resetUserName() {}, async showOfferwall() {},
  async requestOfferwallData(placement, embedded) {
    env.lists.push([placement, embedded]);
    if (env.listThrows) throw new Error('boom');
    return env.listFails ? '{"ret_cd":10199}' : JSON.stringify({ret_cd: 0, ret_list: env.ads});
  },
  async openAdItem(id, detail, placement) { env.opened.push([id, detail, placement]); if (env.openThrows) throw new Error('boom'); },
};
const ad = (id, extra = {}) => ({adv_id: id, adv_title: `광고 ${id}`, adv_desc: '설명', user_pnt: 50, org_user_pnt: 50, pnt_unit: 'P', icon_img_url: 'https://x.example/i.png', detail_yn: 'N', adid_yn: 'N', adv_type: 331, actn_type: 3410, num_actions: 1, ...extra});

const run = (fn, {config = {listPlacement: 'list'}, ads = [ad(18547), ad(218047, {detail_yn: 'Y'})]} = {}) => withReact(async (ctx) => {
  const previous = Module._load;
  Module._load = function (id, ...rest) { return id === 'react-native-s2offerwall' ? {S2Offerwall: sdk} : previous.call(this, id, ...rest); };
  Object.assign(env, {lists: [], opened: [], ads, listFails: false, listThrows: false, openThrows: false});
  api.resetSnapPlay();
  api.setChanceTab('adpopcorn');
  api.configureSnapPlay({ok: true, config: {ios: {appId: 'IOS-APP-ID'}, android: {appId: 'AND-APP-ID'}, ...config}});
  try { return await fn(ctx); } finally { api.setChanceTab('adpopcorn'); api.resetSnapPlay(); Module._load = previous; }
}, {nativeModules: {S2OfferwallModule: {}}});

// A Chance-tab entry; settles the two loads.
const start = async ({make}, extra = {}, snapKeys = ['18547', '218047']) => {
  const host = make();
  const load = async () => adpopBody();
  const loadSnapPlay = snapKeys === null ? undefined : async () => (snapKeys === 'fail' ? Promise.reject(new Error('net')) : snapBody(snapKeys));
  const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load, loadSnapPlay, loadKey: 1, usn: USN, campaigns: {list: async () => [], open: async () => true}, ...extra}));
  mount(); host.flush(); await tick();
  mount(); host.flush(); await tick();
  mount(); host.flush();
  return {host, again: () => { host.flush(); return mount(); }};
};
const chip = (tree) => byLabel(tree, api.COMBO_NAME);
const openSheet = (s) => { assert.equal(api.requestOpenCombos(), true); return s.again(); };
// A tab pick reaches the entry on the next render, and the sheet / popup reset it runs belongs to that render: settle both before asking to open.
const switchTab = (s, id) => { api.setChanceTab(id); s.again(); return s.again(); };
const flat = (tree) => texts(tree).join('|');

/* ── the SDK list ─────────────────────────────────────────────────────────────────────────────── */

test('parseSnapPlayAds: the documented JSON becomes ads; a failed or malformed list is null, an empty list is []', () => {
  const body = JSON.stringify({ret_cd: 0, ret_list: [ad(18547), ad(218047, {detail_yn: 'Y', adid_yn: 'Y', user_pnt: 180, org_user_pnt: 360, feed_img_url: 'https://x.example/f.jpg'})]});
  const ads = api.parseSnapPlayAds(body);
  assert.equal(ads.length, 2);
  assert.deepEqual(ads[0], {advId: '18547', title: '광고 18547', description: '설명', points: 50, originalPoints: 50, unit: 'P', icon: 'https://x.example/i.png', feed: '', advType: 331, actionType: 3410, actions: 1, detail: false, needsAdid: false});
  assert.equal(ads[1].detail, true); assert.equal(ads[1].needsAdid, true); assert.equal(ads[1].points, 180); assert.equal(ads[1].originalPoints, 360); assert.equal(ads[1].feed, 'https://x.example/f.jpg');
  assert.deepEqual(api.parseSnapPlayAds({ret_cd: 0, ret_list: []}), []);
  for (const bad of [null, undefined, '', 'not json', 7, [], {}, {ret_cd: 10013, ret_list: []}, {ret_cd: 0}, {ret_cd: 0, ret_list: 'x'}, {ret_list: []}]) assert.equal(api.parseSnapPlayAds(bad), null, JSON.stringify(bad));
});

test('parseSnapPlayAds: bad rows are dropped, ids are unique, links must be https, text is cleaned, at most 500', () => {
  const ads = api.parseSnapPlayAds({ret_cd: '0', ret_list: [
    null, 5, {adv_id: 'x', adv_title: 'a'}, {adv_id: 0, adv_title: 'zero'}, {adv_id: 9, adv_title: ''},
    ad(10, {adv_title: ' 제목\n둘째줄 ', icon_img_url: 'http://insecure.example/i.png', user_pnt: -4, org_user_pnt: 'nan'}), ad(10, {adv_title: 'duplicate'}),
    ad('11', {user_pnt: '70'}),
  ]});
  assert.deepEqual(ads.map(a => a.advId), ['10', '11']);
  assert.equal(ads[0].title, '제목 둘째줄'); assert.equal(ads[0].icon, ''); assert.equal(ads[0].points, 0); assert.equal(ads[0].originalPoints, 0);
  assert.equal(ads[1].points, 70);
  const many = api.parseSnapPlayAds({ret_cd: 0, ret_list: Array.from({length: 700}, (_, i) => ad(i + 1))});
  assert.equal(many.length, 500);
});

test('config: listPlacement is read from the server, "main" and bad names are refused, and status says whether direct open is possible', () => run(async () => {
  assert.equal(api.parseSnapPlayConfig({ios: {appId: 'IOS-APP-ID'}, listPlacement: 'chance_list'}).listPlacement, 'chance_list');
  assert.equal(api.parseSnapPlayConfig({ios: {appId: 'IOS-APP-ID'}, list_placement: 'abc'}).listPlacement, 'abc');
  assert.equal(api.parseSnapPlayConfig({ios: {appId: 'IOS-APP-ID'}, listPlacement: 'main'}).listPlacement, '', 'the docs do not allow "main" for the list');
  assert.equal(api.parseSnapPlayConfig({ios: {appId: 'IOS-APP-ID'}, listPlacement: 'bad name!'}).listPlacement, '');
  assert.equal(api.parseSnapPlayConfig({ios: {appId: 'IOS-APP-ID'}}).listPlacement, '');
  assert.equal(api.snapPlayStatus().directOpen, true);
  api.configureSnapPlay({ok: true, config: {android: {appId: 'AND-APP-ID'}}});
  assert.equal(api.snapPlayStatus().directOpen, false, 'no list placement from the server: direct open is off');
}));

/* ── openSnapPlayAd (no screen) ───────────────────────────────────────────────────────────────── */

test('openSnapPlayAd: the ad is in the list — openAdItem(id, detail_yn == "Y", listPlacement); the whole list is asked for', () => run(async () => {
  assert.deepEqual(await api.openSnapPlayAd('18547', {usn: USN}), {ok: true, listCount: 2});
  assert.deepEqual(await api.openSnapPlayAd(218047, {usn: USN}), {ok: true, listCount: 2});
  assert.deepEqual(env.opened, [[18547, false, 'list'], [218047, true, 'list']]);
  assert.deepEqual(env.lists, [['list', false]], 'one list call for both (kept for a minute)');
}));

test('openSnapPlayAd: an ad that is not in a fresh list is closed — and it looks again once before saying so when the list was a kept one', () => run(async () => {
  await api.openSnapPlayAd('18547', {usn: USN});                 // fills the kept list
  const gone = await api.openSnapPlayAd('999999', {usn: USN});   // not in the kept list -> one fresh read -> still not there
  assert.deepEqual(gone, {ok: false, reason: 'gone', listCount: 2});
  assert.equal(env.lists.length, 2);
  assert.equal(env.opened.length, 1, 'a closed ad is never given to openAdItem');
  env.ads = [ad(18547), ad(999999)];                              // it appeared since
  assert.equal((await api.openSnapPlayAd('999999', {usn: USN})).ok, true);
}));

test('openSnapPlayAd: no list placement, no key, an old plugin or a failed list never reach openAdItem and say why', async () => {
  await run(async () => {
    assert.equal((await api.openSnapPlayAd('18547', {usn: USN})).reason, 'unsupported');
    assert.deepEqual(env.lists, []);
  }, {config: {}});
  await run(async () => {
    for (const key of ['', 'abc', '0', '12345678901234567890', -5, 1.5]) assert.equal((await api.openSnapPlayAd(key, {usn: USN})).reason, 'unsupported', String(key));
    env.listFails = true;
    assert.equal((await api.openSnapPlayAd('18547', {usn: USN})).reason, 'list_failed');
    env.listFails = false; api.resetSnapPlay(); api.configureSnapPlay({ok: true, config: {android: {appId: 'AND-APP-ID'}, listPlacement: 'list'}});
    env.listThrows = true;
    assert.equal((await api.openSnapPlayAd('18547', {usn: USN})).reason, 'list_failed', 'a throwing SDK call is a failed list, not a crash');
    env.listThrows = false; env.openThrows = true;
    assert.equal((await api.openSnapPlayAd('18547', {usn: USN})).reason, 'sdk_error');
    assert.equal((await api.openSnapPlayAd('18547', {usn: 'short'})).reason, 'invalid_usn');
    assert.equal(env.opened.length, 1);
  });
});

/* ── 「포인트 빨리 모으기」 per tab ──────────────────────────────────────────────────────────────── */

test('찬스1 is as before: the chip and the sheet show the AdPopcorn list, the SnapPlay list is not shown', () => run(async (ctx) => {
  const s = await start(ctx);
  assert.ok(chip(s.again()), 'chip on 찬스1');
  const sheet = flat(openSheet(s));
  assert.ok(sheet.includes('애드팝콘 미션'), sheet);
  assert.ok(!sheet.includes('스냅 18547'));
}));

test('찬스2 shows its own list in the same chip and sheet; a tap opens that ad through the SDK and the sheet stays for the next one', () => run(async (ctx) => {
  const diags = [];
  const s = await start(ctx, {onDiagnostic: d => diags.push(d)});
  assert.ok(chip(switchTab(s, 'snapplay')), 'chip on 찬스2');
  const tree = openSheet(s);
  const sheet = flat(tree);
  assert.ok(sheet.includes('스냅 18547') && sheet.includes('스냅 218047'), sheet);
  assert.ok(!sheet.includes('애드팝콘 미션'), 'the AdPopcorn list is never shown over SnapPlay');
  byLabel(tree, '2번 ', true).props.onPress();
  await tick(30);
  assert.deepEqual(env.opened, [[218047, true, 'list']]);
  assert.equal(diags.length, 1);
  assert.equal(diags[0].how, 'snapplay_id'); assert.equal(diags[0].key, '218047'); assert.equal(diags[0].open, true); assert.equal(diags[0].listCount, 2);
  assert.equal(hasSheet(s.again()), true, 'the sheet stays for the next ad');
}));

test('찬스2 with no rows from the server (empty, failed, or no loader at all): no chip on that tab, and 찬스1 still has its chip', () => run(async (ctx) => {
  for (const keys of [[], 'fail', null]) {
    const s = await start(ctx, {}, keys);
    assert.ok(chip(s.again()), 'chip on 찬스1');
    api.setChanceTab('snapplay');
    assert.equal(chip(s.again()), undefined, `no chip on 찬스2 for ${JSON.stringify(keys)}`);
    api.setChanceTab('adpopcorn');
    assert.ok(chip(s.again()), 'back on 찬스1 the chip is back');
  }
}));

test('a build without SnapPlay has no 찬스2 and nothing changes: the chip follows the AdPopcorn list whatever the tab signal says', () => withReact(async (ctx) => {
  api.resetSnapPlay(); api.setChanceTab('snapplay');
  try {
    const s = await start(ctx);
    assert.ok(chip(s.again()));
    assert.ok(flat(openSheet(s)).includes('애드팝콘 미션'));
  } finally { api.setChanceTab('adpopcorn'); }
}));

test('a closed ad (not in the SDK list): the member is told, the server gets an open_failed hint, the sheet stays open', () => run(async (ctx) => {
  const signals = [];
  const s = await start(ctx, {onDetailSignal: x => signals.push(x)}, ['18547', '777777']);
  switchTab(s, 'snapplay');
  assert.equal(api.requestOpenCombos(), true);
  const tree = s.again();
  byLabel(tree, '2번 ', true).props.onPress();
  await tick(30);
  assert.deepEqual(env.opened, []);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].result, 'open_failed'); assert.equal(signals[0].campaignKey, '777777'); assert.equal(signals[0].platform, 'android');
  const after = s.again();
  assert.ok(flat(after).includes('"스냅 777777" 는 마감됐어요'), flat(after));
  assert.equal(hasSheet(after), true);
}, {ads: [ad(18547)]}));

test('direct open not possible (no list placement): the plain fallback — the name is copied, the member is told, the sheet closes onto the 찬스2 tab', () => run(async (ctx) => {
  const copied = []; const diags = [];
  const s = await start(ctx, {copyText: text => { copied.push(text); return true; }, onDiagnostic: d => diags.push(d)});
  switchTab(s, 'snapplay');
  assert.equal(api.requestOpenCombos(), true);
  byLabel(s.again(), '1번 ', true).props.onPress();
  await tick(30);
  assert.deepEqual(copied, ['스냅 18547']);
  assert.deepEqual(env.opened, []);
  const after = s.again();
  assert.ok(flat(after).includes('"스냅 18547" 를 찾아 주세요'), flat(after));
  assert.equal(hasSheet(after), false);
  assert.equal(diags[0].how, 'snapplay_id'); assert.equal(diags[0].open, false);
}, {config: {}}));

test('picking another tab while the sheet is open closes it (it belongs to the tab it opened on); a request that waited for the entry still opens it', () => run(async (ctx) => {
  const s = await start(ctx);
  assert.equal(hasSheet(openSheet(s)), true);
  api.setChanceTab('snapplay');
  s.again(); // the tab signal reaches the entry
  assert.equal(hasSheet(s.again()), false, 'closed on the tab change');
  assert.equal(api.requestOpenCombos(), true);
  const sheet = flat(s.again());
  assert.ok(sheet.includes('스냅 18547'), 'and opens again on the new tab with the new list');
}));

test('the SnapPlay ad list is handed to the app (once per read) when it asks, so it can be sent to the server and its points compared with the SDK screen', () => run(async (ctx) => {
  const got = [];
  const s = await start(ctx, {onSnapPlayAds: ads => got.push(ads)});
  await tick(30);
  s.again(); await tick(10);
  assert.equal(got.length, 1);
  assert.deepEqual(got[0].map(a => [a.advId, a.points, a.originalPoints]), [['18547', 50, 50], ['218047', 50, 50]]);
  assert.deepEqual(env.lists, [['list', false]]);
}));

test('without onSnapPlayAds the phone never reads the SnapPlay list on its own', () => run(async (ctx) => {
  const s = await start(ctx);
  await tick(30); s.again();
  assert.deepEqual(env.lists, []);
}));

test('the done marks are kept apart per tab: a tick on a 찬스2 row is stored under the 찬스2 scope, not on 찬스1', () => run(async (ctx) => {
  const store = new Map();
  const storage = {getItem: async k => store.get(k) ?? null, setItem: async (k, v) => { store.set(k, v); }};
  const s = await start(ctx, {storage});
  switchTab(s, 'snapplay');
  assert.equal(api.requestOpenCombos(), true);
  const tree = s.again();
  const box = walk(tree).find(n => n.type === 'Pressable' && n.props.accessibilityLabel === '스냅 18547 완료 표시');
  assert.ok(box, 'the tick box of the first 찬스2 row');
  box.props.onPress();
  await tick(20);
  assert.deepEqual([...store.keys()].filter(k => k.includes('done')), ['jcurve.combos.done:1:snapplay']);
  switchTab(s, 'adpopcorn');
  assert.equal(api.requestOpenCombos(), true);
  const back = walk(s.again()).find(n => n.type === 'Pressable' && n.props.accessibilityLabel === '애드팝콘 미션 완료 표시');
  assert.equal(back.props.accessibilityState.checked, false, '찬스1 row is not ticked');
}));
