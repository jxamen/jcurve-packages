import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __reset, bandShows, hasWaiting, onUpdateReady, pullUpdateSoon } from './updates';

beforeEach(() => { __reset(); vi.useRealTimers(); });

describe('띠를 낼 때인가', () => {
  it('받아 둔 것이 있고 알림을 켰고 키보드가 없을 때만', () => {
    expect(bandShows(true, true, false)).toBe(true);
  });

  it('받아 둔 것이 없으면 안 낸다', () => {
    expect(bandShows(false, true, false)).toBe(false);
  });

  it('알려 주기를 꺼 두면 안 낸다', () => {
    expect(bandShows(true, false, false)).toBe(false);
  });

  it('키보드가 자리를 쓰면 안 낸다 — 입력하는 사람을 가리면 안 된다', () => {
    expect(bandShows(true, true, true)).toBe(false);
  });
});

describe('다 받으면 알리기', () => {
  it('아직 못 받았으면 부르지 않는다', () => {
    const fn = vi.fn();
    onUpdateReady(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it('처음에는 받아 둔 것이 없다', () => {
    expect(hasWaiting()).toBe(false);
  });
});

describe('받으러 가기', () => {
  it('한 번 켠 동안 두 번 걸지 않는다', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'setTimeout');
    pullUpdateSoon(10);
    pullUpdateSoon(10);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('expo-updates 가 없어도 던지지 않는다 — 없는 빌드에서 앱이 죽으면 안 된다', async () => {
    vi.useFakeTimers();
    pullUpdateSoon(0);
    expect(() => vi.runAllTimers()).not.toThrow();
    await Promise.resolve();
  });
});
