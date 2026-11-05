"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInterstitial = createInterstitial;
const ads_1 = require("./ads");
const fullscreen_1 = require("./fullscreen");
const runtime_1 = require("./runtime");
function createInterstitial(options, env = (0, ads_1.defaultAdsEnv)()) {
    const sdk = env.sdk();
    const os = env.os();
    const test = env.dev() || options.test;
    const unit = os === 'ios' ? options.units.interstitial.ios : os === 'android' ? options.units.interstitial.android : '';
    const available = !!((os === 'ios' || os === 'android') && sdk?.InterstitialAd && sdk?.default && (test || unit));
    const fullscreen = (0, fullscreen_1.createFullscreen)(env, sdk);
    const show = (callbacks) => {
        if (!available) {
            (0, runtime_1.safeCall)(callbacks.onFail, '이 빌드에서는 광고를 재생할 수 없어요', true);
            return Promise.resolve(false);
        }
        return fullscreen.show({
            callbacks,
            rewarded: false,
            prepare: (stillNeeded) => (0, runtime_1.prepareRequest)(env, sdk, options, stillNeeded),
            makeAd: (request) => sdk.InterstitialAd.createForAdRequest(test ? sdk.TestIds.INTERSTITIAL : unit, request),
        });
    };
    const play = (options = {}) => new Promise((resolve) => {
        let opened = false;
        let done = false;
        const finish = (result) => { if (!done) {
            done = true;
            resolve(result);
        } };
        void show({
            onOpened: () => { opened = true; (0, runtime_1.safeCall)(options.onOpened); },
            onClosed: () => { if (opened)
                finish({ opened: true, busy: false, noAd: false, cancelled: false }); },
            onFail: (message, noAd) => finish({ opened, busy: false, noAd, cancelled: false, message }),
            onAbort: (noAd) => finish({ opened, busy: false, noAd: noAd ?? !opened, cancelled: true, message: '광고를 그만뒀어요' }),
        }).then((started) => {
            if (!started && !done)
                finish({ opened: false, busy: true, noAd: false, cancelled: false });
        }, () => finish({ opened, busy: false, noAd: !opened, cancelled: false, message: '광고를 열지 못했어요' }));
    });
    return { available, show, play, cancel: fullscreen.cancel, warm: () => { }, warmReady: () => false };
}
