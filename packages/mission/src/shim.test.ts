import { describe, expect, it } from 'vitest';
import { bridgeShim } from './shim';

describe('bridgeShim', () => {
  it('Android: JS 인터페이스만, iOS 핸들러는 심지 않는다', () => {
    const a = bridgeShim('android');
    expect(a).toContain('window.MocationNativeBridge = {');
    expect(a).toContain('return false');
    expect(a).not.toContain('messageHandlers');
    expect(bridgeShim('android', true)).toContain('return true');
  });
  it('iOS: webkit 핸들러만, MocationNativeBridge 전역은 만들지 않는다(Android 로 오인 방지)', () => {
    const i = bridgeShim('ios');
    expect(i).toContain('messageHandlers');
    expect(i).not.toContain('window.MocationNativeBridge');
  });
  it('실제 실행: Android 방식 호출이 postMessage 로 간다', () => {
    const sent: string[] = [];
    const win: Record<string, unknown> = { ReactNativeWebView: { postMessage: (s: string) => sent.push(s) } };
    win.top = win;
    new Function('window', bridgeShim('android', false, 'SECRET'))(win);
    const b = win.MocationNativeBridge as { openAppTarget: (p: string) => void; hasOverlayPermission: () => boolean };
    b.openAppTarget(JSON.stringify({ url: 'coupang://a' }));
    expect(JSON.parse(sent[0])).toEqual({ m: 'MocationNativeBridge', n: 'SECRET', t: 1, method: 'openAppTarget', params: { url: 'coupang://a' } });
    expect(b.hasOverlayPermission()).toBe(false);
  });
  it('실제 실행: iOS 방식 호출이 postMessage 로 가고 기존 핸들러(ReactNativeWebView)는 남는다', () => {
    const sent: string[] = [];
    const rn = { postMessage: () => {} };
    const win: Record<string, unknown> = { ReactNativeWebView: { postMessage: (s: string) => sent.push(s) }, webkit: { messageHandlers: { ReactNativeWebView: rn } } };
    win.top = win;
    new Function('window', bridgeShim('ios'))(win);
    const mh = (win.webkit as { messageHandlers: Record<string, { postMessage: (b: unknown) => void }> }).messageHandlers;
    mh.MocationNativeBridge.postMessage({ message: 'openAppTarget', url: 'coupang://a', fallbackUrl: 'https://s' });
    expect(JSON.parse(sent[0]).params).toEqual({ url: 'coupang://a', fallbackUrl: 'https://s' });
    expect(mh.ReactNativeWebView).toBe(rn);
  });
  it('실제 실행: messageHandlers 가 막혀 있어도(대입 불가) 프록시로 심는다', () => {
    const sent: string[] = [];
    const rn = { postMessage: () => {} };
    const frozen = Object.freeze({ ReactNativeWebView: rn });
    const win: Record<string, unknown> = { ReactNativeWebView: { postMessage: (s: string) => sent.push(s) }, webkit: { messageHandlers: frozen } };
    win.top = win;
    new Function('window', bridgeShim('ios'))(win);
    const mh = (win.webkit as { messageHandlers: Record<string, { postMessage: (b: unknown) => void }> }).messageHandlers;
    mh.MocationNativeBridge.postMessage({ message: 'openAppTarget', url: 'a://b' });
    expect(sent.length).toBe(1);
    expect(mh.ReactNativeWebView).toBe(rn);
  });
  it('비밀 값은 전역에 노출하지 않는다(window 속성으로 읽을 수 없다)', () => {
    const win: Record<string, unknown> = { ReactNativeWebView: { postMessage: () => {} } };
    new Function('window', bridgeShim('android', false, 'TOPSECRET'))(win);
    expect(JSON.stringify(Object.keys(win))).not.toContain('TOPSECRET');
    expect(Object.values(win).some(v => typeof v === 'string' && v.includes('TOPSECRET'))).toBe(false);
  });
  it('iframe 안(window.top 이 다름)에서는 아무것도 보내지 않는다', () => {
    const sent: string[] = [];
    const win: Record<string, unknown> = { ReactNativeWebView: { postMessage: (s: string) => sent.push(s) }, top: {} };
    new Function('window', bridgeShim('android', false, 'S'))(win);
    (win.MocationNativeBridge as { openAppTarget: (p: string) => void }).openAppTarget('{"url":"a://b"}');
    expect(sent).toEqual([]);
  });
});
