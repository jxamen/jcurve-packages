/**
 * 영수증 올리는 법 데이터 검사 — 재생기가 손가락을 보낼 곳이 정해지는지, 순서 · 번호가 맞는지.
 */
import { describe, expect, it } from 'vitest';
import { GUIDES, PLATFORM_ORDER, guideOf, isPlatform, pickLimit, platformName } from './data';
import { targetsOf } from './types';

describe('영수증 올리는 법', () => {
  it('고르는 칸 순서 — 배민 · 쿠팡 · 쿠팡이츠 · N+스토어 · 네이버페이 · 무신사 · 컬리 · 카카오페이 · 기타 앱 · 종이 영수증(대표님 10-03)', () => {
    expect(PLATFORM_ORDER).toEqual(['baemin', 'coupang', 'coupangeats', 'nplus', 'naverpay', 'musinsa', 'kurly', 'kakaopay', 'other', 'paper']);
    expect(PLATFORM_ORDER.map(platformName)).toEqual(['배민', '쿠팡', '쿠팡이츠', 'N+스토어', '네이버페이', '무신사', '컬리', '카카오페이', '기타 앱', '종이 영수증']);
  });

  for (const g of GUIDES) {
    describe(g.name, () => {
      it('누르는 장면은 누를 곳이 딱 하나, 캡처 장면은 없다', () => {
        for (const step of g.steps) expect(targetsOf(step), step.say).toBe(step.action === 'capture' ? 0 : 1);
      });

      it('번호는 1부터 차례로 — 대표님 단계 글 수와 같다', () => {
        const nos = g.steps.map((s) => s.no);
        expect(nos[0]).toBe(1);
        for (let i = 1; i < nos.length; i += 1) expect(nos[i] - nos[i - 1]).toBeGreaterThanOrEqual(0);
        for (let i = 1; i < nos.length; i += 1) expect(nos[i] - nos[i - 1]).toBeLessThanOrEqual(1);
        expect(nos[nos.length - 1]).toBe(g.summary.length);
      });

      it('마지막은 영테크 「사진 올리기」로 사진첩에서 고르기', () => {
        const end = g.steps[g.steps.length - 1];
        expect(end.say).toContain('사진 올리기');
        expect(end.nodes.some((n) => n.type === 'album')).toBe(true);
      });

      it('실제 전화번호 · 카드번호 같은 값이 없다', () => {
        const text = JSON.stringify(g);
        expect(text).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
        expect(text).not.toMatch(/\d{4}-\d{4}-\d{4}-\d{4}/);
      });
    });
  }

  it('여러 장은 길게 캡처하는 곳만(N+스토어 · 컬리 네이버페이 · 기타 앱) 3장까지, 나머지는 1장', () => {
    for (const p of ['nplus', 'naverpay', 'kurly', 'kakaopay', 'other'] as const) expect(pickLimit(p)).toBe(3);
    for (const p of ['baemin', 'coupang', 'coupangeats', 'musinsa', 'paper'] as const) expect(pickLimit(p)).toBe(1);
    expect(pickLimit(null)).toBe(1);
    expect(guideOf('nplus').pickHint).toBe('위 → 아래 순서로 2장 골라 주세요');
  });

  it('컬리는 카드 결제 · 네이버페이 두 갈래를 차례로 보여 준다(대표님 10-03 23:36)', () => {
    const branches = guideOf('kurly').steps.map((st) => st.branch).filter(Boolean);
    expect(new Set(branches)).toEqual(new Set(['카드 결제라면', '네이버페이(신용카드)라면']));
    expect(guideOf('kurly').steps.filter((st) => st.branch === '네이버페이(신용카드)라면' && st.action === 'capture')).toHaveLength(2);
  });

  it('네이버페이는 「PDF로 저장」이 사진첩에 안 들어간다고 알린다', () => {
    expect(guideOf('naverpay').note).toBe('아래 「PDF로 저장」은 사진첩에 안 들어가요 — 캡처 2장으로 올려 주세요');
  });

  it('카카오페이는 온라인 결제만 된다고 알린다', () => {
    expect(guideOf('kakaopay').note).toBe('온라인 결제만 돼요 — 오프라인 결제 내역은 올릴 수 없어요');
  });

  it('다른 안내로 가는 길은 있는 안내를 가리킨다', () => {
    for (const g of GUIDES) for (const st of g.steps) if (st.link) expect(GUIDES.some((x) => x.app === st.link!.app && x.app !== g.app)).toBe(true);
    expect(guideOf('kurly').steps.some((st) => st.link?.app === 'naverpay')).toBe(true);
  });

  it('저장된 값이 깨졌으면 고른 곳으로 보지 않는다', () => {
    expect(isPlatform('coupangeats')).toBe(true);
    expect(isPlatform('paper')).toBe(true);
    expect(isPlatform('naver')).toBe(false);
    expect(isPlatform(null)).toBe(false);
  });
});
