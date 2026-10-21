"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloatingRewardChip = FloatingRewardChip;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
/** Place inside a positioned content view above the tab bar. */
function FloatingRewardChip({ visible, icon, label, onPress, bottomOffset }) {
    const y = (0, react_1.useRef)(new react_native_1.Animated.Value(0)).current;
    // Stay still until the accessibility setting has been read.
    const [reduceMotion, setReduceMotion] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        let active = true;
        let changed = false;
        const subscription = react_native_1.AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
            changed = true;
            setReduceMotion(value);
        });
        void react_native_1.AccessibilityInfo.isReduceMotionEnabled().then(value => {
            if (active && !changed)
                setReduceMotion(value);
        }).catch(() => { });
        return () => { active = false; subscription.remove(); };
    }, []);
    (0, react_1.useEffect)(() => {
        y.setValue(0);
        if (!visible || reduceMotion)
            return;
        const animation = react_native_1.Animated.loop(react_native_1.Animated.sequence([
            react_native_1.Animated.timing(y, { toValue: -4, duration: 1200, easing: react_native_1.Easing.inOut(react_native_1.Easing.sin), useNativeDriver: true }),
            react_native_1.Animated.timing(y, { toValue: 0, duration: 1200, easing: react_native_1.Easing.inOut(react_native_1.Easing.sin), useNativeDriver: true }),
        ]));
        animation.start();
        return () => { animation.stop(); y.setValue(0); };
    }, [visible, reduceMotion, y]);
    if (!visible)
        return null;
    return (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: [s.anchor, { bottom: bottomOffset }], children: (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: { maxWidth: '100%', transform: [{ translateY: y }] }, children: (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: label, onPress: onPress, style: ({ pressed }) => [s.chip, pressed && { opacity: 0.8 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", children: icon ?? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.ticket, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.ticketLine }) }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.label, children: label }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { accessible: false, style: s.arrow, children: "\u203A" })] }) }) });
}
const s = react_native_1.StyleSheet.create({
    anchor: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 10 },
    chip: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 12,
        borderRadius: 999, backgroundColor: '#FFFFFF', shadowColor: '#17212E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 6 },
    label: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: '#26333D' },
    arrow: { fontSize: 24, lineHeight: 24, color: '#77818B' },
    ticket: { width: 22, height: 16, borderWidth: 2, borderColor: '#7A4FD0', borderRadius: 4, transform: [{ rotate: '-12deg' }] },
    ticketLine: { height: 10, marginLeft: 11, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: '#7A4FD0' },
});
