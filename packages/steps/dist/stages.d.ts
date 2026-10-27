export type StepsStage = {
    stage_id: string;
    threshold: number;
    points: number;
    claimed: boolean;
    available: boolean;
    ad_purpose: string;
};
export type StepsState = {
    ok: boolean;
    day: string;
    today_steps: number;
    daily_max: number;
    earned_today: number;
    stages: StepsStage[];
};
export declare const DEFAULT_THRESHOLDS: readonly [1, 1000, 3000, 5000, 10000];
export declare function stepsEnabled(values?: Record<string, unknown>): boolean;
export declare function canClaimStage(state: StepsState, stage: StepsStage): boolean;
/** 지금 받을 수 있는 단계들 — 서버가 준 상태(claimed · available · 하루 최대) 기준 */
export declare function claimableStages(state: StepsState | null | undefined): StepsStage[];
/**
 * 「어제 걸음」 카드에 필요한 값(0.3.0). `state` 는 `GET steps/stages?day=어제` 의 응답이다.
 * 받은 여부는 **서버 응답**(claimed · available · 하루 최대)만 믿고, 앱 기록은 보지 않는다.
 * 숨기는 경우: 응답이 없다 · 응답의 날짜가 어제가 아니다(자정이 지났거나 서버가 오늘을 줬다) · 받을 수 있는 단계가 하나도 없다(걸음 0 · 다 받음 · 하루 최대).
 */
export type YesterdayView = {
    show: boolean;
    day: string;
    steps: number;
    left: number;
    points: number;
    earned: number;
    first: StepsStage | null;
};
export declare function yesterdayView(state: StepsState | null | undefined, now?: number): YesterdayView;
