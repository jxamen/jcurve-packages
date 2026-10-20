import { describe, it, expect, vi } from 'vitest';
import { freeItemRow, appHubRow } from './rows';

describe('표준 줄 — 무료 아이템', () => {
  it('제목 · 부제 · 받기 단추 (carrot 홈 freeHeart 줄)', () => {
    const onPress = vi.fn();
    const r = freeItemRow({ itemName: '양분', onPress });
    expect(r).toMatchObject({ key: 'freeItem', title: '무료 양분 받기', subtitle: '하루 3번 광고 없이 받기', ctaLabel: '받기', hidden: undefined, done: false });
    expect(r.progress).toBeUndefined();
    r.onPress();
    expect(onPress).toHaveBeenCalledOnce();
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
