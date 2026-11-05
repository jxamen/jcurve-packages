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
exports.Chooser = Chooser;
/**
 * 어떤 영수증인가 고르는 칸 — 영수증 올리기의 **첫 자리**(대표님 10-03 23:25 「선택하게 해야겠네」).
 *
 * 앱(배민 · 쿠팡 …)을 고르면 부르는 앱이 **그 앱 영수증 팝업**을 연다 — 처음이면 올리는 법 안내부터, 아니면 등록 칸만
 * (대표님 10-04 12:24 「배민 누르면 팝업 뜨고 … 처음 눌렀으면 안내가 나오는 거고 아니면 아래 영수증 등록 하는 안내만」).
 * 예전 [영수증 확인 방법] 켜고 끄기는 뺐다 — 안내는 팝업 위 「안내 다시 보기」로 본다.
 * 지난번에 고른 앱이 있으면 맨 위에 [바로 올리기] — 안내를 건너뛰고 곧장 사진첩.
 * 종이 영수증은 안내가 없다 — 부르는 앱의 촬영 · 스캔 버튼을 `paper` 자리에 그대로 넣는다.
 * 연동 칩이 있으면(대표님 계정) 처음엔 여섯 칸(3열 2줄)만 보이고 「더보기 ∨」로 전부 · 「접기 ∧」로 여섯 칸으로 접는다. 「컬리(네이버페이)」 칸은 「컬리」 칩과 겹쳐 뺀다.
 * 종이 영수증은 그때 「전자 영수증」 아래 따로 카드로 내린다.
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const data_1 = require("./data");
const ui_1 = require("./ui");
/** 연동 칩이 있을 때 접은 상태에 보이는 칸 수 — 3열 2줄(네이버 · 쿠팡 · 컬리 / 무신사 · 배민 · 쿠팡이츠) */
const LINKED_COLLAPSED = 6;
function Chooser({ remembered, onPick, onQuick, quickDisabled, paper, hidden = [], linkChips = [], onLinkPick, paperHint }) {
    const theme = (0, ui_1.useGuideTheme)();
    const [expanded, setExpanded] = (0, react_1.useState)(false);
    /** 연동 칩이 있으면(대표님 계정) 접어 여섯 칸부터, 종이 영수증은 따로 카드 */
    const linked = linkChips.length > 0;
    const linkApps = new Set(linkChips.map((c) => c.app));
    const shown = data_1.GUIDES.filter((g) => !hidden.includes(g.app) && !linkApps.has(g.app) && !(linked && g.app === 'kurly_npay'));
    /** 연동 칩이 앞, 그 뒤가 안내 칸 — 접었을 때도 연동 칩은 다 보인다 */
    const tiles = [...linkChips.map((chip) => ({ chip })), ...shown.map((g) => ({ g }))];
    const visible = expanded ? tiles : tiles.slice(0, linked ? LINKED_COLLAPSED : Math.max(3, linkChips.length));
    const last = remembered && remembered !== 'paper' && !hidden.includes(remembered) ? (0, data_1.guideOf)(remembered) : null;
    const cardStyle = [s.card, { backgroundColor: theme.card, borderColor: theme.line }];
    const paperTitle = react_1.default.createElement(ui_1.T, { size: 15, w: 900, style: linked ? { marginBottom: 8 } : { marginTop: 14, marginBottom: 8 } }, "\uC885\uC774 \uC601\uC218\uC99D");
    const electronic = (react_1.default.createElement(react_native_1.View, { style: cardStyle },
        last ? (react_1.default.createElement(react_native_1.View, { style: [s.quick, { backgroundColor: theme.brandSoft }] },
            react_1.default.createElement(react_native_1.View, { style: [ui_1.row, { gap: 8 }] },
                react_1.default.createElement(react_native_1.View, { style: [s.dot, { backgroundColor: last.accent }] }),
                react_1.default.createElement(ui_1.T, { size: 15, w: 800, style: { flexShrink: 1 } },
                    "\uC9C0\uB09C\uBC88 ",
                    last.name),
                (0, data_1.needsTwo)(last.app) ? react_1.default.createElement(ui_1.TwoBadge, null) : null,
                react_1.default.createElement(react_native_1.View, { style: { flex: 1 } }),
                react_1.default.createElement(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: last.name + ' 바로 올리기', disabled: quickDisabled, onPress: () => onQuick(last.app), style: ({ pressed }) => [s.quickBtn, { backgroundColor: theme.brand, opacity: quickDisabled ? 0.5 : pressed ? 0.85 : 1 }] },
                    react_1.default.createElement(ui_1.T, { size: 15, w: 900, color: theme.white }, "\uBC14\uB85C \uC62C\uB9AC\uAE30"))),
            last.pickHint ? react_1.default.createElement(ui_1.T, { size: 13.5, w: 700, color: theme.brand, style: { marginTop: 6 } }, last.pickHint) : null)) : null,
        react_1.default.createElement(react_native_1.View, { style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } },
            react_1.default.createElement(ui_1.T, { size: 15, w: 900 }, "\uC804\uC790 \uC601\uC218\uC99D"),
            react_1.default.createElement(react_native_1.Pressable, { accessibilityRole: "button", accessibilityState: { expanded }, hitSlop: 12, onPress: () => setExpanded(value => !value), style: ({ pressed }) => [s.toggle, { opacity: pressed ? 0.7 : 1 }] },
                react_1.default.createElement(ui_1.T, { size: 14.5, w: 700, color: theme.sub }, expanded ? '접기 ∧' : '더보기 ∨'))),
        react_1.default.createElement(react_native_1.View, { style: s.grid }, visible.map((t) => {
            if ('chip' in t) {
                const { chip } = t;
                return (react_1.default.createElement(react_native_1.View, { key: 'link:' + chip.key, style: s.cell },
                    react_1.default.createElement(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: chip.name + (chip.connected ? ' 계정 연동됨' : ' 계정 미연동'), onPress: () => onLinkPick?.(chip.key, chip.connected), style: ({ pressed }) => [s.tile, { borderColor: chip.connected ? theme.brand : theme.line, backgroundColor: chip.connected ? theme.brandSoft : theme.card, opacity: pressed ? 0.8 : 1 }] },
                        react_1.default.createElement(react_native_1.View, { style: [s.dot, { backgroundColor: (0, data_1.accentOf)(chip.app) }] }),
                        react_1.default.createElement(ui_1.T, { size: 15, w: 800, lines: linked ? 2 : 1, center: linked, style: { flexShrink: 1 } }, chip.name),
                        react_1.default.createElement(react_native_1.View, { style: s.badge },
                            react_1.default.createElement(react_native_1.View, { style: [s.linkBadge, { backgroundColor: chip.connected ? theme.brand : theme.line }] },
                                react_1.default.createElement(ui_1.T, { size: 11, w: 900, color: chip.connected ? theme.white : theme.sub }, chip.connected ? '연동' : '미연동'))))));
            }
            const g = t.g;
            const on = remembered === g.app;
            return (react_1.default.createElement(react_native_1.View, { key: g.app, style: s.cell },
                react_1.default.createElement(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: g.name + ' 영수증 올리기', onPress: () => onPick(g.app), style: ({ pressed }) => [s.tile, { borderColor: on ? theme.brand : theme.line, backgroundColor: on ? theme.brandSoft : theme.card, opacity: pressed ? 0.8 : 1 }] },
                    react_1.default.createElement(react_native_1.View, { style: [s.dot, { backgroundColor: g.accent }] }),
                    react_1.default.createElement(ui_1.T, { size: g.name.length > 6 ? 13.5 : 15, w: 800, lines: linked ? 2 : 1, center: linked, style: { flexShrink: 1 } }, g.name),
                    (0, data_1.needsTwo)(g.app) ? react_1.default.createElement(react_native_1.View, { style: s.badge },
                        react_1.default.createElement(ui_1.TwoBadge, null)) : null)));
        })),
        linked ? null : react_1.default.createElement(react_1.default.Fragment, null,
            paperTitle,
            paper)));
    if (!linked)
        return electronic;
    return (react_1.default.createElement(react_1.default.Fragment, null,
        electronic,
        paperHint,
        react_1.default.createElement(react_native_1.View, { style: cardStyle },
            paperTitle,
            paper)));
}
const s = react_native_1.StyleSheet.create({
    card: { borderWidth: 1.5, borderRadius: 20, padding: 16 },
    quick: { marginTop: 12, borderRadius: 14, padding: 12 },
    quickBtn: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -4 },
    toggle: { alignItems: 'center', justifyContent: 'center' },
    cell: { width: '33.33%', padding: 4 },
    tile: { borderWidth: 1.5, borderRadius: 14, minHeight: 44, paddingVertical: 4, paddingHorizontal: 6, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
    badge: { position: 'absolute', top: -6, right: -4 },
    linkBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    dot: { width: 10, height: 10, borderRadius: 5 },
});
