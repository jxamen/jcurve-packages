"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBO_TRIAL_CATEGORY = exports.COMBO_CATEGORY_PAGE = void 0;
exports.categoryItemMission = categoryItemMission;
exports.categoryRemaining = categoryRemaining;
exports.ComboCategoryScreen = ComboCategoryScreen;
const combos_1 = require("./combos");
/** Rows shown at first in a tab, and added by each 「더 보기」 (a tab can have a few hundred rows: games). */
exports.COMBO_CATEGORY_PAGE = 40;
/** The tab with free trials: no total, the cancel note instead. */
exports.COMBO_TRIAL_CATEGORY = 'trial';
const NO_DONE = new Set();
/** A category row as a mission (id = campaign key), for the tap, the check marks and the 「paid today」 mark. */
function categoryItemMission(item) {
    return {
        id: item.campaignKey, name: item.name, points: item.points, todo: item.line ?? '', level: 'easy', campaignKey: item.campaignKey,
        ...(item.icon ? { icon: item.icon } : {}),
    };
}
/** What 「다 하면 +N P」 shows: the server's total minus what this member already did among the items that cost nothing; null = no total. */
function categoryRemaining(category, isDone) {
    if (category.totalPoints === null)
        return null;
    const paid = category.items.filter(i => !i.cost && isDone(i.campaignKey)).reduce((sum, i) => sum + i.points, 0);
    return { total: Math.max(0, category.totalPoints - paid), paid };
}
const PILL = { bg: '#FFEBDD', fg: '#C2410C' };
function ComboCategoryScreen({ combos, loading = false, onClose, onPressMission, usn, theme = combos_1.DEFAULT_COMBO_THEME, showHeader = true, topInset = 0, variant = 'page', done = NO_DONE, onToggleDone, onTrialTab, }) {
    const React = require('react');
    const { View, Text, Pressable, ScrollView, BackHandler } = require('react-native');
    const h = React.createElement;
    const t = theme;
    const chipBg = t.chipBg ?? '#F2F4F6';
    const side = 20;
    const [notice, setNotice] = React.useState('');
    const [selected, setSelected] = React.useState(null); // the tab's key: a refetch keeps the member on the same tab
    const [shown, setShown] = React.useState({});
    React.useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
        return () => subscription.remove();
    }, [onClose]);
    const cats = combos?.categories ?? [];
    const found = selected === null ? -1 : cats.findIndex(c => c.key === selected);
    const index = Math.min(found < 0 ? 0 : found, Math.max(0, cats.length - 1));
    const cat = cats[index];
    const autoDone = (0, combos_1.autoDoneIds)(combos);
    const isDoneId = (id) => done.has(id) || autoDone.has(id);
    const actionable = !!onPressMission || !!usn;
    const press = (mission) => {
        if (onPressMission) {
            onPressMission(mission, { goal: 0, missions: [mission], total: mission.points });
            return;
        }
        if (!usn)
            return;
        const { openOfferwall } = require('./index');
        const result = openOfferwall({ usn });
        setNotice(result.ok ? '' : result.message);
    };
    const todoItems = cat ? cat.items.filter(i => !isDoneId(i.campaignKey)) : [];
    const rows = cat ? [...todoItems, ...cat.items.filter(i => isDoneId(i.campaignKey))] : [];
    const limit = cat ? shown[cat.key] ?? exports.COMBO_CATEGORY_PAGE : 0;
    const visible = rows.slice(0, limit);
    const sum = cat ? categoryRemaining(cat, isDoneId) : null;
    const isTrialTab = !!cat && cat.key === exports.COMBO_TRIAL_CATEGORY;
    React.useEffect(() => { if (isTrialTab)
        onTrialTab?.(); }, [isTrialTab]);
    let nextNo = 0;
    const row = (item, i) => {
        const mission = categoryItemMission(item);
        const isDone = isDoneId(item.campaignKey);
        const no = isDone ? 0 : ++nextNo;
        return h(Pressable, {
            key: item.campaignKey, accessibilityRole: 'button',
            accessibilityLabel: isDone ? `${item.name}, 완료`
                : `${no}번 ${item.name}, ${(0, combos_1.formatPoints)(item.points)}${item.line ? `, ${item.line}` : ''}${item.cost ? `, ${item.cost}` : ''}${actionable ? ', 하러 가기' : ''}`,
            disabled: !actionable || isDone, onPress: () => press(mission),
            style: ({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: side,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.line, backgroundColor: pressed ? '#F7F8FA' : 'transparent', opacity: isDone ? 0.5 : 1,
            }),
        }, h(View, { accessible: false, style: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: chipBg } }, h(Text, { style: { fontSize: no > 99 ? 12 : 14, lineHeight: 18, fontWeight: '700', color: isDone ? t.sub : t.text } }, isDone ? '✓' : String(no))), h(View, { style: { flex: 1, minWidth: 0, marginLeft: 12 } }, h(Text, { numberOfLines: 1, ellipsizeMode: 'tail', style: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: t.text, textDecorationLine: isDone ? 'line-through' : 'none' } }, item.name), item.line ? h(Text, { numberOfLines: 1, ellipsizeMode: 'tail', style: { marginTop: 1, fontSize: 13, lineHeight: 18, color: t.sub } }, item.line) : null, 
        // money that has to be spent: a small pill that stands out (nothing when the campaign costs nothing)
        item.cost ? h(View, { style: { alignSelf: 'flex-start', marginTop: 4, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, backgroundColor: PILL.bg } }, h(Text, { numberOfLines: 1, style: { fontSize: 11.5, lineHeight: 16, fontWeight: '800', color: PILL.fg } }, item.cost)) : null), h(Text, { style: { marginLeft: 8, fontSize: 15, fontWeight: '800', color: t.point } }, `+${(0, combos_1.formatPoints)(item.points)}`), onToggleDone ? h(Pressable, {
            accessibilityRole: 'checkbox', accessibilityState: { checked: isDone, disabled: autoDone.has(item.campaignKey) }, accessibilityLabel: `${item.name} 완료 표시`,
            disabled: autoDone.has(item.campaignKey), onPress: () => onToggleDone(item.campaignKey), hitSlop: 10,
            style: {
                marginLeft: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDone ? t.accentText : 'transparent', borderWidth: isDone ? 0 : 1.5, borderColor: '#D1D6DB',
            },
        }, isDone ? h(Text, { style: { fontSize: 13, lineHeight: 16, fontWeight: '900', color: '#FFFFFF' } }, '✓') : null) : null);
    };
    const closeText = (label) => h(Text, { style: { fontSize: 14, fontWeight: '600', color: t.sub } }, label);
    return h(View, { style: { flex: 1, backgroundColor: t.bg, paddingTop: Math.max(0, topInset) } }, showHeader ? (variant === 'sheet'
        ? h(View, { style: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: side } }, h(Text, { style: { fontSize: 18, fontWeight: '700', color: t.text } }, combos_1.COMBO_NAME), h(Pressable, { accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: onClose, hitSlop: 12, style: { paddingVertical: 8, paddingLeft: 8 } }, closeText('닫기')))
        : h(View, { style: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 } }, h(Pressable, { accessibilityRole: 'button', accessibilityLabel: '닫기', onPress: onClose, hitSlop: 12, style: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' } }, h(Text, { style: { fontSize: 28, color: t.text } }, '‹')), h(Text, { style: { fontSize: 18, fontWeight: '700', color: t.text } }, combos_1.COMBO_NAME))) : null, h(ScrollView, { contentContainerStyle: { paddingBottom: 32 }, keyboardShouldPersistTaps: 'handled' }, 
    // many tabs: the row scrolls sideways
    cats.length > 1 ? h(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, ...combos_1.COMBO_TAB_ROW_PROPS, style: { flexGrow: 0 }, contentContainerStyle: { paddingHorizontal: side, paddingVertical: 4, gap: 8, alignItems: 'center' } }, cats.map((c, i) => {
        const on = i === index;
        return h(Pressable, {
            key: c.key, accessibilityRole: 'button', accessibilityState: { selected: on }, accessibilityLabel: c.title, onPress: () => setSelected(c.key), hitSlop: combos_1.COMBO_TAB_HIT_SLOP,
            style: ({ pressed }) => ({ height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? (on ? '#FFE6A8' : '#E4E7EB') : on ? t.accentSoft : chipBg }),
        }, h(Text, { style: { fontSize: 14, fontWeight: '600', color: on ? t.accentText : t.sub } }, c.title));
    })) : null, 
    // the one line under the tabs (대표님 10/27 23:2x): the server's total, always worded 「다 하면 +N P」; a tab whose `total_points` the server sent as null (games,
    // shopping, free trials) has NO total line at all — the app never adds the rows up itself. The 무료체험 tab has its old cancel note instead.
    cat ? (sum
        ? h(View, { style: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: side, paddingTop: 14, paddingBottom: 6, gap: 6 } }, h(Text, { style: { fontSize: 13, color: t.sub } }, sum.total === 0 && sum.paid > 0 ? '모두 마쳤어요' : '다 하면'), sum.total === 0 && sum.paid > 0 ? null : h(Text, { style: { fontSize: 16, fontWeight: '800', color: t.point } }, `+${(0, combos_1.formatPoints)(sum.total)}`))
        : isTrialTab
            ? h(Text, { style: { paddingHorizontal: side, paddingTop: 14, paddingBottom: 6, fontSize: 13, lineHeight: 18, color: t.sub } }, combos_1.COMBO_TRIAL_NOTE)
            : h(View, { style: { height: 8 } })) : null, cat ? h(View, { key: cat.key }, visible.map(row)) : null, cat && rows.length > limit ? h(Pressable, {
        accessibilityRole: 'button', accessibilityLabel: `더 보기, ${rows.length - limit}개 남음`, onPress: () => setShown(s => ({ ...s, [cat.key]: limit + exports.COMBO_CATEGORY_PAGE })),
        style: ({ pressed }) => ({
            marginHorizontal: side, marginTop: 8, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? '#E9ECEF' : chipBg,
        }),
    }, h(Text, { style: { fontSize: 14, fontWeight: '700', color: t.sub } }, `더 보기 (${rows.length - limit}개 남음)`)) : null, !cat ? h(Text, { style: { marginTop: 48, fontSize: 15, lineHeight: 22, textAlign: 'center', color: t.sub } }, loading ? '불러오고 있어요' : '지금은 준비하고 있어요.\n잠시 뒤에 다시 확인해 주세요.') : null, cat ? h(Text, { style: { paddingHorizontal: side, paddingTop: 18, fontSize: 12, lineHeight: 18, color: t.sub } }, isTrialTab
        ? '무료체험은 기간이 끝나면 자동으로 결제돼요. 끝나기 전에 꼭 해지해 주세요.'
        : `${sum ? '합계는 돈이 들지 않는 항목을 모두 마쳤을 때 기준이에요. ' : ''}오늘 하루 기준이고 내일은 새로 바뀌어요. 항목마다 참여 조건이 달라서, 눌러서 안내를 꼭 확인해 주세요.`) : null, notice ? h(Text, { style: { paddingHorizontal: side, paddingTop: 10, fontSize: 14, fontWeight: '700', color: '#E5484D' } }, notice) : null));
}
