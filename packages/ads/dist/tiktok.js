"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTikTok = createTikTok;
/**
 * 틱톡 광고 전환(TikTok Business SDK) — **광고는 전부 이 패키지**(1.7, 2026-10-02 대표님 「TikTok까지 패키지로 … 광고는 다」).
 * 앱총괄이 10개 앱에 따로 넣은 코드(당근캐시 release/tiktok 이 본보기)를 옮겼다. 앱마다 다른 것은 **설정 그룹 이름**뿐이다.
 *
 * 보내는 것:
 *  ① 설치 · 실행 — SDK 가 스스로 센다(InstallApp · LaunchAPP). 그래서 **앱이 켜질 때** 켠다(`boot`) — 로그인 전 설치가 핵심.
 *  ② 보상형 광고 열람(InAppADImpr) — `createRewarded({ tiktok })` 이면 광고가 열린 순간 패키지가 보낸다(앱 코드 없음).
 *  ③ 가입(Registration) · 로그인 — `track('signup_done' | 'login_done')`. 앱만의 이벤트는 `events` 로 더한다.
 *  ④ 회원 — `identify(회원번호)` 만(이름 · 전화 · 이메일은 보내지 않는다), `logout()`.
 *
 * **열쇠와 틱톡 앱 ID 는 번들에 굽지 않는다** — 어드민 「앱 설정」(custom)의 `{그룹}.tiktok_sdk_access` ·
 * `{그룹}.tiktok_android_sdk_access`(없으면 공용) · `{그룹}.tiktok_app_id_ios` · `{그룹}.tiktok_app_id_android` 를
 * 켤 때 읽는다(새 빌드 없이 재발급 · 교체). 시크릿이나 그 플랫폼 ID 가 비면 그 플랫폼은 꺼져 있다(앱은 그대로 돈다).
 *
 * **ATT 창은 여기서 띄우지 않는다** — 켜는 순간 설치가 나가므로 iOS 는 `waitForTracking`(보통 `ads.requestTracking`)의
 * 답을 기다린 뒤 켠다(30초 상한). 같은 약속이라 창이 두 번 뜨지 않는다. 안드로이드는 기다리지 않는다.
 *
 * **네이티브 모듈이 없는 빌드에서도 같은 JS 가 돈다**(OTA 로 옛 빌드에 내려가도) — 모듈이 없으면 전부 아무 일도 안 한다.
 * 인앱 결제 자동 추적은 네이티브에서 끈다(안드 `disableAutoIapTrack`).
 */
const tiktok_map_1 = require("./tiktok.map");
const defaultEnv = () => ({
    // 글자 그대로 require — Metro 가 빌드 때 찾는다(@jcurve/notify 1.1.0 사고). 모듈이 없는 빌드는 null(던지지 않음)
    native: () => {
        try {
            const core = require('expo-modules-core');
            return core.requireOptionalNativeModule?.('JcurveTikTok') ?? null;
        }
        catch {
            return null;
        }
    },
    os: () => { try {
        return String(require('react-native').Platform.OS ?? '');
    }
    catch {
        return '';
    } },
    extra: () => {
        try {
            const c = require('expo-constants');
            return c.default?.expoConfig?.extra ?? {};
        }
        catch {
            return {};
        }
    },
    appState: () => { try {
        return require('react-native').AppState;
    }
    catch {
        return null;
    } },
    log: (...a) => { try {
        console.log(...a);
    }
    catch { /* noop */ } },
});
const ATT_WAIT_MS = 30000;
function createTikTok(opts, env = defaultEnv()) {
    const os = env.os();
    let native;
    const mod = () => {
        if (native === undefined)
            native = os === 'ios' || os === 'android' ? env.native() : null;
        return native ?? null;
    };
    let state = 'off';
    let token = '';
    let pending = [];
    let lastIdentity = null;
    /** 켜지기 전 이벤트는 잠깐 모아 둔다(켜자마자 가입하는 사람) — 넘치면 오래된 것부터 버린다 */
    const whenOn = (fn) => {
        if (state === 'on') {
            try {
                fn();
            }
            catch { /* 계측이 앱을 막지 않는다 */ }
            return;
        }
        pending.push(fn);
        if (pending.length > 20)
            pending = pending.slice(-20);
    };
    const attSettled = () => {
        if (os !== 'ios' || !opts.waitForTracking)
            return Promise.resolve();
        let p;
        try {
            p = Promise.resolve(opts.waitForTracking());
        }
        catch {
            return Promise.resolve();
        }
        return Promise.race([
            p.then(() => undefined, () => undefined),
            new Promise((ok) => setTimeout(ok, ATT_WAIT_MS)),
        ]);
    };
    const start = (values) => {
        const m = mod();
        if (!m)
            return;
        const next = (0, tiktok_map_1.tiktokSecret)(opts.group, os, values);
        if (!next)
            return;
        if (state === 'on') {
            if (next !== token) {
                token = next;
                try {
                    m.updateAccessToken(next);
                }
                catch { /* noop */ }
            }
            return;
        }
        if (state === 'starting')
            return;
        const ex = env.extra();
        const ids = (0, tiktok_map_1.tiktokIds)(opts.group, os, {
            appleAppId: opts.appleAppId || ex.appleAppId, androidPackage: opts.androidPackage || ex.androidPackage,
        }, values);
        if (!ids)
            return;
        state = 'starting';
        token = next;
        const debug = !!opts.test;
        attSettled().then(() => m.initialize(token, ids.appId, ids.tiktokAppId, debug)).then((code) => {
            state = 'on';
            // 시험 빌드에서만 — 이벤트 관리자 › 테스트 이벤트에 넣는 코드
            if (debug)
                env.log('[tiktok] on · test event code', code ?? '(none)');
            const run = pending;
            pending = [];
            run.forEach((fn) => { try {
                fn();
            }
            catch { /* 하나가 실패해도 나머지는 보낸다 */ } });
        }).catch((e) => {
            state = 'off';
            if (debug)
                env.log('[tiktok] init failed', e instanceof Error ? e.message : String(e));
        });
    };
    let watching = false;
    const boot = (load) => {
        const go = () => {
            let p;
            try {
                p = load();
            }
            catch {
                return;
            }
            void Promise.resolve(p).then((v) => start(v), () => undefined);
        };
        go();
        if (watching)
            return;
        watching = true;
        try {
            env.appState()?.addEventListener('change', (s) => { if (s === 'active')
                go(); });
        }
        catch { /* noop */ }
    };
    const track = (name, params) => {
        const m = mod();
        if (!m)
            return;
        const ev = (0, tiktok_map_1.tiktokEventFor)(name, params, opts.events);
        if (!ev)
            return;
        whenOn(() => {
            if ('standard' in ev)
                m.trackStandard(ev.standard);
            else
                m.trackCustom(ev.custom);
        });
    };
    const adImpression = () => {
        const m = mod();
        if (!m)
            return;
        whenOn(() => m.trackStandard('ad_impression'));
    };
    const identify = (memberId) => {
        const m = mod();
        if (!m || memberId == null || memberId === '')
            return;
        const id = String(memberId);
        if (id === lastIdentity)
            return;
        lastIdentity = id;
        // 켜지기 전에 로그아웃했으면 모아 둔 identify 는 버린다
        whenOn(() => { if (lastIdentity === id)
            m.identify(id, null, null, null); });
    };
    const logout = () => {
        const m = mod();
        lastIdentity = null;
        if (!m || state !== 'on')
            return;
        try {
            m.logout();
        }
        catch { /* noop */ }
    };
    return { start, boot, track, adImpression, identify, logout, isOn: () => state === 'on' };
}
