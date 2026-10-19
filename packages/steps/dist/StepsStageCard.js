"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepsStageCard = StepsStageCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const stages_1 = require("./stages");
function StepsStageCard({ state, disabled = false, onWatchAd, onClaim, onError }) {
    const lock = (0, react_1.useRef)(false);
    const [busy, setBusy] = (0, react_1.useState)(null);
    async function claim(stage) {
        if (lock.current || disabled || !(0, stages_1.canClaimStage)(state, stage))
            return;
        lock.current = true;
        setBusy(stage.stage_id);
        try {
            if (await onWatchAd(stage))
                await onClaim(stage, state.day);
        }
        catch (error) {
            onError(error);
        }
        finally {
            lock.current = false;
            setBusy(null);
        }
    }
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { gap: 12, padding: 16 }, children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: { fontSize: 28, fontWeight: '700' }, children: ["\uC624\uB298 ", state.today_steps.toLocaleString(), "\uAC78\uC74C"] }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { children: ["\uC624\uB298 ", state.earned_today, " / ", state.daily_max, "P \u00B7 \uD55C\uAD6D\uC2DC\uAC04 \uC790\uC815 \uCD08\uAE30\uD654 \u00B7 \uBBF8\uC218\uB839 \uC774\uC6D4 \uC5C6\uC74C"] }), state.stages.map(stage => (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { padding: 16, borderRadius: 16, backgroundColor: stage.claimed ? '#eee' : '#fff4e8', gap: 8 }, children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { children: [stage.threshold === 1 ? '첫걸음' : stage.threshold.toLocaleString() + '걸음', " \uC0C1\uC790 \u00B7 ", stage.points] }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", disabled: disabled || busy !== null || !(0, stages_1.canClaimStage)(state, stage), onPress: () => { void claim(stage); }, style: { padding: 12, borderRadius: 10, backgroundColor: stage.claimed || !(0, stages_1.canClaimStage)(state, stage) || disabled ? '#ddd' : '#ff922e' }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { children: stage.claimed ? '완료' : busy === stage.stage_id ? '확인 중…' : `광고 보고 ${stage.points}P` }) })] }, stage.stage_id))] });
}
