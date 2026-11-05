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
exports.row = exports.useCharacter = exports.useGuideTheme = exports.GuideProvider = exports.DEFAULT_THEME = void 0;
exports.useReducedMotion = useReducedMotion;
exports.T = T;
exports.BigButton = BigButton;
exports.Header = Header;
exports.TwoBadge = TwoBadge;
exports.Bubble = Bubble;
exports.NoteCard = NoteCard;
/**
 * 영수증 안내 공용 조각 — 색 · 글자 · 버튼 · 말풍선.
 *
 * 이 폴더는 나중에 `@jcurve/receipt-guide` 패키지로 나간다. 그래서 **앱의 다른 파일을 부르지 않는다** —
 * 색은 `theme` 으로, 캐릭터 그림은 `renderCharacter` 로, 기록은 `track` 으로 받는다(README).
 * 모양은 영테크 미션 「따라 하기」(말풍선 + 가운데 가짜 화면 + 반짝이는 누를 곳)를 따른다.
 */
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
exports.DEFAULT_THEME = {
    bg: '#F4F8FF',
    card: '#FFFFFF',
    line: '#E6EDFA',
    text: '#162343',
    sub: '#7D8598',
    brand: '#6795DC',
    brandSoft: '#E6EFFF',
    hot: '#FF7A2F',
    white: '#FFFFFF',
    noteBg: '#FDF3DF',
    noteText: '#7A5A12',
};
const GuideCtx = (0, react_1.createContext)({ theme: exports.DEFAULT_THEME });
exports.GuideProvider = GuideCtx.Provider;
const useGuideTheme = () => (0, react_1.useContext)(GuideCtx).theme;
exports.useGuideTheme = useGuideTheme;
const useCharacter = () => (0, react_1.useContext)(GuideCtx).renderCharacter;
exports.useCharacter = useCharacter;
/** 움직임 줄이기 — 켜져 있으면 저절로 넘기지 않고 [다음] 으로 넘긴다 */
function useReducedMotion() {
    const [reduced, setReduced] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        let alive = true;
        react_native_1.AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive)
            setReduced(v); }).catch(() => undefined);
        const sub = react_native_1.AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
        return () => { alive = false; sub.remove(); };
    }, []);
    return reduced;
}
exports.row = { flexDirection: 'row', alignItems: 'center' };
/** 글자 — 가짜 화면은 크기 · 굵기가 줄마다 달라 짧게 쓴다 */
function T({ children, size = 15, w = 600, color, lh, center, lines, style }) {
    const theme = (0, exports.useGuideTheme)();
    return (react_1.default.createElement(react_native_1.Text, { numberOfLines: lines, style: [
            { fontSize: size, fontWeight: String(w), color: color ?? theme.text },
            lh != null && { lineHeight: lh },
            center && { textAlign: 'center' },
            style,
        ] }, children));
}
/** 큰 버튼 */
function BigButton({ label, onPress, tone = 'solid', disabled }) {
    const theme = (0, exports.useGuideTheme)();
    const solid = tone === 'solid';
    return (react_1.default.createElement(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: label, disabled: disabled, onPress: onPress, style: ({ pressed }) => [s.big, {
                backgroundColor: solid ? theme.brand : theme.card,
                borderColor: solid ? theme.brand : theme.line,
                opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
            }] },
        react_1.default.createElement(T, { size: 17, w: 900, color: solid ? theme.white : theme.text }, label)));
}
/** 맨 위 줄 — [닫기] + 제목 */
function Header({ title, onClose }) {
    const theme = (0, exports.useGuideTheme)();
    return (react_1.default.createElement(react_native_1.View, { style: [exports.row, s.head, { borderColor: theme.line }] },
        react_1.default.createElement(react_native_1.Pressable, { accessibilityRole: "button", onPress: onClose, hitSlop: 10, style: s.headSide },
            react_1.default.createElement(T, { size: 16, w: 700, color: theme.sub }, "\uB2EB\uAE30")),
        react_1.default.createElement(T, { size: 17, w: 900, center: true, lines: 1, style: { flex: 1 } }, title),
        react_1.default.createElement(react_native_1.View, { style: s.headSide })));
}
/** 「2장」 딱지 — 2장이 꼭 필요한 곳을 눈에 띄게(대표님 10-03 23:53 「확실히 강조」) */
function TwoBadge({ big }) {
    const theme = (0, exports.useGuideTheme)();
    return (react_1.default.createElement(react_native_1.View, { style: [s.two, big && s.twoBig, { backgroundColor: theme.hot }] },
        react_1.default.createElement(T, { size: big ? 15 : 12.5, w: 900, color: theme.white }, "2\uC7A5")));
}
/** 캐릭터 + 말풍선 */
function Bubble({ say, sub }) {
    const theme = (0, exports.useGuideTheme)();
    const character = (0, exports.useCharacter)();
    return (react_1.default.createElement(react_native_1.View, { style: [exports.row, { gap: 8, alignItems: 'flex-end' }] },
        character ? character(say, 62) : null,
        react_1.default.createElement(react_native_1.View, { style: [s.bubble, { backgroundColor: theme.card, borderColor: theme.brandSoft }] },
            character ? react_1.default.createElement(react_native_1.View, { style: [s.tail, { backgroundColor: theme.card, borderColor: theme.brandSoft }] }) : null,
            react_1.default.createElement(T, { size: 17, w: 900, lh: 24 }, say),
            sub ? react_1.default.createElement(T, { size: 14.5, w: 700, lh: 21, color: theme.sub, style: { marginTop: 4 } }, sub) : null)));
}
/** 알아 둘 것 한 줄(네이버페이: 「PDF로 저장」은 사진첩에 안 들어감) */
function NoteCard({ text }) {
    const theme = (0, exports.useGuideTheme)();
    return (react_1.default.createElement(react_native_1.View, { style: [s.note, { backgroundColor: theme.noteBg }] },
        react_1.default.createElement(T, { size: 14.5, w: 800, lh: 21, color: theme.noteText }, text)));
}
const s = react_native_1.StyleSheet.create({
    big: { borderRadius: 16, borderWidth: 1.5, paddingVertical: 16, alignItems: 'center' },
    head: { height: 52, paddingHorizontal: 16, borderBottomWidth: 1 },
    headSide: { width: 48 },
    note: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'stretch' },
    two: { borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 },
    twoBig: { paddingVertical: 4, paddingHorizontal: 10 },
    bubble: { flex: 1, borderWidth: 2, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
    tail: {
        position: 'absolute', left: -7, bottom: 16, width: 12, height: 12,
        borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '45deg' }],
    },
});
