import { defaultAdsEnv, type AdsEnv, type AdUnits } from './ads';
import { createFullscreen } from './fullscreen';
import { prepareRequest, safeCall, type RequestPolicy } from './runtime';

export type InterstitialOptions = RequestPolicy & { units: { interstitial: AdUnits } };
export type InterstitialShowOptions = {
  onOpened?: () => void;
  onClosed?: () => void;
  onFail: (message: string, noAd: boolean) => void;
  onAbort?: () => void;
};
/** Normal interstitial has no earned result, SSV payload or reward callbacks. */
export type InterstitialResult = {
  opened: boolean;
  busy: boolean;
  /** true only when absence is confirmed; in-flight native presentation is false even without OPENED. */
  noAd: boolean;
  cancelled: boolean;
  message?: string;
};
export type Interstitial = {
  available: boolean;
  show: (options: InterstitialShowOptions) => Promise<boolean>;
  play: (options?: { onOpened?: () => void }) => Promise<InterstitialResult>;
  cancel: () => void;
  warm: () => void;
  warmReady: () => boolean;
};

export function createInterstitial(options: InterstitialOptions, env: AdsEnv = defaultAdsEnv()): Interstitial {
  const sdk = env.sdk();
  const os = env.os();
  const test = env.dev() || options.test;
  const unit = os === 'ios' ? options.units.interstitial.ios : os === 'android' ? options.units.interstitial.android : '';
  const available = !!((os === 'ios' || os === 'android') && sdk?.InterstitialAd && sdk?.default && (test || unit));
  const fullscreen = createFullscreen(env, sdk);
  const show = (callbacks: InterstitialShowOptions) => {
    if (!available) { safeCall(callbacks.onFail, '이 빌드에서는 광고를 재생할 수 없어요', true); return Promise.resolve(false); }
    return fullscreen.show({
      callbacks,
      rewarded: false,
      prepare: (stillNeeded) => prepareRequest(env, sdk, options, stillNeeded),
      makeAd: (request) => sdk.InterstitialAd.createForAdRequest(test ? sdk.TestIds.INTERSTITIAL : unit, request),
    });
  };
  const play = (options: { onOpened?: () => void } = {}): Promise<InterstitialResult> => new Promise((resolve) => {
    let opened = false;
    let done = false;
    const finish = (result: InterstitialResult) => { if (!done) { done = true; resolve(result); } };
    void show({
      onOpened: () => { opened = true; safeCall(options.onOpened); },
      onClosed: () => { if (opened) finish({ opened: true, busy: false, noAd: false, cancelled: false }); },
      onFail: (message, noAd) => finish({ opened, busy: false, noAd, cancelled: false, message }),
      onAbort: (noAd?: boolean) => finish({ opened, busy: false, noAd: noAd ?? !opened, cancelled: true, message: '광고를 그만뒀어요' }),
    }).then((started) => {
      if (!started && !done) finish({ opened: false, busy: true, noAd: false, cancelled: false });
    }, () => finish({ opened, busy: false, noAd: !opened, cancelled: false, message: '광고를 열지 못했어요' }));
  });
  return { available, show, play, cancel: fullscreen.cancel, warm: () => {}, warmReady: () => false };
}
