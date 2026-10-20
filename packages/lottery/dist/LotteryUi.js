"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESULT = exports.DEFAULT_LOTTERY_THEME = void 0;
exports.LotteryChip = LotteryChip;
exports.sheetMaxHeight = sheetMaxHeight;
exports.LotterySheet = LotterySheet;
exports.LotteryResult = LotteryResult;
exports.GoldenLotteryPopup = GoldenLotteryPopup;
exports.lotteryResultTopHeight = lotteryResultTopHeight;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const lottery_1 = require("./lottery");
exports.DEFAULT_LOTTERY_THEME = {
    bg: '#FBF7F2', card: '#FFFFFF', text: '#2B2118', sub: '#6B5E52', accent: '#EE7A33', accentText: '#FFFFFF', accentSoft: '#FDE6D6', done: '#D3D7DD',
};
/**
 * (0.1.4) 한글 줄바꿈은 **단어(띄어쓰기) 단위로** — iOS 기본은 글자 단위로 끊어 「받아가요!」가 「받아가」 / 「요!」 로 갈라졌다(감자밭 캡처). lineBreakStrategyIOS="hangul-word" 를 모든 글자에 준다(Android 는 무시).
 * 이 패키지의 글자는 모두 이것을 쓴다 — 제목 · 줄 설명은 줄 수 · 너비에 맞춰 줄어들고(adjustsFontSizeToFit) 한 글자만 남는 줄이 없게 한다
 */
function Txt(props) {
    return (0, jsx_runtime_1.jsx)(react_native_1.Text, { lineBreakStrategyIOS: "hangul-word", ...props });
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
        return (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: text, onPress: onPress, style: ({ pressed }) => [s.chip, { backgroundColor: c.accent }, pressed && { opacity: 0.85 }], children: (0, jsx_runtime_1.jsx)(Txt, { style: [s.chipText, { color: c.accentText }], children: text }) });
    }
    return (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: [s.anchor, { bottom: bottomOffset }], children: (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: { maxWidth: '100%', transform: [{ translateY: bob }] }, children: (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: text, onPress: onPress, style: ({ pressed }) => [s.floating, pressed && { opacity: 0.8 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", children: icon ?? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.ticket, { borderColor: c.accent }], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.ticketLine, { borderColor: c.accent }] }) }) }), (0, jsx_runtime_1.jsx)(Txt, { style: s.floatingText, children: text }), (0, jsx_runtime_1.jsx)(Txt, { accessible: false, style: s.arrow, children: "\u203A" })] }) }) });
}
/**
 * (0.1.2) 「광고」 작은 칩 — 눌렀을 때 **광고가 바로 열리는** 버튼 안 오른쪽에만(앱 홈 「감자 키우기 [광고]」 · 「풍선 더 받기 [광고]」와 같은 모양). 광고 없이 열리는 버튼에는 넣지 않는다.
 * `onColor` 는 칩이 올라가는 바탕에서 읽히는 글자색(채운 버튼 위면 accentText, 연한 버튼 위면 accent)
 */
function AdChip({ label = '광고', onColor, onFilled }) {
    return (0, jsx_runtime_1.jsx)(react_native_1.View, { accessible: false, importantForAccessibility: "no-hide-descendants", style: [s.adChip, onFilled ? s.adChipOnFilled : { borderColor: onColor }], children: (0, jsx_runtime_1.jsx)(Txt, { style: [s.adChipText, { color: onColor }], children: label }) });
}
function NotifyRow({ notify, theme, compact }) {
    if (!notify || !notify.visible)
        return null;
    const label = notify.label ?? '복권 받게 알림 켜기';
    // compact(0.1.4, 당첨 전체 화면) — 설명 줄 없이 한 줄만: 아래 네이티브 광고가 스크롤 없이 보이게
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.notifyBox, compact && s.notifyBoxCompact], children: [(0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: label, accessibilityState: { disabled: !!notify.busy }, disabled: !!notify.busy, onPress: notify.onPress, hitSlop: 8, style: [s.notifyLink, compact && s.notifyLinkCompact, notify.busy && { opacity: 0.6 }], children: [(0, jsx_runtime_1.jsx)(Txt, { accessible: false, style: s.notifyBell, children: "\uD83D\uDD14" }), (0, jsx_runtime_1.jsx)(Txt, { style: [s.notifyTitle, { color: theme.accent }], children: label }), (0, jsx_runtime_1.jsx)(Txt, { accessible: false, style: [s.notifyChevron, { color: theme.accent }], children: "\u203A" })] }), compact ? null : (0, jsx_runtime_1.jsx)(Txt, { style: [s.notifyHint, { color: theme.sub }], children: notify.hint ?? '매일 새 복권이 나오면 알려 드릴게요' })] });
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
    return (0, jsx_runtime_1.jsxs)(Layer, { open: open, onClose: onClose, presentation: presentation, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", onPress: onClose, style: s.dim }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.bsheet, { backgroundColor: theme.card, maxHeight: sheetMaxHeight(react_native_1.Dimensions.get('window').height, topInset), paddingBottom: SHEET_PAD + Math.max(0, bottomInset) }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { accessible: false, style: s.handleWrap, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.handle, { backgroundColor: theme.done }] }) }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.bsHeader, children: (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", hitSlop: 12, onPress: onClose, style: s.bsClose, children: (0, jsx_runtime_1.jsx)(Txt, { style: [s.closeText, { color: theme.sub }], children: "\u2715" }) }) }), (0, jsx_runtime_1.jsx)(react_native_1.ScrollView, { bounces: false, showsVerticalScrollIndicator: false, contentContainerStyle: s.bsBody, children: children })] })] });
}
/**
 * (0.1.6) 전체 화면 틀 — `@jcurve/mission` 의 PageFrame(행운 찬스 화면)과 **같은 치수**. lottery 는 mission 에 기대지 않아 따로 그리되 치수를 맞춘다:
 * 머리글 높이 52 · 양옆 44 · 「‹」 32 · 가운데 제목 18/700 · 본문 padding 16 / 아래 40 / 칸 사이 12. 위 안전 영역은 앱 바깥 틀이 잡는다(`topInset` 기본 0).
 * 바탕은 theme.bg, 안드로이드 뒤로 가기는 닫기(Layer). `footer` 는 맨 아래 광고 자리 — 카드와는 본문 칸 사이 12 만큼(위 여백 보정 없음).
 */
function FullPage({ open, onClose, presentation, title, theme, topInset = 0, bottomInset = 0, footer, children }) {
    return (0, jsx_runtime_1.jsx)(Layer, { open: open, onClose: onClose, presentation: presentation, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.page, { backgroundColor: theme.bg, paddingTop: Math.max(0, topInset), paddingBottom: Math.max(0, bottomInset) }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.pageHeader, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB4A4\uB85C", hitSlop: 12, onPress: onClose, style: s.pageSide, children: (0, jsx_runtime_1.jsx)(Txt, { style: [s.pageBack, { color: theme.text }], children: "\u2039" }) }), (0, jsx_runtime_1.jsx)(Txt, { accessibilityRole: "header", style: [s.pageTitle, { color: theme.text }], numberOfLines: 1, children: title }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.pageSide })] }), (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { bounces: false, showsVerticalScrollIndicator: false, contentContainerStyle: s.pageContent, children: [children, footer != null ? (0, jsx_runtime_1.jsx)(react_native_1.View, { children: footer }) : null] })] }) });
}
/**
 * 목록 줄 — (0.1.5, 대표님 17:08) 왼쪽 숫자 박스(1 · 5 · 10 · 황금 별)는 없다: 제목 · 설명이 맨 왼쪽부터, 오른쪽에 버튼.
 * `compact`(0.1.6, 전체 화면 카드 안) — 행운 찬스 줄과 같은 크기: 제목 16 · 설명 13(한 줄, 넘치면 조금 줄어듦) · 버튼 72x36
 */
function CardRow({ title, hint, button, ad, adLabel, theme, busy, compact, onPress }) {
    const active = button.kind === 'open' || button.kind === 'earn';
    return (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: title + ', ' + button.label + (ad ? ', ' + (adLabel ?? '광고') : ''), accessibilityState: { disabled: !active || !!busy }, disabled: !active || !!busy, onPress: onPress, style: compact ? s.rowC : s.row, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.rowCopy, children: [(0, jsx_runtime_1.jsx)(Txt, { style: [compact ? s.rowTitleC : s.rowTitle, { color: theme.text }], numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.85, children: title }), (0, jsx_runtime_1.jsx)(Txt, { style: [compact ? s.rowHintC : s.rowHint, { color: theme.sub }], numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: compact ? 0.7 : 0.85, children: hint })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { pointerEvents: "none", style: [compact ? s.rowButtonC : s.rowButton, { backgroundColor: active ? theme.accentSoft : theme.done }], children: [(0, jsx_runtime_1.jsx)(Txt, { style: [compact ? s.rowButtonTextC : s.rowButtonText, { color: active ? theme.accent : theme.sub }], numberOfLines: 1, children: button.label }), ad && button.kind === 'open' ? (0, jsx_runtime_1.jsx)(AdChip, { label: adLabel, onColor: theme.accent }) : null] })] });
}
/**
 * 복권 목록 — (0.1.6) 기본은 **전체 화면**(감자밭 화면 그대로): 행운 찬스와 같은 머리글(‹ · 가운데 제목 「꽝 없는 복권」 · theme.bg 바탕, 안드 뒤로가기 → onClose) 아래 흰 카드(theme.card · 둥근 모서리 · 그림자)에
 * 「지금 열고 행운 받아가요!」 한 줄 + 회색 한 줄 → 당첨 띠(**서버 winners 의 실제 기록이 있을 때만**, 원 당첨도 P 로) → 단계 줄 + 황금 줄 → 「🔔 복권 받게 알림 켜기」(가운데). 「한 번 더」 버튼은 없다.
 * 맨 아래 `renderNative` 광고는 카드 아래 12. `fullScreen={false}` 면 예전 바텀 시트(딤 · X · 손잡이 · 큰 제목 2줄).
 * 줄: 서버 단계 수대로(같은 표 + 문턱이 10 의 배수는 한 줄로 묶음, 0.1.5) + 하루 기본(황금) 복권 줄(있을 때). 포인트 표 단계는 「최대 1,000P 복권」(unit:'points'), 원 표는 「최대 100원 복권」.
 * 광고가 바로 열리는 줄(황금 복권을 여는 버튼)에만 「광고」 칩. `onOpen(tier, src)` — 미션 줄은 'mission', 황금 줄은 'basic'(앱은 'basic' 일 때 보상형 광고를 먼저 보여 준다).
 */
function LotterySheet({ open, state, winners, busy, onOpen, onEarn, onClose, onEnableNotify, notifyLabel, notify, theme, renderNative, topInset, bottomInset, basicAd = true, adLabel, presentation, quiz = lottery_1.DEFAULT_QUIZ, fullScreen = true, headerTitle = '꽝 없는 복권' }) {
    if (!open || !state)
        return null;
    const c = th(theme);
    const gold = (0, lottery_1.goldenRow)(state);
    const last = (0, lottery_1.lotteryWinnersInPoints)(winners ?? [], state.wonToPoint)[0] ?? null; // 원 당첨도 P 로(0.1.6)
    const parts = last ? (0, lottery_1.lotteryWinnerParts)(last) : null;
    const ticker = parts
        ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [fullScreen ? s.tickerC : s.ticker, { backgroundColor: c.bg }], children: (0, jsx_runtime_1.jsxs)(Txt, { style: [fullScreen ? s.tickerTextC : s.tickerText, { color: c.text }], numberOfLines: 1, children: [parts.pre, (0, jsx_runtime_1.jsx)(Txt, { style: { color: c.accent, fontWeight: '800' }, children: parts.amount }), parts.post] }) })
        : null;
    const rows = (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: fullScreen ? s.rowsC : s.rows, children: [(0, lottery_1.lotteryGroupTiers)(state.tiers).map(group => {
                const r = (0, lottery_1.lotteryTierRow)(group, quiz);
                // 같은 표 + 문턱이 10 의 배수인 이어진 단계(10 · 20 · 30)는 한 줄 — 「열기 2」처럼 열 수 있는 장 수, 누르면 안 연 첫 단계(0.1.5)
                return (0, jsx_runtime_1.jsx)(CardRow, { title: (0, lottery_1.lotteryTierTitle)(r.rep), hint: r.hint, button: r.button, theme: c, busy: busy, compact: fullScreen, onPress: () => { if (r.button.kind === 'open' && r.openTier !== null)
                        onOpen(r.openTier, 'mission');
                    else if (r.button.kind === 'earn')
                        onEarn(r.earnTier); } }, r.rep.tier);
            }), gold ? (0, jsx_runtime_1.jsx)(CardRow, { title: (0, lottery_1.lotteryTierTitle)(gold.tier), hint: (0, lottery_1.lotteryGoldHint)(basicAd), compact: fullScreen, button: gold.unopened > 0 ? { label: '열기', kind: 'open' } : { label: '받기 완료', kind: 'done' }, ad: basicAd && gold.unopened > 0, adLabel: adLabel, theme: c, busy: busy, onPress: () => onOpen(gold.tier.tier, 'basic') }) : null] });
    const notifyView = notify ? (0, jsx_runtime_1.jsx)(NotifyRow, { notify: notify, theme: c }) : onEnableNotify ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: notifyLabel ?? '복권 받게 알림 켜기', onPress: onEnableNotify, style: s.link, children: (0, jsx_runtime_1.jsxs)(Txt, { style: [s.linkText, { color: c.accent }], children: ["\uD83D\uDD14 ", notifyLabel ?? '복권 받게 알림 켜기', " \u203A"] }) }) : null;
    if (fullScreen) {
        return (0, jsx_runtime_1.jsx)(FullPage, { open: open, onClose: onClose, presentation: presentation, title: headerTitle, theme: c, topInset: topInset, bottomInset: bottomInset, footer: renderNative ? renderNative() : null, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.card, { backgroundColor: c.card }], children: [(0, jsx_runtime_1.jsx)(Txt, { accessibilityRole: "header", style: [s.cardTitle, { color: c.text }], numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.8, children: "\uC9C0\uAE08 \uC5F4\uACE0 \uD589\uC6B4 \uBC1B\uC544\uAC00\uC694!" }), (0, jsx_runtime_1.jsx)(Txt, { style: [s.cardSub, { color: c.sub }], children: "\uBC1B\uC740 \uBCF5\uAD8C\uC740 \uB9E4\uC77C \uC790\uC815\uC5D0 \uC0AC\uB77C\uC838\uC694" }), ticker, rows, notifyView] }) });
    }
    return (0, jsx_runtime_1.jsxs)(BottomSheet, { open: open, onClose: onClose, theme: c, topInset: topInset, bottomInset: bottomInset, presentation: presentation, children: [(0, jsx_runtime_1.jsx)(Txt, { accessibilityRole: "header", style: [s.sheetTitle, { color: c.text }], numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.8, children: '꽝 없는 복권\n지금 열고 행운 받아가요!' }), (0, jsx_runtime_1.jsx)(Txt, { style: [s.sheetSub, { color: c.sub }], children: "\uBC1B\uC740 \uBCF5\uAD8C\uC740 \uB9E4\uC77C \uC790\uC815\uC5D0 \uC0AC\uB77C\uC838\uC694" }), ticker, rows, notifyView, renderNative ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.native, children: renderNative() }) : null] });
}
/**
 * 기본으로 그리는 황금 복권 그림 — 앱 그림(`icon`)이 없을 때. 금빛 티켓 한 장에 별 하나, 오른쪽은 점선 절취선
 */
function GoldenTicketArt() {
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { accessible: false, importantForAccessibility: "no-hide-descendants", style: s.goldTicket, children: [(0, jsx_runtime_1.jsx)(Txt, { style: s.goldStar, children: "\u2605" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldPerforation }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldStub, children: (0, jsx_runtime_1.jsx)(Txt, { style: s.goldStubText, children: "GOLD" }) })] });
}
/**
 * 당첨 결과 — **전체 화면**(0.1.3, 대표님 15:57 「당첨 화면은 전체 화면으로 나오게 해」): 탭 메뉴 · 상태줄까지 덮는다(앱 루트에 그리거나 `presentation="modal"`).
 * 위: X(오른쪽) → 가운데 「축하해요!」 + 큰 「5P 당첨!」 + 복권 그림(`icon` 이 있으면 그것) → 아래: 큰 버튼 + 「확인」 + 알림 켜기 링크 + 네이티브 광고(`renderNative`).
 * 남은 복권이 있으면 「다음 복권 열기 (N장 남았어요)」 — 없으면 큰 버튼 없이 X(와 `confirm` 일 때 「확인」)만. **「한 번 더! ○ 복권 받기」 버튼은 없다**(0.1.7, 대표님 17:38 「빼」). 원 표 단계는 「○원 복권」 한 줄이 더 붙고 포인트 표는 P 만 보인다.
 * `topInset`/`bottomInset` 은 안전 영역(상태줄 · 홈 바) 값.
 */
function LotteryResult({ result, onOpenNext, onClose, renderNative, theme, nextAd, adLabel, notify, icon, topInset = 0, bottomInset = 0, presentation, open = true, confirm = true }) {
    const c = th(theme);
    const hasNext = result.unopened > 0;
    const wonLine = result.unit === 'points' ? null : result.won.toLocaleString('ko-KR') + '원 복권';
    return (0, jsx_runtime_1.jsx)(Layer, { open: open, onClose: onClose, presentation: presentation, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.full, { backgroundColor: c.card, paddingTop: Math.max(0, topInset) + exports.RESULT.top, paddingBottom: Math.max(0, bottomInset) + exports.RESULT.bottom }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.fullHeader, children: (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", hitSlop: 12, onPress: onClose, style: s.bsClose, children: (0, jsx_runtime_1.jsx)(Txt, { style: [s.closeText, { color: c.sub }], children: "\u2715" }) }) }), (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { bounces: false, showsVerticalScrollIndicator: false, contentContainerStyle: s.fullBody, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.fullCenter, children: [(0, jsx_runtime_1.jsx)(Txt, { style: [s.fullKicker, { color: c.sub }], children: "\uCD95\uD558\uD574\uC694!" }), (0, jsx_runtime_1.jsx)(Txt, { accessibilityRole: "header", style: [s.fullHeadline, { color: c.text }], numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6, children: (0, lottery_1.lotteryResultHeadline)(result.points) }), wonLine ? (0, jsx_runtime_1.jsx)(Txt, { style: [s.fullSub, { color: c.sub }], children: wonLine }) : null, (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.fullArt, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.fullArtScale, children: icon ?? (0, jsx_runtime_1.jsx)(GoldenTicketArt, {}) }) })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.fullActions, children: [hasNext && onOpenNext ? (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2E4\uC74C \uBCF5\uAD8C \uC5F4\uAE30", onPress: onOpenNext, style: [s.big, s.bigCompact, s.bigRow, { backgroundColor: c.accent }], children: [(0, jsx_runtime_1.jsxs)(Txt, { style: [s.bigText, { color: c.accentText }], children: ["\uB2E4\uC74C \uBCF5\uAD8C \uC5F4\uAE30 (", result.unopened, "\uC7A5 \uB0A8\uC558\uC5B4\uC694)"] }), nextAd ? (0, jsx_runtime_1.jsx)(AdChip, { label: adLabel, onColor: c.accentText, onFilled: true }) : null] }) : null, confirm ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uD655\uC778", onPress: onClose, style: s.confirm, children: (0, jsx_runtime_1.jsx)(Txt, { style: [s.linkText, { color: c.sub }], children: "\uD655\uC778" }) }) : null, (0, jsx_runtime_1.jsx)(NotifyRow, { notify: notify, theme: c, compact: true }), renderNative ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.nativeResult, children: renderNative() }) : null] })] })] }) });
}
/**
 * 황금 복권 팝업 — 「황금 복권이 나타났어요!」 (**앱이 켤 때 자동으로 띄우지 않는다** — 황금은 복권 목록의 황금 줄 「열기」로만 연다, 대표님 17:36 「앱 열릴 때 이게 실행이 돼」. 0.1.2: 읽기 쉽게, 0.1.3: **바텀 시트**로 — 딤 · X · 손잡이 · 안전 영역). 위에서 아래로: 황금 복권 그림(`icon` 이 있으면 그것) → 제목 → 쉬운 말 3줄 → 작은 글씨 → 버튼 → 「다음에 열기」.
 * 값(최대 금액 · 포인트)은 서버 state 에서 읽어 넘긴다 — `maxWon`(필수) · `maxPoints` · **`unit`**(포인트 표면 'points' → 「최대 1,000P가 바로 들어와요」, 원 병기 없음). 문구는 `lines`/`note` 로 통째로 바꿀 수 있다(다국어).
 * 버튼은 「광고 보고 황금 복권 열기」: 앱이 `onOpen` 에서 **보상형 광고(용도 lottery_basic)를 보여 준 뒤** `useLottery.open(tier, 'basic')` 을 부른다
 * — 광고 시청은 서버가 구글 SSV 로 확인한다(앱 말만 믿지 않는다). 광고가 바로 열리므로 버튼 안 오른쪽에 「광고」 칩(`ad` 가 false 면 칩 · 광고 문구 없음). busy 동안은 다시 눌리지 않는다.
 */
function GoldenLotteryPopup({ open, maxWon, maxPoints, unit, busy, onOpen, onClose, buttonLabel, icon, theme, ad = true, adLabel, closeLabel, lines, note, topInset, bottomInset = 0, notify, presentation, fullScreen = true, headerTitle = '황금 복권' }) {
    if (!open)
        return null;
    const c = th(theme);
    const label = buttonLabel ?? (ad ? '광고 보고 황금 복권 열기' : '황금 복권 열기');
    const copy = (0, lottery_1.goldenLines)({ maxWon, maxPoints, ad, unit });
    const body = lines ?? copy.lines;
    const small = note ?? copy.note;
    const later = closeLabel ?? '다음에 열기';
    const art = (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldArt, children: icon ?? (0, jsx_runtime_1.jsx)(GoldenTicketArt, {}) });
    const openButton = (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: label + (ad && !label.includes(adLabel ?? '광고') ? ', ' + (adLabel ?? '광고') : ''), accessibilityState: { disabled: !!busy }, disabled: !!busy, onPress: onOpen, style: [s.big, fullScreen && s.bigC, s.bigRow, { backgroundColor: c.accent }, busy && { opacity: 0.6 }], children: [(0, jsx_runtime_1.jsx)(Txt, { style: [s.bigText, { color: c.accentText }], numberOfLines: 1, adjustsFontSizeToFit: true, children: label }), ad ? (0, jsx_runtime_1.jsx)(AdChip, { label: adLabel, onColor: c.accentText, onFilled: true }) : null] });
    const laterButton = (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: later, onPress: onClose, style: s.goldLater, children: (0, jsx_runtime_1.jsx)(Txt, { style: [s.linkText, { color: c.sub }], children: later }) });
    if (fullScreen) {
        return (0, jsx_runtime_1.jsx)(FullPage, { open: open, onClose: onClose, presentation: presentation, title: headerTitle, theme: c, topInset: topInset, bottomInset: bottomInset, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.card, s.goldCardC, { backgroundColor: c.card }], children: [art, (0, jsx_runtime_1.jsx)(Txt, { accessibilityRole: "header", style: [s.goldTitleC, { color: c.text }], numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.8, children: "\uD669\uAE08 \uBCF5\uAD8C\uC774 \uB098\uD0C0\uB0AC\uC5B4\uC694!" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldLinesC, children: body.map((line, i) => (0, jsx_runtime_1.jsx)(Txt, { style: [s.goldLineC, { color: c.text }], children: line }, i)) }), (0, jsx_runtime_1.jsx)(Txt, { style: [s.goldNoteC, { color: c.sub }], children: small }), openButton, laterButton, (0, jsx_runtime_1.jsx)(NotifyRow, { notify: notify, theme: c })] }) });
    }
    return (0, jsx_runtime_1.jsxs)(BottomSheet, { open: open, onClose: onClose, theme: c, topInset: topInset, bottomInset: bottomInset, presentation: presentation, children: [art, (0, jsx_runtime_1.jsx)(Txt, { accessibilityRole: "header", style: [s.goldTitle, { color: c.text }], numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.8, children: "\uD669\uAE08 \uBCF5\uAD8C\uC774 \uB098\uD0C0\uB0AC\uC5B4\uC694!" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.goldLines, children: body.map((line, i) => (0, jsx_runtime_1.jsx)(Txt, { style: [s.goldLine, { color: c.text }], children: line }, i)) }), (0, jsx_runtime_1.jsx)(Txt, { style: [s.goldNote, { color: c.sub }], children: small }), openButton, laterButton, (0, jsx_runtime_1.jsx)(NotifyRow, { notify: notify, theme: c })] });
}
/** 시트의 바깥 여백(좌우 · 아래) */
const SHEET_PAD = 24;
/**
 * (0.1.4, 대표님 16:40 「당첨 화면 아래 네이티브 광고 카드가 잘려요」) 당첨 전체 화면 위쪽 영역의 칸 높이(pt) — 스타일과 `lotteryResultTopHeight` 가 같은 값을 쓴다.
 * 광고 카드(앱이 넘기는 `renderNative`, 폭 375 기준 약 360pt)가 iPhone SE(375×667)에서 스크롤 없이 끝까지 보이도록 광고 위 모든 것을 줄였다.
 */
exports.RESULT = {
    top: 4, header: 32, kicker: 20, headline: 40, headlineGap: 2, sub: 24, subGap: 4, art: 52, artGap: 8, centerBottom: 8,
    actionsTop: 4, big: 48, bigGap: 8, confirm: 40, notify: 32, nativeGap: 8, bottom: 12,
};
/**
 * 당첨 전체 화면에서 **네이티브 광고 위**가 차지하는 높이(pt, 위 안전 영역 `topInset` 은 빼고) — 광고 카드 밑 여백(`RESULT.bottom`)도 뺀 값.
 * 큰 버튼(`big`: 다음 복권 열기) · 「확인」(`confirm`) · 알림 줄(`notify`) · 원 표 한 줄(`wonLine`) 이 있으면 더해진다. 시험에서 SE 기준 270pt 이하인지 본다.
 */
function lotteryResultTopHeight(o = {}) {
    return exports.RESULT.top + exports.RESULT.header + exports.RESULT.kicker + exports.RESULT.headlineGap + exports.RESULT.headline + (o.wonLine ? exports.RESULT.subGap + exports.RESULT.sub : 0) + exports.RESULT.artGap + exports.RESULT.art + exports.RESULT.centerBottom
        + exports.RESULT.actionsTop + (o.big ? exports.RESULT.bigGap + exports.RESULT.big : 0) + (o.confirm ? exports.RESULT.confirm : 0) + (o.notify ? exports.RESULT.notify : 0) + (o.native === false ? 0 : exports.RESULT.nativeGap);
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
    layerFill: { flex: 1, justifyContent: 'flex-end' },
    dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
    bsheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: SHEET_PAD, paddingTop: 8 },
    handleWrap: { alignItems: 'center', paddingTop: 4, paddingBottom: 4 },
    handle: { width: 44, height: 5, borderRadius: 3 },
    bsHeader: { height: 40, alignItems: 'flex-end', justifyContent: 'center' },
    bsClose: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
    bsBody: { paddingBottom: 4 },
    closeText: { fontSize: 22, fontWeight: '600' },
    sheetTitle: { fontSize: 24, lineHeight: 34, fontWeight: '800', textAlign: 'center', marginTop: 4 },
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
    big: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 20 },
    bigRow: { flexDirection: 'row', gap: 8 },
    bigText: { fontSize: 17, fontWeight: '800' },
    adChip: { height: 20, paddingHorizontal: 7, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    adChipOnFilled: { borderColor: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(255,255,255,0.22)' },
    adChipText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
    link: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 4 },
    linkText: { fontSize: 15, fontWeight: '700' },
    native: { marginTop: 12 },
    // 전체 화면 틀(0.1.6) — @jcurve/mission PageFrame 과 같은 치수: 머리글 52 · 옆 44 · 「‹」 32 · 제목 18/700 · 본문 padding 16 / 아래 40 / 칸 사이 12
    page: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    pageHeader: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
    pageSide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    pageBack: { fontSize: 32, marginTop: -4 },
    pageTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
    pageContent: { padding: 16, paddingBottom: 40, gap: 12 },
    // 흰 카드 — 행운 찬스 카드와 같은 모양(둥근 모서리 · 그림자)
    card: { borderRadius: 20, padding: 20, gap: 8, shadowColor: '#17212E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
    cardTitle: { fontSize: 22, lineHeight: 30, fontWeight: '900' },
    cardSub: { fontSize: 13, fontWeight: '600' },
    tickerC: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, marginTop: 4 },
    tickerTextC: { fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
    rowsC: { marginTop: 4, gap: 4 },
    rowC: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    rowTitleC: { fontSize: 16, fontWeight: '800' },
    rowHintC: { fontSize: 13, fontWeight: '600' },
    rowButtonC: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 72, height: 36, borderRadius: 12, paddingHorizontal: 10 },
    rowButtonTextC: { fontSize: 14, fontWeight: '800' },
    bigC: { height: 52, borderRadius: 14, marginTop: 12, alignSelf: 'stretch' },
    goldCardC: { alignItems: 'center', paddingVertical: 24 },
    goldTitleC: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
    goldLinesC: { gap: 6, marginTop: 4, alignSelf: 'stretch' },
    goldLineC: { fontSize: 15.5, lineHeight: 22, textAlign: 'center', fontWeight: '600' },
    goldNoteC: { fontSize: 12.5, textAlign: 'center' },
    // 알림 켜기 상자는 안쪽을 모두 가운데로 — 종 · 제목 · 화살표 줄과 설명(여러 줄이어도 가운데), 시트 · 황금 팝업 · 당첨 화면 같은 상자(0.1.5, 대표님 17:08:49)
    notifyBox: { alignSelf: 'stretch', alignItems: 'center', marginTop: 8, gap: 2 },
    notifyLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, paddingVertical: 6 },
    notifyBell: { fontSize: 18 },
    notifyTitle: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
    notifyChevron: { fontSize: 22, lineHeight: 22, fontWeight: '600' },
    notifyHint: { alignSelf: 'stretch', fontSize: 12, lineHeight: 18, textAlign: 'center' },
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
    fullHeader: { height: exports.RESULT.header, alignItems: 'flex-end', justifyContent: 'center' },
    fullBody: { flexGrow: 1, justifyContent: 'space-between' },
    fullCenter: { alignItems: 'center', paddingBottom: exports.RESULT.centerBottom },
    fullKicker: { fontSize: 14, lineHeight: exports.RESULT.kicker, fontWeight: '700' },
    fullHeadline: { marginTop: exports.RESULT.headlineGap, fontSize: 34, lineHeight: exports.RESULT.headline, fontWeight: '900', textAlign: 'center' },
    fullSub: { marginTop: exports.RESULT.subGap, fontSize: 14, lineHeight: exports.RESULT.sub },
    fullArt: { marginTop: exports.RESULT.artGap, height: exports.RESULT.art, alignItems: 'center', justifyContent: 'center' },
    fullArtScale: { transform: [{ scale: 0.6 }] },
    fullActions: { paddingTop: exports.RESULT.actionsTop },
    bigCompact: { height: exports.RESULT.big, marginTop: exports.RESULT.bigGap },
    confirm: { alignItems: 'center', justifyContent: 'center', minHeight: exports.RESULT.confirm },
    nativeResult: { marginTop: exports.RESULT.nativeGap },
    notifyBoxCompact: { marginTop: 0 },
    notifyLinkCompact: { minHeight: exports.RESULT.notify, paddingVertical: 2 },
});
