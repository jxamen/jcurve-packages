import { describe, expect, it } from 'vitest';
import { STITCH_MAX_HEIGHT, stitchLayout } from './stitchLayout';

describe('여러 장 이어 붙이기 자리', () => {
  it('같은 폭 캡처 2장은 그대로 위 → 아래로 쌓는다', () => {
    const l = stitchLayout([{ width: 1179, height: 2556 }, { width: 1179, height: 2556 }]);
    expect(l.width).toBe(1179);
    expect(l.height).toBe(5112);
    expect(l.rects).toEqual([
      { x: 0, y: 0, width: 1179, height: 2556 },
      { x: 0, y: 2556, width: 1179, height: 2556 },
    ]);
  });

  it('고른 순서를 바꾸지 않는다 — 첫 장이 맨 위', () => {
    const l = stitchLayout([{ width: 1000, height: 500 }, { width: 1000, height: 1500 }, { width: 1000, height: 800 }]);
    expect(l.rects.map((r) => r.y)).toEqual([0, 500, 2000]);
    expect(l.rects.map((r) => r.height)).toEqual([500, 1500, 800]);
  });

  it('폭은 가장 넓은 사진에 맞추고, 좁은 사진은 비율대로 키운다', () => {
    const l = stitchLayout([{ width: 1080, height: 2400 }, { width: 720, height: 1600 }]);
    expect(l.width).toBe(1080);
    expect(l.rects[1]).toEqual({ x: 0, y: 2400, width: 1080, height: 2400 });
  });

  it('폭은 1440 을 넘지 않는다', () => {
    const l = stitchLayout([{ width: 2880, height: 2000 }]);
    expect(l.width).toBe(1440);
    expect(l.height).toBe(1000);
  });

  it('합친 높이가 8000 을 넘으면 폭째로 줄여 8000 안에 넣는다', () => {
    const l = stitchLayout([{ width: 1440, height: 3200 }, { width: 1440, height: 3200 }, { width: 1440, height: 3200 }]);
    expect(l.height).toBeLessThanOrEqual(STITCH_MAX_HEIGHT);
    expect(l.height).toBeGreaterThan(STITCH_MAX_HEIGHT - 10);
    expect(l.width).toBe(1199);   // 1200 이면 2667 × 3 = 8001 — 한 칸 더 줄인다
    expect(l.rects.every((r) => r.width === l.width)).toBe(true);
  });

  it('반올림으로 넘치지 않는다', () => {
    const l = stitchLayout([{ width: 1001, height: 3333 }, { width: 997, height: 3331 }, { width: 999, height: 3337 }]);
    expect(l.height).toBeLessThanOrEqual(STITCH_MAX_HEIGHT);
    expect(l.rects[2].y + l.rects[2].height).toBe(l.height);
  });

  it('크기를 모르는 사진은 받지 않는다', () => {
    expect(() => stitchLayout([])).toThrow('stitch_bad_size');
    expect(() => stitchLayout([{ width: 0, height: 100 }])).toThrow('stitch_bad_size');
  });
});
