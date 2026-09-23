import { describe, expect, it } from 'vitest';

import { createReturnWatch } from './auth';

/**
 * `abandon()` 을 언제 잴지 가르는 장치 — 앱 밖에 다녀온 것만 센다.
 *  - 앱 안에서 오간 것(iOS 로그인 창 · 구글 계정 고르기 · 제어센터)을 세면 로그인을 잊어버린다
 *    (2026-09-22 영테크 실기기 · 당근 a93c018 · 꿀꿀 82e748c).
 *  - 반대로 중간 `inactive` 에서 깃발을 지우면 진짜 다녀온 경우를 놓쳐 버튼이 영영 먹통이 된다
 *    (당근캐시 2026-09-18, 총무님 세션 지적).
 */
describe('createReturnWatch', () => {
  it('다른 앱에 다녀오면 참 — background → active', () => {
    const w = createReturnWatch();
    expect(w.saw('background')).toBe(false);
    expect(w.saw('active')).toBe(true);
  });

  it('iOS 처럼 중간에 inactive 를 거쳐도 참 — 깃발은 background 에서만 올리고 active 에서만 내린다', () => {
    const w = createReturnWatch();
    w.saw('inactive');
    w.saw('background');
    expect(w.saw('inactive')).toBe(false);   // 여기서 지우면 다녀온 것을 놓친다
    expect(w.saw('active')).toBe(true);
  });

  it('앱 안에서 오간 것은 거짓 — 로그인 창 · 계정 고르기 · 제어센터', () => {
    const w = createReturnWatch();
    expect(w.saw('inactive')).toBe(false);
    expect(w.saw('active')).toBe(false);
    expect(w.saw('active')).toBe(false);
  });

  it('한 번 다녀온 것은 한 번만 센다 — 같은 복귀로 두 번 놓아 주지 않게', () => {
    const w = createReturnWatch();
    w.saw('background');
    expect(w.saw('active')).toBe(true);
    expect(w.saw('active')).toBe(false);
    expect(w.saw('inactive')).toBe(false);
    expect(w.saw('active')).toBe(false);
  });

  it('앱을 켜자마자 오는 active 는 거짓 — 시작하자마자 로그인을 잊지 않게', () => {
    expect(createReturnWatch().saw('active')).toBe(false);
    expect(createReturnWatch().saw(null)).toBe(false);
    expect(createReturnWatch().saw(undefined)).toBe(false);
  });
});
