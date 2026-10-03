"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = Player;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * 영수증 올리는 법 재생기 — **저절로 흘러가고, 끝나면 처음부터 다시 돈다**(대표님 10-03 23:17 · 23:51).
 *
 * 미션 「따라 하기」와 같은 틀(캐릭터 말풍선 + 가운데 가짜 화면 + 누를 곳 표시)이다. 직접 누를 필요가 없다:
 * 장면마다 약 2.6초 — 누를 곳이 두껍게 두 번 깜빡이고(껌벅껌벅), 손가락이 가서 톡 누르고(물결),
 * 다음 화면으로 넘어간다. 마지막 장면 뒤에는 첫 장면으로 돌아간다. 아래에는 [지금 올리기] 가 늘 떠 있다.
 * 위에는 작은 장면 막대와 「멈춤/재생」 · 「건너뛰기」(= 바로 올리기)만 둔다. 가짜 화면을 누르면 바로 다음.
 *
 * **움직임 줄이기가 켜져 있어도 저절로 넘어간다** — 대표님 아이폰에서 [다음] 을 계속 눌러야 했다(23:51 「다음다음
 * 내가 눌러야하는거네?」). 그때는 손가락 이동 · 깜빡임 · 물결만 빼고(누를 곳은 굵은 테두리로 고정) 시간만 잰다.
 *
 * 움직임은 **장면 진행 값 p(0 → 1) 하나**로 그린다 — 깜빡임(0~0.58) · 손가락 이동(0.06~0.3) · 누름(0.7~0.84) ·
 * 물결(0.72~0.95) · 알림(0.8~) · 캡처 번쩍(0.62~0.85). 멈추면 p 만 멈추니 화면이 그 순간에 그대로 선다.
 * 투명도 · 이동 · 크기만 쓴다(네이티브 드라이버).
 */
const react_1 = require("react");
const react_native_1 = require("react-native");
const MockScreen_1 = require("./MockScreen");
const types_1 = require("./types");
const ui_1 = require("./ui");
const data_1 = require("./data");
/** 장면 하나가 머무는 시간 — 캡처 장면은 번쩍이는 것까지 보느라 조금 더 */
const STEP_MS = 2600;
const CAPTURE_MS = 3000;
/** 가짜 화면 높이 */
const SCREEN_H = 420;
/** 움직임 줄이기 — 손가락이 누를 곳에 가 있고 물결 · 알림은 아직인 때 */
const STILL = 0.6;
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';
function Player({ guide, appName, onClose, onUpload, onDone, onSwitch, cta }) {
    const theme = (0, ui_1.useGuideTheme)();
    const still = (0, ui_1.useReducedMotion)();
    const steps = guide.steps;
    const [i, setI] = (0, react_1.useState)(0);
    const [loop, setLoop] = (0, react_1.useState)(0);
    const [playing, setPlaying] = (0, react_1.useState)(true);
    const p = (0, react_1.useRef)(new react_native_1.Animated.Value(0)).current;
    /** 멈춘 자리 — 같은 장면에서 다시 재생하면 거기서 이어 간다 */
    const saved = (0, react_1.useRef)(null);
    const step = steps[Math.min(i, steps.length - 1)];
    const capture = step.action === 'capture';
    const duration = step.ms ?? (capture ? CAPTURE_MS : STEP_MS);
    /* ── 손가락 자리 ── */
    const frame = (0, react_1.useRef)(null);
    const spot = (0, react_1.useRef)(null);
    const [size, setSize] = (0, react_1.useState)({ w: 320, h: SCREEN_H });
    const [to, setTo] = (0, react_1.useState)(null);
    const [from, setFrom] = (0, react_1.useState)(null);
    const measure = (0, react_1.useCallback)(() => {
        const node = spot.current, base = frame.current;
        if (!node || !base)
            return;
        node.measureLayout(base, (x, y, w, h) => setTo({ x: x + w / 2, y: y + h / 2 }), () => undefined);
    }, []);
    const report = (0, react_1.useCallback)((node) => { spot.current = node; measure(); }, [measure]);
    (0, react_1.useEffect)(() => {
        // 위쪽 줄이 늦게 자리 잡으면 누를 곳의 onLayout 이 다시 안 불린다 — 조금 뒤에 한 번 더 잰다
        const t = setTimeout(measure, 120);
        return () => clearTimeout(t);
    }, [i, loop, size.w, measure]);
    /* ── 장면 넘기기 — 마지막 다음은 처음 ── */
    const doneOnce = (0, react_1.useRef)(false);
    const ended = (0, react_1.useRef)(onDone);
    ended.current = onDone;
    const toRef = (0, react_1.useRef)(to);
    toRef.current = to;
    const iRef = (0, react_1.useRef)(i);
    iRef.current = i;
    const playingRef = (0, react_1.useRef)(playing);
    playingRef.current = playing;
    const next = (0, react_1.useCallback)(() => {
        saved.current = null;
        spot.current = null;
        // 멈춘 채 화면을 눌러 넘기면 그 장면은 「손가락이 누를 곳에 간」 모습으로 세워 둔다
        if (!playingRef.current)
            p.setValue(STILL);
        const n = iRef.current + 1;
        if (n >= steps.length) {
            if (!doneOnce.current) {
                doneOnce.current = true;
                ended.current?.();
            }
            setFrom(null);
            setTo(null);
            setI(0);
            setLoop((l) => l + 1);
            return;
        }
        setFrom(toRef.current);
        setTo(null);
        setI(n);
    }, [steps.length, p]);
    const nextRef = (0, react_1.useRef)(next);
    nextRef.current = next;
    (0, react_1.useEffect)(() => {
        if (!playing)
            return undefined;
        if (still) {
            // 움직임 줄이기 — 그림은 멈춘 채, 시간만 재서 넘긴다
            p.setValue(STILL);
            const t = setTimeout(() => nextRef.current(), duration);
            return () => clearTimeout(t);
        }
        const start = saved.current?.i === i ? saved.current.v : 0;
        saved.current = null;
        p.setValue(start);
        const a = react_native_1.Animated.timing(p, { toValue: 1, duration: Math.max(0, duration * (1 - start)), easing: react_native_1.Easing.linear, useNativeDriver: true });
        a.start(({ finished }) => { if (finished)
            nextRef.current(); });
        return () => a.stop();
    }, [i, loop, playing, still, duration, p]);
    const pause = () => {
        if (!still)
            p.stopAnimation((v) => { saved.current = { i: iRef.current, v }; });
        setPlaying(false);
    };
    /* 안드로이드 뒤로 — Modal 밖에 얹었을 때(Modal 안이면 부르는 쪽 onRequestClose 가 받는다) */
    (0, react_1.useEffect)(() => {
        const sub = react_native_1.BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
        return () => sub.remove();
    }, [onClose]);
    /* ── 움직임(전부 p 에서) ── */
    const start = from ?? { x: size.w / 2, y: size.h - 30 };
    const dest = to ?? start;
    const clamp = 'clamp';
    const link = (0, react_1.useMemo)(() => ({
        report,
        glowOp: still ? 1 : p.interpolate({ inputRange: [0, 0.1, 0.22, 0.34, 0.46, 0.58, 1], outputRange: [0.3, 1, 0.3, 1, 0.3, 1, 1], extrapolate: clamp }),
        glowSc: still ? 1 : p.interpolate({ inputRange: [0, 0.1, 0.22, 0.34, 0.46, 0.58, 1], outputRange: [1, 1.06, 1, 1.06, 1, 1, 1], extrapolate: clamp }),
    }), [report, still, p]);
    const fingerX = p.interpolate({ inputRange: [0, 0.06, 0.3, 1], outputRange: [start.x, start.x, dest.x, dest.x], extrapolate: clamp });
    const fingerY = p.interpolate({ inputRange: [0, 0.06, 0.3, 1], outputRange: [start.y, start.y, dest.y, dest.y], extrapolate: clamp });
    const fingerOp = p.interpolate({ inputRange: [0, 0.06], outputRange: [from ? 1 : 0, 1], extrapolate: clamp });
    const fingerSc = p.interpolate({ inputRange: [0.7, 0.76, 0.84], outputRange: [1, 0.78, 1], extrapolate: clamp });
    const rippleOp = p.interpolate({ inputRange: [0.72, 0.76, 0.95], outputRange: [0, 0.9, 0], extrapolate: clamp });
    const rippleSc = p.interpolate({ inputRange: [0.72, 0.95], outputRange: [0.4, 2], extrapolate: clamp });
    const toastOp = p.interpolate({ inputRange: [0.8, 0.86], outputRange: [0, 1], extrapolate: clamp });
    const flashOp = p.interpolate({ inputRange: [0.62, 0.68, 0.85], outputRange: [0, 0.85, 0], extrapolate: clamp });
    const keyX = p.interpolate({ inputRange: [0.5, 0.62, 0.7], outputRange: [0, -3, 0], extrapolate: clamp });
    const keyOp = p.interpolate({ inputRange: [0, 0.2, 0.75, 0.9], outputRange: [0.35, 1, 1, 0.35], extrapolate: clamp });
    const title = guide.name + ' 영수증 올리는 법';
    /** 맨 아래 버튼 · 「건너뛰기」 — 부르는 앱이 cta 를 주면 그것, 아니면 지금 올리기 */
    const ctaOff = !!cta?.disabled || !!cta?.busy;
    const press = () => { if (ctaOff)
        return; if (cta?.onPress)
        cta.onPress(guide.app);
    else
        onUpload(); };
    const two = (0, data_1.needsTwo)(guide.app);
    const say = (CIRCLED[step.no - 1] ?? '') + ' ' + (0, types_1.fillApp)(step.say, appName);
    const hint = capture
        ? (react_native_1.Platform.OS === 'ios' ? '옆 버튼과 음량 높이기 버튼을 함께 눌러 캡처해요' : '전원 버튼과 음량 낮추기 버튼을 함께 눌러 캡처해요')
        : '반짝이는 곳을 눌러요';
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.page, { backgroundColor: theme.bg }], children: [(0, jsx_runtime_1.jsx)(ui_1.Header, { title: title, onClose: onClose }), (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { contentContainerStyle: s.body, showsVerticalScrollIndicator: false, children: [two ? ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [ui_1.row, s.twoBar, { borderColor: theme.hot }], children: [(0, jsx_runtime_1.jsx)(ui_1.TwoBadge, { big: true }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 900, children: "\uC774 \uC601\uC218\uC99D\uC740 \uCEA1\uCC98 2\uC7A5(\uC704 \u00B7 \uC544\uB798)\uC744 \uD568\uAED8 \uC62C\uB824\uC57C \uD574\uC694" }), (0, jsx_runtime_1.jsx)(ui_1.T, { size: 13.5, w: 700, color: theme.sub, style: { marginTop: 2 }, children: data_1.TWO_SAME_ORDER })] })] })) : null, (0, jsx_runtime_1.jsx)(ui_1.Bubble, { say: say, sub: step.sub ? (0, types_1.fillApp)(step.sub, appName) : undefined }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [ui_1.row, { gap: 10 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [ui_1.row, { gap: 3, flex: 1 }], accessibilityLabel: `${steps.length}장면 중 ${i + 1}번째`, children: steps.map((_, k) => ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.seg, { backgroundColor: theme.line }], children: [k < i ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [react_native_1.StyleSheet.absoluteFill, { backgroundColor: theme.hot }] }) : null, k === i ? ((0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: [react_native_1.StyleSheet.absoluteFill, {
                                                    backgroundColor: theme.hot, transformOrigin: 'left',
                                                    transform: [{ scaleX: still ? 1 : p }],
                                                }] })) : null] }, k))) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: playing ? '멈추기' : '이어 보기', hitSlop: 8, onPress: playing ? pause : () => setPlaying(true), children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: 800, color: theme.sub, children: playing ? '멈춤' : '재생' }) }), ctaOff ? null : ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uAC74\uB108\uB6F0\uACE0 \uBC14\uB85C \uC62C\uB9AC\uAE30", hitSlop: 8, onPress: press, children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: 800, color: theme.sub, children: "\uAC74\uB108\uB6F0\uAE30" }) }))] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { alignSelf: 'center', width: '100%', maxWidth: 360 }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2E4\uC74C \uC7A5\uBA74", onPress: next, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { ref: frame, collapsable: false, onLayout: (e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }), style: [s.frame, { borderColor: theme.line, backgroundColor: theme.card }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.notch, { backgroundColor: theme.line }] }), (0, jsx_runtime_1.jsx)(MockScreen_1.SpotCtx.Provider, { value: link, children: (0, jsx_runtime_1.jsx)(SceneIn, { children: (0, jsx_runtime_1.jsx)(MockScreen_1.MockScreen, { nodes: step.nodes, accent: guide.accent, scrolled: step.scrolled }) }, i + ':' + loop) }), capture && !still ? (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { pointerEvents: "none", style: [react_native_1.StyleSheet.absoluteFill, { backgroundColor: theme.white, opacity: flashOp }] }) : null, !capture ? ((0, jsx_runtime_1.jsxs)(react_native_1.Animated.View, { pointerEvents: "none", style: [s.finger, { opacity: fingerOp, transform: [{ translateX: fingerX }, { translateY: fingerY }] }], children: [still ? null : (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: [s.ripple, { borderColor: theme.hot, opacity: rippleOp, transform: [{ scale: rippleSc }] }] }), (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: [s.dot, { borderColor: theme.hot, transform: [{ scale: fingerSc }] }], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [react_native_1.StyleSheet.absoluteFill, { backgroundColor: theme.hot, opacity: 0.25 }] }) })] })) : null, step.toast && !still ? ((0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { pointerEvents: "none", style: [s.toast, { opacity: toastOp }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: 800, color: "#FFFFFF", children: step.toast }) })) : null] }) }), capture ? (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { pointerEvents: "none", style: [s.key, { right: -6, top: 110, height: 52, backgroundColor: theme.hot, opacity: still ? 1 : keyOp, transform: [{ translateX: keyX }] }] }), (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { pointerEvents: "none", style: [s.key, { left: -6, top: 96, height: 38, backgroundColor: theme.hot, opacity: still ? 1 : keyOp, transform: [{ translateX: react_native_1.Animated.multiply(keyX, -1) }] }] })] }) : null] }), (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: 700, center: true, color: theme.sub, children: hint }), capture || step.result ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.seller, { backgroundColor: theme.brandSoft }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14.5, w: 900, center: true, color: theme.brand, children: guide.seller }) }) : null, guide.note ? (0, jsx_runtime_1.jsx)(ui_1.NoteCard, { text: guide.note }) : null, guide.pickHint ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.hint, { backgroundColor: theme.brandSoft }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14.5, w: 900, center: true, color: theme.brand, children: guide.pickHint }) }) : null, step.link && onSwitch ? ((0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: step.link.label, onPress: () => onSwitch(step.link.app), style: ({ pressed }) => [s.link, { borderColor: theme.line, backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }], children: [(0, jsx_runtime_1.jsx)(ui_1.T, { size: 14.5, w: 700, color: theme.sub, style: { flex: 1 }, children: step.link.text }), (0, jsx_runtime_1.jsxs)(ui_1.T, { size: 14.5, w: 900, color: theme.brand, children: [step.link.label, " \u203A"] })] })) : null] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.foot, { borderColor: theme.line, backgroundColor: theme.bg }], children: [cta?.note
                        ? (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14.5, w: 800, center: true, color: theme.sub, style: { marginBottom: 8 }, children: cta.note })
                        : two
                            ? (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [ui_1.row, { justifyContent: 'center', gap: 6, marginBottom: 8 }], children: [(0, jsx_runtime_1.jsx)(ui_1.TwoBadge, {}), (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 900, color: theme.hot, children: "2\uC7A5 \uD568\uAED8 \uACE8\uB77C\uC694(\uC704 \u2192 \uC544\uB798)" })] })
                            : (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: 700, center: true, color: theme.sub, style: { marginBottom: 8 }, children: (0, types_1.fillApp)(guide.doneSub, appName) }), (0, jsx_runtime_1.jsx)(ui_1.BigButton, { label: cta?.label ?? '지금 올리기', onPress: press, disabled: ctaOff })] })] }));
}
/** 장면이 바뀔 때 오른쪽에서 살짝 밀려 들어온다(움직임 줄이기면 바로) */
function SceneIn({ children }) {
    const manual = (0, ui_1.useReducedMotion)();
    const a = (0, react_1.useRef)(new react_native_1.Animated.Value(0)).current;
    (0, react_1.useEffect)(() => {
        if (manual) {
            a.setValue(1);
            return;
        }
        react_native_1.Animated.timing(a, { toValue: 1, duration: 260, easing: react_native_1.Easing.out(react_native_1.Easing.cubic), useNativeDriver: true }).start();
    }, [a, manual]);
    return ((0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: { flex: 1, opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }, children: children }));
}
const s = react_native_1.StyleSheet.create({
    page: { flex: 1 },
    body: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 12 },
    seller: { borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12 },
    twoBar: { gap: 10, borderWidth: 2, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
    link: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
    hint: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
    foot: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1 },
    seg: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
    frame: { height: SCREEN_H, borderWidth: 1.5, borderRadius: 24, overflow: 'hidden' },
    notch: { alignSelf: 'center', width: 64, height: 5, borderRadius: 3, marginVertical: 6 },
    finger: { position: 'absolute', left: -24, top: -24, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    dot: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, overflow: 'hidden' },
    ripple: { position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 3 },
    toast: {
        position: 'absolute', alignSelf: 'center', bottom: 70,
        backgroundColor: 'rgba(47,47,51,0.92)', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18,
    },
    key: { position: 'absolute', width: 5, borderRadius: 3 },
});
