"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotCtx = void 0;
exports.MockScreen = MockScreen;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * 가짜 앱 화면 — data.ts 의 줄(MockNode)을 막대 · 둥근 카드 · 글자로 그린다.
 *
 * 진짜 앱의 로고 · 그림은 쓰지 않는다. 앱 색(accent)은 탭 밑줄 · 칩 · 채운 버튼에만 옅게 쓴다.
 * 누를 곳(`tap`)은 `Spot` 으로 감싼다 — 재생기가 그 자리를 재어 손가락을 보낸다.
 */
const react_1 = require("react");
const react_native_1 = require("react-native");
const ui_1 = require("./ui");
/** 누를 곳이 그려지면 재생기에 알린다 */
exports.SpotCtx = (0, react_1.createContext)(null);
/** 누를 곳 — 테두리로 표시하고 자리를 알린다 */
function Spot({ children, style, r = 10 }) {
    const report = (0, react_1.useContext)(exports.SpotCtx);
    const theme = (0, ui_1.useGuideTheme)();
    const ref = (0, react_1.useRef)(null);
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { ref: ref, collapsable: false, style: style, onLayout: () => report?.(ref.current), children: [children, (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: [react_native_1.StyleSheet.absoluteFill, { borderRadius: r, borderWidth: 3, borderColor: theme.hot }] })] }));
}
/** 누를 곳이면 Spot, 아니면 그냥 */
function Maybe({ on, children, style, r }) {
    return on ? (0, jsx_runtime_1.jsx)(Spot, { style: style, r: r, children: children }) : (0, jsx_runtime_1.jsx)(react_native_1.View, { style: style, children: children });
}
const GRAY = '#EEF0F4';
const soft = (hex) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex + '1F' : GRAY);
function MockScreen({ nodes, accent, scrolled }) {
    const theme = (0, ui_1.useGuideTheme)();
    const nav = nodes.find((n) => n.type === 'nav');
    const menu = nodes.find((n) => n.type === 'menu');
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1, backgroundColor: theme.card }, children: [scrolled ? ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.scrolled, { borderColor: theme.line }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 13, w: 700, color: theme.sub, children: "\u22EF \uC704\uC5D0\uC11C \uC774\uC5B4\uC838\uC694" }) })) : null, (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { flex: 1, paddingBottom: nav ? 58 : 0 }, children: nodes.map((n, i) => (n.type === 'nav' || n.type === 'menu' ? null : (0, jsx_runtime_1.jsx)(Node, { node: n, accent: accent }, i))) }), nav ? (0, jsx_runtime_1.jsx)(Nav, { node: nav, accent: accent }) : null, menu ? (0, jsx_runtime_1.jsx)(Menu, { node: menu }) : null] }));
}
function Node({ node, accent }) {
    const theme = (0, ui_1.useGuideTheme)();
    switch (node.type) {
        case 'header':
            return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [ui_1.row, s.header, { borderColor: theme.line, gap: 6 }], children: [node.back ? (0, jsx_runtime_1.jsx)(ui_1.T, { size: 20, w: 700, color: theme.sub, children: "\u2039" }) : null, node.left ? ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === 'left', r: 8, children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 900, color: accent, style: { paddingHorizontal: 8, paddingVertical: 3 }, children: node.left }) })) : null, (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15.5, w: 900, center: true, lines: 1, style: { flex: 1 }, children: node.title }), node.right ? ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === 'right', r: 8, children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: 800, color: theme.text, style: { paddingHorizontal: 8, paddingVertical: 3 }, children: node.right }) })) : null, node.close ? (0, jsx_runtime_1.jsx)(ui_1.T, { size: 16, w: 700, color: theme.sub, children: "\u2715" }) : null, !node.back && !node.left ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { width: 8 } }) : null] }));
        case 'tabs':
            return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [ui_1.row, { borderBottomWidth: 1, borderColor: theme.line }], children: node.items.map((label, i) => ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === i, style: { flex: 1 }, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.tab, { borderColor: node.on === i ? accent : 'transparent' }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: node.on === i ? 900 : 700, color: node.on === i ? theme.text : theme.sub, children: label }) }) }, label))) }));
        case 'chips':
            return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [ui_1.row, s.pad, { gap: 8, flexWrap: 'wrap' }], children: node.items.map((label, i) => ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === i, r: 999, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.chip, { borderColor: node.on === i ? accent : theme.line, backgroundColor: node.on === i ? soft(accent) : theme.card }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 13.5, w: node.on === i ? 900 : 700, color: node.on === i ? theme.text : theme.sub, children: label }) }) }, label))) }));
        case 'section': {
            const title = (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 900, lines: 1, style: { flexShrink: 1 }, children: node.title });
            return ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === 'title', style: { marginHorizontal: 8, marginTop: 10 }, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [ui_1.row, { paddingHorizontal: 6, paddingVertical: 4, gap: 8 }], children: [title, (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { flex: 1 } }), (node.links ?? []).map((link, i) => ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === i, children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 13.5, w: 800, color: theme.sub, style: { paddingHorizontal: 4, paddingVertical: 2 }, children: link }) }, link)))] }) }));
        }
        case 'order':
            return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.card, { borderColor: theme.line, opacity: node.dim ? 0.45 : 1 }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [ui_1.row, { gap: 8 }], children: [(0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 900, lines: 1, style: { flex: 1 }, children: node.shop }), node.corner ? ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === 'corner', children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 13.5, w: 800, color: theme.sub, style: { paddingHorizontal: 6, paddingVertical: 3 }, children: node.corner }) })) : null] }), (0, jsx_runtime_1.jsx)(ui_1.T, { size: 13, w: 700, color: theme.sub, style: { marginTop: 3 }, children: node.meta }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [ui_1.row, { marginTop: 6, gap: 8 }], children: [node.amount ? (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 900, style: { flex: 1 }, children: node.amount }) : (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { flex: 1 } }), node.button && node.small ? ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === 'button', r: 8, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.smallBtn, { borderColor: theme.line }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 13, w: 800, children: node.button }) }) })) : null, node.more ? ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === 'more', r: 8, children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 18, w: 900, color: theme.sub, style: { paddingHorizontal: 8 }, children: "\u2026" }) })) : null] }), node.button && !node.small ? ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === 'button', style: { marginTop: 8 }, r: 8, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.wideBtn, { borderColor: theme.line }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: 800, children: node.button }) }) })) : null] }));
        case 'rows':
            return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.pad, { gap: 5, marginTop: 6 }], children: node.rows.map(([k, v], i) => {
                    const strong = node.strong === i;
                    return ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === i, r: 6, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [ui_1.row, { paddingHorizontal: 4, paddingVertical: 1 }, strong && { borderTopWidth: 1, borderColor: theme.line, paddingTop: 6, marginTop: 2 }], children: [(0, jsx_runtime_1.jsx)(ui_1.T, { size: strong ? 14.5 : 13.5, w: strong ? 900 : 700, color: strong ? theme.text : theme.sub, style: { flex: 1 }, children: k }), (0, jsx_runtime_1.jsx)(ui_1.T, { size: strong ? 15 : 13.5, w: strong ? 900 : 700, lines: 1, children: v })] }) }, k + i));
                }) }));
        case 'buttons':
            return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [ui_1.row, s.pad, { gap: 8, marginTop: 12 }], children: node.items.map((label, i) => {
                    const solid = node.solid === i;
                    return ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === i, style: { flex: 1 }, r: 10, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.wideBtn, { borderColor: solid ? accent : theme.line, backgroundColor: solid ? accent : theme.card }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: 900, color: solid ? theme.white : theme.text, children: label }) }) }, label));
                }) }));
        case 'album':
            return (0, jsx_runtime_1.jsx)(Album, { pick: node.pick });
        case 'bars':
            return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.pad, { marginTop: 8 }], children: Array.from({ length: node.n ?? 3 }).map((_, i) => ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: { width: `${[92, 70, 84, 58, 76][i % 5]}%`, height: 10, borderRadius: 5, backgroundColor: GRAY, marginTop: 9 } }, i))) }));
        default:
            return null;
    }
}
/** 사진첩 — 고를 사진(영수증)에는 고른 순서 번호 */
function Album({ pick }) {
    const theme = (0, ui_1.useGuideTheme)();
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [ui_1.row, { flexWrap: 'wrap', padding: 4 }], children: Array.from({ length: 12 }).map((_, i) => {
            const order = pick.indexOf(i);
            const tile = order >= 0 ? ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.photo, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line, padding: 8 }], children: [[80, 60, 70, 50, 75].map((w, k) => (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { width: `${w}%`, height: 5, borderRadius: 3, backgroundColor: GRAY, marginTop: 5 } }, k)), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.badge, { backgroundColor: theme.hot }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 13, w: 900, color: theme.white, children: order + 1 }) })] })) : (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.photo, { backgroundColor: GRAY }] });
            return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: { width: '33.33%', padding: 3 }, children: order === 0 ? (0, jsx_runtime_1.jsx)(Spot, { r: 6, children: tile }) : tile }, i));
        }) }));
}
/** 아래 탭 막대 */
function Nav({ node, accent }) {
    const theme = (0, ui_1.useGuideTheme)();
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [ui_1.row, s.nav, { borderColor: theme.line, backgroundColor: theme.card }], children: node.items.map((item, i) => {
            const on = node.on === i;
            const color = on ? accent : theme.sub;
            const label = typeof item === 'string' ? item : item.label;
            const icon = typeof item === 'string'
                ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { width: 18, height: 18, borderRadius: 5, backgroundColor: on ? accent : GRAY } })
                : (0, jsx_runtime_1.jsx)(Person, { color: on ? accent : theme.sub });
            return ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === i, style: { flex: 1 }, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { alignItems: 'center', paddingVertical: 6, gap: 3 }, children: [icon, typeof item === 'string' ? (0, jsx_runtime_1.jsx)(ui_1.T, { size: 11.5, w: on ? 900 : 700, color: color, lines: 1, children: label }) : (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { height: 14 } })] }) }, label + i));
        }) }));
}
/** 사람 모양 — 글자 없이 그림으로만 알아보는 탭(쿠팡 마이쿠팡) */
function Person({ color }) {
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { width: 20, height: 18, alignItems: 'center' }, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: color } }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { width: 16, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 2, borderBottomWidth: 0, borderColor: color, marginTop: 1 } })] }));
}
/** 아래에서 올라온 창 — 뒤는 어둡게 */
function Menu({ node }) {
    const theme = (0, ui_1.useGuideTheme)();
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [react_native_1.StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }], children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.sheet, { backgroundColor: theme.card }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: GRAY, marginBottom: 8 } }), node.items.map((label, i) => ((0, jsx_runtime_1.jsx)(Maybe, { on: node.tap === i, r: 8, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { paddingVertical: 12, paddingHorizontal: 10 }, children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 800, children: label }) }) }, label)))] }) }));
}
const s = react_native_1.StyleSheet.create({
    pad: { paddingHorizontal: 14 },
    header: { height: 46, paddingHorizontal: 12, borderBottomWidth: 1 },
    scrolled: { height: 26, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderStyle: 'dashed' },
    tab: { alignItems: 'center', paddingVertical: 11, borderBottomWidth: 3 },
    chip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginTop: 10 },
    card: { marginHorizontal: 12, marginTop: 10, borderWidth: 1.5, borderRadius: 14, padding: 12 },
    smallBtn: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
    wideBtn: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    photo: { aspectRatio: 1, borderRadius: 6 },
    badge: { position: 'absolute', right: 4, top: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    nav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 58, borderTopWidth: 1 },
    sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 12, paddingBottom: 18 },
});
