import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, it, expect, vi } from 'vitest';
const native = vi.hoisted(() => ({ open: vi.fn(async () => {}) }));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ScrollView: 'ScrollView', Image: 'Image', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (s: unknown) => s }, useWindowDimensions: () => ({ width: 390 }), PixelRatio: { get: () => 1 }, Linking: { openURL: native.open }, AppState: { addEventListener: () => ({ remove() {} }) } }));
import { CoupangSection } from './CoupangSection';
import { COUPANG_DISCLOSURE, createCoupangApi, parseCoupangProducts } from './coupang';
import { DEFAULT_THEME } from './types';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
describe('Coupang shopping section', () => {
  it.each([false, 'denied'])('omits the entire section for %s', async enabled => {
    const api = { config: vi.fn(async () => { if (enabled === 'denied') throw { status: 404 }; return { enabled: false, test_only: true }; }), products: vi.fn(), click: vi.fn() };
    let tree: any;
    await act(async () => { tree = create(React.createElement(CoupangSection, { api, theme: DEFAULT_THEME })); });
    expect(tree.toJSON()).toBeNull(); expect(api.products).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });
  it('keeps disclosure above products, searches, changes category and opens a deep link', async () => {
    const product = { product_id: '123', name: '상품', price: 1000, deep_link: 'https://link.coupang.com/a/test' };
    const request = vi.fn(async (path: string) => path === 'coupang/config' ? { enabled: true, test_only: true }
      : path.startsWith('coupang/products?') ? { products: [product] } : { ok: true });
    const api = createCoupangApi(request as any);
    let tree: any;
    await act(async () => { tree = create(React.createElement(CoupangSection, { api, theme: DEFAULT_THEME })); });
    const texts = tree.root.findAllByType('Text');
    const disclosure = texts.find((n: any) => n.props.children === COUPANG_DISCLOSURE);
    expect(disclosure).toBeTruthy(); expect(disclosure.props.numberOfLines).toBeUndefined();
    expect(texts.indexOf(disclosure)).toBeLessThan(texts.findIndex((n: any) => n.props.children === '상품'));
    await act(async () => tree.root.findByType('TextInput').props.onChangeText('사과 & 배'));
    await act(async () => tree.root.findByType('TextInput').props.onSubmitEditing());
    expect(request).toHaveBeenCalledWith('coupang/products?keyword=%EC%82%AC%EA%B3%BC%20%26%20%EB%B0%B0&category=');
    const category = tree.root.findAllByType('Pressable').find((p: any) => p.findAllByType('Text').some((t: any) => t.props.children === '식품'));
    await act(async () => category.props.onPress());
    expect(request).toHaveBeenLastCalledWith('coupang/products?keyword=&category=1012');
    await act(async () => tree.root.findAllByType('Pressable').find((p: any) => p.props.accessibilityLabel === '상품, 1,000원').props.onPress());
    expect(native.open).toHaveBeenCalledWith(product.deep_link);
    expect(request).toHaveBeenCalledWith('coupang/products/click', { method: 'POST', body: { product_id: '123' } });
    await act(async () => tree.unmount());
  });
  it('preserves missing-key message and rejects malformed product links', () => {
    expect(parseCoupangProducts({ products: [], status: 'configuration_required', message: '설정 필요' })).toEqual({ products: [], status: 'configuration_required', message: '설정 필요' });
    expect(parseCoupangProducts({ products: [{ product_id: 1, name: 'x', deep_link: 'https://evil.com/' }] }).products).toEqual([]);
  });
});
