"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenefitQuickList = BenefitQuickList;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const colors = {
    calendar: '#2F6FD6', bag: '#D2551E', pin: '#2E8B57',
    star: '#B7791F', ticket: '#7A4FD0', friend: '#C2410C',
};
/** Pure RN shapes: no additional native dependency. Supply a ReactNode for branded icons. */
function Icon({ icon }) {
    if (typeof icon !== 'string' || !(icon in colors))
        return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: icon });
    const name = icon;
    const color = colors[name];
    const line = { borderColor: color, borderWidth: 2 };
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { accessible: false, style: s.iconDrawing, children: [name === 'calendar' ? (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [line, s.calendar], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.calendarLine, { backgroundColor: color }] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.check, { borderColor: color }] })] }) : null, name === 'bag' ? (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.handle] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.bag] })] }) : null, name === 'pin' ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.pin], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.dot] }) }) : null, name === 'star' ? (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.diamond] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.diamond, { transform: [{ rotate: '0deg' }] }] })] }) : null, name === 'ticket' ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.ticket], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.ticketLine, { borderColor: color }] }) }) : null, name === 'friend' ? (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.head] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.shoulders] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.plusH, { backgroundColor: color }] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.plusV, { backgroundColor: color }] })] }) : null] });
}
function BenefitQuickList({ title = '바로 받는 혜택', seeAllLabel, onSeeAll, accentColor = '#EE7A33', items, footer, doneLabel = '완료', buttonWidth = 100 }) {
    const visible = items.filter(item => !item.hidden);
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.root, children: [title || (seeAllLabel && onSeeAll) ? (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.header, children: [title ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.title, children: title }) : (0, jsx_runtime_1.jsx)(react_native_1.View, {}), seeAllLabel && onSeeAll ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", onPress: onSeeAll, hitSlop: 8, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.seeAll, { color: accentColor }], children: seeAllLabel }) }) : null] }) : null, (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.card, children: visible.map((item, index) => (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.row, index < visible.length - 1 && s.border], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.icon, { backgroundColor: item.tint }], children: (0, jsx_runtime_1.jsx)(Icon, { icon: item.icon }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.copy, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.nameRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.name, children: item.title }), item.badge ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.badge, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.badgeText, children: item.badge }) }) : null] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.subtitle, numberOfLines: 1, adjustsFontSizeToFit: true, children: item.subtitle })] }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: item.title + ', ' + (item.done ? doneLabel : item.ctaLabel), accessibilityState: { disabled: !!item.done }, disabled: item.done, onPress: () => { if (!item.done)
                                item.onPress(); }, style: ({ pressed }) => [s.button, { width: buttonWidth, backgroundColor: item.done ? '#D3D7DD' : accentColor }, pressed && !item.done && { opacity: 0.8 }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.cta, numberOfLines: 1, adjustsFontSizeToFit: true, children: item.done ? doneLabel : item.ctaLabel }) })] }, item.key)) }), footer != null ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.footer, children: footer }) : null] });
}
const s = react_native_1.StyleSheet.create({
    root: { gap: 10 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
    title: { fontSize: 19, fontWeight: '700', color: '#2B2118', flexShrink: 1 }, seeAll: { fontSize: 13 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, border: { borderBottomWidth: 1, borderBottomColor: '#F3EBE1' },
    icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    copy: { flex: 1, minWidth: 0, gap: 2 }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }, badge: { backgroundColor: '#FFFFFF', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }, badgeText: { fontSize: 9, fontWeight: '900', color: '#E2600F' }, name: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: '#2B2118' }, subtitle: { fontSize: 13, color: '#6B5E52' },
    button: { flexShrink: 0, height: 40, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, cta: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' }, footer: { marginTop: 4 },
    iconDrawing: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
    calendar: { width: 18, height: 17, borderRadius: 3 }, calendarLine: { height: 2, marginTop: 3 }, check: { width: 8, height: 5, borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '-45deg' }], marginLeft: 4, marginTop: 2 },
    bag: { width: 16, height: 14, borderRadius: 2, marginTop: 5 }, handle: { position: 'absolute', top: 1, width: 8, height: 9, borderRadius: 5 },
    pin: { width: 16, height: 19, borderRadius: 9, borderBottomRightRadius: 1, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' }, dot: { width: 6, height: 6, borderRadius: 3 },
    diamond: { position: 'absolute', width: 13, height: 13, transform: [{ rotate: '45deg' }] }, ticket: { width: 20, height: 14, borderRadius: 3 }, ticketLine: { height: 10, borderLeftWidth: 1, borderStyle: 'dashed', marginLeft: 6 },
    head: { position: 'absolute', top: 1, left: 4, width: 8, height: 8, borderRadius: 4 }, shoulders: { position: 'absolute', bottom: 1, left: 1, width: 15, height: 9, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomWidth: 0 }, plusH: { position: 'absolute', right: 0, top: 9, width: 7, height: 2 }, plusV: { position: 'absolute', right: 2.5, top: 6.5, height: 7, width: 2 },
});
