"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotCtx = void 0;
exports.MockScreen = MockScreen;
/**
 * 가짜 앱 화면 — data.ts 의 줄(MockNode)을 막대 · 둥근 카드 · 글자로 그린다.
 *
 * 진짜 앱의 로고 · 그림은 쓰지 않는다. 앱 색(accent)은 탭 밑줄 · 칩 · 채운 버튼에만 옅게 쓴다.
 * 누를 곳(`tap`)은 `Spot` 으로 감싼다 — 재생기가 그 자리를 재어 손가락을 보낸다.
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const ui_1 = require("./ui");
exports.SpotCtx = (0, react_1.createContext)(null);
/**
 * 누를 곳 — **두꺼운 테두리 + 옅은 면이 함께 깜빡이고 살짝 커진다**(대표님 10-03 23:51 「영역 껌벅껌벅, 눈에 잘 띄게」).
 * 테두리는 바깥으로 4px 내서 원래 버튼 테두리와 겹쳐 묻히지 않게 한다.
 */
function Spot({ children, style, r = 10 }) {
    const link = (0, react_1.useContext)(exports.SpotCtx);
    const theme = (0, ui_1.useGuideTheme)();
    const ref = (0, react_1.useRef)(null);
    return (react_1.default.createElement(react_native_1.View, { ref: ref, collapsable: false, style: style, onLayout: () => link?.report(ref.current) },
        children,
        react_1.default.createElement(react_native_1.Animated.View, { pointerEvents: "none", style: [s.glow, {
                    borderRadius: r + 4, borderColor: theme.hot,
                    opacity: link?.glowOp ?? 1, transform: [{ scale: link?.glowSc ?? 1 }],
                }] },
            react_1.default.createElement(react_native_1.View, { style: [react_native_1.StyleSheet.absoluteFill, { backgroundColor: theme.hot, opacity: 0.16 }] }))));
}
/** 누를 곳이면 Spot, 아니면 그냥 */
function Maybe({ on, children, style, r }) {
    return on ? react_1.default.createElement(Spot, { style: style, r: r }, children) : react_1.default.createElement(react_native_1.View, { style: style }, children);
}
const GRAY = '#EEF0F4';
const soft = (hex) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex + '1F' : GRAY);
function MockScreen({ nodes, accent, scrolled }) {
    const theme = (0, ui_1.useGuideTheme)();
    const nav = nodes.find((n) => n.type === 'nav');
    const menu = nodes.find((n) => n.type === 'menu');
    return (react_1.default.createElement(react_native_1.View, { style: { flex: 1, backgroundColor: theme.card } },
        scrolled ? (react_1.default.createElement(react_native_1.View, { style: [s.scrolled, { borderColor: theme.line }] },
            react_1.default.createElement(ui_1.T, { size: 13, w: 700, color: theme.sub }, "\u22EF \uC704\uC5D0\uC11C \uC774\uC5B4\uC838\uC694"))) : null,
        react_1.default.createElement(react_native_1.View, { style: { flex: 1, paddingBottom: nav ? 58 : 0 } }, nodes.map((n, i) => (n.type === 'nav' || n.type === 'menu' ? null : react_1.default.createElement(Node, { key: i, node: n, accent: accent })))),
        nav ? react_1.default.createElement(Nav, { node: nav, accent: accent }) : null,
        menu ? react_1.default.createElement(Menu, { node: menu }) : null));
}
function Node({ node, accent }) {
    const theme = (0, ui_1.useGuideTheme)();
    switch (node.type) {
        case 'header':
            return (react_1.default.createElement(react_native_1.View, { style: [ui_1.row, s.header, { borderColor: theme.line, gap: 6 }] },
                node.back ? react_1.default.createElement(ui_1.T, { size: 20, w: 700, color: theme.sub }, "\u2039") : null,
                node.left ? (react_1.default.createElement(Maybe, { on: node.tap === 'left', r: 8 },
                    react_1.default.createElement(ui_1.T, { size: 15, w: 900, color: accent, style: { paddingHorizontal: 8, paddingVertical: 3 } }, node.left))) : null,
                react_1.default.createElement(ui_1.T, { size: 15.5, w: 900, center: true, lines: 1, style: { flex: 1 } }, node.title),
                node.right ? (react_1.default.createElement(Maybe, { on: node.tap === 'right', r: 8 },
                    react_1.default.createElement(ui_1.T, { size: 14, w: 800, color: theme.text, style: { paddingHorizontal: 8, paddingVertical: 3 } }, node.right))) : null,
                node.close ? react_1.default.createElement(ui_1.T, { size: 16, w: 700, color: theme.sub }, "\u2715") : null,
                !node.back && !node.left ? react_1.default.createElement(react_native_1.View, { style: { width: 8 } }) : null));
        case 'tabs':
            return (react_1.default.createElement(react_native_1.View, { style: [ui_1.row, { borderBottomWidth: 1, borderColor: theme.line }] }, node.items.map((label, i) => (react_1.default.createElement(Maybe, { key: label, on: node.tap === i, style: { flex: 1 } },
                react_1.default.createElement(react_native_1.View, { style: [s.tab, { borderColor: node.on === i ? accent : 'transparent' }] },
                    react_1.default.createElement(ui_1.T, { size: 14, w: node.on === i ? 900 : 700, color: node.on === i ? theme.text : theme.sub }, label)))))));
        case 'chips':
            return (react_1.default.createElement(react_native_1.View, { style: [ui_1.row, s.pad, { gap: 8, flexWrap: 'wrap' }] }, node.items.map((label, i) => (react_1.default.createElement(Maybe, { key: label, on: node.tap === i, r: 999 },
                react_1.default.createElement(react_native_1.View, { style: [s.chip, { borderColor: node.on === i ? accent : theme.line, backgroundColor: node.on === i ? soft(accent) : theme.card }] },
                    react_1.default.createElement(ui_1.T, { size: 13.5, w: node.on === i ? 900 : 700, color: node.on === i ? theme.text : theme.sub }, label)))))));
        case 'section': {
            const title = react_1.default.createElement(ui_1.T, { size: 15, w: 900, lines: 1, style: { flexShrink: 1 } }, node.title);
            return (react_1.default.createElement(Maybe, { on: node.tap === 'title', style: { marginHorizontal: 8, marginTop: 10 } },
                react_1.default.createElement(react_native_1.View, { style: [ui_1.row, { paddingHorizontal: 6, paddingVertical: 4, gap: 8 }] },
                    title,
                    react_1.default.createElement(react_native_1.View, { style: { flex: 1 } }),
                    (node.links ?? []).map((link, i) => (react_1.default.createElement(Maybe, { key: link, on: node.tap === i },
                        react_1.default.createElement(ui_1.T, { size: 13.5, w: 800, color: theme.sub, style: { paddingHorizontal: 4, paddingVertical: 2 } }, link)))))));
        }
        case 'order':
            return (react_1.default.createElement(react_native_1.View, { style: [s.card, { borderColor: theme.line, opacity: node.dim ? 0.45 : 1 }] },
                react_1.default.createElement(react_native_1.View, { style: [ui_1.row, { gap: 8 }] },
                    react_1.default.createElement(ui_1.T, { size: 15, w: 900, lines: 1, style: { flex: 1 } }, node.shop),
                    node.corner ? (react_1.default.createElement(Maybe, { on: node.tap === 'corner' },
                        react_1.default.createElement(ui_1.T, { size: 13.5, w: 800, color: theme.sub, style: { paddingHorizontal: 6, paddingVertical: 3 } }, node.corner))) : null),
                react_1.default.createElement(ui_1.T, { size: 13, w: 700, color: theme.sub, style: { marginTop: 3 } }, node.meta),
                react_1.default.createElement(react_native_1.View, { style: [ui_1.row, { marginTop: 6, gap: 8 }] },
                    node.amount ? react_1.default.createElement(ui_1.T, { size: 15, w: 900, style: { flex: 1 } }, node.amount) : react_1.default.createElement(react_native_1.View, { style: { flex: 1 } }),
                    node.button && node.small ? (react_1.default.createElement(Maybe, { on: node.tap === 'button', r: 8 },
                        react_1.default.createElement(react_native_1.View, { style: [s.smallBtn, { borderColor: theme.line }] },
                            react_1.default.createElement(ui_1.T, { size: 13, w: 800 }, node.button)))) : null,
                    node.more ? (react_1.default.createElement(Maybe, { on: node.tap === 'more', r: 8 },
                        react_1.default.createElement(ui_1.T, { size: 18, w: 900, color: theme.sub, style: { paddingHorizontal: 8 } }, "\u2026"))) : null),
                node.button && !node.small ? (react_1.default.createElement(Maybe, { on: node.tap === 'button', style: { marginTop: 8 }, r: 8 },
                    react_1.default.createElement(react_native_1.View, { style: [s.wideBtn, { borderColor: theme.line }] },
                        react_1.default.createElement(ui_1.T, { size: 14, w: 800 }, node.button)))) : null));
        case 'rows':
            return (react_1.default.createElement(react_native_1.View, { style: [s.pad, { gap: 5, marginTop: 6 }] }, node.rows.map(([k, v], i) => {
                const strong = node.strong === i;
                return (react_1.default.createElement(Maybe, { key: k + i, on: node.tap === i, r: 6 },
                    react_1.default.createElement(react_native_1.View, { style: [ui_1.row, { paddingHorizontal: 4, paddingVertical: 1 }, strong && { borderTopWidth: 1, borderColor: theme.line, paddingTop: 6, marginTop: 2 }] },
                        react_1.default.createElement(ui_1.T, { size: strong ? 14.5 : 13.5, w: strong ? 900 : 700, color: strong ? theme.text : theme.sub, style: { flex: 1 } }, k),
                        react_1.default.createElement(ui_1.T, { size: strong ? 15 : 13.5, w: strong ? 900 : 700, lines: 1 }, v))));
            })));
        case 'buttons':
            return (react_1.default.createElement(react_native_1.View, { style: [ui_1.row, s.pad, { gap: 8, marginTop: 12 }] }, node.items.map((label, i) => {
                const solid = node.solid === i;
                return (react_1.default.createElement(Maybe, { key: label, on: node.tap === i, style: { flex: 1 }, r: 10 },
                    react_1.default.createElement(react_native_1.View, { style: [s.wideBtn, { borderColor: solid ? accent : theme.line, backgroundColor: solid ? accent : theme.card }] },
                        react_1.default.createElement(ui_1.T, { size: 14, w: 900, color: solid ? theme.white : theme.text }, label))));
            })));
        case 'album':
            return react_1.default.createElement(Album, { pick: node.pick });
        case 'bars':
            return (react_1.default.createElement(react_native_1.View, { style: [s.pad, { marginTop: 8 }] }, Array.from({ length: node.n ?? 3 }).map((_, i) => (react_1.default.createElement(react_native_1.View, { key: i, style: { width: `${[92, 70, 84, 58, 76][i % 5]}%`, height: 10, borderRadius: 5, backgroundColor: GRAY, marginTop: 9 } })))));
        default:
            return null;
    }
}
/** 사진첩 — 고를 사진(영수증)에는 고른 순서 번호 */
function Album({ pick }) {
    const theme = (0, ui_1.useGuideTheme)();
    return (react_1.default.createElement(react_native_1.View, { style: [ui_1.row, { flexWrap: 'wrap', padding: 4 }] }, Array.from({ length: 12 }).map((_, i) => {
        const order = pick.indexOf(i);
        const tile = order >= 0 ? (react_1.default.createElement(react_native_1.View, { style: [s.photo, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line, padding: 8 }] },
            [80, 60, 70, 50, 75].map((w, k) => react_1.default.createElement(react_native_1.View, { key: k, style: { width: `${w}%`, height: 5, borderRadius: 3, backgroundColor: GRAY, marginTop: 5 } })),
            react_1.default.createElement(react_native_1.View, { style: [s.badge, { backgroundColor: theme.hot }] },
                react_1.default.createElement(ui_1.T, { size: 13, w: 900, color: theme.white }, order + 1)))) : react_1.default.createElement(react_native_1.View, { style: [s.photo, { backgroundColor: GRAY }] });
        return (react_1.default.createElement(react_native_1.View, { key: i, style: { width: '33.33%', padding: 3 } }, order === 0 ? react_1.default.createElement(Spot, { r: 6 }, tile) : tile));
    })));
}
/** 아래 탭 막대 */
function Nav({ node, accent }) {
    const theme = (0, ui_1.useGuideTheme)();
    return (react_1.default.createElement(react_native_1.View, { style: [ui_1.row, s.nav, { borderColor: theme.line, backgroundColor: theme.card }] }, node.items.map((item, i) => {
        const on = node.on === i;
        const color = on ? accent : theme.sub;
        const label = typeof item === 'string' ? item : item.label;
        const icon = typeof item === 'string'
            ? react_1.default.createElement(react_native_1.View, { style: { width: 18, height: 18, borderRadius: 5, backgroundColor: on ? accent : GRAY } })
            : react_1.default.createElement(Person, { color: on ? accent : theme.sub });
        return (react_1.default.createElement(Maybe, { key: label + i, on: node.tap === i, style: { flex: 1 } },
            react_1.default.createElement(react_native_1.View, { style: { alignItems: 'center', paddingVertical: 6, gap: 3 } },
                icon,
                typeof item === 'string' ? react_1.default.createElement(ui_1.T, { size: 11.5, w: on ? 900 : 700, color: color, lines: 1 }, label) : react_1.default.createElement(react_native_1.View, { style: { height: 14 } }))));
    })));
}
/** 사람 모양 — 글자 없이 그림으로만 알아보는 탭(쿠팡 마이쿠팡) */
function Person({ color }) {
    return (react_1.default.createElement(react_native_1.View, { style: { width: 20, height: 18, alignItems: 'center' } },
        react_1.default.createElement(react_native_1.View, { style: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: color } }),
        react_1.default.createElement(react_native_1.View, { style: { width: 16, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 2, borderBottomWidth: 0, borderColor: color, marginTop: 1 } })));
}
/** 아래에서 올라온 창 — 뒤는 어둡게 */
function Menu({ node }) {
    const theme = (0, ui_1.useGuideTheme)();
    return (react_1.default.createElement(react_native_1.View, { style: [react_native_1.StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }] },
        react_1.default.createElement(react_native_1.View, { style: [s.sheet, { backgroundColor: theme.card }] },
            react_1.default.createElement(react_native_1.View, { style: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: GRAY, marginBottom: 8 } }),
            node.items.map((label, i) => (react_1.default.createElement(Maybe, { key: label, on: node.tap === i, r: 8 },
                react_1.default.createElement(react_native_1.View, { style: { paddingVertical: 12, paddingHorizontal: 10 } },
                    react_1.default.createElement(ui_1.T, { size: 15, w: 800 }, label))))))));
}
const s = react_native_1.StyleSheet.create({
    glow: { position: 'absolute', left: -4, right: -4, top: -4, bottom: -4, borderWidth: 4, overflow: 'hidden' },
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
