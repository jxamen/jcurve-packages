"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doneStorageKey = void 0;
exports.parseDone = parseDone;
exports.useDoneMissions = useDoneMissions;
/** Which combo missions the user ticked as done: kept on the device for one Korean day, per member. */
const combos_1 = require("./combos");
const doneStorageKey = (scope) => `jcurve.combos.done:${scope ?? ''}`;
exports.doneStorageKey = doneStorageKey;
/** Ids stored for exactly this day; another day, broken JSON or the wrong shape mean "nothing done". */
function parseDone(value, date) {
    try {
        const v = JSON.parse(value ?? 'null');
        if (v && v.d === date && Array.isArray(v.ids))
            return v.ids.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 64).slice(0, 200);
    }
    catch { /* nothing stored, or not ours */ }
    return [];
}
/**
 * `scope` = member (a different member on the same phone has their own marks); `date` = the combos' day, so a new day
 * starts empty. Without `storage` the marks only live until the app is closed.
 */
function useDoneMissions({ storage, scope, date }) {
    const React = require('react');
    const day = date ?? (0, combos_1.kstDate)();
    const key = `${scope ?? ''}|${day}`;
    const [state, setState] = React.useState({ key, ids: [] });
    React.useEffect(() => {
        if (!storage)
            return;
        let live = true;
        Promise.resolve(storage.getItem((0, exports.doneStorageKey)(scope))).then(value => {
            const stored = parseDone(value, day);
            // Ticks made while this was loading are kept.
            if (live)
                setState(prev => ({ key, ids: [...new Set([...stored, ...(prev.key === key ? prev.ids : [])])] }));
        }).catch(() => { });
        return () => { live = false; };
    }, [key, storage]);
    const ids = state.key === key ? state.ids : [];
    const toggle = (id) => {
        const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
        setState({ key, ids: next });
        try {
            Promise.resolve(storage?.setItem((0, exports.doneStorageKey)(scope), JSON.stringify({ d: day, ids: next }))).catch(() => { });
        }
        catch { /* storage is best effort */ }
    };
    return { done: new Set(ids), toggle };
}
