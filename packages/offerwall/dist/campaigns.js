"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanCampaigns = cleanCampaigns;
exports.normalizeCampaignName = normalizeCampaignName;
exports.findCampaignKey = findCampaignKey;
exports.nativeCampaignApi = nativeCampaignApi;
exports.nativeCopyText = nativeCopyText;
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '');
/** Native → JS list, keeping only well-formed rows (a key and a name). */
function cleanCampaigns(raw) {
    if (!Array.isArray(raw))
        return [];
    const seen = new Set();
    const out = [];
    for (const row of raw.slice(0, 500)) {
        const campaignKey = clean(row?.campaignKey, 64);
        const name = clean(row?.name ?? row?.title, 120); // the native list calls it title
        if (!campaignKey || !name || seen.has(campaignKey))
            continue;
        seen.add(campaignKey);
        const reward = clean(typeof row?.reward === 'number' ? String(row.reward) : row?.reward, 30); // iOS sends a number, Android a string
        out.push(reward ? { campaignKey, name, reward } : { campaignKey, name });
    }
    return out;
}
/** '[공식] Foo Bar!' → 'foobar'. Keeps Hangul, letters and digits only. */
function normalizeCampaignName(name) {
    return String(name).toLowerCase().replace(/[^0-9a-zㄱ-ㆎ가-힣]+/g, '');
}
const withoutBrackets = (name) => String(name).replace(/[\[(（【<][^\])）】>]*[\])）】>]/g, '');
/**
 * Finds a campaign's key by its displayed name: exactly the same, then the same without spaces and punctuation, then the
 * same also without bracketed parts. Each step must match exactly one campaign; two different campaigns on a step mean
 * "unsure" and give null (opening the wrong campaign is worse than showing the plain list).
 */
function findCampaignKey(list, name) {
    const steps = [s => s.trim(), normalizeCampaignName, s => normalizeCampaignName(withoutBrackets(s))];
    for (const step of steps) {
        const want = step(name);
        if (!want)
            continue;
        const keys = new Set(list.filter(c => step(c.name) === want).map(c => c.campaignKey));
        if (keys.size === 1)
            return [...keys][0];
        if (keys.size > 1)
            return null;
    }
    return null;
}
/**
 * The bridge when this binary has it, else null. Only a property lookup on `NativeModules`: no `require` of a native
 * package, so a binary without the module cannot crash here.
 */
function nativeCampaignApi() {
    try {
        const { NativeModules } = require('react-native');
        const mod = NativeModules?.JCurveOfferwallModule;
        if (!mod || typeof mod.loadCustomCampaigns !== 'function' || typeof mod.openCampaignDetail !== 'function')
            return null;
        return {
            list: async () => cleanCampaigns(await mod.loadCustomCampaigns(100)),
            open: async (campaignKey) => (await mod.openCampaignDetail(campaignKey)) === true,
        };
    }
    catch {
        return null;
    }
}
/** Clipboard through the same bridge (`setClipboard`), or null when this binary has none. */
function nativeCopyText() {
    try {
        const { NativeModules } = require('react-native');
        const mod = NativeModules?.JCurveOfferwallModule;
        if (!mod || typeof mod.setClipboard !== 'function')
            return null;
        return async (text) => (await mod.setClipboard(text)) === true;
    }
    catch {
        return null;
    }
}
