"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_THEME = void 0;
exports.MissionState = MissionState;
exports.MissionLoading = MissionLoading;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const i18n_1 = require("./i18n");
const copy_1 = require("./copy");
exports.DEFAULT_THEME = { bg: '#FFFFFF', card: '#F5F6F8', text: '#191F28', sub: '#6B7684', accent: '#2F6BFF', accentText: '#FFFFFF', line: '#E5E8EB' };
function MissionState({ kind, theme = exports.DEFAULT_THEME, window, onRetry, onClose, lang }) {
    const c = (0, copy_1.stateCopy)(kind, lang);
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.wrap, { backgroundColor: theme.bg }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { accessibilityRole: "header", style: [s.title, { color: theme.text }], children: c.title }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.body, { color: theme.sub }], children: c.body }), c.windowLabel && window ? (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.box, { borderColor: theme.line }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.boxLabel, { color: theme.sub }], children: c.windowLabel }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.boxText, { color: theme.text }], children: window })] }) : null, c.button && onRetry ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", onPress: onRetry, style: [s.btn, { backgroundColor: theme.accent }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.btnText, { color: theme.accentText }], children: c.button }) }) : null, onClose ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", onPress: onClose, style: s.link, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.linkText, { color: theme.sub }], children: (0, i18n_1.t)('닫기', lang) }) }) : null] });
}
function MissionLoading({ theme = exports.DEFAULT_THEME, lang }) {
    return (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.wrap, { backgroundColor: theme.bg }], children: (0, jsx_runtime_1.jsx)(react_native_1.ActivityIndicator, { color: theme.accent, accessibilityLabel: (0, i18n_1.t)('불러오는 중', lang) }) });
}
const s = react_native_1.StyleSheet.create({
    wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
    title: { fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' },
    body: { fontSize: 15, lineHeight: 23, textAlign: 'center' },
    btn: { minHeight: 50, minWidth: 160, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 8 },
    btnText: { fontSize: 16, fontWeight: '700' },
    box: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', gap: 2, marginTop: 4 },
    boxLabel: { fontSize: 13 },
    boxText: { fontSize: 16, fontWeight: '700' },
    link: { minHeight: 44, justifyContent: 'center' },
    linkText: { fontSize: 14, textDecorationLine: 'underline' },
});
