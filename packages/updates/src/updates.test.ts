import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __reset, autoApply, bundleLabel, startupSettled, type AutoApplyDeps } from './updates';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** expo-updates 흉내 — 받아 두기(pending)를 손으로 일으키고, 다시 시작한 횟수를 센다 */
function fakeUpdates(ctx: Record<string, unknown> = {}) {
  const listeners = new Set<(e: any) => void>();
  const U = {
    isEnabled: true,
    isEmbeddedLaunch: false,
    updateId: '01a0c45d-cacb-7eeb',
    reloads: 0,
    reloadAsync: async () => { U.reloads++; },
    latestContext: { isStartupProcedureRunning: false, isUpdatePending: false, ...ctx } as any,
    addUpdatesStateChangeListener: (fn: (e: any) => void) => {
      listeners.add(fn);

      return { remove: () => { listeners.delete(fn); } };
    },
    /** 네이티브 상태가 바뀌었다 */
    emit(context: Record<string, unknown>) {
      U.latestContext = { ...U.latestContext, ...context };
      [...listeners].forEach((f) => f({ context: U.latestContext }));
    },
    listeners,
  };

  return U;
}

/** 앱 상태 — 테스트에서 바꾼다 */
function app(o: Partial<{ signedIn: boolean; triedAuth: boolean; busy: boolean; atHome: boolean }> = {}) {
  const s = { signedIn: false, triedAuth: false, busy: false, atHome: false, ...o };
  const deps: AutoApplyDeps = {
    signedIn: () => s.signedIn,
    triedAuth: () => s.triedAuth,
    busy: () => s.busy,
    atHome: () => s.atHome,
  };

  return { s, deps };
}

let active = true;
let U: ReturnType<typeof fakeUpdates>;
beforeEach(() => {
  vi.useFakeTimers();
  active = true;
  U = fakeUpdates();
  __reset({ updates: () => U as any, active: () => active, dev: () => false });
});
afterEach(() => { vi.useRealTimers(); __reset(); });

describe('로그인한 사람', () => {
  it('켠 지 6초 안에 받으면 바로 적용한다 — 시작 화면 뒤라 깜빡임이 안 보인다', () => {
    const { deps } = app({ signedIn: true });
    autoApply(deps);
    U.emit({ isUpdatePending: true });
    expect(U.reloads).toBe(1);
  });

  it('늦게 받으면 메인에 있을 때까지 기다린다', () => {
    const { s, deps } = app({ signedIn: true, atHome: false });
    autoApply(deps);
    vi.advanceTimersByTime(7000);
    U.emit({ isUpdatePending: true });
    vi.advanceTimersByTime(9000);
    expect(U.reloads, '메인이 아니면 적용하지 않는다').toBe(0);
    s.atHome = true;
    vi.advanceTimersByTime(3000);
    expect(U.reloads).toBe(1);
    vi.advanceTimersByTime(30000);
    expect(U.reloads, '한 번만').toBe(1);
  });

  it('6초 안이어도 로그인 창을 다녀오는 중이면 적용하지 않는다(세션 만료 뒤 재로그인)', () => {
    const { s, deps } = app({ signedIn: true, busy: true, atHome: true });
    autoApply(deps);
    U.emit({ isUpdatePending: true });
    vi.advanceTimersByTime(9000);
    expect(U.reloads).toBe(0);
    s.busy = false;
    vi.advanceTimersByTime(3000);
    expect(U.reloads).toBe(1);
  });
});

describe('로그인 전', () => {
  it('로그인 버튼을 누르기 전이면 바로 적용한다 — 새로 깐 사람이 옛 코드에 갇히지 않게', () => {
    const { deps } = app();
    autoApply(deps);
    U.emit({ isUpdatePending: true });
    expect(U.reloads).toBe(1);
  });

  it('**로그인 버튼을 누른 뒤에는 적용하지 않는다** — 로그인 창에서 돌아올 곳이 사라진다', () => {
    const { deps } = app({ triedAuth: true });
    autoApply(deps);
    U.emit({ isUpdatePending: true });
    vi.advanceTimersByTime(60000);
    expect(U.reloads).toBe(0);
  });

  it('로그인·가입 화면이 떠 있으면 기다렸다가, 벗어나면 적용한다', () => {
    const { s, deps } = app({ busy: true });
    autoApply(deps);
    U.emit({ isUpdatePending: true });
    vi.advanceTimersByTime(9000);
    expect(U.reloads).toBe(0);
    s.busy = false;
    vi.advanceTimersByTime(3000);
    expect(U.reloads).toBe(1);
  });

  it('기다리는 사이 로그인 버튼을 누르면 끝까지 적용하지 않는다', () => {
    const { s, deps } = app({ busy: true });
    autoApply(deps);
    U.emit({ isUpdatePending: true });
    s.triedAuth = true;
    s.busy = false;
    vi.advanceTimersByTime(60000);
    expect(U.reloads).toBe(0);
  });
});

describe('공통', () => {
  it('앱이 뒤로 가 있으면(로그인 창·미션 매체) 적용하지 않는다', () => {
    active = false;
    const { deps } = app({ signedIn: true, atHome: true });
    autoApply(deps);
    U.emit({ isUpdatePending: true });
    vi.advanceTimersByTime(9000);
    expect(U.reloads).toBe(0);
    active = true;
    vi.advanceTimersByTime(3000);
    expect(U.reloads).toBe(1);
  });

  it('부르기 전에 이미 받아 뒀으면 그 자리에서 판단한다', () => {
    U = fakeUpdates({ isUpdatePending: true });
    __reset({ updates: () => U as any, active: () => true, dev: () => false });
    autoApply(app({ signedIn: true }).deps);
    expect(U.reloads).toBe(1);
  });

  it('받아 둔 것이 없으면 아무것도 안 한다', () => {
    autoApply(app({ signedIn: true, atHome: true }).deps);
    vi.advanceTimersByTime(60000);
    expect(U.reloads).toBe(0);
  });

  it('멈추면 기다리던 것도 멈춘다', () => {
    const { s, deps } = app({ signedIn: true, atHome: false });
    const stop = autoApply(deps);
    vi.advanceTimersByTime(7000);
    U.emit({ isUpdatePending: true });
    stop();
    s.atHome = true;
    vi.advanceTimersByTime(30000);
    expect(U.reloads).toBe(0);
  });

  it('개발 실행·expo-updates 가 없는 빌드에서는 아무것도 안 하고 던지지 않는다', () => {
    __reset({ updates: () => U as any, active: () => true, dev: () => true });
    autoApply(app().deps);
    U.emit({ isUpdatePending: true });
    expect(U.reloads).toBe(0);
    __reset({ updates: () => { throw new Error('no module'); }, dev: () => false });
    expect(() => autoApply(app().deps)).not.toThrow();
  });
});

describe('시작 화면 붙잡기', () => {
  it('네이티브 확인이 끝나면 놓는다', async () => {
    U.latestContext.isStartupProcedureRunning = true;
    let done = false;
    void startupSettled(3000).then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    U.emit({ isStartupProcedureRunning: false });
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it('받기가 시작되면 놓는다 — 받는 동안 붙잡지 않는다', async () => {
    U.latestContext.isStartupProcedureRunning = true;
    let done = false;
    void startupSettled(3000).then(() => { done = true; });
    U.emit({ isDownloading: true });
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it('끝나지 않아도 최대 시간이 지나면 놓는다', async () => {
    U.latestContext.isStartupProcedureRunning = true;
    let done = false;
    void startupSettled(3000).then(() => { done = true; });
    vi.advanceTimersByTime(3000);
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it('확인이 안 도는 중이면 바로 놓는다', async () => {
    await expect(startupSettled(3000)).resolves.toBeUndefined();
  });
});

describe('판 이름', () => {
  it('받은 판이면 앞 8자, 스토어 판 그대로면 빈 값', () => {
    expect(bundleLabel()).toBe('01a0c45d');
    U.isEmbeddedLaunch = true;
    expect(bundleLabel()).toBe('');
  });
});
