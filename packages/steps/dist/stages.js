"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_THRESHOLDS = void 0;
exports.stepsEnabled = stepsEnabled;
exports.canClaimStage = canClaimStage;
exports.DEFAULT_THRESHOLDS = [1, 1000, 3000, 5000, 10000];
function stepsEnabled(values) { return ['1', 'true'].includes(String(values?.['steps.on'] ?? '0')); }
function canClaimStage(state, stage) {
    return !stage.claimed && stage.available && state.today_steps >= stage.threshold && state.earned_today + stage.points <= state.daily_max;
}
