/**
 * 앱 오프닝 광고 — **보여도 되는지 가리는 순수 규칙**(2026-10-10 대표님 지시).
 *
 * 기기 모듈을 읽지 않는다(노드 시험 · `flow.ts` 가 가드를 부른다). 광고를 불러오고 띄우는 쪽은 `appOpen.ts`.
 *
 * 규칙 요약
 *  - 어드민 `<앱>.app_open_on` 이 1 이고 단위 ID 가 있어야 한다(기본 꺼짐).
 *  - 콜드 스타트는 **스플래시 로딩 중에만**. 로딩이 끝났으면 건너뛴다.
 *  - 백그라운드 → 앞으로(웜 스타트)는 `app_open_on_resume` 이 1 일 때만.
 *  - **마지막으로 앱을 쓴 때**(앞에 있던 마지막 시각 · 뒤로 간 시각)로부터 `app_open_interval_h` 시간이 지나야 한다.
 *  - 하루(KST) `app_open_daily_max` 번까지.
 *  - 설치(첫 실행)한 날은 세지 않고 `app_open_skip_days` 일이 지나야 한다(1 이면 다음 날부터).
 *  - 보상형 · 전면 광고 · 미션(외부 앱/웹) · 결제 · 로그인에서 돌아온 직후엔 **절대** 안 띄운다(가드).
 *  - 전체화면 광고가 떠 있는 동안에도 안 띄운다.
 */
export type AppOpenConfig = {
    on: boolean;
    /** 웜 스타트(뒤에 있다 돌아옴)에도 띄우나 — 0 이면 콜드 스타트만 */
    onResume: boolean;
    intervalH: number;
    dailyMax: number;
    skipDays: number;
};
export declare const DEFAULT_APP_OPEN: AppOpenConfig;
/** 기기에 적어 두는 것 — 키 `<앱>.appOpen` */
export type AppOpenStore = {
    /** 첫 실행 시각(ms) — 설치일 */
    firstLaunchAt: number | null;
    /** 마지막으로 앱을 쓴 시각(ms) — 앞에 있던 마지막 순간 · 뒤로 간 순간 */
    lastUseAt: number | null;
    /** 오늘(KST `YYYY-MM-DD`)과 그날 띄운 횟수 */
    day: string;
    count: number;
};
export declare const EMPTY_STORE: AppOpenStore;
export type Trigger = 'cold' | 'resume';
export type Skip = 'off' | 'no_unit' | 'not_loaded' | 'fullscreen' | 'guard' | 'cold_after_splash' | 'resume_off' | 'skip_days' | 'interval' | 'daily_max';
export type Decision = {
    show: true;
} | {
    show: false;
    reason: Skip;
};
/** KST 날짜 글자 `YYYY-MM-DD` */
export declare const kstDay: (ms: number) => string;
/** 오늘 이미 띄운 횟수 — 날짜가 바뀌었으면 0 */
export declare const shownToday: (st: AppOpenStore, now: number) => number;
/** 한 번 띄웠다고 적는다 */
export declare function noteShown(st: AppOpenStore, now: number): AppOpenStore;
export type DecideInput = {
    cfg: AppOpenConfig;
    unitId: string;
    trigger: Trigger;
    /** 지금 스플래시 로딩 중인가(콜드 스타트 판정용) */
    splash: boolean;
    loaded: boolean;
    fullScreenShowing: boolean;
    /** 가드가 막고 있나(`guardActive`) */
    guarded: boolean;
    store: AppOpenStore;
    now: number;
};
export declare function decide(i: DecideInput): Decision;
/** 콜드 스타트에서 스플래시를 광고 로드까지 붙잡는 최대 시간(ms) — A32 실측 로드 4.6초를 받도록 5초(3초는 hold_timeout 으로 못 떴다 · 대표님 기준 스플래시 3~5초 이내) */
export declare const COLD_HOLD_MS = 5000;
/**
 * 스플래시를 광고 때문에 더 붙잡아야 하나 — **띄울 수 있는 실행일 때만**, 로드가 안 끝났고 상한(`COLD_HOLD_MS`) 안일 때만.
 * 쉬는 날 · 간격 · 하루 최대 · 꺼짐에 걸리는 실행은 로드 여부와 상관없이 붙잡지 않는다(규칙 판정은 로드 전에 먼저).
 */
export declare function shouldHold(i: {
    cfg: AppOpenConfig;
    unitId: string;
    store: AppOpenStore;
    now: number;
    loaded: boolean;
    elapsedMs: number;
}): boolean;
/** 로드 · 스플래시 여부는 따지지 않고 규칙만으로 콜드 스타트에 띄울 수 있나 */
export declare function coldPrecheck(i: {
    cfg: AppOpenConfig;
    unitId: string;
    store: AppOpenStore;
    now: number;
}): Decision;
export type GuardReason = 'rewarded' | 'interstitial' | 'mission' | 'payment' | 'login' | 'external';
/** 돌아온 뒤 더 막는 시간 */
export declare const AFTER_RETURN_MS = 30000;
export type GuardState = {
    /** 떠나는 중인 흐름 — 돌아오면(앞으로 오면) 지우고 `until` 을 건다 */
    pending: {
        reason: GuardReason;
        expires: number;
    } | null;
    /** 이 시각까지 막는다 */
    until: number;
};
export declare const EMPTY_GUARD: GuardState;
/** 흐름을 시작한다 — 떠나 있는 동안 + 돌아온 뒤 `AFTER_RETURN_MS` 막는다 */
export declare function markReturn(g: GuardState, reason: GuardReason, now: number): GuardState;
/** 앞으로 `ms` 동안은 무조건 막는다 */
export declare const blockFor: (g: GuardState, ms: number, now: number) => GuardState;
/** 앱이 앞으로 돌아왔다 — 떠난 흐름이 있으면 거기서 돌아온 것이다 */
export declare function onForeground(g: GuardState, now: number): GuardState;
/** 지금 막혀 있나 — 떠난 흐름이 아직 안 돌아왔거나 막는 시간 안 */
export declare const guardActive: (g: GuardState, now: number) => boolean;
