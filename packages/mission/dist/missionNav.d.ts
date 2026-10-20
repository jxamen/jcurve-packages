/**
 * 쇼핑 미션 화면에서 나가는 길(0.4.3) — 대표님 10-20 11:44 「일주일 쇼핑 미션 들어갔는데 닫기도 뒤로가기도 안되고」.
 * 화면(ShoppingMission)이 쓰는 판단만 여기 모아 시험한다.
 */
/**
 * 머리줄 위 여백. iOS 전체 화면 Modal 은 상태 표시줄이 늘 있다(20 이상) — 앱이 Modal 안에서 읽어 0 을 넘기면
 * 「닫기」가 상태 표시줄 밑에 깔려 눌리지 않는다(당근 웹뷰 · 꿀꿀 쇼핑 미션 때와 같은 증상). 그때는 기기 높이로 짐작한다
 */
export declare function safeTop(os: string, top: number, windowHeight: number): number;
/** 뒤로가기(머리줄 단추 · 안드로이드 뒤로 · iOS 왼쪽 가장자리 밀기) — 웹 기록이 있으면 웹에서 한 칸, 없으면 화면을 닫는다 */
export declare function backTarget(canGoBack: boolean): 'web' | 'close';
/** iOS 왼쪽 가장자리 띠 폭 — 이 안에서 시작해 오른쪽으로 민 것만 뒤로 가기로 본다 */
export declare const EDGE_WIDTH = 24;
/** 이만큼 오른쪽으로 밀면 뒤로 */
export declare const EDGE_SWIPE_DX = 60;
/** 가장자리 밀기를 시작할지 — 가로로 10 넘게, 세로보다 더 */
export declare function edgeSwipeStarts(dx: number, dy: number): boolean;
/** 손을 뗐을 때 뒤로 갈지 — 충분히 밀었거나, 빠르게 튕겼으면 */
export declare function edgeSwipeDone(dx: number, dy: number, vx: number): boolean;
