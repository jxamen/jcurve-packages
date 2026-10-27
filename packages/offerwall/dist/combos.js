"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBO_LIST_HINT = exports.TODAY_COMBOS_SAMPLE = exports.DEFAULT_COMBO_THEME = exports.COMBO_LEVEL_LABEL = exports.COMBO_NAME = void 0;
exports.normalizeTodayCombos = normalizeTodayCombos;
exports.kstDate = kstDate;
exports.isTodayCombos = isTodayCombos;
exports.msUntilKstMidnight = msUntilKstMidnight;
exports.formatPoints = formatPoints;
exports.formatGoal = formatGoal;
exports.comboThemeFromTokens = comboThemeFromTokens;
exports.fetchTodayCombos = fetchTodayCombos;
exports.useTodayCombos = useTodayCombos;
exports.ComboGuideScreen = ComboGuideScreen;
const index_1 = require("./index");
/** The one place the feature's name lives (chip, Home banner, guide title, labels, popup text). */
exports.COMBO_NAME = '쉽게 1만P 모으기';
const LEVELS = ['easy', 'normal', 'hard'];
exports.COMBO_LEVEL_LABEL = { easy: '쉬움', normal: '보통', hard: '조금 걸려요' };
const text = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '';
/** Whole number in 1..max, else 0. The cap keeps hostile values from producing sums that are no longer exact. */
const whole = (v, max = 100000000) => {
    const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
    return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= max ? n : 0;
};
const MAX_POINTS = 10000000;
/** Keeps only well-formed rows; totals are recomputed so the screen never shows a sum the rows do not add up to. */
function normalizeTodayCombos(raw) {
    const data = raw && typeof raw === 'object' ? raw : null;
    if (!data || !Array.isArray(data.bundles))
        return null;
    const bundles = [];
    const goals = new Set();
    for (const item of data.bundles.slice(0, 4)) {
        const goal = whole(item?.goal);
        if (!goal || goals.has(goal) || !Array.isArray(item.missions))
            continue;
        const ids = new Set();
        const missions = [];
        for (const m of item.missions.slice(0, 12)) {
            const id = text(typeof m?.id === 'number' ? String(m.id) : m?.id, 64);
            const name = text(m?.name, 40);
            const points = whole(m?.points, MAX_POINTS);
            if (!id || !name || !points || ids.has(id))
                continue;
            ids.add(id);
            const minutes = whole(m.minutes);
            missions.push({
                id, name, points, todo: text(m.todo, 80),
                level: LEVELS.includes(m.level) ? m.level : 'normal',
                ...(minutes && minutes <= 120 ? { minutes } : {}),
            });
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
    return date ? { date, display, bundles } : { display, bundles };
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
        const body = await response.json();
        if (!body || typeof body !== 'object' || body.ok === false)
            return { ok: false, reason: 'bad_response' };
        const combos = normalizeTodayCombos(body.combos ?? body.data ?? body);
        if (!combos)
            return { ok: false, reason: 'bad_response' };
        return isTodayCombos(combos, now) ? { ok: true, combos } : { ok: false, reason: 'stale' };
    }
    catch {
        return { ok: false, reason: 'network' };
    }
    finally {
        clearTimeout(timer);
    }
}
/** Fixed data for building the screen before the API exists. Only `sample: true` ever shows it. */
exports.TODAY_COMBOS_SAMPLE = {
    display: { chance: 'chip', home: 'banner' },
    bundles: [
        { goal: 1000, total: 1050, missions: [
                { id: 's1', name: '쇼핑몰 둘러보기', points: 300, todo: '상품 3개 눌러서 구경하기', level: 'easy', minutes: 1 },
                { id: 's2', name: '간단한 설문 하나', points: 450, todo: '질문 5개에 답하기', level: 'easy', minutes: 3 },
                { id: 's3', name: '새 앱 열어 보기', points: 300, todo: '앱을 설치하고 한 번 열기', level: 'normal', minutes: 2 },
            ] },
        { goal: 5000, total: 5200, missions: [
                { id: 's4', name: '여행 앱 가입', points: 1800, todo: '가입하고 첫 화면까지 들어가기', level: 'normal', minutes: 5 },
                { id: 's5', name: '게임 3단계까지', points: 2200, todo: '게임을 설치하고 3단계 깨기', level: 'hard', minutes: 20 },
                { id: 's6', name: '간단한 설문 하나', points: 450, todo: '질문 5개에 답하기', level: 'easy', minutes: 3 },
                { id: 's7', name: '쇼핑몰 둘러보기', points: 300, todo: '상품 3개 눌러서 구경하기', level: 'easy', minutes: 1 },
                { id: 's8', name: '새 앱 열어 보기', points: 450, todo: '앱을 설치하고 한 번 열기', level: 'normal', minutes: 2 },
            ] },
        { goal: 10000, total: 10100, missions: [
                { id: 's9', name: '금융 앱 가입', points: 4000, todo: '가입하고 본인 확인까지 마치기', level: 'hard', minutes: 10 },
                { id: 's10', name: '게임 5단계까지', points: 3600, todo: '게임을 설치하고 5단계 깨기', level: 'hard', minutes: 30 },
                { id: 's11', name: '여행 앱 가입', points: 1800, todo: '가입하고 첫 화면까지 들어가기', level: 'normal', minutes: 5 },
                { id: 's12', name: '간단한 설문 하나', points: 450, todo: '질문 5개에 답하기', level: 'easy', minutes: 3 },
                { id: 's13', name: '쇼핑몰 둘러보기', points: 250, todo: '상품 3개 눌러서 구경하기', level: 'easy', minutes: 1 },
            ] },
    ],
};
/**
 * Loads today's combos. Without `url` nothing is shown unless `sample` is true (screen work only),
 * so users never see example rows as if they were real.
 * Data is tied to the url + headers it was fetched with: a new member or address starts empty instead of showing
 * the previous one's rows. After Korean midnight yesterday's rows are dropped and today's are fetched again.
 */
function useTodayCombos({ url, headers, sample = false }) {
    const React = require('react');
    const headersKey = JSON.stringify(headers ?? {});
    const key = `${url ?? ''}|${headersKey}|${sample ? 1 : 0}`;
    const start = () => sample && !url ? { status: 'ready', combos: exports.TODAY_COMBOS_SAMPLE } : { status: url ? 'loading' : 'empty', combos: null };
    const [state, setState] = React.useState(() => ({ key, ...start() }));
    const [tick, setTick] = React.useState(0);
    React.useEffect(() => {
        if (!url)
            return;
        let live = true;
        fetchTodayCombos({ url, headers: JSON.parse(headersKey) }).then(result => {
            if (live)
                setState({ key, ...(result.ok ? { status: 'ready', combos: result.combos } : { status: 'empty', combos: null }) });
        });
        return () => { live = false; };
    }, [key, tick]);
    React.useEffect(() => {
        if (!url)
            return;
        const timer = setTimeout(() => setTick(n => n + 1), msUntilKstMidnight() + 5000);
        return () => clearTimeout(timer);
    }, [url, tick]);
    const reload = () => { setState(prev => ({ ...prev, status: 'loading' })); setTick(n => n + 1); };
    const current = state.key === key ? state : { key, ...start() };
    // Re-checked on every render, so a render after midnight never shows yesterday's rows.
    const fresh = current.combos && (current.combos === exports.TODAY_COMBOS_SAMPLE || isTodayCombos(current.combos)) ? current.combos : null;
    return { status: fresh ? current.status : current.status === 'loading' ? 'loading' : 'empty', combos: fresh, reload };
}
exports.COMBO_LIST_HINT = '누르면 혜택 목록이 열려요. 같은 이름을 찾아 참여해 주세요.';
/** The guide page: a 1단계 · 2단계 · 3단계 path (1천P → 5천P → 1만P), one bundle shown at a time. */
function ComboGuideScreen({ combos, loading = false, onClose, onPressMission, usn, theme = exports.DEFAULT_COMBO_THEME, showHeader = true, topInset = 0, variant = 'page', hint = exports.COMBO_LIST_HINT }) {
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
    const index = Math.min(selected, Math.max(0, bundles.length - 1));
    const bundle = bundles[index];
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
    return h(View, { style: { flex: 1, backgroundColor: t.bg, paddingTop: Math.max(0, topInset) } }, showHeader ? (variant === 'sheet'
        ? h(View, { style: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 } }, h(Text, { style: { fontSize: t.font.head, fontWeight: '900', color: t.text } }, exports.COMBO_NAME), h(Pressable, { accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: onClose, hitSlop: 12, style: { paddingVertical: 8, paddingHorizontal: 4 } }, h(Text, { style: { fontSize: t.font.small, fontWeight: '900', color: t.accentText } }, '닫기')))
        : h(View, { style: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 } }, h(Pressable, { accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: onClose, hitSlop: 12, style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' } }, h(Text, { style: { fontSize: 30, color: t.text } }, '‹')), h(Text, { style: { fontSize: t.font.head, fontWeight: '900', color: t.text } }, exports.COMBO_NAME))) : null, h(ScrollView, { contentContainerStyle: { padding: 16, paddingBottom: 40, gap: 16 } }, bundle ? h(View, { style: { gap: 4 } }, h(Text, { style: { fontSize: t.font.title, fontWeight: '900', color: t.text } }, '1만P까지 가는 길'), h(Text, { style: { fontSize: t.font.small, lineHeight: 22, color: t.sub } }, '쉬운 것부터 하나씩 해 보세요.')) : null, bundles.length > 1 ? h(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 6 } }, bundles.flatMap((b, i) => {
        const on = i === index;
        const pill = h(Pressable, {
            key: `step-${b.goal}`, accessibilityRole: 'button', accessibilityState: { selected: on },
            accessibilityLabel: `${i + 1}단계 ${formatGoal(b.goal)}`, onPress: () => setSelected(i),
            style: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: t.radius.slot, borderWidth: 1.5, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.card },
        }, h(Text, { style: { fontSize: t.font.tiny, fontWeight: '700', color: on ? t.accentText : t.sub } }, `${i + 1}단계`), h(Text, { style: { fontSize: t.font.head, fontWeight: '900', color: t.text } }, formatGoal(b.goal)));
        return i === 0 ? [pill] : [h(Text, { key: `to-${b.goal}`, style: { fontSize: 20, color: t.divider } }, '›'), pill];
    })) : null, bundle ? h(View, { key: String(bundle.goal), style: card }, h(View, { style: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' } }, h(Text, { style: { fontSize: t.font.title, fontWeight: '900', color: t.text } }, `${formatPoints(bundle.goal)} 모으기`), h(View, { style: { alignItems: 'flex-end' } }, h(Text, { style: { fontSize: t.font.tiny, color: t.sub } }, '합계'), h(Text, { style: { fontSize: t.font.head, fontWeight: '900', color: t.point } }, formatPoints(bundle.total)))), actionable && !onPressMission && hint ? h(Text, { style: { marginTop: 8, fontSize: t.font.small, lineHeight: 21, color: t.sub } }, hint) : null, bundle.missions.map((mission, i) => h(Pressable, {
        key: mission.id,
        accessibilityRole: 'button',
        accessibilityLabel: `${i + 1}번 ${mission.name}, ${formatPoints(mission.points)}, ${exports.COMBO_LEVEL_LABEL[mission.level]}${actionable ? ', 하러 가기' : ''}`,
        disabled: !actionable,
        onPress: () => press(mission, bundle),
        style: ({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', paddingVertical: 14, marginTop: i === 0 ? 8 : 0,
            borderTopWidth: i === 0 ? 0 : 1.5, borderTopColor: t.divider, opacity: pressed ? 0.7 : 1,
        }),
    }, h(View, { style: { width: 28, height: 28, borderRadius: 14, marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accentSoft } }, h(Text, { style: { fontSize: t.font.small, fontWeight: '900', color: t.accentText } }, String(i + 1))), h(View, { style: { flex: 1, minWidth: 0, paddingRight: 8 } }, h(Text, { numberOfLines: 2, style: { fontSize: t.font.body, fontWeight: '800', color: t.text } }, mission.name), mission.todo ? h(Text, { numberOfLines: 1, style: { marginTop: 2, fontSize: t.font.small, color: t.sub } }, mission.todo) : null, h(View, { style: { flexDirection: 'row', marginTop: 6 } }, h(View, { style: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: t.tag } }, h(Text, { style: { fontSize: t.font.tiny, fontWeight: '700', color: t.tagText } }, mission.minutes ? `${exports.COMBO_LEVEL_LABEL[mission.level]} · 약 ${mission.minutes}분` : exports.COMBO_LEVEL_LABEL[mission.level])))), h(View, { style: { alignItems: 'flex-end', gap: 6 } }, h(Text, { style: { fontSize: t.font.head, fontWeight: '900', color: t.point } }, `+${formatPoints(mission.points)}`), actionable ? h(View, { style: { borderRadius: t.radius.chip, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: t.accentSoft } }, h(Text, { style: { fontSize: t.font.small, fontWeight: '900', color: t.accentText } }, '하러 가기 ›')) : null)))) : null, !bundle ? h(Text, { style: { marginTop: 48, fontSize: t.font.small, lineHeight: 22, textAlign: 'center', color: t.sub } }, loading ? '불러오고 있어요' : '지금은 준비하고 있어요.\n잠시 뒤에 다시 확인해 주세요.') : null, bundle ? h(Text, { style: { fontSize: t.font.tiny, lineHeight: 20, color: t.sub } }, '합계는 표시된 항목을 모두 마쳤을 때 기준이에요. 오늘 하루 기준이고 내일은 새로 바뀌어요. 항목마다 참여 조건이 달라서, 눌러서 안내를 꼭 확인해 주세요.') : null, notice ? h(Text, { style: { fontSize: t.font.small, fontWeight: '700', color: '#E5484D' } }, notice) : null));
}
