"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.row = exports.useCharacter = exports.useGuideTheme = exports.GuideProvider = exports.DEFAULT_THEME = void 0;
exports.useReducedMotion = useReducedMotion;
exports.T = T;
exports.BigButton = BigButton;
exports.SmallButton = SmallButton;
exports.Header = Header;
exports.Bubble = Bubble;
exports.NoteCard = NoteCard;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * 영수증 안내 공용 조각 — 색 · 글자 · 버튼 · 말풍선.
 *
 * 이 폴더는 나중에 `@jcurve/receipt-guide` 패키지로 나간다. 그래서 **앱의 다른 파일을 부르지 않는다** —
 * 색은 `theme` 으로, 캐릭터 그림은 `renderCharacter` 로, 기록은 `track` 으로 받는다(README).
 * 모양은 영테크 미션 「따라 하기」(말풍선 + 가운데 가짜 화면 + 반짝이는 누를 곳)를 따른다.
 */
const react_1 = require("react");
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
    return ((0, jsx_runtime_1.jsx)(react_native_1.Text, { numberOfLines: lines, style: [
            { fontSize: size, fontWeight: String(w), color: color ?? theme.text },
            lh != null && { lineHeight: lh },
            center && { textAlign: 'center' },
            style,
        ], children: children }));
}
/** 큰 버튼 */
function BigButton({ label, onPress, tone = 'solid', disabled }) {
    const theme = (0, exports.useGuideTheme)();
    const solid = tone === 'solid';
    return ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: label, disabled: disabled, onPress: onPress, style: ({ pressed }) => [s.big, {
                backgroundColor: solid ? theme.brand : theme.card,
                borderColor: solid ? theme.brand : theme.line,
                opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
            }], children: (0, jsx_runtime_1.jsx)(T, { size: 17, w: 900, color: solid ? theme.white : theme.text, children: label }) }));
}
/** 작은 둥근 버튼 — 재생 조절 */
function SmallButton({ label, onPress, on, a11y }) {
    const theme = (0, exports.useGuideTheme)();
    return ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: a11y ?? label, onPress: onPress, hitSlop: 6, style: ({ pressed }) => [s.small, {
                borderColor: on ? theme.brand : theme.line,
                backgroundColor: on ? theme.brandSoft : theme.card,
                opacity: pressed ? 0.8 : 1,
            }], children: (0, jsx_runtime_1.jsx)(T, { size: 15, w: 800, color: on ? theme.brand : theme.sub, children: label }) }));
}
/** 맨 위 줄 — [닫기] + 제목 */
function Header({ title, onClose }) {
    const theme = (0, exports.useGuideTheme)();
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [exports.row, s.head, { borderColor: theme.line }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", onPress: onClose, hitSlop: 10, style: s.headSide, children: (0, jsx_runtime_1.jsx)(T, { size: 16, w: 700, color: theme.sub, children: "\uB2EB\uAE30" }) }), (0, jsx_runtime_1.jsx)(T, { size: 17, w: 900, center: true, lines: 1, style: { flex: 1 }, children: title }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.headSide })] }));
}
/** 캐릭터 + 말풍선 */
function Bubble({ say, sub }) {
    const theme = (0, exports.useGuideTheme)();
    const character = (0, exports.useCharacter)();
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [exports.row, { gap: 8, alignItems: 'flex-end' }], children: [character ? character(say, 62) : null, (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.bubble, { backgroundColor: theme.card, borderColor: theme.brandSoft }], children: [character ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.tail, { backgroundColor: theme.card, borderColor: theme.brandSoft }] }) : null, (0, jsx_runtime_1.jsx)(T, { size: 17, w: 900, lh: 24, children: say }), sub ? (0, jsx_runtime_1.jsx)(T, { size: 14.5, w: 700, lh: 21, color: theme.sub, style: { marginTop: 4 }, children: sub }) : null] })] }));
}
/** 알아 둘 것 한 줄(네이버페이: 「PDF로 저장」은 사진첩에 안 들어감) */
function NoteCard({ text }) {
    const theme = (0, exports.useGuideTheme)();
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.note, { backgroundColor: theme.noteBg }], children: (0, jsx_runtime_1.jsx)(T, { size: 14.5, w: 800, lh: 21, color: theme.noteText, children: text }) }));
}
const s = react_native_1.StyleSheet.create({
    big: { borderRadius: 16, borderWidth: 1.5, paddingVertical: 16, alignItems: 'center' },
    small: { borderRadius: 999, borderWidth: 1.5, paddingVertical: 9, paddingHorizontal: 16, alignItems: 'center' },
    head: { height: 52, paddingHorizontal: 16, borderBottomWidth: 1 },
    headSide: { width: 48 },
    note: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'stretch' },
    bubble: { flex: 1, borderWidth: 2, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
    tail: {
        position: 'absolute', left: -7, bottom: 16, width: 12, height: 12,
        borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '45deg' }],
    },
});
