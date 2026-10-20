"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LOTTERY_THEME = void 0;
exports.LotteryChip = LotteryChip;
exports.sheetMaxHeight = sheetMaxHeight;
exports.LotterySheet = LotterySheet;
exports.LotteryResult = LotteryResult;
exports.GoldenLotteryPopup = GoldenLotteryPopup;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const lottery_1 = require("./lottery");
exports.DEFAULT_LOTTERY_THEME = {
    bg: '#FBF7F2', card: '#FFFFFF', text: '#2B2118', sub: '#6B5E52', accent: '#EE7A33', accentText: '#FFFFFF', accentSoft: '#FDE6D6', done: '#D3D7DD',
};
function NotifyRow({ notify, theme }) {
    if (!notify || !notify.visible)
        return null;
    const label = notify.label ?? '복권 받기 알림 켜기';
    return (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: label, accessibilityState: { disabled: !!notify.busy }, disabled: !!notify.busy, onPress: notify.onPress, style: [s.notify, { backgroundColor: theme.bg }, notify.busy && { opacity: 0.6 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { accessible: false, style: s.notifyBell, children: "\uD83D\uDD14" }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.notifyCopy, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.notifyTitle, { color: theme.text }], children: label }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.notifyHint, { color: theme.sub }], children: notify.hint ?? '매일 새 복권이 나오면 알려 드릴게요' })] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: [s.notifyBtn, { backgroundColor: theme.accentSoft }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.notifyBtnText, { color: theme.accent }], children: "\uCF1C\uAE30" }) })] });
}
const th = (t) => ({ ...exports.DEFAULT_LOTTERY_THEME, ...(t ?? {}) });
/**
 * 떠 있는 칩의 위아래 4px 움직임(FloatingRewardChip 과 같다, 앱총괄 「떠 있는 느낌」) — 접근성 「동작 줄이기」를 켜면 멈춘다.
 * 설정을 읽기 전에는 가만히 있는다. active 가 꺼지면(칩이 사라지거나 inline 모양) 멈추고 제자리로
 */
function useBob(active) {
    const y = (0, react_1.useRef)(new react_native_1.Animated.Value(0)).current;
    const [reduceMotion, setReduceMotion] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        let alive = true;
        let changed = false;
        const sub = react_native_1.AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { changed = true; setReduceMotion(v); });
        void react_native_1.AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive && !changed)
            setReduceMotion(v); }).catch(() => undefined);
        return () => { alive = false; sub.remove(); };
    }, []);
    (0, react_1.useEffect)(() => {
        y.setValue(0);
        if (!active || reduceMotion)
            return undefined;
        const loop = react_native_1.Animated.loop(react_native_1.Animated.sequence([
            react_native_1.Animated.timing(y, { toValue: -4, duration: 1200, easing: react_native_1.Easing.inOut(react_native_1.Easing.sin), useNativeDriver: true }),
            react_native_1.Animated.timing(y, { toValue: 0, duration: 1200, easing: react_native_1.Easing.inOut(react_native_1.Easing.sin), useNativeDriver: true }),
        ]));
        loop.start();
        return () => { loop.stop(); y.setValue(0); };
    }, [active, reduceMotion, y]);
    return y;
}
/**
 * 안 연 복권이 있을 때만 — 다 열면 사라진다(count 0 이면 null).
 * 기본은 **띠 없이 떠 있는 흰 알약**(그림자, FloatingRewardChip 과 같은 모양 · 대표님 「떠 있는 알약」): 안쪽 화면의 탭 바 위에 두고 `bottomOffset`(아래에서 띄울 거리)만 준다.
 * `floating={false}` 면 줄 안에 놓는 작은 색 알약(0.6.0 모양).
 */
function LotteryChip({ count, onPress, label, bottomOffset = 16, floating = true, icon, theme }) {
    const bob = useBob(count > 0 && floating); // 훅은 늘 같은 순서로 — 아래에서 null 을 돌려줘도 먼저 부른다
    if (!(count > 0))
        return null;
    const c = th(theme);
    const text = label ?? '복권 ' + count + '장';
    if (!floating) {
        return (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: text, onPress: onPress, style: ({ pressed }) => [s.chip, { backgroundColor: c.accent }, pressed && { opacity: 0.85 }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.chipText, { color: c.accentText }], children: text }) });
    }
    return (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: [s.anchor, { bottom: bottomOffset }], children: (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: { maxWidth: '100%', transform: [{ translateY: bob }] }, children: (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: text, onPress: onPress, style: ({ pressed }) => [s.floating, pressed && { opacity: 0.8 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", children: icon ?? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.ticket, { borderColor: c.accent }], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.ticketLine, { borderColor: c.accent }] }) }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.floatingText, children: text }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { accessible: false, style: s.arrow, children: "\u203A" })] }) }) });
}
/**
 * (0.1.2) 「광고」 작은 칩 — 눌렀을 때 **광고가 바로 열리는** 버튼 안 오른쪽에만(앱 홈 「감자 키우기 [광고]」 · 「풍선 더 받기 [광고]」와 같은 모양). 광고 없이 열리는 버튼에는 넣지 않는다.
 * `onColor` 는 칩이 올라가는 바탕에서 읽히는 글자색(채운 버튼 위면 accentText, 연한 버튼 위면 accent)
 */
function AdChip({ label = '광고', onColor, onFilled }) {
    return (0, jsx_runtime_1.jsx)(react_native_1.View, { accessible: false, importantForAccessibility: "no-hide-descendants", style: [s.adChip, onFilled ? s.adChipOnFilled : { borderColor: onColor }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.adChipText, { color: onColor }], children: label }) });
}
function TierRow({ t, theme, busy, onOpen, onEarn, ad, adLabel }) {
    const b = (0, lottery_1.lotteryTierButton)(t);
    const active = b.kind === 'open' || b.kind === 'earn';
    const press = () => { if (b.kind === 'open')
        onOpen(t.tier);
    else if (b.kind === 'earn')
        onEarn(t.tier); };
    const withAd = b.kind === 'open' && ad;
    return (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: (0, lottery_1.lotteryTierTitle)(t) + ', ' + b.label + (withAd ? ', ' + (adLabel ?? '광고') : ''), accessibilityState: { disabled: !active || !!busy }, disabled: !active || !!busy, onPress: press, style: s.row, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.rowCopy, children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.rowTitle, { color: theme.text }], children: [(0, lottery_1.lotteryTierTitle)(t), t.unopened > 1 ? ' × ' + t.unopened : ''] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.rowHint, { color: theme.sub }], children: (0, lottery_1.lotteryTierHint)(t) })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { pointerEvents: "none", style: [s.rowButton, { backgroundColor: active ? theme.accentSoft : theme.done }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.rowButtonText, { color: active ? theme.accent : theme.sub }], children: b.label }), withAd ? (0, jsx_runtime_1.jsx)(AdChip, { label: adLabel, onColor: theme.accent }) : null] })] });
}
/**
 * 시트가 차지할 수 있는 높이 — 화면 높이에서 위 여백(상태줄 · 노치)과 숨 쉴 자리를 뺀다. 앱이 안전 영역 위 값을 `topInset` 으로 주면 그것을, 안 주면 안드로이드 상태줄 높이 · iOS 는 44 로 짐작한다.
 * 내용이 이보다 길면 시트 안에서 스크롤한다(0.1.1 — 시트 맨 위 줄이 상태줄 밑으로 밀려 잘리던 것, 감자밭 시뮬)
 */
function sheetMaxHeight(windowHeight, topInset, os = react_native_1.Platform.OS, statusBar = react_native_1.StatusBar.currentHeight) {
    const top = typeof topInset === 'number' && topInset >= 0 ? topInset : os === 'android' ? (statusBar ?? 24) : 44;
    return Math.max(240, Math.round(windowHeight - top - 24));
}
/** 복권 시트 — 3단계 줄 · 받기 / 열기 / 획득 완료 · 당첨 띠 · 「한 번 더! ○원 복권 받기」 · 알림 켜기 */
function LotterySheet({ open, state, winners, busy, onOpen, onEarn, onMore, onClose, onEnableNotify, notifyLabel, notify, theme, renderNative, topInset, basicAd = true, adLabel }) {
    if (!open || !state)
        return null;
    const c = th(theme);
    const more = (0, lottery_1.lotteryMoreLabel)(state);
    const next = state.tiers.find(t => t.missionState === 'locked');
    const last = winners && winners.length > 0 ? winners[0] : null;
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.overlay, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", onPress: onClose, style: s.dim }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.sheet, { backgroundColor: c.card, maxHeight: sheetMaxHeight(react_native_1.Dimensions.get('window').height, topInset) }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", hitSlop: 12, onPress: onClose, style: s.close, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.closeText, { color: c.sub }], children: "\u2715" }) }), (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { bounces: false, showsVerticalScrollIndicator: false, contentContainerStyle: s.sheetBody, children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.sheetTitle, { color: c.text }], children: ["\uAF5D \uC5C6\uB294 \uBCF5\uAD8C", '\n', "\uC9C0\uAE08 \uC5F4\uACE0 \uD589\uC6B4 \uBC1B\uC544\uAC00\uC694!"] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.sheetSub, { color: c.sub }], children: "\uBC1B\uC740 \uBCF5\uAD8C\uC740 \uB9E4\uC77C \uC790\uC815\uC5D0 \uC0AC\uB77C\uC838\uC694" }), last ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.ticker, { backgroundColor: c.bg }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.tickerText, { color: c.text }], numberOfLines: 1, children: (0, lottery_1.lotteryWinnerLine)(last) }) }) : null, state.tiers.map(t => (0, jsx_runtime_1.jsx)(TierRow, { t: t, theme: c, busy: busy, onOpen: onOpen, onEarn: onEarn, ad: (0, lottery_1.opensWithAd)(t, basicAd), adLabel: adLabel }, t.tier)), more && next ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: more, disabled: !!busy, onPress: () => (onMore ?? onEarn)(next.tier), style: [s.big, { backgroundColor: c.accent }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bigText, { color: c.accentText }], children: more }) }) : null, notify ? (0, jsx_runtime_1.jsx)(NotifyRow, { notify: notify, theme: c }) : onEnableNotify ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: notifyLabel ?? '복권 받게 알림 켜기', onPress: onEnableNotify, style: s.link, children: (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.linkText, { color: c.accent }], children: ["\uD83D\uDD14 ", notifyLabel ?? '복권 받게 알림 켜기', " \u203A"] }) }) : null, renderNative ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.native, children: renderNative() }) : null] })] })] });
}
/**
 * 결과 창 — 「축하해요 보상 ○P 당첨!」, **큰 아이콘 없음**(대표님 13:56). 버튼 아래에 앱이 넘기는 네이티브 광고(`renderNative`).
 * 남은 복권이 있으면 「다음 복권 열기」, 없으면 「미션 하고 복권 더 받기」(다음 단계까지 남은 미션 수), 둘 다 「다음에 할게요」로 닫는다.
 */
function LotteryResult({ result, state, onOpenNext, onMore, onClose, renderNative, theme, nextAd, adLabel, notify }) {
    const c = th(theme);
    const hasNext = result.unopened > 0;
    const moreLabel = !hasNext && state ? (0, lottery_1.lotteryMoreMissionLabel)(state) : null;
    // 순서: 제목 → 버튼 → **네이티브 광고는 버튼 아래**(대표님 13:56 · 감자밭 시뮬에서 버튼 위에 있던 것을 바로잡음, 0.1.1)
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.result, { backgroundColor: c.card }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.resultTitle, { color: c.text }], children: (0, lottery_1.lotteryResultTitle)(result.points) }), (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.resultSub, { color: c.sub }], children: [result.won.toLocaleString('ko-KR'), "\uC6D0 \uBCF5\uAD8C"] }), hasNext && onOpenNext ? (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2E4\uC74C \uBCF5\uAD8C \uC5F4\uAE30", onPress: onOpenNext, style: [s.big, s.bigRow, { backgroundColor: c.accent }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.bigText, { color: c.accentText }], children: ["\uB2E4\uC74C \uBCF5\uAD8C \uC5F4\uAE30 (", result.unopened, "\uC7A5 \uB0A8\uC558\uC5B4\uC694)"] }), nextAd ? (0, jsx_runtime_1.jsx)(AdChip, { label: adLabel, onColor: c.accentText, onFilled: true }) : null] }) : null, !hasNext && moreLabel && onMore ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: moreLabel, onPress: onMore, style: [s.big, { backgroundColor: c.accent }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bigText, { color: c.accentText }], children: moreLabel }) }) : null, (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2E4\uC74C\uC5D0 \uD560\uAC8C\uC694", onPress: onClose, style: s.link, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.linkText, { color: c.sub }], children: "\uB2E4\uC74C\uC5D0 \uD560\uAC8C\uC694" }) }), (0, jsx_runtime_1.jsx)(NotifyRow, { notify: notify, theme: c }), renderNative ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.native, children: renderNative() }) : null] });
}
/**
 * 기본으로 그리는 황금 복권 그림 — 앱 그림(`icon`)이 없을 때. 금빛 티켓 한 장에 별 하나, 오른쪽은 점선 절취선
 */
function GoldenTicketArt() {
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { accessible: false, importantForAccessibility: "no-hide-descendants", style: s.goldTicket, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.goldStar, children: "\u2605" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldPerforation }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldStub, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.goldStubText, children: "GOLD" }) })] });
}
/**
 * 황금 복권 팝업 — 「황금 복권이 나타났어요!」 하루 한 번(0.1.2: 읽기 쉽게 다시 짰다 — 대표님 15:48 「가독성이 떨어진다. 간격 좀 넣고 설명 좀 잘 넣어」).
 * 위에서 아래로: 닫기(X, 자기 줄 — 제목과 겹치지 않는다) → 황금 복권 그림(`icon` 이 있으면 그것) → 제목 → 쉬운 말 3줄 → 작은 글씨 → 버튼 → 「다음에 열기」.
 * 값(최대 금액 · 포인트)은 서버 state 에서 읽어 넘긴다 — `maxWon`(필수) · `maxPoints`(없으면 금액만 보인다). 문구는 `lines`/`note` 로 통째로 바꿀 수 있다(다국어).
 * 버튼은 「광고 보고 황금 복권 열기」: 앱이 `onOpen` 에서 **보상형 광고(용도 lottery_basic)를 보여 준 뒤** `useLottery.open(tier, 'basic')` 을 부른다
 * — 광고 시청은 서버가 구글 SSV 로 확인한다(앱 말만 믿지 않는다). 광고가 바로 열리므로 버튼 안 오른쪽에 「광고」 칩(`ad` 가 false 면 칩 · 광고 문구 없음).
 * busy 동안은 다시 눌리지 않는다. `bottomInset` 은 아래 안전 영역(`useSafeAreaInsets().bottom`).
 */
function GoldenLotteryPopup({ open, maxWon, maxPoints, busy, onOpen, onClose, buttonLabel, icon, theme, ad = true, adLabel, closeLabel, lines, note, bottomInset = 0, notify }) {
    if (!open)
        return null;
    const c = th(theme);
    const label = buttonLabel ?? (ad ? '광고 보고 황금 복권 열기' : '황금 복권 열기');
    const copy = (0, lottery_1.goldenLines)({ maxWon, maxPoints, ad });
    const body = lines ?? copy.lines;
    const small = note ?? copy.note;
    const later = closeLabel ?? '다음에 열기';
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.overlay, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", onPress: onClose, style: s.dim }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.goldSheet, { backgroundColor: c.card, paddingBottom: GOLD_PAD + Math.max(0, bottomInset) }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldHeader, children: (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", hitSlop: 12, onPress: onClose, style: s.goldClose, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.closeText, { color: c.sub }], children: "\u2715" }) }) }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldArt, children: icon ?? (0, jsx_runtime_1.jsx)(GoldenTicketArt, {}) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { accessibilityRole: "header", style: [s.goldTitle, { color: c.text }], children: "\uD669\uAE08 \uBCF5\uAD8C\uC774 \uB098\uD0C0\uB0AC\uC5B4\uC694!" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldLines, children: body.map((line, i) => (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.goldLine, { color: c.text }], children: line }, i)) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.goldNote, { color: c.sub }], children: small }), (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: label + (ad && !label.includes(adLabel ?? '광고') ? ', ' + (adLabel ?? '광고') : ''), accessibilityState: { disabled: !!busy }, disabled: !!busy, onPress: onOpen, style: [s.big, s.bigRow, { backgroundColor: c.accent }, busy && { opacity: 0.6 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bigText, { color: c.accentText }], children: label }), ad ? (0, jsx_runtime_1.jsx)(AdChip, { label: adLabel, onColor: c.accentText, onFilled: true }) : null] }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: later, onPress: onClose, style: s.goldLater, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.linkText, { color: c.sub }], children: later }) }), (0, jsx_runtime_1.jsx)(NotifyRow, { notify: notify, theme: c })] })] });
}
/** 황금 복권 시트의 바깥 여백(위 · 좌우 · 아래 모두 24 이상) */
const GOLD_PAD = 28;
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
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
    sheetBody: { gap: 12, paddingBottom: 4 },
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
    bigRow: { flexDirection: 'row', gap: 8 },
    adChip: { height: 20, paddingHorizontal: 7, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    adChipOnFilled: { borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.22)' },
    adChipText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
    goldSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: GOLD_PAD, paddingTop: 12 },
    goldHeader: { height: 40, alignItems: 'flex-end', justifyContent: 'center' },
    goldClose: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
    goldArt: { alignItems: 'center', marginTop: 4 },
    goldTicket: { width: 120, height: 72, borderRadius: 14, backgroundColor: '#FFD54A', borderWidth: 2, borderColor: '#E5A400', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', transform: [{ rotate: '-6deg' }] },
    goldStar: { flex: 1, textAlign: 'center', fontSize: 34, lineHeight: 40, color: '#B77900', fontWeight: '800' },
    goldPerforation: { alignSelf: 'stretch', width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: '#E5A400', marginVertical: 6 },
    goldStub: { width: 38, alignItems: 'center', justifyContent: 'center' },
    goldStubText: { fontSize: 10, fontWeight: '900', color: '#B77900', transform: [{ rotate: '90deg' }], width: 40, textAlign: 'center' },
    goldTitle: { marginTop: 20, fontSize: 24, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
    goldLines: { marginTop: 16, gap: 8 },
    goldLine: { fontSize: 16, lineHeight: 26, textAlign: 'center' },
    goldNote: { marginTop: 12, marginBottom: 24, fontSize: 13, lineHeight: 20, textAlign: 'center' },
    goldLater: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 8 },
    notify: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, marginTop: 8 },
    notifyBell: { fontSize: 22 },
    notifyCopy: { flex: 1, minWidth: 0, gap: 2 },
    notifyTitle: { fontSize: 14, lineHeight: 20, fontWeight: '800' },
    notifyHint: { fontSize: 12, lineHeight: 18 },
    notifyBtn: { height: 32, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    notifyBtnText: { fontSize: 13, fontWeight: '800' },
    bigText: { fontSize: 16, fontWeight: '800' },
    link: { alignItems: 'center', paddingVertical: 8 },
    linkText: { fontSize: 14, fontWeight: '700' },
    native: { marginTop: 4 },
    golden: { alignItems: 'center', paddingVertical: 12 },
    result: { borderRadius: 24, paddingHorizontal: 20, paddingVertical: 28, gap: 12, alignItems: 'stretch' },
    resultTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 30 },
    resultSub: { fontSize: 14, textAlign: 'center' },
});
