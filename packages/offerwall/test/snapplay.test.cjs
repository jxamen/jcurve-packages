const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;

let env;
Module._load = function (id, ...rest) {
  if (id === 'react-native') return {
    Platform: { OS: env.os }, NativeModules: env.native ? { S2OfferwallModule: {} } : {},
    UIManager: { getViewManagerConfig: (name) => (env.views || []).includes(name) ? {} : null },
    requireNativeComponent: (name) => 'Native:' + name,
  };
  if (id === 'react-native-s2offerwall') { env.requires++; if (!env.sdk) throw new Error("Cannot find module 'react-native-s2offerwall'"); return { S2Offerwall: env.sdk }; }
  return original.call(this, id, ...rest);
};

function fakeSdk(opts = {}) {
  const log = [];
  let initCb, loginCb;
  return {
    log,
    onInitCompleted(cb) { log.push('onInitCompleted'); initCb = cb; return { remove() {} }; },
    onLoginRequested(cb) { log.push('onLoginRequested'); loginCb = cb; return { remove() {} }; },
    async setAppIdForAndroid(id) { log.push(['setAppIdForAndroid', id]); },
    async setAppIdForIOS(id) { log.push(['setAppIdForIOS', id]); },
    async initSdk() { log.push('initSdk'); if (opts.silent) return; const flag = typeof opts.flag === 'function' ? opts.flag() : (opts.flag ?? true); setTimeout(() => initCb({ name: 'onInitCompleted', flag }), 0); },
    async setUserName(user, name) { log.push(['setUserName', user, name]); },
    async resetUserName() { log.push('resetUserName'); },
    async showOfferwall(placement) { log.push(['showOfferwall', placement]); if (opts.showFails) throw new Error('NO_VIEWCONTROLLER'); },
    emitLogin() { loginCb({ name: 'onLoginRequested', param: '' }); },
  };
}
function fresh() {
  for (const name of ['../dist/snapPlay.js', '../dist/chanceProviders.js']) delete require.cache[require.resolve(name)];
  const chance = require('../dist/chanceProviders');
  const snap = require('../dist/snapPlay');
  return { chance, snap, provider: () => chance.chanceProviderById('snapplay') };
}
const USN = 'a'.repeat(64);
const USN2 = 'b'.repeat(64);
const CONFIG = { ok: true, config: { ios: { appId: 'IOS-APP-ID' }, android: { appId: 'AND-APP-ID' } } };
beforeEach(() => { env = { os: 'ios', native: true, sdk: fakeSdk(), requires: 0 }; });

test('config: the documented shape, plain strings, mediaKey spelling, placement and enabled — and what is refused', () => {
  const { snap } = fresh();
  assert.deepEqual(snap.parseSnapPlayConfig(CONFIG), { android: 'AND-APP-ID', ios: 'IOS-APP-ID', placement: 'main', enabled: true, embed: true, listPlacement: '', open: false });
  assert.deepEqual(snap.parseSnapPlayConfig({ android: 'AAAA-1', ios: 'BBBB-2', placementName: 'chance_2', enabled: false }), { android: 'AAAA-1', ios: 'BBBB-2', placement: 'chance_2', enabled: false, embed: true, listPlacement: '', open: false });
  assert.equal(snap.parseSnapPlayConfig({ config: { ios: { mediaKey: ' MK-12345 ' } } }).ios, 'MK-12345');
  assert.equal(snap.parseSnapPlayConfig({ config: { ios: { appId: 'X1' } } }), null, 'too short to be an id');
  assert.equal(snap.parseSnapPlayConfig({ ok: false, config: CONFIG.config }), null);
  assert.equal(snap.parseSnapPlayConfig({ config: { ios: { appId: 'has space' } } }), null);
  assert.equal(snap.parseSnapPlayConfig({ config: { ios: { appId: 'IOS-APP-ID' }, placement: 'bad placement!' } }).placement, 'main');
  for (const bad of [null, undefined, 'x', 7, [], {}, { config: {} }]) assert.equal(snap.parseSnapPlayConfig(bad), null);
});

test('a build without the native module: provider is unavailable, the JS package is never required, the server is never asked', async () => {
  env.native = false;
  const { snap, provider, chance } = fresh();
  let asked = 0;
  const status = await snap.resolveSnapPlayConfig(async () => { asked++; return CONFIG; });
  assert.equal(asked, 0);
  assert.equal(status.native, false);
  snap.configureSnapPlay(CONFIG);
  assert.equal(provider().available(), false);
  assert.deepEqual(chance.chanceProviders().map((p) => p.id), ['adpopcorn']);
  assert.deepEqual(await provider().open({ usn: USN }), { ok: false, reason: 'not_ready', message: '잠시 후 다시 시도해 주세요' });
  assert.equal(env.requires, 0, 'require("react-native-s2offerwall") throws on a build without the module, so it must not be attempted');
});

test('native module present but no server config yet: unavailable; it turns on (and subscribers hear it) when the config arrives', async () => {
  const { snap, provider, chance } = fresh();
  assert.equal(provider().available(), false);
  let heard = 0;
  chance.subscribeChanceProviders(() => heard++);
  const status = await snap.resolveSnapPlayConfig(async () => CONFIG);
  assert.equal(heard, 1);
  assert.equal(provider().available(), true);
  assert.deepEqual([status.native, status.configured, status.hasAppId, status.initialized], [true, true, true, false]);
  let asked = 0;
  await snap.resolveSnapPlayConfig(async () => { asked++; return CONFIG; });
  assert.equal(asked, 0, 'already configured: not asked again');
});

test('a failing or odd config request leaves the provider off and does not throw', async () => {
  const { snap, provider } = fresh();
  await snap.resolveSnapPlayConfig(async () => { throw new Error('network'); });
  await snap.resolveSnapPlayConfig(async () => ({ ok: true, config: { ios: {} } }));
  assert.equal(provider().available(), false);
});

test('an OS without an app id, or a config switched off, turns the provider off', () => {
  const { snap, provider } = fresh();
  snap.configureSnapPlay({ config: { android: { appId: 'AND-APP-ID' } } });
  assert.equal(provider().available(), false, 'ios has no id');
  env.os = 'android';
  assert.equal(provider().available(), true);
  snap.configureSnapPlay({ config: { android: { appId: 'AND-APP-ID' }, enabled: false } });
  assert.equal(provider().available(), false);
});

test('module present but the JS package cannot be loaded: unavailable, no throw', () => {
  env.sdk = null;
  const { snap, provider } = fresh();
  snap.configureSnapPlay(CONFIG);
  assert.equal(provider().available(), false);
  assert.equal(env.requires, 1, 'tried once, remembered');
  provider().available();
  assert.equal(env.requires, 1);
});

test('open: app id → listeners → initSdk → (init done) → setUserName → showOfferwall, in that order, with the usn as the user', async () => {
  const { snap, provider } = fresh();
  snap.configureSnapPlay(CONFIG);
  assert.deepEqual(await provider().open({ usn: USN, displayName: '우리****' }), { ok: true });
  assert.deepEqual(env.sdk.log, ['onInitCompleted', 'onLoginRequested', ['setAppIdForIOS', 'IOS-APP-ID'], 'initSdk', ['setUserName', USN, '우리****'], ['showOfferwall', 'main']]);
  assert.equal(snap.snapPlayStatus().initialized, true);
});

test('Android uses setAppIdForAndroid and the placement the server gave', async () => {
  env.os = 'android';
  const { snap, provider } = fresh();
  snap.configureSnapPlay({ config: { ...CONFIG.config, placement: 'chance_2' } });
  assert.equal((await provider().open({ usn: USN })).ok, true);
  assert.deepEqual(env.sdk.log.filter((x) => Array.isArray(x)), [['setAppIdForAndroid', 'AND-APP-ID'], ['setUserName', USN, ''], ['showOfferwall', 'chance_2']]);
});

test('a second open reuses the initialized SDK and sets the user again only when the member changed', async () => {
  const { snap, provider } = fresh();
  snap.configureSnapPlay(CONFIG);
  await provider().open({ usn: USN });
  await provider().open({ usn: USN });
  await provider().open({ usn: USN2 });
  const log = env.sdk.log;
  assert.equal(log.filter((x) => x === 'initSdk').length, 1);
  assert.equal(log.filter((x) => x === 'onInitCompleted').length, 1);
  assert.deepEqual(log.filter((x) => Array.isArray(x) && x[0] === 'setUserName').map((x) => x[1]), [USN, USN2]);
  assert.equal(log.filter((x) => Array.isArray(x) && x[0] === 'showOfferwall').length, 3);
});

test('prepare warms the SDK up without showing it; open then only shows', async () => {
  const { snap, provider } = fresh();
  snap.configureSnapPlay(CONFIG);
  assert.equal((await provider().prepare({ usn: USN })).ok, true);
  assert.equal(env.sdk.log.some((x) => Array.isArray(x) && x[0] === 'showOfferwall'), false);
  await provider().open({ usn: USN });
  assert.equal(env.sdk.log.filter((x) => x === 'initSdk').length, 1);
});

test('two opens at once start the SDK once', async () => {
  const { snap, provider } = fresh();
  snap.configureSnapPlay(CONFIG);
  const results = await Promise.all([provider().open({ usn: USN }), provider().open({ usn: USN })]);
  assert.deepEqual(results.map((r) => r.ok), [true, true]);
  assert.equal(env.sdk.log.filter((x) => x === 'initSdk').length, 1);
});

test('the SDK asking for a login answers with the latest member', async () => {
  const { snap, provider } = fresh();
  snap.configureSnapPlay(CONFIG);
  await provider().open({ usn: USN, displayName: 'N' });
  env.sdk.log.length = 0;
  env.sdk.emitLogin();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(env.sdk.log, [['setUserName', USN, 'N']]);
});

test('init failure → not_ready, nothing shown, and the next open starts over without binding listeners twice', async () => {
  let flag = false;
  env.sdk = fakeSdk({ flag: () => flag });
  const { snap, provider } = fresh();
  snap.configureSnapPlay(CONFIG);
  assert.equal((await provider().open({ usn: USN })).ok, false);
  assert.equal(env.sdk.log.some((x) => Array.isArray(x) && x[0] === 'showOfferwall'), false);
  flag = true;
  assert.deepEqual(await provider().open({ usn: USN }), { ok: true });
  assert.equal(env.sdk.log.filter((x) => x === 'onInitCompleted').length, 1);
  assert.equal(env.sdk.log.filter((x) => x === 'initSdk').length, 2);
});

test('an init that never answers gives up after the timeout (not_ready) instead of hanging', async (t) => {
  env.sdk = fakeSdk({ silent: true });
  const { snap, provider } = fresh();
  snap.configureSnapPlay(CONFIG);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = provider().open({ usn: USN });
  await new Promise((r) => setImmediate(r));
  t.mock.timers.tick(snap.SNAPPLAY_INIT_TIMEOUT_MS);
  assert.deepEqual(await pending, { ok: false, reason: 'not_ready', message: '잠시 후 다시 시도해 주세요' });
});

test('not a 64-hex alias → invalid_usn and the SDK is not touched; showOfferwall refusing → sdk_error', async () => {
  const { snap, provider } = fresh();
  snap.configureSnapPlay(CONFIG);
  for (const usn of ['', 'member-17', 'A'.repeat(64), '1234567890']) assert.equal((await provider().open({ usn })).reason, 'invalid_usn');
  assert.equal(env.sdk.log.length, 0);
  env.sdk = fakeSdk({ showFails: true });
  const second = fresh();
  second.snap.configureSnapPlay(CONFIG);
  assert.equal((await second.provider().open({ usn: USN })).reason, 'sdk_error');
});

test('forgetSnapPlayUser resets the SDK user only after the SDK was started, and the next open sets the member again', async () => {
  const { snap, provider } = fresh();
  snap.configureSnapPlay(CONFIG);
  snap.forgetSnapPlayUser();
  assert.equal(env.sdk.log.length, 0, 'never started: nothing to reset, nothing touched');
  await provider().open({ usn: USN });
  snap.forgetSnapPlayUser();
  await new Promise((r) => setImmediate(r));
  assert.equal(env.sdk.log.includes('resetUserName'), true);
  await provider().open({ usn: USN });
  assert.equal(env.sdk.log.filter((x) => Array.isArray(x) && x[0] === 'setUserName').length, 2);
});

test('the package never clears listeners or asks for the tracking prompt', async () => {
  const { snap, provider } = fresh();
  snap.configureSnapPlay(CONFIG);
  env.sdk.removeAllListeners = () => { throw new Error('must not be called'); };
  env.sdk.presentATTPopup = () => { throw new Error('must not be called'); };
  assert.equal((await provider().open({ usn: USN })).ok, true);
});

test('resetOfferwall() also forgets the SnapPlay member (wired in index.ts)', () => {
  const fs = require('node:fs');
  const index = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
  assert.match(index, /export function resetOfferwall\(\): void \{[^}]*forgetSnapPlayUser\(\)/);
});

test('0.6.0 view: available only with the native module AND the registered JCurveSnapPlayView; a 0.5.0 binary (module, no view) keeps the modal path', () => {
  const { snap, provider } = fresh();
  snap.configureSnapPlay(CONFIG);
  assert.equal(snap.SNAPPLAY_VIEW_NAME, 'JCurveSnapPlayView');
  assert.equal(snap.snapPlayViewAvailable(), false);
  assert.equal(provider().canEmbed(), false);
  assert.equal(provider().embed({ onClose() {} }), null, 'no view in this build: nothing to embed');
  env.views = ['JCurveSnapPlayView'];
  assert.equal(snap.snapPlayViewAvailable(), true);
  assert.equal(provider().canEmbed(), true);
  env.native = false;
  assert.equal(snap.snapPlayViewAvailable(), false, 'no SnapPlay module: no view either');
});

test('0.6.0 view: the embedded element carries the server placement, fills the tab, and its login / close events do the right thing', async () => {
  env.views = ['JCurveSnapPlayView'];
  const { snap, provider } = fresh();
  snap.configureSnapPlay({ config: { ...CONFIG.config, placement: 'chance_2' } });
  await provider().prepare({ usn: USN, displayName: 'N**' });
  let closed = 0;
  const element = provider().embed({ onClose: () => { closed++; } });
  assert.equal(element.props.placement, undefined, 'the wrapper component renders the native view');
  const React = require('react');
  const rendered = element.type(element.props);
  assert.equal(rendered.type, 'Native:JCurveSnapPlayView');
  assert.equal(rendered.props.placement, 'chance_2');
  assert.deepEqual(rendered.props.style[0], { flex: 1 });
  env.sdk.log.length = 0;
  rendered.props.onLoginRequested();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(env.sdk.log, [['setUserName', USN, 'N**']], 'the view asked for a login: answered with the latest member');
  rendered.props.onCloseRequested();
  assert.equal(closed, 1);
  void React;
});

test('0.6.0 kill switch: embed:false in the server config keeps the full-screen modal even when the build has the view', () => {
  env.views = ['JCurveSnapPlayView'];
  const { snap, provider } = fresh();
  assert.equal(snap.parseSnapPlayConfig(CONFIG).embed, true);
  snap.configureSnapPlay({ config: { ...CONFIG.config, embed: false } });
  assert.equal(snap.parseSnapPlayConfig({ config: { ...CONFIG.config, embed: false } }).embed, false);
  assert.equal(snap.snapPlayViewAvailable(), false);
  assert.equal(provider().canEmbed(), false);
  assert.equal(provider().embed({ onClose() {} }), null);
  snap.configureSnapPlay(CONFIG);
  assert.equal(provider().canEmbed(), true);
});

