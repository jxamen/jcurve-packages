import { describe, it, expect, vi } from 'vitest';
import { freeItemRow, appHubRow } from './rows';

describe('표준 줄 — 무료 아이템', () => {
  it('제목 · 부제 · 받기 단추 (carrot 홈 freeHeart 줄)', () => {
    const onPress = vi.fn();
    const r = freeItemRow({ itemName: '양분', onPress });
    expect(r).toMatchObject({ key: 'freeItem', title: '무료 양분 받기', subtitle: '하루 3번 들르면 양분 받기', ctaLabel: '받기', hidden: undefined, done: false });
    expect(r.progress).toBeUndefined();
    r.onPress();
    expect(onPress).toHaveBeenCalledOnce();
  });
  it('부제 기본은 방문형 「하루 N번 들르면 ○○ 받기」 — 아이템 이름 · 하루 횟수를 따르고, 광고형 앱은 subtitle 로 덮는다(0.7.1)', () => {
    expect(freeItemRow({ itemName: '먹이', total: 5, onPress: () => {} }).subtitle).toBe('하루 5번 들르면 먹이 받기');
    expect(freeItemRow({ itemName: '캡슐', onPress: () => {} }).subtitle).toBe('하루 3번 들르면 캡슐 받기');
    expect(freeItemRow({ itemName: '양분', subtitle: '하루 3번 광고 없이 받기', onPress: () => {} }).subtitle).toBe('하루 3번 광고 없이 받기');
    expect(freeItemRow({ itemName: '양분', subtitle: '', onPress: () => {} }).subtitle).toBe('');                      // 빈 글자도 그대로(앱이 정한 값)
    expect(freeItemRow({ itemName: '양분', onPress: () => {} }).subtitle).not.toContain('광고');
  });
  it('남은 수 → 칸 막대 · 0이면 완료', () => {
    expect(freeItemRow({ itemName: '먹이', left: 2, onPress: () => {} })).toMatchObject({ title: '무료 먹이 받기', progress: { done: 1, total: 3 }, progressLabel: '2번 남았어요', done: false });
    expect(freeItemRow({ itemName: '캡슐', left: 0, onPress: () => {} })).toMatchObject({ progress: { done: 3, total: 3 }, progressLabel: '오늘 다 받았어요', done: true });
  });
  it('숨김 · 그림 · 바탕 · key 는 줄 값대로', () => {
    expect(freeItemRow({ itemName: '열매', hidden: true, icon: 'X', tint: '#000', key: 'k', onPress: () => {} })).toMatchObject({ hidden: true, icon: 'X', tint: '#000', key: 'k' });
  });
});

describe('표준 줄 — 추천 앱', () => {
  it('제목 · 보러가기 · 숨김', () => {
    const onPress = vi.fn();
    const r = appHubRow({ onPress, hidden: false });
    expect(r).toMatchObject({ key: 'apphub', title: '추천 앱 둘러보기', subtitle: '추천 앱 둘러보기', ctaLabel: '보러가기', hidden: false });
    r.onPress();
    expect(onPress).toHaveBeenCalledOnce();
    expect(appHubRow({ onPress, subtitle: '친구 앱 3개' }).subtitle).toBe('친구 앱 3개');
  });
});

describe('표준 줄 — 무료 아이템: 받은 횟수(received)와 줄별 완료 글자 (0.7.4, 대표님 10-20 19:01 감자밭 A32)', () => {
  const free = (a: Partial<Parameters<typeof freeItemRow>[0]>) => freeItemRow({ itemName: '감자', onPress: () => {}, ...a });

  it('놓친 칸이 있으면 남은 칸 0 이어도 「다 받음」이 아니다 — 저녁 1번만 받았으면 막대는 1칸, 「오늘 1번 받았어요」, 완료(done)', () => {
    const r = free({ left: 0, received: 1 });
    expect(r.done).toBe(true);
    expect(r.progress).toEqual({ done: 1, total: 3 });
    expect(r.progressLabel).toBe('오늘 1번 받았어요');
    expect(free({ left: 0, received: 2 }).progressLabel).toBe('오늘 2번 받았어요');
    expect(free({ left: 0, received: 2 }).progress).toEqual({ done: 2, total: 3 });
  });

  it('다 받았으면 「오늘 다 받았어요」 · 하나도 못 받고 시간이 지났으면 「오늘은 시간이 지났어요」(막대 0칸)', () => {
    const all = free({ left: 0, received: 3 });
    expect([all.done, all.progress, all.progressLabel]).toEqual([true, { done: 3, total: 3 }, '오늘 다 받았어요']);
    const none = free({ left: 0, received: 0 });
    expect([none.done, none.progress, none.progressLabel]).toEqual([true, { done: 0, total: 3 }, '오늘은 시간이 지났어요']);
  });

  it('아직 받을 칸이 남았으면 글자는 「N번 남았어요」, 막대는 받은 횟수만큼 · done 아님', () => {
    const r = free({ left: 2, received: 1 });
    expect([r.done, r.progress, r.progressLabel]).toEqual([false, { done: 1, total: 3 }, '2번 남았어요']);
    const fresh = free({ left: 3, received: 0 });
    expect([fresh.done, fresh.progress, fresh.progressLabel]).toEqual([false, { done: 0, total: 3 }, '3번 남았어요']);
  });

  it('received 만 주면 막대와 받은 횟수 글자만(done 은 아님) · 범위를 벗어난 값은 0~total 로 · total 이 3 이 아니어도 따른다', () => {
    const r = free({ received: 2 });
    expect([r.done, r.progress, r.progressLabel]).toEqual([false, { done: 2, total: 3 }, '오늘 2번 받았어요']);
    expect(free({ received: 9 }).progress).toEqual({ done: 3, total: 3 });
    expect(free({ received: -4 }).progress).toEqual({ done: 0, total: 3 });
    const five = free({ total: 5, left: 0, received: 4 });
    expect([five.progress, five.progressLabel]).toEqual([{ done: 4, total: 5 }, '오늘 4번 받았어요']);
  });

  it('received 를 안 주면 예전 그대로 — 막대는 total−left, 글자는 「N번 남았어요」/「오늘 다 받았어요」', () => {
    expect(free({ left: 2 })).toMatchObject({ done: false, progress: { done: 1, total: 3 }, progressLabel: '2번 남았어요' });
    expect(free({ left: 0 })).toMatchObject({ done: true, progress: { done: 3, total: 3 }, progressLabel: '오늘 다 받았어요' });
    expect(free({}).progress).toBeUndefined();
  });

  it('doneLabel 은 이 줄만의 완료 버튼 글자 — 주지 않으면 줄에 doneLabel 칸이 없다', () => {
    expect(free({ left: 0, received: 1, doneLabel: '내일 다시' }).doneLabel).toBe('내일 다시');
    expect('doneLabel' in free({ left: 0 })).toBe(false);
  });
});
