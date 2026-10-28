const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const reg = require('../dist/chanceProviders');

const added = [];
const add = (provider) => { added.push(provider.id); reg.registerChanceProvider(provider); return provider; };
afterEach(() => { for (const id of added.splice(0)) reg.unregisterChanceProvider(id); });
const ids = () => reg.chanceProviders().map((provider) => provider.id);

test('AdPopcorn is registered first and is the only provider until another one registers', () => {
  assert.deepEqual(ids(), ['adpopcorn']);
  assert.equal(reg.ADPOPCORN_PROVIDER_ID, 'adpopcorn');
  assert.equal(reg.chanceProviderById('adpopcorn').kind, 'embedded');
});

test('tab order is registration order; re-registering an id replaces it in place', () => {
  add({ id: 'a', name: 'A', kind: 'launcher', available: () => true });
  add({ id: 'b', name: 'B', kind: 'launcher', available: () => true });
  assert.deepEqual(ids(), ['adpopcorn', 'a', 'b']);
  add({ id: 'a', name: 'A2', kind: 'launcher', available: () => true });
  assert.deepEqual(ids(), ['adpopcorn', 'a', 'b']);
  assert.equal(reg.chanceProviderById('a').name, 'A2');
});

test('only providers that say they are available are listed; a throwing available() counts as unavailable', () => {
  let on = false;
  add({ id: 'late', name: 'Late', kind: 'launcher', available: () => on });
  add({ id: 'broken', name: 'Broken', kind: 'launcher', available: () => { throw new Error('boom'); } });
  assert.deepEqual(ids(), ['adpopcorn']);
  on = true;
  assert.deepEqual(ids(), ['adpopcorn', 'late']);
});

test('subscribers hear register, unregister and notify; one bad subscriber does not stop the others; unsubscribe works', () => {
  const heard = [];
  const stop = reg.subscribeChanceProviders(() => { throw new Error('bad listener'); });
  const stop2 = reg.subscribeChanceProviders(() => heard.push('ok'));
  add({ id: 'x', name: 'X', kind: 'launcher', available: () => true });
  reg.notifyChanceProviders();
  reg.unregisterChanceProvider('x');
  assert.equal(heard.length, 3);
  stop2();
  reg.notifyChanceProviders();
  assert.equal(heard.length, 3);
  stop();
});

test('importing the registry runs nothing but one object insert (no native lookups)', () => {
  const Module = require('node:module');
  const original = Module._load;
  let touched = 0;
  Module._load = function (id, ...rest) { if (id === 'react-native') touched++; return original.call(this, id, ...rest); };
  try {
    delete require.cache[require.resolve('../dist/chanceProviders')];
    require('../dist/chanceProviders');
  } finally { Module._load = original; }
  assert.equal(touched, 0);
});
