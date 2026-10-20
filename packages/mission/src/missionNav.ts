/**
 * 쇼핑 미션 화면에서 나가는 길(0.4.3) — 대표님 10-20 11:44 「일주일 쇼핑 미션 들어갔는데 닫기도 뒤로가기도 안되고」.
 * 화면(ShoppingMission)이 쓰는 판단만 여기 모아 시험한다.
 */

/**
 * 머리줄 위 여백. iOS 전체 화면 Modal 은 상태 표시줄이 늘 있다(20 이상) — 앱이 Modal 안에서 읽어 0 을 넘기면
 * 「닫기」가 상태 표시줄 밑에 깔려 눌리지 않는다(당근 웹뷰 · 꿀꿀 쇼핑 미션 때와 같은 증상). 그때는 기기 높이로 짐작한다
 */
export function safeTop(os: string, top: number, windowHeight: number): number {
  const given = Number.isFinite(top) && top > 0 ? top : 0;
  if (os !== 'ios' || given >= 20) return given;
  return windowHeight >= 812 ? 47 : 20;
}

/** 뒤로가기(머리줄 단추 · 안드로이드 뒤로 · iOS 왼쪽 가장자리 밀기) — 웹 기록이 있으면 웹에서 한 칸, 없으면 화면을 닫는다 */
export function backTarget(canGoBack: boolean): 'web' | 'close' {
  return canGoBack ? 'web' : 'close';
}

/** iOS 왼쪽 가장자리 띠 폭 — 이 안에서 시작해 오른쪽으로 민 것만 뒤로 가기로 본다 */
export const EDGE_WIDTH = 24;
/** 이만큼 오른쪽으로 밀면 뒤로 */
export const EDGE_SWIPE_DX = 60;

/** 가장자리 밀기를 시작할지 — 가로로 10 넘게, 세로보다 더 */
export function edgeSwipeStarts(dx: number, dy: number): boolean {
  return dx > 10 && Math.abs(dy) < dx;
}

/** 손을 뗐을 때 뒤로 갈지 — 충분히 밀었거나, 빠르게 튕겼으면 */
export function edgeSwipeDone(dx: number, dy: number, vx: number): boolean {
  if (dx <= 0 || Math.abs(dy) > dx) return false;
  return dx >= EDGE_SWIPE_DX || (vx > 0.5 && dx >= 30);
}

/**
 * (0.4.13) 독립 페이지(PageFrame)의 iOS 왼쪽 가장자리 밀기 → 뒤로 — PanResponder 에 넘길 핸들러 묶음. React Native 를 가져오지 않아 시험이 바로 돈다.
 * 가장자리에 띠 View 를 덮지 않고 최상위 View 의 **캡처** 핸들러로 「화면 왼쪽 EDGE_WIDTH 안에서 시작한 가로 밀기」만 가로챈다 —
 * 띠를 덮으면 그 안의 탭 · 세로 스크롤이 막히고 머리줄 ‹ 단추 왼쪽을 가린다. 시작이 가장자리가 아니면 아무것도 하지 않아 안쪽 스크롤 · 단추는 그대로다.
 * (0.7.12) 응답자를 쥐고 있지 않는다 — 다른 곳이 가져가겠다고 하면(`onPanResponderTerminationRequest` true) 놓는다. 쥔 채 놓친 터치 때문에 머리줄 단추가 눌림을 못 받는 일
 * (쇼핑 퀴즈 「닫기」 먹통, 대표님 10-21 00:16)을 막는다. ShoppingMission 도 이 묶음을 쓴다(0.7.12 — 본문에 덮던 띠 View 를 없앴다).
 * `getBack` 은 늘 최신 onBack 을 부른다(렌더마다 새 핸들러를 만들지 않게 ref 로 읽는다). 판정 상수 · 함수는 쇼핑 미션 화면과 같다(EDGE_WIDTH · edgeSwipeStarts · edgeSwipeDone).
 */
export function edgeBackHandlers(getBack: () => void) {
  let startedAtEdge = false;

  return {
    onStartShouldSetPanResponderCapture: (e: { nativeEvent: { pageX: number } }) => { startedAtEdge = e.nativeEvent.pageX <= EDGE_WIDTH; return false; },
    onMoveShouldSetPanResponderCapture: (_e: unknown, g: { dx: number; dy: number }) => startedAtEdge && edgeSwipeStarts(g.dx, g.dy),
    onPanResponderRelease: (_e: unknown, g: { dx: number; dy: number; vx: number }) => { if (startedAtEdge && edgeSwipeDone(g.dx, g.dy, g.vx)) getBack(); },
    onPanResponderTerminationRequest: () => true,
  };
}
