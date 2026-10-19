export type StepsStorage = {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
};
/** Use an account-specific namespace. Never mix different members' sensor counts. */
export declare function configureStepsStorage(storage: StepsStorage, namespace: string): void;
/** A subscription retains its own account even when configuration changes. */
export declare function getStepsStorage(): {
    getJson<T>(key: string): Promise<T | null>;
    setJson(key: string, value: unknown): Promise<void>;
};
export declare const stepsStorage: {
    getJson: <T>(key: string) => Promise<T | null>;
    setJson: (key: string, value: unknown) => Promise<void>;
};
