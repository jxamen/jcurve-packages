import type { ComboStorage } from './comboDone';
export declare const seenStorageKey: (scope: string | number | undefined) => string;
/** True only for a value written on exactly this day. Anything else (another day, broken JSON) means "not seen". */
export declare function parseSeen(value: string | null | undefined, date: string): boolean;
export type SeenToday = {
    /** null until the stored value was read (the chip stays still meanwhile, so it never starts and stops at launch). */
    seen: boolean | null;
    markSeen(): void;
};
export declare function useSeenToday({ storage, scope, date }: {
    storage?: ComboStorage;
    scope?: string | number;
    date?: string;
}): SeenToday;
/** Test helper: forget what was seen in memory. */
export declare function resetSeenMemory(): void;
/**
 * A slow fade between full and 55 % opacity (650 ms each way, a 1.3 s cycle) while `active`. Uses the native driver, so it
 * costs nothing on the JS thread. Stays still when the device asks to reduce motion, and until that setting has been read.
 * Returns the animated opacity to put on a wrapper view (it rests at 1).
 */
export declare function usePulse(active: boolean): import('react-native').Animated.Value;
