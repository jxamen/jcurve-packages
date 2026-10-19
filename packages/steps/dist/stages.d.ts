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
