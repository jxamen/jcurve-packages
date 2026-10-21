import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, it, expect, vi } from 'vitest';
const native = vi.hoisted(() => ({ listeners: new Set<(s: string) => void>() }));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ScrollView: 'ScrollView', Image: 'Image', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (s: unknown) => s }, useWindowDimensions: () => ({ width: 320 }), PixelRatio: { get: () => 1 },
  Linking: { openURL: vi.fn() }, AppState: { addEventListener: (_: string, cb: (s: string) => void) => { native.listeners.add(cb); return { remove: () => native.listeners.delete(cb) }; } } }));
import { ShoppingTab } from './ShoppingTab';
import { COUPANG_DISCLOSURE } from './coupang';
import { Chips, ProductGrid, PartnerCard, EmptyProducts } from './parts';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it('gates the tab, uses one all-tab card, shares chips/grid, and confines disclosure to Coupang', async () => {
  let enabled = true;
  const products = vi.fn(async () => ({ products: [], status: 'configuration_required', message: '설정 필요' }));
  const api: any = { home: async () => ({ partners: [{ id: 'toss', name: '토스쇼핑', rewardKind: 'none', rateText: '토스 상품' }] }),
    categories: async () => [], products: async () => ({ items: [] }), deals: async () => null, notice: async () => [],
    coupang: { config: async () => ({ enabled, categories: [{ id: '1012', name: '식품' }] }), products, click: vi.fn() } };
  let tree: any;
  await act(async () => { tree = create(React.createElement(ShoppingTab, { api, onOpenUrl: vi.fn(), theme: { headerBg: '#EAF7EE', headerShape: 'round' } })); });
  const json = () => JSON.stringify(tree.toJSON());
  const tabs = () => tree.root.findAllByType('Pressable').filter((n: any) => n.props.accessibilityRole === 'tab');
  expect(tabs().map((n: any) => n.findByType('Text').props.children)).toEqual(['전체', '토스쇼핑', '쿠팡']);
  expect(tree.root.findAllByType(PartnerCard)).toHaveLength(2);
  expect(tree.root.findAllByProps({ testID: 'partner-card-coupang' }).filter((n: any) => n.type === 'Pressable')).toHaveLength(1);
  expect(products).not.toHaveBeenCalled(); expect(json()).not.toContain(COUPANG_DISCLOSURE);
  await act(async () => tree.root.findByProps({ testID: 'partner-card-coupang' }).props.onPress());
  expect(json()).toContain('상품 준비 중이에요'); expect(json()).not.toContain('설정 필요');
  expect(tree.root.findAllByType(EmptyProducts)).toHaveLength(1);
  expect(tree.root.findAllByType(Chips)).toHaveLength(1);
  expect(json()).toContain(COUPANG_DISCLOSURE);
  await act(async () => tabs()[1].props.onPress());
  expect(json()).not.toContain(COUPANG_DISCLOSURE);
  expect(tree.root.findAllByType(Chips)).toHaveLength(1);
  enabled = false;
  await act(async () => { native.listeners.forEach(cb => cb('active')); });
  expect(tabs()).toHaveLength(2);
  await act(async () => tree.unmount());
});
