/** UMP privacy settings. This module never initializes the advertising SDK or requests an ad. */
import { defaultAdsEnv, type AdsEnv } from './ads';
import { acquireConsentForm, acquireFullscreen, invalidateConsent, isForeground } from './runtime';

export type AdsPrivacyRequirement = 'required' | 'not-required' | 'unknown';
export type AdsPrivacyInfo = { requirement: AdsPrivacyRequirement; canRequestAds: boolean | null };
export type AdsPrivacyStatus = 'checked' | 'shown' | 'not-required' | 'unknown' | 'busy' | 'cancelled' | 'timeout' | 'unavailable' | 'background' | 'error';
export type AdsPrivacyResult = { status: AdsPrivacyStatus; info: AdsPrivacyInfo; message?: string };
export type AdsPrivacyOptions = { testDevices?: string[] };
export type AdsPrivacy = {
  available: boolean;
  /** Refresh UMP info and read the SDK's authoritative requirement. Never opens a form. */
  getStatus: () => Promise<AdsPrivacyResult>;
  /** Only REQUIRED opens Google's form; its completion is followed by a fresh SDK info read. */
  show: () => Promise<AdsPrivacyResult>;
  /** Cancels the JS wait; an already-running native operation retains its locks until it ends. */
  cancel: () => void;
};

const UNKNOWN = (): AdsPrivacyInfo => ({ requirement: 'unknown', canRequestAds: null });
const TIMEOUT_MS = 45_000;

function readInfo(info: any): AdsPrivacyInfo {
  const requirement = info?.privacyOptionsRequirementStatus === 'REQUIRED' ? 'required'
    : info?.privacyOptionsRequirementStatus === 'NOT_REQUIRED' ? 'not-required' : 'unknown';
  return { requirement, canRequestAds: typeof info?.canRequestAds === 'boolean' ? info.canRequestAds : null };
}

export function createAdsPrivacy(options: AdsPrivacyOptions = {}, env: AdsEnv = defaultAdsEnv()): AdsPrivacy {
  const sdk = env.sdk();
  const consent = sdk?.AdsConsent;
  const os = env.os();
  const available = !!((os === 'ios' || os === 'android') && typeof consent?.requestInfoUpdate === 'function' && typeof consent?.getConsentInfo === 'function' && typeof consent?.showPrivacyOptionsForm === 'function');
  let cancelCurrent: (() => void) | null = null;

  const run = (show: boolean): Promise<AdsPrivacyResult> => {
    if (!available) return Promise.resolve({ status: 'unavailable', info: UNKNOWN(), message: '이 빌드에서는 광고 개인정보 설정을 사용할 수 없어요' });
    if (!isForeground(env)) return Promise.resolve({ status: 'background', info: UNKNOWN(), message: '앱이 앞에 있을 때 개인정보 설정을 확인할 수 있어요' });
    const fullscreen = show ? acquireFullscreen(env, sdk, 'privacy') : null;
    if (show && !fullscreen) return Promise.resolve({ status: 'busy', info: UNKNOWN(), message: '다른 광고나 개인정보 설정이 진행 중이에요' });
    const form = acquireConsentForm(env, sdk, 'privacy');
    if (!form) {
      fullscreen?.release();
      return Promise.resolve({ status: 'busy', info: UNKNOWN(), message: '광고 동의 확인이 이미 진행 중이에요' });
    }

    return new Promise((resolve) => {
      let done = false;
      let stopped = false;
      let formStarted = false;
      let appSub: { remove: () => void } | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (result: AdsPrivacyResult) => {
        if (done) return;
        done = true;
        if (timer !== null) clearTimeout(timer);
        try { appSub?.remove(); } catch { /* noop */ }
        if (cancelCurrent === cancel) cancelCurrent = null;
        resolve(result);
      };
      const stop = (status: 'cancelled' | 'timeout' | 'background', message: string) => {
        if (done) return;
        stopped = true;
        finish({ status, info: UNKNOWN(), message });
        // No native UMP cancellation API exists. Release only in the native operation's finally.
      };
      const cancel = () => stop('cancelled', '개인정보 설정 기다리기를 그만뒀어요');
      cancelCurrent = cancel;
      const check = () => {
        if (stopped) throw new Error('개인정보 설정 기다리기가 끝났어요');
        if (!isForeground(env)) {
          stop('background', '앱이 앞에 있을 때 개인정보 설정을 확인할 수 있어요');
          throw new Error('앱이 뒤로 이동했어요');
        }
      };
      try {
        appSub = env.appState()?.addEventListener('change', (state) => {
          // A native permission/form can temporarily inactivate iOS; true background always cancels the wait.
          if (state === 'background' || (state !== 'active' && !formStarted)) stop('background', '앱이 앞에 있을 때 개인정보 설정을 확인할 수 있어요');
        }) ?? null;
      } catch { /* Every native call still checks foreground directly. */ }
      timer = setTimeout(() => stop('timeout', '개인정보 설정 확인 시간이 초과됐어요'), TIMEOUT_MS);

      void (async () => {
        try {
          check();
          let refreshFailed = false;
          try { await consent.requestInfoUpdate({ testDeviceIdentifiers: options.testDevices ?? [] }); }
          catch { refreshFailed = true; }
          check();
          const info = readInfo(await consent.getConsentInfo());
          check();
          if (!show) {
            finish({ status: info.requirement === 'unknown' ? 'unknown' : 'checked', info,
              ...(refreshFailed ? { message: '새 동의 정보 갱신에 실패해 SDK의 기존 동의 상태를 확인했어요' } : {}) });
            return;
          }
          if (info.requirement !== 'required') {
            finish({ status: info.requirement === 'not-required' ? 'not-required' : 'unknown', info });
            return;
          }
          formStarted = true;
          await consent.showPrivacyOptionsForm();
          check();
          const after = readInfo(await consent.getConsentInfo());
          check();
          finish({ status: 'shown', info: after });
        } catch (error: any) {
          if (!done) finish({ status: 'error', info: UNKNOWN(), message: '광고 개인정보 설정을 확인하지 못했어요 (' + String(error?.message ?? error ?? '원인 불명') + ')' });
        } finally {
          // Invalidate launch-consent memoization; the next explicit ad attempt revalidates SDK canRequestAds.
          invalidateConsent(env, sdk);
          form.release();
          fullscreen?.release();
        }
      })();
    });
  };

  return { available, getStatus: () => run(false), show: () => run(true), cancel: () => { cancelCurrent?.(); } };
}
