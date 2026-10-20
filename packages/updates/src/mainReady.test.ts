import { describe, expect, it } from 'vitest';
import { createMainReady, type MainReadyDeps } from './mainReady';

/** expo-updates · 저장소 흉내 — 다시 시작 횟수 · marker 를 센다 */
function fake(over: Partial<MainReadyDeps> & { newId?: string | null; available?: boolean; marker?: string | null; fetchMs?: number } = {}) {
  const st = { reloads: 0, checks: 0, fetches: 0, marker: over.marker ?? null as string | null, t: 1_000_000 };
  const d: MainReadyDeps = {
    enabled: true,
    currentId: 'cur',
    check: async () => { st.checks++; return { isAvailable: over.available ?? true }; },
    fetch: async () => {
      st.fetches++;
      if (over.fetchMs) await new Promise((r) => setTimeout(r, over.fetchMs));
      return { isNew: true, manifest: { id: over.newId === undefined ? 'new1' : over.newId ?? undefined } };
    },
    reload: async () => { st.reloads++; },
    getMarker: async () => st.marker,
    setMarker: async (id) => { st.marker = id; },
    clearMarker: async () => { st.marker = null; },
    active: () => true,
    now: () => st.t,
    ...over,
  };

  return { d, st };
}

describe('메인 도착 때만 적용(2.10)', () => {
  it('켤 때 · 로그인 화면(prefetchUpdate)은 받기만 하고 다시 시작하지 않는다 — 메인에 오면 그때', async () => {
    const { d, st } = fake();
    const m = createMainReady(d);
    await m.prefetchUpdate();
    expect(st.fetches).toBe(1);
    expect(st.reloads).toBe(0);
    expect(m.waitingId()).toBe('new1');
    expect(await m.onMainReady()).toBe('applied');
    expect(st.reloads).toBe(1);
    expect(st.checks).toBe(1);          // 받아 둔 것은 다시 묻지 않는다
    expect(st.marker).toBe('new1');     // 다시 시작 전에 적었다
  });

  it('marker — 다시 뜬 판이 그 id 면 표시를 지우고 다시 시작하지 않는다', async () => {
    const { d, st } = fake({ currentId: 'new1', marker: 'new1', available: false });
    const m = createMainReady(d);
    expect(await m.onMainReady()).toBe('none');
    expect(st.marker).toBeNull();
    expect(st.reloads).toBe(0);
  });

  it('marker — 적용이 안 돼 옛 판으로 떴으면 같은 id 로 다시 시작하지 않는다(반복 방지)', async () => {
    const { d, st } = fake({ currentId: 'cur', marker: 'new1' });
    const m = createMainReady(d);
    expect(await m.onMainReady()).toBe('none');
    expect(st.reloads).toBe(0);
  });

  it('marker 를 못 적으면 다시 시작하지 않는다', async () => {
    const { d, st } = fake({ setMarker: async () => { throw new Error('disk'); } });
    expect(await createMainReady(d).onMainReady()).toBe('none');
    expect(st.reloads).toBe(0);
  });

  it('시간 넘김 — 5초 안에 못 받으면 이번엔 적용하지 않고, 다 받은 뒤 다음 메인 도착 때 적용', async () => {
    const { d, st } = fake({ fetchMs: 40 });
    const m = createMainReady(d, { timeoutMs: 10 });
    expect(await m.onMainReady()).toBe('timeout');
    expect(st.reloads).toBe(0);
    await new Promise((r) => setTimeout(r, 60));
    expect(await m.onMainReady()).toBe('applied');
    expect(st.reloads).toBe(1);
  });

  it('busy(광고 · 뽑기 · 결제) 중엔 미루고, 마지막 사유가 풀리면 적용한다', async () => {
    const { d, st } = fake();
    const m = createMainReady(d);
    await m.prefetchUpdate();
    m.setBusy('ad');
    m.setBusy('draw');
    expect(await m.onMainReady()).toBe('held');
    m.clearBusy('ad');
    await Promise.resolve();
    expect(st.reloads).toBe(0);          // 아직 뽑기 중
    m.clearBusy('draw');
    await new Promise((r) => setTimeout(r, 0));
    expect(st.reloads).toBe(1);
  });

  it('busy 가 풀릴 때 메인이 아니면(atMain 거짓) 적용하지 않는다 — 다음 메인 도착 때', async () => {
    const { d, st } = fake();
    let main = false;
    const m = createMainReady(d, { atMain: () => main });
    await m.prefetchUpdate();
    m.setBusy('signup');
    expect(await m.onMainReady()).toBe('held');
    m.clearBusy('signup');
    await new Promise((r) => setTimeout(r, 0));
    expect(st.reloads).toBe(0);
    main = true;
    expect(await m.onMainReady()).toBe('applied');
  });

  it('marker 를 적는 사이 바빠지면 표시를 지우고 미룬다 — 풀리면 같은 판을 적용', async () => {
    const box: { m?: ReturnType<typeof createMainReady> } = {};
    const { d, st } = fake();
    d.setMarker = async (id) => { st.marker = id; box.m!.setBusy('video'); };
    box.m = createMainReady(d);
    await box.m.prefetchUpdate();
    expect(await box.m.onMainReady()).toBe('held');
    expect(st.marker).toBeNull();
    d.setMarker = async (id) => { st.marker = id; };
    box.m.clearBusy('video');
    await new Promise((r) => setTimeout(r, 0));
    expect(st.reloads).toBe(1);
  });

  it('실패는 조용히 — 묻기 · 받기 · 다시 시작이 던져도 none, 앱은 멀쩡', async () => {
    const a = fake({ check: async () => { throw new Error('net'); } });
    expect(await createMainReady(a.d).onMainReady()).toBe('none');
    const b = fake({ reload: async () => { throw new Error('reload'); } });
    const mb = createMainReady(b.d);
    expect(await mb.onMainReady()).toBe('none');
    expect(mb.isRestarting()).toBe(false);
    const c = fake({ getMarker: async () => { throw new Error('disk'); } });
    expect(await createMainReady(c.d).onMainReady()).toBe('applied');
  });

  it('메인 진입마다 서버를 두드리지 않는다(checkEveryMs) · 새 판이 없으면 none · 꺼진 빌드는 skipped', async () => {
    const { d, st } = fake({ available: false });
    const m = createMainReady(d);
    expect(await m.onMainReady()).toBe('none');
    expect(await m.onMainReady()).toBe('none');
    expect(st.checks).toBe(1);
    st.t += 60_000;
    await m.onMainReady();
    expect(st.checks).toBe(2);
    expect(await createMainReady(fake({ enabled: false }).d).onMainReady()).toBe('skipped');
  });

  it('뒤로 가 있으면 다시 시작하지 않는다 · 같은 판 id 는 새 판이 아니다', async () => {
    const a = fake({ active: () => false });
    const ma = createMainReady(a.d);
    expect(await ma.onMainReady()).toBe('none');
    expect(a.st.reloads).toBe(0);
    const b = fake({ newId: 'cur' });
    expect(await createMainReady(b.d).onMainReady()).toBe('none');
  });
});
