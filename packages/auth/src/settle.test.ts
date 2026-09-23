import { describe, expect, it } from 'vitest';
import { createAuth, type AuthEnv } from './auth';
import { createSettle, type SettleEnv } from './settle';

/** 손으로 돌리는 시계 — sleep 이 시계를 민다. AppState 는 fire 로 바꾼다 */
function clock(start = 100_000) {
  let t = start;
  let listener: (s: string) => void = () => {};
  let state = 'active';
  const env: SettleEnv = {
    appState: () => state,
    onAppState: (fn) => { listener = fn; return () => {}; },
    now: () => t,
    sleep: async (ms) => { t += ms; },
  };
  return { env, now: () => t, tick: (ms: number) => { t += ms; }, fire: (s: string) => { state = s; listener(s); } };
}

describe('안전 시점', () => {
  it('로그인이 없었으면 곧 풀린다', async () => {
    const c = clock();
    const s = createSettle(() => false, c.env);
    expect(s.settled()).toBe(true);
    const before = c.now();
    await s.wait();
    expect(c.now() - before).toBeLessThan(100);
  });

  it('로그인이 끝난 뒤 1초 조용해야 풀린다', async () => {
    const c = clock();
    const s = createSettle(() => false, c.env);
    s.ended();
    expect(s.settled()).toBe(false);
    const at = c.now();
    await s.wait();
    expect(c.now() - at).toBeGreaterThanOrEqual(1000);
  });

  it('로그인이 도는 동안은 풀리지 않는다', () => {
    const c = clock();
    let busy = true;
    const s = createSettle(() => busy, c.env);
    expect(s.settled()).toBe(false);
    busy = false;
    expect(s.settled()).toBe(true);
  });

  it('구글 창이 떠 있는(inactive) 동안은 풀리지 않고, active 로 돌아온 뒤 1초를 다시 센다', () => {
    const c = clock();
    const s = createSettle(() => false, c.env);
    c.fire('inactive');
    c.tick(5000);
    expect(s.settled()).toBe(false);
    c.fire('active');
    c.tick(500);
    expect(s.settled()).toBe(false);
    c.tick(600);
    expect(s.settled()).toBe(true);
  });

  it('차례로 연다 — 앞의 것이 돌려준 약속이 끝나야 다음, 앞의 것이 실패해도 다음은 연다', async () => {
    const c = clock();
    const s = createSettle(() => false, c.env);
    const order: string[] = [];
    let closeGuide!: () => void;
    const guide = s.run(() => new Promise<void>((r) => { order.push('guide'); closeGuide = r; }));
    const bad = s.run(() => { order.push('bad'); throw new Error('x'); });
    const att = s.run(() => { order.push('att'); return 'ok'; });
    await new Promise((r) => setTimeout(r, 0));
    expect(order).toEqual(['guide']);           // 가이드가 닫히기 전에는 다음이 안 열린다
    closeGuide();
    await expect(bad).rejects.toThrow('x');
    await expect(att).resolves.toBe('ok');
    await guide;
    expect(order).toEqual(['guide', 'bad', 'att']);
  });
});

describe('createAuth 에 붙어 있다', () => {
  function make() {
    const c = clock();
    const env: AuthEnv = {
      os: () => 'ios', kakaoCore: () => null, kakaoUser: () => null, google: () => null, apple: () => null,
      browser: () => null, linking: () => null, wait: c.env.sleep,
      appState: c.env.appState, onAppState: c.env.onAppState, now: c.env.now,
    };
    const auth = createAuth<unknown>({ keys: {}, server: { kakao: async () => 1, google: async () => 1, apple: async () => 1 } }, env);
    return { auth, c };
  }

  it('로그인이 끝나면(실패여도) 곧바로는 안전하지 않다', async () => {
    const { auth, c } = make();
    expect(auth.loginSettled()).toBe(true);
    await auth.signIn('google').catch(() => undefined);   // SDK 도 웹 로그인도 없어 실패로 끝난다
    expect(auth.loginSettled()).toBe(false);
    c.tick(1000);
    expect(auth.loginSettled()).toBe(true);
  });

  it('abandon 도 로그인이 끝난 것으로 센다', () => {
    const { auth, c } = make();
    auth.abandon();
    expect(auth.loginSettled()).toBe(false);
    c.tick(1000);
    expect(auth.loginSettled()).toBe(true);
  });

  it('runAfterLogin 은 안전 시점에 연다', async () => {
    const { auth, c } = make();
    auth.abandon();
    const at = c.now();
    let openedAt = 0;
    await auth.runAfterLogin(() => { openedAt = c.now(); });
    expect(openedAt - at).toBeGreaterThanOrEqual(1000);
  });
});
