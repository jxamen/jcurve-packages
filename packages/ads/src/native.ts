/*
 | **네이티브가 있는지 먼저 본다 — 없는 모듈을 require 하면 앱이 죽는다**(1.9.6, @jcurve/steps 0.1.1 과 같은 방식 · 당근 10-19 23:00 운영 사고).
 | 앱이 다 뜬 뒤 함수 안에서 부른 require 는 Metro 가 `guardedLoadModule` 로 감싸, 모듈을 읽다 던진 오류를
 | 호출한 쪽 try 로 돌려주지 않고 `ErrorUtils.reportFatalError` 로 보낸다(expo-updates 가 복구 못 하면 강제 종료).
 | expo-tracking-transparency 는 읽을 때 `requireNativeModule('ExpoTrackingTransparency')` 라, 그 모듈이 없는 옛 바이너리에
 | OTA 로 얹히면 바로 이 길로 간다. 그래서 던지지 않는 조회로 있을 때만 require 한다.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

/** 모듈 읽기 — 시험에서는 가짜를 넣는다 */
export type ModuleLoader = (id: string) => any;
const defaultLoad: ModuleLoader = (id) => {
  switch (id) {   // Metro 가 경로를 알 수 있게 글자 그대로 require 한다
    case 'expo-modules-core': return require('expo-modules-core');
    case 'react-native': return require('react-native');
    case 'expo-tracking-transparency': return require('expo-tracking-transparency');
    default: return null;
  }
};

/** 네이티브 모듈이 이 바이너리에 있나 — 던지지 않는다 */
export function nativeExists(name: string, load: ModuleLoader = defaultLoad): boolean {
  try {
    const core = load('expo-modules-core') as { requireOptionalNativeModule?: (n: string) => unknown };
    if (core?.requireOptionalNativeModule?.(name)) return true;
  } catch { /* 아래 */ }
  try {
    const rn = load('react-native') as { TurboModuleRegistry?: { get?: (n: string) => unknown }; NativeModules?: Record<string, unknown> };
    return !!(rn?.TurboModuleRegistry?.get?.(name) ?? rn?.NativeModules?.[name]);
  } catch {
    return false;
  }
}

/** expo-tracking-transparency 의 네이티브 이름(그 패키지 ios/TrackingTransparencyModule.swift `Name("ExpoTrackingTransparency")`) */
export const TRACKING_NATIVE = 'ExpoTrackingTransparency';

/** expo-tracking-transparency — 네이티브가 있을 때만 읽는다. 없거나 읽다 실패하면 null */
export function requireTracking(load: ModuleLoader = defaultLoad): any | null {
  if (!nativeExists(TRACKING_NATIVE, load)) return null;
  try {
    return load('expo-tracking-transparency');
  } catch {
    return null;
  }
}
