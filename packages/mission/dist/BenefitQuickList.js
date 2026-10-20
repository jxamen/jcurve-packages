"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAP_GUARD_MS = void 0;
exports.iconKind = iconKind;
exports.pressOnce = pressOnce;
exports.resetTapGuard = resetTapGuard;
exports.BenefitQuickList = BenefitQuickList;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const home_1 = require("./home");
const useHomeConfig_1 = require("./useHomeConfig");
const homeDefs_1 = require("./homeDefs");
const colors = {
    calendar: '#2F6FD6', bag: '#D2551E', pin: '#2E8B57',
    star: '#B7791F', ticket: '#7A4FD0', friend: '#C2410C',
};
/** Pure RN shapes: no additional native dependency. Supply a ReactNode for branded icons. */
/**
 * (0.4.12) 아이콘이 어떻게 그려지는가 — 'palette'(패키지가 그리는 6개 이름), 'text'(그 밖의 글자: 👟 · 🌱 같은 이모지), 'node'(앱이 넘긴 ReactNode).
 * 0.4.12 전에는 팔레트 이름이 아닌 문자열을 `<Text>` 없이 `<View>` 안에 그대로 내보내 RN 이 그리지 못했다 — 홈 목록의 걸음(👟) · 무료 아이템(🌱) 줄 아이콘이 빈 칸(대표님 10-20 감자밭).
 * 팔레트 판정은 자기 키만 본다('toString' 같은 문자열이 팔레트로 읽히지 않게).
 */
function iconKind(icon) {
    if (typeof icon !== 'string')
        return 'node';
    return Object.prototype.hasOwnProperty.call(colors, icon) ? 'palette' : 'text';
}
function Icon({ icon }) {
    const kind = iconKind(icon);
    if (kind === 'node')
        return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: icon });
    if (kind === 'text')
        return (0, jsx_runtime_1.jsx)(react_native_1.Text, { accessible: false, style: s.emoji, children: icon });
    const name = icon;
    const color = colors[name];
    const line = { borderColor: color, borderWidth: 2 };
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { accessible: false, style: s.iconDrawing, children: [name === 'calendar' ? (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [line, s.calendar], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.calendarLine, { backgroundColor: color }] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.check, { borderColor: color }] })] }) : null, name === 'bag' ? (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.handle] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.bag] })] }) : null, name === 'pin' ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.pin], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.dot] }) }) : null, name === 'star' ? (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.diamond] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.diamond, { transform: [{ rotate: '0deg' }] }] })] }) : null, name === 'ticket' ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.ticket], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.ticketLine, { borderColor: color }] }) }) : null, name === 'friend' ? (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.head] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [line, s.shoulders] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.plusH, { backgroundColor: color }] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.plusV, { backgroundColor: color }] })] }) : null] });
}
/** 빠른 두 번 누름을 막는 시간(0.4.3) — 잠금 상태가 없어 영영 남을 수 없다. 이 시간이 지나면 다음 누름은 늘 들어간다 */
exports.TAP_GUARD_MS = 700;
let lastTap = 0;
/** 줄 누름 — 직전 누름에서 TAP_GUARD_MS 안이면 무시. 처리 함수가 던져도 다음 누름은 막히지 않는다 */
function pressOnce(run, now = Date.now()) {
    if (now - lastTap >= 0 && now - lastTap < exports.TAP_GUARD_MS)
        return false;
    lastTap = now;
    run();
    return true;
}
/** 시험용 — 누름 기록을 지운다 */
function resetTapGuard() { lastTap = 0; }
/** (0.4.4) 앱이 앞으로 돌아올 때마다 올라가는 숫자 — 서버 목록을 다시 읽는 신호 */
function useActiveTick() {
    const [n, setN] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => {
        const sub = react_native_1.AppState.addEventListener('change', (s) => { if (s === 'active')
            setN(v => v + 1); });
        return () => sub.remove();
    }, []);
    return n;
}
/** 서버 home_rows 를 얹는 층 — 훅이 있어 `fetchJson` 이 있을 때만 쓴다(없으면 BenefitQuickList 가 그림만 바로 그린다) */
function ServerRowsList({ fetchJson, homeKeys, onRow, refreshKey, storage, storageKey, items, view }) {
    const tick = useActiveTick();
    const key = (0, react_1.useMemo)(() => [refreshKey, tick], [refreshKey, tick]);
    const { config, ready } = (0, useHomeConfig_1.useHomeConfig)(fetchJson, key, storage, storageKey);
    const keys = (0, react_1.useMemo)(() => (0, home_1.resolveHomeKeys)(items, homeKeys), [items, homeKeys]);
    const merged = (0, react_1.useMemo)(() => (0, home_1.composeHomeRows)(items, config.rows, keys, { onRow }), [items, config.rows, keys, onRow]);
    // (0.4.6) 저장소를 쓰면 저장값을 읽을 때까지(최대 300ms) 그리지 않는다 — 앱 기본 순서를 잠깐 그렸다가 서버 순서로 바꾸지 않으려고. 저장소가 없으면 ready 는 늘 true
    if (!ready)
        return null;
    return (0, jsx_runtime_1.jsx)(QuickListView, { ...view, items: merged });
}
/**
 * 「바로 받는 혜택」 목록. (0.4.4) `fetchJson` 을 주면 서버 home_rows 를 스스로 적용하고, `onFreeItem` 을 주면 free_item 기본 줄이 생긴다 — 둘 다 없으면 0.4.3 과 똑같이 그린다.
 */
function BenefitQuickList(props) {
    const { fetchJson, homeKeys, itemName, onFreeItem, onRow, refreshKey, storage, storageKey, items, homeActions, homeContext, ...view } = props;
    // (0.7.5) homeActions 가 있으면 줄 정의는 패키지 것 — 서버에만 있는 줄은 동작이 없으니 그리지 않는다(onRow 안 씀)
    const base = homeActions ? (0, homeDefs_1.buildHomeItems)(homeContext ?? {}, homeActions) : (0, home_1.withFreeItemRow)(items ?? [], homeKeys, itemName, onFreeItem);
    if (!fetchJson)
        return QuickListView({ ...view, items: base });
    return (0, jsx_runtime_1.jsx)(ServerRowsList, { fetchJson: fetchJson, homeKeys: homeActions ? undefined : homeKeys, onRow: homeActions ? undefined : onRow, refreshKey: refreshKey, storage: storage, storageKey: storageKey, items: base, view: view });
}
function QuickListView({ title = '바로 받는 혜택', seeAllLabel, onSeeAll, accentColor = '#EE7A33', items, footer, doneLabel = '완료', buttonWidth = 100, buttonHeight = 40 }) {
    const visible = items.filter(item => !item.hidden);
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.root, children: [title || (seeAllLabel && onSeeAll) ? (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.header, children: [title ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.title, children: title }) : (0, jsx_runtime_1.jsx)(react_native_1.View, {}), seeAllLabel && onSeeAll ? (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", onPress: onSeeAll, hitSlop: 8, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.seeAll, { color: accentColor }], children: seeAllLabel }) }) : null] }) : null, (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.card, children: visible.map((item, index) => (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: item.title + ', ' + (item.done ? (item.doneLabel ?? doneLabel) : item.ctaLabel), accessibilityState: { disabled: !!item.done }, disabled: item.done, onPress: () => { if (!item.done)
                        pressOnce(item.onPress); }, style: ({ pressed }) => [s.row, index < visible.length - 1 && s.border, pressed && !item.done && { opacity: 0.85 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.icon, { backgroundColor: item.tint }], children: (0, jsx_runtime_1.jsx)(Icon, { icon: item.icon }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.copy, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.nameRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.name, children: item.title }), item.badge ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.badge, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.badgeText, children: item.badge }) }) : null] }), item.progress && item.progress.total > 0
                                    ? (0, jsx_runtime_1.jsxs)(react_native_1.View, { accessibilityLabel: item.progress.done + '/' + item.progress.total, style: s.steps, children: [Array.from({ length: item.progress.total }, (_, i) => (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.step, { backgroundColor: i < item.progress.done ? accentColor : '#ECE6DE' }] }, i)), item.progressLabel ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.stepsLabel, numberOfLines: 1, children: item.progressLabel }) : null] })
                                    : (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.subtitle, numberOfLines: 1, adjustsFontSizeToFit: true, children: item.subtitle })] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: [s.button, { width: buttonWidth, height: buttonHeight, backgroundColor: item.done ? '#D3D7DD' : accentColor }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.cta, numberOfLines: 1, adjustsFontSizeToFit: true, children: item.done ? (item.doneLabel ?? doneLabel) : item.ctaLabel }) })] }, item.key)) }), footer != null ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.footer, children: footer }) : null] });
}
const s = react_native_1.StyleSheet.create({
    root: { gap: 10 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
    title: { fontSize: 19, fontWeight: '700', color: '#2B2118', flexShrink: 1 }, seeAll: { fontSize: 13 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, border: { borderBottomWidth: 1, borderBottomColor: '#F3EBE1' },
    icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    copy: { flex: 1, minWidth: 0, gap: 2 }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }, /* 광고 배지 — 글자만 떠 보이지 않게 색 바탕 배지로 조금 크게(당근 대표님 10-19 19:33 「배지로 조금 더 크게」) */
    badge: { backgroundColor: '#FDE6D6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }, badgeText: { fontSize: 11, fontWeight: '800', color: '#E2600F' }, name: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: '#2B2118' }, subtitle: { fontSize: 13, color: '#6B5E52' },
    steps: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }, step: { flex: 1, maxWidth: 26, height: 6, borderRadius: 3 }, stepsLabel: { marginLeft: 4, fontSize: 12, color: '#6B5E52' },
    button: { flexShrink: 0, height: 40, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, cta: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' }, footer: { marginTop: 4 },
    iconDrawing: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
    emoji: { fontSize: 22, lineHeight: 26, textAlign: 'center' },
    calendar: { width: 18, height: 17, borderRadius: 3 }, calendarLine: { height: 2, marginTop: 3 }, check: { width: 8, height: 5, borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '-45deg' }], marginLeft: 4, marginTop: 2 },
    bag: { width: 16, height: 14, borderRadius: 2, marginTop: 5 }, handle: { position: 'absolute', top: 1, width: 8, height: 9, borderRadius: 5 },
    pin: { width: 16, height: 19, borderRadius: 9, borderBottomRightRadius: 1, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' }, dot: { width: 6, height: 6, borderRadius: 3 },
    diamond: { position: 'absolute', width: 13, height: 13, transform: [{ rotate: '45deg' }] }, ticket: { width: 20, height: 14, borderRadius: 3 }, ticketLine: { height: 10, borderLeftWidth: 1, borderStyle: 'dashed', marginLeft: 6 },
    head: { position: 'absolute', top: 1, left: 4, width: 8, height: 8, borderRadius: 4 }, shoulders: { position: 'absolute', bottom: 1, left: 1, width: 15, height: 9, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomWidth: 0 }, plusH: { position: 'absolute', right: 0, top: 9, width: 7, height: 2 }, plusV: { position: 'absolute', right: 2.5, top: 6.5, height: 7, width: 2 },
});
