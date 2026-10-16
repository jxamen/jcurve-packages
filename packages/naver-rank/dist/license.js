"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configure = configure;
exports.storage = storage;
exports.authorize = authorize;
exports.recordUsage = recordUsage;
const webQueue_1 = require("./webQueue");
const base = 'https://rankfree.kr/api/v1/sdk';
const dayMs = 86400000;
let config;
let serial = Promise.resolve();
function configure(value) { config = { ...value }; }
function storage() { if (!config)
    throw new webQueue_1.CollectorError('license_invalid'); return config.storage; }
function current() { if (!config?.apiKey.trim() || !config.appId.trim())
    throw new webQueue_1.CollectorError('license_invalid'); return config; }
async function post(c, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        return await fetch(base + path, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.apiKey }, body: JSON.stringify(body) });
    }
    finally {
        clearTimeout(timer);
    }
}
const day = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
function exclusive(fn) { const task = serial.catch(() => { }).then(fn); serial = task; return task; }
function authorize() {
    return exclusive(async () => {
        const c = current(), key = 'naver.rank.license.' + c.appId;
        let cached;
        try {
            const raw = await c.storage.getItem(key);
            cached = raw ? JSON.parse(raw) : undefined;
        }
        catch {
            throw new webQueue_1.CollectorError('license_invalid');
        }
        const now = Date.now();
        const valid = () => cached?.apiKey === c.apiKey && cached.appId === c.appId && Number.isFinite(cached.checkedAt) && now >= cached.checkedAt && now - cached.checkedAt < 2 * dayMs && now < cached.expiresAt;
        if (valid() && cached.day === day())
            return;
        let response;
        try {
            response = await post(c, '/verify', { appId: c.appId, scope: 'sdk_rank' });
        }
        catch {
            if (valid())
                return;
            throw new webQueue_1.CollectorError('license_invalid');
        }
        // Only a transport outage/5xx receives grace; an explicit denial revokes the cache.
        if (response.status >= 500) {
            if (valid())
                return;
            throw new webQueue_1.CollectorError('license_invalid');
        }
        let data;
        try {
            data = await response.json();
        }
        catch {
            data = null;
        }
        const expiry = Date.parse(data?.expiresAt);
        if (!response.ok || data?.valid !== true || data.appId !== c.appId || !Array.isArray(data.scopes) || !data.scopes.includes('sdk_rank') || !Number.isFinite(expiry) || expiry <= now) {
            await c.storage.setItem(key, 'null');
            throw new webQueue_1.CollectorError('license_invalid');
        }
        await c.storage.setItem(key, JSON.stringify({ apiKey: c.apiKey, appId: c.appId, checkedAt: now, day: day(), expiresAt: expiry }));
    });
}
function recordUsage(channel) {
    return exclusive(async () => {
        const c = current(), key = 'naver.rank.usage.' + c.appId;
        const quotaKey = 'naver.rank.quota.' + c.appId;
        const quota = JSON.parse(await c.storage.getItem(quotaKey) || 'null');
        if (quota?.apiKey === c.apiKey && quota.date === day())
            throw new webQueue_1.CollectorError('license_limit');
        let rows = [];
        try {
            const saved = JSON.parse(await c.storage.getItem(key) || 'null');
            rows = saved?.apiKey === c.apiKey ? saved.rows : [];
            if (!Array.isArray(rows))
                throw Error();
        }
        catch {
            throw new webQueue_1.CollectorError('license_invalid');
        }
        const date = day();
        let row = rows.find(r => r.date === date);
        if (!row) {
            row = { date, place: 0, shopping: 0 };
            rows.push(row);
        }
        row[channel]++;
        await c.storage.setItem(key, JSON.stringify({ apiKey: c.apiKey, rows }));
        // Absolute cumulative counts are idempotent for (key,appId,date,installationId).
        let installationId = await c.storage.getItem('naver.rank.installation');
        if (!installationId) {
            installationId = Date.now().toString(36) + Math.random().toString(36).slice(2);
            await c.storage.setItem('naver.rank.installation', installationId);
        }
        for (const item of [...rows]) {
            let response;
            try {
                response = await post(c, '/usage', { appId: c.appId, installationId, ...item });
            }
            catch {
                break;
            }
            if (response.status === 401 || response.status === 403) {
                await c.storage.setItem('naver.rank.license.' + c.appId, 'null');
                throw new webQueue_1.CollectorError('license_invalid');
            }
            if (response.status === 429) {
                if (item.date === date) {
                    await c.storage.setItem(quotaKey, JSON.stringify({ apiKey: c.apiKey, date }));
                    throw new webQueue_1.CollectorError('license_limit');
                }
                break;
            }
            if (!response.ok)
                break;
            if (item.date !== date)
                rows = rows.filter(r => r !== item);
        }
        await c.storage.setItem(key, JSON.stringify({ apiKey: c.apiKey, rows }));
    });
}
