import { afterEach, describe, expect, it, vi } from 'vitest';
import { isFullScreenAd, onFullScreenAd, resetAppOpenGuard, setFullScreenAd, watchFullScreenAd } from './appOpenGuard';

afterEach(() => resetAppOpenGuard());

describe('전체화면 광고 듣기 (0.1.0)', () => {
  it('watchFullScreenAd(머니트리 방식): 처음 하나가 뜰 때와 마지막 하나가 닫힐 때만 부른다 — 겹쳐도 한 번씩', () => {
    const seen: boolean[] = [];
    watchFullScreenAd((v) => seen.push(v));
    setFullScreenAd(true); setFullScreenAd(true); setFullScreenAd(false);
    expect(seen).toEqual([true]);
    setFullScreenAd(false);
    expect(seen).toEqual([true, false]);
    setFullScreenAd(false);                       // 더 내려도 변화 없음
    expect(seen).toEqual([true, false]);
    expect(isFullScreenAd()).toBe(false);
  });
  it('onFullScreenAd(영테크 방식): 여러 곳이 듣고, 돌려준 함수로 그만 듣는다', () => {
    const a = vi.fn(); const b = vi.fn();
    const stopA = onFullScreenAd(a); onFullScreenAd(b);
    setFullScreenAd(true);
    expect(a).toHaveBeenCalledWith(true); expect(b).toHaveBeenCalledWith(true);
    stopA();
    setFullScreenAd(false);
    expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenLastCalledWith(false);
  });
  it('두 방식을 같이 써도 서로 영향이 없고, 던지는 듣는 쪽이 있어도 광고 흐름과 다른 듣는 쪽은 멈추지 않는다', () => {
    const single = vi.fn(); const ok = vi.fn();
    watchFullScreenAd(single);
    onFullScreenAd(() => { throw new Error('app bug'); }); onFullScreenAd(ok);
    expect(() => setFullScreenAd(true)).not.toThrow();
    expect(single).toHaveBeenCalledWith(true); expect(ok).toHaveBeenCalledWith(true);
    expect(isFullScreenAd()).toBe(true);
  });
  it('watchFullScreenAd(null) 로 풀 수 있고, reset 은 듣는 쪽도 비운다', () => {
    const single = vi.fn(); const multi = vi.fn();
    watchFullScreenAd(single); watchFullScreenAd(null); onFullScreenAd(multi);
    setFullScreenAd(true);
    expect(single).not.toHaveBeenCalled(); expect(multi).toHaveBeenCalledTimes(1);
    resetAppOpenGuard();
    setFullScreenAd(true);
    expect(multi).toHaveBeenCalledTimes(1);
  });
});
