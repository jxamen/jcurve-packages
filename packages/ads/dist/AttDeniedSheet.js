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
/** 안내가 사라지는 동안(페이드 · 슬라이드) — 이 뒤에 시스템 창 · 오퍼월 화면을 올려야 iOS 가 겹쳐서 놓치지 않는다 */
exports.DISMISS_MS = 400;
function AttDeniedSheet({ appName, theme, texts, primerTexts }) {
    const [mode, setMode] = (0, react_1.useState)('none');
    // 열려 있는 동안 기다리는 쪽 — 사라지면 풀어 준다
    const pending = (0, react_1.useRef)(null);
    // 「설정에서 허용하기」를 누르고 설정 앱에 가 있는 동안 — 돌아오면 다시 확인한다
    const awaitingSettings = (0, react_1.useRef)(false);
    const rn = (0, attSheet_1.loadRN)();
    const ios = !!rn && String(rn?.Platform?.OS ?? '') === 'ios';
    const th = { ...DEFAULT_THEME, ...(theme ?? {}) };
    const tx = (0, attSheet_1.attSheetTexts)(appName, texts);
    const pr = { ...attSheet_1.ATT_PRIMER_TEXTS, ...(primerTexts ?? {}) };
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
        awaitingSettings.current = false;
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
        (0, attSheet_1.registerAttHost)({ primer: (done) => open('primer', done), sheet: (done) => open('sheet', done) });
        return () => { (0, attSheet_1.registerAttHost)(null); finish(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ios]);
    // 설정에서 돌아왔을 때 허용됐으면 닫는다(단계 시트)
    (0, react_1.useEffect)(() => {
        if (!ios)
            return;
        const AppState = rn?.AppState;
        if (!AppState || typeof AppState.addEventListener !== 'function')
            return;
        const tracking = (0, attSheet_1.loadTracking)();
        const sub = AppState.addEventListener('change', (s) => {
            if (s !== 'active' || !awaitingSettings.current || !tracking)
                return;
            void (0, attSheet_1.readStatus)(tracking).then((st) => { if (st === 'granted')
                dismiss(); }).catch(() => undefined);
        });
        return () => { try {
            sub?.remove?.();
        }
        catch { /* noop */ } };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ios]);
    if (!ios)
        return null;
    const openSettings = () => {
        awaitingSettings.current = true;
        try {
            void Promise.resolve(rn.Linking.openSettings()).catch(() => undefined);
        }
        catch { /* noop */ }
    };
    const stepRow = (text, i) => h(rn.View, { key: String(i), style: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 } }, h(rn.View, { style: { width: 22, height: 22, borderRadius: 11, backgroundColor: th.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 } }, h(rn.Text, { style: { color: th.primaryText, fontSize: 12, fontWeight: '700' } }, String(i + 1))), h(rn.Text, { style: { flex: 1, color: th.text, fontSize: 15, lineHeight: 21 } }, text));
    // ① 중립 안내 — 가운데 카드, 버튼 하나. 닫기 · 뒤로가기로 건너뛸 수 없다(onRequestClose 는 아무것도 안 한다)
    const primer = h(rn.Modal, { key: 'primer', visible: mode === 'primer', transparent: true, animationType: 'fade', onRequestClose: () => undefined }, h(rn.View, { style: { flex: 1, backgroundColor: th.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 } }, h(rn.View, { style: { width: '100%', maxWidth: 360, backgroundColor: th.background, borderRadius: 16, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16 } }, h(rn.Text, { style: { color: th.text, fontSize: 17, fontWeight: '700', lineHeight: 24 } }, pr.title), h(rn.Text, { style: { color: th.subText, fontSize: 14, marginTop: 10, lineHeight: 20 } }, pr.body), h(rn.TouchableOpacity, { onPress: dismiss, accessibilityRole: 'button', style: { marginTop: 18, backgroundColor: th.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' } }, h(rn.Text, { style: { color: th.primaryText, fontSize: 16, fontWeight: '700' } }, pr.button)))));
    // ② 거부 · 제한 단계 시트
    const sheet = h(rn.Modal, { key: 'sheet', visible: mode === 'sheet', transparent: true, animationType: 'slide', onRequestClose: dismiss }, h(rn.View, { style: { flex: 1, backgroundColor: th.overlay, justifyContent: 'flex-end' } }, h(rn.View, { style: { backgroundColor: th.background, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30 } }, h(rn.Text, { style: { color: th.text, fontSize: 18, fontWeight: '700', lineHeight: 25 } }, tx.title), tx.body ? h(rn.Text, { style: { color: th.subText, fontSize: 14, marginTop: 8, lineHeight: 20 } }, tx.body) : null, ...tx.steps.map((s, i) => stepRow(s, i)), h(rn.Text, { style: { color: th.text, fontSize: 14, marginTop: 16, lineHeight: 20 } }, tx.guide), h(rn.Text, { style: { color: th.subText, fontSize: 12, marginTop: 8, lineHeight: 17 } }, tx.fallback), h(rn.TouchableOpacity, { onPress: openSettings, accessibilityRole: 'button', style: { marginTop: 18, backgroundColor: th.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' } }, h(rn.Text, { style: { color: th.primaryText, fontSize: 16, fontWeight: '700' } }, tx.openSettings)), h(rn.TouchableOpacity, { onPress: dismiss, accessibilityRole: 'button', style: { marginTop: 8, paddingVertical: 12, alignItems: 'center' } }, h(rn.Text, { style: { color: th.subText, fontSize: 15 } }, tx.later)))));
    return h(react_1.default.Fragment, null, primer, sheet);
}
