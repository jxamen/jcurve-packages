// 0.4.1: why the iPhone list reading never ran in 1.1.7 — the wall's web view was made before the tap turned on — and how it is fixed.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {withReact, tick} = require('./harness.cjs');
const api = require('../dist');

const usn = 'a'.repeat(64);
const moduleWithTap = calls => ({getCapabilities: async () => ({methods: ['setWebTap']}), setWebTap: async o => { calls.push(o); return true; }});

// ---- the gate ----
test('gate: an activation counts once; off then on counts again; listeners are told and can leave', () => {
  api.tapGateDeactivated();
  const start = api.tapGateState().epoch;
  const told = [];
  const off = api.subscribeTapGate(epoch => told.push(epoch));
  api.tapGateActivated(); api.tapGateActivated();
  assert.deepEqual(told, [start + 1], 'a second "activated" while on is not a new activation');
  api.tapGateDeactivated(); api.tapGateActivated();
  assert.deepEqual(told, [start + 1, start + 2]);
  off(); api.tapGateDeactivated(); api.tapGateActivated();
  assert.equal(told.length, 2, 'after unsubscribing nothing arrives');
  api.tapGateDeactivated();
});

test('startWebTap: a started tap opens the gate, stop() closes it, a refused one never opens it', () => {
  api.tapGateDeactivated();
  const calls = [];
  return withReact(async () => {
    const handle = await api.startWebTap({onMessage() {}});
    assert.equal(handle.ok, true);
    assert.equal(api.tapGateState().active, true);
    handle.stop();
    assert.equal(api.tapGateState().active, false);
  }, {nativeModules: {JCurveOfferwallModule: moduleWithTap(calls)}}).then(() => withReact(async () => {
    const refused = await api.startWebTap({onMessage() {}});
    assert.equal(refused.ok, false);
    assert.equal(api.tapGateState().active, false);
  }));
});

// ---- the wall view mounts once more when the tap turns on shortly after it was mounted ----
const mountView = async (host, props = {}) => {
  const mount = () => host.render(() => api.OfferwallView({usn, ...props}));
  mount(); host.flush(); await tick(); return {mount, key: () => mount().props.key};
};

test('OfferwallView: tap turning on right after the view mounted → the native view gets a new key once (so its web view gets the script)', () => {
  api.tapGateDeactivated();
  return withReact(async ({host}) => {
    api.configureOfferwall({appKey: 'k', hashKey: 'h'});
    const view = await mountView(host);
    const before = view.key();
    api.tapGateActivated();
    assert.notEqual(view.key(), before, 'a new key = React mounts the native view again');
    const after = view.key();
    api.tapGateActivated(); // still on: not a new activation
    assert.equal(view.key(), after);
    api.tapGateDeactivated();
  }, {nativeModules: {JCurveOfferwallModule: {}}});
});

test('OfferwallView: a tap that was already on when the view mounted does not remount it; one that turns on long after does not either', () => {
  return withReact(async ({host}) => {
    api.configureOfferwall({appKey: 'k', hashKey: 'h'});
    api.tapGateDeactivated(); api.tapGateActivated(); // already on
    const view = await mountView(host);
    const before = view.key();
    api.tapGateDeactivated();
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + api.TAP_REMOUNT_WINDOW_MS + 5000; // the view has been up for a long time (the member is using it)
      api.tapGateActivated();
      assert.equal(view.key(), before, 'no remount under a member who is already browsing the wall');
    } finally { Date.now = realNow; api.tapGateDeactivated(); }
  }, {nativeModules: {JCurveOfferwallModule: {}}});
});

// ---- the cached switch starts the tap at mount ----
test('listTapCached: only a fresh timestamp counts', () => {
  const now = Date.UTC(2026, 9, 28, 1, 0, 0);
  assert.equal(api.listTapCached(String(now - 1000), now), true);
  assert.equal(api.listTapCached(String(now - 6 * 24 * 3600_000), now), true);
  for (const bad of [null, undefined, '', '0', 'on', String(now - 8 * 24 * 3600_000), String(now + 60_000), 'NaN']) assert.equal(api.listTapCached(bad, now), false, String(bad));
});

const DOC = display => ({ok: true, combos: {date: api.kstDate(), display, bundles: [{goal: 100, missions: [{id: 'a1', name: '앱 하나', points: 100, todo: 't', level: 'easy', campaignKey: '123456'}]}]}});
const store = (initial = {}) => { const m = new Map(Object.entries(initial)); return {m, getItem: async k => m.get(k) ?? null, setItem: async (k, v) => { m.set(k, v); }}; };
const mountCombos = async (make, props) => {
  const host = make();
  const mount = () => host.render(() => api.OfferwallCombos({placement: 'chance', usn, memberId: 42, serverUrl: 'https://api.example.com/app', ...props}));
  mount(); host.flush(); await tick(5); mount(); host.flush(); await tick(5); mount(); host.flush(); await tick(5);
  return {host, mount};
};

test('<OfferwallCombos> iPhone: the cached "on" starts the tap before the combos answer arrives; a later "off" stops it and is remembered', () => {
  const calls = [];
  return withReact(async ({make, rn}) => {
    rn.Platform.OS = 'ios';
    const storage = store({'jcurve.offerwall.listtap:42': String(Date.now() - 1000)});
    let answer;
    const slow = new Promise(resolve => { answer = resolve; });
    const client = {get: async () => { await slow; return DOC({chance: 'off', home: 'off', list_tap: 'off'}); }, post: async () => ({})};
    const {host, mount} = await mountCombos(make, {client, storage});
    assert.equal(calls.filter(c => c.enabled).length, 1, 'tap started from the cache while the answer is still on its way');
    answer();
    await tick(20);
    mount(); host.flush(); await tick(10); // the screen re-renders with the new state
    assert.ok(calls.some(c => c.enabled === false), 'the server said off → the tap is switched off');
    assert.equal(storage.m.get('jcurve.offerwall.listtap:42'), '0', 'and the "off" is remembered');
  }, {nativeModules: {JCurveOfferwallModule: moduleWithTap(calls)}});
});

test('<OfferwallCombos> iPhone: an explicit "on" from the server is remembered with its time; with no cache and no answer nothing starts', () => {
  const calls = [];
  return withReact(async ({make, rn}) => {
    rn.Platform.OS = 'ios';
    const storage = store();
    const noAnswer = {get: async () => { throw Object.assign(new Error('offline'), {status: 0}); }, post: async () => ({})};
    await mountCombos(make, {client: noAnswer, storage});
    await tick(10);
    assert.equal(calls.length, 0, 'no cache, no answer → off');
    const client = {get: async () => DOC({chance: 'off', home: 'off', list_tap: 'on'}), post: async () => ({})};
    const second = await mountCombos(make, {client, storage, memberId: 43});
    await tick(20); second.mount(); second.host.flush(); await tick(10);
    assert.equal(calls.filter(c => c.enabled).length, 1);
    assert.ok(Date.now() - Number(storage.m.get('jcurve.offerwall.listtap:43')) < 5000, 'stored as the time of the explicit on');
  }, {nativeModules: {JCurveOfferwallModule: moduleWithTap(calls)}});
});

// ---- the script says hello, names the paths the page asks for, and the parser knows both ----
const pageWith = hostname => {
  const posts = [];
  class FakeXHR { constructor() { this.listeners = {}; this.responseType = ''; this.responseText = ''; } open(m, url) { this.url = url; } addEventListener(t, fn) { this.listeners[t] = fn; } send() {} reply(body) { this.responseText = JSON.stringify(body); this.listeners.load && this.listeners.load(); } }
  const window = {webkit: {messageHandlers: {JCurveOfferwallTap: {postMessage: s => posts.push(JSON.parse(s))}}}, addEventListener() {}, fetch: async () => ({})};
  const sandbox = {window, location: {hostname, href: `https://${hostname}/SDK/list`}, document: {readyState: 'loading'}, XMLHttpRequest: FakeXHR, URL, JSON, Object, Array, RegExp, String, Number, Math, isFinite, console};
  vm.createContext(sandbox);
  vm.runInContext(api.WEB_TAP_SCRIPT, sandbox);
  return {posts, FakeXHR};
};

test('script: says hello on the AdPopcorn wall page only; reports each requested path once (no query) and at most twelve', () => {
  assert.deepEqual(pageWith('example.com').posts, [], 'other pages: nothing at all');
  const p = pageWith('offerwall.adpopcorn.com');
  assert.deepEqual(p.posts, [{type: 'hello', host: 'offerwall.adpopcorn.com', ready: 'loading'}]);
  const call = url => { const x = new p.FakeXHR(); x.open('GET', url); x.send(); x.reply({Result: true}); };
  call('https://apapi.adpopcorn.com/ap/v3/sdk/media/other?usn=SECRET&x=1'); call('https://apapi.adpopcorn.com/ap/v3/sdk/media/other?usn=SECRET2');
  const nets = p.posts.filter(m => m.type === 'net');
  assert.deepEqual(nets, [{type: 'net', path: '/ap/v3/sdk/media/other'}], 'once, without the query');
  assert.equal(JSON.stringify(p.posts).includes('SECRET'), false);
  for (let i = 0; i < 20; i += 1) call(`https://apapi.adpopcorn.com/p${i}`);
  assert.equal(p.posts.filter(m => m.type === 'net').length, 12);
});

test('parseTapMessage: hello and net are checked and cut; nothing else rides along', () => {
  assert.deepEqual(api.parseTapMessage(JSON.stringify({type: 'hello', host: 'offerwall.adpopcorn.com', ready: 'loading', Auth: 'x'})), {type: 'hello', host: 'offerwall.adpopcorn.com', ready: 'loading'});
  assert.deepEqual(api.parseTapMessage({type: 'net', path: '/a/b', usn: 'SECRET'}), {type: 'net', path: '/a/b'});
  assert.equal(api.parseTapMessage({type: 'net', path: ''}), null);
});

// ---- the test-member diagnostic ----
test('webTapDiagBody: fixed fields, counts and path names only (no query), lengths cut', () => {
  const body = api.webTapDiagBody({started: true, reason: 'r'.repeat(80), hello: 2, helloHost: 'offerwall.adpopcorn.com', lists: 3, maxList: 9, details: 1, natives: 4, shapes: 0,
    paths: ['/ap/v3/sdk/media/campaigns?usn=SECRET', ...Array.from({length: 20}, (_, i) => '/p' + i)], usn: 'SECRET', campaigns: [{campaignKey: 'k'}]});
  assert.equal(body.t, 'webtap');
  assert.equal(body.paths.length, 12);
  assert.equal(body.paths[0], '/ap/v3/sdk/media/campaigns');
  assert.equal(body.reason.length, 40);
  assert.equal(JSON.stringify(body).includes('SECRET'), false);
  assert.equal('campaigns' in body, false);
  assert.deepEqual(Object.keys(body).sort(), ['details', 'hello', 'helloHost', 'lists', 'maxList', 'natives', 'paths', 'reason', 'shapes', 't', 'started'].sort());
});

test('handlers.diagnoseWebTap: test members only; never throws', async () => {
  const posts = [];
  const make = ask => api.createComboHandlers({client: () => ({get: async () => ({}), post: async (path, body) => { posts.push([path, body.t]); }}), memberId: () => 1, askTestMember: ask});
  const summary = {started: true, hello: 1, lists: 1, maxList: 6, details: 0, natives: 0, shapes: 0, paths: []};
  await make(async () => false).diagnoseWebTap(summary);
  assert.deepEqual(posts, []);
  await make(async () => true).diagnoseWebTap(summary);
  assert.deepEqual(posts, [['offerwall/combos/diag', 'webtap']]);
  await api.createComboHandlers({client: () => ({get: async () => ({}), post: async () => { throw new Error('down'); }}), memberId: () => 1, askTestMember: async () => true}).diagnoseWebTap(summary);
});
