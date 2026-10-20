"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LOTTERY_THEME = void 0;
exports.LotteryChip = LotteryChip;
exports.LotterySheet = LotterySheet;
exports.LotteryResult = LotteryResult;
exports.GoldenLotteryPopup = GoldenLotteryPopup;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
const lottery_1 = require("./lottery");
exports.DEFAULT_LOTTERY_THEME = {
    bg: '#FBF7F2', card: '#FFFFFF', text: '#2B2118', sub: '#6B5E52', accent: '#EE7A33', accentText: '#FFFFFF', accentSoft: '#FDE6D6', done: '#D3D7DD',
};
const th = (t) => ({ ...exports.DEFAULT_LOTTERY_THEME, ...(t ?? {}) });
/**
 * 안 연 복권이 있을 때만 — 다 열면 사라진다(count 0 이면 null).
 * 기본은 **띠 없이 떠 있는 흰 알약**(그림자, FloatingRewardChip 과 같은 모양 · 대표님 「떠 있는 알약」): 안쪽 화면의 탭 바 위에 두고 `bottomOffset`(아래에서 띄울 거리)만 준다.
 * `floating={false}` 면 줄 안에 놓는 작은 색 알약(0.6.0 모양).
 */
function LotteryChip({ count, onPress, label, bottomOffset = 16, floating = true, icon, theme }) {
    if (!(count > 0))
        return null;
    const c = th(theme);
    const text = label ?? '복권 ' + count + '장';
    if (!floating) {
        return (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: text, onPress: onPress, style: ({ pressed }) => [s.chip, { backgroundColor: c.accent }, pressed && { opacity: 0.85 }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.chipText, { color: c.accentText }], children: text }) });
    }
    return (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: [s.anchor, { bottom: bottomOffset }], children: (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: text, onPress: onPress, style: ({ pressed }) => [s.floating, pressed && { opacity: 0.8 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", children: icon ?? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.ticket, { borderColor: c.accent }], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.ticketLine, { borderColor: c.accent }] }) }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.floatingText, children: text }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { accessible: false, style: s.arrow, children: "\u203A" })] }) });
}
function TierRow({ t, theme, busy, onOpen, onEarn }) {
    const b = (0, lottery_1.lotteryTierButton)(t);
    const active = b.kind === 'open' || b.kind === 'earn';
    const press = () => { if (b.kind === 'open')
        onOpen(t.tier);
    else if (b.kind === 'earn')
        onEarn(t.tier); };
    return (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: (0, lottery_1.lotteryTierTitle)(t) + ', ' + b.label, accessibilityState: { disabled: !active || !!busy }, disabled: !active || !!busy, onPress: press, style: s.row, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.rowCopy, children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.rowTitle, { color: theme.text }], children: [(0, lottery_1.lotteryTierTitle)(t), t.unopened > 1 ? ' × ' + t.unopened : ''] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.rowHint, { color: theme.sub }], children: (0, lottery_1.lotteryTierHint)(t) })] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: [s.rowButton, { backgroundColor: active ? theme.accentSoft : theme.done }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.rowButtonText, { color: active ? theme.accent : theme.sub }], children: b.label }) })] });
}
/** 복권 시트 — 3단계 줄 · 받기 / 열기 / 획득 완료 · 당첨 띠 · 「한 번 더! ○원 복권 받기」 · 알림 켜기 */
function LotterySheet({ open, state, winners, busy, onOpen, onEarn, onMore, onClose, onEnableNotify, notifyLabel, theme, renderNative }) {
    if (!open || !state)
        return null;
    const c = th(theme);
    const more = (0, lottery_1.lotteryMoreLabel)(state);
    const next = state.tiers.find(t => t.missionState === 'locked');
    const last = winners && winners.length > 0 ? winners[0] : null;
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.overlay, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", onPress: onClose, style: s.dim }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.sheet, { backgroundColor: c.card }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", hitSlop: 12, onPress: onClose, style: s.close, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.closeText, { color: c.sub }], children: "\u2715" }) }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.sheetTitle, { color: c.text }], children: ["\uAF5D \uC5C6\uB294 \uBCF5\uAD8C", '\n', "\uC9C0\uAE08 \uC5F4\uACE0 \uD589\uC6B4 \uBC1B\uC544\uAC00\uC694!"] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.sheetSub, { color: c.sub }], children: "\uBC1B\uC740 \uBCF5\uAD8C\uC740 \uB9E4\uC77C \uC790\uC815\uC5D0 \uC0AC\uB77C\uC838\uC694" }), last ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.ticker, { backgroundColor: c.bg }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.tickerText, { color: c.text }], numberOfLines: 1, children: (0, lottery_1.lotteryWinnerLine)(last) }) }) : null, state.tiers.map(t => (0, jsx_runtime_1.jsx)(TierRow, { t: t, theme: c, busy: busy, onOpen: onOpen, onEarn: onEarn }, t.tier)), more && next ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: more, disabled: !!busy, onPress: () => (onMore ?? onEarn)(next.tier), style: [s.big, { backgroundColor: c.accent }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bigText, { color: c.accentText }], children: more }) }) : null, onEnableNotify ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: notifyLabel ?? '복권 받게 알림 켜기', onPress: onEnableNotify, style: s.link, children: (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.linkText, { color: c.accent }], children: ["\uD83D\uDD14 ", notifyLabel ?? '복권 받게 알림 켜기', " \u203A"] }) }) : null, renderNative ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.native, children: renderNative() }) : null] })] });
}
/**
 * 결과 창 — 「축하해요 보상 ○P 당첨!」, **큰 아이콘 없음**(대표님 13:56). 버튼 아래에 앱이 넘기는 네이티브 광고(`renderNative`).
 * 남은 복권이 있으면 「다음 복권 열기」, 없으면 「미션 하고 복권 더 받기」(다음 단계까지 남은 미션 수), 둘 다 「다음에 할게요」로 닫는다.
 */
function LotteryResult({ result, state, onOpenNext, onMore, onClose, renderNative, theme }) {
    const c = th(theme);
    const hasNext = result.unopened > 0;
    const moreLabel = !hasNext && state ? (0, lottery_1.lotteryMoreMissionLabel)(state) : null;
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.result, { backgroundColor: c.card }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.resultTitle, { color: c.text }], children: (0, lottery_1.lotteryResultTitle)(result.points) }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.resultSub, { color: c.sub }], children: [result.won.toLocaleString('ko-KR'), "\uC6D0 \uBCF5\uAD8C"] }), renderNative ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.native, children: renderNative() }) : null, hasNext && onOpenNext ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2E4\uC74C \uBCF5\uAD8C \uC5F4\uAE30", onPress: onOpenNext, style: [s.big, { backgroundColor: c.accent }], children: (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.bigText, { color: c.accentText }], children: ["\uB2E4\uC74C \uBCF5\uAD8C \uC5F4\uAE30 (", result.unopened, "\uC7A5 \uB0A8\uC558\uC5B4\uC694)"] }) }) : null, !hasNext && moreLabel && onMore ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: moreLabel, onPress: onMore, style: [s.big, { backgroundColor: c.accent }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bigText, { color: c.accentText }], children: moreLabel }) }) : null, (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2E4\uC74C\uC5D0 \uD560\uAC8C\uC694", onPress: onClose, style: s.link, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.linkText, { color: c.sub }], children: "\uB2E4\uC74C\uC5D0 \uD560\uAC8C\uC694" }) })] });
}
/**
 * 황금 복권 팝업 — 「황금 복권이 나타났어요!」 하루 한 번. 버튼은 「광고 보고 황금 복권 열기」: 앱이 `onOpen` 에서 **보상형 광고(용도 lottery_basic)를 보여 준 뒤**
 * `useLottery.open(tier, 'basic')` 을 부른다 — 광고 시청은 서버가 구글 SSV 로 확인한다(앱 말만 믿지 않는다).
 * `icon` 은 앱이 넘기는 그림(없으면 글자만). busy 동안은 다시 눌리지 않는다.
 */
function GoldenLotteryPopup({ open, maxWon, busy, onOpen, onClose, buttonLabel, icon, theme }) {
    if (!open)
        return null;
    const c = th(theme);
    const label = buttonLabel ?? '광고 보고 황금 복권 열기';
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.overlay, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", onPress: onClose, style: s.dim }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.sheet, { backgroundColor: c.card }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", hitSlop: 12, onPress: onClose, style: s.close, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.closeText, { color: c.sub }], children: "\u2715" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.sheetTitle, { color: c.text }], children: "\uD669\uAE08 \uBCF5\uAD8C\uC774 \uB098\uD0C0\uB0AC\uC5B4\uC694!" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.sheetSub, { color: c.sub }], children: '하루에 한번만 행운처럼 오는 기회\n최대 ' + maxWon.toLocaleString('ko-KR') + '원을 받을 수 있어요' }), icon ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.golden, children: icon }) : null, (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: label, accessibilityState: { disabled: !!busy }, disabled: !!busy, onPress: onOpen, style: [s.big, { backgroundColor: c.accent }, busy && { opacity: 0.6 }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bigText, { color: c.accentText }], children: label }) })] })] });
}
const s = react_native_1.StyleSheet.create({
    anchor: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 10 },
    floating: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, backgroundColor: '#FFFFFF',
        shadowColor: '#17212E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 6 },
    floatingText: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: '#26333D' },
    arrow: { fontSize: 24, lineHeight: 24, color: '#77818B' },
    ticket: { width: 22, height: 16, borderWidth: 2, borderRadius: 4, transform: [{ rotate: '-12deg' }] },
    ticketLine: { height: 10, marginLeft: 11, borderLeftWidth: 1, borderStyle: 'dashed' },
    chip: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    chipText: { fontSize: 13, fontWeight: '800' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 60, elevation: 60 },
    dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24, gap: 12 },
    close: { position: 'absolute', top: 14, right: 16, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    closeText: { fontSize: 20, fontWeight: '700' },
    sheetTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30, marginTop: 8 },
    sheetSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    ticker: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
    tickerText: { fontSize: 13, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rowCopy: { flex: 1, minWidth: 0, gap: 2 },
    rowTitle: { fontSize: 17, fontWeight: '800' },
    rowHint: { fontSize: 13 },
    rowButton: { minWidth: 76, height: 38, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    rowButtonText: { fontSize: 14, fontWeight: '800' },
    big: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    bigText: { fontSize: 16, fontWeight: '800' },
    link: { alignItems: 'center', paddingVertical: 8 },
    linkText: { fontSize: 14, fontWeight: '700' },
    native: { marginTop: 4 },
    golden: { alignItems: 'center', paddingVertical: 12 },
    result: { borderRadius: 24, paddingHorizontal: 20, paddingVertical: 28, gap: 12, alignItems: 'stretch' },
    resultTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
    resultSub: { fontSize: 14, textAlign: 'center' },
});
