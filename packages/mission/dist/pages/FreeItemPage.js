"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreeItemPage = FreeItemPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const PageFrame_1 = require("./PageFrame");
const logic_1 = require("./logic");
function FreeItemPage({ slots, onClaim, onBack, swipeBack, title, subtitle, theme: themeIn, footer, buttonWidth = PageFrame_1.PAGE_BUTTON.width, buttonHeight = PageFrame_1.PAGE_BUTTON.height }) {
    const theme = (0, PageFrame_1.resolvePageTheme)(themeIn);
    const item = theme.itemName ?? '아이템';
    const count = (0, logic_1.slotCount)(slots);
    return (0, jsx_runtime_1.jsx)(PageFrame_1.PageFrame, { title: title ?? `무료 ${item} 받기`, onBack: onBack, swipeBack: swipeBack, theme: theme, footer: footer, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.card, { backgroundColor: theme.card }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.head, children: [theme.itemIcon != null ? (0, jsx_runtime_1.jsx)(react_native_1.View, { accessible: false, style: s.icon, children: theme.itemIcon }) : null, (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.cardTitle, { color: theme.text }], children: title ?? `무료 ${item} 받기` })] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.sub, { color: theme.sub }], children: subtitle ?? `하루 ${slots.length}번 들르면 ${item} 받기` }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.sectionHead, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.sectionLabel, { color: theme.sub }], children: `오늘 ${slots.length}번 들르기` }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.count, { color: theme.accent }], children: `${count.done}/${count.total}` })] }), slots.map(slot => (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.row, { borderTopColor: theme.line }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.left, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.name, { color: theme.text }], children: (0, logic_1.slotWindowLabel)(slot) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.status, { color: theme.sub }, slot.missed && !slot.done && s.missed], children: (0, logic_1.slotStatusLine)(slot, item) })] }), (0, jsx_runtime_1.jsx)(PageFrame_1.PageButton, { label: (0, logic_1.slotButtonLabel)(slot), theme: theme, width: buttonWidth, height: buttonHeight, on: slot.claimable, disabled: !slot.claimable, onPress: () => { if (slot.claimable)
                                void onClaim(slot.id); } })] }, slot.id))] }) });
}
const s = react_native_1.StyleSheet.create({
    card: { borderRadius: 20, padding: 18, gap: 8 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    icon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 19, fontWeight: '800', flexShrink: 1 },
    sub: { fontSize: 13, lineHeight: 19 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    sectionLabel: { fontSize: 13, fontWeight: '800' },
    count: { fontSize: 13, fontWeight: '800' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10, borderTopWidth: 1 },
    left: { flex: 1, minWidth: 0, gap: 2 },
    name: { fontSize: 16, fontWeight: '700' },
    status: { fontSize: 12 },
    missed: { textDecorationLine: 'line-through' },
});
