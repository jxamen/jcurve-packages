const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {withReact, tick} = require('./harness.cjs');
const api = require('../dist');

// ---- the injected script, run against a fake web page ----
const page = (hostname = 'offerwall.adpopcorn.com') => {
  const posts = [];
  const listeners = {};
  const sent = [];
  class FakeXHR {
    constructor() { this.listeners = {}; this.responseType = ''; this.responseText = ''; }
    open(method, url) { this.url = url; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    send() { sent.push(this); }
    reply(body) { this.responseText = typeof body === 'string' ? body : JSON.stringify(body); this.listeners.load && this.listeners.load(); }
  }
  const window = {
    // hello and net are the 0.4.1 diagnostics (tested in tap-gate.test.cjs), resp the 0.4.2 one (web-tap-real.test.cjs); these tests look at the campaign messages
    webkit: {messageHandlers: {JCurveOfferwallTap: {postMessage: s => { const m = JSON.parse(s); if (m.type !== 'hello' && m.type !== 'net' && m.type !== 'resp') posts.push(m); }}}},
    addEventListener: (type, fn) => { listeners[type] = fn; },
    fetch: async () => ({clone: () => ({text: async () => window.__fetchBody})}),
  };
  const sandbox = {window, location: {hostname, href: `https://${hostname}/`}, XMLHttpRequest: FakeXHR, URL, JSON, Object, Array, RegExp, String, Number, Math, isFinite, console};
  vm.createContext(sandbox);
  vm.runInContext(api.WEB_TAP_SCRIPT, sandbox);
  return {window, posts, listeners, sent, FakeXHR, sandbox};
};
const xhrTo = (p, url, body) => { const x = new p.FakeXHR(); x.open('POST', url); x.send(); x.reply(body); };
const LIST = {
  Result: true,
  CampaignList: [
    {CampaignKey: 1781115240, Title: '집핏', Reward: '1,080', Description: '앱 설치 후 실행', IconImage: 'https://cdn.example.com/a.png', MainImage: 'https://cdn.example.com/m.png', Auth: 'SECRET-TOKEN-SHOULD-NOT-LEAVE', usn: 'member-1', Ifa: 'AAAAAAAA-BBBB'},
    {CampaignKey: 'k2', Title: '스탁매니저', Reward: 560, IconImage: 'http://insecure.example.com/b.png', SubCampaignList: [{CampaignKey: 's1', Title: '하위', Reward: 10}]},
    {CampaignKey: '', Title: 'no key'},
  ],
};

test('script: acts only on AdPopcorn\'s offerwall page — on any other page it installs nothing', () => {
  const other = page('example.com');
  assert.equal(other.window.__jcurveWebTap, undefined);
  assert.deepEqual(other.listeners, {});
  const sub = page('stage.offerwall.adpopcorn.com');
  assert.equal(sub.window.__jcurveWebTap, 1, 'a sub domain of the offerwall host counts');
  const lookalike = page('offerwall.adpopcorn.com.evil.example');
  assert.equal(lookalike.window.__jcurveWebTap, undefined);
});

test('script: a campaign list response (XHR) is posted with the whitelisted fields only — never Auth, member or advertising values', () => {
  const p = page();
  xhrTo(p, 'https://apapi.adpopcorn.com/ap/v3/sdk/media/campaigns?x=1', LIST);
  assert.equal(p.posts.length, 1);
  const message = p.posts[0];
  assert.equal(message.type, 'list');
  assert.deepEqual(message.campaigns, [
    {campaignKey: '1781115240', name: '집핏', reward: 1080, description: '앱 설치 후 실행', icon: 'https://cdn.example.com/a.png'},
    {campaignKey: 'k2', name: '스탁매니저', reward: 560},
  ]);
  const raw = JSON.stringify(message);
  for (const secret of ['SECRET-TOKEN', 'member-1', 'AAAAAAAA', 'Auth', 'usn', 'Ifa', 'insecure.example.com', 'MainImage']) assert.equal(raw.includes(secret), false, secret);
});

test('script: other URLs are ignored, fetch responses are read too, a response it cannot read posts only key names', async () => {
  const p = page();
  xhrTo(p, 'https://apapi.adpopcorn.com/ap/v2/sdk/media/join', LIST);
  xhrTo(p, 'https://example.com/other', LIST);
  assert.equal(p.posts.length, 0);
  p.window.__fetchBody = JSON.stringify(LIST);
  await p.window.fetch('https://apapi.adpopcorn.com/ap/v3/sdk/media/campaigns');
  await tick(5);
  assert.equal(p.posts.length, 1);
  assert.equal(p.posts[0].type, 'list');
  const q = page();
  xhrTo(q, 'https://apapi.adpopcorn.com/ap/v3/sdk/media/campaigns', {Result: true, Weird: {A: 1}, Items: [{Foo: 'bar', Secret: 'value-must-not-appear'}]});
  assert.equal(q.posts.length, 1);
  assert.equal(q.posts[0].type, 'shape');
  assert.deepEqual(q.posts[0].keys, ['Result', 'Weird', 'Items']);
  assert.equal(JSON.stringify(q.posts[0]).includes('value-must-not-appear'), false, 'key names only');
  xhrTo(q, 'https://apapi.adpopcorn.com/ap/v3/sdk/media/campaigns', {Result: true, Weird: {A: 1}, Items: []});
  assert.equal(q.posts.length, 1, 'the same shape is reported once');
});

test('script: a detail response gives the campaign and its participation text', () => {
  const p = page();
  xhrTo(p, 'https://apapi.adpopcorn.com/ap/v3/sdk/media/campaign', {Result: true, Campaign: {CampaignKey: 'k9', Title: '상세', Reward: 300, ParticipationStep: '1. 설치하기\n2. 실행하기', Condition: '신규 회원만', Auth: 'SECRET'}});
  assert.equal(p.posts.length, 1);
  assert.equal(p.posts[0].type, 'detail');
  assert.equal(p.posts[0].campaign.campaignKey, 'k9');
  assert.ok(p.posts[0].campaign.info.includes('설치하기') && p.posts[0].campaign.info.includes('신규 회원만'));
  assert.equal(JSON.stringify(p.posts[0]).includes('SECRET'), false);
});

test('script: the page\'s NativeEvent — dialog and result events pass (name · ok · message), getParameter and every body never do', () => {
  const p = page();
  const fire = data => p.listeners.NativeEvent({detail: {data}});
  fire({EventName: 'normalDialog', Result: false, ResultMessage: '현재 캠페인의 참여 한도가 소진되어 참여할 수 없습니다.', EventBody: 'APPKEY-USN-IFA', EventParam: 'param'});
  fire({EventName: 'getParameter', Result: true, EventBody: JSON.stringify({usn: 'member-1', ifa: 'AAAA', appKey: 'KEY'})});
  fire({EventName: 'showDetailPage', Result: true, ResultMessage: 'success'});
  fire({EventName: 'somethingElse', Result: true});
  assert.deepEqual(p.posts, [
    {type: 'native', event: 'normalDialog', ok: false, message: '현재 캠페인의 참여 한도가 소진되어 참여할 수 없습니다.'},
    {type: 'native', event: 'showDetailPage', ok: true, message: 'success'},
  ]);
  const raw = JSON.stringify(p.posts);
  for (const secret of ['APPKEY', 'member-1', 'AAAA', 'KEY', 'EventBody', 'param']) assert.equal(raw.includes(secret), false, secret);
});

// ---- the JS side ----
test('parseTapMessage: keeps only the known fields, caps lengths, drops the rest and duplicates, refuses anything else', () => {
  const m = api.parseTapMessage(JSON.stringify({type: 'list', campaigns: [
    {campaignKey: 'a', name: 'A', reward: 12.6, icon: 'https://x.io/i.png', Auth: 'T', usn: 'u', description: 'd'.repeat(2000)},
    {campaignKey: 'a', name: 'dup'},
    {campaignKey: 'b', name: 'B', reward: -5, icon: 'http://insecure'},
    {name: 'no key'},
  ]}));
  assert.equal(m.type, 'list');
  assert.deepEqual(m.campaigns.map(c => [c.campaignKey, c.name, c.reward]), [['a', 'A', 13], ['b', 'B', 0]]);
  assert.equal(m.campaigns[0].description.length, 1000);
  assert.equal(m.campaigns[0].icon, 'https://x.io/i.png');
  assert.equal(m.campaigns[1].icon, undefined);
  assert.equal(JSON.stringify(m).includes('Auth'), false);
  assert.equal(JSON.stringify(m).includes('"usn"'), false);
  assert.deepEqual(api.parseTapMessage({type: 'native', event: 'normalDialog', ok: false, message: 'm', EventBody: 'x'}), {type: 'native', event: 'normalDialog', ok: false, message: 'm'});
  assert.deepEqual(api.parseTapMessage({type: 'shape', path: '/p', keys: ['A', 5, 'B'], itemKeys: []}), {type: 'shape', path: '/p', keys: ['A', 'B'], itemKeys: []});
  for (const bad of [null, undefined, 5, 'nope', '{"type":"x"}', {type: 'detail'}, {type: 'native', event: ''}, {type: 'list', campaigns: 'x'}, 'x'.repeat(2_000_000)]) assert.equal(api.parseTapMessage(bad), null, String(bad).slice(0, 20));
});

test('startWebTap: no native module (0.2.x binary) or a module without setWebTap → { ok: false } and nothing hooked', () => withReact(async () => {
  const seen = [];
  const handle = await api.startWebTap({onMessage: m => seen.push(m)});
  assert.deepEqual([handle.ok, handle.reason], [false, 'no_native']);
  handle.stop();
  assert.deepEqual(seen, []);
}));
test('startWebTap: a 0.3.0 module (no setWebTap in its capabilities) is unsupported — nothing is subscribed', () => {
  const mod = {getCapabilities: async () => ({platform: 'ios', sdk: '5.2.3', bridge: 1, methods: ['openCampaignDetail']})};
  return withReact(async ({rn}) => {
    const handle = await api.startWebTap({onMessage() {}});
    assert.deepEqual([handle.ok, handle.reason], [false, 'unsupported']);
    assert.equal(rn.__subs.length, 0);
  }, {nativeModules: {JCurveOfferwallModule: mod}});
});

test('startWebTap: with the 0.4.0 module it hands the script and host pattern to native, relays checked messages, and stop() switches it off', () => {
  const calls = [];
  const mod = {
    getCapabilities: async () => ({platform: 'ios', sdk: '5.2.3', bridge: 2, methods: ['setWebTap', 'openCampaignDetail']}),
    setWebTap: async options => { calls.push(options); return true; },
  };
  return withReact(async ({rn}) => {
    const seen = [];
    const handle = await api.startWebTap({onMessage: m => seen.push(m)});
    assert.equal(handle.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].enabled, true);
    assert.equal(calls[0].script, api.WEB_TAP_SCRIPT);
    assert.equal(calls[0].handler, 'JCurveOfferwallTap');
    assert.equal(calls[0].hostPattern, api.WEB_TAP_HOST_PATTERN);
    const sub = rn.__subs.find(s => s[1] === 'JCurveOfferwallTap');
    assert.ok(sub, 'listening to the tap event');
    sub[2](JSON.stringify({type: 'list', campaigns: [{campaignKey: 'k', name: 'N', reward: 5, Auth: 'x'}]}));
    sub[2]('garbage');
    assert.deepEqual(seen, [{type: 'list', campaigns: [{campaignKey: 'k', name: 'N', reward: 5}]}]);
    handle.stop();
    await tick(5);
    assert.equal(rn.__removed, 1);
    assert.deepEqual(calls[1], {enabled: false});
  }, {nativeModules: {JCurveOfferwallModule: mod}});
});

test('startWebTap: enabled false only switches off; a native refusal is reported, nothing stays subscribed; a throwing handler does not break the relay', () => {
  const calls = [];
  let answer = true;
  const mod = {getCapabilities: async () => ({methods: ['setWebTap']}), setWebTap: async o => { calls.push(o); return answer; }};
  return withReact(async ({rn}) => {
    const off = await api.startWebTap({onMessage() {}, enabled: false});
    assert.equal(off.ok, true);
    assert.deepEqual(calls[0], {enabled: false});
    answer = false;
    const refused = await api.startWebTap({onMessage() {}});
    assert.deepEqual([refused.ok, refused.reason], [false, 'failed']);
    answer = true;
    const handle = await api.startWebTap({onMessage() { throw new Error('app bug'); }});
    const sub = rn.__subs[rn.__subs.length - 1];
    assert.doesNotThrow(() => sub[2]({type: 'native', event: 'normalDialog', ok: false, message: ''}));
    handle.stop();
  }, {nativeModules: {JCurveOfferwallModule: mod}});
});
