import { describe, expect, it } from 'vitest';
import { webHostLayout } from './webHostStyle';

const WIN = { width: 390, height: 844 };

describe('읽기 웹뷰 놓기 (webHostLayout)', () => {
  it('숨김일 때도 멈추지 않는다 — display none · opacity 0 · 크기 0 · 보이지 않는 표시를 쓰지 않는다', () => {
    for (const os of ['ios', 'android']) {
      const { style } = webHostLayout('hidden', os, WIN);
      expect(JSON.stringify(style)).not.toMatch(/display|visible|hidden/i);
      expect(style.opacity === undefined || style.opacity > 0).toBe(true);
      expect(style.width).toBeGreaterThanOrEqual(320);
      expect(style.height).toBeGreaterThanOrEqual(480);
    }
  });

  it('iOS 숨김: 실제 화면 크기 · alpha 0.01 · 터치 안 받음(1px 로 줄이면 사이트가 1px 폭으로 그려진다)', () => {
    const l = webHostLayout('hidden', 'ios', WIN);
    expect(l.style).toMatchObject({ position: 'absolute', left: 0, top: 0, width: 390, height: 844, opacity: 0.01 });
    expect(l.pointerEvents).toBe('none');
  });

  it('Android 숨김: 실제 크기로 화면 밖(left -5000) · 투명도는 건드리지 않음 · 터치 안 받음', () => {
    const l = webHostLayout('hidden', 'android', WIN);
    expect(l.style).toMatchObject({ position: 'absolute', left: -5000, width: 390, height: 844 });
    expect(l.style.opacity).toBeUndefined();
    expect(l.pointerEvents).toBe('none');
  });

  it('작은 창 값이 와도 읽기에 필요한 최소 크기를 지킨다', () => {
    const l = webHostLayout('hidden', 'android', { width: 0, height: 0 });
    expect(l.style.width).toBe(320);
    expect(l.style.height).toBe(480);
  });

  it('보임(로그인 · 확인): 읽기 영역 전체를 덮고 목록 위에 올라와 터치를 받는다', () => {
    for (const os of ['ios', 'android']) {
      const l = webHostLayout('shown', os, WIN);
      expect(l.style).toMatchObject({ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 });
      expect(l.style.zIndex).toBeGreaterThan(webHostLayout('hidden', os, WIN).style.zIndex);
      expect(l.style.opacity).toBeUndefined();
      expect(l.pointerEvents).toBe('auto');
    }
  });
});
