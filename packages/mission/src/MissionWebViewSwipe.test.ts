import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
// 웹뷰를 함수로 직접 부르는 시험 틀 — hook 은 흉내, 웹뷰 자체는 문자열 요소로
vi.mock('react', async () => ({ ...await vi.importActual<any>('react'), useState: (v: any) => [v, vi.fn()], useRef: (v: any) => ({ current: v }), useEffect: vi.fn(), useCallback: (f: any) => f, useMemo: (f: any) => f() }));
vi.mock('react-native', () => ({ View: 'View', Linking: { openURL: vi.fn() }, BackHandler: { addEventListener: () => ({ remove: vi.fn() }) }, Platform: { OS: 'ios' } }));
vi.mock('react-native-webview', () => ({ WebView: 'WebView' }));
vi.mock('./states', () => ({ DEFAULT_THEME: { bg: '#fff', text: '#000', line: '#eee' }, MissionLoading: 'MissionLoading', MissionState: 'MissionState' }));
import { MissionWebView } from './MissionWebView';

const URL_OK = 'https://service.mocation.co.kr/alwayz/entry.php?pubKey=a&uid=b&trackingId=c';
const webview = (over: Record<string, unknown> = {}) => {
  const root = MissionWebView({ url: URL_OK, ...over } as any) as ReactElement<any>;
  return [root.props.children].flat().find((n: any) => n?.type === 'WebView') as ReactElement<any>;
};

describe('웹뷰 자체의 iOS 가장자리 뒤로 · 앞으로 밀기(nativeSwipeBack, 0.7.12)', () => {
  it('안 주면 켜짐 — 웹뷰를 단독으로 쓰는 앱은 예전과 같다', () => {
    expect(webview().props.allowsBackForwardNavigationGestures).toBe(true);
    expect(webview({ nativeSwipeBack: true }).props.allowsBackForwardNavigationGestures).toBe(true);
  });

  it('false 를 주면 꺼진다 — 화면(ShoppingMission)이 왼쪽 밀기를 직접 받을 때', () => {
    expect(webview({ nativeSwipeBack: false }).props.allowsBackForwardNavigationGestures).toBe(false);
  });
});
