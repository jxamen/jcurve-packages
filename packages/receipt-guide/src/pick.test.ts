/**
 * 사진첩 고르기 — 2장이 꼭 필요한 곳은 2장 미만이면 올리지 않는다(대표님 10-03 23:53).
 */
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ platform: { OS: 'ios' }, launch: vi.fn(), stitch: vi.fn() }));
vi.mock('react-native', () => ({ Platform: m.platform }));
vi.mock('expo-image-picker', () => ({ launchImageLibraryAsync: m.launch }));
vi.mock('./stitch', () => ({ stitchReceipts: m.stitch }));
import { NEED_TWO_SHOTS, pickReceiptImages } from './pick';

const shot = (n: number) => ({ uri: `file:///shot${n}.png`, width: 1179, height: 2556 });
const picked = (...assets: object[]) => m.launch.mockResolvedValueOnce({ canceled: false, assets });
beforeEach(() => {
  vi.clearAllMocks(); m.platform.OS = 'ios';
  m.stitch.mockResolvedValue({ uri: 'file:///stitched.jpg', width: 1179, height: 5112 });
});

it('2장 필요한 곳(N+스토어 · 네이버페이 · 카카오페이 · 컬리 네이버페이)에서 1장만 고르면 올리지 않는다', async () => {
  for (const p of ['nplus', 'naverpay', 'kakaopay', 'kurly_npay'] as const) {
    picked(shot(1));
    await expect(pickReceiptImages(p)).rejects.toThrow(NEED_TWO_SHOTS);
  }
  expect(m.stitch).not.toHaveBeenCalled();
});

it('2장 · 3장은 고른 순서대로 이어 붙여 한 장, 장 수를 알려 준다', async () => {
  const track = vi.fn();
  picked(shot(1), shot(2));
  await expect(pickReceiptImages('naverpay', { track })).resolves.toEqual({ asset: { uri: 'file:///stitched.jpg', width: 1179, height: 5112 }, count: 2 });
  expect(m.stitch).toHaveBeenLastCalledWith([shot(1), shot(2)]);
  expect(track).toHaveBeenCalledWith('receipt_multi_pick', { count: 2 });
  picked(shot(1), shot(2), shot(3));
  await expect(pickReceiptImages('kakaopay')).resolves.toMatchObject({ count: 3 });
  expect(m.launch).toHaveBeenLastCalledWith(expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 3, orderedSelection: true }));
});

it('1장 곳은 예전 옵션 그대로, 여러 장 옵션을 넣지 않는다', async () => {
  picked(shot(1));
  await expect(pickReceiptImages('baemin')).resolves.toEqual({ asset: shot(1), count: 1 });
  expect(m.launch).toHaveBeenLastCalledWith({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85, exif: false });
  picked(shot(1));
  await expect(pickReceiptImages('kurly')).resolves.toMatchObject({ count: 1 });
});

it('취소하면 아무것도 하지 않는다', async () => {
  m.launch.mockResolvedValueOnce({ canceled: true, assets: null });
  await expect(pickReceiptImages('nplus')).resolves.toBeNull();
});
