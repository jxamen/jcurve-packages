"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetOfferwall = resetOfferwall;
exports.initializeOfferwall = initializeOfferwall;
exports.openOfferwall = openOfferwall;
const pending = () => ({ ok: false, reason: 'not_ready', message: '준비 중' });
let config = {};
let generation = 0;
function native() { try {
    return require('react-native').NativeModules?.JCurveBuzzvil;
}
catch {
    return undefined;
} }
/** Clear before logout/app switch; also invalidates asynchronous SDK login. */
function resetOfferwall() { generation++; config = {}; native()?.reset(); }
async function initializeOfferwall({ configUrl, headers }) {
    resetOfferwall();
    const current = generation;
    try {
        const response = await fetch(configUrl, { headers, cache: 'no-store' });
        if (!response.ok)
            return pending();
        const data = await response.json();
        const os = require('react-native').Platform.OS;
        const value = data?.config?.[os];
        if (current !== generation || data?.ok !== true || typeof value?.appId !== 'string' || !value.appId.trim() || typeof value?.unitId !== 'string' || !value.unitId.trim() || !native())
            return pending();
        config = { appId: value.appId.trim(), unitId: value.unitId.trim() };
        return { ok: true };
    }
    catch {
        return pending();
    }
}
/** Resolves after native login and presentation request, never grants points. */
async function openOfferwall({ usn }) {
    if (!config.appId || !config.unitId || !native())
        return pending();
    if (!/^[a-f0-9]{64}$/.test(usn))
        return { ok: false, reason: 'invalid_usn', message: '회원 정보를 확인해 주세요' };
    const current = generation;
    try {
        await native().open(config.appId, usn);
        return current === generation ? { ok: true } : pending();
    }
    catch {
        return { ok: false, reason: 'sdk_error', message: '잠시 후 다시 시도해 주세요' };
    }
}
