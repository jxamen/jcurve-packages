import React, { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('react', async () => ({ ...await vi.importActual<any>('react'), useState: (v: any) => [v, vi.fn()], useEffect: vi.fn(), useMemo: (f: () => unknown) => f() }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: (v: unknown) => v },
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
}));
import { BenefitQuickList, iconKind, type BenefitQuickItem } from './BenefitQuickList';
import { HOME_ORDER, buildHomeItems, type HomeActions } from './homeDefs';

/** React 트리를 걸으며 「<Text> 가 아닌 부모 밑에 그대로 놓인 문자열」을 모은다 — RN 은 이런 문자열을 그리지 못한다(iOS 빈 칸 · Android 오류) */
function walk(node: any, parent: string, out: { stray: string[]; texts: string[] }): void {
  if (Array.isArray(node)) { node.forEach(n => walk(n, parent, out)); return; }
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (typeof node === 'string' || typeof node === 'number') {
    if (parent === 'Text') out.texts.push(String(node)); else out.stray.push(String(node));
    return;
  }
  if (!React.isValidElement(node)) return;
  const el = node as ReactElement<any>;
  if (typeof el.type === 'function') { walk((el.type as any)(el.props), parent, out); return; }
  if (el.type === React.Fragment) { walk(el.props.children, parent, out); return; }
  walk(el.props.children, String(el.type), out);
}
const render = (items: BenefitQuickItem[]) => {
  const out = { stray: [] as string[], texts: [] as string[] };
  walk(BenefitQuickList({ items, title: '바로 받는 혜택' }), 'root', out);
  return out;
};
const item = (key: string, icon: BenefitQuickItem['icon']): BenefitQuickItem => ({ key, title: key + ' 제목', subtitle: key + ' 설명', ctaLabel: '가기', icon, tint: '#EEE', onPress: vi.fn() });

describe('아이콘 그리기 — 글자(이모지) 아이콘은 반드시 <Text> 안에 (0.4.12)', () => {
  it('iconKind: 팔레트 이름 · 그 밖의 글자 · ReactNode 를 가른다', () => {
    for (const n of ['calendar', 'bag', 'pin', 'star', 'ticket', 'friend']) expect(iconKind(n as any)).toBe('palette');
    for (const t of ['👟', '🌱', '감자', 'x', '']) expect(iconKind(t as any)).toBe('text');
    expect(iconKind(React.createElement('View'))).toBe('node');
    expect(iconKind(null as any)).toBe('node');
    expect(iconKind(7 as any)).toBe('node');
  });
  it('prototype 이름(toString · constructor …)은 팔레트로 읽지 않는다', () => {
    for (const t of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) expect(iconKind(t as any)).toBe('text');
  });
  it('이모지 아이콘(👟 · 🌱)은 <Text> 안에 그려진다 — View 밑에 문자열이 그대로 남지 않는다(걸음 줄 빈 칸)', () => {
    const r = render([item('steps', '👟'), item('free_item', '🌱')]);
    expect(r.stray).toEqual([]);
    expect(r.texts).toContain('👟');
    expect(r.texts).toContain('🌱');
  });
  it('팔레트 아이콘은 그대로 그림(문자열 없음) · 앱이 넘긴 ReactNode 도 그대로', () => {
    const r = render([item('a', 'bag'), item('b', 'calendar'), item('c', React.createElement('View', null))]);
    expect(r.stray).toEqual([]);
    expect(r.texts.some(t => ['bag', 'calendar'].includes(t))).toBe(false);          // 이름이 글자로 새어 나오지 않는다
  });
  it('homeDefs 가 만드는 9줄 전부 — View 밑에 문자열이 그대로 놓이지 않는다', () => {
    const actions = Object.fromEntries(HOME_ORDER.map(k => [k, vi.fn()])) as HomeActions;
    const items = buildHomeItems({ steps: 4200, free: { left: 2, received: 1, claimableNow: true }, todayMissions: { progress: { done: 1, total: 3 } }, checkinDone: true }, actions);
    expect(items).toHaveLength(9);
    const r = render(items);
    expect(r.stray).toEqual([]);
    expect(r.texts).toEqual(expect.arrayContaining(['👟', '🌱', '오늘 4,200걸음', '지금 받기', '출석 완료']));
  });
});
