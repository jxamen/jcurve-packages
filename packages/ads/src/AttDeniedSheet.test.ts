import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Module = require('node:module');
const originalLoad = Module._load;
afterEach(() => { Module._load = originalLoad; vi.useRealTimers(); vi.restoreAllMocks(); });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 21, 12, 0, 0)); });

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

/** 패키지된 CommonJS(dist)를 가짜 react · react-native 로 읽어 실제 렌더 트리를 본다 — 부를 때마다 새 모듈(새 실행) */
function harness(os = 'ios') {
  const states: any[] = [];
  let cursor = 0;
  const effects: Array<() => void | (() => void)> = [];
  let firstRender = true;
  const react = {
    Fragment: 'Fragment',
    createElement: (type: any, props: any, ...children: any[]) => ({ type, props: { ...props, children } }),
    useState: (value: any) => {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = value;
      return [states[slot], (next: any) => { states[slot] = next; }];
    },
    useRef: (value: any) => {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = { current: value };
      return states[slot];
    },
    useEffect: (fn: any) => { if (firstRender) effects.push(fn); },
  };
  const appListeners = new Set<(s: string) => void>();
  const rn = {
    Platform: { OS: os },
    Modal: 'Modal', View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
    Linking: { openSettings: vi.fn(async () => undefined) },
    AppState: { addEventListener: vi.fn((_t: string, fn: (s: string) => void) => { appListeners.add(fn); return { remove: vi.fn(() => { appListeners.delete(fn); }) }; }) },
  };
  Module._load = function(id: string, ...args: any[]) {
    if (id === 'react') return react;
    if (id === 'react-native') return rn;
    return originalLoad.call(this, id, ...args);
  };
  const dist = (f: string) => require.resolve(`../dist/${f}`);
  for (const f of ['AttDeniedSheet.js', 'attSheet.js', 'native.js']) delete require.cache[dist(f)];
  const { AttDeniedSheet } = require(dist('AttDeniedSheet.js'));
  const att = require(dist('attSheet.js'));
  const props = { appName: '꼬꼬농장' };
  const cleanups: Array<void | (() => void)> = [];
  return {
    rn, att,
    render(p: any = props) { cursor = 0; return AttDeniedSheet(p); },
    /** 마운트 — 한 번 그리고 효과를 돌린다 */
    mount(p: any = props) { const out = this.render(p); for (const fx of effects) cleanups.push(fx()); firstRender = false; return out; },
    unmount() { for (const c of cleanups) if (typeof c === 'function') c(); },
    modal(key: 'primer' | 'denied', p: any = props) {
      const out = this.render(p);
      return ([] as any[]).concat(out.props.children).find((m: any) => m?.props?.key === key);
    },
    /** 앱을 뒤로 보내거나 앞으로 가져온다 */
    setApp(state: string) { for (const fn of [...appListeners]) fn(state); },
    appListenerCount() { return appListeners.size; },
  };
}

/** 렌더 트리 안의 모든 요소 / 글자 */
const walk = (node: any): any[] => {
  if (!node || typeof node !== 'object') return [];
  return [node, ...([] as any[]).concat(node.props?.children ?? []).flatMap(walk)];
};
const strings = (node: any): string[] => walk(node).flatMap((n) => ([] as any[]).concat(n.props?.children ?? []).filter((c) => typeof c === 'string'));
const buttons = (node: any): any[] => walk(node).filter((n) => n.type === 'TouchableOpacity');
const labelOf = (btn: any): string => strings(btn).join('');
const press = (node: any, label: string) => buttons(node).find((b) => labelOf(b) === label).props.onPress();
const tracking = (status: string, requestStatus = status) => {
  const get = vi.fn(async () => ({ status }));
  const request = vi.fn(async () => ({ status: requestStatus }));

  return { get, request, getTrackingPermissionsAsync: get, requestTrackingPermissionsAsync: request };
};
const DISMISS = 400;   // dist 의 DISMISS_MS
const ensure = (h: ReturnType<typeof harness>, t: any) => h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: t });
const memStore = () => {
  const data = new Map<string, string>();

  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
};

describe('AttDeniedSheet — 호스트', () => {
  it('앱 루트에 붙이기만 하면 아무것도 열리지 않는다 — 켜질 때도, 한참 뒤에도', async () => {
    const h = harness();
    h.mount();
    await flush(); vi.advanceTimersByTime(60_000); await flush();
    expect(h.modal('primer').props.visible).toBe(false);
    expect(h.modal('denied').props.visible).toBe(false);
    expect(h.rn.Linking.openSettings).not.toHaveBeenCalled();
  });
  it('Android(iOS 가 아님)에서는 아무것도 그리지 않는다', () => {
    expect(harness('android').mount()).toBeNull();
  });
  it('옛 호출 코드(appName · texts)를 그대로 줘도 던지지 않고 아무것도 안 바뀐다', () => {
    const h = harness();
    const old = { appName: '꼬꼬농장', texts: { title: '옛 제목', steps: ['a'] }, theme: { primary: '#000' } };
    h.mount(old);
    expect(h.modal('primer', old).props.visible).toBe(false);
  });

  describe('추적이 꺼져 있을 때의 가운데 팝업', () => {
    it('오퍼월 진입(ensureTrackingBeforeOfferwall) + 거부일 때만 열린다 — 시스템 창 · 중립 안내는 안 부른다', async () => {
      const h = harness();
      h.mount();
      const t = tracking('denied');
      void ensure(h, t);
      await flush();
      expect(h.modal('denied').props.visible).toBe(true);
      expect(h.modal('primer').props.visible).toBe(false);
      expect(t.request).not.toHaveBeenCalled();
    });
    it('제한(restricted)도 같다', async () => {
      const h = harness();
      h.mount();
      void ensure(h, tracking('restricted'));
      await flush();
      expect(h.modal('denied').props.visible).toBe(true);
    });
    it('내용: 제목 · 본문 · 버튼 둘(그냥 보기 · 설정 열기) — 금지 문구 0', async () => {
      const h = harness();
      h.mount();
      void ensure(h, tracking('denied'));
      await flush();
      const popup = h.modal('denied');
      expect(strings(popup)).toEqual([
        '추적이 꺼져 있어요',
        '추적이 꺼져 있으면 일부 미션은 참여 확인이 안 될 수 있어요. 원하시면 설정에서 켤 수 있어요.',
        '그냥 보기',
        '설정 열기',
      ]);
      expect(buttons(popup).map(labelOf)).toEqual(['그냥 보기', '설정 열기']);
      for (const s of strings(popup)) expect(/포인트|적립|보상|혜택|더 받|필요해요|애드팝콘/.test(s), s).toBe(false);
    });
    it('두 버튼은 같은 모양 · 같은 크기다 — 한쪽으로 몰아가지 않는다', async () => {
      const h = harness();
      h.mount();
      void ensure(h, tracking('denied'));
      await flush();
      const [a, b] = buttons(h.modal('denied'));
      expect(a.props.style).toEqual(b.props.style);
      const [ta, tb] = [walk(a).find((n) => n.type === 'Text'), walk(b).find((n) => n.type === 'Text')];
      expect(ta.props.style).toEqual(tb.props.style);
    });
    it('「그냥 보기」: 닫고 바로 이어서 간다 — proceed, 설정 앱은 안 연다', async () => {
      const h = harness();
      h.mount();
      let result: string | undefined;
      void ensure(h, tracking('denied')).then((r: string) => { result = r; });
      await flush();
      press(h.modal('denied'), '그냥 보기');
      expect(h.modal('denied').props.visible).toBe(false);
      await flush();
      expect(result, '화면이 사라지는 동안은 기다린다').toBeUndefined();
      vi.advanceTimersByTime(DISMISS); await flush();
      expect(result).toBe('proceed');
      expect(h.rn.Linking.openSettings).not.toHaveBeenCalled();
    });
    it('「설정 열기」: 설정 앱을 열고, 앱이 돌아오면 이어서 간다 — proceed', async () => {
      const h = harness();
      h.mount();
      let result: string | undefined;
      void ensure(h, tracking('denied')).then((r: string) => { result = r; });
      await flush();
      press(h.modal('denied'), '설정 열기');
      expect(h.rn.Linking.openSettings).toHaveBeenCalledTimes(1);
      expect(h.modal('denied').props.visible).toBe(false);
      h.setApp('inactive'); h.setApp('background');
      vi.advanceTimersByTime(5 * 60_000); await flush();
      expect(result, '설정 앱에 가 있는 동안은 오퍼월로 넘어가지 않는다').toBeUndefined();
      h.setApp('active'); await flush();
      expect(result).toBe('proceed');
      expect(h.appListenerCount()).toBe(0);
    });
    it('설정에서 켜고 돌아오면 granted 를 돌려준다', async () => {
      const h = harness();
      h.mount();
      const t = tracking('denied');
      let result: string | undefined;
      void ensure(h, t).then((r: string) => { result = r; });
      await flush();
      t.get.mockResolvedValue({ status: 'granted' });
      press(h.modal('denied'), '설정 열기');
      h.setApp('background'); h.setApp('active'); await flush();
      expect(result).toBe('granted');
    });
    it('설정 앱으로 안 넘어가면(열기가 안 먹으면) 2초 뒤에 이어서 간다', async () => {
      const h = harness();
      h.mount();
      let result: string | undefined;
      void ensure(h, tracking('denied')).then((r: string) => { result = r; });
      await flush();
      press(h.modal('denied'), '설정 열기');
      vi.advanceTimersByTime(1999); await flush();
      expect(result).toBeUndefined();
      vi.advanceTimersByTime(1); await flush();
      expect(result).toBe('proceed');
    });
    it('하루 한 번: 오늘 이미 봤으면 팝업 없이 바로 이어서 간다', async () => {
      const h = harness();
      h.mount();
      const t = tracking('denied');
      const first = ensure(h, t);
      await flush();
      press(h.modal('denied'), '그냥 보기');
      vi.advanceTimersByTime(DISMISS); await flush(); await first;
      const second = await ensure(h, t);
      expect(second).toBe('proceed');
      expect(h.modal('denied').props.visible, '두 번째 탭에는 안 뜬다').toBe(false);
    });
    it('하루 한 번: 다음 날(기기 로컬 날짜)에는 다시 한 번 뜬다', async () => {
      const h = harness();
      h.mount();
      const t = tracking('denied');
      const first = ensure(h, t);
      await flush();
      press(h.modal('denied'), '그냥 보기');
      vi.advanceTimersByTime(DISMISS); await flush(); await first;
      vi.setSystemTime(new Date(2026, 9, 22, 0, 5, 0));
      void ensure(h, t);
      await flush();
      expect(h.modal('denied').props.visible).toBe(true);
    });
    it('하루 한 번: 앱이 준 저장소에 적어 두면 앱을 껐다 켜도 같은 날은 안 뜬다', async () => {
      const store = memStore();
      const props = { appName: '앱', storage: store };
      const a = harness();
      a.mount(props);
      const first = ensure(a, tracking('denied'));
      await flush();
      expect(a.modal('denied', props).props.visible).toBe(true);
      press(a.modal('denied', props), '그냥 보기');
      vi.advanceTimersByTime(DISMISS); await flush(); await first;
      expect(store.data.get('jcurve.ads.attDenied.lastShown')).toBe('2026-10-21');
      a.unmount();
      const b = harness();                                  // 새 실행: 메모리는 비었고 저장소에는 오늘 날짜가 있다
      b.mount(props);
      expect(await ensure(b, tracking('denied'))).toBe('proceed');
      expect(b.modal('denied', props).props.visible).toBe(false);
    });
    it('문구는 deniedTexts 로 덮어쓸 수 있다', async () => {
      const h = harness();
      const props = { appName: '앱', deniedTexts: { body: '다른 설명', proceed: '계속 보기' } };
      h.mount(props);
      void ensure(h, tracking('denied'));
      await flush();
      expect(strings(h.modal('denied', props))).toEqual(['추적이 꺼져 있어요', '다른 설명', '계속 보기', '설정 열기']);
    });
    it('허용 상태에서는 오퍼월에 들어가도 열리지 않는다', async () => {
      const h = harness();
      h.mount();
      expect(await ensure(h, tracking('granted'))).toBe('granted');
      expect(h.modal('denied').props.visible).toBe(false);
    });
  });

  describe('시스템 ATT 창 앞 중립 안내 (그대로)', () => {
    it('미정일 때만 열리고, 확정 문구 · 버튼 하나, 닫기로 건너뛸 수 없다', async () => {
      const h = harness();
      h.mount();
      const t = tracking('undetermined', 'denied');
      void ensure(h, t);
      await flush();
      const primer = h.modal('primer');
      expect(primer.props.visible).toBe(true);
      expect(h.modal('denied').props.visible).toBe(false);
      expect(strings(primer)).toEqual([
        '다음 화면에서 앱 추적 허용 여부를 물어봐요',
        '허용하면 앱 사용 기록이 광고와 참여형 미션 참여 확인에 쓰여요. 허용하지 않아도 앱은 그대로 이용할 수 있어요.',
        '계속',
      ]);
      expect(buttons(primer)).toHaveLength(1);
      expect(primer.props.onRequestClose()).toBeUndefined();       // 뒤로가기 · 닫기로 건너뛰지 않는다
      expect(h.modal('primer').props.visible).toBe(true);
      expect(t.request, '버튼을 누르기 전에는 시스템 창을 안 띄운다').not.toHaveBeenCalled();
    });
    it('「계속」을 누르면 안내가 사라진 뒤 곧바로 시스템 창 — 허용하면 granted, 거부하면 proceed(오퍼월은 열린다)', async () => {
      for (const [answer, expected] of [['granted', 'granted'], ['denied', 'proceed']] as const) {
        const h = harness();
        h.mount();
        const t = tracking('undetermined', answer);
        const result = ensure(h, t);
        await flush();
        press(h.modal('primer'), '계속');
        expect(h.modal('primer').props.visible).toBe(false);
        await flush();
        expect(t.request).not.toHaveBeenCalled();                    // 사라지는 동안은 아직
        vi.advanceTimersByTime(DISMISS); await flush();
        expect(t.request).toHaveBeenCalledTimes(1);
        expect(await result).toBe(expected);
      }
    });
    it('한 번 보인 뒤에는 다시 안 뜬다 — 상태가 아직 미정이어도', async () => {
      const h = harness();
      h.mount();
      const t = tracking('undetermined', 'undetermined');         // 시스템 창이 안 뜬 드문 경우
      const first = ensure(h, t);
      await flush();
      press(h.modal('primer'), '계속');
      vi.advanceTimersByTime(DISMISS); await flush(); await first;
      void ensure(h, t);
      await flush();
      expect(h.modal('primer').props.visible).toBe(false);
      expect(t.request).toHaveBeenCalledTimes(2);                  // 안내 없이 시스템 창만 다시 묻는다
    });
    it('거부된 뒤에는 중립 안내가 뜨지 않는다(다시 조르지 않는다)', async () => {
      const h = harness();
      h.mount();
      void ensure(h, tracking('denied'));
      await flush();
      expect(h.modal('primer').props.visible).toBe(false);
    });
    it('문구는 상수 하나 — 앱이 primerTexts 로 덮어쓸 수 있다', async () => {
      const h = harness();
      const props = { appName: '앱', primerTexts: { body: '다른 설명', button: '확인' } };
      h.mount(props);
      void ensure(h, tracking('undetermined'));
      await flush();
      expect(strings(h.modal('primer', props))).toEqual(['다음 화면에서 앱 추적 허용 여부를 물어봐요', '다른 설명', '확인']);
    });
  });

  it('언마운트하면 등록이 풀리고, 열려 있던 안내를 기다리던 쪽도 풀린다(멈추지 않는다)', async () => {
    const h = harness();
    h.mount();
    let resolved = false;
    void ensure(h, tracking('denied')).then(() => { resolved = true; });
    await flush();
    h.unmount();
    await flush();
    expect(resolved).toBe(true);
    expect(await ensure(h, tracking('denied'))).toBe('proceed');   // 등록이 없으니 바로 지나간다
  });
});
