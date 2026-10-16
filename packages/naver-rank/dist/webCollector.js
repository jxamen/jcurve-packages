"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NaverRankHost = NaverRankHost;
const jsx_runtime_1 = require("react/jsx-runtime");
const placeWebView_1 = require("./placeWebView");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_webview_1 = require("react-native-webview");
const webQueue_1 = require("./webQueue");
const webParser_1 = require("./webParser");
const naverUrl_1 = require("./naverUrl");
const webDiagnostics_1 = require("./webDiagnostics");
const webThrottle_1 = require("./webThrottle");
// A navigation gets one six-second observation window. Never send raw text to logs.
const script = `(function(){if(window.__rankTimer)return;var start=Date.now(),scrolled=false;window.__rankTimer=setInterval(function(){var text=document.body?document.body.innerText:'';var links=Array.from(document.querySelectorAll('a[data-nlog-area*="shp_tli"][href], [data-product-id] a[href], a[data-product-id], [class*="product_item"] a[href], [class*="productItem"] a[href], [class*="shopping_item"] a[href], li.VLTHu a[href], li.UEzoS a[href]')).map(function(a){return {href:a.href,title:a.innerText,id:(a.closest('[data-product-id]')||a).getAttribute('data-product-id')};});var elapsed=Date.now()-start;if(elapsed<6000&&!/접속.{0,12}제한|서비스 이용이 제한/.test(text)){if(!scrolled){scrolled=true;window.scrollTo(0,document.body?document.body.scrollHeight:0);}return;}clearInterval(window.__rankTimer);window.__rankTimer=null;window.ReactNativeWebView.postMessage(JSON.stringify({url:location.href,title:document.title,text:text,html:document.documentElement.outerHTML,links:links}));},400);})();true;`;
let nextShoppingRoute = 0;
function NaverRankHost() {
    const [job, setJob] = (0, react_1.useState)();
    const [visible, setVisible] = (0, react_1.useState)(false), [failure, setFailure] = (0, react_1.useState)();
    const ref = (0, react_1.useRef)(null), active = (0, react_1.useRef)(job), rows = (0, react_1.useRef)([]);
    const page = (0, react_1.useRef)(1), route = (0, react_1.useRef)(0), attempts = (0, react_1.useRef)(1), prepared = (0, react_1.useRef)(false), manual = (0, react_1.useRef)(false), http = (0, react_1.useRef)(200), navigation = (0, react_1.useRef)(false);
    active.current = job;
    const pending = (0, react_1.useRef)(undefined), waiting = (0, react_1.useRef)(false), retried = (0, react_1.useRef)(false);
    const cancelWait = () => { clearTimeout(pending.current); pending.current = undefined; waiting.current = false; };
    const later = (ms, action) => { cancelWait(); waiting.current = true; pending.current = setTimeout(() => { waiting.current = false; if (active.current)
        action(); }, ms); };
    const finish = (error) => { const current = active.current; if (!current)
        return; cancelWait(); active.current = undefined; error ? current.reject(error) : current.resolve(rows.current); setJob(undefined); setVisible(false); setFailure(undefined); };
    const navigate = () => { const current = active.current; if (!current)
        return; http.current = 200; navigation.current = true; const url = current.channel === 'shopping' ? (0, webDiagnostics_1.shoppingUrl)(current.keyword, page.current, route.current) : 'https://m.place.naver.com/place/list?query=' + encodeURIComponent(current.keyword) + '&page=' + page.current; ref.current?.injectJavaScript('location.href=' + JSON.stringify(url) + ';true;'); };
    const fail = async (code, title = '', text = '') => {
        if (waiting.current || failure)
            return;
        const error = new webQueue_1.CollectorError(code, (0, webDiagnostics_1.safeEvidence)(title, text));
        console.info('[rank.web]', JSON.stringify({ code, titleAndExcerpt: error.evidence, route: route.current, page: page.current, status: http.current }));
        if (active.current?.channel === 'shopping' && http.current === 429 && !manual.current) {
            waiting.current = true;
            const current = active.current;
            const action = await (0, webThrottle_1.recordLimit)(retried.current);
            if (active.current !== current)
                return;
            waiting.current = false;
            if (action === 'retry') {
                retried.current = true;
                later((0, webThrottle_1.randomDelay)(30, 90), navigate);
                return;
            }
            nextShoppingRoute = (route.current + 1) % 3;
            finish(new webQueue_1.CollectorError('blocked_limit', 'HTTP 429 · 잠시 뒤 다시 확인해 주세요. 다음 예약 시간에 재개합니다.'));
            return;
        }
        if (active.current?.channel === 'shopping' && attempts.current < 2 && !manual.current && !['blocked_limit', 'captcha', 'blocked_login'].includes(code)) {
            attempts.current++;
            route.current = (route.current + 1) % 3;
            page.current = 1;
            rows.current = [];
            later(10000, navigate);
            return;
        }
        if (active.current?.channel === 'shopping')
            nextShoppingRoute = (route.current + 1) % 3;
        (0, webQueue_1.reportCollectorFailure)(error);
        setFailure(error);
    };
    (0, react_1.useEffect)(() => (0, webQueue_1.attachCollector)(next => { cancelWait(); retried.current = false; rows.current = []; page.current = 1; route.current = next.channel === 'shopping' ? nextShoppingRoute : 0; attempts.current = 1; prepared.current = false; manual.current = false; setFailure(undefined); setVisible(false); setJob(next); }), []);
    (0, react_1.useEffect)(() => { if (!job)
        return; const abort = () => finish(new webQueue_1.CollectorError('timeout')); job.signal.addEventListener('abort', abort); if (job.signal.aborted)
        abort(); const sub = react_native_1.AppState.addEventListener('change', s => { if (s !== 'active' && !manual.current)
        finish(new webQueue_1.CollectorError('background')); }); return () => { job.signal.removeEventListener('abort', abort); sub.remove(); }; }, [job]);
    (0, react_1.useEffect)(() => () => { cancelWait(); active.current?.reject(new webQueue_1.CollectorError('unmounted')); }, []);
    if (!job)
        return null;
    if (job.channel === 'place')
        return (0, jsx_runtime_1.jsx)(placeWebView_1.PlaceWebView, { job: job, onDone: () => { active.current = undefined; setJob(undefined); } }, job.keyword + job.placeId);
    return (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { pointerEvents: visible ? 'auto' : 'none', style: visible ? { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1000, backgroundColor: 'white', paddingTop: 60, paddingBottom: 30 } : { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }, children: [visible && (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", style: { padding: 16 }, onPress: () => { setVisible(false); manual.current = false; setFailure(undefined); ref.current?.injectJavaScript(script); }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { children: "\uB2EB\uAE30 \u00B7 \uD604\uC7AC \uD398\uC774\uC9C0\uB85C \uC21C\uC704 \uB2E4\uC2DC \uD655\uC778" }) }), (0, jsx_runtime_1.jsx)(react_native_webview_1.WebView, { ref: ref, style: { flex: 1 }, source: { uri: 'https://shopping.naver.com/ns/home' }, applicationNameForUserAgent: "Version/18.0 Mobile/15E148 Safari/604.1", sharedCookiesEnabled: true, thirdPartyCookiesEnabled: true, javaScriptEnabled: true, onShouldStartLoadWithRequest: request => { try {
                            const u = new URL(request.url);
                            return u.protocol === 'https:' && (u.hostname === 'naver.com' || u.hostname.endsWith('.naver.com'));
                        }
                        catch {
                            return request.url === 'about:blank';
                        } }, onLoadStart: () => { navigation.current = false; http.current = 200; }, onLoadEnd: () => { if (navigation.current || waiting.current)
                            return; if (!prepared.current) {
                            prepared.current = true;
                            later(2500, navigate);
                            return;
                        } if (!manual.current && !waiting.current)
                            ref.current?.injectJavaScript(script); }, onHttpError: event => { if (event.nativeEvent.isTopFrame === false)
                            return; http.current = event.nativeEvent.statusCode; if (http.current === 429 && !manual.current) {
                            prepared.current = true;
                            ref.current?.stopLoading();
                            void fail('blocked_limit', '', '요청이 너무 많');
                        } }, onError: () => { if (!prepared.current) {
                            prepared.current = true;
                            navigate();
                        }
                        else
                            fail('empty'); }, onMessage: event => {
                            if (manual.current || navigation.current || waiting.current || failure)
                                return;
                            try {
                                const data = JSON.parse(event.nativeEvent.data);
                                let parsed = [];
                                try {
                                    parsed = (0, webParser_1.parseCollectorHtml)(data.html, job.channel, page.current);
                                }
                                catch {
                                    const seen = new Set();
                                    for (const link of data.links ?? []) {
                                        const id = link.id || (job.channel === 'shopping' ? (0, webParser_1.shoppingLinkId)(link.href) : (0, naverUrl_1.targetUrlId)(link.href, 'place'));
                                        if (!id || seen.has(id))
                                            continue;
                                        seen.add(id);
                                        parsed.push({ id, link: link.href, title: link.title, mallName: '', rank: (page.current - 1) * (job.channel === 'shopping' ? 40 : 30) + parsed.length + 1 });
                                    }
                                }
                                const blocked = (0, webQueue_1.blockReason)(data.text, data.url);
                                // A rendered result wins over incidental footer/login/CAPTCHA words.
                                if (blocked === 'blocked_limit') {
                                    void fail(blocked, data.title, data.text);
                                    return;
                                }
                                if (http.current === 429) {
                                    void fail('blocked_limit', data.title, data.text);
                                    return;
                                }
                                if (!parsed.length) {
                                    fail(blocked || (http.current >= 400 ? 'http_4xx' : 'empty'), data.title, data.text);
                                    return;
                                }
                                if (rows.current.some(old => parsed.some(row => row.id === old.id))) {
                                    fail('empty', data.title, data.text);
                                    return;
                                }
                                setFailure(undefined);
                                const max = job.channel === 'shopping' ? 200 : 100;
                                rows.current.push(...parsed.filter(row => row.rank <= max));
                                if (job.channel === 'shopping' || rows.current.length >= max || parsed.length < 30)
                                    finish();
                                else {
                                    page.current++;
                                    navigate();
                                }
                            }
                            catch {
                                fail('empty');
                            }
                        } })] }), failure && !visible && (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: { position: 'absolute', bottom: 80, left: 20, right: 20, zIndex: 1001, backgroundColor: 'white', padding: 16, borderWidth: 1, borderColor: '#ddd' }, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { children: failure.message }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { fontSize: 11, marginVertical: 8 }, children: failure.evidence }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", style: { padding: 12 }, onPress: () => { cancelWait(); manual.current = true; rows.current = []; page.current = 1; setVisible(true); }, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { children: "\uB124\uC774\uBC84 \uD654\uBA74 \uBCF4\uAE30" }) }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", style: { padding: 12 }, onPress: () => finish(failure), children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { children: "\uD655\uC778 \uC885\uB8CC" }) })] })] });
}
