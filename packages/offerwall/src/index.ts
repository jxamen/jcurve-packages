import { hasNativeBridge } from './native';
import { forgetSnapPlayUser } from './snapPlay';
import { subscribeTapGate, tapGateState, TAP_REMOUNT_WINDOW_MS } from './webTapGate';
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
export function resetOfferwall(): void { generation++; config = undefined; serverConfig = undefined; forgetSnapPlayUser(); }
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
  if (os !== 'android') return {};
  // (0.2.2) 안드로이드 키 고르기 — expoConfig → 빌드에 박힌 설정 → 서버(initializeOfferwall · resolveOfferwallKeys 가 받아 둔 것). 아래 pickKeys
  const k = pickKeys('android');
  return k.source === 'none' ? {} : { appKey: k.appKey, hashKey: k.hashKey };
}

type Picked = { appKey: string; hashKey: string; source: 'expoConfig' | 'embedded' | 'server' | 'none' };
const both = (k: OfferwallConfig | null | undefined): { appKey: string; hashKey: string } | null => {
  const appKey = typeof k?.appKey === 'string' ? k.appKey.trim() : '';
  const hashKey = typeof k?.hashKey === 'string' ? k.hashKey.trim() : '';
  return appKey && hashKey ? { appKey, hashKey } : null;
};

/** OTA manifest(또는 개발 manifest)의 extra.jcurveOfferwall — 예전(0.2.1)과 같은 자리 */
function expoConfigKeys(): OfferwallConfig | null {
  try {
    const expo = require('expo-constants').default?.expoConfig;
    // Metro/dev manifests can evaluate app.json without running config plugins.
    const entry = expo?.plugins?.find((item: unknown) => Array.isArray(item) && item[0] === '@jcurve/offerwall');
    return expo?.extra?.jcurveOfferwall ?? entry?.[1] ?? null;
  } catch { return null; }
}

/**
 * (0.2.2) **빌드 때 박힌** app config 의 오퍼월 키 — expo-constants 네이티브 모듈(ExponentConstants.manifest)이 들고 있는 내장 설정.
 * OTA 는 Constants.expoConfig(업데이트 manifest)만 바꾸고 이것은 못 바꾼다. 플러그인(app.plugin.js)이 빌드 때 extra.jcurveOfferwall 에 넣은 값 그대로다.
 * 안드로이드는 manifest 가 JSON 문자열, iOS 는 객체다. 못 읽으면(Expo Go · 웹 · 모듈 없음) null
 */
function embeddedKeys(): OfferwallConfig | null {
  try {
    let mod: any = null;
    try { mod = require('expo-modules-core').requireOptionalNativeModule?.('ExponentConstants') ?? null; } catch { mod = null; }
    if (!mod) mod = require('react-native').NativeModules?.ExponentConstants ?? null;
    let manifest = mod?.manifest;
    if (typeof manifest === 'string') manifest = JSON.parse(manifest);
    const keys = manifest?.extra?.jcurveOfferwall;
    return keys && typeof keys === 'object' ? keys : null;
  } catch { return null; }
}

/**
 * (0.2.2) 키 고르기 — 대표님 10-20 오퍼월 「준비 중」(OTA 발행 환경에 ADPOPCORN_* 가 없어 manifest extra 키가 빈 문자열로 나감, A32 캐시팡팡):
 *  1) Constants.expoConfig.extra.jcurveOfferwall — 두 키가 다 있으면
 *  2) 빌드에 박힌 설정(ExponentConstants.manifest) — OTA 가 못 바꾼다
 *  3) 서버 GET content/config/adpopcorn 의 그 OS 키(initializeOfferwall · resolveOfferwallKeys 가 받아 둔 것)
 * 값은 메모리에만 두고 기록하지 않는다
 */
function pickKeys(os: 'android' | 'ios'): Picked {
  const a = both(expoConfigKeys());
  if (a) return { ...a, source: 'expoConfig' };
  const b = both(embeddedKeys());
  if (b) return { ...b, source: 'embedded' };
  const s = serverConfig?.[os];
  const c = both({ appKey: s?.mediaKey, hashKey: s?.hashKey });
  if (c) return { ...c, source: 'server' };
  return { appKey: '', hashKey: '', source: 'none' };
}

/** (0.2.2) 번들 표식 — OTA 발행 검사(배포2)가 번들 문자열에서 「키를 빌드 · 서버에서도 찾는 판」인지 본다 */
export const OFFERWALL_KEYS_MARK = 'jcurve-offerwall-keys:expoConfig>embedded>server';

export type BuiltOfferwallKeys = { appKey: string; hasAppKey: boolean; hasHashKey: boolean; source: Picked['source'] };
const report = (k: Picked): BuiltOfferwallKeys => ({ appKey: k.appKey, hasAppKey: k.appKey !== '', hasHashKey: k.hashKey !== '', source: k.source });

/**
 * (0.2.2) 이 기기에서 쓸 오퍼월 키 — 앱의 키 가드(offerwallKeyGuard)가 Constants.expoConfig.extra 대신 이것을 본다.
 * appKey(매체 키)는 서버 mediaKey 와 맞대야 해서 값을 주고, hashKey 는 있음/없음만 준다(값은 내보내지 않는다).
 */
export function builtOfferwallKeys(): BuiltOfferwallKeys {
  let os: 'android' | 'ios' = 'android';
  try { os = require('react-native').Platform.OS === 'ios' ? 'ios' : 'android'; } catch { /* 기본 안드로이드 */ }
  return report(pickKeys(os));
}

/**
 * (0.2.2) 1 · 2 가 다 비었으면 서버 키까지 — `fetcher` 는 앱이 준다(앱 api 주소 · 토큰을 패키지가 모르게): content/config/adpopcorn 응답 JSON 을 돌려준다.
 * 받은 키는 SDK 를 열 때도 쓴다(안드로이드 options). 실패하면 조용히 none
 */
export async function resolveOfferwallKeys(fetcher?: () => Promise<unknown>): Promise<BuiltOfferwallKeys> {
  const now = builtOfferwallKeys();
  if (now.source !== 'none' || !fetcher) return now;
  const current = generation;
  try {
    const data: any = await fetcher();
    if (current !== generation || data?.ok !== true || !data.config || typeof data.config !== 'object') return now;
    const clean: OfferwallServerConfig = {};
    for (const os of ['android', 'ios'] as const) {
      const value = data.config[os];
      clean[os] = { mediaKey: typeof value?.mediaKey === 'string' ? value.mediaKey.trim() : '', hashKey: typeof value?.hashKey === 'string' ? value.hashKey.trim() : '' };
    }
    serverConfig = clean;
  } catch { return now; }
  return builtOfferwallKeys();
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

export type OfferwallViewProps = {
  usn: string;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  onLoaded?: () => void;
  onError?: (result: OfferwallResult) => void;
  /** 0.3.0 builds only (ignored on older binaries): list just these campaigns. Android SDK setFilterCampaignKeyList. */
  campaignKeys?: string[];
  /** 0.3.0 builds only (ignored on older binaries): open this campaign's detail inside the list. iOS SDK detailPageCampaignKey. With 0.4.0 the view shows the detail itself (pageType 5). */
  detailCampaignKey?: string;
  /** 0.4.0 iOS builds only (the view must list `onDetailOpened` among its native props; older binaries never get the prop): the SDK opened the detail page inside the view. */
  onDetailOpened?: () => void;
  /** 0.4.0 iOS builds only: the detail page inside the view was closed (the member went back to the list). */
  onDetailClosed?: () => void;
};
let embeddedView: import('react').ComponentType<any> | undefined;
/** SDK ViewType list. Mount only after initializeOfferwall succeeds; unmount on exit/logout. */
export function OfferwallView({ usn, style, onLoaded, onError, campaignKeys, detailCampaignKey, onDetailOpened, onDetailClosed }: OfferwallViewProps): import('react').ReactElement | null {
  const React = require('react') as typeof import('react');
  const [readyUsn, setReadyUsn] = React.useState<string | null>(null);
  const error = React.useRef(onError);
  error.current = onError;
  // 0.4.1: the web tap only reaches web views created after it turned on; the wall's web view is made at the first layout, before the server's switch is known.
  // So when the tap turns on shortly after this view mounted, mount the native view once more (new `key`) — its new web view gets the script.
  const [generation, setGeneration] = React.useState(0);
  React.useEffect(() => {
    const mountedAt = Date.now();
    const gate = tapGateState();
    let seen = gate.active ? gate.epoch : -1;
    return subscribeTapGate((epoch) => {
      if (epoch === seen) return;
      seen = epoch;
      if (Date.now() - mountedAt <= TAP_REMOUNT_WINDOW_MS) setGeneration((g) => g + 1);
    });
  }, []);
  React.useEffect(() => {
    setReadyUsn(null);
    try {
      const native = sdk();
      if (!native) { error.current?.(pending()); return; }
      if (!user(native, usn)) {
        error.current?.({ ok: false, reason: 'invalid_usn', message: '회원 정보를 확인해 주세요' });
        return;
      }
      const rn = require('react-native');
      if (!rn.UIManager.getViewManagerConfig('JCurveOfferwallView')) { error.current?.(pending()); return; }
      embeddedView ??= rn.requireNativeComponent('JCurveOfferwallView');
      setReadyUsn(usn);
    } catch {
      error.current?.({ ok: false, reason: 'sdk_error', message: '잠시 후 다시 시도해 주세요' });
    }
  }, [usn]);
  if (readyUsn !== usn || !embeddedView) return null;
  // A view prop the installed binary does not know would be an error there, so the new ones go only when the bridge is present.
  const extra: Record<string, unknown> = hasNativeBridge() ? { ...(campaignKeys?.length ? { campaignKeys } : {}), ...(detailCampaignKey ? { detailCampaignKey } : {}) } : {};
  // The 0.4.0 event props go only to a view that says it has them (its native prop list) — a 0.3.0 binary has the module but not these view events.
  if (hasNativeBridge() && (onDetailOpened || onDetailClosed)) {
    try {
      const nativeProps = (require('react-native').UIManager.getViewManagerConfig('JCurveOfferwallView') as { NativeProps?: Record<string, unknown> } | null)?.NativeProps ?? {};
      if (onDetailOpened && 'onDetailOpened' in nativeProps) extra.onDetailOpened = onDetailOpened;
      if (onDetailClosed && 'onDetailClosed' in nativeProps) extra.onDetailClosed = onDetailClosed;
    } catch { /* an older binary: the props are simply not passed */ }
  }
  return React.createElement(embeddedView, { key: generation, usn, style: [{ flex: 1 }, style], onLoaded, ...extra });
}

export { OfferwallScreen, OFFERWALL_SCREEN_MARK, OFFERWALL_CHANCE_TABS_MARK, DEFAULT_LAUNCHER_COPY } from './OfferwallScreen';
export type { OfferwallScreenProps, LauncherCopy } from './OfferwallScreen';
export * from './chanceProviders';
export * from './snapPlay';
export * from './combos';
export * from './comboEntry';
export * from './comboTrials';
export * from './comboCategories';
export * from './campaigns';
export * from './native';
export * from './webTap';
export * from './webTapGate';
export * from './connector';
export * from './trialNotify';
export * from './popupAd';
export * from './tapUpload';
export * from './offerwallCombos';
export * from './comboDone';
export * from './comboSeen';
export * from './wallSignal';
