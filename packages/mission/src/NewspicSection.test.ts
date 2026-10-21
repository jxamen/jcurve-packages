import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, it, expect, vi } from 'vitest';
const native = vi.hoisted(() => ({ listeners: new Set<(s: string) => void>(), open: vi.fn(async () => {}) }));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Image: 'Image', Pressable: 'Pressable', StyleSheet: { create: (s: unknown) => s },
  Linking: { openURL: native.open }, AppState: { currentState: 'active', addEventListener: (_: string, cb: (s: string) => void) => { native.listeners.add(cb); return { remove: () => native.listeners.delete(cb) }; } } }));
import { NewspicSection, parseNewspicFeed, isNewspicUrl } from './NewspicSection';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const item = { id: 'a', title: '콘텐츠 제목', source: '기사 출처', thumbnail: 'https://images-cdn.newspic.kr/example.jpg', url: 'https://m.newspic.kr/view.html?nid=example' };
const feed = { ok: true, enabled: true, mode: 'shared_links', status: 'ok', items: [item] };
describe('Newspic content without incentives', () => {
  it('renders title, thumbnail, source and disclosure; opens only on a press without reward requests', async () => {
    native.open.mockClear(); const request = vi.fn(async () => feed); let tree: any;
    await act(async () => { tree = create(React.createElement(NewspicSection, { fetchJson: request })); });
    expect(native.open).not.toHaveBeenCalled();
    const labels = tree.root.findAllByType('Text').map((n: any) => n.props.children).join(' ');
    expect(labels).toBe('광고 · 제휴 읽을거리 콘텐츠 제목 기사 출처');
    expect(labels).not.toMatch(/포인트|보상|누르면|받기|P/);
    expect(tree.root.findByType('Image').props.source.uri).toBe(item.thumbnail);
    expect(tree.root.findByProps({ testID: 'newspic-section' }).props.style.marginVertical).toBeGreaterThanOrEqual(80);
    await act(async () => { tree.root.findByType('Pressable').props.onPress(); });
    expect(native.open).toHaveBeenCalledExactlyOnceWith(item.url);
    expect(request.mock.calls).toEqual([['newspic/feed']]);
    await act(async () => { tree.unmount(); });
  });
  it('hides off, denied, malformed and network failures; shows settings-needed only to authorized users', async () => {
    for (const value of [null, { ...feed, enabled: false }, { ...feed, mode: 'unknown' }, { ...feed, items: [] }]) expect(parseNewspicFeed(value)).toBeNull();
    let tree: any; const request = vi.fn(async () => { throw new Error('404'); });
    await act(async () => { tree = create(React.createElement(NewspicSection, { fetchJson: request })); });
    expect(tree.toJSON()).toBeNull();
    await act(async () => { tree.update(React.createElement(NewspicSection, { fetchJson: async () => ({ ...feed, items: [], status: 'configuration_required' }) })); });
    expect(JSON.stringify(tree.toJSON())).toContain('설정 필요');
    await act(async () => { tree.unmount(); });
  });
  it('drops stale account results and unmounts thumbnails in background', async () => {
    let resolve: (v: unknown) => void = () => {}; const old = vi.fn(() => new Promise(r => { resolve = r; })); let tree: any;
    await act(async () => { tree = create(React.createElement(NewspicSection, { fetchJson: old })); });
    const denied = vi.fn(async () => null);
    await act(async () => { tree.update(React.createElement(NewspicSection, { fetchJson: denied })); resolve(feed); });
    expect(tree.toJSON()).toBeNull();
    const request = vi.fn(async () => feed);
    await act(async () => { tree.update(React.createElement(NewspicSection, { fetchJson: request })); });
    await act(async () => { native.listeners.forEach(cb => cb('background')); });
    expect(tree.toJSON()).toBeNull(); expect(request).toHaveBeenCalledOnce();
    await act(async () => { native.listeners.forEach(cb => cb('active')); });
    expect(request).toHaveBeenCalledTimes(2);
    await act(async () => { tree.unmount(); }); expect(native.listeners.size).toBe(0);
  });
  it('rejects malicious destinations and unsafe thumbnails', () => {
    for (const url of ['javascript:alert(1)', 'https://newspic.kr.evil.test/', 'https://user@newspic.kr/', 'https://evil.test/', 'https://newspic.kr\\@evil.test/']) expect(isNewspicUrl(url)).toBe(false);
    expect(parseNewspicFeed({ ...feed, items: [{ ...item, thumbnail: 'https://evil.test/a' }] })).toBeNull();
  });
});
