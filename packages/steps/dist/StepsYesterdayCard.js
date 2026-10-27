"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepsYesterdayCard = StepsYesterdayCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const stages_1 = require("./stages");
const fallbackTheme = { card: '#FFFFFF', text: '#2B2118', sub: '#8A7A6B', primary: '#F5A3B8', primaryDeep: '#D9738E', primarySoft: '#FFEDF2', onPrimary: '#FFFFFF', radius: 20 };
/**
 * 「어제 걸음」 카드 — 오늘 카드 바로 아래에 둔다(대표님 10/28 「어제 걸음도 받게 하기」). 어제 몫이 0 이거나 다 받았으면 아무것도 안 그린다.
 * 어제 걸음은 **오늘 자정(한국 시간)까지만** 받을 수 있다 — 서버가 오늘 · 어제 날짜만 받는다.
 */
function StepsYesterdayCard({ state, onClaim, busy = false, theme, now }) {
    const v = (0, stages_1.yesterdayView)(state, now);
    if (!v.show || !v.first)
        return null;
    const C = { ...fallbackTheme, ...theme };
    const first = v.first;
    const label = busy ? '확인 중…' : `광고 보고 ${v.points}P 받기`;
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [styles.card, { backgroundColor: C.card, borderRadius: C.radius }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [styles.head, { color: C.text }], children: ["\uC5B4\uC81C \uAC78\uC74C ", (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.num, { color: C.primaryDeep ?? C.primary }], children: v.steps.toLocaleString() }), "\uAC78\uC74C"] }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [styles.left, { color: C.text }], children: ["\uB0A8\uC740 \uD69F\uC218 ", (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [styles.num, { color: C.primaryDeep ?? C.primary }], children: [v.left, "\uBC88"] })] }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [styles.sub, { color: C.sub }], children: ["\uC624\uB298 \uC790\uC815(\uD55C\uAD6D \uC2DC\uAC04)\uAE4C\uC9C0 \uBC1B\uC744 \uC218 \uC788\uC5B4\uC694 \u00B7 \uC5B4\uC81C \uBC1B\uC740 \uD3EC\uC778\uD2B8 ", v.earned, "P"] }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: `어제 걸음 ${label}, 광고가 열려요`, accessibilityState: { disabled: busy }, disabled: busy, onPress: () => onClaim(first), style: ({ pressed }) => [styles.btn, { backgroundColor: busy ? C.primarySoft : C.primary }, pressed && !busy ? { opacity: 0.85 } : null], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { numberOfLines: 1, style: [styles.btnText, { color: busy ? (C.primaryDeep ?? C.primary) : C.onPrimary }], children: label }) })] });
}
const styles = react_native_1.StyleSheet.create({
    card: { marginTop: 16, marginHorizontal: 16, padding: 20, alignItems: 'center', gap: 8 },
    head: { fontSize: 16, fontWeight: '700' },
    left: { fontSize: 18, fontWeight: '700' },
    num: { fontSize: 22, fontWeight: '800' },
    sub: { fontSize: 13, textAlign: 'center' },
    btn: { height: 48, paddingHorizontal: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 19, fontWeight: '800' },
});
