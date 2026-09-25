"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppHubSheet = AppHubSheet;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * 「앱 모아보기」 — 계열 앱을 한 줄씩 보여 주고, 누르면 그 기기의 스토어로 보낸다.
 *
 * **이 화면이 패키지에 들어 있는 이유**: 앱마다 따로 만들면 앱마다 다른 말을 하게 된다
 * (2026-09-20 지시: 「이걸 다른 앱에도 다 넣을 거니까 패키지 형태로 만들어 줘, 누르면
 * 나오는 내용이 같게끔」). 들어가는 입구(하단 버튼)는 앱마다 그 앱답게 따로 달고,
 * **눌러서 나오는 내용은 여기 한 곳에서만 고친다.**
 *
 * 목록의 원본은 어드민 「앱관리」다 — 서버가 `{base}/family` 로 내준다. 그래서 새 앱이
 * 늘어도 어느 앱도 다시 빌드하지 않는다.
 *
 * 색만 앱에서 받는다(`theme`). 문구 · 순서 · 동작은 받지 않는다 — 그걸 열어 두면 앱마다
 * 달라지고, 이 패키지를 만든 이유가 없어진다.
 */
const react_1 = require("react");
const react_native_1 = require("react-native");
const pick_1 = require("./pick");
const load_1 = require("./load");
const DEF = {
    bg: '#F6F7F9',
    card: '#FFFFFF',
    line: '#ECEEF1',
    text: '#191F28',
    sub: '#8B95A1',
    dim: '#C4CBD4',
    accent: '#2C6BE8',
    accentSoft: '#E8F0FF',
};
function AppHubSheet({ open, onClose, base, token, load, theme, items, section, onEvent }) {
    const t = { ...DEF, ...(theme ?? {}) };
    const s = styles(t);
    const [rows, setRows] = (0, react_1.useState)(null);
    const [failed, setFailed] = (0, react_1.useState)(false);
    const fetchRows = (0, react_1.useCallback)(async () => {
        setFailed(false);
        if (items) {
            setRows((0, pick_1.familyRows)(items, react_native_1.Platform.OS));
            return;
        }
        const loader = load ?? (base ? (0, load_1.storeLoader)({ base, token }) : null);
        if (!loader) {
            setFailed(true);
            return;
        }
        try {
            const items = await loader();
            setRows((0, pick_1.familyRows)(items, react_native_1.Platform.OS));
        }
        catch {
            /* 「없다」가 아니라 「못 불러왔다」 — 다시 눌러 볼 수 있게 남긴다 */
            setFailed(true);
        }
    }, [base, token, load, items]);
    (0, react_1.useEffect)(() => {
        if (!open)
            return;
        setRows(null);
        void fetchRows();
        onEvent?.('apphub_open');
        // onEvent 는 매번 새 함수로 올 수 있어 의존성에서 뺀다 — 열 때 한 번이면 된다
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, fetchRows]);
    const go = (0, react_1.useCallback)((row) => {
        if (!row.url)
            return;
        onEvent?.('apphub_tap', { slug: row.slug });
        void react_native_1.Linking.openURL(row.url).catch(() => { });
    }, [onEvent]);
    if (!open)
        return null;
    return ((0, jsx_runtime_1.jsx)(react_native_1.Modal, { animationType: "slide", visible: true, onRequestClose: onClose, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.page, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.head, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: onClose, hitSlop: 12, style: s.close, accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.closeMark, children: "\u2715" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.headTitle, children: "\uC571 \uBAA8\uC544\uBCF4\uAE30" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.close })] }), (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { contentContainerStyle: s.body, showsVerticalScrollIndicator: false, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.intro, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.introTitle, children: section?.title ?? '추천 앱' }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.introBody, children: section?.desc ?? '받아서 시작하면 그 앱에서도 포인트를 모을 수 있어요\n포인트는 앱마다 따로 쌓여요' })] }), rows === null && !failed ? ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.center, children: (0, jsx_runtime_1.jsx)(react_native_1.ActivityIndicator, { color: t.accent }) })) : failed ? ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.center, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.emptyTitle, children: "\uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC5B4\uC694" }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => { void fetchRows(); }, style: s.retry, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.retryText, children: "\uB2E4\uC2DC \uC2DC\uB3C4" }) })] })) : rows && rows.length === 0 ? ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.center, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.emptyTitle, children: "\uC544\uC9C1 \uBCF4\uC5EC \uB4DC\uB9B4 \uC571\uC774 \uC5C6\uC5B4\uC694" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.emptyBody, children: "\uC0C8 \uC571\uC774 \uB098\uC624\uBA74 \uC5EC\uAE30\uC5D0 \uB098\uC640\uC694" })] })) : ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.card, children: (rows ?? []).map((r, i) => ((0, jsx_runtime_1.jsxs)(react_native_1.View, { children: [i > 0 ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.hr }) : null, (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { onPress: () => go(r), accessibilityRole: "button", accessibilityLabel: r.name + ', 받으러 가기', style: ({ pressed }) => [s.row, pressed ? s.pressed : null], children: [r.icon
                                                ? (0, jsx_runtime_1.jsx)(react_native_1.Image, { source: { uri: r.icon }, style: s.icon })
                                                : ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.icon, s.initialBox, { backgroundColor: r.tint }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.initial, children: r.initial }) })), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.texts, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.name, numberOfLines: 1, children: r.name }), r.desc ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.desc, numberOfLines: 1, children: r.desc }) : null] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.go, children: "\u203A" })] })] }, r.slug))) })), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: s.foot, children: "\uC2A4\uD1A0\uC5B4\uB85C \uC774\uB3D9\uD574\uC694. \uBC1B\uB294 \uAC83\uC740 \uBB34\uB8CC\uC608\uC694" }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: { height: 32 } })] })] }) }));
}
const styles = (t) => react_native_1.StyleSheet.create({
    page: { flex: 1, backgroundColor: t.bg },
    head: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: t.card,
        borderBottomWidth: 1, borderBottomColor: t.line,
    },
    close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    closeMark: { fontSize: 20, fontWeight: '700', color: t.text },
    headTitle: { fontSize: 17, fontWeight: '800', color: t.text },
    body: { padding: 16, gap: 12 },
    intro: { gap: 4, paddingHorizontal: 4, paddingTop: 4 },
    introTitle: { fontSize: 18, fontWeight: '900', color: t.text },
    introBody: { fontSize: 13.5, color: t.sub, lineHeight: 20 },
    card: { backgroundColor: t.card, borderRadius: 18, overflow: 'hidden' },
    hr: { height: 1, backgroundColor: t.line, marginLeft: 68 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
    pressed: { opacity: 0.7 },
    icon: { width: 40, height: 40, borderRadius: 12 },
    initialBox: { alignItems: 'center', justifyContent: 'center' },
    initial: { fontSize: 19, fontWeight: '900', color: '#FFFFFF' },
    /* 이름과 소개를 한 덩어리로 — 오른쪽 알약이 자리를 먼저 가져가고 남은 폭을 글이 쓴다 */
    texts: { flex: 1, gap: 2 },
    name: { fontSize: 15.5, fontWeight: '800', color: t.text },
    desc: { fontSize: 12.5, color: t.sub },
    go: { fontSize: 20, fontWeight: '700', color: t.dim, marginLeft: 4 },
    center: { alignItems: 'center', gap: 8, paddingVertical: 48 },
    emptyTitle: { fontSize: 15.5, fontWeight: '800', color: t.text },
    emptyBody: { fontSize: 13.5, color: t.sub },
    retry: { marginTop: 8, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: t.accentSoft },
    retryText: { fontSize: 13.5, fontWeight: '800', color: t.accent },
    foot: { fontSize: 12, color: t.dim, textAlign: 'center', marginTop: 4 },
});
