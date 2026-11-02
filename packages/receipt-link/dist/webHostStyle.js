"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webHostLayout = webHostLayout;
function webHostLayout(mode, os, win) {
    if (mode === 'shown') {
        return { style: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 10 }, pointerEvents: 'auto' };
    }
    const width = Math.max(320, Math.round(win.width));
    const height = Math.max(480, Math.round(win.height));
    if (os === 'ios') {
        return { style: { position: 'absolute', left: 0, top: 0, width, height, opacity: 0.01, zIndex: 0 }, pointerEvents: 'none' };
    }
    return { style: { position: 'absolute', left: -5000, top: 0, width, height, zIndex: 0 }, pointerEvents: 'none' };
}
