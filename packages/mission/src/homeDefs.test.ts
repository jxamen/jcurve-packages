import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { FREE_DONE_LABEL, HOME_ORDER, buildHomeItems, homeItem, type HomeActions } from './homeDefs';
import { HOME_KEYS, composeHomeRows, resolveHomeKeys, type HomeRow } from './home';

/** 당근 기준표(ota/carrot-ios-106-benefit-1020 814f2f4, FarmScreen HOME_BENEFITS + theme.ts carrotSoft #FFEEE2 · heartSoft #E6F5EA) — 대표님 10-20 20:23 「갖다 넣으면 똑같은 게 그냥 튀어 나와야」 */
const CARROT = {
  quiz1: { title: '쇼핑 태그 퀴즈1', subtitle: '참여하고 최대 100P 받기', ctaLabel: '참여하기', icon: 'bag', tint: '#FDEBE2' },
  quiz2: { title: '플레이스 & 쇼핑 태그 퀴즈2', subtitle: '참여하고 최대 100P 받기', ctaLabel: '참여하기', icon: 'pin', tint: '#E4F3EA' },
  checkin: { title: '매일 출석 체크', subtitle: '10초 구경하고 포인트 받기', ctaLabel: '출석하기', icon: 'calendar', tint: '#E8F0FD' },
  steps: { title: '만보기', subtitle: '오늘 걸음으로 포인트 받기', ctaLabel: '보상 받기', icon: '👟', tint: '#FFEEE2' },
  free_item: { title: '무료 포인트 받기', subtitle: '하루 3번 들르면 포인트 받기', ctaLabel: '받기', icon: '🌱', tint: '#E6F5EA' },
  today_missions: { title: '오늘의 미션', subtitle: '간단한 미션으로 포인트 더 받기', ctaLabel: '보러가기', icon: 'star', tint: '#FBF1DC' },
  lucky_chance: { title: '행운 찬스', subtitle: '하루 기회로 포인트 뽑기', ctaLabel: '뽑기', icon: 'ticket', tint: '#EFE8FB' },
  invite: { title: '친구 초대하기', subtitle: '친구가 가입하면 같이 받기', ctaLabel: '초대하기', icon: 'friend', tint: '#FDEBDD' },
  recommend: { title: '추천 앱 둘러보기', subtitle: '추천 앱 둘러보기', ctaLabel: '보러가기', icon: 'star', tint: '#FFEEE2' },
} as const;

const all = (): HomeActions => Object.fromEntries(HOME_ORDER.map(k => [k, vi.fn()])) as HomeActions;

describe('줄 정의 = 당근 기준 (0.7.5)', () => {
  it('9줄 제목 · 부제 · 버튼 · 아이콘 · 바탕색이 당근 표와 글자까지 같다(이름은 기본값 「포인트」)', () => {
    const items = buildHomeItems({}, all());
    expect(items).toHaveLength(9);
    for (const it of items) {
      const want = CARROT[it.key as keyof typeof CARROT];
      expect({ title: it.title, subtitle: it.subtitle, ctaLabel: it.ctaLabel, icon: it.icon, tint: it.tint }).toEqual(want);
    }
  });

  it('순서는 서버 home_rows 기본 순서(HOME_KEYS)와 같고, 줄 key 가 서버 key 라 맞춤표가 필요 없다', () => {
    expect([...HOME_ORDER]).toEqual([...HOME_KEYS]);
    expect(buildHomeItems({}, all()).map(i => i.key)).toEqual([...HOME_KEYS]);
  });

  it('동작(actions)을 안 넘긴 줄은 그 앱에서 빠진다 — 순서는 유지(꾹테크 무료 줄이 없을 때 등)', () => {
    const a = all();
    delete a.free_item;
    delete a.steps;
    expect(buildHomeItems({}, a).map(i => i.key)).toEqual(['quiz1', 'quiz2', 'checkin', 'today_missions', 'lucky_chance', 'invite', 'recommend']);
    expect(buildHomeItems({}, {})).toEqual([]);
    expect(buildHomeItems({}, { invite: undefined } as HomeActions)).toEqual([]);          // 함수가 아니면 만들지 않는다
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

  it('앱 테마색을 따르는 걸음 · 무료 · 추천 세 줄만 바탕색(tints)을 앱이 넘길 수 있다 — 나머지 줄은 넘겨도 고정', () => {
    const items = buildHomeItems({ tints: { steps: '#112233', free_item: '#445566', recommend: '#778899', quiz1: '#000000' } as any }, all());
    const tint = (k: string) => items.find(i => i.key === k)!.tint;
    expect([tint('steps'), tint('free_item'), tint('recommend')]).toEqual(['#112233', '#445566', '#778899']);
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

  it('서버 순서 · 제목 · 설명 · 버튼 · 배지가 얹히고 아이콘 · 바탕색 · 완료 글자는 그대로, 동작 없는 서버 줄은 안 그린다', () => {
    const a = all();
    delete a.recommend;
    const base = buildHomeItems({}, a);
    const rows = [row('checkin', { desc: '서버 부제', button: '체크', badge: 'NEW' }, 0), row('quiz1', {}, 1), row('recommend', {}, 2), row('free_item', { title: '' }, 3)];
    const out = composeHomeRows(base, rows, resolveHomeKeys(base, undefined));                                // onRow 없음 — 동작 없는 recommend 는 만들지 않는다
    // 서버 목록이 곧 목록이다 — home_rows 에 없는 줄(quiz2 · 걸음 …)은 안 그리고, 서버에만 있고 동작이 없는 recommend 도 안 만든다
    expect(out.map(i => i.key)).toEqual(['checkin', 'quiz1', 'free_item']);
    const c = out[0];
    expect([c.title, c.subtitle, c.ctaLabel, c.badge]).toEqual(['checkin 서버', '서버 부제', '체크', 'NEW']);
    expect([c.icon, c.tint]).toEqual(['calendar', '#E8F0FD']);                  // 서버가 아이콘 · 바탕색을 못 바꾼다
    const f = out.find(i => i.key === 'free_item')!;
    expect([f.title, f.doneLabel, f.icon]).toEqual(['무료 포인트 받기', '내일 다시', '🌱']);       // 빈 서버 제목 = 패키지 제목 유지
    expect(out.some(i => i.key === 'recommend')).toBe(false);
  });

  it('서버 설정이 없거나(null) 실패하면 패키지 정의 그대로', () => {
    const base = buildHomeItems({}, all());
    expect(composeHomeRows(base, null, resolveHomeKeys(base, undefined))).toEqual(base);
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
