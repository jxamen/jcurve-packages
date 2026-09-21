"use strict";
/**
 * 가입 퍼널을 **우리 서버**(jcurve-api `{app}/funnel`)에 남긴다.
 *
 * GA4 에 가는 같은 이벤트를 조회 권한 없이도 볼 수 있어야 해서다 — 설치 79건에 가입 20명일 때
 * 어디서 멈추는지(앱을 안 열었는지·로그인 화면에서 떠났는지) 서버 기록만으로는 알 수 없었다
 * (꼬꼬농장 2026-09-15).
 *
 * **앱마다 이름이 같아야 한다.** 어드민의 「시간대별 가입 비교」·퍼널은 이 이름으로 앱을 나란히
 * 놓는다. 앱마다 `login_click`·`tap_login` 처럼 제각각이면 비교가 깨진다 — 그래서 로그인과 한
 * 패키지에 둔다.
 *
 * **개인정보를 보내지 않는다** — 설치 때 만든 난수 기기 ID·단계·플랫폼·앱 버전·짧은 꼬리표뿐.
 * 실패해도 조용히 넘긴다(계측이 앱을 막으면 안 된다).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FUNNEL_EVENTS = void 0;
exports.looksPersonal = looksPersonal;
exports.referrerKeys = referrerKeys;
exports.createFunnel = createFunnel;
/**
 * 서버가 받는 이벤트 — **jcurve-api `FunnelController::EVENTS` 와 같아야 한다.**
 *
 * 여기 없는 이름은 보내지 않는다. 서버에 없는 이름을 보내면 400 으로 버려지는데, 앱에서는
 * 아무 오류도 안 보여 「그 단계만 조용히 비어 있다」로만 드러난다.
 */
exports.FUNNEL_EVENTS = [
    'first_open', 'app_open',
    'onboarding_view', 'onboarding_done',
    'login_view', 'login_tap', 'login_cancel', 'login_fail', 'login_done', 'login_native_fallback',
    'signup_start', 'signup_terms_view', 'signup_terms_done', 'signup_done', 'signup_abort', 'signup_fail',
    'install_ref',
    'guest_tap', 'guest_start', 'guest_signup_view',
];
/**
 * 개인정보처럼 보이는 값인가 — 이메일(@) 이나 숫자가 7개 넘게 이어진 것(전화번호·회원번호).
 *
 * 「개인정보를 보내지 않는다」가 약속뿐이면 언젠가 누가 `reason` 에 번호를 넣는다(Codex #9).
 * 완전한 차단은 아니다 — **눈에 띄는 것**만 막는다. 이름 같은 것은 부르는 쪽이 넣지 않아야 한다.
 */
function looksPersonal(v) {
    const s = String(v);
    // 이메일 · 숫자 7개 넘게 이어짐 · 하이픈·점·공백으로 끊은 전화번호(010-1234-5678)도(Codex 2차 #6)
    return /@|\d{7,}|\d{2,4}[-.\s]\d{3,4}[-.\s]\d{4}/.test(s);
}
function mod(load) {
    try {
        return load();
    }
    catch {
        return null;
    }
}
function defaultEnv() {
    return {
        os: () => String(mod(() => require('react-native'))?.Platform?.OS ?? ''),
        appVersion: () => String(mod(() => require('expo-updates'))?.runtimeVersion ?? ''),
        post: (url, headers, body) => fetch(url, { method: 'POST', headers, body }).then((r) => r.ok).catch(() => false),
        /*
         | expo-application 은 네이티브 모듈이 없으면 **불러오는 순간 던진다** — 있는지 먼저 본다.
         | iOS 에는 설치 리퍼러가 없다.
         */
        install: async () => {
            const core = mod(() => require('expo-modules-core'));
            if (!core?.requireOptionalNativeModule?.('ExpoApplication'))
                return null;
            const A = mod(() => require('expo-application'));
            if (!A)
                return null;
            const inst = await A.getInstallationTimeAsync().catch(() => null);
            if (!inst)
                return null;
            const ref = String((await A.getInstallReferrerAsync().catch(() => '')) ?? '');
            return { at: inst.getTime(), ref: referrerKeys(ref) };
        },
        now: () => Date.now(),
        random: () => Math.random().toString(36).slice(2, 12),
    };
}
/**
 * 설치 리퍼러에서 **광고 추적에 쓰는 키만** 남긴다(Codex 2차 #6).
 *
 * 원문을 그대로 보내면 무엇이 들어 있든 서버에 남는다. 광고 전환과 맞대어 보는 데 필요한 것은
 * 캠페인 표시(utm_*)와 광고 클릭 번호(gclid·gbraid·wbraid·anid)뿐이다. 모양은 그대로 `키=값&…` 이다.
 *
 * **값도 본다**(Codex 3차) — 키만 맞으면 `utm_term=홍길동@…` 처럼 무엇이든 실린다. 캠페인 값에
 * 번호·이메일이 보이면 그 쌍을 버리고, 클릭 번호는 영숫자·`_`·`-` 모양이 아니면 버린다.
 */
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const CLICK_KEYS = ['gclid', 'gbraid', 'wbraid', 'anid'];
function referrerKeys(raw) {
    return String(raw ?? '').split('&').filter((kv) => {
        const i = kv.indexOf('=');
        try {
            const k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i)).toLowerCase();
            const v = decodeURIComponent((i < 0 ? '' : kv.slice(i + 1)).replace(/\+/g, ' '));
            if (CLICK_KEYS.includes(k))
                return /^[A-Za-z0-9_-]*$/.test(v);
            return CAMPAIGN_KEYS.includes(k) && !looksPersonal(v);
        }
        catch {
            return false;
        }
    }).join('&');
}
/** 설치 출처는 14일이 지난 설치면 보내지 않는다 — 광고 전환과 맞대어 볼 수 있는 기간이다 */
const INSTALL_WINDOW = 14 * 86400000;
function createFunnel(deps, env = defaultEnv()) {
    const DEVICE_KEY = deps.keys?.device ?? 'jc.device.v1';
    const REF_KEY = deps.keys?.installRef ?? 'jc.installRef.v1';
    const url = deps.base.replace(/\/+$/, '') + '/funnel';
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-App-Token': deps.appToken };
    let deviceP = null;
    /** 기기 임시 ID — 처음이면 만들고(fresh) 저장한다. 계정이 바뀌어도 그대로다(설치 단위) */
    function device() {
        if (!deviceP) {
            deviceP = (async () => {
                let saved;
                try {
                    saved = await deps.storage.getItem(DEVICE_KEY);
                }
                catch {
                    /*
                     | **읽지 못한 것과 없는 것은 다르다**(Codex #7). 못 읽었는데 새로 만들어 저장하면 멀쩡한
                     | 기기 ID 를 덮어써, 그 사람이 「첫 실행」으로 한 번 더 찍힌다. 이번 실행만 임시 ID 로
                     | 보내고 첫 실행으로 세지 않는다 — 저장된 것은 건드리지 않는다.
                     */
                    return { id: 'tmp-' + env.now().toString(36) + '-' + env.random(), fresh: false };
                }
                if (saved)
                    return { id: saved, fresh: false };
                const id = env.now().toString(36) + '-' + env.random();
                let stored = false;
                try {
                    await deps.storage.setItem(DEVICE_KEY, id);
                    stored = true;
                }
                catch { /* 이번 실행만 쓴다 */ }
                // 저장하지 못했으면 다음 실행에 또 새 ID 가 생긴다 — 그때마다 첫 실행으로 세면 부풀어 보인다
                if (!stored)
                    return { id, fresh: false };
                let used = false;
                try {
                    used = !!(await deps.existingUser?.());
                }
                catch { /* 모르면 새 설치로 본다 */ }
                return { id, fresh: !used };
            })();
        }
        return deviceP;
    }
    /** 절대 던지지 않는다 — 앱이 준 `post` 가 거절해도 처리되지 않은 거절로 새지 않게(Codex #8) */
    const post = (id, event, extra) => Promise.resolve()
        .then(() => env.post(url, headers, JSON.stringify({
        device: id, event, platform: env.os() === 'ios' ? 'ios' : 'android', v: env.appVersion(), ...extra,
    })))
        .catch(() => false);
    async function sendInstallRef(id) {
        if (env.os() !== 'android')
            return;
        try {
            if (await deps.storage.getItem(REF_KEY))
                return;
            const inst = await env.install();
            if (!inst)
                return;
            if (env.now() - inst.at > INSTALL_WINDOW) {
                await deps.storage.setItem(REF_KEY, 'old');
                return;
            }
            // 보낸 것이 확인됐을 때만 표시한다 — 실패하면 다음 실행에 다시 보낸다
            if (await post(id, 'install_ref', { ref: inst.ref.slice(0, 300), inst: inst.at }))
                await deps.storage.setItem(REF_KEY, '1');
        }
        catch { /* 계측 실패는 넘긴다 */ }
    }
    return {
        event(name, prop) {
            if (!exports.FUNNEL_EVENTS.includes(name) || env.os() === 'web')
                return;
            // 개인정보처럼 보이면 꼬리표를 통째로 뺀다 — 글자를 걸러 내는 것만으로는 전화번호가 그대로 통과한다
            const p = prop && !looksPersonal(prop) ? prop.replace(/[^A-Za-z0-9_:.-]/g, '').slice(0, 40) : '';
            void device().then((d) => post(d.id, name, p ? { p } : undefined)).catch(() => undefined);
        },
        appOpen() {
            if (env.os() === 'web')
                return;
            void device().then((d) => {
                if (d.fresh)
                    void post(d.id, 'first_open');
                void post(d.id, 'app_open');
                void sendInstallRef(d.id);
            }).catch(() => undefined);
        },
    };
}
