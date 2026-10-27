"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBO_LIST_HINT = exports.TODAY_COMBOS_SAMPLE = exports.DEFAULT_COMBO_THEME = exports.COMBO_LEVEL_LABEL = exports.COMBO_EASY_NAME = exports.COMBO_NAME = void 0;
exports.normalizeTodayCombos = normalizeTodayCombos;
exports.kstDate = kstDate;
exports.isTodayCombos = isTodayCombos;
exports.msUntilKstMidnight = msUntilKstMidnight;
exports.formatPoints = formatPoints;
exports.formatGoal = formatGoal;
exports.comboThemeFromTokens = comboThemeFromTokens;
exports.fetchTodayCombos = fetchTodayCombos;
exports.parseCombosBody = parseCombosBody;
exports.loadTodayCombos = loadTodayCombos;
exports.useTodayCombos = useTodayCombos;
exports.ComboGuideScreen = ComboGuideScreen;
const index_1 = require("./index");
/** The one place the feature's name lives (chip, Home banner, guide title, labels, popup text). */
exports.COMBO_NAME = '포인트 빨리 모으기';
/** Name of the tab that lists only easy missions, before the 1천 → 5천 → 1만P steps. */
exports.COMBO_EASY_NAME = '쉽게 모으기';
const LEVELS = ['easy', 'normal', 'hard'];
exports.COMBO_LEVEL_LABEL = { easy: '쉬움', normal: '보통', hard: '조금 걸려요' };
const text = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '';
/** Whole number in 1..max, else 0. The cap keeps hostile values from producing sums that are no longer exact. */
const whole = (v, max = 100000000) => {
    const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
    return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= max ? n : 0;
};
const MAX_POINTS = 10000000;
/** One mission row from the server, checked; null when it cannot be shown (no id, name or points). */
function cleanMission(m) {
    const id = text(typeof m?.id === 'number' ? String(m.id) : m?.id, 64);
    const name = text(m?.name, 40);
    const points = whole(m?.points, MAX_POINTS);
    if (!id || !name || !points)
        return null;
    const minutes = whole(m.minutes);
    const campaignKey = text(m.campaignKey ?? m.campaign_key, 64);
    return {
        id, name, points, todo: text(m.todo, 80),
        level: LEVELS.includes(m.level) ? m.level : 'normal',
        ...(minutes && minutes <= 120 ? { minutes } : {}),
        ...(campaignKey ? { campaignKey } : {}),
    };
}
/** Keeps only well-formed rows; totals are recomputed so the screen never shows a sum the rows do not add up to. */
function normalizeTodayCombos(raw) {
    const data = raw && typeof raw === 'object' ? raw : null;
    if (!data || !Array.isArray(data.bundles))
        return null;
    const bundles = [];
    const goals = new Set();
    // Look through the first 40 entries and keep the first valid bundle per goal, at most 4 (the server may send alternatives).
    for (const item of data.bundles.slice(0, 40)) {
        if (bundles.length >= 4)
            break;
        const goal = whole(item?.goal);
        if (!goal || goals.has(goal) || !Array.isArray(item.missions))
            continue;
        const ids = new Set();
        const missions = [];
        for (const m of item.missions.slice(0, 40)) {
            if (missions.length >= 12)
                break;
            const mission = cleanMission(m);
            if (!mission || ids.has(mission.id))
                continue;
            ids.add(mission.id);
            missions.push(mission);
        }
        const total = missions.reduce((sum, m) => sum + m.points, 0);
        // A bundle titled by its goal must reach it; a short one would be a wrong promise on screen.
        if (!missions.length || total < goal)
            continue;
        goals.add(goal);
        bundles.push({ goal, missions, total });
    }
    if (!bundles.length)
        return null;
    bundles.sort((a, b) => a.goal - b.goal);
    const date = typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : undefined;
    // Unknown or missing switches fall back to: chip in the Chance tab, nothing on Home.
    const display = {
        chance: data.display?.chance === 'off' ? 'off' : 'chip',
        home: data.display?.home === 'banner' ? 'banner' : 'off',
    };
    const singles = cleanSingles(data.singles, goals);
    const easy = cleanEasy(data.easy);
    return { ...(date ? { date } : {}), display, bundles, ...(singles.length ? { singles } : {}), ...(easy ? { easy } : {}) };
}
/**
 * `easy`: { missions: [...], total_points }. Any points count (a follow may give 100P). At most 20 different missions;
 * the total is recomputed from what is kept, the server's own number is never shown.
 */
function cleanEasy(raw) {
    const list = raw?.missions;
    if (!Array.isArray(list))
        return null;
    const ids = new Set();
    const missions = [];
    for (const m of list.slice(0, 60)) {
        if (missions.length >= 20)
            break;
        const mission = cleanMission(m);
        if (!mission || ids.has(mission.id))
            continue;
        ids.add(mission.id);
        missions.push(mission);
    }
    return missions.length ? { missions, total: missions.reduce((sum, m) => sum + m.points, 0) } : null;
}
/**
 * `singles`: missions that reach a goal on their own, grouped by goal. The server sends entries like
 * { goal, missions: [one mission] }, several per goal, in mixed kinds. A single only counts when its own points reach the
 * goal (otherwise "한 번에 끝내기" would be a wrong promise), goals without a bundle step are dropped (nowhere to show them),
 * and each goal keeps at most 6 different missions.
 */
function cleanSingles(raw, bundleGoals) {
    if (!Array.isArray(raw))
        return [];
    const byGoal = new Map();
    for (const entry of raw.slice(0, 60)) {
        const goal = whole(entry?.goal);
        if (!goal || !bundleGoals.has(goal) || !Array.isArray(entry.missions))
            continue;
        const list = byGoal.get(goal) ?? [];
        for (const m of entry.missions.slice(0, 12)) {
            const mission = cleanMission(m);
            if (!mission || mission.points < goal || list.length >= 6 || list.some(x => x.id === mission.id))
                continue;
            list.push(mission);
        }
        if (list.length)
            byGoal.set(goal, list);
    }
    return [...byGoal.entries()].sort((a, b) => a[0] - b[0]).map(([goal, missions]) => ({ goal, missions }));
}
/** Calendar date in Korea (the daily reset), YYYY-MM-DD. */
function kstDate(now = Date.now()) {
    return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
/** Yesterday's combos must not be shown as today's, so a body without a date counts as stale too. */
function isTodayCombos(combos, now = Date.now()) {
    return combos.date === kstDate(now);
}
/** Milliseconds until the next 00:00 in Korea. */
function msUntilKstMidnight(now = Date.now()) {
    const day = 24 * 3600 * 1000;
    return day - ((now + 9 * 3600 * 1000) % day);
}
function formatPoints(n) {
    return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}P`;
}
/** 1000 → 1천P, 5000 → 5천P, 10000 → 1만P, anything else → 1,500P */
function formatGoal(goal) {
    if (goal >= 10000 && goal % 10000 === 0)
        return `${goal / 10000}만P`;
    if (goal >= 1000 && goal < 10000 && goal % 1000 === 0)
        return `${goal / 1000}천P`;
    return formatPoints(goal);
}
exports.DEFAULT_COMBO_THEME = {
    bg: '#FBF4E4', card: '#FFFFFF', line: '#F0E2C4', divider: '#E6D3AA', text: '#3A2A1A', sub: '#6B5842',
    accent: '#FFC23D', accentText: '#9A5B0E', accentSoft: '#FFF0C7', point: '#9A5B0E', pointSoft: '#FFF0C7',
    tag: '#EFF1FA', tagText: '#5B6BA8',
    radius: { card: 20, slot: 14, chip: 999 },
    font: { title: 22, head: 19, body: 16.5, small: 15, tiny: 13.5 },
    shadow: { shadowColor: '#3A2A1A', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
};
/** Maps the family's `C`/`R`/`F`/`shadow` objects (tree → accent, treeDark → accentText, treeSoft → accentSoft). */
function comboThemeFromTokens({ C, R, F, shadow }) {
    const d = exports.DEFAULT_COMBO_THEME;
    const color = (key, fallback) => (typeof C?.[key] === 'string' ? C[key] : fallback);
    const size = (box, key, fallback) => (typeof box?.[key] === 'number' ? box[key] : fallback);
    return {
        bg: color('bg', d.bg), card: color('card', d.card), line: color('line', d.line), divider: color('divider', d.divider),
        text: color('text', d.text), sub: color('sub', d.sub),
        accent: color('tree', d.accent), accentText: color('treeDark', d.accentText), accentSoft: color('treeSoft', d.accentSoft),
        point: color('point', d.point), pointSoft: color('pointSoft', d.pointSoft),
        tag: d.tag, tagText: d.tagText,
        radius: { card: size(R, 'card', d.radius.card), slot: size(R, 'slot', d.radius.slot), chip: size(R, 'chip', d.radius.chip) },
        font: { title: size(F, 'title', d.font.title), head: size(F, 'head', d.font.head), body: size(F, 'body', d.font.body), small: size(F, 'small', d.font.small), tiny: size(F, 'tiny', d.font.tiny) },
        shadow: shadow ?? d.shadow,
    };
}
async function fetchTodayCombos({ url, headers = {}, timeoutMs = 8000, now, fetcher }) {
    const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
    const timer = setTimeout(() => controller?.abort(), timeoutMs);
    try {
        const response = await (fetcher ?? fetch)(url, { headers, signal: controller?.signal, cache: 'no-store' });
        if (!response.ok)
            return { ok: false, reason: 'bad_response' };
        return parseCombosBody(await response.json(), now);
    }
    catch {
        return { ok: false, reason: 'network' };
    }
    finally {
        clearTimeout(timer);
    }
}
/** A response body (`{ok, combos}`, `{ok, data}` or the combos themselves) → checked combos for today. */
function parseCombosBody(body, now) {
    const data = body && typeof body === 'object' ? body : null;
    if (!data || data.ok === false)
        return { ok: false, reason: 'bad_response' };
    const combos = normalizeTodayCombos(data.combos ?? data.data ?? data);
    if (!combos)
        return { ok: false, reason: 'bad_response' };
    return isTodayCombos(combos, now) ? { ok: true, combos } : { ok: false, reason: 'stale' };
}
/**
 * Same as `fetchTodayCombos` but the app does the request with its own API function (auth, device and OTA headers,
 * 401 handling stay the app's). `load` resolves to the parsed JSON body; a throw counts as a network failure.
 */
async function loadTodayCombos({ load, timeoutMs = 8000, now }) {
    let timer;
    try {
        const body = await Promise.race([load(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); })]);
        return parseCombosBody(body, now);
    }
    catch {
        return { ok: false, reason: 'network' };
    }
    finally {
        clearTimeout(timer);
    }
}
/**
 * Fixed data for building the screen before the API exists, in the shape of a real server response (one row = one
 * campaign, same id in several bundles when the same campaign fits). Only `sample: true` ever shows it.
 */
exports.TODAY_COMBOS_SAMPLE = {
    display: { chance: 'chip', home: 'banner' },
    bundles: [
        { goal: 1000, total: 1008, missions: [
                { id: '6a4b15730e9e', name: '신한 SOL페이 앱', points: 1008, todo: '신규 회원가입하기', level: 'easy', minutes: 5 },
            ] },
        { goal: 5000, total: 5400, missions: [
                { id: 'b35d9413fbe7', name: '짱구 게임 방범대', points: 5400, todo: '스코어 2300 달성하기', level: 'normal', minutes: 10 },
            ] },
        { goal: 10000, total: 10440, missions: [
                { id: '0997f27c39be', name: '스탁매니저', points: 2880, todo: '최초 회원 가입하기', level: 'easy', minutes: 5 },
                { id: 'b35d9413fbe7', name: '짱구 게임 방범대', points: 5400, todo: '스코어 2300 달성하기', level: 'normal', minutes: 10 },
                { id: 'a91005a89f4a', name: 'AnyPop : Zoo Blast', points: 2160, todo: '첫 7000점 달성하기', level: 'normal', minutes: 10 },
            ] },
    ],
    // 「한 번에 끝내기」: one mission is enough, mixed kinds (a signup, a game score, a free lookup, one that needs a payment).
    singles: [
        { goal: 1000, missions: [
                { id: '6a4b15730e9e', name: '신한 SOL페이 앱', points: 1008, todo: '신규 회원가입하기', level: 'easy', minutes: 5 },
                { id: 'db421f2f2671', name: '연말 환급받기', points: 2592, todo: '무료로 조회하기', level: 'normal', minutes: 6 },
                { id: '0997f27c39be', name: '스탁매니저', points: 2880, todo: '최초 회원 가입하기', level: 'easy', minutes: 5 },
            ] },
        { goal: 5000, missions: [
                { id: 'b35d9413fbe7', name: '짱구 게임 방범대', points: 5400, todo: '스코어 2300 달성하기', level: 'normal', minutes: 10 },
                { id: 'c27e61d0aa31', name: '쇼핑몰 첫 구매', points: 6200, todo: '첫 구매하기 · 결제 필요', level: 'hard', minutes: 15 },
            ] },
        { goal: 10000, missions: [
                { id: 'e50b9a1c7d42', name: '증권 계좌 만들기', points: 12000, todo: '계좌 개설하기', level: 'hard', minutes: 20 },
            ] },
    ],
    // 「쉽게 모으기」: small, quick ones (follow, subscribe, install and open); no goal to reach.
    easy: {
        total: 600,
        missions: [
            { id: '7d20c1e4a915', name: '삼성생명 인스타그램', points: 102, todo: '인스타그램 팔로우하기', level: 'easy', minutes: 3 },
            { id: '3f8e5b02c6d7', name: '메디필 공식 채널', points: 150, todo: '채널 구독하기', level: 'easy', minutes: 3 },
            { id: '91ac4d37e0b8', name: '우리WON뱅킹', points: 180, todo: '앱 설치하고 열기', level: 'easy', minutes: 4 },
            { id: '5c06f2a8b3e1', name: '머지 드림홈', points: 168, todo: '앱 설치하고 열기', level: 'easy', minutes: 4 },
        ],
    },
};
function useTodayCombos({ url, headers, load, loadKey, sample = false }) {
    const React = require('react');
    const headersKey = JSON.stringify(headers ?? {});
    const enabled = !!url || !!load;
    const key = `${url ?? ''}|${headersKey}|${load ? 'load:' + String(loadKey ?? '') : ''}|${sample ? 1 : 0}`;
    const latestLoad = React.useRef(load);
    latestLoad.current = load;
    const start = () => sample && !enabled ? { status: 'ready', combos: exports.TODAY_COMBOS_SAMPLE } : { status: enabled ? 'loading' : 'empty', combos: null };
    const [state, setState] = React.useState(() => ({ key, ...start() }));
    const [tick, setTick] = React.useState(0);
    React.useEffect(() => {
        if (!enabled)
            return;
        let live = true;
        const request = latestLoad.current
            ? loadTodayCombos({ load: () => latestLoad.current() })
            : fetchTodayCombos({ url: url, headers: JSON.parse(headersKey) });
        request.then(result => {
            if (live)
                setState({ key, ...(result.ok ? { status: 'ready', combos: result.combos } : { status: 'empty', combos: null }) });
        });
        return () => { live = false; };
    }, [key, tick]);
    React.useEffect(() => {
        if (!enabled)
            return;
        const timer = setTimeout(() => setTick(n => n + 1), msUntilKstMidnight() + 5000);
        return () => clearTimeout(timer);
    }, [enabled, tick]);
    const reload = () => { setState(prev => ({ ...prev, status: 'loading' })); setTick(n => n + 1); };
    const current = state.key === key ? state : { key, ...start() };
    // Re-checked on every render, so a render after midnight never shows yesterday's rows.
    const fresh = current.combos && (current.combos === exports.TODAY_COMBOS_SAMPLE || isTodayCombos(current.combos)) ? current.combos : null;
    return { status: fresh ? current.status : current.status === 'loading' ? 'loading' : 'empty', combos: fresh, reload };
}
exports.COMBO_LIST_HINT = '누르면 혜택 목록이 열려요. 같은 이름을 찾아 참여해 주세요.';
const NO_DONE = new Set();
/** The guide page: a 1단계 · 2단계 · 3단계 path (1천P → 5천P → 1만P), one bundle shown at a time. */
function ComboGuideScreen({ combos, loading = false, onClose, onPressMission, usn, theme = exports.DEFAULT_COMBO_THEME, showHeader = true, topInset = 0, variant = 'page', hint = exports.COMBO_LIST_HINT, done = NO_DONE, onToggleDone }) {
    const React = require('react');
    const { View, Text, Pressable, ScrollView, BackHandler } = require('react-native');
    const h = React.createElement;
    const t = theme;
    const [notice, setNotice] = React.useState('');
    const [selected, setSelected] = React.useState(0);
    React.useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
        return () => subscription.remove();
    }, [onClose]);
    const bundles = combos?.bundles ?? [];
    const easy = combos?.easy;
    // Tabs: 「쉽게 모으기」 first when the server sent it (and it is what opens), then the steps. Its card is a bundle with goal 0.
    const tabCount = bundles.length + (easy ? 1 : 0);
    const index = Math.min(selected, Math.max(0, tabCount - 1));
    const onEasy = !!easy && index === 0;
    const stepIndex = index - (easy ? 1 : 0);
    const bundle = onEasy && easy ? { goal: 0, missions: easy.missions, total: easy.total } : bundles[stepIndex];
    const actionable = !!onPressMission || !!usn;
    const press = (mission, from) => {
        if (onPressMission) {
            onPressMission(mission, from);
            return;
        }
        if (!usn)
            return;
        const result = (0, index_1.openOfferwall)({ usn });
        setNotice(result.ok ? '' : result.message);
    };
    const card = { backgroundColor: t.card, borderRadius: t.radius.card, borderWidth: 1.5, borderColor: t.line, padding: 16, ...t.shadow };
    const todo = bundle ? bundle.missions.filter(m => !done.has(m.id)) : [];
    const rows = bundle ? [...todo, ...bundle.missions.filter(m => done.has(m.id))] : [];
    const remaining = todo.reduce((sum, m) => sum + m.points, 0);
    const allDone = !!bundle && todo.length === 0;
    const anyDone = !!bundle && todo.length < bundle.missions.length;
    // 「한 번에 끝내기」: missions that reach this step's goal on their own (hidden when the server sent none for it).
    const singles = bundle && !onEasy ? (combos?.singles?.find(s => s.goal === bundle.goal)?.missions ?? []) : [];
    const singlesTodo = singles.filter(m => !done.has(m.id));
    const singleRows = [...singlesTodo, ...singles.filter(m => done.has(m.id))];
    /** One mission row, the same look in the bundle and in the 「한 번에 끝내기」 box. `no` counts the ones not done yet. */
    const missionRow = (mission, index, no, forPress) => {
        const isDone = done.has(mission.id);
        return h(Pressable, {
            key: mission.id,
            accessibilityRole: 'button',
            accessibilityLabel: isDone ? `${mission.name}, 완료`
                : `${no}번 ${mission.name}, ${formatPoints(mission.points)}, ${exports.COMBO_LEVEL_LABEL[mission.level]}${actionable ? ', 하러 가기' : ''}`,
            disabled: !actionable || isDone,
            onPress: () => press(mission, forPress),
            style: ({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', paddingVertical: 14, marginTop: index === 0 ? 8 : 0,
                borderTopWidth: index === 0 ? 0 : 1.5, borderTopColor: t.divider, opacity: isDone ? 0.55 : pressed ? 0.7 : 1,
            }),
        }, h(Pressable, {
            accessibilityRole: 'checkbox', accessibilityState: { checked: isDone }, accessibilityLabel: `${mission.name} 완료 표시`,
            disabled: !onToggleDone, onPress: () => onToggleDone?.(mission.id), hitSlop: 8,
            style: {
                width: 32, height: 32, borderRadius: 16, marginRight: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDone ? t.accent : t.accentSoft, borderWidth: isDone ? 0 : 1.5, borderColor: t.accent,
            },
        }, h(Text, { style: { fontSize: t.font.small, fontWeight: '900', color: isDone ? t.text : t.accentText } }, isDone ? '✓' : String(no))), h(View, { style: { flex: 1, minWidth: 0, paddingRight: 8 } }, h(Text, { numberOfLines: 2, style: { fontSize: t.font.body, fontWeight: '800', color: t.text, textDecorationLine: isDone ? 'line-through' : 'none' } }, mission.name), mission.todo ? h(Text, { numberOfLines: 1, style: { marginTop: 2, fontSize: t.font.small, color: t.sub } }, mission.todo) : null, h(View, { style: { flexDirection: 'row', marginTop: 6 } }, h(View, { style: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: t.tag } }, h(Text, { style: { fontSize: t.font.tiny, fontWeight: '700', color: t.tagText } }, mission.minutes ? `${exports.COMBO_LEVEL_LABEL[mission.level]} · 약 ${mission.minutes}분` : exports.COMBO_LEVEL_LABEL[mission.level])))), h(View, { style: { alignItems: 'flex-end', gap: 6 } }, h(Text, { style: { fontSize: t.font.head, fontWeight: '900', color: t.point } }, `+${formatPoints(mission.points)}`), isDone ? h(Text, { style: { fontSize: t.font.tiny, fontWeight: '700', color: t.sub } }, '완료')
            : actionable ? h(View, { style: { borderRadius: t.radius.chip, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: t.accentSoft } }, h(Text, { style: { fontSize: t.font.small, fontWeight: '900', color: t.accentText } }, '하러 가기 ›')) : null));
    };
    let nextNo = 0;
    let nextSingleNo = 0;
    return h(View, { style: { flex: 1, backgroundColor: t.bg, paddingTop: Math.max(0, topInset) } }, showHeader ? (variant === 'sheet'
        ? h(View, { style: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 } }, h(Text, { style: { fontSize: t.font.head, fontWeight: '900', color: t.text } }, exports.COMBO_NAME), h(Pressable, { accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: onClose, hitSlop: 12, style: { paddingVertical: 8, paddingHorizontal: 4 } }, h(Text, { style: { fontSize: t.font.small, fontWeight: '900', color: t.accentText } }, '닫기')))
        : h(View, { style: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 } }, h(Pressable, { accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: onClose, hitSlop: 12, style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' } }, h(Text, { style: { fontSize: 30, color: t.text } }, '‹')), h(Text, { style: { fontSize: t.font.head, fontWeight: '900', color: t.text } }, exports.COMBO_NAME))) : null, h(ScrollView, { contentContainerStyle: { padding: 16, paddingBottom: 40, gap: 16 } }, bundle ? h(View, { style: { gap: 4 } }, h(Text, { style: { fontSize: t.font.title, fontWeight: '900', color: t.text } }, onEasy ? '쉬운 것부터 가볍게 모아요' : '1천 → 5천 → 1만P 차례로 모아요'), h(Text, { style: { fontSize: t.font.small, lineHeight: 22, color: t.sub } }, onEasy ? (onToggleDone ? '몇 분이면 끝나는 쉬운 미션만 모았어요. 포인트가 작아도 차곡차곡 쌓여요. 다 한 것은 앞의 동그라미를 눌러 체크해 두세요.' : '몇 분이면 끝나는 쉬운 미션만 모았어요. 포인트가 작아도 차곡차곡 쌓여요.')
        : onToggleDone ? '쉬운 것부터 하나씩 해 보세요. 다 한 것은 앞의 동그라미를 눌러 체크해 두세요.' : '쉬운 것부터 하나씩 해 보세요.')) : null, tabCount > 1 ? h(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 6 } }, [...(easy ? [null] : []), ...bundles].flatMap((b, i) => {
        const on = i === index;
        const isEasyTab = b === null;
        const step = i - (easy ? 1 : 0);
        const pill = h(Pressable, {
            key: isEasyTab ? 'easy' : `step-${b.goal}`, accessibilityRole: 'button', accessibilityState: { selected: on },
            accessibilityLabel: isEasyTab ? exports.COMBO_EASY_NAME : `${step + 1}단계 ${formatGoal(b.goal)}`, onPress: () => setSelected(i),
            style: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: t.radius.slot, borderWidth: 1.5, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.card },
        }, h(Text, { style: { fontSize: t.font.tiny, fontWeight: '700', color: on ? t.accentText : t.sub } }, isEasyTab ? '쉽게' : `${step + 1}단계`), h(Text, { style: { fontSize: t.font.head, fontWeight: '900', color: t.text } }, isEasyTab ? '모으기' : formatGoal(b.goal)));
        if (i === 0)
            return [pill];
        // a thin bar after 「쉽게 모으기」 (it is not a step), an arrow between steps
        return [i === 1 && easy ? h(View, { key: 'easy-bar', style: { width: 1.5, height: 28, backgroundColor: t.divider } }) : h(Text, { key: `to-${b.goal}`, style: { fontSize: 20, color: t.divider } }, '›'), pill];
    })) : null, bundle ? h(View, { key: String(bundle.goal), style: card }, h(View, { style: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' } }, h(Text, { style: { fontSize: t.font.title, fontWeight: '900', color: t.text } }, onEasy ? exports.COMBO_EASY_NAME : `${formatPoints(bundle.goal)} 모으기`), h(View, { style: { alignItems: 'flex-end' } }, h(Text, { style: { fontSize: t.font.tiny, color: t.sub } }, allDone ? '모두 마쳤어요' : anyDone ? '남은 합계' : onEasy ? '다 하면' : '합계'), allDone ? null : h(Text, { style: { fontSize: t.font.head, fontWeight: '900', color: t.point } }, onEasy ? `+${formatPoints(remaining)}` : formatPoints(remaining)))), actionable && !onPressMission && hint ? h(Text, { style: { marginTop: 8, fontSize: t.font.small, lineHeight: 21, color: t.sub } }, hint) : null, rows.map((mission, i) => missionRow(mission, i, done.has(mission.id) ? 0 : ++nextNo, bundle))) : null, 
    // 「한 번에 끝내기」: a second box under the step's bundle, one mission is enough to reach the goal. Hidden when the server sent none.
    bundle && singleRows.length ? h(View, { key: `singles-${bundle.goal}`, style: card }, h(Text, { style: { fontSize: t.font.title, fontWeight: '900', color: t.text } }, '한 번에 끝내기'), h(Text, { style: { marginTop: 4, fontSize: t.font.small, lineHeight: 22, color: t.sub } }, `아래 중 하나만 해도 ${formatPoints(bundle.goal)}를 채워요`), singleRows.map((mission, i) => missionRow(mission, i, done.has(mission.id) ? 0 : ++nextSingleNo, { goal: bundle.goal, missions: [mission], total: mission.points }))) : null, !bundle ? h(Text, { style: { marginTop: 48, fontSize: t.font.small, lineHeight: 22, textAlign: 'center', color: t.sub } }, loading ? '불러오고 있어요' : '지금은 준비하고 있어요.\n잠시 뒤에 다시 확인해 주세요.') : null, bundle ? h(Text, { style: { fontSize: t.font.tiny, lineHeight: 20, color: t.sub } }, '합계는 표시된 항목을 모두 마쳤을 때 기준이에요. 오늘 하루 기준이고 내일은 새로 바뀌어요. 항목마다 참여 조건이 달라서, 눌러서 안내를 꼭 확인해 주세요.') : null, notice ? h(Text, { style: { fontSize: t.font.small, fontWeight: '700', color: '#E5484D' } }, notice) : null));
}
