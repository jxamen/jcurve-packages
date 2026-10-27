"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBO_SHEET_TOP = exports.COMBO_CHIP_RIGHT = exports.COMBO_CHIP_TOP = exports.COMBOS_POPUP_ACTION = exports.COMBOS_ROUTE = void 0;
exports.isCombosRoute = isCombosRoute;
exports.requestOpenCombos = requestOpenCombos;
exports.listenForComboRequests = listenForComboRequests;
exports.ComboChip = ComboChip;
exports.ComboBanner = ComboBanner;
exports.ComboEntry = ComboEntry;
const combos_1 = require("./combos");
const campaigns_1 = require("./campaigns");
const comboDone_1 = require("./comboDone");
const index_1 = require("./index");
/** Route name for pushes (`data.go`) and links. Apps use in-app actions, not a URL scheme. */
exports.COMBOS_ROUTE = 'offerwall/combos';
/** Server popups store their action in a 10-character column, so the popup action is this short form. */
exports.COMBOS_POPUP_ACTION = 'combos';
/** Accepts 'offerwall/combos', '/offerwall/combos?from=push', 'myapp://offerwall/combos' and the popup action 'combos'. */
function isCombosRoute(value) {
    if (typeof value !== 'string')
        return false;
    const path = value.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^\/+/, '').split(/[?#]/)[0].replace(/\/+$/, '');
    return path === exports.COMBOS_ROUTE || path === exports.COMBOS_POPUP_ACTION;
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
const withTimeout = (promise, ms, fallback) => {
    let timer;
    return Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve(fallback), ms); })]).finally(() => clearTimeout(timer));
};
const NOTICE_MS = 4500;
/** Short message at the top ("신한 SOL페이" 를 찾아 주세요). Touches go through it. */
function ComboToast({ text, top, theme }) {
    const React = require('react');
    const { View, Text } = require('react-native');
    return React.createElement(View, {
        pointerEvents: 'none',
        style: { position: 'absolute', left: 16, right: 16, top, zIndex: 40, elevation: 40, borderRadius: theme.radius.slot, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: theme.text },
    }, React.createElement(Text, { style: { fontSize: theme.font.small, lineHeight: 22, fontWeight: '800', color: '#FFFFFF' } }, text));
}
/**
 * Chance tab: put it next to the wall inside one container, `<View style={{flex:1}}><OfferwallScreen/><ComboEntry placement="chance"/></View>`.
 * The chip floats over the wall's header row; tapping it raises the guide over the wall, tapping again (or 닫기) closes it
 * and the wall stays as it was. Home: a banner that opens the guide as a full screen. The server picks what shows
 * through `display`; the Chance tab keeps answering popup / push / link requests even when its chip is switched off.
 *
 * Tapping 하러 가기 on a row: with the native bridge the campaign's key is looked up (same name in the SDK's list, or the
 * server's id when it is a key) and its detail page opens. Otherwise, or when nothing is found, the name is shown at the
 * top (and copied when possible) and the plain list is revealed: the Chance tab closes the guide, Home opens the list.
 */
function ComboEntry({ placement, url, headers, load, loadKey, usn, theme = combos_1.DEFAULT_COMBO_THEME, sample = false, onPressMission, storage, copyText, campaigns, reportCampaigns, chipTop, chipRight, sheetTop = exports.COMBO_SHEET_TOP, }) {
    const React = require('react');
    const { Modal, Pressable, SafeAreaView } = require('react-native');
    const h = React.createElement;
    const state = (0, combos_1.useTodayCombos)({ url, headers, load, loadKey, sample });
    const [open, setOpen] = React.useState(false);
    const marks = (0, comboDone_1.useDoneMissions)({ storage, scope: loadKey, date: state.combos?.date });
    const [notice, setNotice] = React.useState(null);
    const noticeTimer = React.useRef(null);
    const campaignCache = React.useRef(null);
    const latest = React.useRef({ campaigns, copyText, reportCampaigns, usn, placement });
    latest.current = { campaigns, copyText, reportCampaigns, usn, placement };
    const mode = placement === 'chance' ? state.combos?.display.chance ?? 'chip' : state.combos?.display.home ?? 'off';
    const shown = placement === 'chance' ? mode === 'chip' && !!state.combos : mode === 'banner' && !!state.combos;
    const listening = placement === 'chance' || mode !== 'off';
    React.useEffect(() => listening ? listenForComboRequests({ priority: placement === 'chance' ? 2 : 1, open: () => setOpen(true) }) : undefined, [listening, placement]);
    React.useEffect(() => () => { if (noticeTimer.current)
        clearTimeout(noticeTimer.current); }, []);
    const bridge = () => (latest.current.campaigns === undefined ? (0, campaigns_1.nativeCampaignApi)() : latest.current.campaigns);
    /** The SDK's current campaigns, read once per member (and again after an empty result). */
    const campaignList = () => {
        const key = String(loadKey ?? '');
        if (campaignCache.current?.key === key)
            return campaignCache.current.promise;
        const api = bridge();
        if (!api)
            return Promise.resolve([]);
        const promise = withTimeout(api.list().catch(() => []), 4000, []).then(list => {
            if (!list.length && campaignCache.current?.promise === promise)
                campaignCache.current = null;
            else if (list.length) {
                try {
                    latest.current.reportCampaigns?.(list);
                }
                catch { /* reporting is best effort */ }
            }
            return list;
        });
        campaignCache.current = { key, promise };
        return promise;
    };
    // Warm the list when the guide opens, so the first tap does not wait.
    React.useEffect(() => { if (open && bridge())
        void campaignList(); }, [open]);
    const say = (text) => {
        if (noticeTimer.current)
            clearTimeout(noticeTimer.current);
        setNotice(text);
        noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
    };
    const handleMission = async (mission, bundle) => {
        if (onPressMission) {
            onPressMission(mission, bundle);
            return;
        }
        const api = bridge();
        if (api) {
            const list = await withTimeout(campaignList(), 2500, []);
            const keys = new Set(list.map(c => c.campaignKey));
            const candidates = [
                (0, campaigns_1.findCampaignKey)(list, mission.name),
                keys.has(mission.id) ? mission.id : null,
                mission.campaignKey ?? null,
                !list.length && /^\d{3,20}$/.test(mission.id) ? mission.id : null, // list unavailable: a numeric server id may still be the key
            ].filter((key, i, all) => !!key && all.indexOf(key) === i);
            for (const key of candidates) {
                try {
                    if (await api.open(key))
                        return;
                }
                catch { /* try the next, then the fallback */ }
            }
        }
        const copy = latest.current.copyText ?? (0, campaigns_1.nativeCopyText)();
        let copied = false;
        if (copy) {
            try {
                copied = (await copy(mission.name)) !== false;
            }
            catch {
                copied = false;
            }
        }
        say(`"${mission.name}" 를 찾아 주세요${copied ? ' · 이름을 복사했어요' : ''}`);
        if (latest.current.placement === 'chance')
            setOpen(false); // the wall is right below
        else if (latest.current.usn) {
            const wall = latest.current.usn;
            setTimeout(() => { (0, index_1.openOfferwall)({ usn: wall }); }, 700);
        }
    };
    const close = () => setOpen(false);
    const guide = (variant) => h(combos_1.ComboGuideScreen, {
        combos: state.combos, loading: state.status === 'loading', onClose: close, onPressMission: handleMission, usn, theme, variant,
        done: marks.done, onToggleDone: marks.toggle,
    });
    if (!shown && !open && !notice)
        return null;
    if (placement === 'home') {
        return h(React.Fragment, null, shown && state.combos ? h(ComboBanner, { combos: state.combos, onPress: () => setOpen(true), theme }) : null, open ? h(Modal, { visible: true, animationType: 'slide', onRequestClose: close }, h(SafeAreaView, { style: { flex: 1, backgroundColor: theme.bg } }, guide('page'), notice ? h(ComboToast, { text: notice, top: 8, theme }) : null)) : null);
    }
    return h(React.Fragment, null, open ? h(Pressable, {
        key: 'backdrop', accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: close,
        style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, elevation: 20, backgroundColor: 'rgba(0,0,0,0.3)' },
    }) : null, open ? h(ComboSheet, { key: 'sheet', top: sheetTop, theme }, guide('sheet')) : null, shown ? h(ComboChip, { key: 'chip', open, theme, top: chipTop, right: chipRight, onPress: () => setOpen(o => !o) }) : null, notice ? h(ComboToast, { key: 'notice', text: notice, top: sheetTop + 8, theme }) : null);
}
