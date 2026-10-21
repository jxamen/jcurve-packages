"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureOfferwallFunnel = configureOfferwallFunnel;
exports.resetOfferwallFunnelContext = resetOfferwallFunnelContext;
exports.setOfferwallFunnelContext = setOfferwallFunnelContext;
exports.createChanceFunnel = createChanceFunnel;
exports.useChanceFunnel = useChanceFunnel;
let send;
let context = { tester: 'unknown', visibility: 'unknown' };
function configureOfferwallFunnel(sender) { send = sender; }
function resetOfferwallFunnelContext() { context = { tester: 'unknown', visibility: 'unknown' }; }
/** Compare locally, retain only a boolean category and public tokens, never the list or member ID. */
function setOfferwallFunnelContext(value, memberId) {
    if (typeof value !== 'string' && typeof value !== 'number') {
        resetOfferwallFunnelContext();
        return;
    }
    const tokens = String(value).split(/[\s,;]+/).filter(Boolean);
    const id = memberId == null ? '' : String(memberId);
    context = {
        tester: id && /^\d+$/.test(id) ? (tokens.includes(id) ? 'test' : 'user') : 'unknown',
        visibility: tokens.includes('*') ? 'all' : tokens.includes('*android') && tokens.includes('*ios') ? 'both'
            : tokens.includes('*android') ? 'android' : tokens.includes('*ios') ? 'ios'
                : tokens.some(t => /^\d+$/.test(t)) ? 'list' : 'off',
    };
}
/** One terminal open result per SDK invocation; duplicate native callbacks are ignored. */
function createChanceFunnel(sender = send) {
    let entered = false, closed = false;
    const pending = new Set();
    const emit = (name, status) => {
        try {
            Promise.resolve(sender?.(name, `${status}:${context.tester}:${context.visibility}`)).catch(() => { });
        }
        catch { /* UI must continue */ }
    };
    return {
        enter() { if (!entered && !closed) {
            entered = true;
            emit('chance_tab_open', 'shown');
        } },
        begin(platform) {
            let done = closed;
            let timer;
            const finish = (status) => {
                if (done)
                    return;
                done = true;
                clearTimeout(timer);
                pending.delete(attempt);
                emit('offerwall_open', status);
            };
            const attempt = {
                // iOS bridge fires on attachment, not proof of campaign load. Android uses OnLoadedOfferwall.
                loaded: () => finish(platform === 'ios' ? 'attached' : 'loaded'),
                fail: reason => finish(reason),
            };
            if (!done) {
                pending.add(attempt);
                timer = setTimeout(() => finish('timeout'), 20000);
            }
            return attempt;
        },
        close(reason = 'screen_exit') {
            if (closed)
                return;
            closed = true;
            for (const attempt of pending)
                attempt.fail('cancelled');
            if (entered)
                emit('offerwall_close', reason);
        },
    };
}
/** Screen visibility, not button presses. Deferred cleanup ignores React StrictMode's effect replay. */
function useChanceFunnel() {
    const React = require('react');
    const visit = React.useRef(null);
    const live = React.useRef(false);
    if (!visit.current)
        visit.current = createChanceFunnel();
    React.useEffect(() => {
        live.current = true;
        visit.current.enter();
        return () => { live.current = false; Promise.resolve().then(() => { if (!live.current)
            visit.current.close(); }); };
    }, []);
    return visit.current;
}
