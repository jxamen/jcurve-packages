// 0.4.0: the glue that used to live in each app — request client, bodies, push routes, notification question, upload throttle, and <OfferwallCombos>.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, walk, tick} = require('./harness.cjs');
const api = require('../dist');

// ---- request client ----
const fakeFetch = (answers = []) => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({url, ...init});
    const next = answers.length > 1 ? answers.shift() : answers[0];
    if (next instanceof Error) throw next;
    return {ok: next.ok !== false, status: next.status || 200, json: async () => next.body};
  };
  return {fetcher, calls};
};

test('client: joins the address and path, sends the app\'s headers (fresh each time), JSON body only on POST', async () => {
  const {fetcher, calls} = fakeFetch([{body: {ok: true}}]);
  let n = 0;
  const client = api.createOfferwallClient({serverUrl: 'https://api.example.com/v1/myapp//', getAuthHeaders: async () => ({'X-App-Token': 'pub', Authorization: 'Bearer t' + (++n), 'Bad Name': 'x', Evil: 'a\r\nb'}), fetcher});
  assert.deepEqual(await client.get('offerwall/combos'), {ok: true});
  await client.post('offerwall/trials/consent', {campaignKey: 'k', agree: true});
  assert.equal(calls[0].url, 'https://api.example.com/v1/myapp/offerwall/combos');
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].body, undefined);
  assert.deepEqual(calls[0].headers, {Accept: 'application/json', 'X-App-Token': 'pub', Authorization: 'Bearer t1'});
  assert.equal(calls[1].method, 'POST');
  assert.equal(calls[1].headers['Content-Type'], 'application/json');
  assert.equal(calls[1].headers.Authorization, 'Bearer t2', 'headers are asked for on every request');
  assert.equal(calls[1].body, JSON.stringify({campaignKey: 'k', agree: true}));
});

test('client: a 401 tells the app (so it can drop the session) and still fails; other statuses do not', async () => {
  let told = 0;
  const unauthorized = api.createOfferwallClient({serverUrl: 'https://a.example.com', onUnauthorized: () => { told += 1; }, fetcher: fakeFetch([{ok: false, status: 401, body: {error: 'unauthorized'}}]).fetcher});
  await assert.rejects(unauthorized.get('offerwall/combos'), e => e.status === 401);
  assert.equal(told, 1);
  const missing = api.createOfferwallClient({serverUrl: 'https://a.example.com', onUnauthorized: () => { told += 1; }, fetcher: fakeFetch([{ok: false, status: 404, body: {}}]).fetcher});
  await assert.rejects(missing.get('offerwall/combos'));
  assert.equal(told, 1);
  const throwing = api.createOfferwallClient({serverUrl: 'https://a.example.com', onUnauthorized: () => { throw new Error('app bug'); }, fetcher: fakeFetch([{ok: false, status: 401, body: {}}]).fetcher});
  await assert.rejects(throwing.get('offerwall/combos'), e => e.status === 401, 'a throwing handler does not change the failure');
});

test('client: no or odd server address, odd paths, http errors and network failures are all refused with a status', async () => {
  const {fetcher, calls} = fakeFetch([{ok: false, status: 404, body: {error: 'no_combos'}}]);
  for (const serverUrl of ['', 'ftp://x.example.com', 'javascript:alert(1)', undefined]) {
    await assert.rejects(api.createOfferwallClient({serverUrl, fetcher}).get('offerwall/combos'), e => e.message === 'no_server' && e.status === 0);
  }
  const client = api.createOfferwallClient({serverUrl: 'https://a.example.com', fetcher});
  for (const path of ['../x', 'offerwall//x', '/offerwall', 'a b', 'offerwall/x?y=1']) await assert.rejects(client.get(path), e => e.message === 'bad_path');
  assert.equal(calls.length, 0, 'nothing was sent for a refused path');
  await assert.rejects(client.get('offerwall/combos'), e => e.status === 404 && e.message === 'no_combos');
  const down = api.createOfferwallClient({serverUrl: 'https://a.example.com', fetcher: fakeFetch([new Error('offline')]).fetcher});
  await assert.rejects(down.get('offerwall/combos'), e => e.status === 0 && e.message === 'network');
  const slow = api.createOfferwallClient({serverUrl: 'https://a.example.com', timeoutMs: 20, fetcher: () => new Promise(() => {})});
  await assert.rejects(slow.get('offerwall/combos'), e => e.message === 'timeout');
});

// ---- bodies ----
test('campaignsBody: the server\'s caps — 600 rows, key 128, name 255, whole reward; info <= 1500; icon only https <= 300; rows without key or name are dropped', () => {
  const body = api.campaignsBody([
    {campaignKey: 'k'.repeat(200), name: 'n'.repeat(300), reward: '1,234.6원'},
    {campaignKey: 'a', name: 'A', reward: '-5'},
    {campaignKey: '', name: 'no key'},
    {campaignKey: 'b', name: 'B', reward: 700, description: 'd'.repeat(2000), icon: 'https://cdn.example.com/i.png'},
    {campaignKey: 'c', name: 'C', reward: 1, info: 'detail text', description: 'ignored when info is there', icon: 'http://insecure/i.png'},
    {campaignKey: 'd', name: 'D', reward: 1, icon: 'https://cdn.example.com/' + 'x'.repeat(300)},
  ]);
  assert.equal(body.campaigns.length, 5);
  assert.equal(body.campaigns[0].campaignKey.length, 128);
  assert.equal(body.campaigns[0].name.length, 255);
  assert.equal(body.campaigns[0].reward, 1235);
  assert.equal(body.campaigns[1].reward, 5, 'the sign is not a reward');
  assert.equal(body.campaigns[2].info.length, 1500);
  assert.equal(body.campaigns[2].icon, 'https://cdn.example.com/i.png');
  assert.deepEqual(body.campaigns[3], {campaignKey: 'c', name: 'C', reward: 1, info: 'detail text'});
  assert.equal('icon' in body.campaigns[4], false, 'a long icon address is left out');
  assert.equal(api.campaignsBody(Array.from({length: 700}, (_, i) => ({campaignKey: 'k' + i, name: 'n'}))).campaigns.length, 600);
});

test('diagBody / detailSignalBody: fixed fields only, cut to length, nothing about the member or device', () => {
  const body = api.diagBody({t: 'tap', mission: 'm'.repeat(100), name: 'n'.repeat(200), bridge: true, listCount: 7.4, how: 'weird', attempts: -3, open: 'error', ms: 1e9,
    listError: 'e'.repeat(200), listSample: ['a', 'b', 'c', 'd', 'e', 'f'], key: 'k', openError: 'x', openMs: 5, copied: true, usn: 'SECRET', ifa: 'SECRET'});
  assert.equal(body.mission.length, 64);
  assert.equal(body.name.length, 100);
  assert.equal(body.how, 'none');
  assert.equal(body.attempts, 0);
  assert.equal(body.listCount, 7);
  assert.equal(body.ms, 1_000_000);
  assert.equal(body.open, 'error');
  assert.equal(body.listSample.length, 5);
  assert.equal(JSON.stringify(body).includes('SECRET'), false);
  assert.deepEqual(api.detailSignalBody({result: 'closed_fast', campaignKey: '123', platform: 'ios', ms: 4000.2, usn: 'SECRET'}), {result: 'closed_fast', campaignKey: '123', platform: 'ios', ms: 4000});
  assert.deepEqual(api.detailSignalBody({result: 'nonsense', campaignKey: 7, platform: 'web', ms: 'x'}), {result: 'open_failed', campaignKey: '7', platform: 'android', ms: 0});
});

test('always-popup guard: only the "always" value is changed, on a copy', () => {
  const body = {ok: true, combos: {display: {chance: 'chip', chance_popup: 'always'}, bundles: []}};
  assert.equal(api.hasAlwaysPopup(body), true);
  const copy = api.dropAlwaysPopup(body);
  assert.equal(copy.combos.display.chance_popup, 'on');
  assert.equal(copy.combos.display.chance, 'chip');
  assert.equal(body.combos.display.chance_popup, 'always', 'the original is untouched');
  const plain = {combos: {display: {chance_popup: 'off'}}};
  assert.equal(api.dropAlwaysPopup(plain), plain);
  assert.equal(api.hasAlwaysPopup(null), false);
});

test('list_tap switch: only the explicit "on" counts; any other value or place is off', () => {
  assert.equal(api.listTapSwitch({combos: {display: {list_tap: 'on'}}}), true);
  assert.equal(api.listTapSwitch({data: {display: {list_tap: 'on'}}}), true);
  assert.equal(api.listTapSwitch({display: {list_tap: 'on'}}), true);
  for (const bad of [null, {}, {combos: {}}, {combos: {display: {}}}, {combos: {display: {list_tap: 'off'}}}, {combos: {display: {list_tap: true}}}, {combos: {display: {list_tap: 'ON'}}}, 'on']) {
    assert.equal(api.listTapSwitch(bad), false, JSON.stringify(bad));
  }
});

// ---- push routes ----
test('push routes: trials and combos routes, the old trial_ kinds, and the campaign key', () => {
  assert.equal(api.comboPushTarget({go: 'offerwall/trials', campaignKey: 'abc'}), 'trials');
  assert.equal(api.comboPushTarget({go: '/offerwall/trials?from=push'}), 'trials');
  assert.equal(api.comboPushTarget({go: 'myapp://offerwall/trials'}), 'trials');
  assert.equal(api.comboPushTarget({go: 'offerwall/combos'}), 'combos');
  assert.equal(api.comboPushTarget({go: 'offerwall/combos', kind: 'trial_before_charge'}), 'trials');
  assert.equal(api.comboPushTarget({go: 'wallet'}), null);
  assert.equal(api.comboPushTarget(null), null);
  assert.equal(api.isTrialsRoute('offerwall/trials/'), true);
  assert.equal(api.isTrialsRoute('offerwall/trialsx'), false);
  assert.equal(api.isTrialsRoute(5), false);
  assert.equal(api.pushCampaignKey({campaignKey: ' 123 '}), '123');
  assert.equal(api.pushCampaignKey({campaignKey: 456}), '456');
  assert.equal(api.pushCampaignKey({campaignKey: 'x'.repeat(65)}), undefined);
  assert.equal(api.pushCampaignKey({}), undefined);
});

// ---- the documents ----
test('list_tap: parsed into display.listTap; a document with only the switch is kept with the chip off (never an empty chip)', () => {
  const rows = api.normalizeTodayCombos({date: api.kstDate(), display: {chance: 'chip', list_tap: 'on'}, bundles: [{goal: 100, missions: [{id: 'a', name: 'A', points: 100, todo: 't'}]}]});
  assert.equal(rows.display.listTap, 'on');
  assert.equal(rows.display.chance, 'chip');
  const only = api.normalizeTodayCombos({display: {chance: 'off', home: 'off', chance_popup: 'off', list_tap: 'on'}});
  assert.deepEqual(only.display, {chance: 'off', home: 'off', listTap: 'on'});
  assert.deepEqual(only.bundles, []);
  const noChance = api.normalizeTodayCombos({display: {list_tap: 'on'}});
  assert.equal(noChance.display.chance, 'off', 'a switch-only document never turns the chip on');
  assert.equal(api.normalizeTodayCombos({display: {list_tap: 'off'}}), null);
  assert.equal(api.normalizeTodayCombos({display: {chance: 'chip'}}), null);
  const empty = api.normalizeTodayCombos({date: api.kstDate(), display: {chance: 'off', home: 'off', chance_popup: 'off', list_tap: 'on'}, bundles: [], categories: [], preparing: true});
  assert.equal(empty.display.listTap, 'on');
  assert.equal(empty.display.chance, 'off');
  assert.equal(api.hasComboRows(empty), false);
});

test('guardedBody: a document that does not say display.chance keeps the chip off; an explicit chip/off is left alone', () => {
  const doc = {date: api.kstDate(), bundles: []};
  assert.equal(api.guardedBody({ok: true, combos: doc}).combos.display.chance, 'off');
  assert.equal(api.guardedBody({ok: true, combos: {...doc, display: {home: 'banner'}}}).combos.display.home, 'banner');
  assert.equal(api.guardedBody({combos: {...doc, display: {chance: 'bogus'}}}).combos.display.chance, 'off');
  const flat = api.guardedBody(doc);
  assert.equal(flat.display.chance, 'off');
  assert.equal(doc.display, undefined, 'the original is untouched');
  const chip = {combos: {...doc, display: {chance: 'chip'}}};
  assert.equal(api.guardedBody(chip), chip);
  assert.equal(api.guardedBody(null), null);
});

// ---- the notification question ----
const depsOf = (states, extra = {}) => {
  const log = [];
  const queue = [...states];
  return {log, deps: {
    state: async () => queue.length > 1 ? queue.shift() : queue[0],
    ask: async () => { log.push('ask'); return queue.shift() ?? 'off'; },
    confirmSettings: async () => { log.push('confirm'); return extra.confirm !== false; },
    openSettings: async () => { log.push('settings'); },
    backFromSettings: async () => { log.push('back'); },
    syncToken: async () => { log.push('sync'); },
    ...(extra.deps || {}),
  }};
};

test('ensureTrialNotify: on → token sent; not asked yet → asks first; refused → settings and a new check; "later" → off; no module → none', async () => {
  const on = depsOf(['on']);
  assert.equal(await api.ensureTrialNotify(on.deps), 'on');
  assert.deepEqual(on.log, ['sync']);
  const ask = depsOf(['ask', 'on']);
  assert.equal(await api.ensureTrialNotify(ask.deps), 'on');
  assert.deepEqual(ask.log, ['ask', 'sync']);
  const refused = depsOf(['off', 'on']);
  assert.equal(await api.ensureTrialNotify(refused.deps), 'on');
  assert.deepEqual(refused.log, ['confirm', 'settings', 'back', 'sync']);
  const still = depsOf(['off']);
  assert.equal(await api.ensureTrialNotify(still.deps), 'off');
  const later = depsOf(['off'], {confirm: false});
  assert.equal(await api.ensureTrialNotify(later.deps), 'off');
  assert.deepEqual(later.log, ['confirm'], 'nothing else is done when the member says later');
  assert.equal(await api.ensureTrialNotify(depsOf(['none']).deps), 'none');
  assert.equal(await api.ensureTrialNotify(depsOf(['on'], {deps: {syncToken: async () => { throw new Error('x'); }}}).deps), 'none');
});

test('default notification deps: no expo-notifications → "none" and no prompt; hooks run in order and a failing hook does not stop the ask', async () => {
  await withReact(async () => {
    assert.equal(await api.notifyState(), 'none');
    assert.equal(await api.ensureTrialNotify(api.defaultTrialNotifyDeps()), 'none');
  });
  const Module = require('node:module');
  const original = Module._load;
  const calls = [];
  let granted = false;
  Module._load = function (id, ...rest) {
    if (id === 'expo-notifications') return {getPermissionsAsync: async () => ({granted, canAskAgain: true}), requestPermissionsAsync: async () => { calls.push('request'); granted = true; return {}; }};
    return original.call(this, id, ...rest);
  };
  try {
    const result = await withReact(() => api.ensureTrialNotify(api.defaultTrialNotifyDeps({
      beforeAsk: () => { calls.push('before'); },
      syncToken: async () => { calls.push('sync'); },
    })));
    assert.equal(result, 'on');
    assert.deepEqual(calls, ['before', 'request', 'sync']);
  } finally { Module._load = original; }
});

// ---- the upload throttle ----
const campaignOf = (n, extra = {}) => ({campaignKey: 'k' + n, name: 'N' + n, reward: n, ...extra});
const clock = () => {
  const c = {t: Date.UTC(2026, 9, 28, 3, 0, 0), timers: []};
  c.now = () => c.t;
  c.setTimer = (fn, ms) => { const timer = {fn, at: c.t + ms}; c.timers.push(timer); return timer; };
  c.clearTimer = timer => { c.timers = c.timers.filter(x => x !== timer); };
  c.advance = async ms => {
    const end = c.t + ms;
    for (;;) {
      const due = c.timers.filter(x => x.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      c.timers = c.timers.filter(x => x !== due);
      c.t = Math.max(c.t, due.at);
      due.fn();
      await tick(1);
    }
    c.t = end;
  };
  return c;
};
const memoryStorage = () => { const m = new Map(); return {m, getItem: async k => m.get(k) ?? null, setItem: async (k, v) => { m.set(k, v); }}; };

test('tap upload: a burst of lists is one upload after the quiet time; the same list the same day is not sent again; a changed list is, but never more often than the gap', async () => {
  const c = clock(); const storage = memoryStorage(); const sent = [];
  const up = api.createTapUploader({upload: async body => { sent.push(body); }, storage, scope: 7, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer});
  const list = n => ({type: 'list', campaigns: Array.from({length: n}, (_, i) => campaignOf(i + 1))});
  up.handle(list(3)); up.handle(list(3)); up.handle(list(3));
  assert.equal(c.timers.length, 1, 'one timer for the burst');
  await c.advance(7000); assert.equal(sent.length, 0, 'not before the quiet time');
  await c.advance(2000); assert.equal(sent.length, 1);
  assert.equal(sent[0].campaigns.length, 3);
  up.handle(list(3));
  await c.advance(60 * 60_000); assert.equal(sent.length, 1, 'same list, same day → not again');
  up.handle(list(4));
  await c.advance(9000); assert.equal(sent.length, 2, 'changed list → sent');
  up.handle(list(5));
  await c.advance(9000); assert.equal(sent.length, 2, 'not within ten minutes of the last upload');
  await c.advance(10 * 60_000); assert.equal(sent.length, 3);
  // the next Korean day: the same list is sent once more
  await c.advance(20 * 3600_000);
  up.handle(list(5));
  await c.advance(9000); assert.equal(sent.length, 4);
  up.stop();
});

test('tap upload: the record survives a restart (same list, same day → nothing), detail text is merged into the next upload and never causes one alone', async () => {
  const c = clock(); const storage = memoryStorage(); const sent = [];
  const make = () => api.createTapUploader({upload: async body => { sent.push(body); }, storage, scope: 'm', now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer});
  const first = make();
  first.handle({type: 'detail', campaign: campaignOf(1, {info: 'early text'})});
  assert.equal(c.timers.length, 0, 'a detail alone starts nothing');
  first.handle({type: 'list', campaigns: [campaignOf(1), campaignOf(2)]});
  await c.advance(9000);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].campaigns[0].info, 'early text');
  assert.equal('info' in sent[0].campaigns[1], false);
  first.stop();
  const second = make();
  second.handle({type: 'list', campaigns: [campaignOf(1), campaignOf(2)]});
  second.handle({type: 'detail', campaign: campaignOf(1, {info: 'early text'})});
  await c.advance(11 * 60_000);
  assert.equal(sent.length, 1, 'after a restart the same list is not sent again the same day');
  second.stop();
});

test('tap upload: a failing upload is tried again later, three times at most; stop() cancels what is waiting; an empty list sends nothing', async () => {
  const c = clock(); let tries = 0;
  const up = api.createTapUploader({upload: async () => { tries += 1; throw new Error('down'); }, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer});
  up.handle({type: 'list', campaigns: []});
  assert.equal(c.timers.length, 0);
  up.handle({type: 'list', campaigns: [campaignOf(1)]});
  await c.advance(9000); assert.equal(tries, 1);
  await c.advance(11 * 60_000); assert.equal(tries, 2);
  await c.advance(11 * 60_000); assert.equal(tries, 3);
  await c.advance(60 * 60_000); assert.equal(tries, 3, 'gives up after three');
  const other = api.createTapUploader({upload: async () => { tries += 1; }, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer});
  other.handle({type: 'list', campaigns: [campaignOf(1)]});
  other.stop();
  await c.advance(60_000); assert.equal(tries, 3, 'stopped before the timer');
});

// ---- the handlers <OfferwallCombos> hands to the entry ----
const DOC = (display, extra = {}) => ({ok: true, combos: {date: api.kstDate(), display, bundles: [{goal: 100, missions: [{id: 'a1', name: '앱 하나', points: 100, todo: '하나 하기', level: 'easy', campaignKey: '123456'}]}], ...extra}});
const stubClient = (handlers) => {
  const log = [];
  return {log, client: {
    get: async path => { log.push(['GET', path]); const h = handlers[path]; if (h === undefined) throw Object.assign(new Error('no_combos'), {status: 404}); if (h instanceof Error) throw h; return typeof h === 'function' ? h() : h; },
    post: async (path, body) => { log.push(['POST', path, body]); return {ok: true}; },
  }};
};
const handlersFor = (client, extra = {}) => api.createComboHandlers({client: () => client, memberId: () => 42, ...extra});
const posts = log => log.filter(l => l[0] === 'POST');

test('handlers.load: the chip stays off unless the server said so; "always" survives only for test members (asked once, only when the answer carries it)', async () => {
  let asked = 0;
  const {client} = stubClient({'offerwall/combos': DOC({chance: 'chip', chance_popup: 'always'})});
  const tester = handlersFor(client, {askTestMember: async () => { asked += 1; return true; }});
  assert.equal((await tester.load()).combos.display.chance_popup, 'always');
  await tester.load();
  assert.equal(asked, 1, 'asked once per member');
  const ordinary = handlersFor(client, {askTestMember: async () => false});
  assert.equal((await ordinary.load()).combos.display.chance_popup, 'on');
  const nobody = handlersFor(client);
  assert.equal((await nobody.load()).combos.display.chance_popup, 'on', 'no way to be a test member without the app\'s answer');
  let plain = 0;
  const {client: chipOnly} = stubClient({'offerwall/combos': DOC({chance: 'chip'})});
  await handlersFor(chipOnly, {askTestMember: async () => { plain += 1; return true; }}).load();
  assert.equal(plain, 0, 'a plain answer never asks');
  const {client: bare} = stubClient({'offerwall/combos': DOC(undefined)});
  assert.equal((await handlersFor(bare).load()).combos.display.chance, 'off');
});

test('handlers: an unknown test-member answer (null / error) counts as "no" this time and is asked again next time', async () => {
  let asked = 0; const answers = [null, true];
  const {client} = stubClient({'offerwall/combos': DOC({chance: 'chip', chance_popup: 'always'})});
  const handlers = handlersFor(client, {askTestMember: async () => { asked += 1; return answers.shift(); }});
  assert.equal((await handlers.load()).combos.display.chance_popup, 'on', 'unknown → treated as no');
  assert.equal((await handlers.load()).combos.display.chance_popup, 'always', 'asked again, now a test member');
  await handlers.load();
  assert.equal(asked, 2, 'a real answer is kept');
  const failing = handlersFor(client, {askTestMember: async () => { throw new Error('config down'); }});
  assert.equal((await failing.load()).combos.display.chance_popup, 'on');
});

test('handlers.load: the list-reading switch is told on every answer; a 404 turns it off, a network failure leaves it', async () => {
  const told = [];
  let body = DOC({chance: 'off', home: 'off', list_tap: 'on'});
  const {client} = stubClient({'offerwall/combos': () => body});
  const handlers = handlersFor(client, {onListTap: on => told.push(on)});
  await handlers.load();
  body = DOC({chance: 'chip'});
  await handlers.load();
  assert.deepEqual(told, [true, false]);
  const notFound = handlersFor(stubClient({}).client, {onListTap: on => told.push(on)});
  await assert.rejects(notFound.load());
  assert.deepEqual(told, [true, false, false], 'the server\'s 404 → off');
  const offline = handlersFor({get: async () => { throw Object.assign(new Error('network'), {status: 0}); }, post: async () => ({})}, {onListTap: on => told.push(on)});
  await assert.rejects(offline.load());
  assert.deepEqual(told, [true, false, false], 'a flaky network says nothing');
  const broken = handlersFor(client, {onListTap: () => { throw new Error('app bug'); }});
  assert.ok(await broken.load(), 'a throwing listener does not lose the answer');
});

test('handlers: the SDK list and the tap diagnostics go to the server for test members only; the detail signal for everyone; no member → nothing', async () => {
  const sdkList = [{campaignKey: 'k1', name: 'N1', reward: '100'}];
  const tap = {t: 'tap', mission: 'm', name: 'n', bridge: true, listCount: 1, how: 'name', attempts: 1, open: true, ms: 10, usn: 'SECRET'};
  const signal = {result: 'closed_fast', campaignKey: '123456', platform: 'ios', ms: 3000};
  for (const [isTester, expected] of [[true, ['offerwall/campaigns', 'offerwall/combos/diag', 'offerwall/combos/diag']], [false, ['offerwall/combos/diag']]]) {
    const {client, log} = stubClient({});
    const handlers = handlersFor(client, {askTestMember: async () => isTester});
    await handlers.report(sdkList); await handlers.diagnose(tap); await handlers.signalDetail(signal);
    assert.deepEqual(posts(log).map(l => l[1]), expected, isTester ? 'test member' : 'ordinary member');
    assert.equal(JSON.stringify(log).includes('SECRET'), false);
    assert.deepEqual(posts(log).at(-1)[2], {result: 'closed_fast', campaignKey: '123456', platform: 'ios', ms: 3000});
  }
  const {client, log} = stubClient({});
  const noMember = api.createComboHandlers({client: () => client, memberId: () => null, askTestMember: async () => true});
  await noMember.report(sdkList);
  assert.deepEqual(log, []);
  await handlersFor(client, {askTestMember: async () => true}).report([]);
  assert.deepEqual(log, [], 'an empty list is never sent');
  const failing = api.createComboHandlers({client: () => ({get: async () => ({}), post: async () => { throw new Error('down'); }}), memberId: () => 1, askTestMember: async () => true});
  await failing.report(sdkList); await failing.diagnose(tap); await failing.signalDetail(signal); // none of these may throw
});

test('handlers: the trial calls use the server paths and throw on failure (the entry decides what a failure means)', async () => {
  const {client, log} = stubClient({'offerwall/trials': {ok: true, trials: []}});
  const handlers = handlersFor(client);
  await handlers.trialConsent('abc/def', true);
  await handlers.trialCancelled('a b/c', false);
  assert.deepEqual(await handlers.loadTrials(), {ok: true, trials: []});
  assert.deepEqual(log, [
    ['POST', 'offerwall/trials/consent', {campaignKey: 'abc/def', agree: true}],
    ['POST', `offerwall/trials/${encodeURIComponent('a b/c')}/cancelled`, {cancelled: false}],
    ['GET', 'offerwall/trials'],
  ]);
  const failing = api.createComboHandlers({client: () => ({get: async () => { throw new Error('x'); }, post: async () => { throw new Error('y'); }}), memberId: () => 1});
  await assert.rejects(failing.trialConsent('k', true));
  await assert.rejects(failing.loadTrials());
  await assert.rejects(failing.trialCancelled('k', true));
});

// ---- <OfferwallCombos> itself ----
const props = (extra = {}) => ({placement: 'chance', usn: 'u'.repeat(64), memberId: 42, serverUrl: 'https://api.example.com/app', ...extra});
const mountCombos = async (make, p) => {
  const host = make();
  const mount = () => host.render(() => api.OfferwallCombos(p));
  mount(); host.flush(); await tick(); mount(); host.flush(); await tick(); mount(); host.flush(); await tick();
  return {host, tree: mount(), mount};
};
const chipShown = tree => walk(tree).some(n => n.type === 'Pressable' && typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('포인트 빨리 모으기'));

test('<OfferwallCombos>: no member → nothing and no request; with one, the combos come from offerwall/combos through the client and the chip shows only when the server says chip', () => withReact(async ({make}) => {
  const {client, log} = stubClient({'offerwall/combos': DOC({chance: 'chip'})});
  const none = make();
  assert.equal(none.render(() => api.OfferwallCombos(props({memberId: null, client}))), null);
  none.flush(); await tick();
  assert.deepEqual(log, [], 'no member, no request');
  const {tree} = await mountCombos(make, props({client}));
  assert.deepEqual(log[0], ['GET', 'offerwall/combos']);
  assert.equal(chipShown(tree), true);
  for (const handlers of [{'offerwall/combos': DOC(undefined)}, {'offerwall/combos': DOC({home: 'banner'})}, {}, {'offerwall/combos': DOC({chance: 'off'})}, {'offerwall/combos': DOC({chance: 'maybe'})}]) {
    const stub = stubClient(handlers);
    const mounted = await mountCombos(make, props({client: stub.client}));
    assert.equal(chipShown(mounted.tree), false, 'nothing turns on by itself: ' + JSON.stringify(handlers));
  }
}));

const tapModule = calls => ({getCapabilities: async () => ({methods: ['setWebTap']}), setWebTap: async o => { calls.push(o); return true; }});

test('<OfferwallCombos>: iPhone + list_tap "on" (even with the chip off and no rows) starts the web tap, takes the page\'s list and uploads it once after the quiet time', () => {
  const calls = [];
  return withReact(async ({make, rn}) => {
    rn.Platform.OS = 'ios';
    const {client, log} = stubClient({'offerwall/combos': DOC({chance: 'off', home: 'off', chance_popup: 'off', list_tap: 'on'}, {bundles: [], categories: [], preparing: true})});
    const {tree} = await mountCombos(make, props({client, storage: {getItem: async () => null, setItem: async () => {}}}));
    await tick(10);
    assert.equal(chipShown(tree), false, 'the chip is off');
    assert.equal(calls.filter(c => c.enabled).length, 1, 'the web tap started');
    const sub = rn.__subs.find(s => s[1] === 'JCurveOfferwallTap');
    assert.ok(sub, 'listening for the page\'s messages');
    sub[2](JSON.stringify({type: 'shape', path: '/x', keys: ['A'], itemKeys: ['B']}));
    sub[2](JSON.stringify({type: 'list', campaigns: [{campaignKey: 'k1', name: 'N1', reward: 10, Auth: 'SECRET'}]}));
    await tick(5);
    assert.deepEqual(posts(log), [], 'nothing is sent at once: the uploader waits for the quiet time');
  }, {nativeModules: {JCurveOfferwallModule: tapModule(calls)}});
});

test('<OfferwallCombos>: Android, a "list_tap" that is not "on", and a binary without the 0.4.0 module never start the web tap', async () => {
  const calls = [];
  await withReact(async ({make}) => {
    const {client} = stubClient({'offerwall/combos': DOC({chance: 'chip', list_tap: 'on'})});
    await mountCombos(make, props({client}));
    await tick(10);
    assert.equal(calls.length, 0, 'Android: the SDK list is read natively, the page is not tapped');
  }, {nativeModules: {JCurveOfferwallModule: tapModule(calls)}});
  await withReact(async ({make, rn}) => {
    rn.Platform.OS = 'ios';
    for (const display of [{chance: 'chip'}, {chance: 'chip', list_tap: 'off'}, {chance: 'chip', list_tap: true}]) {
      await mountCombos(make, props({client: stubClient({'offerwall/combos': DOC(display)}).client}));
    }
    await tick(10);
    assert.equal(calls.length, 0, 'iPhone without the explicit "on"');
  }, {nativeModules: {JCurveOfferwallModule: tapModule(calls)}});
  await withReact(async ({make, rn}) => {
    rn.Platform.OS = 'ios';
    await mountCombos(make, props({client: stubClient({'offerwall/combos': DOC({chance: 'chip', list_tap: 'on'})}).client}));
    await tick(10);
    assert.equal(rn.__subs.length, 0, 'an old binary has no module → nothing is subscribed or called');
  });
});

test('popup ad: with no ad SDK (or no unit) there is no ad and no room for one; unit lookup per OS', () => withReact(async ({make}) => {
  assert.equal(api.popupAdAvailable({adUnit: {ios: 'x', android: 'y'}}), false, 'no react-native-google-mobile-ads here');
  assert.equal(api.popupAdUnit({ios: ' i ', android: 'a'}, 'ios'), 'i');
  assert.equal(api.popupAdUnit({ios: 'i'}, 'android'), '');
  assert.equal(api.popupAdUnit(' one ', 'ios'), 'one');
  assert.equal(api.popupAdUnit(undefined, 'ios'), '');
  const host = make();
  assert.equal(host.render(() => api.OfferwallPopupAd({adUnit: 'u'})), null, 'no SDK → null, not a crash');
}));

// ---- the popup ad with a fake ad SDK ----
const withAds = async (queue, run) => {
  const Module = require('node:module');
  const original = Module._load;
  const requested = []; const destroyed = [];
  const config = [];
  const sdk = {
    default: () => ({setRequestConfiguration: async c => { config.push(c); }, initialize: async () => {}}),
    NativeAd: {createForAdRequest: async (unit, opts) => {
      requested.push({unit, opts});
      const next = queue.shift();
      if (!next) throw new Error('no fill');
      return {headline: next.headline, body: '', callToAction: 'Open', advertiser: null, icon: null, mediaContent: {hasVideoContent: !!next.video, aspectRatio: 1.5}, destroy: () => destroyed.push(next.headline)};
    }},
    NativeAdView: 'NativeAdView', NativeAsset: 'NativeAsset', NativeAssetType: {ADVERTISER: 'a', ICON: 'i', HEADLINE: 'h', BODY: 'b', CALL_TO_ACTION: 'c'}, NativeMediaView: 'NativeMediaView',
    TestIds: {NATIVE: 'TEST-NATIVE'},
  };
  Module._load = function (id, ...rest) { return id === 'react-native-google-mobile-ads' ? sdk : original.call(this, id, ...rest); };
  try { return await withReact(ctx => run({...ctx, requested, destroyed, config})); } finally { Module._load = original; }
};
const adTree = async (make, options) => {
  const host = make();
  const render = () => host.render(() => api.OfferwallPopupAd(options));
  render(); host.flush(); await tick(20); render(); host.flush();
  return render();
};

test('popup ad: a picture ad is shown with its headline; the unit is the OS\'s; test devices are set before the first request', () => withAds([{headline: 'Picture ad'}], async ({make, requested, config, rn}) => {
  rn.Platform.OS = 'ios';
  assert.equal(api.popupAdAvailable({adUnit: {ios: 'ca-app-pub-ios', android: 'ca-app-pub-android'}}), true);
  assert.equal(api.popupAdAvailable({adUnit: {android: 'only-android'}}), false, 'no unit for this OS → no ad, no room');
  const tree = await adTree(make, {adUnit: {ios: 'ca-app-pub-ios', android: 'ca-app-pub-android'}, testDevices: ['DEVICE-1']});
  assert.deepEqual(requested.map(r => r.unit), ['ca-app-pub-ios']);
  assert.equal(requested[0].opts.startVideoMuted, true);
  assert.deepEqual(config[0], {testDeviceIdentifiers: ['DEVICE-1']});
  assert.ok(walk(tree).some(n => n.type === 'NativeAdView'));
  assert.ok(JSON.stringify(tree).includes('Picture ad'));
  assert.ok(JSON.stringify(tree).includes('광고'), 'marked as an ad');
}));

test('popup ad: videos are thrown away for a picture (five tries); the last video is shown when nothing else comes; test mode uses Google\'s unit; an unfilled request shows nothing', async () => {
  await withAds([{headline: 'v1', video: true}, {headline: 'v2', video: true}, {headline: 'Picture', video: false}], async ({make, destroyed}) => {
    const tree = await adTree(make, {adUnit: 'unit'});
    assert.ok(JSON.stringify(tree).includes('Picture'));
    assert.deepEqual(destroyed, ['v1', 'v2'], 'the videos were released');
  });
  await withAds(Array.from({length: 5}, (_, i) => ({headline: 'video' + i, video: true})), async ({make, destroyed}) => {
    const tree = await adTree(make, {adUnit: 'unit'});
    assert.ok(JSON.stringify(tree).includes('video4'), 'only videos came → the last one is shown (muted)');
    assert.deepEqual(destroyed, ['video0', 'video1', 'video2', 'video3']);
  });
  await withAds([{headline: 'T'}], async ({make, requested}) => {
    await adTree(make, {adUnit: 'real-unit', testMode: true});
    assert.equal(requested[0].unit, 'TEST-NATIVE');
  });
  await withAds([], async ({make}) => {
    assert.equal(await adTree(make, {adUnit: 'unit'}), null, 'no fill → no card and no room');
  });
});
