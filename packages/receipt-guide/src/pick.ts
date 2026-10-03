/**
 * 사진첩에서 영수증 고르기 — 길게 캡처하는 곳(N+스토어 · 네이버페이 · 컬리(네이버페이) · 카카오페이)만 여러 장(3장까지).
 *
 * 2장이 꼭 필요한 곳(TWO_SHOT)은 2장 미만이면 던진다(need_two_shots) — 올리기로 넘기지 않는다.
 * 한 장이면 **예전과 똑같은 옵션**으로 연다(여러 장 옵션을 아예 넣지 않는다). 여러 장이면 고른 순서대로
 * (orderedSelection) 위 → 아래로 이어 붙여 **한 장**을 돌려준다 — 올리기 쪽은 늘 사진 한 장만 받는다.
 * 웹은 이어 붙이기(Skia 오프스크린)를 쓰지 않으니 한 장만.
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { needsTwo, pickLimit } from './data';
import { stitchReceipts } from './stitch';
import type { ReceiptPlatform } from './types';

export type TrackFn = (name: string, params?: Record<string, string | number | boolean>) => void;

export type PickedReceipt = {
  /** 올릴 사진 한 장 — 여러 장이면 이어 붙인 캐시 JPEG */
  asset: ImagePicker.ImagePickerAsset;
  /** 고른 장 수(1이면 이어 붙이지 않았다) */
  count: number;
};

/** 2장이 꼭 필요한 곳에서 1장만 골랐을 때 — 올리지 않는다(대표님 10-03 23:53). 화면 문구는 NEED_TWO_TEXT */
export const NEED_TWO_SHOTS = 'need_two_shots';
export const NEED_TWO_TEXT = '이 영수증은 2장이 필요해요(위 · 아래)';

/** 15MB 넘는 사진 · 빈 결과는 'receipt_too_large' 로 던진다(예전 화면 문구 그대로 쓰려고) */
export const MAX_BYTES = 15 * 1024 * 1024;

export async function pickReceiptImages(platform: ReceiptPlatform | null, opts: { track?: TrackFn } = {}): Promise<PickedReceipt | null> {
  const limit = Platform.OS === 'web' ? 1 : pickLimit(platform);
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 0.85, exif: false };
  if (limit > 1) Object.assign(options, { allowsMultipleSelection: true, selectionLimit: limit, orderedSelection: true });
  const result = await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const assets = result.assets.slice(0, limit);
  if (!assets.length || assets.some((a) => a.fileSize && a.fileSize > MAX_BYTES)) throw new Error('receipt_too_large');
  if (needsTwo(platform) && assets.length < 2) throw new Error(NEED_TWO_SHOTS);
  if (assets.length === 1) return { asset: assets[0], count: 1 };
  opts.track?.('receipt_multi_pick', { count: assets.length });

  return { asset: await stitchReceipts(assets), count: assets.length };
}
