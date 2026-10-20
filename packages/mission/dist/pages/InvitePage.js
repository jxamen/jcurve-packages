"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitePage = InvitePage;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * 친구 초대 — 코드를 나누고, 받은 코드를 넣는다 (0.4.0, carrot InviteCard · InviteScreen 그대로).
 *
 * 문자 인증이 아니라 **간편 인증**이다(대표님 10-19 22:47 「문자 인증이 아니라 간편 인증이야」).
 * 자격이 없으면 코드를 내주지 않고 「간편 인증하기」 를 보인다 — 누르면 앱의 `onVerify` 가 간편 인증 창을 연다.
 * 지급 · 자격 판정은 서버 · 앱이 한다. 패키지는 값을 그리고 누름을 넘긴다.
 */
const react_1 = require("react");
const react_native_1 = require("react-native");
const PageFrame_1 = require("./PageFrame");
const logic_1 = require("./logic");
/** (0.4.14) 「넣기」 「링크 복사」 「카톡으로 공유하기」 — 세 단추 모양을 하나로 */
const BUTTON = { height: 48, fontSize: 15, radius: 12 };
const DEFAULT_NOTICE = [
    '보상은 초대받은 친구가 한 번 받아야 지급돼요',
    '가입만으로는 보상이 지급되지 않아요',
    '초대 코드는 한 사람이 한 번만 넣을 수 있어요',
    '가입하고 번호 인증을 마친 분만 초대할 수 있어요',
];
function InvitePage({ code, locked = false, lockReason = 'verify', onVerify, onSignup, verifying = false, inviterPoint, joined = false, rewarded = false, onJoin, onShare, onBack, swipeBack, notice = DEFAULT_NOTICE, title = '친구 초대하고', theme: themeIn, footer }) {
    const theme = (0, PageFrame_1.resolvePageTheme)(themeIn);
    const [value, setValue] = (0, react_1.useState)('');
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [message, setMessage] = (0, react_1.useState)('');
    const signup = lockReason === 'signup';
    const canJoin = !busy && value.trim() !== '';
    const join = async () => {
        if (!canJoin)
            return;
        setBusy(true);
        try {
            const r = await (0, logic_1.settleWithin)(Promise.resolve(onJoin(value.trim()))); // 서버가 안 돌아와도 잠금은 풀린다(0.4.3)
            if (!r) {
                setMessage('초대 코드를 넣지 못했어요');
                return;
            }
            setMessage(r.message ?? (r.ok ? '' : '초대 코드를 넣지 못했어요'));
            if (r.ok)
                setValue('');
        }
        catch {
            setMessage('초대 코드를 넣지 못했어요');
        }
        finally {
            setBusy(false);
        }
    };
    return (0, jsx_runtime_1.jsx)(PageFrame_1.PageFrame, { title: title, onBack: onBack, swipeBack: swipeBack, theme: theme, footer: footer, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.body, { backgroundColor: theme.card }], children: [theme.character != null ? (0, jsx_runtime_1.jsx)(react_native_1.View, { accessible: false, style: s.character, children: theme.character }) : null, (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.h1Hi, { color: theme.accent }], children: (0, logic_1.inviteHeadline)(inviterPoint) }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.sub, { color: theme.sub }], children: "\uCE5C\uAD6C\uAC00 \uCF54\uB4DC\uB97C \uB123\uACE0 \uD55C \uBC88 \uBC1B\uC73C\uBA74 \uB458 \uB2E4 \uBC1B\uC544\uC694" }), locked ? (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.lock, { backgroundColor: theme.accentSoft }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.lockTitle, { color: theme.text }], children: signup ? 'SNS로 가입하면 초대할 수 있어요' : '간편 인증하면 초대할 수 있어요' }), signup ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.lockBody, { color: theme.sub }], children: "\uD648 \uC624\uB978\uCABD \uC704 \uB0B4\uC815\uBCF4\uC5D0\uC11C \uAC00\uC785\uD560 \uC218 \uC788\uC5B4\uC694" }) : null, (0, jsx_runtime_1.jsx)(PageFrame_1.PageButton, { big: true, label: signup ? '가입하러 가기' : '간편 인증하기', theme: theme, disabled: verifying, on: true, onPress: () => { if (signup)
                                onSignup?.();
                            else
                                void onVerify(); } })] }) : (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.label, { color: theme.sub }], children: "\uB0B4 \uCD08\uB300 \uCF54\uB4DC" }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", onPress: onShare, style: ({ pressed }) => [s.codeBox, { backgroundColor: theme.accentSoft }, pressed && s.pressed], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.code, { color: theme.text }], children: code }) })] }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [s.notice, { backgroundColor: theme.bg }], children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.noticeTitle, { color: theme.text }], children: "\uCE5C\uAD6C \uCD08\uB300 \uC548\uB0B4\uC0AC\uD56D" }), notice.map(line => (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.bulletRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bullet, { color: theme.sub }], children: "\u2022" }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.bulletText, { color: theme.sub }], children: line })] }, line))] }), locked ? null : joined ? ((0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.joined, { color: theme.sub }], children: rewarded ? '초대 보상을 받았어요' : '한 번 받으면 초대 보상을 받아요' })) : (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.enter, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.section, { color: theme.text }], children: "\uBC1B\uC740 \uCF54\uB4DC \uB123\uAE30" }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.joinRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.TextInput, { value: value, onChangeText: v => setValue((0, logic_1.normalizeInviteCode)(v)), placeholder: "\uBC1B\uC740 \uCF54\uB4DC \uB123\uAE30", placeholderTextColor: theme.sub, autoCapitalize: "characters", style: [s.input, { color: theme.text, borderColor: theme.line, backgroundColor: theme.bg }] }), (0, jsx_runtime_1.jsx)(PageFrame_1.PageButton, { label: "\uB123\uAE30", theme: theme, height: BUTTON.height, fontSize: BUTTON.fontSize, radius: BUTTON.radius, disabled: !canJoin, on: true, onPress: () => { void join(); } })] }), message ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { accessibilityLiveRegion: "polite", style: [s.message, { color: theme.sub }], children: message }) : null] }), locked ? null : (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.shareRow, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.grow, children: (0, jsx_runtime_1.jsx)(PageFrame_1.PageButton, { label: "\uB9C1\uD06C \uBCF5\uC0AC", theme: theme, big: true, height: BUTTON.height, fontSize: BUTTON.fontSize, radius: BUTTON.radius, on: false, onPress: onShare }) }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.grow, children: (0, jsx_runtime_1.jsx)(PageFrame_1.PageButton, { label: "\uCE74\uD1A1\uC73C\uB85C \uACF5\uC720\uD558\uAE30", theme: theme, big: true, height: BUTTON.height, fontSize: BUTTON.fontSize, radius: BUTTON.radius, on: true, onPress: onShare }) })] })] }) });
}
const s = react_native_1.StyleSheet.create({
    body: { borderRadius: 20, padding: 20, gap: 10 },
    character: { alignSelf: 'center' },
    h1Hi: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
    sub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
    lock: { borderRadius: 16, padding: 16, gap: 10, alignItems: 'center' },
    lockTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
    lockBody: { fontSize: 13, textAlign: 'center' },
    label: { fontSize: 13, fontWeight: '700' },
    codeBox: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    code: { fontSize: 22, fontWeight: '800', letterSpacing: 2 },
    pressed: { opacity: 0.8 },
    section: { fontSize: 15, fontWeight: '800', marginTop: 6 },
    notice: { borderRadius: 14, padding: 14, gap: 6 },
    noticeTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
    bulletRow: { flexDirection: 'row', gap: 6 },
    bullet: { fontSize: 12, lineHeight: 18 },
    bulletText: { flex: 1, fontSize: 12, lineHeight: 18 },
    joined: { fontSize: 13, textAlign: 'center', marginTop: 4 },
    enter: { gap: 8 },
    joinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: { flex: 1, height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 15 },
    message: { fontSize: 12, textAlign: 'center' },
    shareRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    grow: { flex: 1 },
});
