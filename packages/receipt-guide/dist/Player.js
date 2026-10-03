"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = Player;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * 영수증 올리는 법 재생기 — **저절로 흘러간다**(대표님 10-03 23:17).
 *
 * 미션 「따라 하기」와 같은 틀(캐릭터 말풍선 + 가운데 가짜 화면 + 누를 곳 표시)이다. 다른 점은
 * 직접 누르지 않아도 된다는 것: 장면마다 약 3초 동안 손가락이 누를 곳으로 가서 톡 누르고(물결),
 * 다음 화면으로 넘어간다. 위에 몇 번째 장면인지 막대가 차오른다. [멈춤] · [이전] · [다음] 이 있고,
 * 가짜 화면을 누르면 바로 다음으로 간다.
 *
 * 모든 움직임은 **장면 진행 값 p(0 → 1) 하나**로 그린다 — 손가락 이동(0.12~0.38) · 누름(0.42~0.56) ·
 * 물결(0.44~0.66) · 알림(0.55~) · 캡처 번쩍(0.4~0.6). 멈추면 p 만 멈추니 화면이 그 순간에 그대로 선다.
 * 투명도 · 이동 · 크기만 쓴다(네이티브 드라이버).
 *
 * 움직임 줄이기가 켜져 있으면 저절로 넘기지 않는다 — 손가락이 누를 곳에 멈춘 장면을 보여 주고 [다음] 으로 넘긴다.
 */
const react_1 = require("react");
const react_native_1 = require("react-native");
const MockScreen_1 = require("./MockScreen");
const types_1 = require("./types");
const ui_1 = require("./ui");
/** 장면 하나가 머무는 시간 — 캡처 장면은 번쩍이는 것까지 보느라 조금 더 */
const STEP_MS = 3000;
const CAPTURE_MS = 3400;
/** 가짜 화면 높이 */
const SCREEN_H = 440;
/** 움직임 줄이기 · 멈춘 뒤 넘긴 장면 — 손가락이 누를 곳에 도착해 있고 물결은 지난 때 */
const STILL = 0.8;
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';
function Player({ guide, appName, onClose, onUpload, onDone, onSwitch, blockedNote }) {
    const theme = (0, ui_1.useGuideTheme)();
    const manual = (0, ui_1.useReducedMotion)();
    const steps = guide.steps;
    const [i, setI] = (0, react_1.useState)(0);
    const [phase, setPhase] = (0, react_1.useState)('play');
    const [playing, setPlaying] = (0, react_1.useState)(true);
    const [round, setRound] = (0, react_1.useState)(0);
    const p = (0, react_1.useRef)(new react_native_1.Animated.Value(0)).current;
    /** 멈춘 자리 — 같은 장면에서 다시 누르면 거기서 이어 간다 */
    const saved = (0, react_1.useRef)(null);
    const pausedAt = (0, react_1.useRef)(-1);
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
    }, [i, size.w, measure]);
    /* ── 장면 넘기기 ── */
    const ended = (0, react_1.useRef)(onDone);
    ended.current = onDone;
    const goTo = (0, react_1.useCallback)((n) => {
        saved.current = null;
        setFrom(to);
        setTo(null);
        spot.current = null;
        if (n >= steps.length) {
            setPhase('end');
            ended.current?.();
            return;
        }
        setI(Math.max(0, n));
    }, [steps.length, to]);
    const iRef = (0, react_1.useRef)(i);
    iRef.current = i;
    const next = (0, react_1.useCallback)(() => goTo(iRef.current + 1), [goTo]);
    const nextRef = (0, react_1.useRef)(next);
    nextRef.current = next;
    (0, react_1.useEffect)(() => {
        if (phase !== 'play')
            return undefined;
        if (manual) {
            p.setValue(STILL);
            return undefined;
        }
        if (!playing) {
            // 멈춘 채 다른 장면으로 넘겼으면 그 장면은 「누를 곳에 손가락이 간」 모습으로 보여 준다
            if (pausedAt.current !== i)
                p.setValue(STILL);
            return undefined;
        }
        const start = saved.current?.i === i ? saved.current.v : 0;
        saved.current = null;
        p.setValue(start);
        const a = react_native_1.Animated.timing(p, { toValue: 1, duration: Math.max(0, duration * (1 - start)), easing: react_native_1.Easing.linear, useNativeDriver: true });
        a.start(({ finished }) => { if (finished)
            nextRef.current(); });
        return () => a.stop();
    }, [i, phase, playing, manual, round, duration, p]);
    const pause = () => {
        pausedAt.current = i;
        p.stopAnimation((v) => { saved.current = { i: iRef.current, v }; });
        setPlaying(false);
    };
    const resume = () => { pausedAt.current = -1; setPlaying(true); };
    const replay = () => {
        saved.current = null;
        pausedAt.current = -1;
        setFrom(null);
        setTo(null);
        spot.current = null;
        setI(0);
        setPhase('play');
        setPlaying(true);
        setRound((r) => r + 1);
    };
    /* 안드로이드 뒤로 — Modal 밖에 얹었을 때(Modal 안이면 부르는 쪽 onRequestClose 가 받는다) */
    (0, react_1.useEffect)(() => {
        const sub = react_native_1.BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
        return () => sub.remove();
    }, [onClose]);
    const title = guide.name + ' 영수증 올리는 법';
    /* ── 끝 카드 ── */
    if (phase === 'end') {
        return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.page, { backgroundColor: theme.bg }], children: [(0, jsx_runtime_1.jsx)(ui_1.Header, { title: title, onClose: onClose }), (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { contentContainerStyle: s.body, children: [(0, jsx_runtime_1.jsx)(ui_1.Bubble, { say: "\uC774\uC81C \uC9C1\uC811 \uC62C\uB824 \uBCFC\uAE4C\uC694?", sub: guide.doneSub }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.card, { backgroundColor: theme.card, borderColor: theme.line }], children: [(0, jsx_runtime_1.jsx)(ui_1.T, { size: 17, w: 900, children: "\uC21C\uC11C \uB2E4\uC2DC \uBCF4\uAE30" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { marginTop: 10, gap: 8 }, children: guide.summary.map((line, k) => ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [ui_1.row, { gap: 8, alignItems: 'flex-start' }], children: [(0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 900, color: theme.hot, children: CIRCLED[k] ?? k + 1 + '.' }), (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 700, lh: 21, style: { flex: 1 }, children: (0, types_1.fillApp)(line, appName) })] }, k))) })] }), guide.note ? (0, jsx_runtime_1.jsx)(ui_1.NoteCard, { text: guide.note }) : null, guide.pickHint ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.hint, { backgroundColor: theme.brandSoft }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15.5, w: 900, center: true, color: theme.brand, children: guide.pickHint }) }) : null, blockedNote ? (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14.5, w: 700, center: true, color: theme.sub, children: blockedNote }) : null] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.foot, { borderColor: theme.line, backgroundColor: theme.bg }], children: [blockedNote ? (0, jsx_runtime_1.jsx)(ui_1.BigButton, { label: "\uB2EB\uAE30", onPress: onClose }) : (0, jsx_runtime_1.jsx)(ui_1.BigButton, { label: "\uC9C0\uAE08 \uC62C\uB9AC\uAE30", onPress: onUpload }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", onPress: replay, style: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 }, children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 15, w: 800, color: theme.sub, style: { textDecorationLine: 'underline' }, children: "\uCC98\uC74C\uBD80\uD130 \uB2E4\uC2DC \uBCF4\uAE30" }) })] })] }));
    }
    /* ── 움직임(전부 p 에서) ── */
    const start = from ?? { x: size.w / 2, y: size.h - 30 };
    const dest = to ?? start;
    const fingerX = p.interpolate({ inputRange: [0, 0.12, 0.38, 1], outputRange: [start.x, start.x, dest.x, dest.x], extrapolate: 'clamp' });
    const fingerY = p.interpolate({ inputRange: [0, 0.12, 0.38, 1], outputRange: [start.y, start.y, dest.y, dest.y], extrapolate: 'clamp' });
    const fingerOp = p.interpolate({ inputRange: [0, 0.08, 0.9, 1], outputRange: [from ? 1 : 0, 1, 1, 0.6], extrapolate: 'clamp' });
    const fingerSc = p.interpolate({ inputRange: [0.42, 0.48, 0.56], outputRange: [1, 0.8, 1], extrapolate: 'clamp' });
    const rippleOp = p.interpolate({ inputRange: [0.44, 0.48, 0.66], outputRange: [0, 0.9, 0], extrapolate: 'clamp' });
    const rippleSc = p.interpolate({ inputRange: [0.44, 0.66], outputRange: [0.4, 1.9], extrapolate: 'clamp' });
    const toastOp = p.interpolate({ inputRange: [0.55, 0.62], outputRange: [0, 1], extrapolate: 'clamp' });
    const flashOp = p.interpolate({ inputRange: [0.4, 0.45, 0.6], outputRange: [0, 0.85, 0], extrapolate: 'clamp' });
    const keyX = p.interpolate({ inputRange: [0.28, 0.38, 0.46], outputRange: [0, -3, 0], extrapolate: 'clamp' });
    const keyOp = p.interpolate({ inputRange: [0, 0.2, 0.5, 0.7], outputRange: [0.35, 1, 1, 0.35], extrapolate: 'clamp' });
    const say = (CIRCLED[step.no - 1] ?? '') + ' ' + (0, types_1.fillApp)(step.say, appName);
    const hint = capture
        ? (react_native_1.Platform.OS === 'ios' ? '옆 버튼과 음량 높이기 버튼을 함께 눌러 캡처해요' : '전원 버튼과 음량 낮추기 버튼을 함께 눌러 캡처해요')
        : manual ? '아래 [다음] 으로 넘겨요' : playing ? '저절로 넘어가요 · 화면을 누르면 바로 다음' : '멈췄어요 · 화면을 누르면 다음';
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.page, { backgroundColor: theme.bg }], children: [(0, jsx_runtime_1.jsx)(ui_1.Header, { title: title, onClose: onClose }), (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { contentContainerStyle: s.body, showsVerticalScrollIndicator: false, children: [step.branch ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.branch, { backgroundColor: theme.brandSoft }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: 900, color: theme.brand, children: step.branch }) }) : null, (0, jsx_runtime_1.jsx)(ui_1.Bubble, { say: say, sub: step.sub ? (0, types_1.fillApp)(step.sub, appName) : undefined }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [ui_1.row, { gap: 4 }], accessibilityLabel: `${steps.length}장면 중 ${i + 1}번째`, children: steps.map((_, k) => ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.seg, { backgroundColor: theme.line }], children: [k < i ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [react_native_1.StyleSheet.absoluteFill, { backgroundColor: theme.hot }] }) : null, k === i ? ((0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: [react_native_1.StyleSheet.absoluteFill, {
                                            backgroundColor: theme.hot, transformOrigin: 'left',
                                            transform: [{ scaleX: manual ? 1 : p }],
                                        }] })) : null] }, k))) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { alignSelf: 'center', width: '100%', maxWidth: 360 }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: "\uB2E4\uC74C \uC7A5\uBA74", onPress: next, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { ref: frame, collapsable: false, onLayout: (e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }), style: [s.frame, { borderColor: theme.line, backgroundColor: theme.card }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.notch, { backgroundColor: theme.line }] }), (0, jsx_runtime_1.jsx)(MockScreen_1.SpotCtx.Provider, { value: report, children: (0, jsx_runtime_1.jsx)(SceneIn, { children: (0, jsx_runtime_1.jsx)(MockScreen_1.MockScreen, { nodes: step.nodes, accent: guide.accent, scrolled: step.scrolled }) }, i + ':' + round) }), capture ? (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { pointerEvents: "none", style: [react_native_1.StyleSheet.absoluteFill, { backgroundColor: theme.white, opacity: manual ? 0 : flashOp }] }) : null, !capture ? ((0, jsx_runtime_1.jsxs)(react_native_1.Animated.View, { pointerEvents: "none", style: [s.finger, { opacity: fingerOp, transform: [{ translateX: fingerX }, { translateY: fingerY }] }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: [s.ripple, { borderColor: theme.hot, opacity: rippleOp, transform: [{ scale: rippleSc }] }] }), (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { style: [s.dot, { borderColor: theme.hot, transform: [{ scale: fingerSc }] }], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [react_native_1.StyleSheet.absoluteFill, { backgroundColor: theme.hot, opacity: 0.25 }] }) })] })) : null, step.toast ? ((0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { pointerEvents: "none", style: [s.toast, { opacity: toastOp }], children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: 800, color: "#FFFFFF", children: step.toast }) })) : null] }) }), capture ? (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { pointerEvents: "none", style: [s.key, { right: -6, top: 110, height: 52, backgroundColor: theme.hot, opacity: keyOp, transform: [{ translateX: keyX }] }] }), (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { pointerEvents: "none", style: [s.key, { left: -6, top: 96, height: 38, backgroundColor: theme.hot, opacity: keyOp, transform: [{ translateX: react_native_1.Animated.multiply(keyX, -1) }] }] })] }) : null] }), (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14, w: 700, center: true, color: theme.sub, children: hint }), guide.note ? (0, jsx_runtime_1.jsx)(ui_1.NoteCard, { text: guide.note }) : null, step.link && onSwitch ? ((0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: step.link.label, onPress: () => onSwitch(step.link.app), style: ({ pressed }) => [s.link, { borderColor: theme.line, backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }], children: [(0, jsx_runtime_1.jsx)(ui_1.T, { size: 14.5, w: 700, color: theme.sub, style: { flex: 1 }, children: step.link.text }), (0, jsx_runtime_1.jsxs)(ui_1.T, { size: 14.5, w: 900, color: theme.brand, children: [step.link.label, " \u203A"] })] })) : null] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.foot, { borderColor: theme.line, backgroundColor: theme.bg }], children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [ui_1.row, { justifyContent: 'space-between', gap: 8 }], children: [(0, jsx_runtime_1.jsx)(ui_1.SmallButton, { label: "\u2039 \uC774\uC804", a11y: "\uC774\uC804 \uC7A5\uBA74", onPress: () => goTo(i - 1) }), manual ? null : playing
                                ? (0, jsx_runtime_1.jsx)(ui_1.SmallButton, { label: "\u275A\u275A \uBA48\uCDA4", a11y: "\uBA48\uCD94\uAE30", onPress: pause })
                                : (0, jsx_runtime_1.jsx)(ui_1.SmallButton, { label: "\u25B6 \uACC4\uC18D", a11y: "\uC774\uC5B4 \uBCF4\uAE30", on: true, onPress: resume }), (0, jsx_runtime_1.jsx)(ui_1.SmallButton, { label: "\uB2E4\uC74C \u203A", a11y: "\uB2E4\uC74C \uC7A5\uBA74", on: manual, onPress: next })] }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", onPress: () => goTo(steps.length), style: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 }, children: (0, jsx_runtime_1.jsx)(ui_1.T, { size: 14.5, w: 800, color: theme.sub, style: { textDecorationLine: 'underline' }, children: "\uAC74\uB108\uB6F0\uAE30" }) })] })] }));
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
    card: { borderWidth: 1.5, borderRadius: 20, padding: 16 },
    branch: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12, marginBottom: -4 },
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
