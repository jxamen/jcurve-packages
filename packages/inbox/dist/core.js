"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultTheme = exports.defaultStrings = void 0;
exports.isMissingRoute = isMissingRoute;
exports.createInboxApi = createInboxApi;
exports.relativeTime = relativeTime;
exports.hasDestination = hasDestination;
exports.createInboxStore = createInboxStore;
/** Recognize missing endpoints across app HTTP wrappers and parsed responses. */
function isMissingRoute(err) {
    if (!err || (typeof err !== 'object' && typeof err !== 'string'))
        return false;
    const e = err;
    return [e.status, e.statusCode, e.response?.status].some(status => [404, 501, 405].includes(status))
        || ['http_404', 'http_501', 'not_found'].includes(e.code)
        || /\b(404|501)\b/.test(typeof err === 'string' ? err : e.message ?? '')
        || (e.ok === false && e.error === 'not_found')
        || (e.response?.data?.ok === false && e.response.data.error === 'not_found');
}
function createInboxApi(fetchJson, options = {}) {
    const basePath = (options.basePath ?? 'me/push-inbox').replace(/\/+$/, '');
    let lastUnread = 0;
    const checked = (r) => {
        if (isMissingRoute(r))
            throw r;
        if (!r || r.ok !== true)
            throw new Error('Inbox API failed');
        lastUnread = r.unread;
        return r;
    };
    return {
        list: async (cursor) => {
            try {
                return checked(await fetchJson('GET', `${basePath}${cursor === undefined ? '' : `?cursor=${encodeURIComponent(cursor)}`}`));
            }
            catch (err) {
                if (!isMissingRoute(err))
                    throw err;
                lastUnread = 0;
                return { ok: true, items: [], unread: 0 };
            }
        },
        unread: async () => {
            try {
                return checked(await fetchJson('GET', `${basePath}/unread`)).unread;
            }
            catch (err) {
                if (!isMissingRoute(err))
                    throw err;
                return lastUnread = 0;
            }
        },
        // Empty/omitted ids remain local no-ops; never request a bulk read.
        read: async (ids) => {
            if (!ids?.length)
                return lastUnread;
            try {
                return checked(await fetchJson('POST', `${basePath}/read`, { ids })).unread;
            }
            catch (err) {
                if (!isMissingRoute(err))
                    throw err;
                return lastUnread;
            }
        },
    };
}
exports.defaultStrings = { title: '알림', back: '뒤로', empty: '받은 알림이 없어요', error: '알림을 불러오지 못했어요', retry: '다시 시도', ad: '광고', now: '방금', minutes: (n) => `${n}분 전`, hours: (n) => `${n}시간 전`, yesterday: '어제', date: (m, d) => `${m}월 ${d}일` };
exports.defaultTheme = { bg: '#FFFFFF', card: '#F2F4F6', text: '#191F28', sub: '#6B7684', line: '#E5E8EB', primary: '#3182F6', unreadDot: '#F04452', adBadgeBg: '#E5E8EB', adBadgeText: '#6B7684', radius: 12 };
function relativeTime(sentAt, now = new Date(), strings = {}) {
    const s = { ...exports.defaultStrings, ...strings }, date = new Date(sentAt);
    if (!Number.isFinite(date.getTime()))
        return '';
    const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000);
    if (seconds < 60)
        return s.now;
    if (seconds < 3600)
        return s.minutes(Math.floor(seconds / 60));
    if (seconds < 86400)
        return s.hours(Math.floor(seconds / 3600));
    // Server timestamps and calendar boundaries use Korea time, independent of device timezone.
    const parts = (d) => new Date(d.getTime() + 9 * 3600000);
    const a = parts(now), b = parts(date);
    const day = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (day(a) - day(b) === 86400000)
        return s.yesterday;
    return s.date(b.getUTCMonth() + 1, b.getUTCDate());
}
function hasDestination(item) {
    return ['go', 'url', 'screen'].some(key => Boolean(item.data?.[key]));
}
/** Read rows stay hidden while requests or stale pages are in flight. */
function createInboxStore(api) {
    let state = { items: [], expanded: [], unread: 0, loading: false, error: false }, generation = 0;
    const removed = new Set();
    const pending = new Set();
    let writeVersion = 0;
    const listeners = new Set();
    const update = (patch) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
    async function markRead(item) {
        if (removed.has(item.id))
            return;
        removed.add(item.id);
        pending.add(item.id);
        ++writeVersion;
        update({ items: state.items.filter(row => row.id !== item.id), expanded: state.expanded.filter(id => id !== item.id), unread: Math.max(0, state.unread - 1) });
        try {
            const unread = await api.read([item.id], false);
            pending.delete(item.id);
            // Concurrent reads can complete out of order; refresh from the server once all settle.
            if (!pending.size) {
                const token = generation, version = writeVersion;
                try {
                    const count = await api.unread();
                    if (!pending.size && token === generation && version === writeVersion)
                        update({ unread: count ?? unread });
                }
                catch { /* Keep optimistic count until refresh. */ }
            }
        }
        catch {
            pending.delete(item.id);
            removed.delete(item.id);
            update({ items: [...state.items.filter(row => row.id !== item.id), item].sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.id - a.id), unread: state.unread + 1, error: true });
        }
    }
    return {
        getSnapshot: () => state,
        subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
        async load(more = false) {
            if (more && (state.loading || state.next === undefined))
                return;
            const token = more ? generation : ++generation, cursor = more ? state.next : undefined;
            update({ loading: true, error: false });
            try {
                const r = await api.list(cursor);
                if (!r.ok)
                    throw new Error('list');
                if (token !== generation)
                    return;
                const rows = r.items.filter(item => !item.read && !removed.has(item.id));
                const items = more ? [...state.items, ...rows.filter(item => !state.items.some(old => old.id === item.id))] : rows;
                update({ items, unread: pending.size ? state.unread : r.unread, next: r.next, loading: false });
            }
            catch (err) {
                if (token === generation)
                    update(isMissingRoute(err)
                        ? { items: [], expanded: [], unread: 0, next: undefined, loading: false, error: false }
                        : { loading: false, error: true });
            }
        },
        markRead,
        press(item, onOpen) {
            if (removed.has(item.id))
                return;
            if (hasDestination(item)) {
                void markRead(item);
                onOpen(item);
            }
            else if (state.expanded.includes(item.id))
                void markRead(item);
            else
                update({ expanded: [...state.expanded, item.id] });
        },
        leave() {
            for (const item of state.items.filter(row => state.expanded.includes(row.id)))
                void markRead(item);
        },
    };
}
