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
function NotifyRow({ notify, theme }) {
    if (!notify || !notify.visible)
        return null;
    const label = notify.label ?? '복권 받게 알림 켜기';
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.notifyBox, children: [(0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: label, accessibilityState: { disabled: !!notify.busy }, disabled: !!notify.busy, onPress: notify.onPress, hitSlop: 8, style: [s.notifyLink, notify.busy && { opacity: 0.6 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { accessible: false, style: s.notifyBell, children: "\uD83D\uDD14" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.notifyTitle, { color: theme.accent }], children: label }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { accessible: false, style: [s.notifyChevron, { color: theme.accent }], children: "\u203A" })] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.notifyHint, { color: theme.sub }], children: notify.hint ?? '매일 새 복권이 나오면 알려 드릴게요' })] });
}
function Layer({ open, onClose, presentation = 'overlay', children }) {
    (0, react_1.useEffect)(() => {
        if (!open)
            return undefined;
        const sub = react_native_1.BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
        return () => sub.remove();
    }, [open, onClose]);
    if (!open)
        return null;
    if (presentation === 'modal')
        return (0, jsx_runtime_1.jsx)(react_native_1.Modal, { visible: true, transparent: true, animationType: "fade", statusBarTranslucent: true, onRequestClose: onClose, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.layerFill, children: children }) });
    return (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.overlay, children: children });
}
/**
 * 시트가 차지할 수 있는 높이 — 화면 높이에서 위 여백(상태줄 · 노치)과 숨 쉴 자리를 뺀다. 앱이 안전 영역 위 값을 `topInset` 으로 주면 그것을, 안 주면 안드로이드 상태줄 높이 · iOS 는 44 로 짐작한다.
 * 내용이 이보다 길면 시트 안에서 스크롤한다(0.1.1 — 시트 맨 위 줄이 상태줄 밑으로 밀려 잘리던 것, 감자밭 시뮬)
 */
function sheetMaxHeight(windowHeight, topInset, os = react_native_1.Platform.OS, statusBar = react_native_1.StatusBar.currentHeight) {
    const top = typeof topInset === 'number' && topInset >= 0 ? topInset : os === 'android' ? (statusBar ?? 24) : 44;
    return Math.max(240, Math.round(windowHeight - top - 24));
}
/**
 * 바텀 시트(0.1.3, 대표님 15:55 「팝업이냐 bottom 시트냐 닫기가 없어」): ① 뒤 화면 어둡게(딤) — 딤을 누르면 닫힘 ② 오른쪽 위 X ③ 위 손잡이 바 ④ 둥근 위 모서리 흰 판,
 * 아래는 안전 영역(`bottomInset`)만큼 더 띄운다. 내용이 길면 시트 안에서 스크롤.
 */
function BottomSheet({ open, onClose, theme, topInset, bottomInset = 0, presentation, children }) {
    return (0, jsx_runtime_1.jsxs)(Layer, { open: open, onClose: onClose, presentation: presentation, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", onPress: onClose, style: s.dim }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.bsheet, { backgroundColor: theme.card, maxHeight: sheetMaxHeight(react_native_1.Dimensions.get('window').height, topInset), paddingBottom: SHEET_PAD + Math.max(0, bottomInset) }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { accessible: false, style: s.handleWrap, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.handle, { backgroundColor: theme.done }] }) }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.bsHeader, children: (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", hitSlop: 12, onPress: onClose, style: s.bsClose, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.closeText, { color: theme.sub }], children: "\u2715" }) }) }), (0, jsx_runtime_1.jsx)(react_native_1.ScrollView, { bounces: false, showsVerticalScrollIndicator: false, contentContainerStyle: s.bsBody, children: children })] })] });
}
/** 왼쪽 숫자 카드 아이콘 — 단계마다 다른 색(참고 캡처의 100 · 500 · 1000 카드). 황금 줄은 별 */
function NumberCard({ label, color }) {
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { accessible: false, importantForAccessibility: "no-hide-descendants", style: s.cardWrap, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.cardBack, { backgroundColor: color }] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.cardFront, { backgroundColor: color }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.cardText, numberOfLines: 1, adjustsFontSizeToFit: true, children: label }) })] });
}
function CardRow({ icon, color, title, hint, button, ad, adLabel, theme, busy, onPress }) {
    const active = button.kind === 'open' || button.kind === 'earn';
    return (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: title + ', ' + button.label + (ad ? ', ' + (adLabel ?? '광고') : ''), accessibilityState: { disabled: !active || !!busy }, disabled: !active || !!busy, onPress: onPress, style: s.row, children: [(0, jsx_runtime_1.jsx)(NumberCard, { label: icon, color: color }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.rowCopy, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.rowTitle, { color: theme.text }], children: title }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.rowHint, { color: theme.sub }], children: hint })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { pointerEvents: "none", style: [s.rowButton, { backgroundColor: active ? theme.accentSoft : theme.done }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.rowButtonText, { color: active ? theme.accent : theme.sub }], children: button.label }), ad && button.kind === 'open' ? (0, jsx_runtime_1.jsx)(AdChip, { label: adLabel, onColor: theme.accent }) : null] })] });
}
/** 단계마다 다른 카드 색 — 첫 색은 앱 강조색, 나머지는 고정 보조색(마지막은 황금) */
const cardColors = (c, n) => [c.accent, '#8E6CF0', '#F28C28', '#35A7F0', '#2DB77E'].slice(0, Math.max(1, n));
const GOLD_COLOR = '#E8B100';
/**
 * 복권 시트 — 참고 캡처(IMG_9331) 구성: 딤 · 둥근 흰 시트 · X · 손잡이 → 큰 제목 2줄 + 회색 한 줄 → 회색 둥근 당첨 띠(**서버 winners 의 실제 기록이 있을 때만**, 가짜 이름 없음)
 * → 줄 목록(왼쪽 숫자 카드 · 「최대 ○ 복권」 굵게 · 회색 설명 · 오른쪽 「받기」 연한 버튼 / 「받기 완료」 회색) → 맨 아래 큰 「한 번 더! ○ 복권 받기」 + 「🔔 복권 받게 알림 켜기 ›」 링크.
 * 줄: 미션 복권 줄(단계마다, 미션 복권만의 상태) + 하루 기본(황금) 복권 줄(있을 때). 포인트 표 단계는 「최대 1,000P 복권」(unit:'points'), 원 표는 「최대 100원 복권」.
 * 광고가 바로 열리는 줄(황금 복권을 여는 버튼)에만 「광고」 칩. `onOpen(tier, src)` — 미션 줄은 'mission', 황금 줄은 'basic'(앱은 'basic' 일 때 보상형 광고를 먼저 보여 준다).
 */
function LotterySheet({ open, state, winners, busy, onOpen, onEarn, onMore, onClose, onEnableNotify, notifyLabel, notify, theme, renderNative, topInset, bottomInset, basicAd = true, adLabel, presentation }) {
    if (!open || !state)
        return null;
    const c = th(theme);
    const gold = (0, lottery_1.goldenRow)(state);
    const next = state.tiers.find(t => t.missionState === 'locked') ?? null;
    const more = next ? (0, lottery_1.lotteryMoreLabel)(state) : null;
    const last = winners && winners.length > 0 ? winners[0] : null;
    const colors = cardColors(c, state.tiers.length);
    const parts = last ? (0, lottery_1.lotteryWinnerParts)(last) : null;
    return (0, jsx_runtime_1.jsxs)(BottomSheet, { open: open, onClose: onClose, theme: c, topInset: topInset, bottomInset: bottomInset, presentation: presentation, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { accessibilityRole: "header", style: [s.sheetTitle, { color: c.text }], children: '꽝 없는 복권\n지금 열고 행운 받아가요!' }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.sheetSub, { color: c.sub }], children: "\uBC1B\uC740 \uBCF5\uAD8C\uC740 \uB9E4\uC77C \uC790\uC815\uC5D0 \uC0AC\uB77C\uC838\uC694" }), parts ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.ticker, { backgroundColor: c.bg }], children: (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.tickerText, { color: c.text }], numberOfLines: 1, children: [parts.pre, (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { color: c.accent, fontWeight: '800' }, children: parts.amount }), parts.post] }) }) : null, (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.rows, children: [state.tiers.map((t, i) => {
                        const b = (0, lottery_1.lotteryMissionButton)(t);
                        return (0, jsx_runtime_1.jsx)(CardRow, { icon: String(t.missions), color: colors[i % colors.length], title: (0, lottery_1.lotteryTierTitle)(t), hint: (0, lottery_1.lotteryMissionHint)(t), button: b, theme: c, busy: busy, onPress: () => { if (b.kind === 'open')
                                onOpen(t.tier, 'mission');
                            else if (b.kind === 'earn')
                                onEarn(t.tier); } }, t.tier);
                    }), gold ? (0, jsx_runtime_1.jsx)(CardRow, { icon: "\u2605", color: GOLD_COLOR, title: (0, lottery_1.lotteryTierTitle)(gold.tier), hint: basicAd ? '황금 복권을 이용해서 얻을 수 있어요' : '매일 한 번 열 수 있어요', button: gold.unopened > 0 ? { label: '열기', kind: 'open' } : { label: '받기 완료', kind: 'done' }, ad: basicAd && gold.unopened > 0, adLabel: adLabel, theme: c, busy: busy, onPress: () => onOpen(gold.tier.tier, 'basic') }) : null] }), more && next ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: more, disabled: !!busy, onPress: () => (onMore ?? onEarn)(next.tier), style: [s.big, { backgroundColor: c.accent }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bigText, { color: c.accentText }], children: more }) }) : null, notify ? (0, jsx_runtime_1.jsx)(NotifyRow, { notify: notify, theme: c }) : onEnableNotify ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: notifyLabel ?? '복권 받게 알림 켜기', onPress: onEnableNotify, style: s.link, children: (0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.linkText, { color: c.accent }], children: ["\uD83D\uDD14 ", notifyLabel ?? '복권 받게 알림 켜기', " \u203A"] }) }) : null, renderNative ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.native, children: renderNative() }) : null] });
}
/**
 * 기본으로 그리는 황금 복권 그림 — 앱 그림(`icon`)이 없을 때. 금빛 티켓 한 장에 별 하나, 오른쪽은 점선 절취선
 */
function GoldenTicketArt() {
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { accessible: false, importantForAccessibility: "no-hide-descendants", style: s.goldTicket, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.goldStar, children: "\u2605" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldPerforation }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldStub, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.goldStubText, children: "GOLD" }) })] });
}
/**
 * 당첨 결과 — **전체 화면**(0.1.3, 대표님 15:57 「당첨 화면은 전체 화면으로 나오게 해」): 탭 메뉴 · 상태줄까지 덮는다(앱 루트에 그리거나 `presentation="modal"`).
 * 위: X(오른쪽) → 가운데 「축하해요!」 + 큰 「5P 당첨!」 + 복권 그림(`icon` 이 있으면 그것) → 아래: 큰 버튼 + 「확인」 + 알림 켜기 링크 + 네이티브 광고(`renderNative`).
 * 남은 복권이 있으면 「다음 복권 열기 (N장 남았어요)」, 없으면 「한 번 더! ○ 복권 받기」(다음 단계), 둘 다 없으면 「확인」만. 원 표 단계는 「○원 복권」 한 줄이 더 붙고 포인트 표는 P 만 보인다.
 * `topInset`/`bottomInset` 은 안전 영역(상태줄 · 홈 바) 값.
 */
function LotteryResult({ result, state, onOpenNext, onMore, onClose, renderNative, theme, nextAd, adLabel, notify, icon, topInset = 0, bottomInset = 0, presentation, open = true }) {
    const c = th(theme);
    const hasNext = result.unopened > 0;
    const moreLabel = !hasNext && state ? (0, lottery_1.lotteryMoreLabel)(state) : null;
    const wonLine = result.unit === 'points' ? null : result.won.toLocaleString('ko-KR') + '원 복권';
    return (0, jsx_runtime_1.jsx)(Layer, { open: open, onClose: onClose, presentation: presentation, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.full, { backgroundColor: c.card, paddingTop: Math.max(0, topInset) + 8, paddingBottom: Math.max(0, bottomInset) + 20 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.fullHeader, children: (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", hitSlop: 12, onPress: onClose, style: s.bsClose, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.closeText, { color: c.sub }], children: "\u2715" }) }) }), (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { bounces: false, showsVerticalScrollIndicator: false, contentContainerStyle: s.fullBody, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.fullCenter, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.fullKicker, { color: c.sub }], children: "\uCD95\uD558\uD574\uC694!" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { accessibilityRole: "header", style: [s.fullHeadline, { color: c.text }], children: (0, lottery_1.lotteryResultHeadline)(result.points) }), wonLine ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.fullSub, { color: c.sub }], children: wonLine }) : null, (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.fullArt, children: icon ?? (0, jsx_runtime_1.jsx)(GoldenTicketArt, {}) })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.fullActions, children: [hasNext && onOpenNext ? (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2E4\uC74C \uBCF5\uAD8C \uC5F4\uAE30", onPress: onOpenNext, style: [s.big, s.bigRow, { backgroundColor: c.accent }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.Text, { style: [s.bigText, { color: c.accentText }], children: ["\uB2E4\uC74C \uBCF5\uAD8C \uC5F4\uAE30 (", result.unopened, "\uC7A5 \uB0A8\uC558\uC5B4\uC694)"] }), nextAd ? (0, jsx_runtime_1.jsx)(AdChip, { label: adLabel, onColor: c.accentText, onFilled: true }) : null] }) : null, !hasNext && moreLabel && onMore ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: moreLabel, onPress: onMore, style: [s.big, { backgroundColor: c.accent }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bigText, { color: c.accentText }], children: moreLabel }) }) : null, (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uD655\uC778", onPress: onClose, style: s.link, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.linkText, { color: c.sub }], children: "\uD655\uC778" }) }), (0, jsx_runtime_1.jsx)(NotifyRow, { notify: notify, theme: c }), renderNative ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.native, children: renderNative() }) : null] })] })] }) });
}
/**
 * 황금 복권 팝업 — 「황금 복권이 나타났어요!」 하루 한 번(0.1.2: 읽기 쉽게, 0.1.3: **바텀 시트**로 — 딤 · X · 손잡이 · 안전 영역). 위에서 아래로: 황금 복권 그림(`icon` 이 있으면 그것) → 제목 → 쉬운 말 3줄 → 작은 글씨 → 버튼 → 「다음에 열기」.
 * 값(최대 금액 · 포인트)은 서버 state 에서 읽어 넘긴다 — `maxWon`(필수) · `maxPoints` · **`unit`**(포인트 표면 'points' → 「최대 1,000P가 바로 들어와요」, 원 병기 없음). 문구는 `lines`/`note` 로 통째로 바꿀 수 있다(다국어).
 * 버튼은 「광고 보고 황금 복권 열기」: 앱이 `onOpen` 에서 **보상형 광고(용도 lottery_basic)를 보여 준 뒤** `useLottery.open(tier, 'basic')` 을 부른다
 * — 광고 시청은 서버가 구글 SSV 로 확인한다(앱 말만 믿지 않는다). 광고가 바로 열리므로 버튼 안 오른쪽에 「광고」 칩(`ad` 가 false 면 칩 · 광고 문구 없음). busy 동안은 다시 눌리지 않는다.
 */
function GoldenLotteryPopup({ open, maxWon, maxPoints, unit, busy, onOpen, onClose, buttonLabel, icon, theme, ad = true, adLabel, closeLabel, lines, note, topInset, bottomInset = 0, notify, presentation }) {
    if (!open)
        return null;
    const c = th(theme);
    const label = buttonLabel ?? (ad ? '광고 보고 황금 복권 열기' : '황금 복권 열기');
    const copy = (0, lottery_1.goldenLines)({ maxWon, maxPoints, ad, unit });
    const body = lines ?? copy.lines;
    const small = note ?? copy.note;
    const later = closeLabel ?? '다음에 열기';
    return (0, jsx_runtime_1.jsxs)(BottomSheet, { open: open, onClose: onClose, theme: c, topInset: topInset, bottomInset: bottomInset, presentation: presentation, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldArt, children: icon ?? (0, jsx_runtime_1.jsx)(GoldenTicketArt, {}) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { accessibilityRole: "header", style: [s.goldTitle, { color: c.text }], children: "\uD669\uAE08 \uBCF5\uAD8C\uC774 \uB098\uD0C0\uB0AC\uC5B4\uC694!" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldLines, children: body.map((line, i) => (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.goldLine, { color: c.text }], children: line }, i)) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.goldNote, { color: c.sub }], children: small }), (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: label + (ad && !label.includes(adLabel ?? '광고') ? ', ' + (adLabel ?? '광고') : ''), accessibilityState: { disabled: !!busy }, disabled: !!busy, onPress: onOpen, style: [s.big, s.bigRow, { backgroundColor: c.accent }, busy && { opacity: 0.6 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bigText, { color: c.accentText }], children: label }), ad ? (0, jsx_runtime_1.jsx)(AdChip, { label: adLabel, onColor: c.accentText, onFilled: true }) : null] }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: later, onPress: onClose, style: s.goldLater, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.linkText, { color: c.sub }], children: later }) }), (0, jsx_runtime_1.jsx)(NotifyRow, { notify: notify, theme: c })] });
}
/** 시트의 바깥 여백(좌우 · 아래) */
const SHEET_PAD = 24;
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
    layerFill: { flex: 1, justifyContent: 'flex-end' },
    dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
    bsheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: SHEET_PAD, paddingTop: 8 },
    handleWrap: { alignItems: 'center', paddingTop: 4, paddingBottom: 4 },
    handle: { width: 44, height: 5, borderRadius: 3 },
    bsHeader: { height: 40, alignItems: 'flex-end', justifyContent: 'center' },
    bsClose: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
    bsBody: { paddingBottom: 4 },
    closeText: { fontSize: 22, fontWeight: '600' },
    sheetTitle: { fontSize: 26, lineHeight: 36, fontWeight: '800', textAlign: 'center', marginTop: 4 },
    sheetSub: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12 },
    ticker: { borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginTop: 24 },
    tickerText: { fontSize: 14, fontWeight: '600' },
    rows: { marginTop: 20, gap: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
    rowCopy: { flex: 1, minWidth: 0, gap: 3 },
    rowTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
    rowHint: { fontSize: 14, lineHeight: 20 },
    rowButton: { minWidth: 84, height: 44, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
    rowButtonText: { fontSize: 15, fontWeight: '800' },
    cardWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
    cardBack: { position: 'absolute', width: 40, height: 40, borderRadius: 11, opacity: 0.35, transform: [{ rotate: '8deg' }], right: 2, top: 2 },
    cardFront: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
    cardText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', paddingHorizontal: 4 },
    big: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 20 },
    bigRow: { flexDirection: 'row', gap: 8 },
    bigText: { fontSize: 17, fontWeight: '800' },
    adChip: { height: 20, paddingHorizontal: 7, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    adChipOnFilled: { borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.22)' },
    adChipText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
    link: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 4 },
    linkText: { fontSize: 15, fontWeight: '700' },
    native: { marginTop: 12 },
    notifyBox: { alignItems: 'center', marginTop: 8, gap: 2 },
    notifyLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingVertical: 6 },
    notifyBell: { fontSize: 18 },
    notifyTitle: { fontSize: 15, fontWeight: '700' },
    notifyChevron: { fontSize: 22, lineHeight: 22, fontWeight: '600' },
    notifyHint: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
    goldArt: { alignItems: 'center', marginTop: 4 },
    goldTicket: { width: 120, height: 72, borderRadius: 14, backgroundColor: '#FFD54A', borderWidth: 2, borderColor: '#E5A400', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', transform: [{ rotate: '-6deg' }] },
    goldStar: { flex: 1, textAlign: 'center', fontSize: 34, lineHeight: 40, color: '#B77900', fontWeight: '800' },
    goldPerforation: { alignSelf: 'stretch', width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: '#E5A400', marginVertical: 6 },
    goldStub: { width: 38, alignItems: 'center', justifyContent: 'center' },
    goldStubText: { fontSize: 10, fontWeight: '900', color: '#B77900', transform: [{ rotate: '90deg' }], width: 40, textAlign: 'center' },
    goldTitle: { marginTop: 20, fontSize: 24, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
    goldLines: { marginTop: 16, gap: 8 },
    goldLine: { fontSize: 16, lineHeight: 26, textAlign: 'center' },
    goldNote: { marginTop: 12, fontSize: 13, lineHeight: 20, textAlign: 'center' },
    goldLater: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 8 },
    full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: SHEET_PAD },
    fullHeader: { height: 44, alignItems: 'flex-end', justifyContent: 'center' },
    fullBody: { flexGrow: 1, justifyContent: 'space-between' },
    fullCenter: { alignItems: 'center', paddingTop: 24, paddingBottom: 24 },
    fullKicker: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
    fullHeadline: { marginTop: 8, fontSize: 48, lineHeight: 58, fontWeight: '900', textAlign: 'center' },
    fullSub: { marginTop: 8, fontSize: 16, lineHeight: 24 },
    fullArt: { marginTop: 32, alignItems: 'center' },
    fullActions: { paddingTop: 8 },
});
