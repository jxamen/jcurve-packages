"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_ORIGINS = void 0;
exports.isAllowedOrigin = isAllowedOrigin;
exports.isEntryUrl = isEntryUrl;
exports.fetchEntry = fetchEntry;
const OK_HOSTS = ['service.mocation.co.kr', 'test.mocation.co.kr'];
/** 허용 origin(스킴 + 호스트, 포트 없음) */
exports.ALLOWED_ORIGINS = OK_HOSTS.map(h => 'https://' + h);
/** 이 주소가 승인된 APIHUB origin(https · 약속된 호스트 · 포트 · 계정 정보 없음)인가 */
function isAllowedOrigin(url) {
    if (typeof url !== 'string')
        return false;
    try {
        const u = new URL(url);
        return u.protocol === 'https:' && OK_HOSTS.includes(u.hostname) && u.port === '' && u.username === '' && u.password === '';
    }
    catch {
        return false;
    }
}
/**
 * 서버가 준 웹뷰 첫 주소 — 승인된 origin 의 /alwayz/entry.php 이고 필수 파라미터(pubKey · uid · trackingId)가 비어 있지 않을 때만.
 * 이상한 주소로 웹뷰를 열지 않는다. 공개 컴포넌트(MissionWebView)에 들어오는 url 도 같은 검사를 한다.
 */
function isEntryUrl(url) {
    if (!isAllowedOrigin(url))
        return false;
    try {
        const u = new URL(url);
        if (u.pathname !== '/alwayz/entry.php')
            return false;
        return ['pubKey', 'uid', 'trackingId'].every(k => (u.searchParams.get(k) ?? '').trim() !== '');
    }
    catch {
        return false;
    }
}
async function fetchEntry(request, adId) {
    let r;
    try {
        r = await request('apihub/entry', { method: 'POST', body: adId ? { adId } : {} });
    }
    catch (e) {
        const status = e?.status;
        const code = e;
        const err = String(code?.error ?? code?.data?.error ?? '');
        if (status === 404 || err === 'off')
            return { ok: false, reason: 'off' };
        if (status === 503 || err === 'not_ready')
            return { ok: false, reason: 'not_ready' };
        return { ok: false, reason: 'network' };
    }
    const j = r;
    if (j?.ok === true && isEntryUrl(j.url))
        return { ok: true, url: j.url };
    if (j?.error === 'off')
        return { ok: false, reason: 'off' };
    if (j?.error === 'not_ready')
        return { ok: false, reason: 'not_ready' };
    return { ok: false, reason: 'invalid' };
}
