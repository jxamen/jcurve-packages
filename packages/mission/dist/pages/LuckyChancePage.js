"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LUCKY_CHANCE_TITLE = void 0;
exports.LuckyChancePage = LuckyChancePage;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * 행운 찬스 — 하루 무료 한 번, 광고를 보면 한 번 더 뽑기 (0.4.0, carrot ChanceScreen · DrawCard 그대로).
 * 상품 · 확률 · 횟수 · 간격은 서버가 정한다. 패키지는 남은 횟수와 대기 시각을 그리고 onDraw(광고 여부) 만 부른다.
 * 참여형 광고(오퍼월)는 `offerwall` 을 줄 때만 그린다 — 주소 · 여는 방법은 앱이 가진다.
 */
const react_1 = require("react");
const react_native_1 = require("react-native");
const PageFrame_1 = require("./PageFrame");
const logic_1 = require("./logic");
/** (0.4.14) 머리 제목 — 고정. 앱이 `title` 을 넘겨도 쓰지 않는다 */
exports.LUCKY_CHANCE_TITLE = '행운 룰렛';
function LuckyChancePage({ freeLeft, adLeft, waitUntil, prizes = [], boost = 0, boostText, onDraw, busy = false, offerwall, onBack, swipeBack, theme: themeIn, footer }) {
    const theme = (0, PageFrame_1.resolvePageTheme)(themeIn);
    // 초읽기 — 대기 중일 때만 1초마다 다시 그린다(시각은 렌더마다 새로 잰다)
    const [, tick] = (0, react_1.useState)(0);
    const waitMs = (0, logic_1.waitLeftMs)(waitUntil, Date.now());
    (0, react_1.useEffect)(() => {
        if (waitMs <= 0)
            return;
        const timer = setInterval(() => tick(n => n + 1), 1000);
        return () => clearInterval(timer);
    }, [waitMs > 0]);
    const free = freeLeft > 0;
    const canFree = free && waitMs <= 0 && !busy;
    const canAd = !free && adLeft > 0 && waitMs <= 0 && !busy;
    const prize = (0, logic_1.prizeLine)(prizes);
    return (0, jsx_runtime_1.jsxs)(PageFrame_1.PageFrame, { title: exports.LUCKY_CHANCE_TITLE, onBack: onBack, swipeBack: swipeBack, theme: theme, footer: footer, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.card, { backgroundColor: theme.card }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.cardSub, { color: theme.sub }], children: (0, logic_1.drawSubLine)({ free: freeLeft, ad: adLeft, waitMs }) }), prize ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.prize, { color: theme.text, backgroundColor: theme.accentSoft }], children: prize }) : null, boost > 0 ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.boost, { backgroundColor: theme.accentSoft }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.boostText, { color: theme.accent }], children: (0, logic_1.boostLine)(boost, boostText) }) }) : null, (0, jsx_runtime_1.jsx)(PageFrame_1.PageButton, { big: true, label: (0, logic_1.drawLabel)({ free, waitMs }), theme: theme, on: canFree || canAd, disabled: !(canFree || canAd), onPress: () => { void onDraw(!free); } })] }), offerwall ? (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.card, { backgroundColor: theme.card }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.cardTitle, { color: theme.text }], children: offerwall.name }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.cardSub, { color: theme.sub }], children: "\uCC38\uC5EC\uD558\uBA74 \uB9E4\uCCB4 \uD655\uC778\uC774 \uB05D\uB09C \uB4A4 \uD3EC\uC778\uD2B8\uAC00 \uC790\uB3D9\uC73C\uB85C \uB4E4\uC5B4\uC640\uC694" }), (0, jsx_runtime_1.jsx)(PageFrame_1.PageButton, { big: true, label: "\uCC38\uC5EC\uD558\uB7EC \uAC00\uAE30", theme: theme, on: true, onPress: offerwall.onOpen })] }) : null] });
}
const s = react_native_1.StyleSheet.create({
    card: { borderRadius: 20, padding: 20, alignItems: 'center', gap: 10 },
    cardTitle: { fontSize: 19, fontWeight: '800' },
    cardSub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
    prize: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, fontSize: 14, fontWeight: '700', overflow: 'hidden' },
    boost: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'stretch' },
    boostText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
});
