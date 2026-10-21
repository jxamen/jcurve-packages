"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodayMissionPage = TodayMissionPage;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * 오늘의 미션 — 여러 미션에 참여하면 보너스 (0.4.0, carrot TodayMissionScreen 그대로).
 * 완료 표시는 앱이 아는 값(done)으로 정한다. 줄 어디를 눌러도 onGo 로 간다.
 * 전부 끝나면 「모두 완료하고 {bonus}P 받기」 — onClaim 이 보너스를 주고, 실패하면 다시 누르라고 적는다.
 */
const react_1 = require("react");
const react_native_1 = require("react-native");
const PageFrame_1 = require("./PageFrame");
const logic_1 = require("./logic");
function TodayMissionPage({ rows, bonus, claimed = false, onClaim, onBack, swipeBack, title = '오늘의 미션', theme: themeIn, footer, buttonWidth = PageFrame_1.PAGE_BUTTON.width, buttonHeight = PageFrame_1.PAGE_BUTTON.height }) {
    const theme = (0, PageFrame_1.resolvePageTheme)(themeIn);
    const shown = rows.filter(r => !r.hidden);
    const progress = (0, logic_1.missionProgress)(shown);
    const [claimedNow, setClaimedNow] = (0, react_1.useState)(false);
    const [claiming, setClaiming] = (0, react_1.useState)(false);
    const [failed, setFailed] = (0, react_1.useState)(false);
    const done = claimed || claimedNow;
    const locked = claiming || !progress.allDone;
    const claim = async () => {
        if (claiming || done || !progress.allDone)
            return;
        setClaiming(true);
        setFailed(false);
        try {
            const ok = await onClaim();
            if (ok === false)
                setFailed(true);
            else
                setClaimedNow(true);
        }
        catch {
            setFailed(true);
        }
        finally {
            setClaiming(false);
        }
    };
    return (0, jsx_runtime_1.jsx)(PageFrame_1.PageFrame, { title: title, onBack: onBack, swipeBack: swipeBack, theme: theme, footer: footer, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.sheet, { backgroundColor: theme.card }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.sub, { color: theme.sub }], children: bonus > 0 ? `미션 ${progress.total}개 모두 완료하면 ${bonus.toLocaleString()}P를 드려요` : '여러 미션에 참여하면 추가 포인트를 드려요' }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.progressRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.track, { backgroundColor: theme.line }], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.fill, { width: `${progress.percent}%`, backgroundColor: theme.accent }] }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.progressText, { color: theme.sub }], children: `${progress.done}/${progress.total} 완료` })] }), shown.map(r => (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessible: false, disabled: r.done === true, onPress: () => { if (r.done !== true)
                        r.onGo(); }, style: ({ pressed }) => [s.row, pressed && r.done !== true && { opacity: 0.85 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.icon, { backgroundColor: theme.accentSoft }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.iconText, children: r.icon ?? '⭐' }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.rowText, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.rowTitle, { color: theme.text }], children: r.title }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.rowSub, { color: theme.sub }], numberOfLines: 1, children: r.sub })] }), (0, jsx_runtime_1.jsx)(PageFrame_1.PageButton, { label: r.done === true ? '완료' : '하러 가기', theme: theme, width: buttonWidth, height: buttonHeight, disabled: r.done === true, on: true, onPress: () => r.onGo() })] }, r.key)), bonus > 0 ? (done ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bonusDone, { color: theme.sub }], children: "\uBCF4\uB108\uC2A4\uB97C \uBC1B\uC558\uC5B4\uC694" }) : (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(PageFrame_1.PageButton, { big: true, label: claiming ? '…' : (0, logic_1.bonusButtonLabel)(bonus), theme: theme, disabled: locked, on: true, onPress: () => { void claim(); } }), failed ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.error, { color: theme.accent }], children: "\uBCF4\uB108\uC2A4\uB97C \uBC1B\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uB20C\uB7EC \uC8FC\uC138\uC694" }) : null] })) : null] }) });
}
const s = react_native_1.StyleSheet.create({
    sheet: { borderRadius: 22, padding: 20 },
    sub: { fontSize: 13 },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
    track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
    fill: { height: 8, borderRadius: 4 },
    progressText: { fontSize: 12, fontWeight: '700' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    iconText: { fontSize: 18 },
    rowText: { flex: 1, minWidth: 0, gap: 2 },
    rowTitle: { fontSize: 15, fontWeight: '700' },
    rowSub: { fontSize: 12 },
    bonusDone: { fontSize: 13, marginTop: 16, textAlign: 'center' },
    error: { fontSize: 12, marginTop: 8, textAlign: 'center' },
});
