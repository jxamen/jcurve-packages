import { describe, expect, it, vi } from 'vitest';
import { openAppTarget, parseBridgeMessage } from './bridge';

const msg = (method: string, params?: unknown, n?: string) => JSON.stringify({ m: 'MocationNativeBridge', t: 1, ...(n !== undefined ? { n } : {}), method, params });

describe('parseBridgeMessage', () => {
  it('openAppTarget', () => {
    expect(parseBridgeMessage(msg('openAppTarget', { url: 'coupang://a', fallbackUrl: 'https://b' }))).toEqual({ method: 'openAppTarget', params: { url: 'coupang://a', fallbackUrl: 'https://b' } });
    expect(parseBridgeMessage(msg('openAppTarget', { url: 'coupang://a' }))).toEqual({ method: 'openAppTarget', params: { url: 'coupang://a' } });
    expect(parseBridgeMessage(msg('openAppTarget', {}))).toBeNull();
  });
  it('showFloatingPopup — durationSec 미전달 · 0 이하 · 숫자 아님이면 300', () => {
    const base = { imageUrl: 'https://i', name: 'n', price: '1,000' };
    for (const d of [undefined, 0, -3, 'abc']) expect((parseBridgeMessage(msg('showFloatingPopup', { ...base, durationSec: d })) as { params: { durationSec: number } }).params.durationSec).toBe(300);
    expect((parseBridgeMessage(msg('showFloatingPopup', { ...base, durationSec: 45 })) as { params: { durationSec: number } }).params.durationSec).toBe(45);
    expect(parseBridgeMessage(msg('showFloatingPopup', { imageUrl: 'x' }))).toBeNull();
  });
  it('오버레이 두 개', () => {
    expect(parseBridgeMessage(msg('requestOverlayPermission'))).toEqual({ method: 'requestOverlayPermission', params: {} });
    expect(parseBridgeMessage(msg('hasOverlayPermission'))).toEqual({ method: 'hasOverlayPermission', params: {} });
  });
  it('showFloatingPopup — durationSec 은 유한한 양수 number 만(강제 변환 없음)', () => {
    const base = { imageUrl: 'https://i', name: 'n', price: '1' };
    const dur = (d: unknown) => (parseBridgeMessage(msg('showFloatingPopup', { ...base, durationSec: d })) as { params: { durationSec: number } }).params.durationSec;
    expect(dur(true)).toBe(300);
    expect(dur('45')).toBe(300);
    expect(dur({ toString: null })).toBe(300);
    expect(dur([5])).toBe(300);
    expect(dur(0.5)).toBe(1);
    expect(dur(Infinity)).toBe(300);
    expect(dur(NaN)).toBe(300);
    expect(dur(60.9)).toBe(60);
  });
  it('최상위 프레임 표시(t:1)가 없거나 틀리면 거절', () => {
    expect(parseBridgeMessage(JSON.stringify({ m: 'MocationNativeBridge', method: 'hasOverlayPermission', params: {} }))).toBeNull();
    expect(parseBridgeMessage(JSON.stringify({ m: 'MocationNativeBridge', t: 0, method: 'hasOverlayPermission', params: {} }))).toBeNull();
  });
  it('비밀 값(nonce)이 맞을 때만 받는다 — 다른 값 · 없음은 null', () => {
    expect(parseBridgeMessage(msg('hasOverlayPermission', undefined, 'abc'), 'abc')).not.toBeNull();
    expect(parseBridgeMessage(msg('hasOverlayPermission', undefined, 'zzz'), 'abc')).toBeNull();
    expect(parseBridgeMessage(msg('hasOverlayPermission'), 'abc')).toBeNull();
  });
  it('우리 shim 이 보낸 게 아니거나 이상하면 null', () => {
    expect(parseBridgeMessage('not json')).toBeNull();
    expect(parseBridgeMessage(JSON.stringify({ method: 'openAppTarget', params: { url: 'a://b' } }))).toBeNull();
    expect(parseBridgeMessage(msg('unknown'))).toBeNull();
    expect(parseBridgeMessage(undefined)).toBeNull();
    expect(parseBridgeMessage('x'.repeat(30000))).toBeNull();
  });
});

describe('openAppTarget', () => {
  it('열면 true', async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    expect(await openAppTarget({ url: 'coupang://a' }, open)).toBe(true);
    expect(open).toHaveBeenCalledWith('coupang://a');
  });
  it('못 열면 fallbackUrl', async () => {
    const open = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined);
    expect(await openAppTarget({ url: 'coupang://a', fallbackUrl: 'https://store' }, open)).toBe(true);
    expect(open).toHaveBeenLastCalledWith('https://store');
  });
  it('둘 다 못 열면 false, 막힌 주소는 열지 않는다', async () => {
    const fail = vi.fn().mockRejectedValue(new Error('x'));
    expect(await openAppTarget({ url: 'coupang://a', fallbackUrl: 'https://s' }, fail)).toBe(false);
    const open = vi.fn();
    expect(await openAppTarget({ url: 'javascript:alert(1)' }, open)).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});
