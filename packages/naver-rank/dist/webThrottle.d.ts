export declare const randomDelay: (min: number, max: number, random?: () => number) => number;
export declare function limitAction(lastDay: string | null, today: string, retried: boolean): 'retry' | 'stop';
export declare function recordLimit(retried: boolean): Promise<"retry" | "stop">;
