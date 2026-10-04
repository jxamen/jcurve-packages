"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chooser = Chooser;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * 어떤 영수증인가 고르는 칸 — 영수증 올리기의 **첫 자리**(대표님 10-03 23:25 「선택하게 해야겠네」).
 *
 * 앱(배민 · 쿠팡 …)을 고르면 **바로 그 앱 영수증 올리기(사진첩)** — 대표님 10-04 11:52 「이 화면에선 해당 플랫폼별 바로 영수증 등록하게 해줘」.
 * 올리는 법 안내는 [영수증 확인 방법] 을 누른 뒤 앱을 고를 때만(「영수증 확인 방법 버튼 넣고 누르면 안내가 나오게」).
 * 지난번에 고른 앱이 있으면 맨 위에 [바로 올리기] — 안내를 건너뛰고 곧장 사진첩.
 * 종이 영수증은 안내가 없다 — 부르는 앱의 촬영 · 스캔 버튼을 `paper` 자리에 그대로 넣는다.
 */
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const data_1 = require("./data");
const ui_1 = require("./ui");
function Chooser({ remembered, onGuide, onPick, onQuick, quickDisabled, paper }) {
    const theme = (0, ui_1.useGuideTheme)();
    // 「영수증 확인 방법」을 켜면 앱 칸을 누를 때 올리는 법 안내가 열린다(끄면 바로 올리기)
    const [howToOn, setHowTo] = react_1.default.useState(false);
    const howTo = howToOn || !onPick; // onPick 이 없으면 언제나 안내
    const last = remembered && remembered !== 'paper' ? (0, data_1.guideOf)(remembered) : null;
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.card, { backgroundColor: theme.card, borderColor: theme.line }], children: [(0, jsx_runtime_1.jsx)(ui_1.T, { size: 18, w: 900, children: "\uC5B4\uB5A4 \uC601\uC218\uC99D\uC744 \uC62C\uB9AC\uB098\uC694?" }), (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14.5, w: 700, color: theme.sub, lh: 21, style: { marginTop: 2 }, children: !onPick ? '앱 영수증은 고르면 올리는 법을 먼저 보여 줘요. 「2장」은 캡처 2장을 함께 올려야 해요'
                    : howTo ? '올리는 법을 볼 앱을 골라 주세요' : '앱을 고르면 바로 그 영수증을 올려요. 「2장」은 캡처 2장을 함께 올려야 해요' }), onPick ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityState: { selected: howTo }, onPress: () => setHowTo(v => !v), style: ({ pressed }) => [s.howTo, { borderColor: howTo ? theme.brand : theme.line, backgroundColor: howTo ? theme.brandSoft : theme.card, opacity: pressed ? 0.8 : 1 }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: 800, color: theme.brand, children: howTo ? '안내 닫기 · 바로 올리기로' : '영수증 확인 방법' }) }) : null, last ? ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.quick, { backgroundColor: theme.brandSoft }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [ui_1.row, { gap: 8 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.dot, { backgroundColor: last.accent }] }), (0, jsx_runtime_1.jsxs)(ui_1.T, { size: 15, w: 800, style: { flexShrink: 1 }, children: ["\uC9C0\uB09C\uBC88 ", last.name] }), (0, data_1.needsTwo)(last.app) ? (0, jsx_runtime_1.jsx)(ui_1.TwoBadge, {}) : null, (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { flex: 1 } }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: last.name + ' 바로 올리기', disabled: quickDisabled, onPress: () => onQuick(last.app), style: ({ pressed }) => [s.quickBtn, { backgroundColor: theme.brand, opacity: quickDisabled ? 0.5 : pressed ? 0.85 : 1 }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 900, color: theme.white, children: "\uBC14\uB85C \uC62C\uB9AC\uAE30" }) })] }), last.pickHint ? (0, jsx_runtime_1.jsx)(ui_1.T, { size: 13.5, w: 700, color: theme.brand, style: { marginTop: 6 }, children: last.pickHint }) : null] })) : null, (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.grid, children: data_1.GUIDES.map((g) => {
                    const on = remembered === g.app;
                    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.cell, children: (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: g.name + (howTo ? ' 영수증 확인 방법' : ' 영수증 바로 올리기'), onPress: () => (howTo || !onPick ? onGuide(g.app) : onPick(g.app)), style: ({ pressed }) => [s.tile, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brandSoft : theme.card, opacity: pressed ? 0.8 : 1 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.dot, { backgroundColor: g.accent }] }), (0, jsx_runtime_1.jsx)(ui_1.T, { size: g.name.length > 6 ? 13.5 : 15, w: 800, lines: 1, children: g.name }), (0, data_1.needsTwo)(g.app) ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.badge, children: (0, jsx_runtime_1.jsx)(ui_1.TwoBadge, {}) }) : null] }) }, g.app));
                }) }), (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 900, style: { marginTop: 14, marginBottom: 8 }, children: "\uC885\uC774 \uC601\uC218\uC99D" }), paper] }));
}
const s = react_native_1.StyleSheet.create({
    card: { borderWidth: 1.5, borderRadius: 20, padding: 16 },
    quick: { marginTop: 12, borderRadius: 14, padding: 12 },
    howTo: { alignSelf: 'flex-start', marginTop: 10, borderWidth: 1.5, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
    quickBtn: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -4 },
    cell: { width: '33.33%', padding: 4 },
    tile: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 6 },
    badge: { position: 'absolute', top: -6, right: -4 },
    dot: { width: 10, height: 10, borderRadius: 5 },
});
