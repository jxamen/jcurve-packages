"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBO_SHEET_TOP = exports.COMBO_CHIP_RIGHT = exports.COMBO_CHIP_TOP = exports.COMBOS_ROUTE = void 0;
exports.isCombosRoute = isCombosRoute;
exports.requestOpenCombos = requestOpenCombos;
exports.listenForComboRequests = listenForComboRequests;
exports.ComboChip = ComboChip;
exports.ComboBanner = ComboBanner;
exports.ComboEntry = ComboEntry;
const combos_1 = require("./combos");
/** Route name shared by server popups, pushes and links. Apps use in-app actions, not a URL scheme. */
exports.COMBOS_ROUTE = 'offerwall/combos';
/** Accepts 'offerwall/combos', '/offerwall/combos?from=push' and 'myapp://offerwall/combos'. */
function isCombosRoute(value) {
    if (typeof value !== 'string')
        return false;
    const path = value.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^\/+/, '').split(/[?#]/)[0].replace(/\/+$/, '');
    return path === exports.COMBOS_ROUTE;
}
const openers = new Set();
let waitingSince = 0;
const WAIT_MS = 10000;
/**
 * Opens the guide from anywhere (popup button, push tap, link). If no entry is mounted yet, for example while the app
 * switches tabs, the request waits up to 10 seconds for the first one that mounts. Returns true when an entry took it.
 */
function requestOpenCombos(now = Date.now()) {
    let target;
    // Ties go to the most recently mounted one: a screen that just appeared is the likelier one on display.
    for (const opener of openers)
        if (!target || opener.priority >= target.priority)
            target = opener;
    if (!target) {
        waitingSince = now;
        return false;
    }
    waitingSince = 0;
    target.open();
    return true;
}
/** Chance tab (2) wins over Home (1) so one request never opens two screens. */
function listenForComboRequests(opener, now = Date.now()) {
    openers.add(opener);
    const waiting = waitingSince && now - waitingSince <= WAIT_MS;
    waitingSince = 0;
    if (waiting)
        opener.open();
    return () => { openers.delete(opener); };
}
/**
 * Where the chip sits, in points from the top-right of the wall's container. Measured on two captures of the wall's own
 * header row (iPhone 402pt wide, Galaxy A32 411dp wide): row ~48 high, profile icon centered ~24 down and its left edge
 * ~44 from the right, so a 36-high chip 8 left of the icon is top 6 / right 52. The header stays fixed when the list scrolls.
 */
exports.COMBO_CHIP_TOP = 6;
exports.COMBO_CHIP_RIGHT = 52;
exports.COMBO_SHEET_TOP = 52;
/**
 * Small chip that floats over the wall's own header row, left of its profile icon. Only the chip is drawn: no band,
 * no padding box, and the wrapper lets touches through everywhere else.
 */
function ComboChip({ onPress, open = false, theme = combos_1.DEFAULT_COMBO_THEME, top = exports.COMBO_CHIP_TOP, right = exports.COMBO_CHIP_RIGHT }) {
    const React = require('react');
    const { View, Text, Pressable } = require('react-native');
    const h = React.createElement;
    const t = theme;
    return h(View, { pointerEvents: 'box-none', style: { position: 'absolute', top, right, zIndex: 30, elevation: 30 } }, h(Pressable, {
        accessibilityRole: 'button', accessibilityLabel: combos_1.COMBO_NAME, accessibilityState: { expanded: open }, onPress, hitSlop: 6,
        style: ({ pressed }) => ({
            height: 36, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, borderRadius: t.radius.chip,
            backgroundColor: t.accent, opacity: pressed ? 0.8 : 1, ...t.shadow,
        }),
    }, h(Text, { style: { fontSize: t.font.small, fontWeight: '900', color: t.text } }, combos_1.COMBO_NAME), h(Text, { accessible: false, style: { fontSize: t.font.small, fontWeight: '900', color: t.accentText } }, open ? '✕' : '›')));
}
/** Home banner: the name large, the goal numbers emphasized. */
function ComboBanner({ combos, onPress, theme = combos_1.DEFAULT_COMBO_THEME }) {
    const React = require('react');
    const { View, Text, Pressable } = require('react-native');
    const h = React.createElement;
    const t = theme;
    const goals = combos.bundles.map(b => (0, combos_1.formatGoal)(b.goal));
    return h(Pressable, {
        accessibilityRole: 'button',
        accessibilityLabel: `${combos_1.COMBO_NAME}, ${goals.join(', ')} 목표별로 보기`,
        onPress,
        style: ({ pressed }) => ({
            marginHorizontal: 16, marginVertical: 8, padding: 16, borderRadius: t.radius.card, flexDirection: 'row', alignItems: 'center',
            backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line, opacity: pressed ? 0.85 : 1, ...t.shadow,
        }),
    }, h(View, { style: { flex: 1, minWidth: 0, paddingRight: 8 } }, h(Text, { numberOfLines: 1, style: { fontSize: t.font.head, fontWeight: '900', color: t.text } }, combos_1.COMBO_NAME), h(Text, { numberOfLines: 2, style: { marginTop: 4, fontSize: t.font.small, lineHeight: 22, color: t.sub } }, goals.flatMap((goal, i) => [i ? ' · ' : '', h(Text, { key: goal, style: { fontWeight: '900', color: t.point } }, goal)]), ' 목표별 추천 조합이 있어요')), h(View, { style: { borderRadius: t.radius.chip, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: t.accent } }, h(Text, { style: { fontSize: t.font.small, fontWeight: '900', color: t.text } }, '보기 ›')));
}
/** Panel that rises from the bottom over the wall. It starts below the chip row so the chip stays visible and clickable. */
function ComboSheet({ top, theme, children }) {
    const React = require('react');
    const { Animated, Dimensions } = require('react-native');
    const slide = React.useRef(null);
    if (!slide.current)
        slide.current = new Animated.Value(0);
    React.useEffect(() => { Animated.timing(slide.current, { toValue: 1, duration: 220, useNativeDriver: true }).start(); }, []);
    const translateY = slide.current.interpolate({ inputRange: [0, 1], outputRange: [Dimensions.get('window').height, 0] });
    return React.createElement(Animated.View, {
        style: {
            position: 'absolute', left: 0, right: 0, bottom: 0, top, zIndex: 25, elevation: 25, overflow: 'hidden',
            borderTopLeftRadius: theme.radius.card, borderTopRightRadius: theme.radius.card, backgroundColor: theme.bg,
            transform: [{ translateY }], ...theme.shadow,
        },
    }, children);
}
/**
 * Chance tab: put it next to the wall inside one container, `<View style={{flex:1}}><OfferwallScreen/><ComboEntry placement="chance"/></View>`.
 * The chip floats over the wall's header row; tapping it raises the guide over the wall, tapping again (or 닫기) closes it
 * and the wall stays as it was. Home: a banner that opens the guide as a full screen. The server picks what shows
 * through `display`; the Chance tab keeps answering popup / push / link requests even when its chip is switched off.
 */
function ComboEntry({ placement, url, headers, usn, theme = combos_1.DEFAULT_COMBO_THEME, sample = false, onPressMission, chipTop, chipRight, sheetTop = exports.COMBO_SHEET_TOP }) {
    const React = require('react');
    const { Modal, Pressable, SafeAreaView } = require('react-native');
    const h = React.createElement;
    const state = (0, combos_1.useTodayCombos)({ url, headers, sample });
    const [open, setOpen] = React.useState(false);
    const mode = placement === 'chance' ? state.combos?.display.chance ?? 'chip' : state.combos?.display.home ?? 'off';
    const shown = placement === 'chance' ? mode === 'chip' && !!state.combos : mode === 'banner' && !!state.combos;
    const listening = placement === 'chance' || mode !== 'off';
    React.useEffect(() => listening ? listenForComboRequests({ priority: placement === 'chance' ? 2 : 1, open: () => setOpen(true) }) : undefined, [listening, placement]);
    const close = () => setOpen(false);
    const guide = (variant) => h(combos_1.ComboGuideScreen, {
        combos: state.combos, loading: state.status === 'loading', onClose: close, onPressMission, usn, theme, variant,
    });
    if (!shown && !open)
        return null;
    if (placement === 'home') {
        return h(React.Fragment, null, shown && state.combos ? h(ComboBanner, { combos: state.combos, onPress: () => setOpen(true), theme }) : null, open ? h(Modal, { visible: true, animationType: 'slide', onRequestClose: close }, h(SafeAreaView, { style: { flex: 1, backgroundColor: theme.bg } }, guide('page'))) : null);
    }
    return h(React.Fragment, null, open ? h(Pressable, {
        key: 'backdrop', accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: close,
        style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, elevation: 20, backgroundColor: 'rgba(0,0,0,0.3)' },
    }) : null, open ? h(ComboSheet, { key: 'sheet', top: sheetTop, theme }, guide('sheet')) : null, shown ? h(ComboChip, { key: 'chip', open, theme, top: chipTop, right: chipRight, onPress: () => setOpen(o => !o) }) : null);
}
