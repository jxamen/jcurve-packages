"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_THRESHOLDS = void 0;
exports.stepsEnabled = stepsEnabled;
exports.canClaimStage = canClaimStage;
exports.claimableStages = claimableStages;
exports.yesterdayView = yesterdayView;
const days_1 = require("./days");
exports.DEFAULT_THRESHOLDS = [1, 1000, 3000, 5000, 10000];
function stepsEnabled(values) { return ['1', 'true'].includes(String(values?.['steps.on'] ?? '0')); }
function canClaimStage(state, stage) {
    return !stage.claimed && stage.available && state.today_steps >= stage.threshold && state.earned_today + stage.points <= state.daily_max;
}
/** 지금 받을 수 있는 단계들 — 서버가 준 상태(claimed · available · 하루 최대) 기준 */
function claimableStages(state) {
    return state ? state.stages.filter((stage) => canClaimStage(state, stage)) : [];
}
function yesterdayView(state, now = Date.now()) {
    const day = (0, days_1.yesterdayKst)(now);
    const claimable = state && state.day === day ? claimableStages(state) : [];
    return {
        show: claimable.length > 0, day, steps: state && state.day === day ? state.today_steps : 0, left: claimable.length,
        points: claimable[0]?.points ?? state?.stages[0]?.points ?? 5, earned: state && state.day === day ? state.earned_today : 0, first: claimable[0] ?? null,
    };
}
