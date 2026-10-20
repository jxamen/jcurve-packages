"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAGE_BUTTON = exports.DEFAULT_PAGE_THEME = void 0;
exports.resolvePageTheme = resolvePageTheme;
exports.PageFrame = PageFrame;
exports.PageButton = PageButton;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
exports.DEFAULT_PAGE_THEME = {
    bg: '#FBF7F2', card: '#FFFFFF', text: '#2B2118', sub: '#6B5E52', accent: '#EE7A33', accentText: '#FFFFFF',
    accentSoft: '#FDE6D6', line: '#F3EBE1', done: '#D3D7DD', itemName: '아이템',
};
/** 앱이 일부만 넘기면 나머지는 기본값 — `character` · `itemIcon` 은 기본이 없다 */
function resolvePageTheme(theme) {
    return { ...exports.DEFAULT_PAGE_THEME, ...(theme ?? {}) };
}
/** 줄 버튼 기본 크기 72x34(2026-10-19 당근 대표님 「버튼 사이즈 좀 더 작게」「가로 줄이라니까」) */
exports.PAGE_BUTTON = { width: 72, height: 34 };
/**
 * 독립 페이지 공통 틀 — 상단 「‹ 제목」 한 줄 · 안드로이드 뒤로 가기 → onBack · 본문 스크롤 · 맨 아래 광고 자리(footer).
 * 상태 표시줄 안전영역은 앱 바깥 틀이 잡는다(carrot PageHeader 와 같은 규칙).
 */
function PageFrame({ title, onBack, theme, footer, children }) {
    (0, react_1.useEffect)(() => {
        const sub = react_native_1.BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
        return () => sub.remove();
    }, [onBack]);
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.root, { backgroundColor: theme.bg }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.header, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB4A4\uB85C", hitSlop: 12, onPress: onBack, style: s.side, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.back, { color: theme.text }], children: "\u2039" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.title, { color: theme.text }], numberOfLines: 1, children: title }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.side })] }), (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { contentContainerStyle: s.content, children: [children, footer != null ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.footer, children: footer }) : null] })] });
}
/** 줄 · 카드 안의 작은 버튼 — 기본 72x34, 끝난 상태는 `done` 바탕 */
function PageButton({ label, onPress, disabled, theme, width = exports.PAGE_BUTTON.width, height = exports.PAGE_BUTTON.height, on = true, big = false }) {
    const bg = disabled ? theme.done : on ? theme.accent : theme.accentSoft;
    const fg = disabled ? theme.sub : on ? theme.accentText : theme.sub;
    return (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: label, accessibilityState: { disabled: !!disabled }, disabled: disabled, onPress: onPress, style: ({ pressed }) => [s.button, big ? s.big : { width, height }, { backgroundColor: bg }, pressed && !disabled && { opacity: 0.8 }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [big ? s.bigText : s.buttonText, { color: fg }], numberOfLines: 1, adjustsFontSizeToFit: true, children: label }) });
}
const s = react_native_1.StyleSheet.create({
    root: { flex: 1 },
    header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
    side: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    back: { fontSize: 32, marginTop: -4 },
    title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    footer: { marginTop: 16 },
    button: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    buttonText: { fontSize: 14, fontWeight: '700' },
    big: { alignSelf: 'stretch', height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    bigText: { fontSize: 16, fontWeight: '800' },
});
