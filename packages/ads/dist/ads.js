"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const defaultEnv = () => ({
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
function withTimeout(p, ms) {
    return Promise.race([p.catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);
}
/*
 | 광고가 연달아 안 채워지면(no-fill) 잠시 쉰다(꼬꼬농장 2026-09-09).
 | 눌러도 안 열리는 버튼을 계속 보여 주면 사용자가 앱을 못 믿는다. 세 번 잇달아 실패하면 30분 동안 광고 자리를
 | 접고, 한 번이라도 열리면 곧바로 되살린다 — 광고를 끄는 게 아니라 잠깐 접어 두는 것이다.
 */
const MUTE_AFTER = 3;
const MUTE_MS = 30 * 60 * 1000;
function createRewarded(opts, env = defaultEnv()) {
    const mod = env.sdk();
    const os = env.os();
    const test = env.dev() || opts.test;
    const unitOf = (u) => (os === 'ios' ? u?.ios : os === 'android' ? u?.android : '') ?? '';
    const nativeReady = !!(mod && mod.RewardedAd && mod.default);
    const unitReady = test || !!unitOf(opts.units.rewarded);
    const interstitialAvailable = nativeReady && !!mod?.RewardedInterstitialAd && (test || !!unitOf(opts.units.rewardedInterstitial));
    /*
     | **앱 시작에 초기화하지 않는다** — 광고를 한 번도 안 봐도 SDK 가 계속 돌아 기기가 더워졌다(꼬꼬농장 2026-08-26).
     | 첫 광고 직전에 부르므로 기능상 차이는 첫 광고의 로딩이 조금 길어지는 것뿐이다.
     */
    let initDone = null;
    const ensureInit = () => {
        if (!nativeReady)
            return Promise.resolve(null);
        if (!initDone) {
            initDone = (async () => {
                // 등록된 테스트 기기 — 초기화 **전에** 알려야 첫 광고부터 테스트 광고가 나온다
                if (opts.testDevices && opts.testDevices.length > 0) {
                    await Promise.resolve(mod.default().setRequestConfiguration({ testDeviceIdentifiers: opts.testDevices })).catch(() => null);
                }
                return mod.default().initialize();
            })().catch(() => null);
        }
        return withTimeout(initDone, 5000);
    };
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
            return Promise.resolve();
        if (trackingP)
            return trackingP;
        const gen = ++trackingGen;
        const forget = () => { if (trackingGen === gen)
            trackingP = null; };
        trackingP = (async () => {
            try {
                const att = env.tracking();
                if (!att)
                    return; // 모듈이 없는 빌드 — 묻지 못한 것이지 고장이 아니다
                await whenActive();
                await new Promise((r) => setTimeout(r, SETTLE_MS));
                const cur = (await withTimeout(att.getTrackingPermissionsAsync(), 3000));
                if (cur?.status !== 'undetermined')
                    return; // 이미 답했다(허용·거부) — 다시 묻지 않는다
                const after = (await withTimeout(att.requestTrackingPermissionsAsync(), 20000));
                if (!after || after.status === 'undetermined')
                    forget(); // 창 없이 넘어갔다 — 다음 호출에 다시 묻는다
            }
            catch {
                forget();
            }
        })();
        return trackingP;
    };
    let showing = false;
    let showingAt = 0;
    let stage = '';
    let failStreak = 0;
    let mutedUntil = 0;
    let abortCurrent = null;
    const noteAdFail = () => {
        failStreak += 1;
        if (failStreak >= MUTE_AFTER) {
            mutedUntil = Date.now() + MUTE_MS;
            failStreak = 0;
        }
    };
    const noteAdOpen = () => { failStreak = 0; mutedUntil = 0; };
    const makeAd = (userId, customData, interstitial = false) => {
        const { RewardedAd, RewardedInterstitialAd, TestIds } = mod;
        // 보상형 전면도 이벤트·SSV 가 보상형과 같다 — 만드는 클래스와 광고 단위만 다르다
        if (interstitial) {
            const unit = test ? TestIds.REWARDED_INTERSTITIAL : unitOf(opts.units.rewardedInterstitial);
            return RewardedInterstitialAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: false, ...(0, mode_1.ssvRequestOptions)(test, userId, customData) });
        }
        const unit = test ? TestIds.REWARDED : unitOf(opts.units.rewarded);
        return RewardedAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: false, ...(0, mode_1.ssvRequestOptions)(test, userId, customData) });
    };
    /*
     | **광고는 보여 줄 때만 받는다**(1.2, 2026-09-22 사용자 결정 「미리 받아 오는 거 없애자」).
     | 전에는 안내 팝업이 뜰 때(warm)와 광고를 닫은 1.5초 뒤 다음 것을 미리 받아 두었다(2026-08-27 · 09-08). 받아 두고
     | 안 보여 준 광고는 AdMob 에 요청만 있고 노출은 없는 것으로 쌓인다. 대가는 누를 때마다 몇 초의 로딩이다.
     | warm · warmReady 는 부르는 앱이 깨지지 않게 이름만 남긴다.
     */
    const warm = (_userId, _customData, _interstitial = false) => { };
    const warmReady = (_userId, _customData, _interstitial = false) => false;
    async function show({ userId, customData, interstitial = false, onEarned, onFail, onClosed, onOpened }) {
        if (!nativeReady) {
            onFail('이 빌드에서는 광고를 재생할 수 없어요', true);
            return false;
        }
        const appState = env.appState();
        const elapsed = Date.now() - showingAt;
        if (showing) {
            // 걸린 채 남은 표시를 푼다 — 받기·열기가 12초 넘게 멈췄거나, 광고가 닫혔는데 닫힘을 못 받았을 때
            const stuckLoad = (stage === 'load' || stage === 'init' || stage === 'show') && elapsed >= 12000;
            const missedClose = stage === 'open' && elapsed >= 1500 && (appState?.currentState ?? 'active') === 'active';
            if (!stuckLoad && !missedClose)
                return false;
            abortCurrent?.();
        }
        showing = true;
        showingAt = Date.now();
        void requestTracking();
        stage = 'init';
        try {
            await ensureInit();
        }
        catch { /* 아래에서 요청을 시도하고 안 되면 ERROR 로 안내된다 */ }
        const { RewardedAdEventType, AdEventType } = mod;
        const ad = makeAd(userId, customData, interstitial);
        let earned = false;
        let opened = false;
        let finished = false;
        let sawBg = false;
        const offs = [];
        const timers = [];
        let appSub = null;
        const cleanup = () => {
            abortCurrent = null;
            showing = false;
            stage = '';
            try {
                appSub?.remove();
            }
            catch { /* noop */ }
            appSub = null;
            offs.forEach((f) => { try {
                f();
            }
            catch { /* noop */ } });
            offs.length = 0;
            timers.forEach((t) => clearTimeout(t));
            timers.length = 0;
        };
        abortCurrent = () => { finished = true; cleanup(); };
        const safe = (f, ...args) => { try {
            f?.(...args);
        }
        catch { /* noop */ } };
        /*
         | 광고를 끝까지 봤는데 「끝까지 보지 않았어요」가 뜨고 보상도 안 들어왔다(꼬꼬농장 2026-09-08).
         | EARNED_REWARD 가 CLOSED **뒤에** 오는 기기가 있다 — 마지막 순간에 X 를 누르면 특히 그렇다.
         | 닫힘 직후 잠깐(1.2초) 리스너를 살려 두고, 그사이 보상이 오면 정상 지급한다.
         */
        const finishClose = () => {
            if (finished)
                return;
            finished = true;
            safe(onClosed);
            if (earned) {
                cleanup();
                return;
            }
            timers.push(setTimeout(() => {
                const got = earned;
                cleanup();
                if (!got)
                    safe(onFail, '광고를 끝까지 보지 않았어요', false); // 열렸다가 중간에 닫았다
            }, 1200));
        };
        const fail = (msg) => {
            if (finished)
                return;
            finished = true;
            // 보상형 전면(재고가 자주 빈다)의 실패는 자리 접기 횟수에 넣지 않는다 — 전면이 몇 번 비었다고 멀쩡한
            // 「광고 보고 받기」까지 30분 접혔다(꼬꼬농장 2026-09-14). 전면이 실패하면 부르는 쪽이 보상형으로 잇는다
            if (!interstitial)
                noteAdFail();
            cleanup();
            safe(onFail, msg, !opened); // 열리기 전에 실패했으면 noAd
        };
        const present = () => {
            stage = 'show';
            let p;
            try {
                p = ad.show();
            }
            catch (e) {
                fail('광고를 열지 못했어요 (' + String(e?.message ?? e ?? '원인 불명') + ')');
                return;
            }
            if (p && typeof p.then === 'function') {
                p.catch((e) => {
                    if (!opened)
                        fail('광고를 열지 못했어요 (' + String(e?.message ?? e ?? '원인 불명') + ')');
                });
            }
        };
        stage = 'load';
        offs.push(ad.addAdEventListener(RewardedAdEventType.LOADED, present));
        offs.push(ad.addAdEventListener(AdEventType.OPENED, () => {
            opened = true;
            stage = 'open';
            noteAdOpen();
            safe(onOpened);
        }));
        offs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; safe(onEarned); }));
        offs.push(ad.addAdEventListener(AdEventType.CLOSED, () => finishClose()));
        offs.push(ad.addAdEventListener(AdEventType.ERROR, (err) => {
            const code = String(err?.code ?? err?.message ?? '');
            fail(/no.?fill/i.test(code)
                ? '지금은 볼 수 있는 광고가 없어요. 잠시 후 다시 시도해 주세요'
                : '광고를 불러오지 못했어요 (' + (code || '원인 불명') + ')');
        }));
        // 닫힘 이벤트를 못 받는 기기 — 앱이 뒤로 갔다 돌아오면 닫힌 것으로 본다
        try {
            appSub = appState?.addEventListener('change', (s) => {
                if (s !== 'active') {
                    sawBg = true;
                    return;
                }
                if (sawBg && opened && !finished)
                    finishClose();
            }) ?? null;
        }
        catch {
            appSub = null;
        }
        try {
            ad.load();
        }
        catch (e) {
            fail('광고를 열지 못했어요 (' + String(e?.message ?? e ?? '원인 불명') + ')');
            return false;
        }
        /*
         | 광고가 없으면 ERROR 가 몇 초 안에 오므로, 여기까지 오는 것은 SDK 가 응답을 안 주는 경우다 — 더 기다려도
         | 소용없다. 25초는 화면이 덮인 채 멈춘 줄 알았다는 제보가 와서(2026-09-10) 15초.
         */
        timers.push(setTimeout(() => {
            if (!opened && !finished)
                fail('광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요 (' + stage + ')');
        }, 15000));
        return true;
    }
    return {
        available: nativeReady && unitReady,
        interstitialAvailable,
        show,
        warm,
        warmReady,
        cancel: () => { abortCurrent?.(); },
        mutedMs: () => Math.max(0, mutedUntil - Date.now()),
        requestTracking,
    };
}
