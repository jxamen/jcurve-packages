"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNewspicUrl = isNewspicUrl;
exports.parseNewspicFeed = parseNewspicFeed;
exports.NewspicSection = NewspicSection;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
function isNewspicUrl(value) {
    if (typeof value !== 'string' || value.length > 2048 || /[\s\\\x00-\x1f\x7f]/.test(value))
        return false;
    try {
        const u = new URL(value);
        return u.protocol === 'https:' && !u.username && !u.password && !u.port
            && (u.hostname === 'newspic.kr' || u.hostname.endsWith('.newspic.kr'));
    }
    catch {
        return false;
    }
}
function parseNewspicFeed(value) {
    const v = value;
    if (!v || v.ok !== true || v.enabled !== true || v.mode !== 'shared_links' || !Array.isArray(v.items))
        return null;
    if (v.status === 'configuration_required' && v.items.length === 0)
        return { items: [], message: '설정 필요' };
    if (v.status !== 'ok')
        return null;
    const items = v.items.slice(0, 20).filter((r) => r && typeof r.id === 'string'
        && typeof r.title === 'string' && !!r.title.trim() && r.title.length <= 200
        && typeof r.source === 'string' && !!r.source.trim() && r.source.length <= 200
        && (r.thumbnail === '' || isNewspicUrl(r.thumbnail)) && isNewspicUrl(r.url));
    return items.length ? { items, message: '' } : null;
}
/** Metadata only. Articles open exclusively from the user's press in an external browser. */
function NewspicSection({ fetchJson, refreshKey }) {
    const [active, setActive] = (0, react_1.useState)(react_native_1.AppState.currentState == null || react_native_1.AppState.currentState === 'active');
    const [tick, setTick] = (0, react_1.useState)(0);
    const [result, setResult] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        const sub = react_native_1.AppState.addEventListener('change', state => {
            setActive(state === 'active');
            setResult(null);
            if (state === 'active')
                setTick(n => n + 1);
        });
        return () => sub.remove();
    }, []);
    (0, react_1.useEffect)(() => {
        let live = true;
        setResult(null);
        if (active) {
            Promise.resolve().then(() => fetchJson('newspic/feed')).then(value => {
                const feed = parseNewspicFeed(value);
                if (live)
                    setResult(feed ? { owner: fetchJson, feed } : null);
            }).catch(() => { if (live)
                setResult(null); });
        }
        return () => { live = false; };
    }, [fetchJson, refreshKey, active, tick]);
    if (!active || !result || result.owner !== fetchJson)
        return null;
    return (0, jsx_runtime_1.jsxs)(react_native_1.View, { testID: "newspic-section", style: styles.section, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.disclosure, children: "\uAD11\uACE0 \u00B7 \uC81C\uD734" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.heading, children: "\uC77D\uC744\uAC70\uB9AC" }), result.feed.message ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { children: result.feed.message }) : null, result.feed.items.map(item => (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "link", accessibilityLabel: item.title, onPress: () => { if (isNewspicUrl(item.url))
                    void react_native_1.Linking.openURL(item.url).catch(() => { }); }, style: styles.item, children: [item.thumbnail ? (0, jsx_runtime_1.jsx)(react_native_1.Image, { source: { uri: item.thumbnail }, style: styles.thumbnail, accessible: false }) : null, (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.copy, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.title, children: item.title }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.source, children: item.source })] })] }, item.id))] });
}
const styles = react_native_1.StyleSheet.create({
    // Reserve more than a complete benefit row above AND below, including external ad siblings.
    section: { marginVertical: 80, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', gap: 10 },
    disclosure: { fontSize: 12, lineHeight: 18, color: '#6B5E52' },
    heading: { fontSize: 19, fontWeight: '700', color: '#2B2118' },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    thumbnail: { width: 84, height: 64, borderRadius: 8 },
    copy: { flex: 1, gap: 6 }, title: { fontSize: 16, color: '#2B2118' }, source: { fontSize: 12, color: '#6B5E52' },
});
