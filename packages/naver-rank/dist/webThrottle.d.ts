import type { Channel } from './webQueue';
export declare const koreanDay: (now?: number) => string;
export declare const randomDelay: (min: number, max: number, random?: () => number) => number;
export declare function limitAction(lastDay: string | null, today: string, retried: boolean): 'retry' | 'stop';
export declare function isStopped(channel: Channel): Promise<boolean>;
export declare function stopToday(channel: Channel): Promise<void>;
export declare function recordLimit(retried: boolean, channel?: Channel): Promise<"retry" | "stop">;
