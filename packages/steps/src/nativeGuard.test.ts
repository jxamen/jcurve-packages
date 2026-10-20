import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
describe('0.1.1 native guard', () => {
 for (const os of ['ios', 'android']) it(`does not require missing native SDKs on old ${os} binaries`, async () => {
  const loaded: string[] = [];
  const module = { exports: {} as any };
  const js = ts.transpileModule(readFileSync(new URL('./source.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  runInNewContext(js, { exports: module.exports, module, require: (id: string) => {
   loaded.push(id);
   if (id === 'react-native') return { Platform: { OS: os }, TurboModuleRegistry: { get: () => null }, NativeModules: {} };
   if (id === 'expo-modules-core') return { requireOptionalNativeModule: () => null };
   if (id === './storage') return { getStepsStorage: () => ({}) };
   if (id === './days') return {};
   throw Error('dangerous SDK require: ' + id);
  } });
  expect((await module.exports.readToday()).status).toBe('unavailable');
  module.exports.watchSteps(() => {})();
  expect(loaded).not.toContain('expo-sensors'); expect(loaded).not.toContain('react-native-health-connect');
 });
});
