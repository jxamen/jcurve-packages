"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAvailable = isAvailable;
exports.hasPermission = hasPermission;
exports.requestPermission = requestPermission;
exports.show = show;
exports.hide = hide;
const react_native_1 = require("react-native");
/** 네이티브 모듈(Expo Module `JcurveOverlay`) — 이 패키지가 든 빌드가 아니면 null(OTA 만 받은 옛 빌드 · 웹 · 시험) */
let JcurveOverlayModule = null;
try {
    if (react_native_1.Platform.OS === 'android') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { requireNativeModule } = require('expo-modules-core');
        JcurveOverlayModule = requireNativeModule('JcurveOverlay');
    }
}
catch {
    JcurveOverlayModule = null; // 모듈이 없는 빌드 — 모든 함수가 false · 아무 일 안 함
}
/** Check if overlay module is available on this platform. */
function isAvailable() {
    return JcurveOverlayModule !== null && react_native_1.Platform.OS === 'android';
}
/** Check if device has overlay permission (Android only; always false on iOS). */
function hasPermission() {
    if (!isAvailable())
        return false;
    return JcurveOverlayModule.hasPermission();
}
/** Request overlay permission from user (Android only; no-op on iOS). */
function requestPermission() {
    if (!isAvailable())
        return;
    JcurveOverlayModule.requestPermission();
}
/** Show floating popup card with image, product name, and price. Returns success status. */
async function show(params) {
    if (!isAvailable())
        return false;
    try {
        return await JcurveOverlayModule.show(params);
    }
    catch (e) {
        console.error('[JcurveOverlay] show error:', e);
        return false;
    }
}
/** Hide the floating popup. */
function hide() {
    if (!isAvailable())
        return;
    JcurveOverlayModule.hide();
}
