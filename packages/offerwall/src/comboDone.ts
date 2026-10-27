/** Which combo missions the user ticked as done: kept on the device for one Korean day, per member. */
import { kstDate } from './combos';

/** AsyncStorage-shaped, so an app can hand over `AsyncStorage` itself. */
export type ComboStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
};

export const doneStorageKey = (scope: string | number | undefined): string => `jcurve.combos.done:${scope ?? ''}`;

/** Ids stored for exactly this day; another day, broken JSON or the wrong shape mean "nothing done". */
export function parseDone(value: string | null | undefined, date: string): string[] {
  try {
    const v = JSON.parse(value ?? 'null');
    if (v && v.d === date && Array.isArray(v.ids)) return v.ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64).slice(0, 200);
  } catch { /* nothing stored, or not ours */ }
  return [];
}

export type DoneMissions = { done: ReadonlySet<string>; toggle(id: string): void };
/**
 * `scope` = member (a different member on the same phone has their own marks); `date` = the combos' day, so a new day
 * starts empty. Without `storage` the marks only live until the app is closed.
 */
export function useDoneMissions({ storage, scope, date }: { storage?: ComboStorage; scope?: string | number; date?: string }): DoneMissions {
  const React = require('react') as typeof import('react');
  const day = date ?? kstDate();
  const key = `${scope ?? ''}|${day}`;
  const [state, setState] = React.useState<{ key: string; ids: string[] }>({ key, ids: [] });
  React.useEffect(() => {
    if (!storage) return;
    let live = true;
    Promise.resolve(storage.getItem(doneStorageKey(scope))).then(value => {
      const stored = parseDone(value, day);
      // Ticks made while this was loading are kept.
      if (live) setState(prev => ({ key, ids: [...new Set([...stored, ...(prev.key === key ? prev.ids : [])])] }));
    }).catch(() => {});
    return () => { live = false; };
  }, [key, storage]);
  const ids = state.key === key ? state.ids : [];
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    setState({ key, ids: next });
    try { Promise.resolve(storage?.setItem(doneStorageKey(scope), JSON.stringify({ d: day, ids: next }))).catch(() => {}); } catch { /* storage is best effort */ }
  };
  return { done: new Set(ids), toggle };
}
