import { describe, expect, it } from 'vitest';
import { backTarget, edgeSwipeDone, edgeSwipeStarts, EDGE_SWIPE_DX, safeTop } from './missionNav';

describe('쇼핑 미션에서 나가는 길(0.4.3)', () => {
  it('iOS 에서 위 여백이 0 · 이상한 값으로 오면 상태 표시줄 높이로 짐작한다 — 닫기가 상태 표시줄 밑에 깔리지 않게', () => {
    expect(safeTop('ios', 0, 852)).toBe(47);
    expect(safeTop('ios', NaN, 852)).toBe(47);
    expect(safeTop('ios', 0, 667)).toBe(20);
    expect(safeTop('ios', 59, 852)).toBe(59);
    expect(safeTop('android', 0, 852)).toBe(0);
    expect(safeTop('android', 24, 852)).toBe(24);
  });
  it('뒤로가기는 웹 기록이 있으면 웹에서, 없으면 화면 닫기(꺼진 단추가 없다)', () => {
    expect(backTarget(true)).toBe('web');
    expect(backTarget(false)).toBe('close');
  });
  it('왼쪽 가장자리 밀기 — 가로로 충분히 민 것만, 세로 스크롤은 아니다', () => {
    expect(edgeSwipeStarts(12, 3)).toBe(true);
    expect(edgeSwipeStarts(8, 0)).toBe(false);
    expect(edgeSwipeStarts(20, 30)).toBe(false);
    expect(edgeSwipeDone(EDGE_SWIPE_DX, 10, 0)).toBe(true);
    expect(edgeSwipeDone(35, 5, 0.8)).toBe(true);
    expect(edgeSwipeDone(35, 5, 0.2)).toBe(false);
    expect(edgeSwipeDone(-80, 0, 1)).toBe(false);
    expect(edgeSwipeDone(70, 90, 0)).toBe(false);
  });
});
