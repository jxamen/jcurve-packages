import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { CHECKIN_DONE_LABEL, FREE_DONE_LABEL, FREE_NOW_BADGE, HOME_ORDER, STEPS_PERMISSION_LABEL, buildHomeItems, homeItem, homeRowOff, homeRowRemoteKey, type HomeActions } from './homeDefs';
import { HOME_KEYS, composeHomeRows, resolveHomeKeys, type HomeRow } from './home';

/** 당근 기준표(ota/carrot-ios-106-benefit-1020 814f2f4, FarmScreen HOME_BENEFITS + theme.ts carrotSoft #FFEEE2 · heartSoft #E6F5EA) — 대표님 10-20 20:23 「갖다 넣으면 똑같은 게 그냥 튀어 나와야」 */
const CARROT = {
  quiz1: { title: '쇼핑 태그 퀴즈1', subtitle: '참여하고 최대 100P 받기', ctaLabel: '참여하기', icon: 'bag', tint: '#FDEBE2' },
  quiz2: { title: '플레이스 & 쇼핑 태그 퀴즈2', subtitle: '참여하고 최대 100P 받기', ctaLabel: '참여하기', icon: 'pin', tint: '#E4F3EA' },
  checkin: { title: '매일 출석 체크', subtitle: '10초 구경하고 포인트 받기', ctaLabel: '출석하기', icon: 'calendar', tint: '#E8F0FD' },
  steps: { title: '만보기', subtitle: '오늘 걸음으로 포인트 받기', ctaLabel: '보상 받기', icon: '👟', tint: '#FFEEE2' },
  free_item: { title: '무료 포인트 받기', subtitle: '하루 3번 들르면 포인트 받기', ctaLabel: '받기', icon: '🌱', tint: '#E6F5EA' },
  // 당근에는 없는 줄 — 10앱 합집합(대표님 10-21 07:07 「빠진 줄 없는 전체 목록」), 문구는 대표님 확정
  ad_item: { title: '광고 보고 포인트 받기', subtitle: '짧은 광고를 보면 포인트를 더 드려요', ctaLabel: '광고 보기', icon: '🌱', tint: '#E6F5EA' },
  today_missions: { title: '오늘의 미션', subtitle: '간단한 미션으로 포인트 더 받기', ctaLabel: '보러가기', icon: 'star', tint: '#FBF1DC' },
  lucky_chance: { title: '행운 찬스', subtitle: '하루 기회로 포인트 뽑기', ctaLabel: '뽑기', icon: 'ticket', tint: '#EFE8FB' },
  invite: { title: '친구 초대하기', subtitle: '친구가 가입하면 같이 받기', ctaLabel: '초대하기', icon: 'friend', tint: '#FDEBDD' },
  recommend: { title: '추천 앱 둘러보기', subtitle: '추천 앱 둘러보기', ctaLabel: '보러가기', icon: 'star', tint: '#FFEEE2' },
} as const;

const all = (): HomeActions => Object.fromEntries(HOME_ORDER.map(k => [k, vi.fn()])) as HomeActions;

describe('줄 정의 = 당근 기준 (0.7.5)', () => {
  it('10줄 제목 · 부제 · 버튼 · 아이콘 · 바탕색이 당근 표와 글자까지 같다(이름은 기본값 「포인트」)', () => {
    const items = buildHomeItems({}, all());
    expect(items).toHaveLength(10);
    for (const it of items) {
      const want = CARROT[it.key as keyof typeof CARROT];
      expect({ title: it.title, subtitle: it.subtitle, ctaLabel: it.ctaLabel, icon: it.icon, tint: it.tint }).toEqual(want);
    }
  });

  it('순서는 서버 home_rows 기본 순서(HOME_KEYS)와 같고, 줄 key 가 서버 key 라 맞춤표가 필요 없다', () => {
    expect([...HOME_ORDER]).toEqual([...HOME_KEYS]);
    expect(buildHomeItems({}, all()).map(i => i.key)).toEqual([...HOME_KEYS]);
  });

  it('줄마다 누르면 자기 동작을 부른다', () => {
    const a = all();
    const items = buildHomeItems({}, a);
    items.find(i => i.key === 'lucky_chance')!.onPress();
    expect(a.lucky_chance).toHaveBeenCalledOnce();
    expect(a.quiz1).not.toHaveBeenCalled();
  });

  it('앱이 넘기는 것은 이름 · 값뿐 — 아이템 이름은 무료 · 행운 찬스 글자에, 포인트 이름은 포인트 글자에, 단위는 「최대 100○」에', () => {
    const ctx = { itemName: '감자', pointName: '캐시', pointUnit: '원' };
    const byKey = Object.fromEntries(buildHomeItems(ctx, all()).map(i => [i.key, i]));
    expect(byKey.free_item.title).toBe('무료 감자 받기');
    expect(byKey.free_item.subtitle).toBe('하루 3번 들르면 감자 받기');
    expect(byKey.lucky_chance.subtitle).toBe('하루 기회로 감자 뽑기');
    expect(byKey.checkin.subtitle).toBe('10초 구경하고 캐시 받기');
    expect(byKey.steps.subtitle).toBe('오늘 걸음으로 캐시 받기');
    expect(byKey.today_missions.subtitle).toBe('간단한 미션으로 캐시 더 받기');
    expect(byKey.quiz1.subtitle).toBe('참여하고 최대 100원 받기');
    expect(buildHomeItems({ itemName: '  ', pointName: '' }, all()).find(i => i.key === 'free_item')!.title).toBe('무료 포인트 받기');     // 빈 이름은 기본 「포인트」
  });

  it('앱 테마색을 따르는 걸음 · 무료 · 광고 · 추천 네 줄만 바탕색(tints)을 앱이 넘길 수 있다 — 나머지 줄은 넘겨도 고정', () => {
    const items = buildHomeItems({ tints: { steps: '#112233', free_item: '#445566', ad_item: '#AABBCC', recommend: '#778899', quiz1: '#000000' } as any }, all());
    const tint = (k: string) => items.find(i => i.key === k)!.tint;
    expect([tint('steps'), tint('free_item'), tint('ad_item'), tint('recommend')]).toEqual(['#112233', '#445566', '#AABBCC', '#778899']);
    expect([tint('quiz1'), tint('quiz2'), tint('checkin'), tint('today_missions'), tint('lucky_chance'), tint('invite')]).toEqual(['#FDEBE2', '#E4F3EA', '#E8F0FD', '#FBF1DC', '#EFE8FB', '#FDEBDD']);
    const blank = buildHomeItems({ tints: { steps: '  ', free_item: '' } }, all());          // 빈 값은 당근 기본
    expect([blank.find(i => i.key === 'steps')!.tint, blank.find(i => i.key === 'free_item')!.tint]).toEqual(['#FFEEE2', '#E6F5EA']);
  });

  it('앱이 아이콘 · 바탕색 · 부제 · 숨김을 덮어쓰지 못한다 — 넘겨도 무시된다', () => {
    const sneaky = { icon: 'friend', tint: '#000', subtitle: '내 부제', hidden: true, ctaLabel: '내 버튼' } as any;
    const items = buildHomeItems(sneaky, all());
    for (const it of items) {
      const want = CARROT[it.key as keyof typeof CARROT];
      expect([it.icon, it.tint, it.ctaLabel, it.hidden]).toEqual([want.icon, want.tint, want.ctaLabel, undefined]);
    }
    expect(items.find(i => i.key === 'quiz1')!.subtitle).toBe('참여하고 최대 100P 받기');
  });
});

describe('줄별 값 — 걸음 · 무료 아이템 · 오늘의 미션 · 추천 앱', () => {
  it('만보기: 걸음 수를 모르면 「만보기」, 알면 「오늘 N걸음」(천 단위 쉼표), 0 도 「오늘 0걸음」', () => {
    const t = (steps?: number | null) => homeItem('steps', { steps }, () => {}).title;
    expect([t(), t(null), t(0), t(12345), t(-5)]).toEqual(['만보기', '만보기', '오늘 0걸음', '오늘 12,345걸음', '오늘 0걸음']);
  });

  it('무료 아이템: 값이 없으면 막대 없이 「받기」 · 완료 글자는 「내일 다시」(방문형) · 아이템 그림은 앱 것', () => {
    const r = homeItem('free_item', { itemName: '먹이' }, () => {});
    expect([r.done, r.progress, r.progressLabel, r.doneLabel, r.icon]).toEqual([undefined, undefined, undefined, FREE_DONE_LABEL, '🌱']);
    expect(FREE_DONE_LABEL).toBe('내일 다시');
    expect(homeItem('free_item', { itemIcon: 'ticket' }, () => {}).icon).toBe('ticket');
  });

  it('무료 아이템: 놓친 칸이 있어도 막대는 받은 횟수만큼 — 저녁 1번만 받으면 1칸 · 「오늘 1번 받았어요」 · 완료', () => {
    const r = (free: { total?: number; left?: number; received?: number }) => homeItem('free_item', { free }, () => {});
    const missed = r({ left: 0, received: 1 });
    expect([missed.done, missed.progress, missed.progressLabel]).toEqual([true, { done: 1, total: 3 }, '오늘 1번 받았어요']);
    expect(r({ left: 0, received: 3 }).progressLabel).toBe('오늘 다 받았어요');
    expect(r({ left: 0, received: 0 }).progressLabel).toBe('오늘은 시간이 지났어요');
    const open = r({ left: 2, received: 1 });
    expect([open.done, open.progress, open.progressLabel]).toEqual([false, { done: 1, total: 3 }, '2번 남았어요']);
    expect(r({ left: 2 })).toMatchObject({ done: false, progress: { done: 1, total: 3 }, progressLabel: '2번 남았어요' });      // received 없으면 예전 계산
    expect(r({ total: 5, left: 0, received: 4 }).subtitle).toBe('하루 5번 들르면 포인트 받기');
    expect(r({ total: 5, left: 0, received: 4 }).progress).toEqual({ done: 4, total: 5 });
  });

  it('오늘의 미션: 앱의 동적 제목 · 막대를 받는다(서버 제목이 비면 이것이 보인다) · 추천 앱: 서버 부제 · 캐릭터 그림', () => {
    const m = homeItem('today_missions', { todayMissions: { title: '보너스 +30P', progress: { done: 1, total: 3 }, progressLabel: '2개 남았어요' } }, () => {});
    expect([m.title, m.progress, m.progressLabel, m.icon]).toEqual(['보너스 +30P', { done: 1, total: 3 }, '2개 남았어요', 'star']);
    const rec = homeItem('recommend', { recommend: { desc: '이달의 추천', icon: 'friend' } }, () => {});
    expect([rec.subtitle, rec.icon]).toEqual(['이달의 추천', 'friend']);
    expect(homeItem('recommend', { recommend: { desc: '  ' } }, () => {}).subtitle).toBe('추천 앱 둘러보기');
  });
});

describe('서버 home_rows 와 함께 — 서버는 글자 · 보임 · 순서만 덮고 아이콘 · 바탕색은 패키지 정의', () => {
  const row = (key: string, over: Partial<HomeRow> = {}, order = 0): HomeRow => ({ key: key as HomeRow['key'], title: key + ' 서버', desc: '', button: '', badge: '', visible: true, order, ...over });

  it('서버 순서 · 제목 · 설명 · 버튼 · 배지가 얹히고 아이콘 · 바탕색 · 완료 글자는 그대로 — keepUnlisted 가 아니면 서버 목록이 곧 목록(예전 items 방식 규칙)', () => {
    const base = buildHomeItems({}, all());
    const rows = [row('checkin', { desc: '서버 부제', button: '체크', badge: 'NEW' }, 0), row('quiz1', {}, 1), row('recommend', {}, 2), row('free_item', { title: '' }, 3)];
    const out = composeHomeRows(base, rows, resolveHomeKeys(base, undefined));
    expect(out.map(i => i.key)).toEqual(['checkin', 'quiz1', 'recommend', 'free_item']);      // 목록에 없는 줄(quiz2 · 걸음 …)은 빠진다
    const c = out[0];
    expect([c.title, c.subtitle, c.ctaLabel, c.badge]).toEqual(['checkin 서버', '서버 부제', '체크', 'NEW']);
    expect([c.icon, c.tint]).toEqual(['calendar', '#E8F0FD']);                  // 서버가 아이콘 · 바탕색을 못 바꾼다
    const f = out.find(i => i.key === 'free_item')!;
    expect([f.title, f.doneLabel, f.icon]).toEqual(['무료 포인트 받기', '내일 다시', '🌱']);       // 빈 서버 제목 = 패키지 제목 유지
  });

  it('keepUnlisted(homeActions 방식): 서버 목록에 없다고 줄을 빼지 않고 패키지 기본 자리에 둔다 — 글자 · 순서 · visible:false 덮기만 유지 (0.7.13)', () => {
    const base = buildHomeItems({}, all());
    const keys = resolveHomeKeys(base, undefined);
    const listed = ['quiz1', 'quiz2', 'checkin', 'free_item', 'today_missions', 'lucky_chance', 'invite', 'recommend'];       // 걸음 · 광고 아이템은 서버 목록에 없다
    const out = composeHomeRows(base, listed.map((k, i) => row(k, {}, i)), keys, { keepUnlisted: true });
    expect(out.map(i => i.key)).toEqual([...HOME_KEYS]);                         // 걸음은 출석 뒤, 광고 아이템은 무료 뒤 — 기본 자리
    // visible:false 는 여전히 숨긴다
    const hidden = composeHomeRows(base, listed.map((k, i) => row(k, k === 'invite' ? { visible: false } : {}, i)), keys, { keepUnlisted: true });
    expect(hidden.find(i => i.key === 'invite')!.hidden).toBe(true);
    expect(hidden.filter(i => !i.hidden)).toHaveLength(9);
    // 서버가 순서를 바꾸면 그 순서를 따르고 나머지는 기본 자리에 끼운다 — 줄은 하나도 안 빠진다
    const reorder = composeHomeRows(base, [row('lucky_chance', {}, 0), row('quiz1', {}, 1)], keys, { keepUnlisted: true });
    expect(reorder).toHaveLength(10);
    const at = (k: string) => reorder.map(i => i.key).indexOf(k);
    expect(at('lucky_chance')).toBeLessThan(at('quiz1'));
    expect(at('ad_item')).toBe(at('free_item') + 1);
    expect(composeHomeRows(base, [], keys, { keepUnlisted: true }).map(i => i.key)).toEqual([...HOME_KEYS]);   // 빈 설정 = 기본 순서
    expect(composeHomeRows(base, null, keys, { keepUnlisted: true })).toEqual(base);
  });

  it('서버 설정이 없거나(null) 실패하면 패키지 정의 그대로', () => {
    const base = buildHomeItems({}, all());
    expect(composeHomeRows(base, null, resolveHomeKeys(base, undefined))).toEqual(base);
  });
});

describe('원격설정으로 줄 숨기기/보이기 — home.row.<줄id> (0.7.13, 대표님 10-21 07:08 「어드민에서 넣고 빼고」)', () => {
  const hiddenKeys = (values?: Record<string, unknown>) => buildHomeItems({}, all(), values).filter(i => i.hidden).map(i => i.key);

  it('키 이름은 home.row.<줄id> — 줄은 10개(광고 아이템 ad_item 은 무료 다음)', () => {
    expect(HOME_ORDER.map(homeRowRemoteKey)).toEqual([
      'home.row.quiz1', 'home.row.quiz2', 'home.row.checkin', 'home.row.steps', 'home.row.free_item',
      'home.row.ad_item', 'home.row.today_missions', 'home.row.lucky_chance', 'home.row.invite', 'home.row.recommend',
    ]);
    expect(HOME_ORDER).toHaveLength(10);
  });

  it('값을 안 넘기면(remoteValues 없음) 어떤 줄도 숨기지 않는다 — 앱의 기존 게이팅 그대로', () => {
    expect(hiddenKeys(undefined)).toEqual([]);
    expect(homeRowOff('steps', undefined)).toBe(false);
  });

  it('줄마다 따로 숨긴다 — 그 줄만, 다른 줄은 그대로(걸음 줄은 steps.on 이 켜져 있어도 home.row.steps 가 꺼지면 숨김)', () => {
    for (const key of HOME_ORDER) {
      expect(hiddenKeys({ 'steps.on': '1', [homeRowRemoteKey(key)]: '0' }), key).toEqual([key]);
    }
  });

  it('끄는 값은 \'0\' · \'false\'(대소문자·공백 무시) · false · 0 — 값이 없거나 그 밖의 값은 켜짐', () => {
    for (const off of ['0', 'false', 'FALSE', ' 0 ', false, 0]) expect(hiddenKeys({ 'steps.on': '1', 'home.row.free_item': off }), String(off)).toEqual(['free_item']);
    for (const on of ['1', 'true', '', undefined, null, 'yes', 'maybe', 2]) expect(hiddenKeys({ 'steps.on': '1', 'home.row.free_item': on }), String(on)).toEqual([]);
  });

  it('걸음 줄은 기존 키 steps.on 을 존중 — \'1\' / \'true\' 일 때만 보이고 없음 · 그 밖은 숨김(지금 당근 규칙). 값 맵을 안 넘기면 적용하지 않는다', () => {
    expect(hiddenKeys({})).toEqual(['steps']);                                                 // 맵은 넘겼는데 steps.on 이 없다
    for (const on of ['1', 'true', ' TRUE ', true, 1]) expect(hiddenKeys({ 'steps.on': on }), String(on)).toEqual([]);
    for (const off of ['0', 'false', '', 'no', false, 0, null]) expect(hiddenKeys({ 'steps.on': off }), String(off)).toEqual(['steps']);
  });

  it('숨긴 줄도 목록에 남아 hidden:true 로 표시된다 — 서버 home_rows 합치기 뒤에도 유지', () => {
    const base = buildHomeItems({}, all(), { 'steps.on': '1', 'home.row.invite': '0' });
    expect(base).toHaveLength(10);
    expect(base.find(i => i.key === 'invite')!.hidden).toBe(true);
    const merged = composeHomeRows(base, [HOME_KEYS.map((k, i) => ({ key: k, title: k + ' 서버', desc: '', button: '', badge: '', visible: true, order: i }) as HomeRow)].flat(), resolveHomeKeys(base, undefined), { keepUnlisted: true });
    expect(merged.find(i => i.key === 'invite')!.hidden).toBe(true);
    expect(merged.filter(i => !i.hidden)).toHaveLength(9);
  });
});

describe('광고 보고 아이템 받기 줄(ad_item) — 문구는 대표님 확정(10-21 07:2x)', () => {
  const ad = (ctx: Parameters<typeof homeItem>[1] = {}) => homeItem('ad_item', ctx, () => {});

  it('기본 문구: 제목 「광고 보고 ○○ 받기」 · 부제 「짧은 광고를 보면 ○○을/를 더 드려요」 · 버튼 「광고 보기」', () => {
    const a = ad();
    expect([a.title, a.subtitle, a.ctaLabel]).toEqual(['광고 보고 포인트 받기', '짧은 광고를 보면 포인트를 더 드려요', '광고 보기']);
  });

  it('아이템 이름이 들어가고 조사는 받침으로 고른다 — 맘마를 · 양분을 · 모이를 · 한글이 아니면 을(를)', () => {
    const sub = (itemName: string) => ad({ itemName }).subtitle;
    expect([sub('맘마'), sub('양분'), sub('모이'), sub('캡슐'), sub('coin')]).toEqual([
      '짧은 광고를 보면 맘마를 더 드려요', '짧은 광고를 보면 양분을 더 드려요', '짧은 광고를 보면 모이를 더 드려요', '짧은 광고를 보면 캡슐을 더 드려요', '짧은 광고를 보면 coin을(를) 더 드려요',
    ]);
    expect(ad({ itemName: '맘마' }).title).toBe('광고 보고 맘마 받기');
  });

  it('아이콘은 앱 아이템 그림(없으면 🌱), 바탕색은 기본 연초록 — 앱 테마색(tints.ad_item)이 있으면 그것이 우선', () => {
    expect([ad().icon, ad().tint]).toEqual(['🌱', '#E6F5EA']);
    expect(ad({ itemIcon: 'star', tints: { ad_item: '#123456' } }).icon).toBe('star');
    expect(ad({ tints: { ad_item: '#123456' } }).tint).toBe('#123456');
    expect(ad({ tints: { ad_item: '  ' } }).tint).toBe('#E6F5EA');
  });

  it('무료 아이템 줄 바로 뒤에 있고, 누르면 자기 동작을 부른다', () => {
    const a = all();
    const items = buildHomeItems({}, a);
    const keys = items.map(i => i.key);
    expect(keys.indexOf('ad_item')).toBe(keys.indexOf('free_item') + 1);
    items.find(i => i.key === 'ad_item')!.onPress();
    expect(a.ad_item).toHaveBeenCalledOnce();
    expect(a.free_item).not.toHaveBeenCalled();
  });
});

describe('줄은 앱에서 빠지지 않는다 — 동작이 빠져도 그려진다 (0.7.13)', () => {
  it('동작을 하나도 안 넘겨도 10줄이 모두 만들어지고 누름은 아무 일도 안 한다(던지지 않는다)', () => {
    const items = buildHomeItems({}, {});
    expect(items.map(i => i.key)).toEqual([...HOME_ORDER]);
    expect(() => items.forEach(i => i.onPress())).not.toThrow();
    const noFn = buildHomeItems({}, { invite: undefined, lucky_chance: 'x' } as unknown as Partial<HomeActions>);
    expect(noFn).toHaveLength(10);                                                              // 함수가 아니어도 줄은 만든다
  });

  it('개발 중에는 빠진 동작마다 경고를 한 번만 낸다(운영에서는 조용)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    try {
      buildHomeItems({}, { quiz1: vi.fn() });
      expect(warn).toHaveBeenCalledTimes(9);                                                    // quiz1 만 넘겼다
      buildHomeItems({}, { quiz1: vi.fn() });
      expect(warn).toHaveBeenCalledTimes(9);                                                    // 같은 줄은 다시 안 낸다
      expect(String(warn.mock.calls[0][0])).toContain('homeActions.');
    } finally {
      delete (globalThis as { __DEV__?: boolean }).__DEV__;
      warn.mockRestore();
    }
    const quiet = vi.spyOn(console, 'warn').mockImplementation(() => {});
    buildHomeItems({}, {});
    expect(quiet).not.toHaveBeenCalled();
    quiet.mockRestore();
  });
});

describe('순수성 — react / react-native 를 가져오지 않는다(0.4.x 로 파일 그대로 옮길 수 있게)', () => {
  it('homeDefs.ts 의 import 는 타입 전용뿐', () => {
    const src = readFileSync(fileURLToPath(new URL('./homeDefs.ts', import.meta.url)), 'utf-8');
    const imports = src.split(/\r?\n/).filter(l => /^\s*import\b/.test(l));
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every(l => /^\s*import type\b/.test(l))).toBe(true);
    expect(imports.some(l => /['"]react(-native)?['"]/.test(l))).toBe(false);
    expect(src).not.toMatch(/from ['"]\.\/pages\/rows['"]/);                    // 0.7 전용 모듈에 기대지 않는다
  });
});

describe('걸음 권한 없음 — 걸음 줄 버튼 「걸음 켜기」 (0.4.10, 대표님 20:11 아이폰 만보기 줄)', () => {
  const steps = (c: Record<string, unknown>) => buildHomeItems(c as any, all()).find(i => i.key === 'steps')!;

  it('기본(생략 · false)은 「보상 받기」', () => {
    expect(steps({}).ctaLabel).toBe('보상 받기');
    expect(steps({ stepsNeedsPermission: false }).ctaLabel).toBe('보상 받기');
    expect(STEPS_PERMISSION_LABEL).toBe('걸음 켜기');
  });
  it('stepsNeedsPermission === true 일 때만 「걸음 켜기」 — 다른 값(문자열 · 숫자)은 켜짐으로 읽지 않는다', () => {
    expect(steps({ stepsNeedsPermission: true }).ctaLabel).toBe('걸음 켜기');
    for (const v of ['true', 1, 'yes', null]) expect(steps({ stepsNeedsPermission: v }).ctaLabel).toBe('보상 받기');
  });
  it('제목 · 부제 · 아이콘 · 바탕색은 그대로이고 다른 줄은 영향이 없다', () => {
    const on = buildHomeItems({ steps: 4200, stepsNeedsPermission: true }, all());
    const off = buildHomeItems({ steps: 4200 }, all());
    const strip = (items: ReturnType<typeof buildHomeItems>) => items.map(i => ({ key: i.key, title: i.title, subtitle: i.subtitle, icon: i.icon, tint: i.tint, ctaLabel: i.ctaLabel }));
    const a = strip(on);
    const b = strip(off);
    expect(a.find(i => i.key === 'steps')!.title).toBe('오늘 4,200걸음');
    expect(a.map(i => i.key)).toEqual(b.map(i => i.key));
    expect(a.filter(i => i.key !== 'steps')).toEqual(b.filter(i => i.key !== 'steps'));
    expect({ ...a.find(i => i.key === 'steps')!, ctaLabel: '' }).toEqual({ ...b.find(i => i.key === 'steps')!, ctaLabel: '' });
  });
  it('서버 home_rows 가 걸음 줄 button 을 적어 두면 그 값이 덮는다(서버 규칙 그대로) · 안 적으면 걸음 켜기가 보인다', () => {
    const base = buildHomeItems({ stepsNeedsPermission: true }, all());
    const rows = (button: string): HomeRow[] => [{ key: 'steps', title: '', desc: '', button, badge: '', visible: true, order: 0 }];
    const keys = resolveHomeKeys(base);
    expect(composeHomeRows(base, rows(''), keys, {}).find(i => i.key === 'steps')!.ctaLabel).toBe('걸음 켜기');
    expect(composeHomeRows(base, rows('받기'), keys, {}).find(i => i.key === 'steps')!.ctaLabel).toBe('받기');
  });
});

describe('출석 완료 · 무료 줄 「지금 받기」 배지 · 행운 찬스 부제 (0.4.11)', () => {
  const find = (c: Record<string, unknown>, key: string) => buildHomeItems(c as any, all()).find(i => i.key === key)!;

  it('출석: checkinDone === true 일 때만 완료 모양(done + 「출석 완료」) — 제목 · 부제 · 아이콘 · 바탕색은 그대로', () => {
    expect(CHECKIN_DONE_LABEL).toBe('출석 완료');
    const off = find({}, 'checkin');
    expect(off.done).toBeUndefined();
    expect(off.doneLabel).toBeUndefined();
    expect(off.ctaLabel).toBe('출석하기');
    const on = find({ checkinDone: true }, 'checkin');
    expect([on.done, on.doneLabel]).toEqual([true, '출석 완료']);
    expect([on.title, on.subtitle, on.icon, on.tint]).toEqual([off.title, off.subtitle, off.icon, off.tint]);
    for (const v of [false, 'true', 1, 'yes', null]) expect(find({ checkinDone: v }, 'checkin').done).toBeUndefined();
  });
  it('출석 완료는 다른 줄에 영향이 없다 · 완료 줄은 누를 수 없는 모양(done)이라 앱 동작은 그대로 들고 있다', () => {
    const strip = (items: ReturnType<typeof buildHomeItems>) => items.filter(i => i.key !== 'checkin').map(i => ({ key: i.key, title: i.title, subtitle: i.subtitle, ctaLabel: i.ctaLabel, done: i.done, badge: i.badge }));
    expect(strip(buildHomeItems({ checkinDone: true }, all()))).toEqual(strip(buildHomeItems({}, all())));
  });
  it('무료 줄 배지: claimableNow === true 이고 done 이 아닐 때만 「지금 받기」', () => {
    expect(FREE_NOW_BADGE).toBe('지금 받기');
    expect(find({}, 'free_item').badge).toBeUndefined();
    expect(find({ free: { left: 2, received: 1 } }, 'free_item').badge).toBeUndefined();
    expect(find({ free: { claimableNow: true } }, 'free_item').badge).toBe('지금 받기');
    expect(find({ free: { left: 2, received: 1, claimableNow: true } }, 'free_item').badge).toBe('지금 받기');
    for (const v of [false, 'true', 1, null]) expect(find({ free: { claimableNow: v } }, 'free_item').badge).toBeUndefined();
  });
  it('무료 줄이 done(left=0)이면 claimableNow 여도 배지가 없다 · 막대 · 글자는 그대로', () => {
    const done = find({ free: { left: 0, received: 3, claimableNow: true } }, 'free_item');
    expect(done.done).toBe(true);
    expect(done.badge).toBeUndefined();
    expect(done.progressLabel).toBe('오늘 다 받았어요');
    const open = find({ free: { left: 1, received: 2, claimableNow: true } }, 'free_item');
    expect([open.done, open.badge, open.progressLabel]).toEqual([false, '지금 받기', '1번 남았어요']);
  });
  it('무료 배지는 다른 줄에 영향이 없다 · 서버 home_rows 에 badge 가 있으면 서버 값이 이기고, 서버 badge 가 비어 있으면 우리 배지가 남는다', () => {
    const base = buildHomeItems({ free: { claimableNow: true } }, all());
    expect(base.filter(i => i.key !== 'free_item').every(i => i.badge === undefined)).toBe(true);
    const keys = resolveHomeKeys(base);
    const rows = (badge: string): HomeRow[] => [{ key: 'free_item', title: '', desc: '', button: '', badge, visible: true, order: 0 }];
    expect(composeHomeRows(base, rows('NEW'), keys, {}).find(i => i.key === 'free_item')!.badge).toBe('NEW');
    expect(composeHomeRows(base, rows(''), keys, {}).find(i => i.key === 'free_item')!.badge).toBe('지금 받기');
  });
  it('행운 찬스 부제: 아이템 이름이 없으면 「하루 기회로 포인트 뽑기」, 있으면 「하루 기회로 {이름} 뽑기」(앱 이름은 쓰지 않는다)', () => {
    expect(find({}, 'lucky_chance').subtitle).toBe('하루 기회로 포인트 뽑기');
    expect(find({ itemName: '감자' }, 'lucky_chance').subtitle).toBe('하루 기회로 감자 뽑기');
    expect(find({ itemName: '  ' }, 'lucky_chance').subtitle).toBe('하루 기회로 포인트 뽑기');
    expect(find({ appName: '감자밭', pointName: '캐시' }, 'lucky_chance').subtitle).toBe('하루 기회로 포인트 뽑기');
    expect(find({}, 'lucky_chance').ctaLabel).toBe('뽑기');
  });
});
