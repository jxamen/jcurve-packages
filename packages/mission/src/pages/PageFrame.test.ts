import React, { type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ os: 'ios' as string, created: [] as any[] }));
vi.mock('react', async () => ({ ...await vi.importActual<any>('react'), useEffect: vi.fn(), useRef: (v: any) => ({ current: v }) }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (v: unknown) => v },
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
  Platform: { get OS() { return h.os; } },
  PanResponder: { create: (cfg: any) => { h.created.push(cfg); return { panHandlers: cfg }; } },
}));
import { DEFAULT_PAGE_THEME, PageFrame } from './PageFrame';

const root = (props: Record<string, unknown> = {}): ReactElement<any> =>
  PageFrame({ title: '제목', onBack: vi.fn(), theme: DEFAULT_PAGE_THEME, children: React.createElement('Text', null, '본문'), ...props } as any) as ReactElement<any>;
const handlerKeys = ['onStartShouldSetPanResponderCapture', 'onMoveShouldSetPanResponderCapture', 'onPanResponderRelease', 'onPanResponderTerminationRequest'];

describe('PageFrame 가장자리 밀기(0.4.13, 대표님 20:xx 하위 화면 iOS 뒤로 밀기 10앱 통일)', () => {
  beforeEach(() => { h.os = 'ios'; h.created.length = 0; });

  it('iOS 기본(swipeBack 생략)은 루트 View 에 핸들러가 붙는다 — 띠 View 는 없다', () => {
    const r = root();
    expect(r.type).toBe('View');
    for (const k of handlerKeys) expect(typeof r.props[k]).toBe('function');
    const kids = React.Children.toArray(r.props.children) as ReactElement<any>[];
    expect(kids.every(k => k.props.style?.position !== 'absolute')).toBe(true);      // 가장자리를 덮는 띠가 없다
  });
  it('swipeBack={false} 이면 핸들러가 없다 · true 와 생략은 같다', () => {
    for (const k of handlerKeys) expect(root({ swipeBack: false }).props[k]).toBeUndefined();
    for (const k of handlerKeys) expect(typeof root({ swipeBack: true }).props[k]).toBe('function');
  });
  it('안드로이드는 핸들러가 없다(뒤로 키만)', () => {
    h.os = 'android';
    for (const k of handlerKeys) expect(root().props[k]).toBeUndefined();
  });
  it('밀기 핸들러는 늘 최신 onBack 을 부른다(렌더가 바뀌어도 한 번만 만든다)', () => {
    const first = vi.fn();
    const second = vi.fn();
    const r1 = root({ onBack: first });
    expect(h.created).toHaveLength(1);
    // 같은 훅 상태(ref)를 쓰는 다음 렌더를 흉내 — useRef 모킹은 호출마다 새 ref 라, 핸들러가 부르는 쪽은 이 렌더의 onBack 이다
    r1.props.onStartShouldSetPanResponderCapture({ nativeEvent: { pageX: 5 } });
    r1.props.onPanResponderRelease({}, { dx: 100, dy: 0, vx: 0 });
    expect(first).toHaveBeenCalledTimes(1);
    const r2 = root({ onBack: second });
    r2.props.onStartShouldSetPanResponderCapture({ nativeEvent: { pageX: 5 } });
    r2.props.onPanResponderRelease({}, { dx: 100, dy: 0, vx: 0 });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });
  it('가장자리에서 시작하지 않은 밀기는 뒤로 가지 않는다', () => {
    const back = vi.fn();
    const r = root({ onBack: back });
    r.props.onStartShouldSetPanResponderCapture({ nativeEvent: { pageX: 120 } });
    expect(r.props.onMoveShouldSetPanResponderCapture({}, { dx: 40, dy: 0 })).toBe(false);
    r.props.onPanResponderRelease({}, { dx: 100, dy: 0, vx: 1 });
    expect(back).not.toHaveBeenCalled();
  });
});
