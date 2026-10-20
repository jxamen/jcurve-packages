import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SECTION, parseHub, type Hub } from './load';
import { HUB_STORAGE_KEY, hubInitial, hubReduce, hubStorageUsable, hubView, readStoredHub, saveStoredHub, type HubEvent, type HubState, type HubStorage } from './store';

/** 메모리 저장소 — get/set 모양. 호출 기록을 남긴다 */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: HubStorage & { gets: number; sets: number } = {
    gets: 0, sets: 0,
    async get(key) { storage.gets++; return data.get(key) ?? null; },
    async set(key, value) { storage.sets++; data.set(key, value); },
  };
  return { storage, data };
}
/** 순정 AsyncStorage 와 같은 모양 — getItem/setItem, 메서드가 this 를 쓴다 */
class FakeAsyncStorage {
  private data = new Map<string, string>();
  gets = 0;
  sets = 0;
  async getItem(key: string): Promise<string | null> { this.gets++; return this.data.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.sets++; this.data.set(key, value); }
}

const hubOf = (on: boolean, names: string[] = ['A', 'B'], over: Partial<Hub['section']> = {}): Hub => parseHub({ items: names.map(n => ({ slug: n.toLowerCase(), name: n })), section: { on, title: null, desc: null, ...over } });

describe('1.2.0 저장 — 읽기 · 쓰기(get/set 과 getItem/setItem 둘 다)', () => {
  it('get/set 모양으로 저장하고 그대로 읽는다', async () => {
    const { storage } = memoryStorage();
    const hub = hubOf(true, ['A', 'B'], { title: '함께 쓰면 좋은 앱', desc: '포인트를 더 모아요' });
    await saveStoredHub(storage, hub);
    expect(await readStoredHub(storage)).toEqual(hub);
  });
  it('순정 AsyncStorage 모양(getItem/setItem)도 된다', async () => {
    const as = new FakeAsyncStorage();
    const hub = hubOf(false);
    await saveStoredHub(as, hub);
    expect(as.sets).toBe(1);
    expect(await readStoredHub(as)).toEqual(hub);
  });
  it('「꺼짐(on:false)」도 저장한다 — 다음 켜기부터 처음부터 숨기려고', async () => {
    const { storage } = memoryStorage();
    await saveStoredHub(storage, hubOf(false));
    expect((await readStoredHub(storage))!.section.on).toBe(false);
  });
  it('없음 · 깨진 JSON · 모르는 판 · 너무 큼 · 저장소 오류는 null(첫 설치와 같다)', async () => {
    const bad = (raw: string | null) => readStoredHub(memoryStorage(raw === null ? {} : { [HUB_STORAGE_KEY]: raw }).storage);
    expect(await bad(null)).toBeNull();
    expect(await bad('')).toBeNull();
    expect(await bad('{not json')).toBeNull();
    expect(await bad(JSON.stringify({ v: 2, hub: { items: [], section: { on: false } } }))).toBeNull();
    expect(await bad(JSON.stringify({ v: 1 }))).toBeNull();
    expect(await bad(JSON.stringify({ v: 1, hub: 'x' }))).toBeNull();
    expect(await bad('x'.repeat(100_001))).toBeNull();
    expect(await readStoredHub({ get: async () => { throw new Error('disk'); }, set: async () => undefined })).toBeNull();
    expect(await readStoredHub({ getItem: async () => { throw new Error('disk'); }, setItem: async () => undefined })).toBeNull();
  });
  it('저장값도 서버 응답처럼 거른다 — 칸 설정이 이상하면 켜짐 · 기존 문구', async () => {
    const raw = JSON.stringify({ v: 1, hub: { items: 'x', section: { on: 'maybe', title: 7, desc: '  ' } } });
    const back = await readStoredHub(memoryStorage({ k: raw }).storage, 'k');
    expect(back).toEqual({ items: [], section: DEFAULT_SECTION });
  });
  it('storageKey 로 다른 키를 쓴다 · 쓰기가 실패해도 던지지 않는다', async () => {
    const { storage, data } = memoryStorage();
    await saveStoredHub(storage, hubOf(true), 'app.a');
    expect([...data.keys()]).toEqual(['app.a']);
    expect(await readStoredHub(storage)).toBeNull();
    await saveStoredHub({ set: async () => { throw new Error('full'); }, get: async () => null }, hubOf(true));
    await saveStoredHub({ setItem: async () => { throw new Error('full'); }, getItem: async () => null }, hubOf(true));
  });
  it('둘 다 있으면 get/set 이 먼저 · 모양이 안 맞는 저장소는 안 넘긴 것과 같다', async () => {
    const calls: string[] = [];
    const both = { async get() { calls.push('get'); return null; }, async set() { calls.push('set'); }, async getItem() { calls.push('getItem'); return null; }, async setItem() { calls.push('setItem'); } };
    await readStoredHub(both);
    await saveStoredHub(both, hubOf(true));
    expect(calls).toEqual(['get', 'set']);
    const wrong = [{}, { get: 1, set: 2 }, { getItem: async () => null }, { setItem: async () => undefined }, null, undefined, 'storage', 7] as unknown as HubStorage[];
    for (const w of wrong) {
      expect(hubStorageUsable(w)).toBe(false);
      expect(await readStoredHub(w)).toBeNull();
      await saveStoredHub(w, hubOf(true));
    }
    expect(hubStorageUsable(new FakeAsyncStorage())).toBe(true);
    expect(hubInitial(hubStorageUsable({} as HubStorage)).ready).toBe(true);            // 쓸 수 없는 저장소 때문에 입구를 늦추지 않는다
  });
});

describe('1.2.0 입구가 그려지는 순서 — 저장값 → 서버 응답(hubReduce)', () => {
  const run = (events: HubEvent[], hasStorage = true): HubState => events.reduce(hubReduce, hubInitial(hasStorage));
  const on = hubOf(true);
  const off = hubOf(false);

  it('저장소를 안 쓰면 예전과 같다 — 처음부터 ready, 받기 전 section 기본(켜짐) · items null', () => {
    const s = hubInitial(false);
    expect(hubView(s)).toEqual({ items: null, section: DEFAULT_SECTION, visible: true });
    expect(s.ready).toBe(true);
    const got = hubReduce(s, { type: 'server', hub: off });
    expect(hubView(got)).toMatchObject({ visible: false });
    expect(hubView(got).section.on).toBe(false);
  });
  it('저장소를 쓰면 저장값을 읽기 전에는 숨김(ready=false) — 켜짐/꺼짐을 모르는 채 보였다 사라지지 않는다', () => {
    expect(hubView(hubInitial(true))).toMatchObject({ visible: false });
    expect(hubInitial(true).ready).toBe(false);
  });
  it('저장값이 켜짐이면 서버 응답 전에 입구가 바로 보이고, 저장된 목록도 바로 쓴다', () => {
    const s = run([{ type: 'stored', hub: on }]);
    expect(hubView(s)).toMatchObject({ visible: true });
    expect(hubView(s).items!.map(i => i.name)).toEqual(['A', 'B']);
  });
  it('저장값이 꺼짐이면 서버 응답 전에도 입구는 처음부터 숨김', () => {
    const s = run([{ type: 'stored', hub: off }]);
    expect(hubView(s).visible).toBe(false);
    expect(s.ready).toBe(true);
  });
  it('첫 설치(저장값 없음)는 켜짐 — 저장소 확인 직후 입구가 보인다', () => {
    const s = run([{ type: 'stored', hub: null }]);
    expect(s).toMatchObject({ ready: true, fromStorage: false });
    expect(hubView(s)).toMatchObject({ visible: true, items: null });
  });
  it('서버가 분명히 꺼짐(on:false)이라고 답하면 그때 숨긴다 — 저장값이 켜짐이었어도', () => {
    const s = run([{ type: 'stored', hub: on }, { type: 'server', hub: off }]);
    expect(hubView(s).visible).toBe(false);
    expect(s.fresh).toBe(true);
  });
  it('서버가 켜짐으로 바꿔 답하면 숨겼던 입구가 나타난다', () => {
    const s = run([{ type: 'stored', hub: off }, { type: 'server', hub: on }]);
    expect(hubView(s).visible).toBe(true);
  });
  it('서버가 먼저 오면 늦게 온 저장값은 무시한다', () => {
    const s = run([{ type: 'server', hub: off }, { type: 'stored', hub: on }]);
    expect(hubView(s).visible).toBe(false);
    expect(s.ready).toBe(true);
  });
  it('서버가 실패해도 이미 그린 저장값을 지킨다 — 켜짐이면 입구가 그대로, failed 만 알린다', () => {
    const s = run([{ type: 'stored', hub: on }, { type: 'failed' }]);
    expect(hubView(s)).toMatchObject({ visible: true });
    expect(s.failed).toBe(true);
    expect(run([{ type: 'stored', hub: off }, { type: 'failed' }]).failed).toBe(true);
    expect(hubView(run([{ type: 'stored', hub: off }, { type: 'failed' }])).visible).toBe(false);
  });
  it('서버가 저장값보다 먼저 실패하면 저장값이 도착할 때까지 기다린다', () => {
    const early = run([{ type: 'failed' }]);
    expect(early.ready).toBe(false);
    expect(hubView(hubReduce(early, { type: 'stored', hub: on }))).toMatchObject({ visible: true });
  });
  it('저장소가 응답이 없으면 시간 초과로 첫 설치처럼(켜짐) 그린다 — 입구가 영영 안 뜨지 않는다', () => {
    const t = run([{ type: 'timeout' }]);
    expect(hubView(t)).toMatchObject({ visible: true });
    expect(run([{ type: 'timeout' }, { type: 'server', hub: off }, { type: 'stored', hub: on }]).hub).toBe(off);
    expect(run([{ type: 'stored', hub: off }, { type: 'timeout' }]).hub).toBe(off);          // 이미 ready 면 timeout 은 아무 일도 없다
  });
  it('다시 시도(retry)는 failed 를 풀고, 로더가 없어 실패해도 저장소가 없으면 ready', () => {
    expect(run([{ type: 'failed' }, { type: 'retry' }], false).failed).toBe(false);
    expect(run([{ type: 'failed' }], false)).toMatchObject({ failed: true, ready: true });
  });
  it('저장 → 서버 응답 → 다음 켜기: 마지막 서버 답(꺼짐)으로 처음부터 숨긴다', async () => {
    const { storage } = memoryStorage();
    const load = vi.fn(async () => off);
    const hub = await load();
    await saveStoredHub(storage, hub);                                                    // 훅이 서버 응답 직후 하는 일
    const next = hubReduce(hubInitial(true), { type: 'stored', hub: await readStoredHub(storage) });
    expect(hubView(next).visible).toBe(false);
  });
});
