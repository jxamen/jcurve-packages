"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tapUploadStorageKey = exports.TAP_UPLOAD_DEBOUNCE_MS = exports.TAP_UPLOAD_MIN_GAP_MS = void 0;
exports.bodySignature = bodySignature;
exports.createTapUploader = createTapUploader;
const combos_1 = require("./combos");
const connector_1 = require("./connector");
exports.TAP_UPLOAD_MIN_GAP_MS = 10 * 60000;
exports.TAP_UPLOAD_DEBOUNCE_MS = 8000;
const MAX_ATTEMPTS = 3;
const tapUploadStorageKey = (scope) => `jcurve.offerwall.tapupload:${scope ?? ''}`;
exports.tapUploadStorageKey = tapUploadStorageKey;
/** A short, stable fingerprint of a body (djb2 over its JSON) — only to tell "same as the last upload" from "changed". */
function bodySignature(body) {
    const text = JSON.stringify(body);
    let hash = 5381;
    for (let i = 0; i < text.length; i += 1)
        hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
    return `${text.length}:${hash.toString(36)}`;
}
function createTapUploader({ upload, storage, scope, now = Date.now, minGapMs = exports.TAP_UPLOAD_MIN_GAP_MS, debounceMs = exports.TAP_UPLOAD_DEBOUNCE_MS, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = handle => clearTimeout(handle), }) {
    let list = [];
    const info = new Map(); // the participation text from detail pages, by campaign key
    let timer = null;
    let lastSentAt = 0;
    let attempts = 0;
    let stopped = false;
    let busy = false;
    const body = () => (0, connector_1.campaignsBody)(list.map(c => ({ ...c, ...(info.get(c.campaignKey) ? { info: info.get(c.campaignKey) } : {}) })));
    const schedule = () => {
        if (stopped || timer !== null)
            return;
        const wait = Math.max(debounceMs, lastSentAt ? lastSentAt + minGapMs - now() : 0);
        timer = setTimer(() => { timer = null; void flush(); }, wait);
    };
    const flush = async () => {
        if (stopped || busy)
            return 'empty';
        const payload = body();
        if (!payload.campaigns.length)
            return 'empty';
        const signature = bodySignature(payload);
        const today = (0, combos_1.kstDate)(now());
        try {
            if (storage) {
                const stored = JSON.parse((await storage.getItem((0, exports.tapUploadStorageKey)(scope))) ?? 'null');
                if (stored && stored.sig === signature && stored.date === today)
                    return 'unchanged';
            }
        }
        catch { /* an unreadable record counts as "nothing sent yet" */ }
        busy = true;
        try {
            await upload(payload);
        }
        catch {
            busy = false;
            attempts += 1;
            lastSentAt = now();
            if (attempts < MAX_ATTEMPTS)
                schedule();
            return 'error';
        }
        busy = false;
        attempts = 0;
        lastSentAt = now();
        try {
            await storage?.setItem((0, exports.tapUploadStorageKey)(scope), JSON.stringify({ date: today, sig: signature }));
        }
        catch { /* the next start just sends once more */ }
        return 'sent';
    };
    return {
        handle(message) {
            if (stopped)
                return;
            if (message.type === 'list') {
                if (!message.campaigns.length)
                    return;
                // 0.4.2: the page loads the list per tab (and the script splits a very big one), so every campaign seen while the wall is watched counts — a newer row replaces its older copy
                const merged = new Map(list.map(c => [c.campaignKey, c]));
                for (const c of message.campaigns)
                    merged.set(c.campaignKey, c);
                list = [...merged.values()].slice(0, 800);
                for (const c of message.campaigns) {
                    const text = c.info ?? '';
                    if (text)
                        info.set(c.campaignKey, text);
                }
                schedule();
            }
            else if (message.type === 'detail') {
                const text = message.campaign.info ?? message.campaign.description ?? '';
                if (text)
                    info.set(message.campaign.campaignKey, text);
                // a detail text only travels with a list upload that is going to happen anyway
                if (list.length)
                    schedule();
            }
        },
        flush,
        stop() { stopped = true; if (timer !== null) {
            clearTimer(timer);
            timer = null;
        } },
    };
}
