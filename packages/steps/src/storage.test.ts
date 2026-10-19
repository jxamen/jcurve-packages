import { it, expect } from 'vitest';
import { configureStepsStorage, getStepsStorage } from './storage';
it('keeps an inflight sensor subscription scoped to its original account', async () => {
  const rows = new Map<string, string>();
  const adapter = { getItem: async (key: string) => rows.get(key) ?? null, setItem: async (key: string, value: string) => { rows.set(key, value); } };
  configureStepsStorage(adapter, 'member1'); const oldSubscription = getStepsStorage();
  configureStepsStorage(adapter, 'member2'); const current = getStepsStorage();
  await oldSubscription.setJson('sensor', { '2026-10-19': 100 });
  expect(await current.getJson('sensor')).toBeNull();
  expect(await oldSubscription.getJson('sensor')).toEqual({ '2026-10-19': 100 });
});
