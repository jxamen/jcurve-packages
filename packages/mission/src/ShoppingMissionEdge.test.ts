import React, { type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ os: 'ios', n: 0, result: null as unknown }));
// 화면을 함수로 직접 부르는 시험 틀 — hook 은 흉내(첫 useState 는 입장 결과), PanResponder 는 설정을 그대로 돌려줘 핸들러를 직접 부른다
vi.mock('react', async () => ({ ...await vi.importActual<any>('react'), useState: (v: any) => [h.n++ === 0 ? h.result : v, vi.fn()], useEffect: vi.fn(), useRef: (v: any) => ({ current: v }), useCallback: (f: any) => f }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', Modal: 'Modal', StyleSheet: { create: (v: unknown) => v },
  AppState: { addEventListener: () => ({ remove: vi.fn() }) }, BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
  Dimensions: { get: () => ({ width: 393, height: 852 }) },
  Platform: { get OS() { return h.os; } },
  PanResponder: { create: (cfg: unknown) => ({ panHandlers: cfg }) },
}));
vi.mock('./MissionWebView', () => ({ MissionWebView: 'MissionWebView' }));
vi.mock('./states', () => ({ DEFAULT_THEME: { bg: '#fff', text: '#000', line: '#eee' }, MissionLoading: 'MissionLoading', MissionState: 'MissionState' }));
vi.mock('./entry', () => ({ fetchEntry: vi.fn(), traceEntry: vi.fn() }));
import { ShoppingMission } from './ShoppingMission';

function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement(node)) return [node];
  const el = node as ReactElement<any>;
  return [el, ...nodes(el.props.children)];
}
const OK = { ok: true, url: 'https://service.mocation.co.kr/alwayz/entry.php?pubKey=a&uid=b&trackingId=c' };
const at = (pageX: number) => ({ nativeEvent: { pageX } });
const flat = (style: unknown): Record<string, unknown> => Object.assign({}, ...[style].flat(3).filter(Boolean) as object[]);
function render(result: unknown = OK) {
  h.n = 0;
  h.result = result;
  const props = { fetchJson: vi.fn(), onClose: vi.fn(), safeAreaInsets: { top: 59, bottom: 34 } };
  const tree = nodes(ShoppingMission(props as any));
  return {
    props, tree, root: tree[0],
    header: tree.filter(n => n?.type === 'Pressable' && ['닫기', '뒤로가기'].includes(n.props.accessibilityLabel)).slice(0, 2),   // 안내줄의 ✕ 는 제외
    webview: tree.find(n => n?.type === 'MissionWebView'),
  };
}
beforeEach(() => { h.os = 'ios'; });

describe('쇼핑 미션 왼쪽 가장자리 밀기 — 본문에 덮던 띠를 없애고 화면 최상위 캡처 핸들러로(0.7.12, 대표님 10-21 00:16 먹통)', () => {
  it('iOS: 화면 최상위 View 에 캡처 핸들러가 붙는다 — 응답자를 쥐고 있지 않는다(놓친 터치가 머리줄 단추를 막지 않게)', () => {
    const { root } = render();
    for (const k of ['onStartShouldSetPanResponderCapture', 'onMoveShouldSetPanResponderCapture', 'onPanResponderRelease', 'onPanResponderTerminationRequest']) expect(root.props[k], k).toBeTypeOf('function');
    expect(root.props.onPanResponderTerminationRequest()).toBe(true);
    expect(root.props.onStartShouldSetPanResponderCapture(at(10))).toBe(false);        // 누름은 늘 자식에게
  });

  it('안드로이드: 핸들러가 없다(뒤로 키만)', () => {
    h.os = 'android';
    const { root } = render();
    expect(root.props.onMoveShouldSetPanResponderCapture).toBeUndefined();
    expect(root.props.onPanResponderRelease).toBeUndefined();
  });

  it('본문에 덮던 왼쪽 띠 View 가 없다 — 어느 View 도 절대 위치 · 폭 24 가 아니고, 예전 방식(onMoveShouldSetPanResponder)도 없다', () => {
    for (const result of [OK, null]) {
      const { tree } = render(result);
      expect(tree.filter(n => n?.type === 'View' && flat(n.props.style).position === 'absolute' && flat(n.props.style).width === 24)).toHaveLength(0);
      expect(tree.filter(n => n?.props?.onMoveShouldSetPanResponder)).toHaveLength(0);
    }
  });

  it('머리줄은 그대로 — 「닫기」 · 제목 · 「뒤로가기」, 단추는 hitSlop 12 · 최소 48, 누르면 닫는다(웹 기록이 없을 때는 둘 다 닫기)', () => {
    const { tree, header, props } = render();
    expect(header.map(n => n.props.accessibilityLabel)).toEqual(['닫기', '뒤로가기']);
    expect(tree).toContain('쇼핑 태그 퀴즈1');
    for (const b of header) {
      expect(b.props.hitSlop).toBe(12);
      expect(flat(b.props.style).minHeight).toBe(48);
    }
    header[0].props.onPress();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    header[1].props.onPress();
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('왼쪽 가장자리에서 시작해 충분히 밀고 떼면 — 웹 기록이 없으면 닫는다', () => {
    const { root, props } = render();
    root.props.onStartShouldSetPanResponderCapture(at(6));
    expect(root.props.onMoveShouldSetPanResponderCapture(at(60), { dx: 30, dy: 2 })).toBe(true);
    root.props.onPanResponderRelease(at(90), { dx: 80, dy: 3, vx: 0.2 });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('웹 기록이 있으면 한 번 밀 때 웹에서 한 칸만 뒤로 간다(닫지 않는다)', () => {
    const { root, props, webview } = render();
    const goBack = vi.fn();
    webview.props.onNavigationChange({ canGoBack: true, goBack });
    root.props.onStartShouldSetPanResponderCapture(at(6));
    root.props.onPanResponderRelease(at(90), { dx: 80, dy: 3, vx: 0.2 });
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('가장자리가 아닌 곳에서 시작한 밀기는 가로채지도 뒤로 가지도 않는다', () => {
    const { root, props } = render();
    root.props.onStartShouldSetPanResponderCapture(at(200));
    expect(root.props.onMoveShouldSetPanResponderCapture(at(300), { dx: 100, dy: 0 })).toBe(false);
    root.props.onPanResponderRelease(at(300), { dx: 100, dy: 0, vx: 0.5 });
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('웹뷰는 자체 가장자리 밀기를 끄고 받는다 — 우리 핸들러와 겹쳐 웹 기록이 두 칸 가지 않게', () => {
    expect(render().webview.props.nativeSwipeBack).toBe(false);
  });

  it('아직 불러오는 중이면 웹뷰 없이 로딩 — 가장자리 핸들러와 머리줄은 그대로 있다', () => {
    const { root, header, webview } = render(null);
    expect(webview).toBeUndefined();
    expect(root.props.onMoveShouldSetPanResponderCapture).toBeTypeOf('function');
    expect(header).toHaveLength(2);
  });
});
