import * as ImagePicker from 'expo-image-picker';
import type { ReceiptPlatform } from './types';
export type TrackFn = (name: string, params?: Record<string, string | number | boolean>) => void;
export type PickedReceipt = {
    /** 올릴 사진 한 장 — 여러 장이면 이어 붙인 캐시 JPEG */
    asset: ImagePicker.ImagePickerAsset;
    /** 고른 장 수(1이면 이어 붙이지 않았다) */
    count: number;
};
/** 2장이 꼭 필요한 곳에서 1장만 골랐을 때 — 올리지 않는다(대표님 10-03 23:53). 화면 문구는 NEED_TWO_TEXT */
export declare const NEED_TWO_SHOTS = "need_two_shots";
export declare const NEED_TWO_TEXT = "\uC774 \uC601\uC218\uC99D\uC740 2\uC7A5\uC774 \uD544\uC694\uD574\uC694(\uC704 \u00B7 \uC544\uB798)";
/** 15MB 넘는 사진 · 빈 결과는 'receipt_too_large' 로 던진다(예전 화면 문구 그대로 쓰려고) */
export declare const MAX_BYTES: number;
export declare function pickReceiptImages(platform: ReceiptPlatform | null, opts?: {
    track?: TrackFn;
}): Promise<PickedReceipt | null>;
