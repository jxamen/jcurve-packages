import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adSlotIndex, applyHomeRows, composeHomeRows, EMPTY_HOME, fetchHomeConfig, fetchHomeResult, freeItemHomeRow, HOME_STORAGE_KEY, homeInitial, homeReduce, parseHomeResponse, readStoredHome, resetHomeConfig, resolveHomeKeys, saveStoredHome, withFreeItemRow, type HomeEvent, type HomeRow, type HomeState, type HomeStorage } from './home';
import type { BenefitQuickItem } from './BenefitQuickList';

const item = (key: string, over: Partial<BenefitQuickItem> = {}): BenefitQuickItem => ({ key, title: key + ' 제목', subtitle: key + ' 설명', ctaLabel: '가기', icon: 'star', tint: '#EEE', onPress: vi.fn(), ...over });
const row = (key: HomeRow['key'], over: Partial<HomeRow> = {}): HomeRow => ({ key, title: key + ' 서버', desc: '', button: '', badge: '', visible: true, order: 0, ...over });
beforeEach(() => resetHomeConfig());

describe('mission/home 응답 거르기(0.5.0)', () => {
  it('모르는 key · 빈 제목 · 중복 · 배열 아닌 줄은 버리고 order 로 정렬 · 길이 제한', () => {
    const c = parseHomeResponse({ ok: true, rows: [
      { key: 'checkin', title: '출석', order: 20 }, { key: 'quiz1', title: '퀴즈1', order: 10, badge: 'NEW' },
      { key: 'hack', title: 'x' }, { key: 'invite', title: '  ' }, { key: 'checkin', title: '두 번째' }, 'bad',
      { key: 'steps', title: '가'.repeat(40), visible: false, order: 30 },
    ], list: { adAfter: 5, shoppingFirst: true } });
    // 0.4.5: 제목이 비어도 줄은 산다(invite — 자리 번호 order 3 이라 맨 앞)
    expect(c.rows!.map(r => r.key)).toEqual(['invite', 'quiz1', 'checkin', 'steps']);
    expect(c.rows![0]).toEqual({ key: 'invite', title: '', desc: '', button: '', badge: '', visible: true, order: 3 });
    expect(c.rows![1]).toEqual({ key: 'quiz1', title: '퀴즈1', desc: '', button: '', badge: 'NEW', visible: true, order: 10 });
    expect(Array.from(c.rows![3].title)).toHaveLength(30);
    expect(c.rows![3].visible).toBe(false);
    expect(c.list).toEqual({ adAfter: 5, shoppingFirst: true });
  });
  it('설정 없음(rows null) · 깨진 응답 · 이상한 list 값', () => {
    expect(parseHomeResponse({ ok: true, rows: null, list: { adAfter: null, shoppingFirst: null } })).toEqual(EMPTY_HOME);
    expect(parseHomeResponse(null)).toEqual(EMPTY_HOME);
    expect(parseHomeResponse({ ok: false, rows: [] })).toEqual(EMPTY_HOME);
    expect(parseHomeResponse({ ok: true, rows: [], list: { adAfter: 99, shoppingFirst: 'yes' } })).toEqual({ rows: [], list: { adAfter: null, shoppingFirst: null } });
  });
});

describe('fetchHomeConfig', () => {
  it('GET mission/home · 60초 캐시 · 실패면 받아 둔 것 → 없으면 기본', async () => {
    const req = vi.fn(async () => ({ ok: true, rows: [{ key: 'quiz1', title: '퀴즈' }] }));
    const a = await fetchHomeConfig(req, { now: 1000 });
    expect(req).toHaveBeenCalledWith('mission/home', { method: 'GET' });
    await fetchHomeConfig(req, { now: 30_000 });
    expect(req).toHaveBeenCalledTimes(1);
    const bad = vi.fn(async () => { throw new Error('net'); });
    expect(await fetchHomeConfig(bad, { now: 100_000 })).toEqual(a);
    resetHomeConfig();
    expect(await fetchHomeConfig(bad, { now: 200_000 })).toEqual(EMPTY_HOME);
  });
});

describe('applyHomeRows', () => {
  const keys = { bag: 'quiz1', pin: 'quiz2', calendar: 'checkin', ticket: 'lucky_chance' } as const;
  const base = [item('bag'), item('pin'), item('calendar', { done: true }), item('ticket'), item('apphub')];
  it('rows null 이면 그대로', () => {
    expect(applyHomeRows(base, null, keys)).toEqual(base);
  });
  it('서버 순서 · 제목 · 빈 값은 앱 것 · 숨김 · 설정 없는 줄은 뒤에 · onPress · done 은 앱 것', () => {
    const out = applyHomeRows(base, [row('lucky_chance', { title: '행운', button: '뽑기', badge: '광고' }), row('quiz1', { desc: '서버 설명' }), row('checkin', { visible: false })], keys);
    expect(out.map(i => i.key)).toEqual(['ticket', 'bag', 'calendar', 'pin', 'apphub']);
    expect(out[0]).toMatchObject({ title: '행운', ctaLabel: '뽑기', badge: '광고', subtitle: 'ticket 설명', hidden: false });
    expect(out[1]).toMatchObject({ title: 'quiz1 서버', subtitle: '서버 설명', ctaLabel: '가기' });
    expect(out[2]).toMatchObject({ hidden: true, done: true });
    expect(out[0].onPress).toBe(base[3].onPress);
    expect(out[3]).toBe(base[1]);
  });
  it('앱이 숨긴 줄은 서버가 visible 이어도 숨김', () => {
    const out = applyHomeRows([item('bag', { hidden: true })], [row('quiz1')], keys);
    expect(out[0].hidden).toBe(true);
  });
  it('광고 자리 — 보이는 줄 기준 · null 이면 앱 기본', () => {
    const items = [item('a'), item('b', { hidden: true }), item('c')];
    expect(adSlotIndex(items, 5, 1)).toBe(2);
    expect(adSlotIndex(items, null, 1)).toBe(1);
    expect(adSlotIndex(items, null, null)).toBeNull();
    expect(adSlotIndex(items, 0, 3)).toBe(0);
  });
});

describe('0.4.4 — 앱별 서버 home_rows 를 그대로 따른다(순서 · 빼기 · 넣기 · 실패 시 기본)', () => {
  const keys = { bag: 'quiz1', pin: 'quiz2', cal: 'checkin' } as const;
  const base = () => [item('bag'), item('pin'), item('cal'), item('own')];
  const titles = (xs: BenefitQuickItem[]) => xs.filter(i => !i.hidden).map(i => i.key);

  it('순서: home_rows 순서대로 앞에, 서버 key 와 짝이 없는 앱 전용 줄은 그 뒤에 원래 순서로', () => {
    const out = composeHomeRows(base(), [row('checkin'), row('quiz1'), row('quiz2')], keys);
    expect(titles(out)).toEqual(['cal', 'bag', 'pin', 'own']);
    expect(out[0].title).toBe('checkin 서버');                                // 제목은 서버 것
  });

  it('빼기: 서버 key 로 맞춰진 앱 줄이 home_rows 에 없으면 그리지 않고, visible:false 면 숨긴다 — 앱 전용 줄은 영향 없음', () => {
    const out = composeHomeRows(base(), [row('quiz1'), row('quiz2', { visible: false })], keys);
    expect(titles(out)).toEqual(['bag', 'own']);                              // checkin 은 목록에 없어 빠지고, quiz2 는 숨김, 앱 전용 own 은 그대로
    expect(out.some(i => i.key === 'cal')).toBe(false);                       // 아예 만들지 않는다
    expect(out.find(i => i.key === 'pin')!.hidden).toBe(true);
  });

  it('넣기: home_rows 에 있는데 앱 items 에 짝이 없는 key 는 서버 값으로 기본 줄을 만들어 넣고 onRow(key) 를 부른다 — onRow 가 없으면 만들지 않는다', () => {
    const onRow = vi.fn();
    const rows = [row('quiz1'), row('steps', { title: '만보기', desc: '걸으면 받아요', button: '걷기', badge: 'NEW' }), row('invite', { visible: false })];
    const out = composeHomeRows([item('bag'), item('own')], rows, keys, { onRow });
    expect(out.map(i => i.key)).toEqual(['bag', 'steps', 'own']);
    const steps = out[1];
    expect([steps.title, steps.subtitle, steps.ctaLabel, steps.badge]).toEqual(['만보기', '걸으면 받아요', '걷기', 'NEW']);
    steps.onPress();
    expect(onRow).toHaveBeenCalledWith('steps');
    expect(out.some(i => i.key === 'invite')).toBe(false);                    // 보임 false 는 만들지 않는다
    expect(composeHomeRows([item('bag')], rows, keys).map(i => i.key)).toEqual(['bag']);   // onRow 없음 → 그 줄 없음
    expect(composeHomeRows([item('bag')], [row('steps', { desc: '', button: '' })], keys, { onRow }).map(i => i.ctaLabel)).toEqual(['바로가기']);
  });

  it('설정이 없거나(rows null) 실패하면 앱 기본 그대로 — 순서 · 줄 · 제목 모두', () => {
    const items = base();
    expect(composeHomeRows(items, null, keys)).toEqual(items);
    expect(composeHomeRows(items, EMPTY_HOME.rows, keys, { onRow: vi.fn() })).toEqual(items);
  });

  it('누르는 동작 · 완료 · 앱이 숨긴 줄은 앱 것 그대로 — 서버가 바꾸는 것은 제목 · 설명 · 버튼 · 배지 · 보임 · 순서뿐', () => {
    const press = vi.fn();
    const out = composeHomeRows([item('bag', { onPress: press, done: true, hidden: true })], [row('quiz1', { desc: '새 설명', badge: '광고' })], keys);
    expect(out[0].onPress).toBe(press);
    expect(out[0].done).toBe(true);
    expect(out[0].hidden).toBe(true);                                         // 앱이 숨긴 줄은 서버가 보이게 만들지 못한다
    expect([out[0].subtitle, out[0].badge]).toEqual(['새 설명', '광고']);
  });

  it('resolveHomeKeys: homeKeys 가 이기고, 안 적은 줄은 key 가 서버 key 와 같으면 그대로 — 서버 9개 밖의 값은 무시', () => {
    expect(resolveHomeKeys([item('checkin'), item('bag'), item('own')], { bag: 'quiz1' })).toEqual({ checkin: 'checkin', bag: 'quiz1' });
    expect(resolveHomeKeys([item('checkin')], { checkin: 'quiz2' })).toEqual({ checkin: 'quiz2' });
    expect(resolveHomeKeys([item('x')], { x: 'hack' as any })).toEqual({});
  });

  it('free_item 기본 줄: 앱에 없고 onFreeItem 이 있으면 맨 뒤에 「무료 ○○ 받기 · 하루 3번 들르면 ○○ 받기」 — 있으면(맞춤표 기준) 겹치지 않고, onFreeItem 이 없으면 만들지 않는다', () => {
    const go = vi.fn();
    const out = withFreeItemRow([item('bag')], undefined, '양분', go);
    expect(out.map(i => i.key)).toEqual(['bag', 'free_item']);
    expect([out[1].title, out[1].subtitle, out[1].ctaLabel]).toEqual(['무료 양분 받기', '하루 3번 들르면 양분 받기', '받기']);
    out[1].onPress();
    expect(go).toHaveBeenCalledOnce();
    expect(withFreeItemRow([item('bag')], undefined, undefined, go)[1].title).toBe('무료 아이템 받기');
    expect(withFreeItemRow([item('bag')], undefined, '   ', go)[1].title).toBe('무료 아이템 받기');
    expect(withFreeItemRow([item('free_item')], undefined, '양분', go)).toHaveLength(1);                       // key 가 같으면 겹치지 않는다
    expect(withFreeItemRow([item('freeItem')], { freeItem: 'free_item' }, '양분', go)).toHaveLength(1);         // freeItemRow 를 쓰는 앱(맞춤표)
    expect(withFreeItemRow([item('bag')], undefined, '양분', undefined)).toHaveLength(1);                       // onFreeItem 없음 → 줄 없음
    expect(freeItemHomeRow('열매', go).key).toBe('free_item');
  });

  it('free_item 은 서버 home_rows 가 순서 · 보임을 정한다 — 목록에 없으면 빠지고, 있으면 그 자리', () => {
    const go = vi.fn();
    const items = withFreeItemRow([item('bag'), item('cal')], undefined, '양분', go);
    const keys2 = resolveHomeKeys(items, { bag: 'quiz1', cal: 'checkin' });
    expect(composeHomeRows(items, [row('free_item'), row('quiz1'), row('checkin')], keys2).map(i => i.key)).toEqual(['free_item', 'bag', 'cal']);
    expect(composeHomeRows(items, [row('quiz1'), row('checkin')], keys2).map(i => i.key)).toEqual(['bag', 'cal']);            // 서버 목록에 없으면 뺀다
    expect(composeHomeRows(items, [row('quiz1'), row('free_item', { visible: false })], keys2).filter(i => !i.hidden).map(i => i.key)).toEqual(['bag']);
  });
});

describe('0.4.5 — 빈 title = 앱 제목 그대로(동적 제목은 서버 고정 제목이 덮지 않게)', () => {
  const keys = { cal: 'checkin', walk: 'steps', bonus: 'today_missions' } as const;
  it('parseHomeResponse: 빈 문자열 · 칸 없음 · 공백 · 문자열 아님 title 줄도 산다(모르는 key 는 그대로 버림)', () => {
    const c = parseHomeResponse({ ok: true, rows: [
      { key: 'steps', title: '', button: '걷기', order: 1 }, { key: 'today_missions', order: 2 }, { key: 'checkin', title: '  ', order: 3 },
      { key: 'invite', title: ['배열'], order: 4 }, { key: 'quiz1', title: '퀴즈1', order: 5 }, { key: 'hack', title: '', order: 6 },
    ] });
    expect(c.rows!.map(r => r.key)).toEqual(['steps', 'today_missions', 'checkin', 'invite', 'quiz1']);
    expect(c.rows!.map(r => r.title)).toEqual(['', '', '', '', '퀴즈1']);
    expect(c.rows![0].button).toBe('걷기');
  });
  it('composeHomeRows: 서버 title 이 비어 있으면 앱의 동적 제목을 지키고, 적혀 있으면 덮는다 — 설명 · 버튼 · 배지 · 보임 · 순서는 그대로 서버가 정한다', () => {
    const items = [item('walk', { title: '오늘 3,200걸음' }), item('cal', { title: '출석 체크' }), item('bonus', { title: '보너스 2번 더', subtitle: '앱 부제' })];
    const rows = [row('today_missions', { title: '', button: '하기' }), row('steps', { title: '' }), row('checkin', { title: '매일 출석', desc: '10P' })];
    const out = composeHomeRows(items, rows, keys);
    expect(out.map(i => i.key)).toEqual(['bonus', 'walk', 'cal']);
    expect(out[0].title).toBe('보너스 2번 더');                    // 서버 title 이 비어 앱 제목 유지
    expect(out[0].subtitle).toBe('앱 부제');                        // desc 도 비면 앱 부제
    expect(out[0].ctaLabel).toBe('하기');                           // 적힌 버튼은 서버 값
    expect(out[1].title).toBe('오늘 3,200걸음');
    expect(out[2].title).toBe('매일 출석');                         // 적힌 제목은 덮음
    expect(out[2].subtitle).toBe('10P');
  });
  it('composeHomeRows: 앱에 짝이 없어 새로 만드는 줄은 서버 title, 비었으면 key별 기본 제목', () => {
    const onRow = vi.fn();
    const out = composeHomeRows([item('x')], [row('steps', { title: '' }), row('today_missions', { title: '오늘 미션 서버' }), row('lucky_chance', { title: '' })], keys, { onRow });
    expect(out.filter(i => i.key !== 'x').map(i => [i.key, i.title])).toEqual([['steps', '만보기'], ['today_missions', '오늘 미션 서버'], ['lucky_chance', '행운 찬스']]);
    out[0].onPress();
    expect(onRow).toHaveBeenCalledWith('steps');
  });
  it('applyHomeRows(0.5.0 방식)도 빈 title 이면 앱 제목을 둔다', () => {
    const out = applyHomeRows([item('walk', { title: '오늘 1걸음' }), item('cal', { title: '출석' })], [row('steps', { title: '' }), row('checkin', { title: '서버 출석' })], keys);
    expect(out.map(i => i.title)).toEqual(['오늘 1걸음', '서버 출석']);
  });
});


// ── 0.4.6: 마지막으로 받은 서버 목록을 저장해 켤 때 먼저 그린다 ──
/** 메모리 저장소(AsyncStorage 와 같은 모양) — 호출 기록을 남긴다 */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: HomeStorage & { gets: number; sets: number } = {
    gets: 0, sets: 0,
    async get(key) { storage.gets++; return data.get(key) ?? null; },
    async set(key, value) { storage.sets++; data.set(key, value); },
  };
  return { storage, data };
}
const serverRows = (...keys: string[]) => ({ ok: true, rows: keys.map((key, i) => ({ key, title: key + ' 서버', order: i })), list: { adAfter: 3, shoppingFirst: true } });
const flush = () => new Promise<void>(r => setTimeout(r, 0));

describe('0.4.6 저장소 없음 — 예전과 같다', () => {
  it('storage 를 안 넘기면 저장소를 건드리지 않고 값 · 캐시 · 실패 동작이 0.4.5 와 같다', async () => {
    const req = vi.fn(async () => serverRows('quiz1', 'checkin'));
    const r = await fetchHomeResult(req, { now: 1000 });
    expect(r.ok).toBe(true);
    expect(r.value.rows!.map(x => x.key)).toEqual(['quiz1', 'checkin']);
    expect((await fetchHomeConfig(req, { now: 2000 })).rows).toHaveLength(2);     // 60초 캐시
    expect(req).toHaveBeenCalledTimes(1);
    expect(await readStoredHome(undefined)).toBeNull();
    await saveStoredHome(undefined, r.value);                                        // 던지지 않는다
  });
  it('저장소가 없으면 처음부터 ready — 서버 실패면 받아 둔 것 → 없으면 앱 기본', () => {
    let s = homeInitial(false);
    expect(s).toMatchObject({ ready: true, fresh: false, config: EMPTY_HOME });
    s = homeReduce(s, { type: 'server', value: EMPTY_HOME, ok: false });
    expect(s).toMatchObject({ ready: true, config: EMPTY_HOME });
    const cfg = parseHomeResponse(serverRows('quiz1'));
    s = homeReduce(s, { type: 'server', value: cfg, ok: true });
    expect(s.config).toBe(cfg);
    expect(s.fresh).toBe(true);
  });
});

describe('0.4.6 저장 있음 — 읽기', () => {
  it('저장해 둔 마지막 목록을 그대로 읽는다(다시 거른 값)', async () => {
    const { storage } = memoryStorage();
    const cfg = parseHomeResponse({ ...serverRows('steps', 'quiz1', 'invite'), rows: [{ key: 'steps', title: '', desc: '만보기 설명', order: 0 }, { key: 'quiz1', title: '퀴즈', order: 1, visible: false }, { key: 'invite', title: '초대', badge: 'NEW', order: 2 }] });
    await saveStoredHome(storage, cfg);
    const back = await readStoredHome(storage);
    expect(back).toEqual(cfg);
    expect(back!.rows![0].title).toBe('');                                            // 빈 제목(앱 제목 유지)도 그대로
    expect(back!.rows![1].visible).toBe(false);
    expect(back!.list).toEqual({ adAfter: 3, shoppingFirst: true });
  });
  it('서버가 「설정 없음」(rows null)이라고 정상으로 답한 것도 저장한다 — 옛 순서가 되살아나지 않게', async () => {
    const { storage } = memoryStorage();
    await saveStoredHome(storage, parseHomeResponse({ ok: true, rows: null, list: { adAfter: null, shoppingFirst: null } }));
    expect(await readStoredHome(storage)).toEqual({ rows: null, list: { adAfter: null, shoppingFirst: null } });
  });
  it('없음 · 깨진 JSON · 모르는 판 · 너무 큼 · 저장소 오류는 모두 null(앱 기본)', async () => {
    const bad = (raw: string | null) => readStoredHome(memoryStorage(raw === null ? {} : { [HOME_STORAGE_KEY]: raw }).storage);
    expect(await bad(null)).toBeNull();
    expect(await bad('')).toBeNull();
    expect(await bad('{not json')).toBeNull();
    expect(await bad(JSON.stringify({ v: 2, response: serverRows('quiz1') }))).toBeNull();
    expect(await bad(JSON.stringify({ v: 1, response: { ok: false } }))).toBeNull();
    expect(await bad(JSON.stringify({ v: 1 }))).toBeNull();
    expect(await bad('x'.repeat(20_001))).toBeNull();
    const throwing: HomeStorage = { get: async () => { throw new Error('disk'); }, set: async () => { throw new Error('disk'); } };
    expect(await readStoredHome(throwing)).toBeNull();
  });
  it('저장값도 서버 응답처럼 거른다 — 모르는 key · 중복은 버리고 길이를 자른다', async () => {
    const raw = JSON.stringify({ v: 1, response: { ok: true, rows: [{ key: 'hack', title: 'x' }, { key: 'quiz1', title: '가'.repeat(60) }, { key: 'quiz1', title: '두 번째' }], list: { adAfter: 999 } } });
    const back = await readStoredHome(memoryStorage({ 'my.key': raw }).storage, 'my.key');
    expect(back!.rows!.map(r => r.key)).toEqual(['quiz1']);
    expect(Array.from(back!.rows![0].title)).toHaveLength(30);
    expect(back!.list.adAfter).toBeNull();
  });
  it('storageKey 로 다른 키를 쓴다', async () => {
    const { storage, data } = memoryStorage();
    await saveStoredHome(storage, parseHomeResponse(serverRows('quiz1')), 'app.a');
    expect([...data.keys()]).toEqual(['app.a']);
    expect(await readStoredHome(storage)).toBeNull();                                 // 기본 키에는 없다
    expect(await readStoredHome(storage, 'app.a')).not.toBeNull();
  });
});

describe('0.4.6 서버 갱신 — 저장', () => {
  it('정상 응답이면 저장한다(마지막 응답으로 덮는다) · 캐시 적중은 다시 저장하지 않는다', async () => {
    const { storage, data } = memoryStorage();
    const req = vi.fn(async () => serverRows('quiz1', 'steps'));
    const r = await fetchHomeResult(req, { now: 1000, storage });
    await flush();
    expect(r.ok).toBe(true);
    expect(storage.sets).toBe(1);
    expect((await readStoredHome(storage))!.rows!.map(x => x.key)).toEqual(['quiz1', 'steps']);
    await fetchHomeResult(req, { now: 2000, storage });                               // 60초 안 — 캐시
    await flush();
    expect(storage.sets).toBe(1);
    req.mockImplementation(async () => serverRows('steps', 'quiz1'));                   // 서버 순서가 바뀜
    await fetchHomeResult(req, { now: 100_000, storage });
    await flush();
    expect(storage.sets).toBe(2);
    expect((await readStoredHome(storage))!.rows!.map(x => x.key)).toEqual(['steps', 'quiz1']);
    expect(data.size).toBe(1);
  });
  it('서버가 실패하거나 깨진 응답이면 저장하지 않고(저장값 유지) ok:false', async () => {
    const { storage } = memoryStorage();
    await saveStoredHome(storage, parseHomeResponse(serverRows('checkin')));
    const before = storage.sets;
    const failing = await fetchHomeResult(vi.fn(async () => { throw new Error('net'); }), { now: 1000, storage });
    expect(failing).toEqual({ value: EMPTY_HOME, ok: false });
    resetHomeConfig();
    const broken = await fetchHomeResult(vi.fn(async () => ({ ok: false })), { now: 1000, storage });
    expect(broken.ok).toBe(false);
    await flush();
    expect(storage.sets).toBe(before);
    expect((await readStoredHome(storage))!.rows!.map(x => x.key)).toEqual(['checkin']);
  });
  it('저장소 쓰기가 실패해도 목록은 그대로 돌아온다', async () => {
    const storage: HomeStorage = { get: async () => null, set: async () => { throw new Error('full'); } };
    const r = await fetchHomeResult(vi.fn(async () => serverRows('quiz1')), { now: 1000, storage });
    expect(r.ok).toBe(true);
    expect(r.value.rows).toHaveLength(1);
  });
});

describe('0.4.6 켜는 순서 — 저장값 → 서버 응답(homeReduce)', () => {
  const stored = parseHomeResponse(serverRows('steps', 'quiz1'));
  const server = parseHomeResponse(serverRows('quiz1', 'steps', 'invite'));
  const run = (events: HomeEvent[], hasStorage = true): HomeState => events.reduce(homeReduce, homeInitial(hasStorage));

  it('저장소를 쓰면 저장값을 읽기 전에는 ready=false(그리지 않음) — 앱 기본 순서를 잠깐 그리지 않는다', () => {
    expect(homeInitial(true)).toMatchObject({ ready: false, config: EMPTY_HOME });
  });
  it('저장값이 있으면 처음 그릴 때부터 서버 순서, 서버 응답이 오면 갱신', () => {
    const afterStored = run([{ type: 'stored', config: stored }]);
    expect(afterStored).toMatchObject({ ready: true, fresh: false, fromStorage: true });
    expect(afterStored.config.rows!.map(r => r.key)).toEqual(['steps', 'quiz1']);   // 앱 기본이 아니라 마지막 서버 순서로 첫 그림
    const afterServer = homeReduce(afterStored, { type: 'server', value: server, ok: true });
    expect(afterServer.config.rows!.map(r => r.key)).toEqual(['quiz1', 'steps', 'invite']);
    expect(afterServer.fresh).toBe(true);
  });
  it('첫 설치(저장값 없음)는 저장소 확인 직후 앱 기본으로 그리고, 서버 응답으로 갱신', () => {
    const s = run([{ type: 'stored', config: null }]);
    expect(s).toMatchObject({ ready: true, fromStorage: false, config: EMPTY_HOME });
    expect(homeReduce(s, { type: 'server', value: server, ok: true }).config).toBe(server);
  });
  it('서버가 먼저 오면 늦게 온 저장값은 무시한다', () => {
    const s = run([{ type: 'server', value: server, ok: true }, { type: 'stored', config: stored }]);
    expect(s.config).toBe(server);
    expect(s).toMatchObject({ ready: true, fresh: true });
  });
  it('서버가 실패해도 이미 그린 저장값을 지킨다(앱 기본으로 되돌아가지 않는다)', () => {
    const s = run([{ type: 'stored', config: stored }, { type: 'server', value: EMPTY_HOME, ok: false }]);
    expect(s.config).toBe(stored);
    expect(s.fromStorage).toBe(true);
  });
  it('서버가 저장값보다 먼저 실패하면 저장값이 도착한 뒤 저장값을 쓴다', () => {
    const early = run([{ type: 'server', value: EMPTY_HOME, ok: false }]);
    expect(early.ready).toBe(false);                                                   // 저장값을 기다린다
    const s = homeReduce(early, { type: 'stored', config: stored });
    expect(s.config).toBe(stored);
    expect(s.ready).toBe(true);
  });
  it('저장소가 응답이 없으면 시간 초과로 앱 기본을 그린다 — 목록이 영영 안 뜨지 않는다. 늦게 온 저장값도 서버보다 앞서지 않는다', () => {
    const t = run([{ type: 'timeout' }]);
    expect(t).toMatchObject({ ready: true, config: EMPTY_HOME });
    expect(homeReduce(t, { type: 'stored', config: stored }).config).toBe(stored);        // 아직 서버 전이면 저장값으로
    const withServer = run([{ type: 'timeout' }, { type: 'server', value: server, ok: true }, { type: 'stored', config: stored }]);
    expect(withServer.config).toBe(server);
    expect(run([{ type: 'stored', config: stored }, { type: 'timeout' }]).config).toBe(stored);     // 이미 ready 면 timeout 은 아무 일도 없다
  });
  it('저장 → 서버 갱신 → 다음 켜기: 마지막으로 받은 순서로 첫 그림', async () => {
    const { storage } = memoryStorage();
    await fetchHomeResult(vi.fn(async () => serverRows('invite', 'steps')), { now: 1000, storage });
    await flush();
    resetHomeConfig();                                                                   // 앱을 껐다 켬(메모리 캐시 없음)
    const items = [item('steps'), item('invite'), item('quiz1')];
    const first = homeReduce(homeInitial(true), { type: 'stored', config: await readStoredHome(storage) });
    const drawn = composeHomeRows(items, first.config.rows, resolveHomeKeys(items), {});
    expect(drawn.map(i => i.key)).toEqual(['invite', 'steps']);                          // 마지막 서버 순서로 첫 그림 — quiz1 은 서버 목록에 없어 빠진다
    const baseline = composeHomeRows(items, null, resolveHomeKeys(items), {});
    expect(baseline.map(i => i.key)).toEqual(['steps', 'invite', 'quiz1']);              // 저장값이 없으면 앱 기본 순서
  });
});
