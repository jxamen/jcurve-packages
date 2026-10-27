/**
 * Showing one campaign's detail INSIDE the Chance tab's embedded wall (iOS `AdPopcornOfferwallViewController.detailPageCampaignKey`,
 * the `detailCampaignKey` view prop that 0.3.0 binaries already have), so the RN chip stays on top of it. The SDK's full-screen
 * detail is a native screen and covers every RN view.
 *
 * `ComboEntry` asks (`openEmbeddedDetail`), the mounted `OfferwallScreen` answers by remounting its wall with the key and
 * telling when it loaded. Pure JS: no native lookup of its own, nothing runs at import time. Without a mounted wall (Home, Android,
 * a binary without the bridge) the answer is simply "no" and the caller uses the SDK's full-screen detail as before.
 */
import { hasNativeBridge } from './native';

export type EmbeddedDetailRequest = { key: string; nonce: number };
type Show = (request: EmbeddedDetailRequest | null) => void;

/** How long the embedded detail may take to report "loaded" before the caller gives up and opens the SDK's full-screen detail. */
export const EMBEDDED_DETAIL_TIMEOUT_MS = 10_000;

const walls: Show[] = [];
let counter = 0;
let pending: { nonce: number; resolve: (shown: boolean) => void; timer: ReturnType<typeof setTimeout> } | null = null;

/** iOS with the native bridge: the only place the embedded wall can take a detail key. Never throws. */
export function embeddedDetailSupported(): boolean {
  try {
    const rn = require('react-native') as typeof import('react-native');
    return rn.Platform.OS === 'ios' && hasNativeBridge();
  } catch { return false; }
}

/** A mounted wall that can show a detail registers here; the last one registered answers. Returns the unregister function. */
export function registerEmbeddedWall(show: Show): () => void {
  walls.push(show);
  return () => {
    const at = walls.indexOf(show);
    if (at >= 0) walls.splice(at, 1);
    if (!walls.length && pending) settle(pending.nonce, false, false);
  };
}

/** True when a wall is mounted that can open a detail. */
export function embeddedDetailAvailable(): boolean { return walls.length > 0; }

function settle(nonce: number, shown: boolean, resetWall: boolean): void {
  if (!pending || pending.nonce !== nonce) return;
  const { resolve, timer } = pending;
  clearTimeout(timer);
  pending = null;
  if (!shown && resetWall) walls[walls.length - 1]?.(null); // back to the plain list
  resolve(shown);
}

/**
 * Asks the mounted wall to show this campaign's detail. Resolves true once the wall reports it loaded; false when no wall
 * is mounted, the wall fails, or `timeoutMs` passes (the wall is then put back to the list). A newer request replaces an older one.
 */
export function openEmbeddedDetail(key: string, timeoutMs: number = EMBEDDED_DETAIL_TIMEOUT_MS): Promise<boolean> {
  const wall = walls[walls.length - 1];
  if (!wall || !key) return Promise.resolve(false);
  if (pending) settle(pending.nonce, false, false);
  const nonce = ++counter;
  return new Promise<boolean>(resolve => {
    pending = { nonce, resolve, timer: setTimeout(() => settle(nonce, false, true), timeoutMs) };
    try { wall({ key, nonce }); } catch { settle(nonce, false, false); }
  });
}

/** The wall calls these from its native view's events. */
export function embeddedDetailLoaded(nonce: number): void { settle(nonce, true, false); }
export function embeddedDetailFailed(nonce: number): void { settle(nonce, false, true); }
