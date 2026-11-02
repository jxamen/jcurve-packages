"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHAPE_TAP_SCRIPT = exports.NO_PAIR_SCRIPT = exports.FIND_PAIR_JS = exports.SHAPE_WALK_JS = exports.SAFE_KEY_JS = exports.TAP_PAIR_API_PATH = exports.TAP_PAIR_DELAY_MS = exports.PAIR_MAX_NODES = exports.PAIR_MAX_DEPTH = exports.TAP_TARGETS = exports.TAP_HOSTS = exports.TAP_MAX_PER_PAGE = exports.TAP_MAX_LINE = exports.TAP_MAX_LINES = exports.TAP_MAX_KEYS = exports.TAP_MAX_DEPTH = void 0;
exports.safeKey = safeKey;
exports.walkShape = walkShape;
exports.findPaymentPair = findPaymentPair;
exports.parseTapMessage = parseTapMessage;
exports.tapKey = tapKey;
exports.tapRaw = tapRaw;
/**
 * 구조 기록기(shape tap) — 대표님 계정(probe 모드)에서만. 앱이 직접 사이트 데이터(JSON)의 **키 구조**만 기록한다: 경로와 형태, 값은 없다.
 *  - 걷기 함수(walkShape): 객체를 깊이 7까지, 배열은 첫 원소([0])만, 객체는 키 60개까지 돌며 「경로 : 형태」 줄을 만든다. 값은 읽지도 쓰지도 않는다(typeof 만).
 *  - 주입 스크립트(SHAPE_TAP_SCRIPT): 문서 시작 시점에 fetch · XHR 을 감싸 네이버 결제·쇼핑 호스트의 JSON 응답과 __NEXT_DATA__ 를 걸어 {type:'tap', …} 으로 앱에 알린다.
 *    같은 걷기 로직을 ES5 문자열(SHAPE_WALK_JS)로도 가지고 있고, 시험이 둘의 결과가 같은지 맞춰 본다.
 *  - 추가 한 가지: pay.naver.com 의 __NEXT_DATA__ 에서 paymentId · tid 쌍을 찾아 같은 출처로 읽기 전용 GET 한 번(card-single)을 부르고, 그 응답의 구조를 같은 방법으로 기록한다.
 *    쌍의 값은 요청 주소를 만드는 데만 쓰고 어떤 메시지 · 줄 · 주소 기록에도 넣지 않는다.
 * 서버 구조 기록은 값처럼 보이는 것(7자리 이상 숫자 · 전화 · 이메일 모양 · 허용 밖 글자)을 통째로 거절하므로, 키 이름도 걸러서 줄에 넣는다.
 * react-native 를 import 하지 않는다(노드에서 시험한다). eval · new Function · 쿠키 · 저장소 접근 없음.
 */
const probe_1 = require("./probe");
exports.TAP_MAX_DEPTH = 7;
exports.TAP_MAX_KEYS = 60;
/** 한 번에 줄 수 상한(서버 구조 기록의 outline 한도 300) */
exports.TAP_MAX_LINES = 300;
exports.TAP_MAX_LINE = 200;
/** 페이지(문서) 하나에서 보내는 tap 상한 */
exports.TAP_MAX_PER_PAGE = 10;
/** tap 을 거는 호스트 — 이 밖의 요청은 보지 않는다 */
exports.TAP_HOSTS = ['pay.naver.com', 'shopping.naver.com', 'order.pay.naver.com', 'm.pay.naver.com', 'new-m.pay.naver.com'];
exports.TAP_TARGETS = ['order-histories', 'card-single', 'card-single-B', 'issue-history', 'api', 'nextdata'];
/** 쌍 찾기 상한 */
exports.PAIR_MAX_DEPTH = 10;
exports.PAIR_MAX_NODES = 5000;
/** __NEXT_DATA__ 에서 쌍을 찾은 뒤 읽기 전용 GET 을 부르기까지 기다리는 시간 — 호스트가 이미 한 번 불렀다고 알릴 틈(window.__ytNoPair) */
exports.TAP_PAIR_DELAY_MS = 1200;
exports.TAP_PAIR_API_PATH = '/web-api/receipts/card-single';
/* ---------------- 키 이름 거르기 + 걷기 (TypeScript) ---------------- */
/**
 * 키 이름 → 서버가 받는 글자만. 이메일 모양은 통째로 :e, 4자리 이상 숫자는 :n(7자리 · 전화 · 번호 모양을 피한다), 24자 이상 긴 토큰은 앞 8자 + ~,
 * 한글은 가, 허용 밖 글자(. [ ] $ @ 등)는 _ . 경로에서 쓰는 . 과 [ ] 도 이름 안에서는 _ 로 바꾼다.
 */
function safeKey(k) {
    let s = String(k).slice(0, 80);
    if (/[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/.test(s))
        return ':e';
    s = s.replace(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g, '가').replace(/\d{4,}/g, ':n').replace(/[A-Za-z0-9_-]{24,}/g, (t) => t.slice(0, 8) + '~');
    s = s.replace(/[^A-Za-z0-9 _\-:/=#,*()>+~|'"가]/g, '_').trim().slice(0, 40);
    return s || '_';
}
const typeOf = (v) => {
    if (v === null)
        return 'null';
    if (Array.isArray(v))
        return v.length === 0 ? 'array0' : 'array';
    const t = typeof v;
    return t === 'string' || t === 'number' || t === 'boolean' || t === 'object' ? t : '';
};
/** 객체 → 「경로 : 형태」 줄들(너비 우선이라 위쪽 구조가 먼저 나온다). 값은 읽지 않는다 */
function walkShape(root) {
    const lines = [];
    const seen = new Set();
    const queue = [{ v: root, p: '', d: 0 }];
    for (let qi = 0; qi < queue.length && lines.length < exports.TAP_MAX_LINES; qi++) {
        const it = queue[qi];
        if (it.d >= exports.TAP_MAX_DEPTH)
            continue;
        const kids = [];
        if (Array.isArray(it.v)) {
            if (it.v.length > 0)
                kids.push([it.p + '[0]', it.v[0]]);
        }
        else if (it.v !== null && typeof it.v === 'object') {
            const obj = it.v;
            const ks = Object.keys(obj).slice(0, exports.TAP_MAX_KEYS);
            for (const k of ks)
                kids.push([it.p ? it.p + '.' + safeKey(k) : safeKey(k), obj[k]]);
        }
        for (let j = 0; j < kids.length && lines.length < exports.TAP_MAX_LINES; j++) {
            const [p, c] = kids[j];
            const t = typeOf(c);
            if (!t || seen.has(p))
                continue;
            seen.add(p);
            const line = p + ' : ' + t;
            if (line.length > exports.TAP_MAX_LINE)
                continue;
            lines.push(line);
            queue.push({ v: c, p, d: it.d + 1 });
        }
    }
    return lines;
}
const nonEmpty = (v) => (typeof v === 'string' && v.length > 0) || (typeof v === 'number' && Number.isFinite(v));
/**
 * 한 JSON 안에서 같은 객체에 키 이름이 정확히 paymentId 와 tid 둘 다 있고 두 값이 비어 있지 않은 문자열 · 숫자인 첫 번째 객체의 쌍(깊이 10, 객체 5000개 상한, 문서 순서).
 * 값은 호출 주소를 만드는 데만 쓴다 — 어디에도 기록하지 않는다.
 */
function findPaymentPair(root) {
    let nodes = 0;
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const rec = (v, d) => {
        if (d > exports.PAIR_MAX_DEPTH || nodes >= exports.PAIR_MAX_NODES || v === null || typeof v !== 'object')
            return null;
        nodes++;
        if (Array.isArray(v)) {
            for (let i = 0; i < v.length && nodes < exports.PAIR_MAX_NODES; i++) {
                const r = rec(v[i], d + 1);
                if (r)
                    return r;
            }
            return null;
        }
        const o = v;
        if (has(o, 'paymentId') && has(o, 'tid') && nonEmpty(o.paymentId) && nonEmpty(o.tid))
            return { paymentId: o.paymentId, tid: o.tid };
        const ks = Object.keys(o);
        for (let i = 0; i < ks.length && nodes < exports.PAIR_MAX_NODES; i++) {
            const r = rec(o[ks[i]], d + 1);
            if (r)
                return r;
        }
        return null;
    };
    return rec(root, 0);
}
/* ---------------- 같은 로직의 ES5 문자열 (웹뷰 주입용) ---------------- */
/** safeKey 와 같은 함수 식 */
exports.SAFE_KEY_JS = String.raw `function (k) {
  var s = String(k).slice(0, 80);
  if (/[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/.test(s)) return ':e';
  s = s.replace(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g, '가').replace(/\d{4,}/g, ':n').replace(/[A-Za-z0-9_-]{24,}/g, function (t) { return t.slice(0, 8) + '~'; });
  s = s.replace(/[^A-Za-z0-9 _\-:\/=#,*()>+~|'"가]/g, '_').replace(/^\s+|\s+$/g, '').slice(0, 40);
  return s || '_';
}`;
/** walkShape 와 같은 함수 식 */
exports.SHAPE_WALK_JS = String.raw `function (root) {
  var MAXD = ${exports.TAP_MAX_DEPTH}, MAXK = ${exports.TAP_MAX_KEYS}, MAXL = ${exports.TAP_MAX_LINES}, MAXC = ${exports.TAP_MAX_LINE};
  var sk = ${exports.SAFE_KEY_JS};
  function ty(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return v.length === 0 ? 'array0' : 'array';
    var t = typeof v;
    return t === 'string' || t === 'number' || t === 'boolean' || t === 'object' ? t : '';
  }
  var lines = [], seen = Object.create(null), queue = [{ v: root, p: '', d: 0 }];
  for (var qi = 0; qi < queue.length && lines.length < MAXL; qi++) {
    var it = queue[qi];
    if (it.d >= MAXD) continue;
    var kids = [];
    if (Array.isArray(it.v)) {
      if (it.v.length > 0) kids.push([it.p + '[0]', it.v[0]]);
    } else if (it.v !== null && typeof it.v === 'object') {
      var ks = Object.keys(it.v).slice(0, MAXK);
      for (var i = 0; i < ks.length; i++) kids.push([it.p ? it.p + '.' + sk(ks[i]) : sk(ks[i]), it.v[ks[i]]]);
    }
    for (var j = 0; j < kids.length && lines.length < MAXL; j++) {
      var p = kids[j][0], c = kids[j][1], t = ty(c);
      if (!t || seen[p] === 1) continue;
      seen[p] = 1;
      var line = p + ' : ' + t;
      if (line.length > MAXC) continue;
      lines.push(line);
      queue.push({ v: c, p: p, d: it.d + 1 });
    }
  }
  return lines;
}`;
/** findPaymentPair 와 같은 함수 식 */
exports.FIND_PAIR_JS = String.raw `function (root) {
  var nodes = 0;
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function ok(v) { return (typeof v === 'string' && v.length > 0) || (typeof v === 'number' && isFinite(v)); }
  function rec(v, d) {
    if (d > ${exports.PAIR_MAX_DEPTH} || nodes >= ${exports.PAIR_MAX_NODES} || v === null || typeof v !== 'object') return null;
    nodes++;
    var i, r;
    if (Array.isArray(v)) {
      for (i = 0; i < v.length && nodes < ${exports.PAIR_MAX_NODES}; i++) { r = rec(v[i], d + 1); if (r) return r; }
      return null;
    }
    if (has(v, 'paymentId') && has(v, 'tid') && ok(v.paymentId) && ok(v.tid)) return { paymentId: v.paymentId, tid: v.tid };
    var ks = Object.keys(v);
    for (i = 0; i < ks.length && nodes < ${exports.PAIR_MAX_NODES}; i++) { r = rec(v[ks[i]], d + 1); if (r) return r; }
    return null;
  }
  return rec(root, 0);
}`;
/** 호스트가 새 문서마다 넣는 한 줄 — 이미 쌍 호출 기록이 있으면 이 문서에서는 부르지 않는다(다 막지는 못하는 최선의 방법: 호출은 쌍을 찾고 TAP_PAIR_DELAY_MS 뒤에 한다) */
exports.NO_PAIR_SCRIPT = 'window.__ytNoPair=1;true;';
/**
 * 주입 스크립트(문서 시작 시점, probe 일 때만). 이미 심었으면 다시 심지 않는다. 원래 응답 · 호출은 바꾸지 않고 예외는 모두 삼킨다.
 *  a. fetch · XHR 을 감싸 TAP_HOSTS 호스트의 JSON 응답 구조를 {type:'tap', target, host, path, apiPath, apiHost, queryKeys, lines} 로 앱에 보낸다.
 *     target: 주소에 order-histories → order-histories · receipts/card-single → 쿼리 키에 payId 면 card-single(A), paymentId 면 card-single-B · 페이지가 /receipts/issue-history → issue-history · 그 밖 api.
 *     같은 target + 호스트 + 경로 모양은 한 번, 페이지당 TAP_MAX_PER_PAGE 개. apiPath 는 숫자를 가린 경로이고 쿼리는 키 이름만 queryKeys 로 보낸다(값 없음).
 *  b. __NEXT_DATA__ 의 구조를 {type:'tap', target:'nextdata', …} 로 보낸다.
 *  c. pay.naver.com 이면 __NEXT_DATA__ 에서 paymentId · tid 쌍(첫 쌍 하나)을 찾아 같은 출처로 card-single GET 을 한 번만 부른다. 응답 구조는 (a)의 감싸기가 기록한다.
 *     쌍이 없으면 호출하지 않고 'none : pair-not-found' 만, 호출이 실패하면(HTTP 오류 · JSON 아님) 'none : http-error' 만 기록한다. 쌍의 값은 주소를 만드는 데만 쓴다.
 */
exports.SHAPE_TAP_SCRIPT = String.raw `(function () {
  try {
    if (window.__ytTap) return;
    window.__ytTap = 1;
    var HOSTS = ${JSON.stringify(exports.TAP_HOSTS)};
    var MAX_PAGE = ${exports.TAP_MAX_PER_PAGE};
    var PAIR_DELAY = ${exports.TAP_PAIR_DELAY_MS};
    var AP = '${exports.TAP_PAIR_API_PATH}';
    var seen = Object.create(null);
    var sent = 0;
    var safeKey = ${exports.SAFE_KEY_JS};
    var walk = ${exports.SHAPE_WALK_JS};
    var findPair = ${exports.FIND_PAIR_JS};
    function post(o) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {}
    }
    function maskSeg(s) {
      if (!s) return s;
      if (/^\d+$/.test(s)) return ':n';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return ':id';
      if (/^[A-Za-z0-9_-]{16,}$/.test(s)) return ':id';
      return s.replace(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g, '가').replace(/\d{4,}/g, ':n').replace(/[^A-Za-z0-9 _\-:.\/=#,*()>+~|'"가]/g, '_').slice(0, 40);
    }
    function maskPath(p) {
      return String(p).split('/').map(maskSeg).join('/').slice(0, 150);
    }
    function where(u) {
      try {
        var x = new URL(String(u), location.href);
        if (HOSTS.indexOf(x.hostname) < 0) return null;
        var qk = [];
        x.searchParams.forEach(function (v, k) { if (qk.length < 20) qk.push(safeKey(k)); });
        return { host: x.hostname, path: maskPath(x.pathname), qk: qk };
      } catch (e) { return null; }
    }
    function targetOf(w) {
      if (w.path.indexOf('order-histories') >= 0) return 'order-histories';
      if (w.path.indexOf('receipts/card-single') >= 0) return w.qk.indexOf('payId') >= 0 ? 'card-single' : (w.qk.indexOf('paymentId') >= 0 ? 'card-single-B' : 'card-single');
      if (String(location.pathname).indexOf('/receipts/issue-history') === 0) return 'issue-history';
      return 'api';
    }
    function tap(target, apiHost, apiPath, qk, json) {
      try {
        var key = target + '|' + apiHost + '|' + apiPath;
        if (seen[key] === 1 || sent >= MAX_PAGE) return;
        var lines = walk(json);
        if (lines.length === 0) return;
        seen[key] = 1;
        sent++;
        var m = { type: 'tap', target: target, host: location.host, path: location.pathname, lines: lines };
        if (apiPath) { m.apiPath = apiPath; m.apiHost = apiHost; }
        if (qk && qk.length) m.queryKeys = qk;
        post(m);
      } catch (e) {}
    }
    function noneTap(why) {
      try {
        var key = 'none|' + why;
        if (seen[key] === 1 || sent >= MAX_PAGE) return;
        seen[key] = 1;
        sent++;
        post({ type: 'tap', target: 'card-single-B', host: location.host, path: location.pathname, apiPath: AP, lines: ['none : ' + why] });
      } catch (e) {}
    }
    function fromText(w, t) {
      try {
        if (typeof t !== 'string' || t.length < 2 || t.length > 3000000) return;
        var c = t.charAt(0);
        if (c !== '{' && c !== '[') return;
        tap(targetOf(w), w.host, w.path, w.qk, JSON.parse(t));
      } catch (e) {}
    }
    var of = window.fetch;
    if (typeof of === 'function') {
      window.fetch = function (input) {
        var p = of.apply(this, arguments);
        try {
          var w = where(typeof input === 'string' ? input : (input && input.url) || '');
          if (w) {
            p.then(function (res) {
              try {
                if (res && typeof res.clone === 'function') res.clone().text().then(function (t) { fromText(w, t); }, function () {});
              } catch (e) {}
            }, function () {});
          }
        } catch (e) {}
        return p;
      };
    }
    var X = window.XMLHttpRequest;
    if (X && X.prototype) {
      var xo = X.prototype.open;
      var xs = X.prototype.send;
      X.prototype.open = function (m, u) {
        try { this.__ytTapU = u; } catch (e) {}
        return xo.apply(this, arguments);
      };
      X.prototype.send = function () {
        var self = this;
        try {
          var w = where(self.__ytTapU);
          if (w) self.addEventListener('load', function () {
            try {
              if (self.responseType === 'json') { if (self.response && typeof self.response === 'object') tap(targetOf(w), w.host, w.path, w.qk, self.response); }
              else fromText(w, self.responseText);
            } catch (e) {}
          });
        } catch (e) {}
        return xs.apply(this, arguments);
      };
    }
    var called = false;
    function callPair(pair) {
      try {
        if (called || window.__ytNoPair) return;
        called = true;
        var url = AP + '?svcInfType=PD&paymentId=' + encodeURIComponent(String(pair.paymentId)) + '&tid=' + encodeURIComponent(String(pair.tid)) + '&isFromPayCenter=false';
        var bad = function () { noneTap('http-error'); };
        window.fetch(url, { credentials: 'include', headers: { accept: 'application/json, text/plain, */*' } }).then(function (res) {
          try {
            if (!res || !res.ok) { bad(); return; }
            res.clone().text().then(function (t) { var c = typeof t === 'string' ? t.charAt(0) : ''; if (c !== '{' && c !== '[') bad(); }, bad);
          } catch (e) { bad(); }
        }, bad);
      } catch (e) { noneTap('http-error'); }
    }
    var nextDone = false;
    function nextData() {
      try {
        if (nextDone) return;
        var el = document.getElementById('__NEXT_DATA__');
        if (!el) return;
        nextDone = true;
        var t = el.textContent;
        if (typeof t !== 'string' || t.length < 2 || t.length > 3000000) return;
        var json = JSON.parse(t);
        // 설정 덩이(runtimeConfig)가 줄을 다 써서 정작 데이터 구조가 안 남던 문제(10-29 pay.naver.com/history 행 163) — 설정은 빼고, 쿼리 데이터는 뿌리마다 따로 걷는다
        var slim = {};
        for (var k0 in json) if (k0 !== 'runtimeConfig') slim[k0] = json[k0];
        tap('nextdata', '', '', null, slim);
        try {
          var dq = json.props.pageProps.dehydratedState.queries;
          for (var qi = 0; dq && qi < dq.length && qi < 4; qi++) {
            var dd = dq[qi] && dq[qi].state && dq[qi].state.data;
            if (dd && typeof dd === 'object') tap('nextdata', '', 'q' + qi, null, dd);
          }
        } catch (e) {}
        if (location.hostname === 'pay.naver.com') {
          var pair = findPair(json);
          if (!pair) noneTap('pair-not-found');
          else setTimeout(function () { callPair(pair); }, PAIR_DELAY);
        }
      } catch (e) {}
    }
    document.addEventListener('DOMContentLoaded', nextData);
    window.addEventListener('load', function () { setTimeout(nextData, 500); });
    if (document.readyState !== 'loading') setTimeout(nextData, 500);
  } catch (e) {}
})();
true;`;
const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : null);
/** 웹뷰가 보낸 tap 메시지 한 덩이를 검사해 읽는다. 모양이 틀리면 null */
function parseTapMessage(m) {
    if (m === null || typeof m !== 'object')
        return null;
    const r = m;
    if (r.type !== 'tap')
        return null;
    const target = exports.TAP_TARGETS.includes(r.target) ? r.target : null;
    const host = str(r.host, 200);
    const path = str(r.path, 500);
    if (!target || !host || path === null || !Array.isArray(r.lines))
        return null;
    const lines = r.lines.filter((x) => typeof x === 'string' && x.length > 0 && x.length <= exports.TAP_MAX_LINE).slice(0, exports.TAP_MAX_LINES);
    if (lines.length === 0)
        return null;
    const queryKeys = Array.isArray(r.queryKeys) ? r.queryKeys.filter((x) => typeof x === 'string' && x.length <= 40).slice(0, 20) : [];
    return { target, host, path, apiHost: str(r.apiHost, 200) ?? '', apiPath: str(r.apiPath, 200) ?? '', queryKeys, lines };
}
/** 같은 화면 모양 + target + 요청 경로는 한 번만 올린다. 「없음」 기록은 구조 기록과 따로 센다 */
function tapKey(r) {
    const none = r.lines[0].startsWith('none : ') ? '|none' : '';
    return `${(0, probe_1.screenKey)(r.host + r.path)}|${r.target}|${r.apiHost}${r.apiPath}${none}`;
}
/** 서버 구조 기록(buildPayload)이 받는 raw. 구조 줄만 outline 에 담는다 — 요청 목록 · 쿠키 이름은 비운다 */
function tapRaw(r) {
    const head = [`tap:${r.target}`];
    if (r.apiPath)
        head.push(`api:${r.apiHost}${r.apiPath}`);
    if (r.queryKeys.length > 0)
        head.push(`query:${r.queryKeys.join(',')}`);
    return { host: r.host, path: r.path, queryKeys: [], cookieNames: [], outline: [...head, ...r.lines], repeat: {}, requests: [] };
}
