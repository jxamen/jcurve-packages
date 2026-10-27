/**
 * Tells whether the Chance tab's wall (`OfferwallScreen`) has finished loading. `ComboEntry` sits beside the wall, not inside
 * it, and shows its recommendation popup only once the wall is up. Pure JS, nothing runs at import time.
 */
type Listener = (loaded: boolean) => void;
const listeners = new Set<Listener>();
let loaded = false;

function set(value: boolean): void {
  if (loaded === value) return;
  loaded = value;
  for (const listener of [...listeners]) { try { listener(value); } catch { /* one bad listener must not stop the rest */ } }
}

export function notifyWallLoaded(): void { set(true); }
/** The wall went away (tab left, member changed) or is loading again. */
export function notifyWallGone(): void { set(false); }
export function isWallLoaded(): boolean { return loaded; }
/** Calls back with `true` when the wall has loaded and `false` when it is gone. Returns the unsubscribe function. */
export function onWallState(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
