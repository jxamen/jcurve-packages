import React, { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('react', async () => ({ ...await vi.importActual<any>('react'), useState: (v: any) => [v, vi.fn()], useEffect: vi.fn(), useRef: (v: any) => ({ current: v }) }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (v: unknown) => v },
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
  Platform: { OS: 'ios' }, PanResponder: { create: (cfg: unknown) => ({ panHandlers: cfg }) },
}));
import { LuckyChancePage, LUCKY_CHANCE_TITLE } from './LuckyChancePage';
import { drawLabel, drawSubLine } from './logic';

/** 렌더 트리를 납작하게 편다(함수 컴포넌트는 불러서 펼친다) */
function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement(node)) return [node];
  const el = node as ReactElement<any>;
  if (typeof el.type === 'function') return nodes((el.type as any)(el.props));
  return [el, ...nodes(el.props.children)];
}
const page = (over: Record<string, unknown> = {}) => nodes(LuckyChancePage({ freeLeft: 1, adLeft: 2, onDraw: vi.fn(), onBack: vi.fn(), ...over } as any));
const strings = (tree: any[]) => tree.filter(x => typeof x === 'string');
const at = (tree: any[], pred: (n: any) => boolean) => tree.findIndex(pred);

describe('행운 찬스 화면 — 제목 「행운 룰렛」 고정 · 카드 안 제목 줄 없음(0.4.14, 대표님 10-20 23:11)', () => {
  it('머리 제목은 「행운 룰렛」이다', () => {
    expect(LUCKY_CHANCE_TITLE).toBe('행운 룰렛');
    expect(strings(page())).toContain('행운 룰렛');
  });
  it('앱이 title 을 넘겨도 쓰지 않는다 — 「행운 찬스」 · 아무 글자도 머리에 나오지 않는다', () => {
    const text = strings(page({ title: '행운 찬스' }));
    expect(text).toContain('행운 룰렛');
    expect(text).not.toContain('행운 찬스');
    expect(strings(page({ title: '다른 제목' }))).not.toContain('다른 제목');
  });
  it('카드 안 큰 제목 줄(drawTitle)을 그리지 않는다 — 기본값 · 앱이 준 값 모두', () => {
    for (const over of [{}, { drawTitle: '머니트리 뽑기' }, { drawTitle: '행운 룰렛' }, { drawTitle: '행운 뽑기' }]) {
      const text = strings(page(over));
      expect(text, JSON.stringify(over)).not.toContain('머니트리 뽑기');
      expect(text, JSON.stringify(over)).not.toContain('행운 뽑기');
      expect(text.filter(t => t === '행운 룰렛'), '머리 말고는 「행운 룰렛」이 또 나오지 않는다').toHaveLength(1);
    }
  });
  it('나머지 모양은 그대로 — 부제 · 경품 · 확률권 줄 · 뽑기 단추 · 참여형 광고 카드', () => {
    const tree = page({ prizes: ['A 5P', 'B 10P'], boost: 2, boostText: '설명', offerwall: { name: '애드팝콘', onOpen: vi.fn() } });
    const text = strings(tree);
    expect(text).toContain(drawSubLine({ free: 1, ad: 2, waitMs: 0 }));
    expect(text).toContain(drawLabel({ free: true, waitMs: 0 }));
    expect(text.some(t => t.startsWith('꽝 없이'))).toBe(true);
    expect(text).toContain('확률권 2장 — 설명');
    expect(text).toContain('애드팝콘');                                 // 참여형 카드의 제목은 그대로
    expect(text).toContain('참여하러 가기');
  });
  it('뽑기는 예전처럼 동작한다 — 무료가 남았으면 무료로, 없으면 광고로', () => {
    const free = vi.fn();
    const pressFree = page({ onDraw: free }).find(n => n?.type === 'Pressable' && n.props.accessibilityLabel === drawLabel({ free: true, waitMs: 0 }));
    pressFree.props.onPress();
    expect(free).toHaveBeenCalledWith(false);
    const ad = vi.fn();
    const pressAd = page({ freeLeft: 0, adLeft: 1, onDraw: ad }).find(n => n?.type === 'Pressable' && n.props.accessibilityLabel === drawLabel({ free: false, waitMs: 0 }));
    pressAd.props.onPress();
    expect(ad).toHaveBeenCalledWith(true);
  });

  describe('광고 자리(footer) — 위치만 확인, 코드는 바꾸지 않았다', () => {
    const ad = () => React.createElement('NativeAd');
    const scrollTree = (tree: any[]) => nodes(tree.find(n => n?.type === 'ScrollView').props.children);

    it('카드 바로 뒤, 같은 스크롤 안에 한 번 그려지고 그 뒤에는 아무것도 없다', () => {
      const tree = page({ footer: ad() });
      const inScroll = scrollTree(tree);
      const draw = at(inScroll, n => n === drawLabel({ free: true, waitMs: 0 }));
      const footer = at(inScroll, n => n?.type === 'NativeAd');
      expect(draw).toBeGreaterThanOrEqual(0);
      expect(footer).toBeGreaterThan(draw);
      expect(tree.filter(n => n?.type === 'NativeAd')).toHaveLength(1);
      expect(inScroll.slice(footer + 1).filter(n => typeof n === 'string')).toEqual([]);   // 광고 뒤에는 글자가 없다
    });
    it('참여형 카드가 있으면 그 카드까지 지나서 광고가 온다 — 순서: 뽑기 카드 → 참여형 카드 → 광고', () => {
      const inScroll = scrollTree(page({ footer: ad(), offerwall: { name: '애드팝콘', onOpen: vi.fn() } }));
      const draw = at(inScroll, n => n === drawLabel({ free: true, waitMs: 0 }));
      const offer = at(inScroll, n => n === '참여하러 가기');
      const footer = at(inScroll, n => n?.type === 'NativeAd');
      expect(draw).toBeLessThan(offer);
      expect(offer).toBeLessThan(footer);
    });
    it('광고를 안 넘기면 자리도 없다', () => {
      expect(page().some(n => n?.type === 'NativeAd')).toBe(false);
    });
  });
});
