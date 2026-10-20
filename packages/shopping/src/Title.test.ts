import React, { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', StyleSheet: { create: (v: unknown) => v } }));
import { headCenterStyle, ShoppingHeaderTitle, shoppingTitleText } from './Title';

function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement(node)) return [node];
  const el = node as ReactElement<any>;
  if (typeof el.type === 'function') return nodes((el.type as any)(el.props));
  return [el, ...nodes(el.props.children)];
}
const flat = (style: any): Record<string, any> => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flat)) : style ?? {});

describe('쇼핑 머리 제목(0.1.11)', () => {
  it('글자 우선순위: title → theme.title → 「쇼핑」, 빈 title 은 무시', () => {
    expect(shoppingTitleText(undefined, undefined)).toBe('쇼핑');
    expect(shoppingTitleText(undefined, '샵')).toBe('샵');
    expect(shoppingTitleText('장보기', '샵')).toBe('장보기');
    expect(shoppingTitleText('  ', '샵')).toBe('샵');
    expect(shoppingTitleText('', undefined)).toBe('쇼핑');
  });

  it('기본값은 예전 그대로 — 왼쪽 · 26 · 800 · 제목 색, 가운데용 겉틀 없음, 정렬 지정 없음', () => {
    const tree = nodes(ShoppingHeaderTitle({ text: '쇼핑', color: '#222' }));
    const text = tree.find(n => n?.type === 'Text')!;
    expect(tree.find(n => n?.type === 'View')).toBeUndefined();
    expect(text.props.accessibilityRole).toBe('header');
    expect(text.props.children).toBe('쇼핑');
    expect(text.props.style).toEqual([{ fontSize: 26, fontWeight: '800' }, { color: '#222' }]);   // 예전 [st.h1, {color}] 와 같은 모양
    expect(flat(text.props.style).textAlign).toBeUndefined();
  });

  it('titleStyle 은 기본 위에 덮는다 — fontSize · color 만 바꿔도 나머지는 기본', () => {
    const text = nodes(ShoppingHeaderTitle({ text: '쇼핑', color: '#222', style: { fontSize: 22, color: '#E00' } })).find(n => n?.type === 'Text')!;
    expect(flat(text.props.style)).toEqual({ fontSize: 22, fontWeight: '800', color: '#E00' });
  });

  it("titleAlign='center' 는 머리 줄 전체 폭의 가운데에 — 누르는 것을 막지 않고, 글자 크기는 왼쪽일 때와 같다", () => {
    const tree = nodes(ShoppingHeaderTitle({ text: '쇼핑', color: '#222', align: 'center' }));
    const box = tree.find(n => n?.type === 'View')!;
    expect(box.props.pointerEvents).toBe('none');
    expect(flat(box.props.style)).toMatchObject({ position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' });
    const text = tree.find(n => n?.type === 'Text')!;
    expect(flat(text.props.style)).toMatchObject({ fontSize: 26, fontWeight: '800', color: '#222', textAlign: 'center' });
    expect(text.props.accessibilityRole).toBe('header');
    const left = nodes(ShoppingHeaderTitle({ text: '쇼핑', color: '#222', align: 'left' })).find(n => n?.type === 'Text')!;
    expect(flat(left.props.style).fontSize).toBe(flat(text.props.style).fontSize);        // 폰트 크기 동일
    expect(nodes(ShoppingHeaderTitle({ text: '쇼핑', color: '#222', align: 'left' })).find(n => n?.type === 'View')).toBeUndefined();
  });

  it('가운데 + titleStyle: 앱이 크기를 정하면 그 크기(예 꼬꼬 탭 제목과 같게)', () => {
    const text = nodes(ShoppingHeaderTitle({ text: '쇼핑', color: '#222', align: 'center', style: { fontSize: 20, fontWeight: '700' } })).find(n => n?.type === 'Text')!;
    expect(flat(text.props.style)).toMatchObject({ fontSize: 20, fontWeight: '700', textAlign: 'center' });
  });

  it('가운데 머리 줄은 알약이 없어도 높이가 무너지지 않는다', () => {
    expect(headCenterStyle.minHeight).toBeGreaterThanOrEqual(40);
  });
});
