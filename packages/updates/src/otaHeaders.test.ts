import { afterEach, describe, expect, it } from 'vitest';
import { __reset, otaHeaders } from './updates';

/* eslint-disable @typescript-eslint/no-explicit-any */

afterEach(() => { __reset(); });

describe('2.5 — OTA 판 헤더', () => {
  it('서버 OtaTrack 이 읽는 이름 그대로 — 판 id · 채널 · 런타임 · 플랫폼', () => {
    __reset({ os: () => 'android', updates: () => ({ updateId: '01a0c6cd-c12e', channel: 'production', runtimeVersion: '1.0.6' }) as any });
    expect(otaHeaders()).toEqual({
      'x-ota-platform': 'android', 'x-ota-update-id': '01a0c6cd-c12e', 'x-ota-channel': 'production', 'x-ota-runtime': '1.0.6',
    });
  });

  it('OTA 를 안 받은 스토어 판은 embedded · 모듈이 없어도 던지지 않는다', () => {
    __reset({ os: () => 'ios', updates: () => ({ updateId: null }) as any });
    expect(otaHeaders()).toEqual({ 'x-ota-platform': 'ios', 'x-ota-update-id': 'embedded' });
    __reset({ os: () => 'ios', updates: () => { throw new Error('no module'); } });
    expect(otaHeaders()).toEqual({ 'x-ota-platform': 'ios', 'x-ota-update-id': 'embedded' });
  });

  it('웹 미리보기는 빈 객체 — 서버가 기기로 세지 않게', () => {
    __reset({ os: () => 'web' });
    expect(otaHeaders()).toEqual({});
  });
});
