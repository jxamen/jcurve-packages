import { describe, expect, it } from 'vitest';
import { nativeExists, requireTracking, TRACKING_NATIVE, type ModuleLoader } from './native';

/** 가짜 모듈 읽기 — 읽은 이름을 남긴다 */
function loader(mods: Record<string, unknown>, seen: string[] = []): ModuleLoader {
  return (id) => {
    seen.push(id);
    if (!(id in mods)) throw new Error(`Cannot find module '${id}'`);
    const m = mods[id];
    if (m instanceof Error) throw m;

    return m;
  };
}

describe('nativeExists — 던지지 않는 조회', () => {
  it('expo-modules-core 의 requireOptionalNativeModule 이 찾으면 있다', () => {
    expect(nativeExists('X', loader({ 'expo-modules-core': { requireOptionalNativeModule: (n: string) => (n === 'X' ? {} : null) } }))).toBe(true);
  });
  it('core 가 없거나 못 찾으면 TurboModuleRegistry · NativeModules 로 본다', () => {
    expect(nativeExists('X', loader({ 'react-native': { TurboModuleRegistry: { get: () => ({}) } } }))).toBe(true);
    expect(nativeExists('X', loader({ 'expo-modules-core': { requireOptionalNativeModule: () => null }, 'react-native': { NativeModules: { X: {} } } }))).toBe(true);
  });
  it('어디에도 없거나 읽기가 던지면 없다(던지지 않는다)', () => {
    expect(nativeExists('X', loader({}))).toBe(false);
    expect(nativeExists('X', loader({ 'expo-modules-core': new Error('boom'), 'react-native': new Error('boom') }))).toBe(false);
    expect(nativeExists('X', loader({ 'expo-modules-core': { requireOptionalNativeModule: () => null }, 'react-native': {} }))).toBe(false);
  });
});

describe('requireTracking — 네이티브가 있을 때만 읽는다', () => {
  const tracking = { getTrackingPermissionsAsync: async () => ({ status: 'denied' }) };

  it('네이티브가 없는 바이너리에서는 expo-tracking-transparency 를 아예 require 하지 않는다(옛 바이너리 OTA 크래시 방지)', () => {
    const seen: string[] = [];
    expect(requireTracking(loader({ 'expo-modules-core': { requireOptionalNativeModule: () => null }, 'react-native': {}, 'expo-tracking-transparency': tracking }, seen))).toBeNull();
    expect(seen).not.toContain('expo-tracking-transparency');
  });
  it('네이티브가 있으면 읽어 돌려준다', () => {
    const seen: string[] = [];
    const core = { requireOptionalNativeModule: (n: string) => (n === TRACKING_NATIVE ? {} : null) };
    expect(requireTracking(loader({ 'expo-modules-core': core, 'expo-tracking-transparency': tracking }, seen))).toBe(tracking);
    expect(seen).toContain('expo-tracking-transparency');
  });
  it('있다고 나와도 읽다 던지면 null', () => {
    const core = { requireOptionalNativeModule: () => ({}) };
    expect(requireTracking(loader({ 'expo-modules-core': core, 'expo-tracking-transparency': new Error('init') }))).toBeNull();
  });
  it('네이티브 이름은 그 패키지가 찾는 이름과 같다', () => {
    expect(TRACKING_NATIVE).toBe('ExpoTrackingTransparency');
  });
});
