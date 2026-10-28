// 0.4.2: the AdPopcorn wall's real response shape. 0.4.0 / 0.4.1 looked for `CampaignKey` and a plain `Reward`, found no mission list on an iPhone (diag lists 0, shapes 1).
// The shape below is what the wall page's own code reads (Key · Title · Description · IconImage · MainImage · Reward.{Quantity,Unit}) and what a device capture of
// POST /ap/v3/sdk/media/campaigns showed: top-level Result · IsTest · ResultCode · ResultMsg · CampaignList, every row with the same 33 keys (names and types only — no values here either).
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const api = require('../dist');

const page = () => {
  const posts = [];
  class FakeXHR {
    constructor() { this.listeners = {}; this.responseType = ''; this.responseText = ''; this.status = 200; }
    open(m, url) { this.url = url; }
    addEventListener(t, fn) { this.listeners[t] = fn; }
    send() {}
    reply(body) { this.responseText = typeof body === 'string' ? body : JSON.stringify(body); this.listeners.load && this.listeners.load(); }
  }
  const window = {webkit: {messageHandlers: {JCurveOfferwallTap: {postMessage: s => posts.push(JSON.parse(s))}}}, addEventListener() {}, fetch: async () => ({})};
  const sandbox = {window, location: {hostname: 'offerwall.adpopcorn.com', href: 'https://offerwall.adpopcorn.com/SDK/list'}, document: {readyState: 'loading'}, XMLHttpRequest: FakeXHR, URL, JSON, Object, Array, RegExp, String, Number, Math, isFinite, console};
  vm.createContext(sandbox);
  vm.runInContext(api.WEB_TAP_SCRIPT, sandbox);
  const call = (url, body) => { const x = new FakeXHR(); x.open('POST', url); x.send(); x.reply(body); };
  return {posts, call, of: type => posts.filter(m => m.type === type)};
};

const row = (i, extra = {}) => ({
  ContentsId: null, Auth: 'SECRET-AUTH-' + i, Key: String(1000000000 + i), RewardCondition: ['조건 ' + i, '두 번째 조건'], ParticipationStep: ['1. 설치', '2. 실행', '3. 완료'],
  ParticipationType: 1, ParticipationSubType: 0, ParticipationSubClassType: 0, IntegrationType: 1, Reward: {Quantity: 100 + i, Unit: '알'}, Package: 'com.example.app' + i,
  TargetPackage: null, DetargetPackage: null, IsChoiceOffer: false, Title: '미션 ' + i, Description: '설명 ' + i, MultiRewardDescription: null,
  MainImage: 'https://cdn.example.com/main' + i + '.png', DetailImage: 'https://cdn.example.com/detail' + i + '.png', IconImage: 'https://cdn.example.com/icon' + i + '.png',
  BannerImage: null, MainVideo: null, DetailVideo: null, EventBannerImage: null, SubCampaignList: null, RegistDatetime: 1700000000000, CompletedCount: 3, DailyCompletedCount: 1,
  CompletedCountInMedia: 2, DailyCompletedCountInMedia: 1, IsParticipable: true, StartTime: 1700000000000, EndTime: 1800000000000, ...extra,
});
const RESPONSE = n => ({Result: true, IsTest: false, ResultCode: 1, ResultMsg: null, CampaignList: Array.from({length: n}, (_, i) => row(i + 1))});
const URL_LIST = 'https://apapi.adpopcorn.com/ap/v3/sdk/media/campaigns';

test('the real list shape is read: Key · Title · Description · Reward.Quantity · IconImage, the steps and conditions become the info text, nothing else leaves', () => {
  const p = page();
  p.call(URL_LIST, RESPONSE(3));
  const lists = p.of('list');
  assert.equal(lists.length, 1);
  assert.equal(lists[0].campaigns.length, 3);
  assert.deepEqual(lists[0].campaigns[0], {
    campaignKey: '1000000001', name: '미션 1', reward: 101, description: '설명 1', icon: 'https://cdn.example.com/icon1.png',
    info: '1. 설치\n2. 실행\n3. 완료\n조건 1\n두 번째 조건',
  });
  const raw = JSON.stringify(lists);
  for (const secret of ['SECRET-AUTH', 'Auth', 'Package', 'com.example', 'main1.png', 'RegistDatetime', 'CompletedCount']) assert.equal(raw.includes(secret), false, secret);
  assert.equal(p.of('shape').length, 0, 'a list was found, so no shape message');
});

test('the icon falls back to MainImage when there is no IconImage; an insecure address is dropped; a string Reward.Quantity with a comma is a number', () => {
  const p = page();
  p.call(URL_LIST, {Result: true, CampaignList: [
    row(1, {IconImage: null, MainImage: 'https://cdn.example.com/only-main.png'}),
    row(2, {IconImage: 'http://insecure.example.com/i.png', MainImage: null}),
    row(3, {Reward: {Quantity: '1,080', Unit: '알'}}),
    row(4, {Reward: null}),
  ]});
  const [a, b, c, d] = p.of('list')[0].campaigns;
  assert.equal(a.icon, 'https://cdn.example.com/only-main.png');
  assert.equal(b.icon, undefined);
  assert.equal(c.reward, 1080);
  assert.equal(d.reward, 0);
});

test('live-commerce rows (CampaignKey · PartiTypeCode · broadcast times) and a CPMCampaignList beside the list are not missions', () => {
  const p = page();
  p.call(URL_LIST, {Result: true, CampaignList: [row(1), {Id: 7, CampaignKey: 'live-1', Title: '라이브', Reward: 500, RewardUnit: '알', IconUrl: 'https://x.io/i.png', PartiTypeCode: 'LIVE', BroadcastStartTime: 1, BroadcastEndTime: 2}],
    CPMCampaignList: [{Key: 'cpm-1', Title: '광고', Reward: {Quantity: 1, Unit: '알'}}]});
  assert.deepEqual(p.of('list')[0].campaigns.map(c => c.campaignKey), ['1000000001']);
});

test('a big list (456 rows with step texts) goes out in messages that stay far below the native 1.5 MB cap, and every row arrives once', () => {
  const p = page();
  const body = RESPONSE(456);
  for (const r of body.CampaignList) { r.ParticipationStep = ['가'.repeat(300), '나'.repeat(300), '다'.repeat(300)]; r.RewardCondition = ['라'.repeat(300), '마'.repeat(300)]; r.Description = '바'.repeat(900); }
  p.call(URL_LIST, body);
  const lists = p.of('list');
  assert.ok(lists.length >= 2, 'the batch is cut by size');
  for (const m of p.posts.filter(x => x.type === 'list')) assert.ok(JSON.stringify(m).length < 700000, 'one message is well under 1,500,000');
  const keys = lists.flatMap(m => m.campaigns.map(c => c.campaignKey));
  assert.equal(keys.length, 456);
  assert.equal(new Set(keys).size, 456);
  assert.ok(lists[0].campaigns[0].info.length <= 1500 && lists[0].campaigns[0].description.length <= 400);
  for (const m of lists) assert.ok(api.parseTapMessage(JSON.stringify(m)), 'the JS side accepts every batch');
});

test('a plain-size real list is one message', () => {
  const p = page();
  p.call(URL_LIST, RESPONSE(456));
  assert.equal(p.of('list').length, 1);
  assert.equal(p.of('list')[0].campaigns.length, 456);
});

test('the detail response { Campaign: { Key … } } still gives the campaign and its text', () => {
  const p = page();
  p.call('https://apapi.adpopcorn.com/ap/v3/sdk/media/campaign', {Result: true, Campaign: row(9, {Auth: 'SECRET-DETAIL'})});
  const detail = p.of('detail')[0];
  assert.equal(detail.campaign.campaignKey, '1000000009');
  assert.equal(detail.campaign.reward, 109);
  assert.ok(detail.campaign.info.includes('설치'));
  assert.equal(JSON.stringify(detail).includes('SECRET'), false);
});

// ---- the response shape message (names and numbers only) ----
test('resp: every response gets a shape message — status · kind · length · top-level key names · array lengths and row key names · nested key names — never a value', () => {
  const p = page();
  p.call(URL_LIST, RESPONSE(5));
  const resp = p.of('resp').find(m => m.path === '/ap/v3/sdk/media/campaigns');
  assert.ok(resp);
  assert.deepEqual([resp.status, resp.kind, resp.top], [200, 'json', 'object']);
  assert.deepEqual(resp.keys, ['Result', 'IsTest', 'ResultCode', 'ResultMsg', 'CampaignList']);
  assert.equal(resp.arrays.length, 1);
  assert.equal(resp.arrays[0].k, 'CampaignList');
  assert.equal(resp.arrays[0].n, 5);
  assert.ok(resp.arrays[0].item.includes('Key') && resp.arrays[0].item.includes('Reward'));
  assert.deepEqual(resp.arrays[0].sub.find(s => s[0] === 'Reward')[1], ['Quantity', 'Unit']);
  const raw = JSON.stringify(resp);
  for (const value of ['SECRET-AUTH', '미션 1', 'cdn.example.com', '설명', '알', '1000000001']) assert.equal(raw.includes(value), false, value);
});

test('resp: non-JSON bodies are named by kind only (html · jsonp · text · empty) and no text leaves', () => {
  const p = page();
  p.call('https://offerwall.adpopcorn.com/a', '<html><body>SECRET-HTML</body></html>');
  p.call('https://offerwall.adpopcorn.com/b', 'callback({"Key":"SECRET-JSONP"})');
  p.call('https://offerwall.adpopcorn.com/c', 'plain SECRET-TEXT');
  p.call('https://offerwall.adpopcorn.com/d', '');
  const by = path => p.of('resp').find(m => m.path === path);
  assert.deepEqual(['/a', '/b', '/c', '/d'].map(x => by(x).kind), ['html', 'jsonp', 'text', 'empty']);
  assert.equal(JSON.stringify(p.of('resp')).includes('SECRET'), false);
});

test('resp: a path is described at most three times (six for the mission list), 16 paths in all', () => {
  const p = page();
  for (let i = 0; i < 6; i += 1) p.call('https://offerwall.adpopcorn.com/same', {A: 1});
  assert.equal(p.of('resp').filter(m => m.path === '/same').length, 3);
  for (let i = 0; i < 30; i += 1) p.call('https://offerwall.adpopcorn.com/p' + i, {A: 1});
  assert.equal(p.of('resp').filter(m => m.path !== '/same').length, 13, '16 responses in all (the three above count), the rest are not described');
  for (let i = 0; i < 8; i += 1) p.call(URL_LIST, RESPONSE(1));
  assert.equal(p.of('resp').filter(m => m.path === '/ap/v3/sdk/media/campaigns').length, 6, 'the mission list always gets its turn');
});

test('cleanResp / parseTapMessage: only short names and numbers survive; a long string, a nested value or a script-supplied extra field does not', () => {
  const dirty = {type: 'resp', path: '/x?usn=SECRET', status: 200.4, kind: 'jsonjsonjsonjson', len: 1470961, top: 'object', n: 3.6, keys: ['A', 'B'.repeat(50), 5, null], item: ['K'], extra: 'SECRET-EXTRA',
    arrays: [{k: 'CampaignList', n: 456, item: ['Key', 'Title'], sub: [['Reward', ['Quantity', 'Unit']], ['bad']], value: 'SECRET'}, 'junk', {k: '', n: 1, item: []}]};
  const m = api.parseTapMessage(JSON.stringify(dirty));
  assert.equal(m.type, 'resp');
  assert.equal(m.path, '/x');
  assert.deepEqual([m.status, m.len, m.n], [200, 1470961, 4]);
  assert.equal(m.kind.length, 10);
  assert.equal(m.keys[1].length, 30);
  assert.equal(m.keys.length, 2, 'a number or null is not a key name');
  assert.equal(m.arrays.length, 1);
  assert.deepEqual(m.arrays[0], {k: 'CampaignList', n: 456, item: ['Key', 'Title'], sub: [['Reward', ['Quantity', 'Unit']]]});
  assert.equal(JSON.stringify(m).includes('SECRET'), false);
  assert.equal(api.parseTapMessage({type: 'resp', path: ''}), null);
  assert.equal(api.cleanResp(null), null);
});

test('webTapDiagBody: resp rides along (cleaned, at most 22) and is absent when there is none', () => {
  const base = {started: true, hello: 1, lists: 0, maxList: 0, details: 0, natives: 0, shapes: 1, paths: ['/a']};
  assert.equal('resp' in api.webTapDiagBody(base), false);
  const resp = Array.from({length: 30}, (_, i) => ({path: '/p' + i + '?q=SECRET', status: 200, kind: 'json', len: 10, keys: ['A'], item: [], arrays: [], extra: 'SECRET'}));
  const body = api.webTapDiagBody({...base, resp});
  assert.equal(body.resp.length, 22);
  assert.equal(body.resp[0].path, '/p0');
  assert.equal(JSON.stringify(body).includes('SECRET'), false);
});

// ---- the uploader keeps every campaign seen, not just the last message ----
test('tap uploader: lists from different tabs / batches are merged (newest row wins) before the one upload', async () => {
  const sent = [];
  let timer = null;
  const uploader = api.createTapUploader({upload: async body => { sent.push(body); return {}; }, setTimer: fn => { timer = fn; return 1; }, clearTimer() {}});
  const c = (key, name, extra = {}) => ({campaignKey: key, name, reward: 10, ...extra});
  uploader.handle({type: 'list', campaigns: [c('a', 'A'), c('b', 'B')]});
  uploader.handle({type: 'list', campaigns: [c('b', 'B2', {info: '새 설명'}), c('c', 'C')]});
  assert.equal(typeof timer, 'function');
  assert.equal(await uploader.flush(), 'sent');
  assert.deepEqual(sent[0].campaigns.map(x => [x.campaignKey, x.name]), [['a', 'A'], ['b', 'B2'], ['c', 'C']]);
  assert.equal(sent[0].campaigns[1].info, '새 설명');
});
