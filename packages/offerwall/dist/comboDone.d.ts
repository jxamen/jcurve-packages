/** AsyncStorage-shaped, so an app can hand over `AsyncStorage` itself. */
export type ComboStorage = {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<unknown>;
};
export declare const doneStorageKey: (scope: string | number | undefined) => string;
/** Ids stored for exactly this day; another day, broken JSON or the wrong shape mean "nothing done". */
export declare function parseDone(value: string | null | undefined, date: string): string[];
export type DoneMissions = {
    done: ReadonlySet<string>;
    toggle(id: string): void;
};
/**
 * `scope` = member (a different member on the same phone has their own marks); `date` = the combos' day, so a new day
 * starts empty. Without `storage` the marks only live until the app is closed.
 */
export declare function useDoneMissions({ storage, scope, date }: {
    storage?: ComboStorage;
    scope?: string | number;
    date?: string;
}): DoneMissions;
