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

/**
 * 0.5.1 — the height of the 「찬스1 · 찬스2」 tab row that `OfferwallScreen` draws above the wall (0 when there are no tabs). `ComboEntry` sits beside the screen in the
 * app, positioned from the top of the same box; its chip row, sheet and toast move down by this much so they land under the tab row (on the wall's own header row
 * / the same place on 찬스2) instead of covering the tabs.
 */
type InsetListener = (inset: number) => void;
const insetListeners = new Set<InsetListener>();
let tabInset = 0;
export function setChanceTabInset(px: number): void {
  const next = Number.isFinite(px) && px > 0 ? Math.round(px) : 0;
  if (next === tabInset) return;
  tabInset = next;
  for (const listener of [...insetListeners]) { try { listener(next); } catch { /* one bad listener must not stop the rest */ } }
}
export function getChanceTabInset(): number { return tabInset; }
/** Calls back whenever the tab row's height changes. Returns the unsubscribe function. */
export function onChanceTabInset(listener: InsetListener): () => void {
  insetListeners.add(listener);
  return () => { insetListeners.delete(listener); };
}


/**
 * 0.6.2 — which 「찬스」 tab is up (`'adpopcorn'` = 찬스1, `'snapplay'` = 찬스2). `OfferwallScreen` sets it when the member picks a tab (and back to `'adpopcorn'` when there are no tabs or the
 * screen goes away); `ComboEntry` follows it, so 「포인트 빨리 모으기」 shows each tab's own list.
 */
type TabListener = (id: string) => void;
const tabListeners = new Set<TabListener>();
let chanceTab = 'adpopcorn';
export function setChanceTab(id: string): void {
  const next = typeof id === 'string' && id ? id : 'adpopcorn';
  if (next === chanceTab) return;
  chanceTab = next;
  for (const listener of [...tabListeners]) { try { listener(next); } catch { /* one bad listener must not stop the rest */ } }
}
export function getChanceTab(): string { return chanceTab; }
/** Calls back whenever the picked 찬스 tab changes. Returns the unsubscribe function. */
export function onChanceTab(listener: TabListener): () => void {
  tabListeners.add(listener);
  return () => { tabListeners.delete(listener); };
}
