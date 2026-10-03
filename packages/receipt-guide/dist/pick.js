"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_BYTES = void 0;
exports.pickReceiptImages = pickReceiptImages;
/**
 * 사진첩에서 영수증 고르기 — 길게 캡처하는 곳(N+스토어 · 컬리 네이버페이 · 기타 앱)만 여러 장(3장까지).
 *
 * 한 장이면 **예전과 똑같은 옵션**으로 연다(여러 장 옵션을 아예 넣지 않는다). 여러 장이면 고른 순서대로
 * (orderedSelection) 위 → 아래로 이어 붙여 **한 장**을 돌려준다 — 올리기 쪽은 늘 사진 한 장만 받는다.
 * 웹은 이어 붙이기(Skia 오프스크린)를 쓰지 않으니 한 장만.
 */
const react_native_1 = require("react-native");
const ImagePicker = __importStar(require("expo-image-picker"));
const data_1 = require("./data");
const stitch_1 = require("./stitch");
/** 15MB 넘는 사진 · 빈 결과는 'receipt_too_large' 로 던진다(예전 화면 문구 그대로 쓰려고) */
exports.MAX_BYTES = 15 * 1024 * 1024;
async function pickReceiptImages(platform, opts = {}) {
    const limit = react_native_1.Platform.OS === 'web' ? 1 : (0, data_1.pickLimit)(platform);
    const options = { mediaTypes: ['images'], allowsEditing: false, quality: 0.85, exif: false };
    if (limit > 1)
        Object.assign(options, { allowsMultipleSelection: true, selectionLimit: limit, orderedSelection: true });
    const result = await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled)
        return null;
    const assets = result.assets.slice(0, limit);
    if (!assets.length || assets.some((a) => a.fileSize && a.fileSize > exports.MAX_BYTES))
        throw new Error('receipt_too_large');
    if (assets.length === 1)
        return { asset: assets[0], count: 1 };
    opts.track?.('receipt_multi_pick', { count: assets.length });
    return { asset: await (0, stitch_1.stitchReceipts)(assets), count: assets.length };
}
