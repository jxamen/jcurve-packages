/** Native SDK is required lazily: importing this package works before keys/SDK exist. */
export type OfferwallResult = { ok: true } | { ok: false; reason: 'not_ready' | 'invalid_usn' | 'sdk_error'; message: string };
export type RewardInfo = { queryResult: boolean; totalCount: number; totalReward: string };
export type OfferwallConfig = { appKey?: string; hashKey?: string; title?: string; color?: string };
const pending = (): OfferwallResult => ({ ok: false, reason: 'not_ready', message: '준비 중' });
export type OfferwallServerConfig = { android?: { mediaKey?: string; hashKey?: string }; ios?: { mediaKey?: string; hashKey?: string } };
let config: OfferwallConfig | undefined;
let serverConfig: OfferwallServerConfig | undefined;
let generation = 0;
/** Call on logout/app switch before fetching the next app's settings. */
export function resetOfferwall(): void { generation++; config = undefined; serverConfig = undefined; }
/** Fetch the authenticated app content API. Keys stay in memory and must never be logged. */
export async function initializeOfferwall({ configUrl, headers }: { configUrl: string; headers: Record<string, string> }): Promise<OfferwallResult> {
  resetOfferwall();
  const current = generation;
  try {
    const response = await fetch(configUrl, { headers, cache: 'no-store' });
    if (!response.ok) return pending();
    const data = await response.json();
    if (current !== generation || data?.ok !== true || !data.config || typeof data.config !== 'object') return pending();
    const clean: OfferwallServerConfig = {};
    for (const os of ['android', 'ios'] as const) {
      const value = data.config[os];
      clean[os] = {
        mediaKey: typeof value?.mediaKey === 'string' ? value.mediaKey.trim() : '',
        hashKey: typeof value?.hashKey === 'string' ? value.hashKey.trim() : '',
      };
    }
    serverConfig = clean;
    return sdk() ? { ok: true } : pending();
  } catch { return pending(); }
}

/** Explicit injection of fetched SDK keys. Only Android reads bundled plugin keys. */
export function configureOfferwall(options: OfferwallConfig): void { generation++; serverConfig = undefined; config = { ...options }; }
function options(): OfferwallConfig {
  const os = require('react-native').Platform.OS;
  if (serverConfig && os === 'ios') {
    const keys = serverConfig.ios;
    return { ...config, appKey: keys?.mediaKey, hashKey: keys?.hashKey };
  }
  if (config) return config;
  try {
    const constants = require('expo-constants').default;
    const expo = constants.expoConfig;
    // Metro/dev manifests can evaluate app.json without running config plugins.
    const entry = expo?.plugins?.find((item: unknown) => Array.isArray(item) && item[0] === '@jcurve/offerwall');
    return os === 'android' ? (expo?.extra?.jcurveOfferwall ?? entry?.[1] ?? {}) : {};
  } catch { return {}; }
}
function sdk(): any | null {
  try {
    const c = options();
    if (!c.appKey?.trim() || !c.hashKey?.trim()) return null;
    const rn = require('react-native');
    if (!rn.NativeModules?.RNAdPopcornRewardModule || !['ios', 'android'].includes(rn.Platform.OS)) return null;
    const native = require('react-native-adpopcorn-reward').default;
    if (rn.Platform.OS === 'ios') {
      native.setLogEnable(false);
      native.setAppKey(c.appKey, c.hashKey);
    }
    return native;
  } catch { return null; }
}
function user(native: any, usn: string): boolean {
  // Server issues a SHA256 hex alias, never a phone number / email / raw member ID.
  if (typeof usn !== 'string' || !/^[a-f0-9]{64}$/.test(usn)) return false;
  native.setUserId(usn);
  return true;
}
export function openOfferwall({ usn }: { usn: string }): OfferwallResult {
  const native = sdk();
  if (!native) return pending();
  try {
    if (!user(native, usn)) return { ok: false, reason: 'invalid_usn', message: '회원 정보를 확인해 주세요' };
    const c = options();
    if (c.title || c.color) native.setStyle(c.title || '혜택 받기', c.color || '#222222');
    native.openOfferwall();
    return { ok: true };
  } catch { return { ok: false, reason: 'sdk_error', message: '잠시 후 다시 시도해 주세요' }; }
}

/** Total reward arrives via SDK event. Timeout always removes the subscription. */
export function getOfferwallTotalRewardInfo({ usn, timeoutMs = 10000 }: { usn: string; timeoutMs?: number }): Promise<OfferwallResult & { info?: RewardInfo }> {
  const native = sdk();
  if (!native) return Promise.resolve(pending());
  return new Promise(resolve => {
    let subscription: { remove(): void } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const finish = (value: OfferwallResult & { info?: RewardInfo }) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      subscription?.remove();
      resolve(value);
    };
    try {
      if (!user(native, usn)) { finish({ ok: false, reason: 'invalid_usn', message: '회원 정보를 확인해 주세요' }); return; }
      subscription = native.addListener('OnOfferwallTotalRewardInfo', (info: RewardInfo) => finish({ ok: true, info }));
      timer = setTimeout(() => finish({ ok: false, reason: 'sdk_error', message: '잠시 후 다시 시도해 주세요' }), timeoutMs);
      native.getOfferwallTotalRewardInfo();
    } catch { finish({ ok: false, reason: 'sdk_error', message: '잠시 후 다시 시도해 주세요' }); }
  });
}
export function onOfferwallClosed(callback: () => void): () => void {
  const native = sdk();
  if (!native) return () => {};
  try {
    const subscription = native.addListener('OnClosedOfferWallPage', callback);
    return () => subscription.remove();
  } catch { return () => {}; }
}
/** Stable callback recommended. Closing the SDK is a good time to refresh server balance. */
export function useOfferwallClosed(callback: () => void): void {
  const { useEffect, useRef } = require('react');
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => onOfferwallClosed(() => latest.current()), []);
}
