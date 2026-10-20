import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adSlotIndex, applyHomeRows, EMPTY_HOME, fetchHomeConfig, parseHomeResponse, resetHomeConfig, type HomeRow } from './home';
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
    expect(c.rows!.map(r => r.key)).toEqual(['quiz1', 'checkin', 'steps']);
    expect(c.rows![0]).toEqual({ key: 'quiz1', title: '퀴즈1', desc: '', button: '', badge: 'NEW', visible: true, order: 10 });
    expect(Array.from(c.rows![2].title)).toHaveLength(30);
    expect(c.rows![2].visible).toBe(false);
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
