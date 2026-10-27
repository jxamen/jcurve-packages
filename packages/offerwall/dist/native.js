"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OFFERWALL_NATIVE_METHODS = exports.setClipboard = exports.useFlagShowWhenLocked = exports.setUserAgreement = exports.closeOfferwall = exports.openOfferwallWithFilter = exports.getBridgeTotalRewardInfo = exports.getEarnableTotalRewardInfo = exports.clickCustomCpm = exports.impressionCustomCpm = exports.loadCustomCpm = exports.completeCustomNativeAd = exports.clickCustomNativeAd = exports.impressionCustomNativeAd = exports.loadCustomNativeAds = exports.destroyCustomCampaigns = exports.clickCustomCampaign = exports.loadCustomCampaigns = exports.tryParticipateCampaign = exports.openCampaignDetail = exports.getOfferwallNativeCapabilities = void 0;
exports.hasNativeBridge = hasNativeBridge;
exports.addOfferwallNativeListener = addOfferwallNativeListener;
function bridge() {
    try {
        const { NativeModules } = require('react-native');
        const mod = NativeModules?.JCurveOfferwallModule;
        return mod && typeof mod === 'object' ? mod : null;
    }
    catch {
        return null;
    }
}
/** True on binaries built with 0.3.0+. */
function hasNativeBridge() { return bridge() !== null; }
function unsupported(name) {
    return Object.assign(new Error(`native bridge: ${name} is not available in this build`), { code: 'E_UNSUPPORTED' });
}
function call(name, ...args) {
    const mod = bridge();
    if (!mod || typeof mod[name] !== 'function')
        return Promise.reject(unsupported(name));
    try {
        return Promise.resolve(mod[name](...args));
    }
    catch (error) {
        return Promise.reject(error);
    }
}
/** What this build can do (platform, SDK version, method names). Rejects E_UNSUPPORTED before 0.3.0. */
const getOfferwallNativeCapabilities = () => call('getCapabilities');
exports.getOfferwallNativeCapabilities = getOfferwallNativeCapabilities;
// campaign detail / participation
/** Opens one campaign's detail page. true = the SDK took it; false = refused or no answer in time. */
const openCampaignDetail = (campaignKey) => call('openCampaignDetail', campaignKey);
exports.openCampaignDetail = openCampaignDetail;
/** SDK-side participation attempt for a campaign key. */
const tryParticipateCampaign = (campaignKey) => call('tryParticipateCampaign', campaignKey);
exports.tryParticipateCampaign = tryParticipateCampaign;
// custom reward lists (our own UI)
const loadCustomCampaigns = (max = 100) => call('loadCustomCampaigns', max);
exports.loadCustomCampaigns = loadCustomCampaigns;
const clickCustomCampaign = (campaignKey) => call('clickCustomCampaign', campaignKey);
exports.clickCustomCampaign = clickCustomCampaign;
const destroyCustomCampaigns = () => call('destroyCustomCampaigns');
exports.destroyCustomCampaigns = destroyCustomCampaigns;
/** Custom native ad of a placement made in the AdPopcorn console. */
const loadCustomNativeAds = (placementId) => call('loadCustomNativeAds', placementId);
exports.loadCustomNativeAds = loadCustomNativeAds;
const impressionCustomNativeAd = (nativeCampaignId) => call('impressionCustomNativeAd', nativeCampaignId);
exports.impressionCustomNativeAd = impressionCustomNativeAd;
const clickCustomNativeAd = (nativeCampaignId) => call('clickCustomNativeAd', nativeCampaignId);
exports.clickCustomNativeAd = clickCustomNativeAd;
/** Android only (iOS rejects E_UNSUPPORTED). */
const completeCustomNativeAd = () => call('completeCustomNativeAd');
exports.completeCustomNativeAd = completeCustomNativeAd;
const loadCustomCpm = (max = 100) => call('loadCustomCpm', max);
exports.loadCustomCpm = loadCustomCpm;
const impressionCustomCpm = (id) => call('impressionCustomCpm', id);
exports.impressionCustomCpm = impressionCustomCpm;
const clickCustomCpm = (id) => call('clickCustomCpm', id);
exports.clickCustomCpm = clickCustomCpm;
// reward totals
const getEarnableTotalRewardInfo = () => call('getEarnableTotalRewardInfo');
exports.getEarnableTotalRewardInfo = getEarnableTotalRewardInfo;
const getBridgeTotalRewardInfo = (bridgePlacementId) => call('getBridgeTotalRewardInfo', bridgePlacementId);
exports.getBridgeTotalRewardInfo = getBridgeTotalRewardInfo;
// settings and helpers
/** Full-screen offerwall with the user filters of the AdPopcorn contract ({ key: value } strings). */
const openOfferwallWithFilter = (filters) => call('openOfferwallWithFilter', filters);
exports.openOfferwallWithFilter = openOfferwallWithFilter;
/** iOS only: closes an offerwall that is already open (Android rejects E_UNSUPPORTED). */
const closeOfferwall = () => call('closeOfferwall');
exports.closeOfferwall = closeOfferwall;
/** Android only (iOS rejects E_UNSUPPORTED). */
const setUserAgreement = (agreed) => call('setUserAgreement', agreed);
exports.setUserAgreement = setUserAgreement;
/** Android only (iOS rejects E_UNSUPPORTED). */
const useFlagShowWhenLocked = (enabled) => call('useFlagShowWhenLocked', enabled);
exports.useFlagShowWhenLocked = useFlagShowWhenLocked;
/** Puts text on the clipboard without a separate clipboard module. */
const setClipboard = (text) => call('setClipboard', text);
exports.setClipboard = setClipboard;
/** Bridge events. Uses NativeEventEmitter, which iOS needs to count listeners. Returns an unsubscribe function. */
function addOfferwallNativeListener(listener) {
    try {
        const { NativeEventEmitter } = require('react-native');
        const mod = bridge();
        if (!mod)
            return () => { };
        const subscription = new NativeEventEmitter(mod).addListener('JCurveOfferwallEvent', listener);
        return () => subscription.remove();
    }
    catch {
        return () => { };
    }
}
/** Every method this file wraps, for the capability check in tests and docs. */
exports.OFFERWALL_NATIVE_METHODS = [
    'openCampaignDetail', 'tryParticipateCampaign', 'loadCustomCampaigns', 'clickCustomCampaign', 'destroyCustomCampaigns',
    'loadCustomNativeAds', 'impressionCustomNativeAd', 'clickCustomNativeAd', 'completeCustomNativeAd',
    'loadCustomCpm', 'impressionCustomCpm', 'clickCustomCpm', 'getEarnableTotalRewardInfo', 'getBridgeTotalRewardInfo',
    'openOfferwallWithFilter', 'closeOfferwall', 'setUserAgreement', 'useFlagShowWhenLocked', 'setClipboard',
];
