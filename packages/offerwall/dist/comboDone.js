"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_DONE_KEYS = exports.doneStorageKey = void 0;
exports.parseDone = parseDone;
exports.resetDoneMemory = resetDoneMemory;
exports.useDoneMissions = useDoneMissions;
/**
 * Which combo missions the user ticked as done by hand: kept on the device, per member, per campaign key, and NOT reset when the
 * day changes (대표님 10/27 「날이 바뀌어도 한 거 안 한 거 알아야 하니까」). The server's own `done` list (what was really paid) is separate
 * and shown on its own; these are only the member's own ticks, and a tick can be tapped again to undo it.
 */
const combos_1 = require("./combos");
const doneStorageKey = (scope) => `jcurve.combos.done:${scope ?? ''}`;
exports.doneStorageKey = doneStorageKey;
/** Most keys kept per member; the oldest ticks drop out first. */
exports.MAX_DONE_KEYS = 1000;
/**
 * Keys stored for a member. Reads the field `ids` (written by this and by earlier versions) or `keys`; the day written in `d` is not
 * a limit any more. Broken JSON or the wrong shape mean "nothing done".
 */
function parseDone(value) {
    try {
        const v = JSON.parse(value ?? 'null');
        const list = Array.isArray(v?.ids) ? v.ids : Array.isArray(v?.keys) ? v.keys : [];
        const keys = list.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 64);
        return [...new Set(keys)].slice(-exports.MAX_DONE_KEYS);
    }
    catch { /* nothing stored, or not ours */ }
    return [];
}
// Without `storage` the ticks live until the app is closed (and survive leaving and entering the tab).
const memory = new Map();
/** Test helper: forget the in-memory ticks. */
function resetDoneMemory() { memory.clear(); }
/**
 * `scope` = member (a different member on the same phone has their own ticks). Written as `{ d, ids }` so an older version
 * of this package can still read it after a rollback.
 */
function useDoneMissions({ storage, scope }) {
    const React = require('react');
    const scopeKey = String(scope ?? '');
    const [state, setState] = React.useState(() => ({ scope: scopeKey, ids: storage ? [] : memory.get(scopeKey) ?? [] }));
    React.useEffect(() => {
        if (!storage) {
            setState({ scope: scopeKey, ids: memory.get(scopeKey) ?? [] });
            return;
        }
        let live = true;
        Promise.resolve(storage.getItem((0, exports.doneStorageKey)(scope))).then(value => {
            const stored = parseDone(value);
            // Ticks made while this was loading are kept.
            if (live)
                setState(prev => ({ scope: scopeKey, ids: [...new Set([...stored, ...(prev.scope === scopeKey ? prev.ids : [])])].slice(-exports.MAX_DONE_KEYS) }));
        }).catch(() => { });
        return () => { live = false; };
    }, [scopeKey, storage]);
    const ids = state.scope === scopeKey ? state.ids : (storage ? [] : memory.get(scopeKey) ?? []);
    const toggle = (key) => {
        const next = (ids.includes(key) ? ids.filter(x => x !== key) : [...ids, key]).slice(-exports.MAX_DONE_KEYS);
        memory.set(scopeKey, next);
        setState({ scope: scopeKey, ids: next });
        try {
            Promise.resolve(storage?.setItem((0, exports.doneStorageKey)(scope), JSON.stringify({ d: (0, combos_1.kstDate)(), ids: next }))).catch(() => { });
        }
        catch { /* storage is best effort */ }
    };
    return { done: new Set(ids), toggle };
}
