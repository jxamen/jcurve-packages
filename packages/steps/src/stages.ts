export type StepsStage = { stage_id: string; threshold: number; points: number; claimed: boolean; available: boolean; ad_purpose: string };
export type StepsState = { ok: boolean; day: string; today_steps: number; daily_max: number; earned_today: number; stages: StepsStage[] };
export const DEFAULT_THRESHOLDS = [1, 1000, 3000, 5000, 10000] as const;
export function stepsEnabled(values?: Record<string, unknown>): boolean { return ['1', 'true'].includes(String(values?.['steps.on'] ?? '0')); }
export function canClaimStage(state: StepsState, stage: StepsStage): boolean {
  return !stage.claimed && stage.available && state.today_steps >= stage.threshold && state.earned_today + stage.points <= state.daily_max;
}
