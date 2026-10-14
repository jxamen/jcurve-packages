import { Platform } from 'react-native';

export type FloatingPopupParams = {
  imageUrl: string;
  name: string;
  price: string;
  durationSec: number;
};

let JcurveOverlayModule: {
  hasPermission: () => boolean;
  requestPermission: () => void;
  show: (params: FloatingPopupParams) => Promise<boolean>;
  hide: () => void;
} | null = null;

try {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    JcurveOverlayModule = require('jcurve-overlay-module');
  }
} catch (e) {
  // Module not available (likely during testing or in web environment)
  JcurveOverlayModule = null;
}

/** Check if overlay module is available on this platform. */
export function isAvailable(): boolean {
  return JcurveOverlayModule !== null && (Platform.OS === 'android' || Platform.OS === 'ios');
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
