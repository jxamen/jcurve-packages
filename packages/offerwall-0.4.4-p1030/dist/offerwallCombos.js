"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTapCacheKey = exports.LIST_TAP_CACHE_MS = void 0;
exports.guardedBody = guardedBody;
exports.listTapCached = listTapCached;
exports.createComboHandlers = createComboHandlers;
exports.OfferwallCombos = OfferwallCombos;
const connector_1 = require("./connector");
const comboEntry_1 = require("./comboEntry");
const combos_1 = require("./combos");
const popupAd_1 = require("./popupAd");
const tapUpload_1 = require("./tapUpload");
const trialNotify_1 = require("./trialNotify");
const webTap_1 = require("./webTap");
function defaultStorage() {
    try {
        const mod = require('@react-native-async-storage/async-storage');
        const store = mod.default ?? mod;
        return store && typeof store.getItem === 'function' && typeof store.setItem === 'function' ? store : undefined;
    }
    catch {
        return undefined;
    }
}
function platformOs() {
    try {
        return require('react-native').Platform.OS;
    }
    catch {
        return 'android';
    }
}
/**
 * The answer as the connector wants it: a combos document that does not say `display.chance` for itself keeps the chip off (nothing turns on by default),
 * and the `always` popup survives only for test members. The original body is not touched.
 */
function guardedBody(body) {
    const b = body;
    if (!b || typeof b !== 'object')
        return body;
    const key = b.combos ? 'combos' : b.data ? 'data' : null;
    const doc = (key ? b[key] : b);
    if (!doc || typeof doc !== 'object')
        return body;
    const chance = doc.display?.chance;
    if (chance === 'chip' || chance === 'off')
        return body;
    const display = { ...(doc.display && typeof doc.display === 'object' ? doc.display : {}), chance: 'off' };
    return key ? { ...b, [key]: { ...doc, display } } : { ...b, display };
}
/** The last explicit "on" the server gave for the iPhone list reading, kept on the device so the tap can start at mount, before the combos answer is back (0.4.1). */
exports.LIST_TAP_CACHE_MS = 7 * 24 * 3600000;
const listTapCacheKey = (member) => `jcurve.offerwall.listtap:${member}`;
exports.listTapCacheKey = listTapCacheKey;
/** The cached value ('1700000000000' = when the server last said "on") is still usable. Anything else — nothing stored, "0", garbage, too old — is off. */
function listTapCached(raw, now = Date.now()) {
    const at = Number(raw);
    return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at < exports.LIST_TAP_CACHE_MS;
}
/**
 * The calls `<OfferwallCombos>` hands to the entry, with their rules: who may send what, what is never sent, what failing means. Exported so that an app that
 * wants its own screen around `ComboEntry` can still use the same calls.
 */
function createComboHandlers({ client, memberId, askTestMember, onListTap }) {
    // who is a test member: asked once per member, only when needed (an answer that is not a plain yes/no, or a failure, is asked again next time)
    let cached = null;
    const isTestMember = () => {
        const member = memberId();
        if (member == null || !askTestMember)
            return Promise.resolve(false);
        const id = String(member);
        if (cached?.id === id)
            return cached.ok;
        const ok = Promise.resolve().then(() => askTestMember()).then(answer => { if (typeof answer !== 'boolean')
            cached = null; return answer === true; }, () => { cached = null; return false; });
        cached = { id, ok };
        return ok;
    };
    return {
        isTestMember,
        /** GET offerwall/combos, the body the entry parses: chip kept off unless the server said so, "always" popup only for test members. */
        async load() {
            let body;
            try {
                body = await client().get('offerwall/combos');
            }
            catch (error) {
                // the server's own "nothing for this app" (404) also means the list reading is off now; a flaky network says nothing and leaves it as it was
                if (error?.status === 404) {
                    try {
                        onListTap?.(false);
                    }
                    catch { /* ignore */ }
                }
                throw error;
            }
            try {
                onListTap?.((0, connector_1.listTapSwitch)(body));
            }
            catch { /* the switch is read again with the next answer */ }
            const guarded = guardedBody(body);
            if (!(0, connector_1.hasAlwaysPopup)(guarded))
                return guarded;
            return (await isTestMember()) ? guarded : (0, connector_1.dropAlwaysPopup)(guarded);
        },
        /** The SDK's campaign list (Android, iPhone with the bridge): test members only. */
        async report(list) {
            if (memberId() == null || list.length === 0)
                return;
            try {
                if (!(await isTestMember()))
                    return;
                await client().post('offerwall/campaigns', (0, connector_1.campaignsBody)(list));
            }
            catch { /* sending the list is an extra: the screen stays as it is */ }
        },
        /** One line per 하러 가기 tap: test members only. */
        async diagnose(d) {
            try {
                if (!(await isTestMember()))
                    return;
                await client().post('offerwall/combos/diag', (0, connector_1.diagBody)(d));
            }
            catch { /* diagnostics are an extra */ }
        },
        /** What the web tap saw (counts and path names only): test members only, quietly. */
        async diagnoseWebTap(summary) {
            try {
                if (!(await isTestMember()))
                    return;
                await client().post('offerwall/combos/diag', (0, connector_1.webTapDiagBody)(summary));
            }
            catch { /* diagnostics are an extra */ }
        },
        /** A detail page that did not open / closed at once: every member, four fields. */
        async signalDetail(s) {
            try {
                await client().post('offerwall/combos/diag', (0, connector_1.detailSignalBody)(s));
            }
            catch { /* a hint, nothing more */ }
        },
        /** A failure is thrown on purpose: the entry knows what to do with it (the consent still opens the page, the list says it could not load, a cancel mark reloads the list). */
        async trialConsent(campaignKey, agree) { await client().post('offerwall/trials/consent', { campaignKey, agree }); },
        loadTrials() { return client().get('offerwall/trials'); },
        async trialCancelled(campaignKey, cancelled) {
            await client().post(`offerwall/trials/${encodeURIComponent(campaignKey)}/cancelled`, { cancelled });
        },
    };
}
function OfferwallCombos(props) {
    const React = require('react');
    const { placement, usn, memberId, serverUrl = '', tokens, theme: themeOverride, popupArt, adUnit, adTestMode = false, adTestDevices, popupAd: popupAdOn = true, chipTop, chipRight, sheetTop } = props;
    // the latest props for the callbacks below (they are created once; the entry keeps asking them what to do)
    const latest = React.useRef(props);
    latest.current = props;
    const clientRef = React.useRef(null);
    const clientKey = serverUrl;
    const clientFor = () => {
        if (latest.current.client)
            return latest.current.client;
        if (!clientRef.current || clientRef.current.__key !== clientKey) {
            const made = (0, connector_1.createOfferwallClient)({ serverUrl: clientKey, getAuthHeaders: () => latest.current.getAuthHeaders?.() ?? {}, onUnauthorized: () => latest.current.onUnauthorized?.() });
            made.__key = clientKey;
            clientRef.current = made;
        }
        return clientRef.current;
    };
    const themeRef = React.useRef(null);
    if (!themeRef.current || themeRef.current.tokens !== tokens || themeRef.current.override !== themeOverride) {
        themeRef.current = { tokens, override: themeOverride, theme: { ...(tokens ? (0, combos_1.comboThemeFromTokens)(tokens) : combos_1.DEFAULT_COMBO_THEME), ...(themeOverride ?? {}) } };
    }
    const theme = themeRef.current.theme;
    const storageRef = React.useRef(null);
    if (storageRef.current === null)
        storageRef.current = props.storage ?? defaultStorage();
    const storage = props.storage ?? storageRef.current ?? undefined;
    // the iPhone list reading: on only while the server's answer says so
    const [listTap, setListTap] = React.useState(false);
    const aliveRef = React.useRef(true);
    React.useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);
    const handlersRef = React.useRef(null);
    if (!handlersRef.current) {
        handlersRef.current = createComboHandlers({
            client: clientFor,
            memberId: () => latest.current.memberId,
            askTestMember: () => latest.current.isTestMember?.() ?? false,
            onListTap: on => {
                // remember the server's answer for the next start (an explicit "on" with its time, an explicit "off" as "0")
                try {
                    const store = latest.current.storage ?? storageRef.current ?? undefined;
                    const member = latest.current.memberId;
                    if (store && member != null)
                        void Promise.resolve(store.setItem((0, exports.listTapCacheKey)(member), on ? String(Date.now()) : '0')).catch(() => { });
                }
                catch { /* the cache is an extra */ }
                if (aliveRef.current)
                    setListTap((prev) => (prev === on ? prev : on));
            },
        });
    }
    const handlers = handlersRef.current;
    const sheetShown = (info) => {
        const custom = latest.current.onSheetShown;
        if (custom) {
            try {
                custom(info);
            }
            catch { /* the app's log must not break the sheet */ }
            return;
        }
        try {
            console.log('[combos] sheet', info.ms + 'ms', 'tabs', info.tabs, 'rows', info.rows, 'total', info.total);
        }
        catch { /* ignore */ }
    };
    const trialNotify = () => (0, trialNotify_1.ensureTrialNotify)({
        ...(0, trialNotify_1.defaultTrialNotifyDeps)({ ...(latest.current.notifyHooks ?? {}), syncToken: latest.current.syncPushToken }),
        ...(latest.current.notifications ?? {}),
    });
    // iPhone: the last explicit "on" from the server starts the tap at mount, before the combos answer is back; the answer then confirms or switches it off
    React.useEffect(() => {
        if (memberId == null || platformOs() !== 'ios' || !storage)
            return;
        let live = true;
        void Promise.resolve(storage.getItem((0, exports.listTapCacheKey)(memberId))).then(raw => { if (live && listTapCached(raw))
            setListTap((prev) => prev || true); }).catch(() => { });
        return () => { live = false; };
    }, [memberId]);
    // iPhone only, only while the server says "on": watch AdPopcorn's own list page, send what it shows (rarely), stop when the switch goes off
    React.useEffect(() => {
        if (!listTap || memberId == null || platformOs() !== 'ios')
            return;
        let live = true;
        let handle = null;
        const seen = { started: false, hello: 0, lists: 0, maxList: 0, details: 0, natives: 0, shapes: 0, paths: [], resp: [] };
        const timers = [];
        const report = () => { try {
            void handlers.diagnoseWebTap({ ...seen, paths: [...seen.paths], resp: [...seen.resp] });
        }
        catch { /* ignore */ } };
        const uploader = (0, tapUpload_1.createTapUploader)({
            upload: body => clientFor().post('offerwall/campaigns', body),
            storage, scope: String(memberId),
        });
        void (0, webTap_1.startWebTap)({
            onMessage: message => {
                if (!live)
                    return;
                if (message.type === 'hello') {
                    seen.hello += 1;
                    seen.helloHost = message.host;
                    try {
                        console.log('[combos] tap hello', message.host, message.ready);
                    }
                    catch { /* ignore */ }
                    return;
                }
                if (message.type === 'net') {
                    if (seen.paths.length < 12 && !seen.paths.includes(message.path))
                        seen.paths.push(message.path);
                    return;
                }
                if (message.type === 'resp') {
                    if (seen.resp.length < 22)
                        seen.resp.push(message);
                    try {
                        console.log('[combos] tap resp', message.path, message.status, message.kind, message.len, (message.keys ?? []).join(','), message.arrays.map(a => `${a.k}[${a.n}]`).join(','));
                    }
                    catch { /* ignore */ }
                    return;
                }
                if (message.type === 'shape') {
                    seen.shapes += 1;
                    // key names only, to see the page's real shape on a device
                    try {
                        console.log('[combos] tap shape', message.path, message.keys.join(','), '|', message.itemKeys.join(','));
                    }
                    catch { /* ignore */ }
                    return;
                }
                if (message.type === 'list') {
                    seen.lists += 1;
                    seen.maxList = Math.max(seen.maxList, message.campaigns.length);
                    try {
                        console.log('[combos] tap list', message.campaigns.length);
                    }
                    catch { /* ignore */ }
                }
                else if (message.type === 'detail')
                    seen.details += 1;
                else if (message.type === 'native')
                    seen.natives += 1;
                uploader.handle(message);
            },
        }).then(started => {
            if (!live) {
                started.stop();
                return;
            }
            handle = started;
            seen.started = started.ok;
            if (!started.ok) {
                seen.reason = started.reason;
                report();
                return;
            }
            // test members only: a short summary of what the tap saw, after the wall had time to load and again later
            timers.push(setTimeout(report, 25000), setTimeout(report, 100000));
        }).catch(() => undefined);
        return () => { live = false; timers.forEach(t => clearTimeout(t)); uploader.stop(); handle?.stop(); };
    }, [listTap, memberId]);
    const adReady = popupAdOn !== false && (0, popupAd_1.popupAdAvailable)({ adUnit, testMode: adTestMode });
    const popupAd = adReady ? () => React.createElement(popupAd_1.OfferwallPopupAd, { key: (0, popupAd_1.popupAdUnit)(adUnit) || 'test', adUnit, testMode: adTestMode, testDevices: adTestDevices, theme }) : undefined;
    if (memberId == null)
        return null;
    return React.createElement(comboEntry_1.ComboEntry, {
        placement, load: handlers.load, loadKey: String(memberId), usn, theme, popupArt, popupAd, storage,
        reportCampaigns: handlers.report, onDiagnostic: handlers.diagnose, onDetailSignal: handlers.signalDetail,
        onTrialConsent: handlers.trialConsent, onTrialNotify: trialNotify, onSheetShown: sheetShown, loadTrials: handlers.loadTrials, onTrialCancelled: handlers.trialCancelled,
        chipTop, chipRight, ...(sheetTop === undefined ? {} : { sheetTop }),
    });
}
