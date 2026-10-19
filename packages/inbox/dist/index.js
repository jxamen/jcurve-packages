"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InboxScreen = InboxScreen;
exports.BellDot = BellDot;
exports.useInboxUnread = useInboxUnread;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const core_1 = require("./core");
__exportStar(require("./core"), exports);
function InboxScreen({ api, theme, strings, onOpen, onBack, topInset = 0, isFocused = true }) {
    const t = { ...core_1.defaultTheme, ...theme }, s = { ...core_1.defaultStrings, ...strings };
    const store = (0, react_1.useMemo)(() => (0, core_1.createInboxStore)(api), [api]);
    const state = (0, react_1.useSyncExternalStore)(store.subscribe, store.getSnapshot, store.getSnapshot);
    (0, react_1.useEffect)(() => { void store.load(); }, [store]);
    (0, react_1.useEffect)(() => () => store.leave(), [store]);
    (0, react_1.useEffect)(() => { if (!isFocused)
        store.leave(); }, [store, isFocused]);
    const retry = (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", onPress: () => void store.load(), style: { padding: 24, alignItems: 'center' }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { color: t.sub }, children: s.error }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { color: t.primary, marginTop: 8 }, children: s.retry })] });
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flex: 1, backgroundColor: t.bg, paddingTop: topInset }, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: t.line, padding: 16 }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", onPress: () => { store.leave(); onBack?.(); }, hitSlop: 8, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { color: t.primary }, children: s.back }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { accessibilityRole: "header", style: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: t.text }, children: s.title }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { width: 28 } })] }), (0, jsx_runtime_1.jsx)(react_native_1.FlatList, { data: state.items, keyExtractor: item => String(item.id), refreshing: state.loading && state.items.length > 0, onRefresh: () => void store.load(), onEndReached: () => void store.load(true), onEndReachedThreshold: 0.3, ListEmptyComponent: state.error ? retry : !state.loading ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { color: t.sub, textAlign: 'center', padding: 48 }, children: s.empty }) : (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { color: t.sub, padding: 24 }, children: "\u2026" }), ListFooterComponent: state.error && state.items.length > 0 ? retry : null, renderItem: ({ item }) => (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityState: { expanded: state.expanded.includes(item.id) }, onPress: () => store.press(item, onOpen), style: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: t.radius, backgroundColor: t.card }, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { flexDirection: 'row', alignItems: 'center', gap: 8 }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { flex: 1, color: t.text, fontWeight: '700', fontSize: 16 }, children: item.title }), item.kind === 'ad' && (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { backgroundColor: t.adBadgeBg, color: t.adBadgeText, fontSize: 11, paddingHorizontal: 5, borderRadius: 3 }, children: s.ad })] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { numberOfLines: state.expanded.includes(item.id) ? undefined : 2, style: { color: t.sub, marginTop: 8, lineHeight: 20 }, children: item.body }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { color: t.sub, fontSize: 12, marginTop: 10 }, children: (0, core_1.relativeTime)(item.sentAt, new Date(), s) })] }) })] });
}
function BellDot({ count }) {
    return count > 0 ? (0, jsx_runtime_1.jsx)(react_native_1.View, { accessibilityLabel: String(count), style: { position: 'absolute', top: 0, right: 0, width: 6, height: 6, borderRadius: 3, backgroundColor: core_1.defaultTheme.unreadDot } }) : null;
}
function useInboxUnread(api, { refreshKey } = {}) {
    const [count, setCount] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => {
        let disposed = false, request = 0;
        const refresh = async () => { const id = ++request; try {
            const next = await api.unread();
            if (!disposed && id === request)
                setCount(next);
        }
        catch { /* Keep previous count. */ } };
        void refresh();
        const subscription = react_native_1.AppState.addEventListener('change', state => { if (state === 'active')
            void refresh(); });
        return () => { disposed = true; subscription.remove(); };
    }, [api, refreshKey]);
    return count;
}
