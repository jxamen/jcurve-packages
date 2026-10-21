import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ effects: [] as (() => any)[], reduced: true, start: vi.fn(), stop: vi.fn(), remove: vi.fn(), set: vi.fn(), listener: null as any }));
vi.mock('react', async () => ({ ...await vi.importActual<any>('react'), useRef: (v: any) => ({ current: v }), useState: () => [h.reduced, vi.fn()], useEffect: (fn: any) => h.effects.push(fn) }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: (v: any) => v },
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(true), addEventListener: (_: any, fn: any) => { h.listener = fn; return { remove: h.remove }; } },
  Easing: { inOut: (v: any) => v, sin: 'sin' },
  Animated: { View: 'AnimatedView', Value: class { setValue = h.set; }, timing: vi.fn(), sequence: vi.fn(), loop: () => ({ start: h.start, stop: h.stop }) },
}));
import { FloatingRewardChip } from './FloatingRewardChip';
function nodes(n: any): any[] { return Array.isArray(n) ? n.flatMap(nodes) : React.isValidElement(n) ? [n, ...nodes((n.props as any).children)] : [n]; }
beforeEach(() => { vi.clearAllMocks(); h.effects = []; h.reduced = true; });
it('hides completely when not visible and does not animate', () => {
  expect(FloatingRewardChip({ visible: false, label: 'draw', onPress: vi.fn(), bottomOffset: 12 })).toBeNull();
  h.effects[1](); expect(h.start).not.toHaveBeenCalled();
});
it('renders accessible label, arrow, custom icon, offset and delegates press', () => {
  const onPress = vi.fn();
  const tree = nodes(FloatingRewardChip({ visible: true, label: '3 left', icon: React.createElement('Ticket'), onPress, bottomOffset: 24 }));
  const button = tree.find(n => n?.type === 'Pressable');
  expect(button.props.accessibilityLabel).toBe('3 left'); button.props.onPress(); expect(onPress).toHaveBeenCalledOnce();
  expect(tree).toContain('›'); expect(tree.some(n => n?.type === 'Ticket')).toBe(true);
  expect(tree[0].props.style[1].bottom).toBe(24);
});
it('keeps reduced motion still and removes accessibility listener on unmount', () => {
  FloatingRewardChip({ visible: true, label: 'draw', onPress: vi.fn(), bottomOffset: 12 });
  const cleanup = h.effects[0](); h.effects[1](); expect(h.start).not.toHaveBeenCalled();
  expect(h.listener).toBeTypeOf('function'); cleanup(); expect(h.remove).toHaveBeenCalledOnce();
});
it('starts gentle motion only when allowed and stops/resets on cleanup', () => {
  h.reduced = false;
  FloatingRewardChip({ visible: true, label: 'draw', onPress: vi.fn(), bottomOffset: 12 });
  const cleanup = h.effects[1](); expect(h.start).toHaveBeenCalledOnce(); cleanup();
  expect(h.stop).toHaveBeenCalledOnce(); expect(h.set).toHaveBeenLastCalledWith(0);
});
