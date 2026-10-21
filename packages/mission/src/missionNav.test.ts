import { describe, expect, it, vi } from 'vitest';
import { backTarget, edgeBackHandlers, edgeSwipeDone, edgeSwipeStarts, EDGE_SWIPE_DX, EDGE_WIDTH, safeTop } from './missionNav';

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

describe('독립 페이지 가장자리 밀기 핸들러(0.4.13)', () => {
  const touch = (pageX: number) => ({ nativeEvent: { pageX } });
  const make = () => { const back = vi.fn(); return { back, h: edgeBackHandlers(back) }; };

  it('가장자리(EDGE_WIDTH 이내)에서 시작해 오른쪽으로 충분히 밀고 떼면 뒤로 — 한 번', () => {
    const { back, h } = make();
    expect(h.onStartShouldSetPanResponderCapture(touch(EDGE_WIDTH))).toBe(false);          // 시작은 가로채지 않는다(누름은 통과)
    expect(h.onMoveShouldSetPanResponderCapture({}, { dx: 20, dy: 3 })).toBe(true);
    h.onPanResponderRelease({}, { dx: EDGE_SWIPE_DX + 5, dy: 4, vx: 0.1 });
    expect(back).toHaveBeenCalledTimes(1);
  });
  it('가장자리 밖(EDGE_WIDTH 넘어)에서 시작한 밀기는 가로채지도 뒤로 가지도 않는다 — 안쪽 스크롤 · 단추는 그대로', () => {
    const { back, h } = make();
    h.onStartShouldSetPanResponderCapture(touch(EDGE_WIDTH + 1));
    expect(h.onMoveShouldSetPanResponderCapture({}, { dx: 80, dy: 0 })).toBe(false);
    h.onPanResponderRelease({}, { dx: 200, dy: 0, vx: 2 });
    expect(back).not.toHaveBeenCalled();
  });
  it('세로 스크롤(가장자리에서 시작해도 세로가 더 큼)은 가로채지 않는다', () => {
    const { h } = make();
    h.onStartShouldSetPanResponderCapture(touch(2));
    expect(h.onMoveShouldSetPanResponderCapture({}, { dx: 12, dy: 40 })).toBe(false);
    expect(h.onMoveShouldSetPanResponderCapture({}, { dx: 5, dy: 0 })).toBe(false);          // 10 이하는 아직
    expect(h.onMoveShouldSetPanResponderCapture({}, { dx: -30, dy: 0 })).toBe(false);        // 왼쪽으로는 안 됨
  });
  it('짧게 밀었으면 뒤로 가지 않고, 빠르게 튕겼으면 간다(쇼핑 미션 화면과 같은 판정)', () => {
    const slow = make();
    slow.h.onStartShouldSetPanResponderCapture(touch(3));
    slow.h.onPanResponderRelease({}, { dx: 25, dy: 0, vx: 0.1 });
    expect(slow.back).not.toHaveBeenCalled();
    const fast = make();
    fast.h.onStartShouldSetPanResponderCapture(touch(3));
    fast.h.onPanResponderRelease({}, { dx: 35, dy: 2, vx: 0.9 });
    expect(fast.back).toHaveBeenCalledTimes(1);
  });
  it('새 터치는 이전 터치의 시작 위치를 이어받지 않는다 — 가장자리 → 안쪽 순서로 터치해도 안쪽 터치는 무시', () => {
    const { back, h } = make();
    h.onStartShouldSetPanResponderCapture(touch(2));
    h.onPanResponderRelease({}, { dx: 100, dy: 0, vx: 0 });
    expect(back).toHaveBeenCalledTimes(1);
    h.onStartShouldSetPanResponderCapture(touch(200));
    expect(h.onMoveShouldSetPanResponderCapture({}, { dx: 100, dy: 0 })).toBe(false);
    h.onPanResponderRelease({}, { dx: 100, dy: 0, vx: 0 });
    expect(back).toHaveBeenCalledTimes(1);
  });
  it('responder 를 쥐고 있지 않는다 — 다른 곳이 가져가겠다고 하면 놓는다(놓친 터치가 머리줄 단추를 막지 않게, 0.7.12)', () => {
    expect(make().h.onPanResponderTerminationRequest()).toBe(true);
  });
});
