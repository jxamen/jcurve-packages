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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISMISS_MS = void 0;
exports.AttDeniedSheet = AttDeniedSheet;
const react_1 = __importStar(require("react"));
const attSheet_1 = require("./attSheet");
const DEFAULT_THEME = {
    background: '#ffffff',
    text: '#111111',
    subText: '#666666',
    primary: '#2563eb',
    primaryText: '#ffffff',
    overlay: 'rgba(0,0,0,0.4)',
};
/** 안내가 사라지는 동안(페이드) — 이 뒤에 시스템 창 · 오퍼월 화면을 올려야 iOS 가 겹쳐서 놓치지 않는다 */
exports.DISMISS_MS = 400;
function AttDeniedSheet({ theme, storage, primerTexts, deniedTexts }) {
    const [mode, setMode] = (0, react_1.useState)('none');
    // 열려 있는 동안 기다리는 쪽 — 사라지면 풀어 준다
    const pending = (0, react_1.useRef)(null);
    const rn = (0, attSheet_1.loadRN)();
    const ios = !!rn && String(rn?.Platform?.OS ?? '') === 'ios';
    const th = { ...DEFAULT_THEME, ...(theme ?? {}) };
    const pr = { ...attSheet_1.ATT_PRIMER_TEXTS, ...(primerTexts ?? {}) };
    const dn = { ...attSheet_1.ATT_DENIED_TEXTS, ...(deniedTexts ?? {}) };
    const h = react_1.default.createElement;
    const finish = () => {
        const f = pending.current;
        pending.current = null;
        try {
            f?.();
        }
        catch { /* noop */ }
    };
    /** 화면을 내리고, 사라진 뒤에 기다리던 쪽을 푼다 */
    const dismiss = () => {
        setMode('none');
        setTimeout(finish, exports.DISMISS_MS);
    };
    const open = (next, done) => {
        pending.current = done;
        setMode(next);
    };
    // 호출이 안내를 열 수 있게 등록한다 — 등록만 하고 스스로는 열지 않는다
    (0, react_1.useEffect)(() => {
        if (!ios)
            return;
        (0, attSheet_1.registerAttHost)({ primer: (done) => open('primer', done), denied: (done) => open('denied', done), storage });
        return () => { (0, attSheet_1.registerAttHost)(null); finish(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ios, storage]);
    if (!ios)
        return null;
    /** 설정 앱으로 간다 — 앱이 다시 앞으로 오면(또는 설정 앱으로 못 갔으면 잠시 뒤) 이어서 간다 */
    const openSettings = () => {
        setMode('none');
        try {
            void Promise.resolve(rn.Linking.openSettings()).catch(() => undefined);
        }
        catch { /* noop */ }
        void (0, attSheet_1.waitForReturn)(rn.AppState).then(finish);
    };
    // 가운데 카드 — 중립 안내와 같은 틀
    const card = (key, onRequestClose, ...children) => h(rn.Modal, { key, visible: mode === key, transparent: true, animationType: 'fade', onRequestClose }, h(rn.View, { style: { flex: 1, backgroundColor: th.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 } }, h(rn.View, { style: { width: '100%', maxWidth: 360, backgroundColor: th.background, borderRadius: 16, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16 } }, ...children)));
    const title = (text) => h(rn.Text, { style: { color: th.text, fontSize: 17, fontWeight: '700', lineHeight: 24 } }, text);
    const body = (text) => h(rn.Text, { style: { color: th.subText, fontSize: 14, marginTop: 10, lineHeight: 20 } }, text);
    // ① 중립 안내 — 버튼 하나. 닫기 · 뒤로가기로 건너뛸 수 없다(onRequestClose 는 아무것도 안 한다)
    const primer = card('primer', () => undefined, title(pr.title), body(pr.body), h(rn.TouchableOpacity, { onPress: dismiss, accessibilityRole: 'button', style: { marginTop: 18, backgroundColor: th.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' } }, h(rn.Text, { style: { color: th.primaryText, fontSize: 16, fontWeight: '700' } }, pr.button)));
    // ② 추적이 꺼져 있을 때 — 두 버튼은 같은 모양 · 같은 크기(한쪽으로 몰아가지 않는다)
    const choice = (label, onPress) => h(rn.TouchableOpacity, { key: label, onPress, accessibilityRole: 'button',
        style: { flex: 1, borderWidth: 1, borderColor: th.subText, borderRadius: 10, paddingVertical: 13, alignItems: 'center' } }, h(rn.Text, { style: { color: th.text, fontSize: 15, fontWeight: '700' } }, label));
    const denied = card('denied', dismiss, title(dn.title), body(dn.body), h(rn.View, { style: { flexDirection: 'row', gap: 10, marginTop: 18 } }, choice(dn.proceed, dismiss), choice(dn.openSettings, openSettings)));
    return h(react_1.default.Fragment, null, primer, denied);
}
