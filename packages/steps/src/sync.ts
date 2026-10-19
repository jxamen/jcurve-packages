import { kstDay, toServerDays, type DaySteps } from './days';
export async function syncToday<T>(days: DaySteps[], send: (body: { days: ReturnType<typeof toServerDays> }) => Promise<T>, now = Date.now()): Promise<T | null> {
  const today = days.filter(d => d.date === kstDay(now));
  return today.length ? send({ days: toServerDays(today) }) : null;
}
