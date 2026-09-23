import { describe, expect, it } from 'vitest';

import { cameBackFromOtherApp } from './auth';

/**
 * `abandon()` 을 언제 잴지 가르는 한 줄 — 앱 밖에 다녀온 것만 센다.
 * 앱 안에서 오간 것(iOS 로그인 창 · 구글 계정 고르기 · 제어센터)을 세면 로그인을 잊어버린다
 * (2026-09-22 영테크 실기기 · 당근 a93c018 · 꿀꿀 82e748c).
 */
describe('cameBackFromOtherApp', () => {
  it('다른 앱에 다녀오면 참 — background → active', () => {
    expect(cameBackFromOtherApp('background', 'active')).toBe(true);
  });

  it('앱 안에서 오간 것은 거짓 — iOS 로그인 창 · 계정 고르기 · 제어센터', () => {
    expect(cameBackFromOtherApp('inactive', 'active')).toBe(false);
    expect(cameBackFromOtherApp('active', 'inactive')).toBe(false);
    expect(cameBackFromOtherApp('inactive', 'background')).toBe(false);
  });

  it('나가는 쪽 · 그대로인 쪽도 거짓', () => {
    expect(cameBackFromOtherApp('active', 'background')).toBe(false);
    expect(cameBackFromOtherApp('active', 'active')).toBe(false);
    expect(cameBackFromOtherApp('background', 'background')).toBe(false);
  });

  it('처음이라 앞 상태를 모를 때도 거짓 — 앱을 켜자마자 잊어버리지 않게', () => {
    expect(cameBackFromOtherApp(null, 'active')).toBe(false);
    expect(cameBackFromOtherApp(undefined, 'active')).toBe(false);
  });
});
