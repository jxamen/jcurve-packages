import { describe, expect, it, vi } from 'vitest';

// 네이티브 모듈이 없는 환경(OTA 만 받은 옛 빌드 · 시험)에서는 모든 함수가 조용히 false · 아무 일 없음이어야 한다
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-modules-core', () => ({ requireNativeModule: () => { throw new Error('no native module'); } }));

describe('@jcurve/overlay — 네이티브 모듈이 없을 때', async () => {
  const m = await import('./index');
  it('isAvailable · hasPermission 은 false', () => {
    expect(m.isAvailable()).toBe(false);
    expect(m.hasPermission()).toBe(false);
  });
  it('requestPermission · hide 는 아무 일 없이 끝나고 show 는 false', async () => {
    expect(() => m.requestPermission()).not.toThrow();
    expect(() => m.hide()).not.toThrow();
    await expect(m.show({ imageUrl: 'https://x/y.png', name: '상품', price: '1,000원', durationSec: 5 })).resolves.toBe(false);
  });
});
