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
/** 앱이 앞에 올라온 뒤 잠깐 — 첫 화면이 그려지기 전에 시스템 창이 뜨면 뒤가 빈 화면이다(ads.ts 와 같은 0.6초) */
const SETTLE_MS = 600;
function whenActive(rn) {
    return new Promise((resolve) => {
        const st = rn?.AppState;
        if (!st || st.currentState === 'active') {
            resolve();
            return;
        }
        let sub = null;
        try {
            sub = st.addEventListener('change', (s) => {
                if (s !== 'active')
                    return;
                try {
                    sub?.remove();
                }
                catch { /* noop */ }
                resolve();
            });
        }
        catch {
            resolve();
        }
    }).then(() => new Promise((r) => setTimeout(r, SETTLE_MS)));
}
function AttDeniedSheet({ appName, theme, storage, texts }) {
    const [visible, setVisible] = (0, react_1.useState)(false);
    // 시트가 열린 동안 기다리는 오퍼월 호출들 — 닫히면 한꺼번에 풀린다
    const waiters = (0, react_1.useRef)([]);
    // 「설정에서 허용하기」를 누르고 설정 앱에 가 있는 동안 — 돌아오면 다시 확인한다
    const awaitingSettings = (0, react_1.useRef)(false);
    const rn = (0, attSheet_1.loadRN)();
    const ios = !!rn && String(rn?.Platform?.OS ?? '') === 'ios';
    const th = { ...DEFAULT_THEME, ...(theme ?? {}) };
    const tx = (0, attSheet_1.attSheetTexts)(appName, texts);
    const h = react_1.default.createElement;
    const close = () => {
        awaitingSettings.current = false;
        setVisible(false);
        const ws = waiters.current;
        waiters.current = [];
        ws.forEach((f) => { try {
            f();
        }
        catch { /* noop */ } });
    };
    const open = (done) => {
        if (done)
            waiters.current.push(done);
        setVisible(true);
    };
    // 켤 때 한 번 — 거부·제한이면 시트(하루 한 번), 미정이면 시스템 창
    (0, react_1.useEffect)(() => {
        if (!ios)
            return;
        let alive = true;
        void (0, attSheet_1.launchCheck)({
            os: 'ios',
            tracking: (0, attSheet_1.loadTracking)(),
            storage: storage ?? attSheet_1.memoryStorage,
            today: () => (0, attSheet_1.localDay)(new Date()),
            beforeRequest: () => whenActive(rn),
        }).then((action) => { if (alive && action === 'show')
            open(); }).catch(() => undefined);
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ios]);
    // 오퍼월 호출이 시트를 열 수 있게 등록한다
    (0, react_1.useEffect)(() => {
        if (!ios)
            return;
        (0, attSheet_1.setAttSheetOpener)((done) => open(done));
        return () => { (0, attSheet_1.setAttSheetOpener)(null); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ios]);
    // 설정에서 돌아왔을 때 허용됐으면 닫는다
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
                close(); }).catch(() => undefined);
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
    return h(rn.Modal, { visible, transparent: true, animationType: 'slide', onRequestClose: close }, h(rn.View, { style: { flex: 1, backgroundColor: th.overlay, justifyContent: 'flex-end' } }, h(rn.View, { style: { backgroundColor: th.background, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30 } }, h(rn.Text, { style: { color: th.text, fontSize: 18, fontWeight: '700' } }, tx.title), h(rn.Text, { style: { color: th.subText, fontSize: 14, marginTop: 8, lineHeight: 20 } }, tx.body), ...tx.steps.map((s, i) => stepRow(s, i)), h(rn.Text, { style: { color: th.text, fontSize: 14, marginTop: 16, lineHeight: 20 } }, tx.guide), h(rn.Text, { style: { color: th.subText, fontSize: 12, marginTop: 8, lineHeight: 17 } }, tx.fallback), h(rn.TouchableOpacity, { onPress: openSettings, accessibilityRole: 'button', style: { marginTop: 18, backgroundColor: th.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' } }, h(rn.Text, { style: { color: th.primaryText, fontSize: 16, fontWeight: '700' } }, tx.openSettings)), h(rn.TouchableOpacity, { onPress: close, accessibilityRole: 'button', style: { marginTop: 8, paddingVertical: 12, alignItems: 'center' } }, h(rn.Text, { style: { color: th.subText, fontSize: 15 } }, tx.later)))));
}
