"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaceWebView = PlaceWebView;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_webview_1 = require("react-native-webview");
const webQueue_1 = require("./webQueue");
const placeInApp_1 = require("./placeInApp");
const webThrottle_1 = require("./webThrottle");
// Capture only successful page-owned GraphQL requests. Tokens/cookies stay in this page.
const placeTokenScript_1 = require("./placeTokenScript");
function PlaceWebView({ job, onDone }) {
    const ref = (0, react_1.useRef)(null), alive = (0, react_1.useRef)(true), running = (0, react_1.useRef)(false), retried = (0, react_1.useRef)(false), sequence = (0, react_1.useRef)(0);
    const category = (0, react_1.useRef)('place');
    const [url, setUrl] = (0, react_1.useState)('https://m.place.naver.com/place/' + job.placeId + '/home');
    const [visible, setVisible] = (0, react_1.useState)(false), [error, setError] = (0, react_1.useState)();
    const pending = (0, react_1.useRef)(undefined);
    const finish = (e, rows = []) => { if (!alive.current)
        return; alive.current = false; clearTimeout(pending.current?.timer); pending.current?.reject(e || new webQueue_1.CollectorError('cancelled')); pending.current = undefined; e ? job.reject(e) : job.resolve(rows); onDone(); };
    const fail = (e) => { if (!alive.current)
        return; const reason = e instanceof webQueue_1.CollectorError ? e : new webQueue_1.CollectorError('network'); if (reason.code === 'captcha' || reason.code === 'blocked_login') {
        (0, webQueue_1.reportCollectorFailure)(reason);
        setError(reason);
    }
    else
        finish(reason); };
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const request = async (body) => {
        const once = () => new Promise((resolve, reject) => { if (!alive.current)
            return reject(new webQueue_1.CollectorError('cancelled')); const id = ++sequence.current; const timer = setTimeout(() => { pending.current = undefined; reject(new webQueue_1.CollectorError('timeout')); }, 25000); pending.current = { id, resolve, reject, timer }; ref.current?.injectJavaScript('window.__placeRequest(' + [id, body, job.keyword, category.current].map(v => JSON.stringify(v)).join(',') + ');true;'); });
        let response = await once();
        if (response.status === 429) {
            const action = await (0, webThrottle_1.recordLimit)(retried.current);
            if (action === 'stop')
                throw new webQueue_1.CollectorError('blocked_limit');
            retried.current = true;
            await wait((0, webThrottle_1.randomDelay)(30, 90));
            response = await once();
            if (response.status === 429)
                throw new webQueue_1.CollectorError('blocked_limit');
        }
        if (response.status === 405) {
            await wait(3000);
            response = await once();
        }
        return response;
    };
    const run = async () => { if (running.current || !alive.current)
        return; running.current = true; try {
        let result = await (0, placeInApp_1.scanPlacePages)(job.keyword, job.placeId, category.current, request, wait);
        if (result.rank == null && category.current !== 'place') {
            category.current = 'place';
            await wait(3000);
            result = await (0, placeInApp_1.scanPlacePages)(job.keyword, job.placeId, 'place', request, wait);
        }
        finish(undefined, (0, placeInApp_1.placeRows)(result, job.placeId));
    }
    catch (e) {
        running.current = false;
        fail(e);
    } };
    (0, react_1.useEffect)(() => { const timer = setTimeout(() => fail(new webQueue_1.CollectorError('token_timeout')), 210000); const sub = react_native_1.AppState.addEventListener('change', state => { if (state !== 'active')
        finish(new webQueue_1.CollectorError('background')); }); return () => { alive.current = false; clearTimeout(timer); clearTimeout(pending.current?.timer); pending.current?.reject(new webQueue_1.CollectorError('unmounted')); sub.remove(); }; }, []);
    return (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { pointerEvents: visible ? 'auto' : 'none', style: visible ? { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1000, backgroundColor: 'white', paddingTop: 60 } : { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }, children: [visible && (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => { setVisible(false); setError(undefined); ref.current?.reload(); }, style: { padding: 16 }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { children: "\uB2EB\uAE30 \u00B7 \uD604\uC7AC \uD398\uC774\uC9C0\uB85C \uC21C\uC704 \uB2E4\uC2DC \uD655\uC778" }) }), (0, jsx_runtime_1.jsx)(react_native_webview_1.WebView, { ref: ref, source: { uri: url }, sharedCookiesEnabled: true, thirdPartyCookiesEnabled: true, javaScriptEnabled: true, injectedJavaScriptBeforeContentLoaded: placeTokenScript_1.placeTokenScript, onShouldStartLoadWithRequest: r => { try {
                            const u = new URL(r.url);
                            return u.protocol === 'https:' && (u.hostname === 'naver.com' || u.hostname.endsWith('.naver.com'));
                        }
                        catch {
                            return r.url === 'about:blank';
                        } }, onLoadEnd: () => ref.current?.injectJavaScript(`window.ReactNativeWebView.postMessage(JSON.stringify({kind:'page',url:location.href,category:Object.values(window.__APOLLO_STATE__||{}).filter(function(v){return v&&v.__typename==='PlaceDetailBase';}).map(function(v){return v.category;})[0]||'',text:(document.body?document.body.innerText:'').slice(0,4000)}));if(location.hostname==='pcmap.place.naver.com'&&!window.__placeScroll){window.__placeScroll=1;var count=0,t=setInterval(function(){if(window.__placeTokenReady){clearInterval(t);return;}window.scrollBy(0,900);if(++count>=4){clearInterval(t);var next=Array.from(document.querySelectorAll('a')).find(function(a){return a.textContent.trim()==='2';});if(next)next.click();}},1500);}true;`), onHttpError: e => { if (e.nativeEvent.isTopFrame === false)
                            return; if (e.nativeEvent.statusCode === 429) {
                            void (async () => { const action = await (0, webThrottle_1.recordLimit)(retried.current); if (action === 'stop') {
                                fail(new webQueue_1.CollectorError('blocked_limit'));
                                return;
                            } retried.current = true; await wait((0, webThrottle_1.randomDelay)(30, 90)); if (alive.current)
                                ref.current?.reload(); })();
                        }
                        else if (e.nativeEvent.statusCode >= 400)
                            fail(new webQueue_1.CollectorError('http_4xx')); }, onError: () => fail(new webQueue_1.CollectorError('network')), onMessage: e => { try {
                            const data = JSON.parse(e.nativeEvent.data);
                            if (data.kind === 'page') {
                                const reason = (0, webQueue_1.blockReason)(data.text, data.url);
                                if (reason) {
                                    fail(new webQueue_1.CollectorError(reason));
                                    return;
                                }
                                if (new URL(data.url).hostname === 'm.place.naver.com') {
                                    category.current = (0, placeInApp_1.placeCategory)(new URL(data.url).pathname, data.category);
                                    setUrl('https://pcmap.place.naver.com/' + category.current + '/list?query=' + encodeURIComponent(job.keyword));
                                }
                            }
                            else if (data.kind === 'ready')
                                void run();
                            else if (pending.current && data.id === pending.current.id) {
                                const p = pending.current;
                                pending.current = undefined;
                                clearTimeout(p.timer);
                                data.kind === 'response' ? p.resolve(data) : p.reject(new webQueue_1.CollectorError('network'));
                            }
                        }
                        catch {
                            fail(new webQueue_1.CollectorError('bridge'));
                        } } })] }), !!error && !visible && (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { position: 'absolute', bottom: 80, left: 20, right: 20, zIndex: 1001, backgroundColor: 'white', padding: 16 }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { children: error.message }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => setVisible(true), style: { padding: 12 }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { children: "\uB124\uC774\uBC84 \uD654\uBA74 \uBCF4\uAE30" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { onPress: () => finish(error), style: { padding: 12 }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { children: "\uC11C\uBC84 \uC608\uBE44 \uC870\uD68C" }) })] })] });
}
