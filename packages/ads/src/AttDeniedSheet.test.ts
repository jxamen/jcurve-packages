import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Module = require('node:module');
const originalLoad = Module._load;
afterEach(() => { Module._load = originalLoad; vi.useRealTimers(); vi.restoreAllMocks(); });
beforeEach(() => { vi.useFakeTimers(); });

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

/** 패키지된 CommonJS(dist)를 가짜 react · react-native 로 읽어 실제 렌더 트리를 본다 */
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
  const appListeners: Array<(s: string) => void> = [];
  const rn = {
    Platform: { OS: os },
    Modal: 'Modal', View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
    Linking: { openSettings: vi.fn(async () => undefined) },
    AppState: { addEventListener: vi.fn((_t: string, fn: (s: string) => void) => { appListeners.push(fn); return { remove: vi.fn() }; }) },
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
    rn, att, appListeners,
    render(p: any = props) { cursor = 0; return AttDeniedSheet(p); },
    /** 마운트 — 한 번 그리고 효과를 돌린다 */
    mount(p: any = props) { const out = this.render(p); for (const fx of effects) cleanups.push(fx()); firstRender = false; return out; },
    unmount() { for (const c of cleanups) if (typeof c === 'function') c(); },
    modal(key: 'primer' | 'sheet', p: any = props) {
      const out = this.render(p);
      return ([] as any[]).concat(out.props.children).find((m: any) => m?.props?.key === key);
    },
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
const tracking = (status: string, requestStatus = status) => {
  const get = vi.fn(async () => ({ status }));
  const request = vi.fn(async () => ({ status: requestStatus }));

  return { get, request, getTrackingPermissionsAsync: get, requestTrackingPermissionsAsync: request };
};
const DISMISS = 400;   // dist 의 DISMISS_MS

describe('AttDeniedSheet — 호스트(1.9.11)', () => {
  it('앱 루트에 붙이기만 하면 아무것도 열리지 않는다 — 켜질 때도, 한참 뒤에도', async () => {
    const h = harness();
    h.mount();
    await flush(); vi.advanceTimersByTime(60_000); await flush();
    expect(h.modal('primer').props.visible).toBe(false);
    expect(h.modal('sheet').props.visible).toBe(false);
    expect(h.rn.Linking.openSettings).not.toHaveBeenCalled();
  });
  it('Android(iOS 가 아님)에서는 아무것도 그리지 않는다', () => {
    const h = harness('android');
    expect(h.mount()).toBeNull();
  });

  describe('거부 · 제한 단계 시트', () => {
    it('오퍼월 진입(ensureTrackingBeforeOfferwall) + 거부일 때만 열린다', async () => {
      const h = harness();
      h.mount();
      const t = tracking('denied');
      const result = h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: t });
      await flush();
      expect(h.modal('sheet').props.visible).toBe(true);
      expect(h.modal('primer').props.visible).toBe(false);
      expect(t.request).not.toHaveBeenCalled();        // 시스템 창은 안 부른다
      h.modal('sheet').props.onRequestClose();
      vi.advanceTimersByTime(DISMISS); await flush();
      expect(await result).toBe('denied');
    });
    it('제한(restricted)도 같다', async () => {
      const h = harness();
      h.mount();
      void h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: tracking('restricted') });
      await flush();
      expect(h.modal('sheet').props.visible).toBe(true);
    });
    it('내용: 첫 줄 · 단계 5개 · 안내 · 보조 안내 · 버튼 둘(설정에서 허용하기 · 나중에), 보상 단어 0', async () => {
      const h = harness();
      h.mount();
      void h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: tracking('denied') });
      await flush();
      const sheet = h.modal('sheet');
      const text = strings(sheet);
      expect(text[0]).toBe('애드팝콘 참여형 미션은 설치 · 참여 확인을 위해 추적 허용이 필요해요');
      expect(text.filter((s) => /^[1-5]$/.test(s))).toEqual(['1', '2', '3', '4', '5']);   // 번호 동그라미 5개
      expect(text).toContain('「설정」 앱을 열어요');
      expect(text).toContain('「앱」으로 가요');
      expect(text).toContain('「꼬꼬농장」을 찾아 눌러요');                                   // appName 이 들어간다
      expect(text).toContain('「추적 허용」을 켜요');
      expect(text).toContain('앱으로 돌아오면 바로 이용할 수 있어요');
      expect(text).toContain('아래 「설정에서 허용하기」를 누르면 3단계까지 바로 가요');
      expect(text.some((s) => s.startsWith('앱 화면에 「추적 허용」이 안 보이면'))).toBe(true);
      expect(buttons(sheet).map(labelOf)).toEqual(['설정에서 허용하기', '나중에']);
      for (const s of text) expect(/포인트|적립|보상|혜택|더 받/.test(s), s).toBe(false);
    });
    it('「설정에서 허용하기」는 설정 앱을 열고 시트는 그대로 둔다', async () => {
      const h = harness();
      h.mount();
      void h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: tracking('denied') });
      await flush();
      buttons(h.modal('sheet'))[0].props.onPress();
      expect(h.rn.Linking.openSettings).toHaveBeenCalledTimes(1);
      expect(h.modal('sheet').props.visible).toBe(true);
    });
    it('「나중에」로 닫으면 화면이 사라진 뒤에 오퍼월 진입이 이어진다 — 막지 않는다', async () => {
      const h = harness();
      h.mount();
      let resolved = false;
      void h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: tracking('denied') }).then(() => { resolved = true; });
      await flush();
      buttons(h.modal('sheet'))[1].props.onPress();
      expect(h.modal('sheet').props.visible).toBe(false);
      await flush();
      expect(resolved).toBe(false);                       // 사라지는 동안은 기다린다
      vi.advanceTimersByTime(DISMISS); await flush();
      expect(resolved).toBe(true);
    });
    it('오퍼월을 누를 때마다 다시 열린다(탭할 때만)', async () => {
      const h = harness();
      h.mount();
      const t = tracking('denied');
      for (let i = 0; i < 2; i++) {
        const r = h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: t });
        await flush();
        expect(h.modal('sheet').props.visible).toBe(true);
        buttons(h.modal('sheet'))[1].props.onPress();
        vi.advanceTimersByTime(DISMISS); await flush(); await r;
        expect(h.modal('sheet').props.visible).toBe(false);
      }
    });
    it('허용 상태에서는 오퍼월에 들어가도 열리지 않는다', async () => {
      const h = harness();
      h.mount();
      expect(await h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: tracking('granted') })).toBe('granted');
      expect(h.modal('sheet').props.visible).toBe(false);
    });
  });

  describe('시스템 ATT 창 앞 중립 안내', () => {
    it('미정일 때만 열리고, 확정 문구 · 버튼 하나, 닫기로 건너뛸 수 없다', async () => {
      const h = harness();
      h.mount();
      const t = tracking('undetermined', 'denied');
      void h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: t });
      await flush();
      const primer = h.modal('primer');
      expect(primer.props.visible).toBe(true);
      expect(h.modal('sheet').props.visible).toBe(false);
      expect(strings(primer)).toEqual([
        '다음 화면에서 앱 추적 허용 여부를 물어봐요',
        '허용하면 앱 사용 기록이 광고와 참여형 미션 참여 확인에 쓰여요. 허용하지 않아도 앱은 그대로 이용할 수 있어요.',
        '계속',
      ]);
      expect(buttons(primer)).toHaveLength(1);
      expect(typeof buttons(primer)[0].props.onPress).toBe('function');
      expect(primer.props.onRequestClose()).toBeUndefined();       // 뒤로가기 · 닫기로 건너뛰지 않는다
      expect(h.modal('primer').props.visible).toBe(true);
      expect(t.request, '버튼을 누르기 전에는 시스템 창을 안 띄운다').not.toHaveBeenCalled();
    });
    it('「계속」을 누르면 안내가 사라진 뒤 곧바로 시스템 창을 띄운다', async () => {
      const h = harness();
      h.mount();
      const t = tracking('undetermined', 'granted');
      const result = h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: t });
      await flush();
      buttons(h.modal('primer'))[0].props.onPress();
      expect(h.modal('primer').props.visible).toBe(false);
      await flush();
      expect(t.request).not.toHaveBeenCalled();                    // 사라지는 동안은 아직
      vi.advanceTimersByTime(DISMISS); await flush();
      expect(t.request).toHaveBeenCalledTimes(1);
      expect(await result).toBe('granted');
    });
    it('한 번 보인 뒤에는 다시 안 뜬다 — 상태가 아직 미정이어도', async () => {
      const h = harness();
      h.mount();
      const t = tracking('undetermined', 'undetermined');         // 시스템 창이 안 뜬 드문 경우
      const first = h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: t });
      await flush();
      buttons(h.modal('primer'))[0].props.onPress();
      vi.advanceTimersByTime(DISMISS); await flush(); await first;
      void h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: t });
      await flush();
      expect(h.modal('primer').props.visible).toBe(false);
      expect(t.request).toHaveBeenCalledTimes(2);                  // 안내 없이 시스템 창만 다시 묻는다
    });
    it('거부된 뒤에는 중립 안내가 뜨지 않는다(다시 조르지 않는다)', async () => {
      const h = harness();
      h.mount();
      void h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: tracking('denied') });
      await flush();
      expect(h.modal('primer').props.visible).toBe(false);
    });
    it('문구는 상수 하나 — 앱이 primerTexts 로 덮어쓸 수 있다', async () => {
      const h = harness();
      const props = { appName: '앱', primerTexts: { body: '다른 설명', button: '확인' } };
      h.mount(props);
      void h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: tracking('undetermined') });
      await flush();
      expect(strings(h.modal('primer', props))).toEqual(['다음 화면에서 앱 추적 허용 여부를 물어봐요', '다른 설명', '확인']);
    });
  });

  it('언마운트하면 등록이 풀리고, 열려 있던 안내를 기다리던 쪽도 풀린다(멈추지 않는다)', async () => {
    const h = harness();
    h.mount();
    let resolved = false;
    void h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: tracking('denied') }).then(() => { resolved = true; });
    await flush();
    h.unmount();
    await flush();
    expect(resolved).toBe(true);
    expect(await h.att.ensureTrackingBeforeOfferwallWith({ os: 'ios', tracking: tracking('denied') })).toBe('denied');   // 등록이 없으니 바로 지나간다
  });
});
