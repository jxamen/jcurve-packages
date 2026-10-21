"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCoupangVisit = useCoupangVisit;
const react_1 = require("react");
const react_native_1 = require("react-native");
const coupang_1 = require("./coupang");
function useCoupangVisit(request, refreshKey) {
    const [result, setResult] = (0, react_1.useState)(null);
    const [toast, setToast] = (0, react_1.useState)(null);
    const visit = (0, react_1.useMemo)(() => new coupang_1.CoupangVisit(request, url => react_native_1.Linking.openURL(url), status => setResult({ owner: visit, status }), message => setToast({ owner: visit, message })), [request]);
    (0, react_1.useEffect)(() => {
        visit.activate();
        const sub = react_native_1.AppState.addEventListener('change', state => { void visit.appState(state); });
        return () => { sub.remove(); visit.dispose(); };
    }, [visit]);
    (0, react_1.useEffect)(() => { void visit.refresh(); }, [visit, refreshKey]);
    (0, react_1.useEffect)(() => {
        if (!toast)
            return;
        const timer = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(timer);
    }, [toast]);
    const status = result?.owner === visit ? result.status : (0, coupang_1.parseCoupangStatus)(null);
    return { status, visible: (0, coupang_1.coupangVisible)(status), start: () => { void visit.start(); }, toast: toast?.owner === visit ? toast.message : null };
}
