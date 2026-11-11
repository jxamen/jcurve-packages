"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppHubPage = AppHubPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const PageFrame_1 = require("./PageFrame");
function AppHubPage({ apps, onBack, title = '추천 앱', emptyText = '추천 앱을 준비하고 있어요', theme: themeIn, footer }) {
    const theme = (0, PageFrame_1.resolvePageTheme)(themeIn);
    return (0, jsx_runtime_1.jsx)(PageFrame_1.PageFrame, { title: title, onBack: onBack, theme: theme, footer: footer, children: apps.length === 0 ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.empty, { color: theme.sub }], children: emptyText }) : (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.card, { backgroundColor: theme.card }], children: apps.map((app, i) => (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessible: false, onPress: app.onOpen, style: ({ pressed }) => [s.row, i < apps.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.line }, pressed && { opacity: 0.85 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.icon, { backgroundColor: theme.accentSoft }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.iconText, children: app.icon ?? '⭐' }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.text, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.name, { color: theme.text }], numberOfLines: 1, children: app.name }), app.desc ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.desc, { color: theme.sub }], numberOfLines: 1, children: app.desc }) : null] }), (0, jsx_runtime_1.jsx)(PageFrame_1.PageButton, { label: "\uBCF4\uB7EC\uAC00\uAE30", theme: theme, on: true, onPress: app.onOpen })] }, app.key)) }) });
}
const s = react_native_1.StyleSheet.create({
    card: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
    empty: { fontSize: 14, textAlign: 'center', marginTop: 24 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    iconText: { fontSize: 22 },
    text: { flex: 1, minWidth: 0, gap: 2 },
    name: { fontSize: 15, fontWeight: '700' },
    desc: { fontSize: 12 },
});
