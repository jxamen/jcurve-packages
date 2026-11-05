"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAdsEnv = void 0;
exports.createRewarded = createRewarded;
/**
 * 보상형 광고 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다(꼬꼬농장 `src/ads/rewarded.ts` 에서 옮김).
 *
 * **이 파일은 앱을 모른다.** 광고 단위 ID·테스트 여부는 앱이 넘기고, 보상을 무엇으로 줄지·하루 몇 번인지는
 * 앱의 일이다. 여기는 「광고를 안전하게 띄우고 끝까지 봤는지 알려 주기」만 한다.
 *
 * ⚠ `require` 안의 이름은 **글자 그대로** 쓴다 — Metro 는 require 를 빌드 때 찾고, 변수로 주면 실행 때 던지는
 * 코드로 바꿔 모듈이 늘 없는 것처럼 돈다(`@jcurve/notify` 1.1.0 사고).
 */
const mode_1 = require("./mode");
const fullscreen_1 = require("./fullscreen");
const runtime_1 = require("./runtime");
const defaultAdsEnv = () => ({
    // 네이티브 모듈이 없으면(Expo Go) 여기서 예외가 나고 목업으로 넘어간다
    sdk: () => { try {
        return require('react-native-google-mobile-ads');
    }
    catch {
        return null;
    } },
    tracking: () => { try {
        return require('expo-tracking-transparency');
    }
    catch {
        return null;
    } },
    os: () => { try {
        return String(require('react-native').Platform.OS ?? '');
    }
    catch {
        return '';
    } },
    appState: () => { try {
        return require('react-native').AppState;
    }
    catch {
        return null;
    } },
    dev: () => typeof __DEV__ !== 'undefined' && !!__DEV__,
});
exports.defaultAdsEnv = defaultAdsEnv;
function withTimeout(p, ms) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), ms);
        p.then((value) => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); resolve(null); });
    });
}
/*
 | 광고가 연달아 안 채워지면(no-fill) 잠시 쉰다(꼬꼬농장 2026-09-09).
 | 눌러도 안 열리는 버튼을 계속 보여 주면 사용자가 앱을 못 믿는다. 세 번 잇달아 실패하면 30분 동안 광고 자리를
 | 접고, 한 번이라도 열리면 곧바로 되살린다 — 광고를 끄는 게 아니라 잠깐 접어 두는 것이다.
 */
const MUTE_AFTER = 3;
const MUTE_MS = 30 * 60 * 1000;
function createRewarded(opts, env = (0, exports.defaultAdsEnv)()) {
    let tiktok = opts.tiktok ?? null;
    const mod = env.sdk();
    const os = env.os();
    const test = env.dev() || opts.test;
    const unitOf = (u) => (os === 'ios' ? u?.ios : os === 'android' ? u?.android : '') ?? '';
    const nativeReady = !!((os === 'ios' || os === 'android') && mod?.RewardedAd && mod?.default);
    const unitReady = test || !!unitOf(opts.units.rewarded);
    const interstitialAvailable = nativeReady && !!mod?.RewardedInterstitialAd && (test || !!unitOf(opts.units.rewardedInterstitial));
    /*
     | **앱이 앞에 올라온 뒤에** 묻는다(1.3, 당근캐시 96ae2c7 에서 옮김). 그 전에 부르면 iOS 가 창을 띄우지 않고 조용히
     | 넘긴다 — 답이 미정(undetermined)으로 남는다. 전에는 한 실행에 한 번만 물어서 그 실행에서는 다시 안 떴다.
     | 이제 창 없이 넘어갔으면 기억을 지워 다음 호출(광고를 열 때 등)에 다시 묻는다.
     | 앞에 올라온 뒤 0.6초 — 첫 화면이 그려지기 전에 창이 뜨면 뒤가 빈 화면이다.
     */
    const SETTLE_MS = 600;
    const whenActive = () => new Promise((resolve) => {
        const st = env.appState();
        if (!st || st.currentState === 'active') {
            resolve();
            return;
        }
        let sub = null;
        try {
            sub = st.addEventListener('change', (s) => {
                if (s !== 'active')
                    return;
                try {
                    sub?.remove();
                }
                catch { /* noop */ }
                resolve();
            });
        }
        catch {
            resolve();
        }
    });
    let trackingP = null;
    let trackingGen = 0; // 창 없이 넘어간 **이번 시도만** 지운다 — 사이에 새로 시작한 것을 지우지 않게
    const requestTracking = () => {
        if (os !== 'ios')
            return Promise.resolve({ status: 'unavailable', timedOut: false });
        if (trackingP)
            return trackingP;
        const gen = ++trackingGen;
        const forget = () => { if (trackingGen === gen)
            trackingP = null; };
        trackingP = (async () => {
            try {
                const att = env.tracking();
                if (!att)
                    return { status: 'unavailable', timedOut: false }; // 모듈이 없는 빌드 — 묻지 못한 것이지 고장이 아니다
                await whenActive();
                await new Promise((r) => setTimeout(r, SETTLE_MS));
                const cur = (await withTimeout(att.getTrackingPermissionsAsync(), 3000));
                if (cur?.status !== 'undetermined') {
                    if (!cur?.status)
                        forget();
                    return { status: String(cur?.status ?? 'unknown'), timedOut: false };
                } // 이미 답했다 — 다시 묻지 않는다
                const form = await (0, runtime_1.waitForTrackingForm)(env, mod);
                if (!form) {
                    forget();
                    return { status: 'undetermined', timedOut: true };
                }
                if (env.appState()?.currentState !== 'active') {
                    form.release();
                    forget();
                    return { status: 'undetermined', timedOut: false };
                }
                const latest = (await withTimeout(Promise.resolve().then(() => att.getTrackingPermissionsAsync()), 3000));
                if (latest?.status !== 'undetermined') {
                    form.release();
                    if (!latest?.status)
                        forget();
                    return { status: String(latest?.status ?? 'unknown'), timedOut: false };
                }
                /*
                 | 20초 시간 초과와 창이 닫힌 것을 가른다(민트런 시험 2026-10-01) — 시간 초과면 창이 아직 떠 있을 수 있어
                 | 앱은 다음 권한 창(알림)을 부르기 전에 앱이 앞으로 돌아오는 것(AppState active)을 더 기다려야 한다.
                 */
                let timedOut = false;
                let timeout = null;
                const native = Promise.resolve().then(() => {
                    if (env.appState()?.currentState !== 'active')
                        throw new Error('앱이 앞에 있을 때 추적 동의를 확인할 수 있어요');
                    return att.requestTrackingPermissionsAsync();
                });
                void native.then(() => form.release(), () => form.release()); // Real native completion owns the lease.
                const after = (await Promise.race([
                    native.catch(() => null),
                    new Promise((r) => { timeout = setTimeout(() => { timedOut = true; r(null); }, 20000); }),
                ]));
                if (timeout !== null)
                    clearTimeout(timeout);
                if (!after || after.status === 'undetermined')
                    forget(); // 창 없이 넘어갔거나 시간 초과 — 다음 호출에 다시 묻는다
                return { status: String(after?.status ?? 'undetermined'), timedOut };
            }
            catch {
                forget();
                return { status: 'unknown', timedOut: false };
            }
        })();
        return trackingP;
    };
    // 값을 얻었을 때만 기억한다 — 아직 허용 전이면 나중에 허용된 뒤 다시 읽는다
    let adidCache = null;
    const advertisingId = async () => {
        if (adidCache)
            return adidCache;
        try {
            const att = env.tracking();
            if (!att)
                return null;
            if (os === 'ios') {
                const cur = (await withTimeout(att.getTrackingPermissionsAsync(), 3000));
                if (!(cur?.granted === true || cur?.status === 'granted'))
                    return null;
            }
            const id = typeof att.getAdvertisingId === 'function' ? att.getAdvertisingId() : null;
            const v = typeof id === 'string' && id !== '' && !/^[0-]+$/.test(id) ? id : null;
            if (v)
                adidCache = v;
            return v;
        }
        catch {
            return null;
        }
    };
    const fullscreen = (0, fullscreen_1.createFullscreen)(env, mod);
    let failStreak = 0;
    let mutedUntil = 0;
    const noteAdFail = () => {
        failStreak += 1;
        if (failStreak >= MUTE_AFTER) {
            mutedUntil = Date.now() + MUTE_MS;
            failStreak = 0;
        }
    };
    const noteAdOpen = () => { failStreak = 0; mutedUntil = 0; };
    /**
     * SSV 값에 기기 ID 를 끼운다 — **JSON 객체로 온 값에만**.
     * 'feed' 처럼 맨 문자열을 보내는 앱의 뜻을 바꾸면 서버 판정이 어긋난다.
     * 앱이 이미 `dev` 를 넣어 보냈으면 그대로 둔다(앱 쪽이 먼저다).
     */
    const withDevice = (customData) => {
        const dev = (opts.device?.() ?? '').slice(0, 64);
        /*
         | 광고 식별자(adid)는 **전 앱 합산 상한**의 기준이다(1.5, 2026-09-23 — 서버가 폰 하나당 하루 몇 회로 센다).
         | 앱이 스스로 만든 기기 ID 는 앱을 넘지 못해 합산이 안 된다.
         | **이미 읽어 둔 값만** 쓴다 — 여기서 기다리면 광고 여는 것이 늦어진다. 아직 없으면 지금 읽어 두고
         | 이번 광고만 없이 나간다(다음 광고부터 실린다). 추적을 껐거나 iOS 미동의면 영영 없고, 그건 그대로 둔다.
         */
        if (opts.adid && !adidCache)
            void advertisingId();
        const adid = opts.adid ? (adidCache ?? '').slice(0, 64) : '';
        const body = (customData ?? '').trim();
        if ((!dev && !adid) || body === '')
            return customData;
        const add = {};
        if (dev)
            add.dev = dev;
        if (adid)
            add.adid = adid;
        /*
         | **용도를 평문으로 보내는 앱**(당근 `harvest` · 영테크 `ticket` · 꾹테크 `stamp_main`)은
         | `{"purpose":"<평문>", dev, adid}` 로 감싼다(1.5.1). 감싸지 않으면 그 앱들에는 기기 ID·광고
         | 식별자가 영영 안 실린다 — 전 앱 합산의 기준이 그 값이라 앱마다 구멍이 남는다.
         | 서버는 평문과 이 모양을 **둘 다** 받는다(jcurve-api 51b46b6). 서버가 먼저 나가야 한다.
         */
        if (!body.startsWith('{') || !body.endsWith('}')) {
            return JSON.stringify({ purpose: body, ...add });
        }
        try {
            const o = JSON.parse(body);
            if (!o || typeof o !== 'object' || Array.isArray(o))
                return customData;
            for (const k of Object.keys(add)) {
                if (k in o)
                    delete add[k];
            } // 앱이 이미 넣은 값은 덮지 않는다
            return Object.keys(add).length > 0 ? JSON.stringify({ ...o, ...add }) : customData;
        }
        catch {
            return customData; // 우리가 못 읽는 모양이면 건드리지 않는다
        }
    };
    const makeAd = (request, userId, customData, interstitial = false) => {
        const { RewardedAd, RewardedInterstitialAd, TestIds } = mod;
        // 보상형 전면도 이벤트·SSV 가 보상형과 같다 — 만드는 클래스와 광고 단위만 다르다
        if (interstitial) {
            const unit = test ? TestIds.REWARDED_INTERSTITIAL : unitOf(opts.units.rewardedInterstitial);
            return RewardedInterstitialAd.createForAdRequest(unit, { ...request, ...(0, mode_1.ssvRequestOptions)(test, userId, withDevice(customData)) });
        }
        const unit = test ? TestIds.REWARDED : unitOf(opts.units.rewarded);
        return RewardedAd.createForAdRequest(unit, { ...request, ...(0, mode_1.ssvRequestOptions)(test, userId, withDevice(customData)) });
    };
    /*
     | **광고는 보여 줄 때만 받는다**(1.2, 2026-09-22 사용자 결정 「미리 받아 오는 거 없애자」).
     | 전에는 안내 팝업이 뜰 때(warm)와 광고를 닫은 1.5초 뒤 다음 것을 미리 받아 두었다(2026-08-27 · 09-08). 받아 두고
     | 안 보여 준 광고는 AdMob 에 요청만 있고 노출은 없는 것으로 쌓인다. 대가는 누를 때마다 몇 초의 로딩이다.
     | warm · warmReady 는 부르는 앱이 깨지지 않게 이름만 남긴다.
     */
    const warm = (_userId, _customData, _interstitial = false) => { };
    const warmReady = (_userId, _customData, _interstitial = false) => false;
    async function show(o) {
        const interstitial = o.interstitial ?? false;
        if (!nativeReady || !(interstitial ? interstitialAvailable : unitReady)) {
            (0, runtime_1.safeCall)(o.onFail, '이 빌드에서는 광고를 재생할 수 없어요', true);
            return false;
        }
        return fullscreen.show({
            callbacks: o,
            rewarded: true,
            prepare: (stillNeeded) => (0, runtime_1.prepareRequest)(env, mod, opts, stillNeeded, async () => {
                // Preserve automatic ATT, sequentially after UMP (never overlapping two forms).
                if (os === 'ios') {
                    const att = env.tracking();
                    const current = att ? await withTimeout(Promise.resolve(att.getTrackingPermissionsAsync()), 3000) : null;
                    if (!stillNeeded())
                        throw new Error('광고를 그만뒀어요');
                    if (current?.status === 'undetermined') {
                        const tracking = await requestTracking();
                        if (tracking.timedOut)
                            throw new Error('추적 권한 확인이 아직 끝나지 않았어요');
                    }
                }
            }),
            makeAd: (request) => makeAd(request, o.userId, o.customData, interstitial),
            onOpen: () => { noteAdOpen(); try {
                tiktok?.adImpression();
            }
            catch { /* noop */ } },
            onFailure: () => { if (!interstitial)
                noteAdFail(); },
        });
    }
    /*
     | 결과 하나로(1.8) — 보상이 닫힘보다 먼저 오면 닫힐 때, 닫힘 뒤에 오면 그때, 끝내 안 오면 엔진의 onFail(닫힘 1.2초 뒤)에서 끝낸다.
     | 앱 타이머가 끼어들 자리가 없다.
     */
    const play = (o) => new Promise((resolve) => {
        let earned = false;
        let closed = false;
        let opened = false;
        let done = false;
        const finish = (r) => { if (!done) {
            done = true;
            resolve(r);
        } };
        void show({
            ...o,
            onOpened: () => { opened = true; try {
                o.onOpened?.();
            }
            catch { /* noop */ } },
            onEarned: () => { earned = true; if (closed)
                finish({ earned: true, opened: true, busy: false, noAd: false }); },
            onClosed: () => { closed = true; if (earned)
                finish({ earned: true, opened: true, busy: false, noAd: false }); },
            onFail: (message, noAd) => finish({ earned: false, opened, busy: false, noAd: !!noAd, message }),
            // 그만두기 · 걸림 풀기 — 이미 보상이 왔으면 본 것으로(서버 SSV 는 그대로 온다)
            onAbort: (noAd) => finish(earned ? { earned: true, opened, busy: false, noAd: false } : { earned: false, opened, busy: false, noAd: noAd ?? !opened, message: '광고를 그만뒀어요' }),
        }).then((started) => {
            if (!started && !done)
                finish({ earned: false, opened: false, busy: true, noAd: false });
        }, () => finish({ earned: false, opened, busy: false, noAd: !opened, message: '광고를 열지 못했어요' }));
    });
    return {
        available: nativeReady && unitReady,
        play,
        interstitialAvailable,
        show,
        warm,
        warmReady,
        cancel: fullscreen.cancel,
        mutedMs: () => Math.max(0, mutedUntil - Date.now()),
        requestTracking,
        advertisingId,
        setTikTok: (t) => { tiktok = t; },
    };
}
