export interface Storage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
}
export interface Configuration {
    apiKey: string;
    appId: string;
    storage: Storage;
}
export declare function configure(value: Configuration): void;
export declare function storage(): Storage;
export declare function authorize(): Promise<void>;
export declare function recordUsage(channel: 'place' | 'shopping'): Promise<void>;
