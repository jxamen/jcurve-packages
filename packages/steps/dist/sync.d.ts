import { toServerDays, type DaySteps } from './days';
export declare function syncToday<T>(days: DaySteps[], send: (body: {
    days: ReturnType<typeof toServerDays>;
}) => Promise<T>, now?: number): Promise<T | null>;
