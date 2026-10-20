import React, { type ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: (v: unknown) => v } }));
// 단추를 센다 — 0.4.3 부터 줄 하나가 Pressable 하나(안쪽 버튼은 그림 View)
const isButton = (n: any) => n?.type === 'Pressable' && n.props?.accessibilityRole === 'button';
const cta = (tree: any[]) => tree.find(n => n?.type === 'View' && n.props?.pointerEvents === 'none' && n.props.style?.[1]?.width !== undefined);
import { BenefitQuickList, pressOnce, resetTapGuard, TAP_GUARD_MS, type BenefitQuickItem } from './BenefitQuickList';
import { beforeEach } from 'vitest';
beforeEach(() => resetTapGuard());
// Walk the rendered React element tree, including functional icon components.
function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement(node)) return [node];
  const element = node as ReactElement<any>;
  if (typeof element.type === 'function') return nodes((element.type as any)(element.props));
  return [element, ...nodes(element.props.children)];
}
const item = (overrides: Partial<BenefitQuickItem> = {}): BenefitQuickItem => ({ key: 'a', title: '출석', subtitle: '매일 참여', ctaLabel: '출석하기', icon: 'calendar', tint: '#EEE', onPress: vi.fn(), ...overrides });
describe('BenefitQuickList', () => {
  it('renders default title, all built-in icons, custom node and footer; delegates presses', () => {
    const onSeeAll = vi.fn();
    const rows = ['calendar', 'bag', 'pin', 'star', 'ticket', 'friend'].map((icon, i) => item({ key: String(i), icon }));
    rows.push(item({ key: 'custom', icon: React.createElement('CustomIcon') }));
    const tree = nodes(BenefitQuickList({ items: rows, seeAllLabel: '전체', onSeeAll, footer: React.createElement('NativeAd') }));
    expect(tree).toContain('바로 받는 혜택');
    expect(tree.filter(n => isButton(n))).toHaveLength(8);
    expect(tree.some(n => n?.type === 'CustomIcon')).toBe(true);
    expect(tree.some(n => n?.type === 'NativeAd')).toBe(true);
    tree.find(n => isButton(n)).props.onPress();
    expect(onSeeAll).toHaveBeenCalledOnce();
    tree.filter(n => isButton(n))[1].props.onPress();
    expect(rows[0].onPress).toHaveBeenCalledOnce();
  });
  it('shows a disabled grey 완료 button and ignores even a direct callback invocation', () => {
    const row = item({ done: true });
    const tree = nodes(BenefitQuickList({ items: [row] }));
    const button = tree.find(n => isButton(n));
    expect(tree).toContain('완료');
    expect(tree).not.toContain('출석하기');
    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(cta(tree).props.style[1].backgroundColor).toBe('#D3D7DD');
    button.props.onPress();
    expect(row.onPress).not.toHaveBeenCalled();
  });
  it('omits hidden rows and optional controls, supports custom heading/accent and empty items', () => {
    const tree = nodes(BenefitQuickList({ title: '혜택', accentColor: '#123456', items: [item(), item({ key: 'hidden', title: '숨김', hidden: true })] }));
    expect(tree).toContain('혜택');
    expect(tree).not.toContain('숨김');
    const buttons = tree.filter(n => isButton(n));
    expect(buttons).toHaveLength(1);
    expect(cta(tree).props.style[1].backgroundColor).toBe('#123456');
    expect(nodes(BenefitQuickList({ items: [] })).filter(n => isButton(n))).toHaveLength(0);
  });
});

it('uses translated done text in button and accessibility label, and renders title badge', () => {
  const tree = nodes(BenefitQuickList({ doneLabel: 'Done', items: [item({ done: true, badge: '광고' })] }));
  expect(tree).toContain('Done');
  expect(tree).toContain('광고');
  expect(tree).not.toContain('완료');
  expect(tree.find(n => isButton(n)).props.accessibilityLabel).toBe('출석, Done');
});
it('gives all buttons the same fixed default width and allows overriding it', () => {
  const rows = [item(), item({ key: 'long', ctaLabel: '뽑으러 가기' }), item({ key: 'done', done: true })];
  for (const buttonWidth of [undefined, 120]) {
    const tree = nodes(BenefitQuickList({ items: rows, buttonWidth }));
    const ctas = tree.filter(n => n?.type === 'View' && n.props?.pointerEvents === 'none' && n.props.style?.[1]?.width !== undefined);
    expect(ctas.map(n => n.props.style[1].width)).toEqual(Array(3).fill(buttonWidth ?? 100));
  }
});

it('drops the heading row when title is empty and there is no see-all', () => {
  const tree = JSON.stringify(nodes(BenefitQuickList({ title: '', items: [] })));
  expect(tree).not.toContain('바로 받는 혜택');
});

it('tapping anywhere on a row delegates, but not on a done row', () => {
  const go = vi.fn(); const done = vi.fn();
  const rows = nodes(BenefitQuickList({ items: [
    { key: 'a', title: 'A', subtitle: 'a', ctaLabel: 'Go', icon: 'calendar', onPress: go },
    { key: 'b', title: 'B', subtitle: 'b', ctaLabel: 'Go', icon: 'calendar', onPress: done, done: true },
  ] })).filter((n: any) => isButton(n));
  expect(rows).toHaveLength(2);
  rows[0].props.onPress(); rows[1].props.onPress();
  expect(go).toHaveBeenCalledTimes(1); expect(done).not.toHaveBeenCalled();
  expect(rows[1].props.disabled).toBe(true);
});

describe('0.4.3 한 줄 = 한 단추 · 두 번 누름 막기는 시간이 지나면 반드시 풀린다', () => {
  it('줄 안에 Pressable 이 겹치지 않는다 — 줄마다 단추 하나, 버튼 자리는 누름을 받지 않는 View', () => {
    const tree = nodes(BenefitQuickList({ title: '', items: [item(), item({ key: 'b', title: '행운 찬스', ctaLabel: '뽑기' })] }));
    const pressables = tree.filter(n => n?.type === 'Pressable');
    expect(pressables).toHaveLength(2);
    for (const p of pressables) expect(nodes(p.props.children).filter(n => n?.type === 'Pressable')).toHaveLength(0);
    expect(pressables[1].props.accessibilityLabel).toBe('행운 찬스, 뽑기');
    expect(pressables[0].props.style({ pressed: true })[2]).toEqual({ opacity: 0.85 });
  });
  it('빠른 두 번째 누름만 무시하고, 시간이 지나면 다시 들어간다(처리 함수가 던져도)', () => {
    const run = vi.fn();
    expect(pressOnce(run, 10_000)).toBe(true);
    expect(pressOnce(run, 10_000 + TAP_GUARD_MS - 1)).toBe(false);
    expect(pressOnce(run, 10_000 + TAP_GUARD_MS)).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
    expect(() => pressOnce(() => { throw new Error('x'); }, 20_000)).toThrow();
    expect(pressOnce(run, 20_000 + TAP_GUARD_MS)).toBe(true);
    // 시계가 뒤로 가도 막히지 않는다
    expect(pressOnce(run, 5_000)).toBe(true);
  });
  it('줄을 누르면 그 줄 onPress 가 한 번 — 바로 다른 줄을 눌러도 막힌다(화면 이동 중 두 곳 열림 방지)', () => {
    const a = item({ key: 'a' }); const b = item({ key: 'b' });
    const rows = nodes(BenefitQuickList({ items: [a, b] })).filter(n => isButton(n));
    rows[0].props.onPress(); rows[1].props.onPress();
    expect(a.onPress).toHaveBeenCalledOnce();
    expect(b.onPress).not.toHaveBeenCalled();
  });
});
