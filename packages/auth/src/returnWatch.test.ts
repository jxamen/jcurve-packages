import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

/**
 * 타이머까지 맡긴 경우 — 다녀올 때마다 **앞서 건 타이머를 끈다.**
 * 안 끄면 옛 타이머가 뒤늦게 울려 그 사이 시작된 정상 로그인을 놓아 버린다(당근 0079d15 · 영테크 f9f643b).
 */
describe('createReturnWatch(deps) — 타이머', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('밖에 다녀오고 2.5초 동안 안 끝나면 놓아 준다', () => {
    const onStuck = vi.fn();
    const w = createReturnWatch({ busy: () => true, onStuck });
    w.saw('background'); w.saw('active');
    vi.advanceTimersByTime(2499);
    expect(onStuck).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStuck).toHaveBeenCalledTimes(1);
  });

  it('그 사이 로그인이 끝났으면 놓아 주지 않는다', () => {
    const onStuck = vi.fn();
    let busy = true;
    const w = createReturnWatch({ busy: () => busy, onStuck });
    w.saw('background'); w.saw('active');
    busy = false;
    vi.advanceTimersByTime(3000);
    expect(onStuck).not.toHaveBeenCalled();
  });

  it('또 나갔다 오면 옛 타이머는 울리지 않는다 — 한 번만 부른다', () => {
    const onStuck = vi.fn();
    const w = createReturnWatch({ busy: () => true, onStuck });
    w.saw('background'); w.saw('active');     // 첫 복귀 — 타이머 ①
    vi.advanceTimersByTime(2000);
    w.saw('background'); w.saw('active');     // 두 번째 복귀 — ① 을 끄고 ②
    vi.advanceTimersByTime(600);              // ① 이 살아 있었다면 여기서 울린다
    expect(onStuck).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1900);
    expect(onStuck).toHaveBeenCalledTimes(1);
  });

  it('앱 안에서만 오간 것에는 타이머를 걸지 않는다', () => {
    const onStuck = vi.fn();
    const w = createReturnWatch({ busy: () => true, onStuck });
    w.saw('inactive'); w.saw('active');
    vi.advanceTimersByTime(5000);
    expect(onStuck).not.toHaveBeenCalled();
  });

  it('stop() 하면 걸린 타이머가 울리지 않는다 — 화면을 떠날 때', () => {
    const onStuck = vi.fn();
    const w = createReturnWatch({ busy: () => true, onStuck });
    w.saw('background'); w.saw('active');
    w.stop();
    vi.advanceTimersByTime(5000);
    expect(onStuck).not.toHaveBeenCalled();
  });

  it('인자 없이 쓰면 타이머를 만들지 않는다 — 2.2.0 처럼 판단만', () => {
    const w = createReturnWatch();
    w.saw('background');
    expect(w.saw('active')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

/** 막 누른 참은 봐준다 — 창이 뜨는 중에 놓아 주면 정상 로그인을 시작하자마자 끊는다(2.4) */
describe('createReturnWatch — 막 누른 참(grace)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('누른 지 얼마 안 됐으면 놓아 주지 않는다', () => {
    const onStuck = vi.fn();
    const w = createReturnWatch({ busy: () => true, onStuck });
    w.started();                         // 버튼을 누른 순간
    w.saw('background'); w.saw('active');
    vi.advanceTimersByTime(2500);        // 타이머는 터지지만 누른 지 2.5초뿐이다
    expect(onStuck).not.toHaveBeenCalled();
  });

  it('누른 지 오래됐으면 놓아 준다', () => {
    const onStuck = vi.fn();
    const w = createReturnWatch({ busy: () => true, onStuck });
    w.started();
    vi.advanceTimersByTime(4000);        // 창이 뜬 채로 4초
    w.saw('background'); w.saw('active');
    vi.advanceTimersByTime(2500);
    expect(onStuck).toHaveBeenCalledTimes(1);
  });

  it('봐주는 시간은 바꿀 수 있고, started() 를 안 부르면 봐주기가 없다', () => {
    const a = vi.fn();
    const w1 = createReturnWatch({ busy: () => true, onStuck: a, grace: 100 });
    w1.started();
    w1.saw('background'); w1.saw('active');
    vi.advanceTimersByTime(2500);
    expect(a).toHaveBeenCalledTimes(1);   // 100ms 만 봐주므로 놓아 준다

    const b = vi.fn();
    const w2 = createReturnWatch({ busy: () => true, onStuck: b });
    w2.saw('background'); w2.saw('active');   // started() 없음
    vi.advanceTimersByTime(2500);
    expect(b).toHaveBeenCalledTimes(1);
  });
});

/**
 * 꾹테크 32ebf5d 가 짚은 장면 — 기다리는 2.5초 **사이에 사람이 다시 누른다**(앞 로그인이 취소로 끝난 직후).
 * 그때 울린 타이머는 앞 로그인을 겨냥한 것인데 busy() 는 새 로그인 때문에 참이다.
 * `started()` 를 누를 때마다 부르면, 새 로그인이 「막 누른 참」이라 놓아 주지 않는다.
 */
describe('기다리는 사이에 다시 누른 로그인', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('새로 누른 로그인은 끊지 않는다', () => {
    const onStuck = vi.fn();
    const w = createReturnWatch({ busy: () => true, onStuck });
    w.started();                          // 첫 로그인
    vi.advanceTimersByTime(5000);         // 창이 뜬 채 한참
    w.saw('background'); w.saw('active'); // 아이콘으로 복귀 — 타이머 시작
    vi.advanceTimersByTime(1000);
    w.started();                          // 사람이 다시 누름(취소 뒤 재시도)
    vi.advanceTimersByTime(1500);         // 옛 타이머가 여기서 울린다
    expect(onStuck).not.toHaveBeenCalled();
  });

  it('다시 누르지 않았으면 예정대로 놓아 준다', () => {
    const onStuck = vi.fn();
    const w = createReturnWatch({ busy: () => true, onStuck });
    w.started();
    vi.advanceTimersByTime(5000);
    w.saw('background'); w.saw('active');
    vi.advanceTimersByTime(2500);
    expect(onStuck).toHaveBeenCalledTimes(1);
  });
});
