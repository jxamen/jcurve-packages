"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFullscreen = createFullscreen;
const runtime_1 = require("./runtime");
function createFullscreen(env, sdk) {
    let abortCurrent = null;
    return {
        cancel: () => { abortCurrent?.(); },
        async show(config) {
            const cb = config.callbacks;
            if (!(0, runtime_1.isForeground)(env)) {
                (0, runtime_1.safeCall)(cb.onFail, '앱이 앞에 있을 때 광고를 열 수 있어요', true);
                return false;
            }
            const lease = (0, runtime_1.acquireFullscreen)(env, sdk);
            if (!lease)
                return false;
            let disposed = false;
            let terminal = false;
            let opened = false;
            let closed = false;
            let earned = false;
            let presented = false;
            let sawBackground = false;
            let stage = 'init';
            const offs = [];
            const timers = new Set();
            let appSub = null;
            let stopPreparation = () => { };
            const stopped = new Promise((resolve) => { stopPreparation = () => resolve(null); });
            const cleanup = () => {
                if (disposed)
                    return;
                disposed = true;
                stopPreparation();
                lease.release();
                if (abortCurrent === abort)
                    abortCurrent = null;
                try {
                    appSub?.remove();
                }
                catch { /* noop */ }
                for (const off of offs) {
                    try {
                        off();
                    }
                    catch { /* noop */ }
                }
                for (const timer of timers)
                    clearTimeout(timer);
                offs.length = 0;
                timers.clear();
            };
            const later = (fn, ms) => {
                const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms);
                timers.add(timer);
            };
            const abort = () => {
                if (disposed || terminal)
                    return;
                terminal = true;
                stopPreparation();
                (0, runtime_1.safeCall)(cb.onAbort, !presented && !opened);
                // Native fullscreen cannot be dismissed by JS. Keep its lease until CLOSED/foreground recovery.
                if ((!presented && !opened) || closed)
                    cleanup();
            };
            abortCurrent = abort; // Installed before the very first await; cancel works during UMP/init.
            const fail = (message) => {
                if (disposed || terminal || closed)
                    return;
                terminal = true;
                (0, runtime_1.safeCall)(config.onFailure);
                if (!presented && !opened)
                    cleanup();
                (0, runtime_1.safeCall)(cb.onFail, message, !presented && !opened);
            };
            const finishClose = () => {
                if (disposed || closed)
                    return;
                closed = true;
                if (terminal) {
                    cleanup();
                    return;
                }
                if (!opened) {
                    terminal = true;
                    cleanup();
                    (0, runtime_1.safeCall)(cb.onFail, '광고가 열렸는지 확인할 수 없어요', !presented);
                    return;
                }
                (0, runtime_1.safeCall)(cb.onClosed);
                if (disposed || terminal)
                    return;
                if (!config.rewarded || earned) {
                    terminal = true;
                    cleanup();
                    return;
                }
                later(() => {
                    if (disposed)
                        return;
                    terminal = true;
                    cleanup();
                    if (!earned)
                        (0, runtime_1.safeCall)(cb.onFail, '광고를 끝까지 보지 않았어요', false);
                }, 1200);
            };
            // Permission dialogs can temporarily inactivate the app. Preparation checks the final foreground state.
            try {
                appSub = env.appState()?.addEventListener('change', (state) => {
                    if (disposed)
                        return;
                    if (state !== 'active') {
                        sawBackground = true;
                        // Android opens Google's AdActivity before OPENED can reach JS. AppState alone
                        // cannot distinguish this native presentation from Home; only the SDK can end it.
                        if (!opened && !(env.os() === 'android' && presented) && (state === 'background' || stage !== 'init'))
                            abort();
                    }
                    else if (env.os() !== 'android' && sawBackground && (presented || opened))
                        finishClose();
                }) ?? null;
                const prepared = await Promise.race([config.prepare(() => !disposed && !terminal), stopped]);
                if (disposed || terminal || prepared === null)
                    return false;
                if (!(0, runtime_1.isForeground)(env)) {
                    abort();
                    return false;
                }
                const ad = config.makeAd(prepared);
                const events = sdk.AdEventType;
                const rewardEvents = sdk.RewardedAdEventType;
                stage = 'load';
                offs.push(ad.addAdEventListener(config.rewarded ? rewardEvents.LOADED : events.LOADED, () => {
                    if (disposed || terminal || closed || presented)
                        return;
                    if (!(0, runtime_1.isForeground)(env)) {
                        abort();
                        return;
                    }
                    presented = true;
                    stage = 'show';
                    sawBackground = false;
                    const presentationFailed = (error) => {
                        if (disposed || closed)
                            return;
                        if (!opened) {
                            presented = false; // Native show rejected; an unconfirmed presentation cannot still open.
                            if (terminal) {
                                cleanup();
                                return;
                            }
                        }
                        fail((0, runtime_1.adError)(error));
                    };
                    try {
                        Promise.resolve(ad.show()).catch(presentationFailed);
                    }
                    catch (error) {
                        presentationFailed(error);
                    }
                }));
                offs.push(ad.addAdEventListener(events.OPENED, () => {
                    if (disposed || closed || opened)
                        return;
                    opened = true;
                    stage = 'open';
                    sawBackground = false;
                    // cancel/failure may already have delivered its result; still track the native lifecycle.
                    if (terminal)
                        return;
                    (0, runtime_1.safeCall)(config.onOpen);
                    (0, runtime_1.safeCall)(cb.onOpened);
                }));
                if (config.rewarded)
                    offs.push(ad.addAdEventListener(rewardEvents.EARNED_REWARD, () => {
                        if (disposed || terminal || earned || !opened)
                            return;
                        earned = true;
                        (0, runtime_1.safeCall)(cb.onEarned);
                        if (closed) {
                            terminal = true;
                            cleanup();
                        }
                    }));
                offs.push(ad.addAdEventListener(events.CLOSED, finishClose));
                offs.push(ad.addAdEventListener(events.ERROR, (error) => {
                    if (disposed || closed)
                        return;
                    // RNGMA 16.5 iOS delegate maps didFailToPresentFullScreenContentWithError to ERROR,
                    // and dismissal to a separate CLOSED event. Failure before OPENED is authoritative;
                    // waiting for CLOSED here can leave the SDK-wide lease permanently stuck.
                    if (!opened) {
                        presented = false;
                        if (terminal) {
                            cleanup();
                            return;
                        } // Keep an existing cancel/failure result exactly once.
                    }
                    fail((0, runtime_1.adError)(error));
                }));
                if (!(0, runtime_1.isForeground)(env)) {
                    abort();
                    return false;
                }
                later(() => { if (!opened)
                    fail('광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요 (' + stage + ')'); }, 15000);
                ad.load();
                return true;
            }
            catch (error) {
                fail((0, runtime_1.adError)(error));
                return false;
            }
        },
    };
}
