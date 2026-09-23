/**
 * 로그인 직후 **안전 시점**(2.6) — 로그인 창이 완전히 닫히고 앱이 앞에 돌아와 조용해진 뒤.
 *
 * 머니트리 iOS(2026-09-23): 첫 설치 뒤 구글 로그인 → 홈에 들어오는 순간 가이드 팝업(RN `Modal`)을 열었는데,
 * 구글 창이 **닫히는 중**이라 Modal 이 못 올라가고 **보이지 않는 막만 남아 화면이 전부 안 눌렸다.**
 * `createReturnWatch` 가 막는 「밖에 다녀옴」과 다른 원인이라 그것으로는 못 막았다.
 *
 * 조용해졌다 = 도는 로그인이 없고 · 앱이 `active` 이고 · 로그인이 끝난 때와 마지막 AppState 변화에서
 * 둘 다 `quietMs`(기본 1초)가 지났다. 그 뒤 한 틱 더 기다려 푼다.
 * 이 파일은 `auth.ts` 를 부르지 않는다(import 고리를 만들지 않는다).
 */
export type SettleEnv = {
    /** 지금 AppState — 모르면(웹·시험) 'active' */
    appState: () => string;
    onAppState: (fn: (next: string) => void) => () => void;
    now: () => number;
    sleep: (ms: number) => Promise<void>;
};
export declare function createSettle(busy: () => boolean, env: SettleEnv, quietMs?: number): {
    /** 로그인이 끝났다(성공·실패·잊음) — 여기서부터 조용해질 때까지 센다 */
    ended: () => void;
    settled: () => boolean;
    wait: () => Promise<void>;
    /** 차례로 — 앞의 것(돌려준 약속까지)이 끝나야 다음을 연다. 앞의 것이 실패해도 뒤는 연다 */
    run<R>(fn: () => R | Promise<R>): Promise<R>;
};
