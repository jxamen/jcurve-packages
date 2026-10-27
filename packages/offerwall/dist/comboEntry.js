"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBO_POPUP_DELAY_MS = exports.COMBO_SHEET_TOP = exports.COMBO_CHIP_RIGHT = exports.COMBO_CHIP_TOP = exports.COMBOS_POPUP_ACTION = exports.COMBOS_ROUTE = void 0;
exports.isCombosRoute = isCombosRoute;
exports.requestOpenCombos = requestOpenCombos;
exports.listenForComboRequests = listenForComboRequests;
exports.ComboChip = ComboChip;
exports.ComboBanner = ComboBanner;
exports.ComboEntry = ComboEntry;
const combos_1 = require("./combos");
const campaigns_1 = require("./campaigns");
const comboDone_1 = require("./comboDone");
const comboSeen_1 = require("./comboSeen");
const wallSignal_1 = require("./wallSignal");
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
function ComboChip({ onPress, open = false, theme = combos_1.DEFAULT_COMBO_THEME, top = exports.COMBO_CHIP_TOP, right = exports.COMBO_CHIP_RIGHT, opacity }) {
    const React = require('react');
    const { View, Text, Pressable, Animated } = require('react-native');
    const h = React.createElement;
    const t = theme;
    const pressable = h(Pressable, {
        accessibilityRole: 'button', accessibilityLabel: combos_1.COMBO_NAME, accessibilityState: { expanded: open }, onPress, hitSlop: 6,
        style: ({ pressed }) => ({
            height: 36, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, borderRadius: t.radius.chip,
            backgroundColor: t.accent, opacity: pressed ? 0.8 : 1, ...t.shadow,
        }),
    }, h(Text, { style: { fontSize: t.font.small, fontWeight: '900', color: t.text } }, combos_1.COMBO_NAME), h(Text, { accessible: false, style: { fontSize: t.font.small, fontWeight: '900', color: t.accentText } }, open ? '✕' : '›'));
    return h(View, { pointerEvents: 'box-none', style: { position: 'absolute', top, right, zIndex: 30, elevation: 30 } }, opacity ? h(Animated.View, { style: { opacity } }, pressable) : pressable);
}
/** Home banner: the name large, the goal numbers emphasized. */
function ComboBanner({ combos, onPress, theme = combos_1.DEFAULT_COMBO_THEME, opacity }) {
    const React = require('react');
    const { View, Text, Pressable, Animated } = require('react-native');
    const h = React.createElement;
    const t = theme;
    const goals = combos.bundles.map(b => (0, combos_1.formatGoal)(b.goal));
    const pressable = h(Pressable, {
        accessibilityRole: 'button',
        accessibilityLabel: `${combos_1.COMBO_NAME}, ${goals.join(', ')} 목표별로 보기`,
        onPress,
        style: ({ pressed }) => ({
            marginHorizontal: 16, marginVertical: 8, padding: 16, borderRadius: t.radius.card, flexDirection: 'row', alignItems: 'center',
            backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line, opacity: pressed ? 0.85 : 1, ...t.shadow,
        }),
    }, h(View, { style: { flex: 1, minWidth: 0, paddingRight: 8 } }, h(Text, { numberOfLines: 1, style: { fontSize: t.font.head, fontWeight: '900', color: t.text } }, combos_1.COMBO_NAME), 
    // Two short lines, so Korean words never break in the middle on a narrow phone.
    h(Text, { numberOfLines: 1, style: { marginTop: 4, fontSize: t.font.body, lineHeight: 22, color: t.sub } }, goals.flatMap((goal, i) => [i ? ' · ' : '', h(Text, { key: goal, style: { fontWeight: '900', color: t.point } }, goal)])), h(Text, { numberOfLines: 1, style: { fontSize: t.font.small, lineHeight: 22, color: t.sub } }, '목표별 추천 조합이 있어요')), h(View, { style: { borderRadius: t.radius.chip, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: t.accent } }, h(Text, { style: { fontSize: t.font.small, fontWeight: '900', color: t.text } }, '보기 ›')));
    return opacity ? h(Animated.View, { style: { opacity } }, pressable) : pressable;
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
const short = (value, max = 80) => {
    const e = value;
    const text = typeof value === 'string' ? value : e && (e.code || e.message) ? `${e.code ? String(e.code) + ': ' : ''}${String(e.message ?? '')}` : String(value);
    return text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
};
const SLOW_REFUSAL_MS = 4500;
const isCampaignKey = (value) => !!value && /^\d{3,20}$/.test(value);
/** How long after the wall has loaded the recommendation popup waits before it appears. */
exports.COMBO_POPUP_DELAY_MS = 600;
/**
 * Recommendation popup in the middle of the wall, shown once a day after the Chance tab's wall has loaded. It sits under the chip
 * (the chip stays visible and tappable), over a dimmed wall; tapping the dim area closes it. 「추천 보기」 opens the guide sheet.
 */
function ComboPopup({ combos, theme, onOpen, onClose }) {
    const React = require('react');
    const { View, Text, Pressable } = require('react-native');
    const h = React.createElement;
    const t = theme;
    const lines = (0, combos_1.comboPopupLines)(combos);
    const button = (label, onPress, primary, flex) => h(Pressable, {
        key: label, accessibilityRole: 'button', accessibilityLabel: label, onPress,
        style: ({ pressed }) => ({
            flex, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: t.radius.slot, opacity: pressed ? 0.8 : 1,
            backgroundColor: primary ? t.accent : t.accentSoft,
        }),
    }, h(Text, { style: { fontSize: t.font.body, fontWeight: '900', color: primary ? t.text : t.accentText } }, label));
    return h(View, {
        key: 'popup', pointerEvents: 'box-none',
        style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 22, elevation: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
    }, h(Pressable, {
        accessibilityRole: 'button', accessibilityLabel: '팝업 닫기', onPress: onClose,
        style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
    }), h(View, {
        accessibilityViewIsModal: true,
        style: { width: '100%', maxWidth: 340, borderRadius: t.radius.card, backgroundColor: t.card, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18, ...t.shadow },
    }, h(Text, { style: { fontSize: t.font.title, fontWeight: '900', color: t.text } }, combos_1.COMBO_NAME), lines.map((line, i) => h(Text, {
        key: `line-${i}`,
        style: { marginTop: i === 0 ? 10 : 4, fontSize: t.font.body, lineHeight: 24, fontWeight: i === 0 ? '800' : '600', color: i === 0 ? t.text : t.sub },
    }, line)), h(View, { style: { flexDirection: 'row', gap: 10, marginTop: 20 } }, button('닫기', onClose, false, 1), button('추천 보기', onOpen, true, 1.4))));
}
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
function ComboEntry({ placement, url, headers, load, loadKey, usn, theme = combos_1.DEFAULT_COMBO_THEME, sample = false, onPressMission, storage, copyText, campaigns, reportCampaigns, onDiagnostic, chipTop, chipRight, sheetTop = exports.COMBO_SHEET_TOP, }) {
    const React = require('react');
    const { Modal, Pressable, SafeAreaView } = require('react-native');
    const h = React.createElement;
    const state = (0, combos_1.useTodayCombos)({ url, headers, load, loadKey, sample });
    const [open, setOpen] = React.useState(false);
    const marks = (0, comboDone_1.useDoneMissions)({ storage, scope: loadKey, date: state.combos?.date });
    const [notice, setNotice] = React.useState(null);
    const noticeTimer = React.useRef(null);
    const campaignCache = React.useRef(null);
    const latest = React.useRef({ campaigns, copyText, reportCampaigns, usn, placement, onDiagnostic });
    latest.current = { campaigns, copyText, reportCampaigns, usn, placement, onDiagnostic };
    const mode = placement === 'chance' ? state.combos?.display.chance ?? 'chip' : state.combos?.display.home ?? 'off';
    const shown = placement === 'chance' ? mode === 'chip' && !!state.combos : mode === 'banner' && !!state.combos;
    const listening = placement === 'chance' || mode !== 'off';
    // Blink until the guide was opened once today (by anyone: chip, banner, popup); then rest until the next Korean day.
    const seen = (0, comboSeen_1.useSeenToday)({ storage, scope: loadKey, date: state.combos?.date });
    const blink = (0, comboSeen_1.usePulse)(shown && !open && seen.seen === false);
    // The recommendation popup: once a day per member, after the Chance tab's wall has loaded, unless the guide was already opened
    // today (by the chip, a main popup, a push) or this very visit. Server `display.popup: 'off'` turns it off.
    const popupSeen = (0, comboSeen_1.useSeenToday)({ storage, scope: loadKey, date: state.combos?.date, keyOf: comboSeen_1.popupStorageKey });
    const [popup, setPopup] = React.useState(false);
    const [wallReady, setWallReady] = React.useState(wallSignal_1.isWallLoaded);
    const everOpened = React.useRef(false);
    const popupGiven = React.useRef(false); // at most one popup per visit (entry mount), even when it is shown on every visit
    React.useEffect(() => (placement === 'chance' ? (0, wallSignal_1.onWallState)(setWallReady) : undefined), [placement]);
    const popupMode = state.combos?.display.popup; // 'off' | 'always' | undefined (once a day)
    const popupDue = placement === 'chance' && shown && !!state.combos && popupMode !== 'off' && !open && !popup && !everOpened.current && !popupGiven.current
        && (popupMode === 'always' || (seen.seen === false && popupSeen.seen === false));
    const popupDueNow = React.useRef(false);
    popupDueNow.current = popupDue;
    React.useEffect(() => {
        if (!popupDue || !wallReady)
            return;
        const timer = setTimeout(() => {
            if (!popupDueNow.current)
                return;
            popupGiven.current = true;
            setPopup(true);
            popupSeen.markSeen();
        }, exports.COMBO_POPUP_DELAY_MS);
        return () => clearTimeout(timer);
    }, [popupDue, wallReady]);
    // Opening the guide (chip, popup button, main popup, push) counts as seen today for the blink AND for the popup.
    React.useEffect(() => {
        if (!open)
            return;
        everOpened.current = true;
        setPopup(false);
        if (state.combos) {
            seen.markSeen();
            popupSeen.markSeen();
        }
    }, [open, !!state.combos]);
    React.useEffect(() => listening ? listenForComboRequests({ priority: placement === 'chance' ? 2 : 1, open: () => setOpen(true) }) : undefined, [listening, placement]);
    React.useEffect(() => () => { if (noticeTimer.current)
        clearTimeout(noticeTimer.current); }, []);
    const bridge = () => (latest.current.campaigns === undefined ? (0, campaigns_1.nativeCampaignApi)() : latest.current.campaigns);
    /** The SDK's current campaigns, read once per member (and again after an empty result). Keeps WHY it was empty. */
    const campaignList = () => {
        const key = String(loadKey ?? '');
        if (campaignCache.current?.key === key)
            return campaignCache.current.promise;
        const api = bridge();
        if (!api)
            return Promise.resolve({ list: [] });
        const promise = withTimeout(api.list().then((list) => ({ list }), (error) => ({ list: [], error: short(error) })), 4000, { list: [], error: 'timeout' }).then(result => {
            if (!result.list.length && campaignCache.current?.promise === promise)
                campaignCache.current = null; // ask again next time
            else if (result.list.length) {
                try {
                    latest.current.reportCampaigns?.(result.list);
                }
                catch { /* reporting is best effort */ }
            }
            return result;
        });
        campaignCache.current = { key, promise };
        return promise;
    };
    // Warm the list when the guide opens, so a tap that needs it does not wait.
    React.useEffect(() => { if (open && bridge())
        void campaignList(); }, [open]);
    const say = (text) => {
        if (noticeTimer.current)
            clearTimeout(noticeTimer.current);
        setNotice(text);
        noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
    };
    /**
     * Order, as asked by 대표님 (「해당 미션 페이지로 무조건 바로」): 1) the server's key (`campaignKey`, or a numeric mission id) goes
     * straight to the SDK without waiting for any list, 2) the same name in the SDK's list, 3) the row id when it is in the list,
     * 4) the fallback (name at the top, copied, plain list). Every tap reports what happened through `onDiagnostic`.
     */
    const handleMission = async (mission, bundle) => {
        if (onPressMission) {
            onPressMission(mission, bundle);
            return;
        }
        const started = Date.now();
        const api = bridge();
        const diag = { t: 'tap', mission: mission.id, name: mission.name, bridge: !!api, listCount: 0, how: 'none', attempts: 0, open: 'skipped', ms: 0 };
        const tried = new Set();
        let unsure = false;
        /**
         * Gives one key to the SDK. true = it took it (the guide stays open for the next campaign).
         * A "no" that took about as long as the native timeout may be a page that is still loading, so no second page is opened after it.
         */
        const attempt = async (key, how) => {
            if (!api || unsure || tried.has(key))
                return false;
            tried.add(key);
            diag.how = how;
            diag.key = key;
            diag.attempts = tried.size;
            delete diag.openError;
            const at = Date.now();
            try {
                diag.open = (await api.open(key)) ? true : false;
            }
            catch (error) {
                diag.open = 'error';
                diag.openError = short(error);
            }
            diag.openMs = Date.now() - at;
            if (diag.open === false && diag.openMs >= SLOW_REFUSAL_MS)
                unsure = true;
            return diag.open === true;
        };
        const finish = (extra = {}) => {
            Object.assign(diag, extra, { ms: Date.now() - started });
            try {
                void Promise.resolve(latest.current.onDiagnostic?.({ ...diag })).catch(() => { });
            }
            catch { /* diagnostics never break the tap */ }
        };
        if (api) {
            // 1) the server's key: no list needed
            for (const key of [mission.campaignKey, isCampaignKey(mission.id) ? mission.id : undefined]) {
                if (key && await attempt(key, 'server_key')) {
                    finish();
                    return;
                }
            }
            // 2) names / ids from the SDK's own list (it is only a part of the offerwall, so a miss is normal)
            const { list, error } = await withTimeout(campaignList(), 2500, { list: [], error: 'timeout' });
            diag.listCount = list.length;
            if (error)
                diag.listError = error;
            if (list.length)
                diag.listSample = list.slice(0, 5).map(c => c.name.slice(0, 40));
            const keys = new Set(list.map(c => c.campaignKey));
            const byName = (0, campaigns_1.findCampaignKey)(list, mission.name);
            if (byName && await attempt(byName, 'name')) {
                finish();
                return;
            }
            if (keys.has(mission.id) && await attempt(mission.id, 'id_in_list')) {
                finish();
                return;
            }
        }
        // 3) fallback
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
        finish({ copied });
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
    if (!shown && !open && !notice && !popup)
        return null;
    if (placement === 'home') {
        return h(React.Fragment, null, shown && state.combos ? h(ComboBanner, { combos: state.combos, onPress: () => setOpen(true), theme, opacity: blink }) : null, open ? h(Modal, { visible: true, animationType: 'slide', onRequestClose: close }, h(SafeAreaView, { style: { flex: 1, backgroundColor: theme.bg } }, guide('page'), notice ? h(ComboToast, { text: notice, top: 8, theme }) : null)) : null);
    }
    return h(React.Fragment, null, open ? h(Pressable, {
        key: 'backdrop', accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: close,
        style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, elevation: 20, backgroundColor: 'rgba(0,0,0,0.3)' },
    }) : null, open ? h(ComboSheet, { key: 'sheet', top: sheetTop, theme }, guide('sheet')) : null, popup && !open && state.combos ? h(ComboPopup, { combos: state.combos, theme, onOpen: () => { setPopup(false); setOpen(true); }, onClose: () => setPopup(false) }) : null, shown ? h(ComboChip, { key: 'chip', open, theme, top: chipTop, right: chipRight, opacity: blink, onPress: () => setOpen(o => !o) }) : null, notice ? h(ComboToast, { key: 'notice', text: notice, top: sheetTop + 8, theme }) : null);
}
