/** 연동 칩 안내 — 1.1.0 다이소몰 · 올리브영(사진 안내 없음)도 안내 · 색 · 본 곳 저장이 된다 */
import { describe, expect, it } from 'vitest';
import { accentOf, guideOf } from './data';
import { linkGuide, markLinkSeen, parseLinkSeen } from './linkGuides';

describe('연동 칩 안내', () => {
  it('다이소몰 · 올리브영 안내: 첫 장면 칩 줄에 그 칩이 덧붙고 누를 곳이 그 칩 · 로그인 장면 포함', () => {
    for (const [site, name] of [['daiso', '다이소몰'], ['oliveyoung', '올리브영']] as const) {
      const g = linkGuide(site);
      expect(g.app).toBe(site);
      const chips = g.steps[0]!.nodes.find((n) => n.type === 'chips') as { items: string[]; tap?: number };
      expect(chips.items).toEqual(['네이버', '쿠팡', '마켓컬리', '무신사', name]);
      expect(chips.tap).toBe(4);
      expect(g.steps.some((st) => st.say.includes(`${name} 로그인 화면`))).toBe(true);
      expect(accentOf(site)).toBe(g.accent);
    }
    const n = linkGuide('naver');
    expect((n.steps[0]!.nodes.find((x) => x.type === 'chips') as { items: string[] }).items).toHaveLength(4);
  });
  it('사진 안내가 있는 곳은 그 안내 색, 없는 곳은 칩 색 — guideOf 없이도 안전', () => {
    expect(accentOf('kurly')).toBe(guideOf('kurly').accent);
    expect(accentOf('daiso')).toMatch(/^#/);
  });
  it('본 곳 저장은 여섯 곳 모두 받고 모르는 값은 버린다', () => {
    expect(parseLinkSeen(JSON.stringify(['naver', 'daiso', 'oliveyoung', 'x']))).toEqual(['naver', 'daiso', 'oliveyoung']);
    expect(markLinkSeen(['naver'], 'oliveyoung')).toEqual(['naver', 'oliveyoung']);
  });
});
