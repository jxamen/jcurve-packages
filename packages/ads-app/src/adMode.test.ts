/**
 * 테스트 광고 판별 검증 — 여기가 뒤집히면 심사 전 앱의 광고가 통째로 no-fill 이 된다(07 문서 ⑨).
 */
import { describe, expect, it } from 'vitest';
import { readUpdateChannel, useTestAdUnit } from './adMode';

describe('업데이트 채널 읽기', () => {
  it('CJS·ESM 어느 모양이든 꺼낸다', () => {
    expect(readUpdateChannel({ channel: 'production' })).toBe('production');
    expect(readUpdateChannel({ default: { channel: 'testflight' } })).toBe('testflight');
    expect(readUpdateChannel(null)).toBe('');
    expect(readUpdateChannel(undefined)).toBe('');
  });
});

describe('테스트 광고를 쓸지', () => {
  it('production 채널만 실광고다', () => {
    expect(useTestAdUnit(undefined, 'production')).toBe(false);
  });

  it('TestFlight·preview·개발은 테스트 광고', () => {
    for (const ch of ['testflight', 'preview', 'development']) {
      expect(useTestAdUnit(undefined, ch)).toBe(true);
    }
  });

  it('채널을 못 읽으면 테스트 광고 — 안전한 쪽으로 기운다', () => {
    expect(useTestAdUnit(undefined, '')).toBe(true);
  });

  it('환경변수로 강제할 수 있다', () => {
    expect(useTestAdUnit('1', 'production')).toBe(true);
  });
});

describe('useTestAdUnit — 테스트 기기', () => {
  it('테스트 기기면 실단위를 쓴다 — 구글 테스트 단위는 SSV 를 안 보내 수확이 막힌다', () => {
    expect(useTestAdUnit(undefined, '', true)).toBe(false);
    expect(useTestAdUnit(undefined, 'development', true)).toBe(false);
  });

  it('테스트 기기가 아니면 지금까지와 같다', () => {
    expect(useTestAdUnit(undefined, '', false)).toBe(true);
    expect(useTestAdUnit(undefined, 'production', false)).toBe(false);
  });

  it('강제 테스트 깃발이 테스트 기기보다 우선 — 광고 사고를 막는 마지막 스위치다', () => {
    expect(useTestAdUnit('1', '', true)).toBe(true);
  });

  it('기본값은 테스트 기기가 아니다 — 부르는 쪽이 빠뜨려도 실광고로 새지 않는다', () => {
    expect(useTestAdUnit(undefined, '')).toBe(true);
  });
});
