"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBridgeMessage = parseBridgeMessage;
exports.openAppTarget = openAppTarget;
const policy_1 = require("./policy");
const str = (v) => (typeof v === 'string' ? v : undefined);
/** react-native-webview 의 onMessage 문자열 → 알려진 메시지. 우리가 심은 shim 이 보낸 것만 받는다(다른 글은 null) */
function parseBridgeMessage(data, nonce) {
    if (typeof data !== 'string' || data.length > 20000)
        return null;
    let j;
    try {
        j = JSON.parse(data);
    }
    catch {
        return null;
    }
    if (!j || typeof j !== 'object' || j.m !== 'MocationNativeBridge')
        return null;
    // 이 로드의 비밀 값(shim 안에만 있다)이 맞아야 한다 — iframe · 다른 글이 같은 모양의 메시지를 보내도 걸러진다
    if (nonce !== undefined && j.n !== nonce)
        return null;
    // 최상위 프레임이 보낸 것만(t:1). 틀린 값 · 없음은 거절
    if (j.t !== 1)
        return null;
    const method = j.method;
    const p = (j.params ?? {});
    switch (method) {
        case 'openAppTarget': {
            const url = str(p.url);
            if (!url)
                return null;
            const fallbackUrl = str(p.fallbackUrl);
            return { method, params: fallbackUrl ? { url, fallbackUrl } : { url } };
        }
        case 'showFloatingPopup': {
            const imageUrl = str(p.imageUrl), name = str(p.name), price = str(p.price);
            if (imageUrl === undefined || name === undefined || price === undefined)
                return null;
            // 유한한 양수 number 만 쓴다(문자열 · 객체 · true 는 강제 변환하지 않는다) — 그 밖(미전달 · 0 이하 · 숫자 아님)은 300초
            const d = p.durationSec;
            const sec = typeof d === 'number' && Number.isFinite(d) && d > 0 ? Math.max(1, Math.floor(d)) : 300;
            return { method, params: { imageUrl, name, price, durationSec: sec } };
        }
        case 'requestOverlayPermission':
        case 'hasOverlayPermission':
            return { method, params: {} };
        default:
            return null;
    }
}
/**
 * openAppTarget — 못 열면 fallbackUrl(스토어 링크 등). 막힌 주소는 열지 않는다.
 * openURL 은 앱이 넘긴다(Linking.openURL). 열었으면 true.
 */
async function openAppTarget(params, openURL) {
    const target = (0, policy_1.resolveTarget)(params.url, params.fallbackUrl);
    if (!target)
        return false;
    try {
        await openURL(target.url);
        return true;
    }
    catch {
        if (!target.fallbackUrl)
            return false;
        try {
            await openURL(target.fallbackUrl);
            return true;
        }
        catch {
            return false;
        }
    }
}
