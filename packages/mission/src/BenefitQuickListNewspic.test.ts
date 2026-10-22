import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, it, expect, vi } from 'vitest';
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: (x: unknown) => x }, AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('./useHomeConfig', () => ({ useHomeConfig: () => ({ config: { rows: null }, ready: true }) }));
vi.mock('./useCoupangVisit', () => ({ useCoupangVisit: () => ({ visible: false, status: {}, toast: null }) }));
import { BenefitQuickList } from './BenefitQuickList';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
describe('apptech home excludes the standalone reading feature', () => {
  it('never requests or renders Newspic even when its server would return enabled content', async () => {
    const request = vi.fn(async () => ({ ok: true, enabled: true, mode: 'shared_links', status: 'configuration_required', items: [] }));
    let tree: any;
    const props = { fetchJson: request, items: [{ key: 'a', title: '출석', subtitle: '매일', ctaLabel: '출석하기', icon: 'calendar' as const, tint: '#EEE', onPress: vi.fn() }] };
    await act(async () => { tree = create(React.createElement(BenefitQuickList, props)); });
    expect(JSON.stringify(tree.toJSON())).toContain('출석');
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/newspic-section|읽을거리|설정 필요/);
    await act(async () => { tree.update(React.createElement(BenefitQuickList, { ...props, refreshKey: 2 })); });
    expect(request).not.toHaveBeenCalled();
    await act(async () => { tree.unmount(); });
  });
});
