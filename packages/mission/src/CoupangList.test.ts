import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, it, expect, vi } from 'vitest';
const native = vi.hoisted(() => ({ listeners: new Set<(s: string) => void>(), open: vi.fn(async () => {}) }));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: (s: unknown) => s },
  Linking: { openURL: native.open }, AppState: { addEventListener: (_: string, cb: (s: string) => void) => { native.listeners.add(cb); return { remove: () => native.listeners.delete(cb) }; } } }));
import { BenefitQuickList } from './BenefitQuickList';
import { COUPANG_DISCLOSURE } from './coupang';
import { resetHomeConfig } from './home';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
describe('Coupang row mounted in BenefitQuickList', () => {
  it('hides denied/off config, shows disclosure, and uses the real AppState subscription once', async () => {
    let enabled = false, done = false;
    const request = vi.fn(async (path: string) => {
      if (path === 'mission/home') return { ok: true, rows: [{ key: 'coupang_visit', visible: true, order: 10 }] };
      if (path === 'coupang/config') return { ok: true, enabled, test_only: true, visited_today: done };
      if (path.endsWith('/start')) return { ok: true, visit_id: 'v1', deep_link: 'https://www.coupang.com/' };
      if (path.endsWith('/complete')) { done = true; return { ok: true, gained: 1 }; }
    });
    let tree: any;
    await act(async () => { tree = create(React.createElement(BenefitQuickList, { fetchJson: request, items: [] })); });
    expect(JSON.stringify(tree.toJSON())).not.toContain('쿠팡 방문');
    enabled = true;
    resetHomeConfig();
    await act(async () => { tree.update(React.createElement(BenefitQuickList, { fetchJson: request, items: [], refreshKey: 1 })); });
    expect(JSON.stringify(tree.toJSON())).toContain('쿠팡 방문하고 1P 받기');
    const text = tree.root.findAllByType('Text').find((n: any) => n.props.children === COUPANG_DISCLOSURE);
    expect(text).toBeTruthy(); expect(text.props.numberOfLines).toBeUndefined();
    const row = tree.root.findAllByType('Pressable').find((n: any) => n.props.accessibilityLabel?.startsWith('쿠팡'));
    await act(async () => { row.props.onPress(); });
    await act(async () => { native.listeners.forEach(cb => cb('background')); native.listeners.forEach(cb => cb('active')); native.listeners.forEach(cb => cb('active')); });
    expect(request.mock.calls.filter(([p]) => p.endsWith('/complete'))).toHaveLength(1);
    expect(JSON.stringify(tree.toJSON())).toContain('오늘 받음');
    expect(JSON.stringify(tree.toJSON())).toContain('1P 받았어요');
    await act(async () => { tree.unmount(); });
    expect(native.listeners.size).toBe(0);
  });
});


describe('Coupang uses the existing admin home row', () => {
  it('obeys order, text, hidden and removed rows while preserving disclosure and authorization', async () => {
    resetHomeConfig();
    let enabled = true;
    let rows: unknown[] | null = [
      { key: 'coupang_visit', title: '', visible: true, order: 10 },
      { key: 'checkin', title: '출석', visible: true, order: 20 },
    ];
    const request = vi.fn(async (path: string) => path === 'mission/home'
      ? { ok: true, rows } : { ok: true, enabled, visit_point: 2 });
    const items = [{ key: 'checkin', title: '출석', ctaLabel: '받기', onPress: vi.fn() }];
    const props = { fetchJson: request, items, onRow: vi.fn(), keepUnlisted: true };
    let tree: any;
    await act(async () => { tree = create(React.createElement(BenefitQuickList, props)); });
    const snapshot = () => JSON.stringify(tree.toJSON());
    expect(snapshot().indexOf('쿠팡 방문하고 2P 받기')).toBeLessThan(snapshot().indexOf('출석'));
    expect(snapshot()).toContain(COUPANG_DISCLOSURE);
    rows = [{ key: 'checkin', title: '출석', visible: true, order: 10 }, { key: 'coupang_visit', title: '쿠팡 혜택', visible: true, order: 20 }];
    resetHomeConfig();
    await act(async () => { tree.update(React.createElement(BenefitQuickList, { ...props, refreshKey: 1 })); });
    expect(snapshot().indexOf('출석')).toBeLessThan(snapshot().indexOf('쿠팡 혜택'));
    expect(snapshot()).toContain(COUPANG_DISCLOSURE);
    rows = [{ key: 'coupang_visit', visible: false, order: 10 }];
    resetHomeConfig();
    await act(async () => { tree.update(React.createElement(BenefitQuickList, { ...props, refreshKey: 2 })); });
    expect(snapshot()).not.toContain(COUPANG_DISCLOSURE);
    rows = [];
    resetHomeConfig();
    await act(async () => { tree.update(React.createElement(BenefitQuickList, { ...props, refreshKey: 3 })); });
    expect(snapshot()).not.toContain(COUPANG_DISCLOSURE);
    rows = null; resetHomeConfig();
    await act(async () => { tree.update(React.createElement(BenefitQuickList, { ...props, refreshKey: 'missing' })); });
    expect(snapshot()).not.toContain(COUPANG_DISCLOSURE);
    rows = [{ key: 'coupang_visit', title: '쿠팡 혜택', visible: true, order: 10 }]; enabled = false;
    resetHomeConfig();
    await act(async () => { tree.update(React.createElement(BenefitQuickList, { ...props, refreshKey: 4 })); });
    expect(snapshot()).not.toContain('쿠팡 혜택');
    expect(snapshot()).not.toContain(COUPANG_DISCLOSURE);
    await act(async () => { tree.unmount(); });
  });
});
