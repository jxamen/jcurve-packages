import { describe, expect, it } from 'vitest';
import { parseHub } from './load';

describe('추천 앱 칸 설정 — /family 의 section(2026-09-25)', () => {
  it('어드민이 정한 켜기 · 제목 · 설명을 그대로 받는다', () => {
    const h = parseHub({ items: [{ slug: 'a', name: 'A' }], section: { on: false, title: ' 함께 쓰면 좋은 앱 ', desc: '포인트를 더 모아요' } });

    expect(h.items).toHaveLength(1);
    expect(h.section).toEqual({ on: false, title: '함께 쓰면 좋은 앱', desc: '포인트를 더 모아요' });
  });

  it('칸이 없던 옛 서버 · 빈 문구는 켜짐 · 기존 문구(null)', () => {
    expect(parseHub({ items: [] }).section).toEqual({ on: true, title: null, desc: null });
    expect(parseHub({ items: [], section: { on: true, title: '  ', desc: null } }).section).toEqual({ on: true, title: null, desc: null });
    expect(parseHub(null)).toEqual({ items: [], section: { on: true, title: null, desc: null } });
  });
});
