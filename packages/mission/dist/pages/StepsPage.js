"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepsPage = StepsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * 만보기 — 1,000걸음마다 광고 보고 포인트 (0.4.0, carrot StepsScreen 의 보이는 모양만).
 *
 * **이 패키지는 @jcurve/steps 를 가져오지 않는다.** 걸음 수 · 단계 · 받기는 전부 props 로 받는다.
 * 옛 빌드(걸음 기능 없음)는 `stepsAvailable={false}` 로 두면 화면은 읽기만 되고, 받기 · 단추는
 * 「업데이트하면 걸음 보상을 받을 수 있어요」 안내와 onUpdate() 로 간다(2026-10-20 · 옛 빌드 충돌 방지).
 */
const react_1 = require("react");
const react_native_1 = require("react-native");
const PageFrame_1 = require("./PageFrame");
const logic_1 = require("./logic");
const DEFAULT_GUIDE = [
    '1,000걸음마다 광고 보기를 완료하면 포인트를 받아요.',
    '걸음 수와 남은 횟수는 매일 자정(한국 시간)에 초기화되고, 받지 않은 횟수는 다음 날로 넘어가지 않아요.',
    '배터리 절약 모드 등에서는 걸음 수가 정확하지 않을 수 있어요.',
    '만보기 보상과 조건은 사정에 따라 바뀔 수 있어요.',
];
function StepsPage({ todaySteps, stages, earnedToday = 0, stepsAvailable, onUpdate, onClaim, onBack, everySteps = 1000, guide = DEFAULT_GUIDE, title = '만보기', theme: themeIn, footer }) {
    const theme = (0, PageFrame_1.resolvePageTheme)(themeIn);
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [failed, setFailed] = (0, react_1.useState)(false);
    const summary = (0, logic_1.stepsSummary)(todaySteps, stages);
    const points = stages[0]?.points ?? 0;
    const first = summary.claimable[0];
    const canClaim = stepsAvailable && !!first && !busy;
    const claim = async () => {
        // 옛 빌드는 받기 대신 업데이트 창으로(carrot ensureStepsVersion 과 같은 자리)
        if (!stepsAvailable) {
            onUpdate();
            return;
        }
        if (!first || busy)
            return;
        setBusy(true);
        setFailed(false);
        try {
            await (0, logic_1.settleWithin)(Promise.resolve(onClaim(first))); // 광고가 안 돌아와도 잠금은 풀린다(0.4.3)
        }
        catch {
            setFailed(true);
        }
        finally {
            setBusy(false);
        }
    };
    return (0, jsx_runtime_1.jsxs)(PageFrame_1.PageFrame, { title: title, onBack: onBack, theme: theme, footer: footer, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.top, children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.count, { color: theme.text }], children: [todaySteps.toLocaleString(), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.unit, { color: theme.sub }], children: " \uAC78\uC74C" })] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.bubble, { backgroundColor: theme.card }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bubbleText, { color: theme.text }], children: (0, logic_1.stepsBubble)({ available: stepsAvailable, todaySteps, stages }) }) }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.tail, { backgroundColor: theme.card }] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.shoe, accessible: false, children: "\uD83D\uDC5F" })] }), !stepsAvailable ? (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.notice, { backgroundColor: theme.card }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.noticeTitle, { color: theme.text }], children: logic_1.UPDATE_NOTICE }), (0, jsx_runtime_1.jsx)(PageFrame_1.PageButton, { big: true, label: "\uC5C5\uB370\uC774\uD2B8\uD558\uAE30", theme: theme, on: true, onPress: onUpdate })] }) : null, failed ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { accessibilityLiveRegion: "polite", style: [s.message, { color: theme.sub }], children: "\uAD11\uACE0 \uD655\uC778\uC774 \uB2A6\uC5B4\uC9C0\uACE0 \uC788\uC5B4\uC694. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uB20C\uB7EC \uC8FC\uC138\uC694" }) : null, (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.claimCard, { backgroundColor: theme.card }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.claimLeft, { color: theme.text }], children: ["\uB0A8\uC740 \uD69F\uC218 ", (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.claimNum, { color: theme.accent }], children: `${stepsAvailable ? summary.claimable.length : 0}번` })] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.claimSub, { color: theme.sub }], children: `${everySteps.toLocaleString()}걸음마다 광고 보고 ${points}P · 오늘 받은 포인트 ${earnedToday}P` }), (0, jsx_runtime_1.jsx)(PageFrame_1.PageButton, { big: true, label: busy ? '확인 중…' : `광고 보고 ${points}P 받기`, theme: theme, on: canClaim || !stepsAvailable, disabled: stepsAvailable && !canClaim, onPress: () => { void claim(); } })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.guide, { backgroundColor: theme.card }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.guideTitle, { color: theme.text }], children: "\uB9CC\uBCF4\uAE30 \uC548\uB0B4\uC0AC\uD56D" }), guide.map(line => (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.guideLine, { color: theme.sub }], children: ["\u00B7 ", line] }, line))] })] });
}
const s = react_native_1.StyleSheet.create({
    top: { alignItems: 'center', paddingTop: 8 },
    count: { fontSize: 44, fontWeight: '800' },
    unit: { fontSize: 18, fontWeight: '600' },
    bubble: { marginTop: 14, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 },
    bubbleText: { fontSize: 15 },
    tail: { width: 12, height: 12, transform: [{ rotate: '45deg' }], marginTop: -6 },
    shoe: { fontSize: 96, marginTop: 4 },
    notice: { borderRadius: 16, padding: 16, gap: 10 },
    noticeTitle: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
    message: { textAlign: 'center', fontSize: 13 },
    claimCard: { marginTop: 8, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
    claimLeft: { fontSize: 18, fontWeight: '700' },
    claimNum: { fontSize: 22, fontWeight: '800' },
    claimSub: { fontSize: 13 },
    guide: { borderRadius: 16, padding: 20, gap: 6 },
    guideTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
    guideLine: { fontSize: 13, lineHeight: 20 },
});
