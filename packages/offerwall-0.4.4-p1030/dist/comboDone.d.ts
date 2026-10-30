/** AsyncStorage-shaped, so an app can hand over `AsyncStorage` itself. */
export type ComboStorage = {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<unknown>;
};
export declare const doneStorageKey: (scope: string | number | undefined) => string;
/** Most keys kept per member; the oldest ticks drop out first. */
export declare const MAX_DONE_KEYS = 1000;
/**
 * Keys stored for a member. Reads the field `ids` (written by this and by earlier versions) or `keys`; the day written in `d` is not
 * a limit any more. Broken JSON or the wrong shape mean "nothing done".
 */
export declare function parseDone(value: string | null | undefined): string[];
/** Test helper: forget the in-memory ticks. */
export declare function resetDoneMemory(): void;
export type DoneMissions = {
    done: ReadonlySet<string>;
    toggle(key: string): void;
};
/**
 * `scope` = member (a different member on the same phone has their own ticks). Written as `{ d, ids }` so an older version
 * of this package can still read it after a rollback.
 */
export declare function useDoneMissions({ storage, scope }: {
    storage?: ComboStorage;
    scope?: string | number;
}): DoneMissions;
