/** Shared foreground, UMP and initialization policy. No ad is prefetched here. */
import type { AdsEnv } from './ads';

export type RequestPolicy = {
  test: boolean;
  testDevices?: string[];
  /** Conservative default: true. false still requires UMP personalization choices. */
  requestNonPersonalizedAdsOnly?: boolean;
};

export type RequestPrivacy = { requestNonPersonalizedAdsOnly: boolean };
export type FullscreenLease = { release: () => void };
type FullscreenObserver = (active: boolean, resumeRequests: boolean) => void;
type Session = { fullscreen: object | null; fullscreenObservers: Set<FullscreenObserver>; form: object | null; privacy: object | null; tracking: object | null; formWaiters: Set<() => void>; privacyRevision: number; consent: Promise<void> | null; init: Promise<unknown> | null; devices: Set<string>; configuration: Promise<void> };
const sessions = new WeakMap<object, Session>();
const fallback = {};

function sessionFor(env: AdsEnv, sdk: any): Session {
  const key = sdk ?? env.appState() ?? fallback;
  let session = sessions.get(key);
  if (!session) {
    session = { fullscreen: null, fullscreenObservers: new Set(), form: null, privacy: null, tracking: null, formWaiters: new Set(), privacyRevision: 0, consent: null, init: null, devices: new Set(), configuration: Promise.resolve() };
    sessions.set(key, session);
  }
  return session;
}

export function isForeground(env: AdsEnv): boolean {
  return env.appState()?.currentState === 'active';
}

export function isFullscreenActive(env: AdsEnv, sdk: any): boolean {
  return !!sessionFor(env, sdk).fullscreen;
}

/** Internal request observers never release a native lease or control SDK callbacks. */
export function subscribeFullscreen(env: AdsEnv, sdk: any, observer: FullscreenObserver): () => void {
  const observers = sessionFor(env, sdk).fullscreenObservers;
  observers.add(observer);
  return () => { observers.delete(observer); };
}

export function acquireFullscreen(env: AdsEnv, sdk: any, kind: 'ad' | 'privacy' = 'ad'): FullscreenLease | null {
  const session = sessionFor(env, sdk);
  if (session.fullscreen) return null;
  const token = {};
  session.fullscreen = token;
  for (const observer of [...session.fullscreenObservers]) safeCall(observer, true, false);
  return { release: () => {
    if (session.fullscreen !== token) return;
    session.fullscreen = null;
    // Privacy settings must not start an ad request merely because Google's form ended.
    for (const observer of [...session.fullscreenObservers]) safeCall(observer, false, kind === 'ad');
  } };
}

/** UMP updates/forms share one gate; privacy operations also block banner/request preparation. */
export function acquireConsentForm(env: AdsEnv, sdk: any, kind: 'consent' | 'privacy' | 'tracking' = 'consent'): FullscreenLease | null {
  const session = sessionFor(env, sdk);
  if (session.form) return null;
  const token = {};
  session.form = token;
  if (kind === 'privacy') { session.privacy = token; session.privacyRevision++; }
  if (kind === 'tracking') session.tracking = token;
  return { release: () => {
    if (session.form !== token) return;
    session.form = null;
    if (session.privacy === token) session.privacy = null;
    if (session.tracking === token) session.tracking = null;
    for (const wake of [...session.formWaiters]) wake();
  } };
}

/** Public ATT may be requested at startup while UMP refreshes; wait instead of overlapping dialogs. */
export function waitForTrackingForm(env: AdsEnv, sdk: any): Promise<FullscreenLease | null> {
  const immediate = acquireConsentForm(env, sdk, 'tracking');
  if (immediate) return Promise.resolve(immediate);
  const session = sessionFor(env, sdk);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { session.formWaiters.delete(wake); resolve(null); }, 45_000);
    const wake = () => {
      const lease = acquireConsentForm(env, sdk, 'tracking');
      if (!lease) return;
      clearTimeout(timer); session.formWaiters.delete(wake); resolve(lease);
    };
    session.formWaiters.add(wake);
  });
}

export function invalidateConsent(env: AdsEnv, sdk: any): void {
  sessionFor(env, sdk).consent = null;
}

export function bounded<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

/** Failed UMP refresh may use a still-valid previous consent, never a fabricated one. */
export async function prepareRequest(env: AdsEnv, sdk: any, policy: RequestPolicy, stillNeeded: () => boolean = () => true, beforeInitialize?: () => Promise<void>): Promise<RequestPrivacy> {
  const session = sessionFor(env, sdk);
  const revision = session.privacyRevision;
  const check = () => {
    if (!stillNeeded()) throw new Error('광고를 그만뒀어요');
    if (!isForeground(env)) throw new Error('앱이 앞에 있을 때 광고를 요청할 수 있어요');
    if (session.privacy) throw new Error('광고 개인정보 설정이 끝난 뒤 다시 시도해 주세요');
    if (session.tracking) throw new Error('추적 동의 확인이 끝난 뒤 다시 시도해 주세요');
    if (session.privacyRevision !== revision) throw new Error('광고 개인정보 설정이 바뀌었어요. 다시 시도해 주세요');
  };
  check();
  const consent = sdk?.AdsConsent;
  if (!consent?.gatherConsent || !consent?.getConsentInfo) throw new Error('광고 동의를 확인할 수 없어요');
  if (!session.consent) {
    const form = acquireConsentForm(env, sdk);
    if (!form) throw new Error('광고 동의 확인이 이미 진행 중이에요');
    const pending = (async () => {
      try {
        try {
          await Promise.resolve(consent.gatherConsent({ testDeviceIdentifiers: policy.testDevices ?? [] }));
        } catch {
          // getConsentInfo below is the sole authority, including cached consent on network failure.
        }
        const info = await bounded(Promise.resolve(consent.getConsentInfo()), 5000, '광고 동의를 확인할 수 없어요');
        if (info?.canRequestAds !== true) throw new Error('광고 요청에 필요한 동의가 없어요');
      } finally {
        form.release(); // Actual native operation completion, never the caller's timeout/cancel.
      }
    })();
    session.consent = pending;
    void pending.catch(() => { if (session.consent === pending) session.consent = null; });
  }
  // Keep the real in-flight form cached on timeout; another tap must not launch a second form.
  await bounded(session.consent, 45_000, '광고 동의 확인 시간이 초과됐어요');
  check();
  // Recheck after a privacy options change, even when the launch refresh has completed.
  const info = await bounded(Promise.resolve(consent.getConsentInfo()), 5000, '광고 동의를 확인할 수 없어요');
  if (info?.canRequestAds !== true) { session.consent = null; throw new Error('광고 요청에 필요한 동의가 없어요'); }
  check();
  // Manual ATT follows UMP and precedes the first SDK initialization/request.
  if (beforeInitialize) { await beforeInitialize(); check(); }
  let nonPersonalized = true;
  if (policy.requestNonPersonalizedAdsOnly === false) {
    try {
      const choices = await bounded(Promise.resolve(consent.getUserChoices()), 3000, '광고 동의를 확인할 수 없어요') as any;
      nonPersonalized = !(choices?.storeAndAccessInformationOnDevice === true && choices?.createAPersonalisedAdsProfile === true && choices?.selectPersonalisedAds === true);
      if (env.os() === 'ios') {
        const permissions = await bounded(Promise.resolve(env.tracking()?.getTrackingPermissionsAsync()), 3000, '추적 동의를 확인할 수 없어요') as any;
        if (!(permissions?.granted === true || permissions?.status === 'granted')) nonPersonalized = true;
      }
    } catch { nonPersonalized = true; }
  }
  check();
  const incoming = (policy.testDevices ?? []).filter((id) => !session.devices.has(id));
  if (incoming.length) {
    incoming.forEach((id) => session.devices.add(id));
    const identifiers = [...session.devices];
    const pending = session.configuration.then(async () => {
      await sdk.default().setRequestConfiguration({ testDeviceIdentifiers: identifiers });
    });
    // Registration must succeed before a real-unit request on a designated test device.
    session.configuration = pending.catch((error) => { incoming.forEach((id) => session.devices.delete(id)); throw error; });
    void session.configuration.catch(() => {});
  }
  const configuration = session.configuration;
  try { await bounded(configuration, 5000, '테스트 기기 등록 시간이 초과됐어요'); }
  catch (error) {
    // A still-pending registration remains a gate on later attempts. Only a real rejection resets it.
    void configuration.catch(() => { if (session.configuration === configuration) session.configuration = Promise.resolve(); });
    throw error;
  }
  check();
  if (!session.init) {
    const pending = (async () => {
      const mobile = sdk.default();
      check();
      return mobile.initialize();
    })();
    session.init = pending;
    void pending.catch(() => { if (session.init === pending) session.init = null; });
  }
  await bounded(session.init, 5000, '광고 초기화 시간이 초과됐어요');
  check();
  return { requestNonPersonalizedAdsOnly: nonPersonalized };
}

export function safeCall(fn: ((...args: any[]) => void) | undefined, ...args: any[]): void {
  try { fn?.(...args); } catch { /* Consumer callbacks never control SDK lifecycle. */ }
}

export function adError(error: any): string {
  const code = String(error?.code ?? error?.message ?? error ?? '');
  return /no.?fill/i.test(code) ? '지금은 볼 수 있는 광고가 없어요. 잠시 후 다시 시도해 주세요'
    : '광고를 불러오지 못했어요 (' + (code || '원인 불명') + ')';
}
