"use strict";
/**
 * 간편인증 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * **이 파일은 앱을 모른다.** 스킴·세션·저장은 앱이 주입한다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.identityMessage = identityMessage;
exports.openAuth = openAuth;
exports.parseQuery = parseQuery;
exports.createIdentity = createIdentity;
/**
 * 사유 코드 → 사람 말. **문구 끝에 코드를 붙인다**(identityMessage) — 문의가 오면 코드로 바로 가른다(스터디숲 #304 · #305).
 * 서버 사유는 복귀 주소의 `reason`, KICA 자체 오류는 `KIAP_<코드>`(예: KIAP_E4108) 로 온다.
 */
const REASON = {
    CANCELED: '인증을 취소했어요.',
    NO_SESSION: '로그인한 뒤 다시 시도해 주세요.',
    NETWORK: '연결이 불안정해요. 잠시 후 다시 시도해 주세요.',
    KIAP_DISABLED: '간편인증 준비 중이에요. 잠시 후 다시 시도해 주세요.',
    CONFIG_MISSING: '간편인증 준비 중이에요. 잠시 후 다시 시도해 주세요.',
    ALREADY_VERIFIED: '이미 본인인증을 마친 계정이에요. 앱을 다시 열어 주세요.',
    SESSION_EXPIRED: '인증 시간이 지났어요. 다시 시도해 주세요.',
    RATE_LIMITED: '잠시 후 다시 시도해 주세요.',
    DUPLICATE_CI: '이미 다른 계정에서 인증된 사용자예요. 계정은 1인 1개만 쓸 수 있어요.',
    UID_CI_CONFLICT: '이 계정은 다른 사람 명의로 인증되어 있어요.',
    CI_MISSING: '인증 기관에서 정보를 받지 못했어요. 다시 시도해 주세요.',
    RESULT_LOST: '인증 결과를 받지 못했어요. 다시 시도해 주세요.',
    NEED_UPDATE: '앱을 최신 버전으로 업데이트해 주세요.',
    FAILED: '본인인증에 실패했어요. 다시 시도해 주세요.',
    SESSION_USED: '이미 끝난 인증이에요. 다시 시도해 주세요.',
    DECRYPT_FAILED: '인증 결과를 읽지 못했어요. 다시 시도해 주세요.',
    RESULT_BINDING_MISMATCH: '인증 결과가 맞지 않아요. 다시 시도해 주세요.',
    CALLBACK_FIELDS_MISSING: '인증 기관 응답이 비었어요. 다시 시도해 주세요.',
    PROVIDER_NOT_ALLOWED: '이 인증 기관은 쓸 수 없어요. 다른 기관을 골라 주세요.',
    PROVIDER_DISABLED: '이 인증 기관은 쓸 수 없어요. 다른 기관을 골라 주세요.',
    RACE_BLOCKED: '인증이 두 번 들어왔어요. 다시 시도해 주세요.',
    DUPLICATE_PHONE: '이미 가입한 번호예요. 로그인해 주세요.',
    KIAP_TIMEOUT: '인증 기관 응답이 늦어요. 잠시 후 다시 시도해 주세요.',
    KIAP_E4108: '인증 창을 열 수 없는 주소예요(허용 도메인). 잠시 후 다시 시도해 주세요.',
};
/** KICA 쪽 오류(KIAP_*)는 하나로 뭉뚱그리되 코드는 남긴다 */
const KIAP_DEFAULT = '인증 기관에서 오류가 났어요. 잠시 후 다시 시도해 주세요.';
/** 사유 → 사람이 읽는 말. 모르는 사유도 빈 문자열을 내지 않는다 */
function identityMessage(reason) {
    const r = String(reason || 'FAILED').toUpperCase();
    const text = REASON[r] ?? (r.startsWith('KIAP_') ? KIAP_DEFAULT : '본인인증에 실패했어요. 다시 시도해 주세요.');
    // 사용자가 스스로 닫은 것에는 코드를 붙이지 않는다
    return r === 'CANCELED' ? text : `${text} (${r})`;
}
/**
 * 인증 창을 연다 — iOS 는 **ephemeral 세션**으로 연다. 안 그러면 ASWebAuthenticationSession 이
 * 「'앱'이(가) 로그인하려고 합니다」 확인 창을 먼저 띄운다(스터디숲 #303). 쿠키를 남기지 않는 것은 오히려 맞다(본인인증은 한 번).
 */
async function openAuth(WebBrowser, url, ret) {
    return WebBrowser.openAuthSessionAsync(url, ret, { preferEphemeralSession: true });
}
/**
 * 복귀 URL 의 쿼리를 읽는다 — **RN 의 `URLSearchParams` 폴리필을 믿지 않는다.**
 * 기기·판마다 있기도 없기도 해서, 없는 기기에서만 결과를 잃는다.
 */
function parseQuery(url) {
    const out = {};
    const q = url.split('?')[1] ?? '';
    for (const pair of q.split('&')) {
        const i = pair.indexOf('=');
        if (i > 0)
            out[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
    }
    return out;
}
function createIdentity(deps) {
    const headers = (json = false) => {
        const h = { Accept: 'application/json', 'X-App-Token': deps.appToken };
        const t = deps.token();
        if (t)
            h.Authorization = 'Bearer ' + t;
        if (json)
            h['Content-Type'] = 'application/json';
        return h;
    };
    let started = null; // flow 'start' — status 가 준 시작 주소
    const status = async () => {
        // **앱 토큰을 빼먹으면 늘 「꺼짐」으로 읽힌다**(꼬꼬농장 2026-09-14) — 그래서 여기서 붙인다
        const r = await fetch(deps.base + '/kiap/status', { headers: { Accept: 'application/json', 'X-App-Token': deps.appToken } });
        const j = await r.json().catch(() => null);
        if (typeof j?.start === 'string')
            started = j.start;
        return j;
    };
    return {
        async providers() {
            try {
                const j = await status();
                return Array.isArray(j?.providers) ? j.providers.map(String) : [];
            }
            catch {
                return [];
            }
        },
        async enabled() {
            try {
                return !!(await status())?.enabled;
            }
            catch {
                return false;
            }
        },
        async verify() {
            const flow = deps.flow ?? 'init';
            const token = deps.token();
            if (flow === 'init' && !token)
                return { ok: false, reason: 'NO_SESSION' };
            // **지연 `require` 로만 집는다** — 이 네이티브 모듈이 없는 구 빌드에서 화면이
            // 열리는 것만으로 죽지 않게 한다. 모듈이 없으면 이 경로만 조용히 접는다.
            let WebBrowser;
            try {
                WebBrowser = require('expo-web-browser');
            }
            catch {
                return { ok: false, reason: 'NEED_UPDATE' };
            }
            if (flow === 'start') {
                // 가입 전 흐름 — status 의 start 주소(허용 도메인 밑)를 ?ret= 로 연다. 서버가 세션을 만든다
                try {
                    if (!started)
                        await status();
                }
                catch {
                    return { ok: false, reason: 'NETWORK' };
                }
                if (!started)
                    return { ok: false, reason: 'KIAP_DISABLED' };
                return this.finish(await openAuth(WebBrowser, `${started}?ret=${encodeURIComponent(deps.ret)}`, deps.ret));
            }
            let init = null;
            try {
                const res = await fetch(deps.base + '/kiap/init', {
                    method: 'POST', headers: headers(true), body: JSON.stringify({ ret: deps.ret }),
                });
                init = await res.json().catch(() => null);
            }
            catch {
                return { ok: false, reason: 'NETWORK' };
            }
            if (!init?.ok || typeof init.url !== 'string') {
                const err = String(init?.error || 'init_failed');
                // 이미 인증한 회원 — 서버에 남은 번호로 이어 붙인다(기기를 바꿨거나 저장이 날아간 경우)
                if (err === 'already_verified' && deps.me) {
                    try {
                        const me = await deps.me();
                        if (me?.phone) {
                            const v = { name: me.name ?? '', phone: me.phone, provider: 'server' };
                            await deps.keep?.(v);
                            return { ok: true, ...v };
                        }
                    }
                    catch { /* 아래 안내로 */ }
                }
                return { ok: false, reason: err.toUpperCase() };
            }
            return this.finish(await openAuth(WebBrowser, init.url, deps.ret));
        },
        /** 복귀 URL → 결과 회수(1회용 토큰). init · start 공통 */
        async finish(r) {
            if (r.type !== 'success' || !r.url)
                return { ok: false, reason: 'CANCELED' };
            const p = parseQuery(r.url);
            if (p.ok !== '1')
                return { ok: false, reason: p.reason || 'FAILED' };
            if (!p.sid || !p.t)
                return { ok: false, reason: 'RESULT_LOST' };
            try {
                const res = await fetch(`${deps.base}/kiap/result?sid=${encodeURIComponent(p.sid)}&t=${encodeURIComponent(p.t)}`, { headers: headers() });
                const j = await res.json().catch(() => null);
                if (!j?.ok)
                    return { ok: false, reason: 'RESULT_LOST' };
                const v = { name: String(j.name ?? ''), phone: String(j.phone ?? ''), provider: String(j.provider ?? '') };
                await deps.keep?.(v);
                // 생년월일은 인증 결과에서 받는다 — 가입에서 다시 묻지 않게(스터디숲 #308). 가입 전 흐름은 signupToken 도 온다
                const extra = {};
                if (j.birth !== undefined)
                    extra.birth = typeof j.birth === 'string' ? j.birth : null;
                if (typeof j.signupToken === 'string')
                    extra.signupToken = j.signupToken;
                return { ok: true, ...v, ...extra };
            }
            catch {
                return { ok: false, reason: 'NETWORK' };
            }
        },
    };
}
