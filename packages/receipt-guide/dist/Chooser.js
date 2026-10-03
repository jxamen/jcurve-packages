"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chooser = Chooser;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const data_1 = require("./data");
const ui_1 = require("./ui");
function Chooser({ remembered, onGuide, onQuick, quickDisabled, paper }) {
    const theme = (0, ui_1.useGuideTheme)();
    const last = remembered && remembered !== 'paper' ? (0, data_1.guideOf)(remembered) : null;
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.card, { backgroundColor: theme.card, borderColor: theme.line }], children: [(0, jsx_runtime_1.jsx)(ui_1.T, { size: 18, w: 900, children: "\uC5B4\uB5A4 \uC601\uC218\uC99D\uC744 \uC62C\uB9AC\uB098\uC694?" }), (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14.5, w: 700, color: theme.sub, lh: 21, style: { marginTop: 2 }, children: "\uC571 \uC601\uC218\uC99D\uC740 \uACE0\uB974\uBA74 \uC62C\uB9AC\uB294 \uBC95\uC744 \uBA3C\uC800 \uBCF4\uC5EC \uC918\uC694. \u300C2\uC7A5\u300D\uC740 \uCEA1\uCC98 2\uC7A5\uC744 \uD568\uAED8 \uC62C\uB824\uC57C \uD574\uC694" }), last ? ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.quick, { backgroundColor: theme.brandSoft }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [ui_1.row, { gap: 8 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.dot, { backgroundColor: last.accent }] }), (0, jsx_runtime_1.jsxs)(ui_1.T, { size: 15, w: 800, style: { flexShrink: 1 }, children: ["\uC9C0\uB09C\uBC88 ", last.name] }), (0, data_1.needsTwo)(last.app) ? (0, jsx_runtime_1.jsx)(ui_1.TwoBadge, {}) : null, (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { flex: 1 } }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: last.name + ' 바로 올리기', disabled: quickDisabled, onPress: () => onQuick(last.app), style: ({ pressed }) => [s.quickBtn, { backgroundColor: theme.brand, opacity: quickDisabled ? 0.5 : pressed ? 0.85 : 1 }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 900, color: theme.white, children: "\uBC14\uB85C \uC62C\uB9AC\uAE30" }) })] }), last.pickHint ? (0, jsx_runtime_1.jsx)(ui_1.T, { size: 13.5, w: 700, color: theme.brand, style: { marginTop: 6 }, children: last.pickHint }) : null] })) : null, (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.grid, children: data_1.GUIDES.map((g) => {
                    const on = remembered === g.app;
                    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.cell, children: (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: g.name + ' 영수증 올리는 법', onPress: () => onGuide(g.app), style: ({ pressed }) => [s.tile, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brandSoft : theme.card, opacity: pressed ? 0.8 : 1 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.dot, { backgroundColor: g.accent }] }), (0, jsx_runtime_1.jsx)(ui_1.T, { size: g.name.length > 6 ? 13.5 : 15, w: 800, lines: 1, children: g.name }), (0, data_1.needsTwo)(g.app) ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.badge, children: (0, jsx_runtime_1.jsx)(ui_1.TwoBadge, {}) }) : null] }) }, g.app));
                }) }), (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 900, style: { marginTop: 14, marginBottom: 8 }, children: "\uC885\uC774 \uC601\uC218\uC99D" }), paper] }));
}
const s = react_native_1.StyleSheet.create({
    card: { borderWidth: 1.5, borderRadius: 20, padding: 16 },
    quick: { marginTop: 12, borderRadius: 14, padding: 12 },
    quickBtn: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -4 },
    cell: { width: '33.33%', padding: 4 },
    tile: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 6 },
    badge: { position: 'absolute', top: -6, right: -4 },
    dot: { width: 10, height: 10, borderRadius: 5 },
});
