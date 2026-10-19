import React, { type ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: (v: unknown) => v } }));
import { BenefitQuickList, type BenefitQuickItem } from './BenefitQuickList';
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
    expect(tree.filter(n => n?.type === 'Pressable')).toHaveLength(8);
    expect(tree.some(n => n?.type === 'CustomIcon')).toBe(true);
    expect(tree.some(n => n?.type === 'NativeAd')).toBe(true);
    tree.find(n => n?.type === 'Pressable').props.onPress();
    expect(onSeeAll).toHaveBeenCalledOnce();
    tree.filter(n => n?.type === 'Pressable')[1].props.onPress();
    expect(rows[0].onPress).toHaveBeenCalledOnce();
  });
  it('shows a disabled grey 완료 button and ignores even a direct callback invocation', () => {
    const row = item({ done: true });
    const tree = nodes(BenefitQuickList({ items: [row] }));
    const button = tree.find(n => n?.type === 'Pressable');
    expect(tree).toContain('완료');
    expect(tree).not.toContain('출석하기');
    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(button.props.style({ pressed: false })[1].backgroundColor).toBe('#D3D7DD');
    button.props.onPress();
    expect(row.onPress).not.toHaveBeenCalled();
  });
  it('omits hidden rows and optional controls, supports custom heading/accent and empty items', () => {
    const tree = nodes(BenefitQuickList({ title: '혜택', accentColor: '#123456', items: [item(), item({ key: 'hidden', title: '숨김', hidden: true })] }));
    expect(tree).toContain('혜택');
    expect(tree).not.toContain('숨김');
    const buttons = tree.filter(n => n?.type === 'Pressable');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.style({ pressed: false })[1].backgroundColor).toBe('#123456');
    expect(nodes(BenefitQuickList({ items: [] })).filter(n => n?.type === 'Pressable')).toHaveLength(0);
  });
});

it('uses translated done text in button and accessibility label, and renders title badge', () => {
  const tree = nodes(BenefitQuickList({ doneLabel: 'Done', items: [item({ done: true, badge: '광고' })] }));
  expect(tree).toContain('Done');
  expect(tree).toContain('광고');
  expect(tree).not.toContain('완료');
  expect(tree.find(n => n?.type === 'Pressable').props.accessibilityLabel).toBe('출석, Done');
});
it('gives all buttons the same fixed default width and allows overriding it', () => {
  const rows = [item(), item({ key: 'long', ctaLabel: '뽑으러 가기' }), item({ key: 'done', done: true })];
  for (const buttonWidth of [undefined, 120]) {
    const tree = nodes(BenefitQuickList({ items: rows, buttonWidth }));
    const buttons = tree.filter(n => n?.type === 'Pressable');
    expect(buttons.map(n => n.props.style({ pressed: false })[1].width)).toEqual(Array(3).fill(buttonWidth ?? 100));
  }
});
