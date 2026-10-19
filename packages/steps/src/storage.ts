export type StepsStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
let adapter: StepsStorage | null = null;
let prefix = '';
/** Use an account-specific namespace. Never mix different members' sensor counts. */
export function configureStepsStorage(storage: StepsStorage, namespace: string): void { adapter = storage; prefix = namespace; }
/** A subscription retains its own account even when configuration changes. */
export function getStepsStorage() {
  const scoped = adapter; const namespace = prefix;
  return {
    async getJson<T>(key: string): Promise<T | null> {
      if (!scoped) throw new Error('configureStepsStorage required');
      const raw = await scoped.getItem(namespace + '.' + key);
      try { return raw ? JSON.parse(raw) as T : null; } catch { return null; }
    },
    async setJson(key: string, value: unknown): Promise<void> {
      if (!scoped) throw new Error('configureStepsStorage required');
      await scoped.setItem(namespace + '.' + key, JSON.stringify(value));
    },
  };
}
export const stepsStorage = {
  getJson: <T>(key: string): Promise<T | null> => getStepsStorage().getJson<T>(key),
  setJson: (key: string, value: unknown): Promise<void> => getStepsStorage().setJson(key, value),
};
