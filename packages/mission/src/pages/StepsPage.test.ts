import React, { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('react', async () => ({ ...await vi.importActual<any>('react'), useState: (v: any) => [v, vi.fn()], useEffect: vi.fn(), useRef: (v: any) => ({ current: v }) }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (v: unknown) => v },
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
  Platform: { OS: 'ios' }, PanResponder: { create: (cfg: unknown) => ({ panHandlers: cfg }) },
}));
import { StepsPage } from './StepsPage';
import type { StepsStage } from './logic';

function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement(node)) return [node];
  const el = node as ReactElement<any>;
  if (typeof el.type === 'function') return nodes((el.type as any)(el.props));
  return [el, ...nodes(el.props.children)];
}
const stages: StepsStage[] = [{ id: 's1', threshold: 1000, points: 5, claimed: false }, { id: 's2', threshold: 2000, points: 5, claimed: false }];
const page = (over: Record<string, unknown> = {}) => nodes(StepsPage({ todaySteps: 2400, stages, stepsAvailable: true, onUpdate: vi.fn(), onClaim: vi.fn(), onBack: vi.fn(), ...over } as any));
const strings = (tree: any[]) => tree.filter(x => typeof x === 'string');
const at = (tree: any[], pred: (n: any) => boolean) => tree.findIndex(pred);

describe('만보기 화면 — 신발 없음 · 광고는 안내사항 위(0.4.6, 대표님 10-20 19:00)', () => {
  it('신발 그림(👟)이 없다 — 걸음 수와 말풍선은 그대로', () => {
    const tree = page();
    expect(strings(tree).join('')).not.toContain('👟');
    expect(strings(tree).join('|')).toContain('2,400');
    expect(tree.some(n => n?.type === 'Text' && String(n.props?.children).includes('걸음'))).toBe(true);
  });

  it('순서: 걸음 수 · 말풍선 → 「남은 횟수」 카드 → 광고(footer) → 「만보기 안내사항」', () => {
    const tree = page({ footer: React.createElement('NativeAd') });
    const count = at(tree, n => typeof n === 'string' && n.includes('2,400'));
    const left = at(tree, n => typeof n === 'string' && n.includes('남은 횟수'));
    const claim = at(tree, n => n?.type === 'Pressable' || (typeof n === 'string' && n.includes('광고 보고 5P 받기')));
    const ad = at(tree, n => n?.type === 'NativeAd');
    const guide = at(tree, n => n === '만보기 안내사항');
    expect([count, left, ad, guide].every(i => i >= 0)).toBe(true);
    expect(count).toBeLessThan(left);
    expect(left).toBeLessThan(ad);
    expect(ad).toBeLessThan(guide);
    expect(claim).toBeGreaterThanOrEqual(0);
  });

  it('광고가 맨 아래가 아니다 — 안내사항 뒤에는 광고가 없다', () => {
    const tree = page({ footer: React.createElement('NativeAd') });
    const guide = at(tree, n => n === '만보기 안내사항');
    expect(tree.slice(guide).some(n => n?.type === 'NativeAd')).toBe(false);
    expect(tree.filter(n => n?.type === 'NativeAd')).toHaveLength(1);                  // 한 번만 그린다(PageFrame footer 로 또 그리지 않음)
  });

  it('광고(footer)를 안 넘기면 자리가 없고 나머지는 그대로', () => {
    const tree = page();
    expect(tree.some(n => n?.type === 'NativeAd')).toBe(false);
    const left = at(tree, n => typeof n === 'string' && n.includes('남은 횟수'));
    const guide = at(tree, n => n === '만보기 안내사항');
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThan(guide);
  });
});

describe('오늘 걸음 카드 하나(기본, -mc2) — 대표님 10-28 21:26~27, 전 앱 같은 모양', () => {
  const texts = (tree: any[]) => strings(tree).join('|');
  it('기본: 위 큰 걸음 수 · 말풍선이 없고, 카드 안에 「오늘 걸음 N걸음」 → 「남은 횟수」 → 설명 → 단추 순서(걸음 수는 한 번만)', () => {
    const tree = page();
    expect(texts(tree)).not.toContain('포인트를 2번 받을 수 있어요');   // 받을 횟수가 있으면 상태 줄도 없다(남은 횟수와 겹침)
    const today = at(tree, n => n === '오늘 걸음 ');
    const left = at(tree, n => typeof n === 'string' && n.includes('남은 횟수'));
    const sub = at(tree, n => typeof n === 'string' && n.includes('걸음마다 광고 보고 5P'));
    const button = at(tree, n => typeof n === 'string' && n.includes('광고 보고 5P 받기'));
    expect([today, left, sub, button].every(i => i >= 0), JSON.stringify([today, left, sub, button])).toBe(true);
    expect(today).toBeLessThan(left); expect(left).toBeLessThan(sub); expect(sub).toBeLessThan(button);
    expect(strings(tree).filter(x => x === '2,400')).toHaveLength(1);
  });
  it('mergedCard={false} 는 예전 모양 — 위 큰 걸음 수 + 말풍선, 카드에는 「오늘 걸음」 줄이 없다', () => {
    const tree = page({ mergedCard: false });
    expect(texts(tree)).toContain('포인트를 2번 받을 수 있어요');
    expect(texts(tree)).not.toContain('오늘 걸음');
    expect(texts(tree)).toContain('2,400');
  });
  it('받을 횟수 0: 카드 안 작은 상태 줄(다음 걸음까지 / 다 받음)이 남는다', () => {
    expect(texts(page({ todaySteps: 400 }))).toContain('600걸음 더 걸으면 5P');
    expect(texts(page({ todaySteps: 5000, stages: stages.map(s => ({ ...s, claimed: true })) }))).toContain('오늘 걸음 보상을 다 받았어요');
  });
  it('걸음 기능이 없는 옛 빌드: 상태 줄은 없고(업데이트 안내가 대신) 카드 모양만 바뀐다', () => {
    const tree = page({ stepsAvailable: false });
    expect(strings(tree).filter(x => typeof x === 'string' && x.includes('업데이트하면 걸음 보상을 받을 수 있어요'))).toHaveLength(1);
    expect(texts(tree)).toContain('오늘 걸음 ');
  });
});
