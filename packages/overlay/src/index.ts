import { Platform } from 'react-native';

export type FloatingPopupParams = {
  imageUrl: string;
  name: string;
  price: string;
  durationSec: number;
};

type NativeModule = {
  hasPermission: () => boolean;
  requestPermission: () => void;
  show: (params: FloatingPopupParams) => Promise<boolean>;
  hide: () => void;
};

/** 네이티브 모듈(Expo Module `JcurveOverlay`) — 이 패키지가 든 빌드가 아니면 null(OTA 만 받은 옛 빌드 · 웹 · 시험) */
let JcurveOverlayModule: NativeModule | null = null;
try {
  if (Platform.OS === 'android') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireNativeModule } = require('expo-modules-core') as { requireNativeModule: (name: string) => NativeModule };
    JcurveOverlayModule = requireNativeModule('JcurveOverlay');
  }
} catch {
  JcurveOverlayModule = null;   // 모듈이 없는 빌드 — 모든 함수가 false · 아무 일 안 함
}

/** Check if overlay module is available on this platform. */
export function isAvailable(): boolean {
  return JcurveOverlayModule !== null && Platform.OS === 'android';
}

/** Check if device has overlay permission (Android only; always false on iOS). */
export function hasPermission(): boolean {
  if (!isAvailable()) return false;
  return JcurveOverlayModule!.hasPermission();
}

/** Request overlay permission from user (Android only; no-op on iOS). */
export function requestPermission(): void {
  if (!isAvailable()) return;
  JcurveOverlayModule!.requestPermission();
}

/** Show floating popup card with image, product name, and price. Returns success status. */
export async function show(params: FloatingPopupParams): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    return await JcurveOverlayModule!.show(params);
  } catch (e) {
    console.error('[JcurveOverlay] show error:', e);
    return false;
  }
}

/** Hide the floating popup. */
export function hide(): void {
  if (!isAvailable()) return;
  JcurveOverlayModule!.hide();
}
