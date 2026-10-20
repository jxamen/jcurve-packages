/** 모듈 읽기 — 시험에서는 가짜를 넣는다 */
export type ModuleLoader = (id: string) => any;
/** 네이티브 모듈이 이 바이너리에 있나 — 던지지 않는다 */
export declare function nativeExists(name: string, load?: ModuleLoader): boolean;
/** expo-tracking-transparency 의 네이티브 이름(그 패키지 ios/TrackingTransparencyModule.swift `Name("ExpoTrackingTransparency")`) */
export declare const TRACKING_NATIVE = "ExpoTrackingTransparency";
/** expo-tracking-transparency — 네이티브가 있을 때만 읽는다. 없거나 읽다 실패하면 null */
export declare function requireTracking(load?: ModuleLoader): any | null;
