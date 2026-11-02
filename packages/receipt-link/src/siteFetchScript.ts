/**
 * 사이트 요청 동작(fetch)의 웹뷰 스크립트 — 숨은 웹뷰의 현재 페이지 안에서 요청만 부른다(클릭 · 화면 이동 없음, credentials include).
 * 응답은 줄여서(FETCH_PRUNE) {step:'fetched'} 한 번으로 앱 안에 돌려준다. 요청마다 시간 제한이 있고 전체 마감도 있어 구동기의 20초 감시보다 먼저 답한다.
 * window.__ytAbortFetch() 로 즉시 멈출 수 있다. 타입 · 한도는 siteFetch.ts. react-native 를 import 하지 않는다(노드 vm 으로 이 스크립트 자체를 시험한다).
 */
import { checkFetchRun, FETCH_PRUNE, type FetchRun } from './siteFetch';

export function fetchScript(r: FetchRun): string {
  checkFetchRun(r);
  return String.raw`(function (a, P) {
  function post(o) { try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {} }
  var ctls = [];
  var aborted = false;
  window.__ytAbortFetch = function () { aborted = true; for (var i = 0; i < ctls.length; i++) { try { ctls[i].abort(); } catch (e) {} } };
  /* 응답 줄이기: 긴 글자 · 긴 배열 · 깊은 곳을 자른다(영수증 · 주문 칸은 짧다) */
  function prune(v, d, cap) {
    if (v === null || typeof v === 'boolean' || typeof v === 'number') return v;
    if (typeof v === 'string') return v.length > P.str ? v.slice(0, P.str) : v;
    if (d > P.depth) return undefined;
    var i;
    if (Array.isArray(v)) { var arr = []; for (i = 0; i < v.length && i < cap; i++) arr.push(prune(v[i], d + 1, cap)); return arr; }
    if (typeof v === 'object') { var out = {}; var n = 0; for (var k in v) { if (n++ > 400) break; var x = prune(v[k], d + 1, cap); if (x !== undefined) out[k] = x; } return out; }
    return undefined;
  }
  function slim(j) {
    var s = prune(j, 0, P.arr);
    var len = 0;
    try { len = JSON.stringify(s).length; } catch (e) { return undefined; }
    if (len <= P.bytes) return s;
    s = prune(j, 0, Math.max(10, Math.floor(P.arr / 8)));
    try { return JSON.stringify(s).length <= P.bytes ? s : undefined; } catch (e) { return undefined; }
  }
  /* 17자리 이상 아이디(쿠팡 orderId 등)가 JSON 숫자로 오면 JS 가 끝자리를 잃는다(2^53 초과) — 16자리 이상 숫자는 문자열로 감싸 정밀하게 읽는다(네이버 parseBig 과 같은 규칙). 영수증 주소에 그 값이 그대로 들어가므로 끝자리가 틀리면 못 받는다 */
  function parseBig(t) {
    var s = String(t);
    try { return JSON.parse(s.replace(/([:\[,]\s*)(-?\d{16,})(?=\s*[,}\]])/g, '$1"$2"')); } catch (e) { return JSON.parse(s); }
  }
  function nextData(html) {
    var m = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (!m) return undefined;
    try { return parseBig(m[1]); } catch (e) { return undefined; }
  }
  function stripTags(html) {
    return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  }
  function isLoginUrl(u) { return /(^|[.\/])nid\.naver\.com|\/(login|signin|member\/login)(\/|\?|$)|\/\/accounts\./i.test(String(u || '')); }
  function one(q, key) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    if (ctl) ctls.push(ctl);
    var timer = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, a.timeoutMs) : null;
    var headers = { accept: q.accept || (q.as === 'json' ? 'application/json, text/plain, */*' : 'text/html,application/json,*/*;q=0.8') };
    var init = { method: q.method, credentials: 'include', headers: headers, signal: ctl ? ctl.signal : undefined };
    if (q.method === 'POST') { headers['content-type'] = 'application/json'; init.body = q.body === undefined ? '{}' : q.body; }
    return fetch(q.url, init).then(function (res) {
      if (timer) clearTimeout(timer);
      if (res.status === 401 || (res.redirected && isLoginUrl(res.url))) return { key: key, st: 'login', status: res.status };
      if (res.status === 403 || res.status === 429) return { key: key, st: 'blocked', status: res.status };
      if (!res.ok) return { key: key, st: 'http', status: res.status };
      if (q.as === 'json') {
        return res.json().then(function (j) { var d = slim(j); return d === undefined ? { key: key, st: 'shape', status: res.status } : { key: key, st: 'ok', status: res.status, data: d }; }, function () { return { key: key, st: 'shape', status: res.status }; });
      }
      return res.text().then(function (raw) {
        if (q.as === 'nextData') {
          var nd = nextData(raw);
          var d = nd === undefined ? undefined : slim(nd);
          return d === undefined ? { key: key, st: 'shape', status: res.status } : { key: key, st: 'ok', status: res.status, data: d };
        }
        var first = raw.replace(/^\s+/, '').charAt(0);
        if (first === '{' || first === '[') {
          try { return { key: key, st: 'ok', status: res.status, data: slim(parseBig(raw)), text: raw.slice(0, 120000) }; } catch (e) { /* JSON 이 아니면 글자로 */ }
        }
        // HTML 이면 글자(text)와 함께, 안에 Next.js __NEXT_DATA__ 가 있으면 그 JSON 도 data 로(영수증 값이 글자가 아니라 이 JSON 에만 있는 사이트를 위해)
        var nd2 = nextData(raw);
        var d2 = nd2 === undefined ? undefined : slim(nd2);
        var out2 = { key: key, st: 'ok', status: res.status, text: stripTags(raw).slice(0, 120000) };
        if (d2 !== undefined) out2.data = d2;
        return out2;
      }, function () { return { key: key, st: 'shape', status: res.status }; });
    }, function () { if (timer) clearTimeout(timer); return { key: key, st: 'net' }; });
  }
  var results = [];
  var next = 0;
  var inflight = 0;
  var finished = 0;
  var sent = false;
  function done() {
    if (sent) return;
    sent = true;
    var out = [];
    for (var i = 0; i < a.reqs.length; i++) out.push(results[i] || { key: a.reqs[i].key, st: 'net' });
    post({ type: 'nav', step: 'fetched', results: out });
  }
  function start(i) {
    var p;
    try { p = one(a.reqs[i], a.reqs[i].key); } catch (e) { p = Promise.resolve({ key: a.reqs[i].key, st: 'net' }); }
    p.then(function (r) { return r; }, function () { return { key: a.reqs[i].key, st: 'net' }; }).then(function (r) {
      results[i] = r;
      inflight--;
      finished++;
      if (finished === a.reqs.length) done(); else pump();
    });
  }
  /* 동시에 a.conc 건까지 — 처음 a.conc 건은 staggerMs 간격으로, 그 뒤는 자리가 나는 대로 gapMs 쉬고 시작한다 */
  function pump() {
    if (aborted) return;
    while (inflight < a.conc && next < a.reqs.length) {
      var i = next++;
      inflight++;
      (function (i) { setTimeout(function () { if (!aborted) start(i); }, i < a.conc ? a.staggerMs * i : a.gapMs); })(i);
    }
  }
  setTimeout(done, a.deadlineMs);
  pump();
})(${JSON.stringify(r)}, ${JSON.stringify(FETCH_PRUNE)});true;`;
}
