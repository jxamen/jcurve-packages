"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureOfferwall = configureOfferwall;
exports.openOfferwall = openOfferwall;
exports.getOfferwallTotalRewardInfo = getOfferwallTotalRewardInfo;
exports.onOfferwallClosed = onOfferwallClosed;
exports.useOfferwallClosed = useOfferwallClosed;
const pending = () => ({ ok: false, reason: 'not_ready', message: '준비 중' });
let config;
/** Optional override for bare RN. Expo apps read config-plugin's extra automatically. */
function configureOfferwall(options) { config = { ...options }; }
function options() {
    if (config)
        return config;
    try {
        const constants = require('expo-constants').default;
        const expo = constants.expoConfig;
        // Metro/dev manifests can evaluate app.json without running config plugins.
        const entry = expo?.plugins?.find((item) => Array.isArray(item) && item[0] === '@jcurve/offerwall');
        return expo?.extra?.jcurveOfferwall ?? entry?.[1] ?? {};
    }
    catch {
        return {};
    }
}
function sdk() {
    const c = options();
    if (!c.appKey?.trim() || !c.hashKey?.trim())
        return null;
    try {
        const rn = require('react-native');
        if (!rn.NativeModules?.RNAdPopcornRewardModule || !['ios', 'android'].includes(rn.Platform.OS))
            return null;
        const native = require('react-native-adpopcorn-reward').default;
        if (rn.Platform.OS === 'ios')
            native.setAppKey(c.appKey, c.hashKey);
        return native;
    }
    catch {
        return null;
    }
}
function user(native, usn) {
    // Server issues a SHA256 hex alias, never a phone number / email / raw member ID.
    if (typeof usn !== 'string' || !/^[a-f0-9]{64}$/.test(usn))
        return false;
    native.setUserId(usn);
    return true;
}
function openOfferwall({ usn }) {
    const native = sdk();
    if (!native)
        return pending();
    try {
        if (!user(native, usn))
            return { ok: false, reason: 'invalid_usn', message: '회원 정보를 확인해 주세요' };
        const c = options();
        if (c.title || c.color)
            native.setStyle(c.title || '혜택 받기', c.color || '#222222');
        native.openOfferwall();
        return { ok: true };
    }
    catch {
        return { ok: false, reason: 'sdk_error', message: '잠시 후 다시 시도해 주세요' };
    }
}
/** Total reward arrives via SDK event. Timeout always removes the subscription. */
function getOfferwallTotalRewardInfo({ usn, timeoutMs = 10000 }) {
    const native = sdk();
    if (!native)
        return Promise.resolve(pending());
    return new Promise(resolve => {
        let subscription;
        let timer;
        let done = false;
        const finish = (value) => {
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            subscription?.remove();
            resolve(value);
        };
        try {
            if (!user(native, usn)) {
                finish({ ok: false, reason: 'invalid_usn', message: '회원 정보를 확인해 주세요' });
                return;
            }
            subscription = native.addListener('OnOfferwallTotalRewardInfo', (info) => finish({ ok: true, info }));
            timer = setTimeout(() => finish({ ok: false, reason: 'sdk_error', message: '잠시 후 다시 시도해 주세요' }), timeoutMs);
            native.getOfferwallTotalRewardInfo();
        }
        catch {
            finish({ ok: false, reason: 'sdk_error', message: '잠시 후 다시 시도해 주세요' });
        }
    });
}
function onOfferwallClosed(callback) {
    const native = sdk();
    if (!native)
        return () => { };
    try {
        const subscription = native.addListener('OnClosedOfferWallPage', callback);
        return () => subscription.remove();
    }
    catch {
        return () => { };
    }
}
/** Stable callback recommended. Closing the SDK is a good time to refresh server balance. */
function useOfferwallClosed(callback) {
    const { useEffect, useRef } = require('react');
    const latest = useRef(callback);
    latest.current = callback;
    useEffect(() => onOfferwallClosed(() => latest.current()), []);
}
