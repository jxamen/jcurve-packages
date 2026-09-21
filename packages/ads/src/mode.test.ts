import { describe, expect, it } from 'vitest';
import { readUpdateChannel, ssvRequestOptions, useTestAdUnit } from './mode';

describe('readUpdateChannel', () => {
  it('채널이 루트에 있으면 그걸 쓴다', () => {
    expect(readUpdateChannel({ channel: 'testflight' })).toBe('testflight');
  });
  it('Metro interop 로 default 아래에만 있어도 읽는다', () => {
    expect(readUpdateChannel({ default: { channel: 'testflight' } })).toBe('testflight');
  });
  it('없으면 빈 문자열', () => {
    expect(readUpdateChannel(null)).toBe('');
    expect(readUpdateChannel({})).toBe('');
  });
});

describe('useTestAdUnit', () => {
  it('환경변수가 1이면 채널과 무관하게 테스트 광고', () => {
    expect(useTestAdUnit('1', 'production')).toBe(true);
  });
  it('스토어 production 만 실광고', () => {
    expect(useTestAdUnit(undefined, 'production')).toBe(false);
  });
  it('테스트 기기를 등록했으면 채널과 무관하게 실단위(구글이 그 기기엔 테스트 광고를 준다) — 환경변수 1 은 그래도 테스트', () => {
    expect(useTestAdUnit(undefined, 'testflight', true)).toBe(false);
    expect(useTestAdUnit('1', 'production', true)).toBe(true);
  });
  it('TestFlight·프리뷰·개발·채널 미확인은 테스트 광고 (실광고 no-fill 방지)', () => {
    expect(useTestAdUnit(undefined, 'testflight')).toBe(true);
    expect(useTestAdUnit(undefined, 'preview')).toBe(true);
    expect(useTestAdUnit(undefined, 'development')).toBe(true);
    expect(useTestAdUnit(undefined, '')).toBe(true);
  });
});

describe('ssvRequestOptions', () => {
  it('테스트 광고에는 userId 가 있어도 SSV 를 안 붙인다', () => {
    expect(ssvRequestOptions(true, 'member-1', '{"k":1}')).toEqual({});
  });
  it('실광고 + 로그인 userId 만 SSV 를 붙인다', () => {
    expect(ssvRequestOptions(false, 'member-1', '{"k":1}')).toEqual({
      serverSideVerificationOptions: { userId: 'member-1', customData: '{"k":1}' },
    });
  });
  it('실광고여도 둘러보기(userId 없음)는 SSV 없음', () => {
    expect(ssvRequestOptions(false, undefined)).toEqual({});
    expect(ssvRequestOptions(false, '  ')).toEqual({});
  });
});
