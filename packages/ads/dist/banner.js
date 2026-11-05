"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBannerSession = createBannerSession;
exports.AnchoredAdaptiveBanner = AnchoredAdaptiveBanner;
const ads_1 = require("./ads");
const runtime_1 = require("./runtime");
/** Internal state machine exposed only from this file for fake-SDK producer checks. */
function createBannerSession(props, width, env = (0, ads_1.defaultAdsEnv)()) {
    const sdk = env.sdk();
    const os = env.os();
    const test = env.dev() || props.test;
    const unitId = os === 'ios' ? props.units.ios : os === 'android' ? props.units.android : '';
    const available = !!((os === 'ios' || os === 'android') && sdk?.BannerAd && sdk?.default && sdk?.BannerAdSize?.ANCHORED_ADAPTIVE_BANNER && (test || unitId) && Number.isFinite(width) && width > 0);
    let state = { height: 0, request: null };
    let generation = 0;
    let stopped = true;
    let timer = null;
    let appSub = null;
    let stopFullscreen = null;
    const listeners = new Set();
    const clearTimer = () => { if (timer !== null)
        clearTimeout(timer); timer = null; };
    const publish = (next, forceHeight = false) => {
        const changed = state.height !== next.height;
        state = next;
        if (changed || forceHeight)
            (0, runtime_1.safeCall)(props.onHeightChange, next.height);
        for (const listener of listeners)
            (0, runtime_1.safeCall)(listener, next);
    };
    const collapse = () => { generation++; clearTimer(); publish({ height: 0, request: null }); };
    const startRequest = async () => {
        collapse();
        if (stopped || props.enabled === false || !available || !(0, runtime_1.isForeground)(env) || (0, runtime_1.isFullscreenActive)(env, sdk))
            return;
        const id = generation;
        const current = () => !stopped && id === generation && (0, runtime_1.isForeground)(env) && !(0, runtime_1.isFullscreenActive)(env, sdk);
        const fail = (error) => {
            if (!current())
                return;
            collapse();
            (0, runtime_1.safeCall)(props.onFail, (0, runtime_1.adError)(error), true);
        };
        try {
            const requestOptions = await (0, runtime_1.prepareRequest)(env, sdk, props, current);
            if (!current())
                return;
            let loaded = false;
            const dimensionsChanged = (dimensions, fromLoad) => {
                if (!current())
                    return;
                const valid = dimensions && Number.isFinite(dimensions.width) && dimensions.width > 0 && Number.isFinite(dimensions.height) && dimensions.height > 0;
                if (!valid) {
                    fail(new Error('광고 크기를 확인할 수 없어요'));
                    return;
                }
                if (!fromLoad && !loaded)
                    return; // Size-change alone does not prove an ad loaded.
                if (fromLoad && loaded)
                    return;
                if (fromLoad) {
                    loaded = true;
                    clearTimer();
                }
                publish({ request: state.request, height: dimensions.height });
                if (fromLoad)
                    (0, runtime_1.safeCall)(props.onLoaded, { width: dimensions.width, height: dimensions.height });
            };
            const request = {
                id,
                unitId: test ? sdk.TestIds.BANNER : unitId,
                size: sdk.BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
                width,
                requestOptions,
                onAdLoaded: (dimensions) => dimensionsChanged(dimensions, true),
                onSizeChange: (dimensions) => dimensionsChanged(dimensions, false),
                onAdFailedToLoad: fail,
            };
            timer = setTimeout(() => fail(new Error('광고 로딩 시간이 초과됐어요')), 15000);
            publish({ height: 0, request });
        }
        catch (error) {
            fail(error);
        }
    };
    return {
        available,
        sdk,
        getState: () => state,
        subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        mount: () => {
            if (!stopped)
                return;
            stopped = false;
            publish({ height: 0, request: null }, true);
            stopFullscreen = (0, runtime_1.subscribeFullscreen)(env, sdk, (active, resumeRequests) => {
                if (stopped)
                    return;
                if (active)
                    collapse();
                else if (resumeRequests && (0, runtime_1.isForeground)(env))
                    void startRequest();
            });
            try {
                appSub = env.appState()?.addEventListener('change', (next) => {
                    if (stopped)
                        return;
                    if (next === 'active') {
                        if (!state.request)
                            void startRequest();
                    }
                    else
                        collapse();
                }) ?? null;
            }
            catch { /* missing lifecycle events means foreground is still checked before request */ }
            void startRequest();
        },
        unmount: () => {
            stopped = true;
            collapse();
            try {
                appSub?.remove();
            }
            catch { /* noop */ }
            appSub = null;
            stopFullscreen?.();
            stopFullscreen = null;
        },
    };
}
/** The app never imports a native advertising SDK or renders a fabricated banner. */
function AnchoredAdaptiveBanner(props) {
    let React;
    let native;
    try {
        React = require('react');
        native = require('react-native');
    }
    catch {
        return null;
    }
    const window = native.useWindowDimensions();
    const width = props.width ?? window.width;
    // Callback refs avoid tearing down a loaded native ad on each parent render.
    const callbacks = React.useRef(props);
    callbacks.current = props;
    const session = React.useMemo(() => createBannerSession({
        ...props,
        onHeightChange: (height) => (0, runtime_1.safeCall)(callbacks.current.onHeightChange, height),
        onLoaded: (dimensions) => (0, runtime_1.safeCall)(callbacks.current.onLoaded, dimensions),
        onFail: (message, noAd) => (0, runtime_1.safeCall)(callbacks.current.onFail, message, noAd),
    }, width), [props.units.ios, props.units.android, props.test, JSON.stringify(props.testDevices ?? []), props.requestNonPersonalizedAdsOnly, props.enabled, width]);
    const [state, setState] = React.useState(session.getState());
    React.useEffect(() => {
        const off = session.subscribe(setState);
        session.mount();
        setState(session.getState());
        return () => { off(); session.unmount(); };
    }, [session]);
    // A render before a new effect must not reuse the old request after width/config changes.
    const current = state === session.getState() ? state : session.getState();
    if (!session.available || !current.request)
        return null;
    const { id, ...request } = current.request;
    return React.createElement(native.View, {
        style: { width, height: current.height, overflow: 'hidden', alignItems: 'center' },
        pointerEvents: current.height > 0 ? 'auto' : 'none',
        accessibilityElementsHidden: current.height === 0,
        importantForAccessibility: current.height > 0 ? 'auto' : 'no-hide-descendants',
    }, React.createElement(session.sdk.BannerAd, { ...request, key: id }));
}
