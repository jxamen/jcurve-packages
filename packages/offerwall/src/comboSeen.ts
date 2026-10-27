/**
 * Has the member opened the guide today? Until they do, the chip and the Home banner blink; opening it once stops
 * both for the rest of the Korean day. Kept per member on the device (AsyncStorage-shaped `storage`), in memory when
 * the app gives none. The chip (Chance tab) and the banner (Home) are separate components, so they share it here.
 */
import { kstDate } from './combos';
import type { ComboStorage } from './comboDone';

const memory = new Map<string, string>();
const subscribers = new Set<() => void>();

export const seenStorageKey = (scope: string | number | undefined): string => `jcurve.combos.seen:${scope ?? ''}`;
/** The recommendation popup was shown today (once a day per member, whether or not it was acted on). */
export const popupStorageKey = (scope: string | number | undefined): string => `jcurve.combos.popup:${scope ?? ''}`;
/** True only for a value written on exactly this day. Anything else (another day, broken JSON) means "not seen". */
export function parseSeen(value: string | null | undefined, date: string): boolean {
  try {
    const v = JSON.parse(value ?? 'null');
    return !!v && v.d === date;
  } catch { return false; }
}

export type SeenToday = {
  /** null until the stored value was read (the chip stays still meanwhile, so it never starts and stops at launch). */
  seen: boolean | null;
  markSeen(): void;
};
export function useSeenToday({ storage, scope, date, keyOf = seenStorageKey }: {
  storage?: ComboStorage; scope?: string | number; date?: string; /** Which stored flag: default is "opened the guide today". */ keyOf?: (scope: string | number | undefined) => string;
}): SeenToday {
  const React = require('react') as typeof import('react');
  const day = date ?? kstDate();
  const key = `${scope ?? ''}|${day}`;
  const [state, setState] = React.useState<{ key: string; seen: boolean | null }>({ key, seen: storage ? null : parseSeen(memory.get(keyOf(scope)), day) });
  React.useEffect(() => {
    let live = true;
    const read = () => {
      if (!storage) { setState({ key, seen: parseSeen(memory.get(keyOf(scope)), day) }); return; }
      Promise.resolve(storage.getItem(keyOf(scope))).then(value => {
        if (live) setState(prev => ({ key, seen: parseSeen(value, day) || (prev.key === key && prev.seen === true) }));
      }).catch(() => { if (live) setState({ key, seen: false }); });
    };
    read();
    subscribers.add(read);
    return () => { live = false; subscribers.delete(read); };
  }, [key, storage]);
  const markSeen = () => {
    const value = JSON.stringify({ d: day });
    memory.set(keyOf(scope), value);
    setState({ key, seen: true });
    try { Promise.resolve(storage?.setItem(keyOf(scope), value)).catch(() => {}); } catch { /* storage is best effort */ }
    // The other entry (chip <-> banner) reads again, after the write had its chance to land.
    for (const notify of [...subscribers]) { try { notify(); } catch { /* one bad subscriber must not stop the rest */ } }
  };
  return { seen: state.key === key ? state.seen : (storage ? null : parseSeen(memory.get(keyOf(scope)), day)), markSeen };
}

/** Test helper: forget what was seen in memory. */
export function resetSeenMemory(): void { memory.clear(); }

/**
 * A slow fade between full and 55 % opacity (650 ms each way, a 1.3 s cycle) while `active`. Uses the native driver, so it
 * costs nothing on the JS thread. Stays still when the device asks to reduce motion, and until that setting has been read.
 * Returns the animated opacity to put on a wrapper view (it rests at 1).
 */
export function usePulse(active: boolean): import('react-native').Animated.Value {
  const React = require('react') as typeof import('react');
  const { Animated, AccessibilityInfo, Easing } = require('react-native') as typeof import('react-native');
  const opacity = React.useRef<import('react-native').Animated.Value | null>(null);
  if (!opacity.current) opacity.current = new Animated.Value(1);
  const [reduceMotion, setReduceMotion] = React.useState(true);
  React.useEffect(() => {
    let live = true;
    let changed = false;
    let subscription: { remove(): void } | undefined;
    try {
      subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { changed = true; if (live) setReduceMotion(value); });
      Promise.resolve(AccessibilityInfo.isReduceMotionEnabled()).then(value => { if (live && !changed) setReduceMotion(value); }).catch(() => {});
    } catch { /* no accessibility info: stay still */ }
    return () => { live = false; try { subscription?.remove(); } catch { /* ignore */ } };
  }, []);
  React.useEffect(() => {
    const value = opacity.current!;
    value.setValue(1);
    if (!active || reduceMotion) return;
    const fade = (toValue: number) => Animated.timing(value, { toValue, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([fade(0.55), fade(1)]));
    loop.start();
    return () => { loop.stop(); value.setValue(1); };
  }, [active, reduceMotion]);
  return opacity.current!;
}
