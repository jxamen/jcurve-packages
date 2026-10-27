import { keepRecent, toServerDays, type DaySteps } from './days';
/** 오늘 + 어제 걸음을 서버에 올린다(0.3.0 — 어제 몫을 받으려면 서버가 어제 걸음을 알아야 한다). 그 앞 날은 올리지 않는다. */
export async function syncToday<T>(days: DaySteps[], send: (body: { days: ReturnType<typeof toServerDays> }) => Promise<T>, now = Date.now()): Promise<T | null> {
  const recent = keepRecent(days, now);
  return recent.length ? send({ days: toServerDays(recent) }) : null;
}
