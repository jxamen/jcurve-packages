/**
 * 네이버 영수증 요청 스크립트 — pay.naver.com 출처의 숨은 웹뷰 안에서 요청만 부른다(클릭 · 화면 이동 없음, 대표님 10-28 23:14~23:23 요청 형식).
 *  - 주문 한 건의 짝(payId · tid · productOrderNo)이 목록에 이미 있으면 바로
 *      GET /web-api/receipts/card-single?payId=…&tid=…&productOrderNo=…&isFromPayCenter=false        (B형 · 23:23 쇼핑 카드 영수증)
 *    paymentId(NP로 시작) + tid 만 있으면
 *      GET /web-api/receipts/card-single?svcInfType=PD&paymentId=…&tid=…&isFromPayCenter=false       (A형 · 23:20 카드 영수증)
 *  - 짝이 목록에 없으면 대표님 22:28 원문 길 GET /receipts/issue-history?orderNo=<주문번호>(같은 출처 요청, 화면은 열지 않음)를 받아
 *    그 HTML 의 「카드영수증」 링크(href=/receipts/preview/card?tid=…&productOrderNo=…&exitType=back&payId=…, 대표님 14:19 원문)에서 이름 그대로 짝을 읽는다.
 * 응답 JSON 은 앱 밖으로 보내지 않는다 — 이 스크립트가 영수증 칸(허용 필드)만 뽑아 {step:'receipts'} 로 한 번 알린다.
 * 요청마다 시간 제한이 있고 전체 마감도 있어서 구동기의 20초 감시보다 먼저 답한다. window.__ytAbortReceipts() 로 즉시 멈출 수 있다.
 * react-native 를 import 하지 않는다(노드의 vm 으로 이 스크립트 자체를 시험한다).
 */
import { SAFE_KEY_JS, SHAPE_WALK_JS } from './shapeTap';

/** 주문 한 건의 요청 — key 는 runOutcome.outcomeKey. payId · tid · paymentId 는 목록 항목에서 이미 얻은 값(없으면 영수증 응답에서 얻는다) */
export type ReceiptJob = { key: string; orderNo: string; productOrderNo?: string; payId?: string; tid?: string; paymentId?: string;
  /** 간편결제(SIMPLE_PAYMENT) · 외부몰 네이버페이 — orders.pay.naver.com 출처에서 GET orderApi/payment/detail/info 로 tid 를 얻는 작업(11-02 대표님 확인 길, 전부 HTTP) */
  pinfo?: boolean;
  /** 카드영수증이 없는 결제(네이버페이 머니 · 포인트 · 계좌) — orders.pay.naver.com 출처에서 GET orderApi/orderSheet/detail/?orderNo= (7071 웹 「상세 — 주문서」 요청 그대로)로
      주문상세를 영수증으로 읽는다(11-02 22:40 대표님 「네이버페이 영수증은 별도로 없고 주문상세에 있고」) */
  osheet?: boolean };

/** 네이버페이 내역(pay.naver.com/history __NEXT_DATA__) 한 줄 — pageProps.dehydratedState.queries[].state.data.pages[].items[] 의 이름 그대로(10-29 15:36 실기록 키 트리) */
export type PayRow = { orderNo?: string; payId?: string; productOrderNo?: string; at?: number; amount?: number;
  /** 주문번호가 없는 결제 — 그 줄 buttons[] 의 영수증 주소(/receipts/preview/card?) 쿼리 이름 그대로(B형 payId · tid · productOrderNo / A형 paymentId · tid) */
  tid?: string; paymentId?: string;
  /** 간편결제 줄(serviceType SIMPLE_PAYMENT) — orderDetailUrl 의 경로 · 쿼리 그대로(/instantPay/detail/<결제번호>?…, 10-29 16:36 실기록) */
  instant?: string;
  /** 내역 줄 status 가 취소 · 반품(name CANCEL/RETURN 또는 글자 취소/반품) */
  cancelled?: boolean };

/** card-single 응답에서 뽑는 영수증 칸(허용 필드만). 시각은 사이트가 준 그대로(문자열 · 숫자) — 해석은 흐름이 한다 */
export type ReceiptSlip = {
  approvalNo?: string; cardCompany?: string; approvalAt?: string | number; cancelAt?: string | number;
  productName?: string; sellerName?: string; businessNo?: string; amount?: number; cancelAmount?: number;
  /** 대표님 10-29 14:15 원문 칸(card-single 응답) — 세부 화면에 모두 보인다(14:26 「빈게 너무 많아」). 카드번호는 사이트가 가린 값 그대로 */
  cardNo?: string; tradeType?: string; ownerType?: string; installmentType?: string; productOrderNo?: string;
  sellerRepresentative?: string; sellerTel?: string; sellerAddress?: string;
  merchantName?: string; merchantBusinessNo?: string;
  supplyAmount?: number; taxAmount?: number; totalAmount?: number;
  /** 대표님 폰 실기록(10-29 14:31 rcpt-cardok) 응답에만 있던 칸 — 원문 칸 전부라 같이 */
  expiredYear?: string; expiredMonth?: string; merchantRepresentative?: string; merchantNo?: string; merchantAddress?: string;
  serviceCharge?: number; disposableCupAmount?: number;
  /** 주문상세(orderSheet · payment/detail/info)에서 읽은 비카드 결제 — 흐름이 구매영수증(kind purchase)으로 올린다. tradeType 에 결제수단 글자 */
  orderSheet?: boolean;
};

/**
 * st: ok 영수증을 읽음(slip) · none 카드 영수증이 없는 결제 · login 로그인이 풀림 · blocked 사이트가 막음(403 · 429) ·
 *     net 요청 실패 · 시간 초과 · nopair 부를 주소의 값을 못 찾음 · shape 응답 모양이 달라 읽지 못함
 */
export type ReceiptStatus = 'ok' | 'none' | 'login' | 'blocked' | 'net' | 'nopair' | 'shape' | 'pair';
/**
 * 실패한 줄의 진단 — 값이 아니라 모양만(대표님 10-29 12:00 「쇼핑 9건 전부 못 가져옴」, 줄별 까닭이 서버에 안 올라와 원인을 못 찍음).
 *  w 단계(order 주문번호로 짝 찾기 · card 카드 영수증 · pair 짝 만들기) · status HTTP 번호(0 은 응답 없음) · lines 구조 줄(경로 : 형태 · fmt 경로 : 자릿수 모양)
 */
export type ReceiptDiag = { w: string; status: number; lines: string[] };
export type ReceiptResult = { key: string; st: ReceiptStatus; slip?: ReceiptSlip; status?: number; diag?: ReceiptDiag; found?: number;
  /** 「카드영수증」 링크가 없을 때의 payId(작업에 있던 것 또는 issue-history __NEXT_DATA__ 의 이름 payId) — ② 길에서 쓴다 */
  payId?: string;
  /** ② orderSheet/detail 결과(st 'pair') — 간편결제 화면이면 pos 없이 paymentId */
  tid?: string; pos?: string[]; paymentId?: string;
  /** 간편결제에서 tid 를 얻은 길 — read(화면 · 상태 읽기) · tap(영수증 버튼 눌러 주소 받기) */
  via?: 'read' | 'tap';
  /** np:scan — 네이버페이 내역 줄(주문번호 · payId · 상품 주문번호 · 시각 · 금액) */
  rows?: PayRow[];
  /** np:scan(v2) — 이 내역 화면의 pages[].curPage · pages[].totalPage */
  page?: number; pages?: number;
  /** np:scan(v2) — 스크립트가 _next/data 로 모든 쪽을 직접 받아 한 번에 끝냈다(흐름이 쪽을 더 넘기지 않게 한다, 무한 재시도 금지) */
  full?: boolean };

/**
 * scan 이면 영수증 요청 뒤에 이 페이지(pay.naver.com/history)의 __NEXT_DATA__ 를 읽어 결제 짝(paymentId · tid)을 값의 모양으로 찾아 같은 방식으로 영수증을 받는다(대표님 10-28 23:18 「네이버페이는 이 페이지에서 __NEXT_DATA__ 이 부분 읽어야 함」).
 * 결과 key 는 np:<결제 번호>, 짝 개수와 위치 모양은 key np:scan 의 found · diag 로 알린다. skip 은 이미 가져온 결제 번호(건너뜀).
 */
export type ReceiptsRun = { jobs: ReceiptJob[]; conc: number; staggerMs: number; gapMs: number; timeoutMs: number; deadlineMs: number; scan?: boolean; skip?: string[];
  /** 새 네이버페이 수집 길(서버 npv2 — 목록 회원만): 내역 줄의 주문번호 · 금액 대체 칸 · buttons[] 영수증 주소 · 못 찾은 줄 진단 · 페이지 수 */
  v2?: boolean };

/** 한 번에 보내는 최대 작업 수 · 동시에 부르는 수 · 첫 요청 간격 · 요청 시간 제한 · 전체 마감(구동기 감시 20초보다 짧게). 막혔을 때는 RECEIPTS_SLOW 로 늦춘다 */
export const RECEIPTS_BATCH = 8;
export const RECEIPTS_CONC = 4;
export const RECEIPTS_STAGGER_MS = 150;
export const RECEIPTS_TIMEOUT_MS = 9_000;
export const RECEIPTS_DEADLINE_MS = 16_000;
/** 사이트가 막았을 때(403 · 429) 늦춘 설정 — 한 번에 2건, 하나씩, 요청 사이 1.2초 */
export const RECEIPTS_SLOW = { batch: 2, conc: 1, gapMs: 1_200 } as const;

/** 진행 중인 요청을 모두 끊는다(구동기 stop 이 넣는다) */
export const ABORT_RECEIPTS_SCRIPT = 'try{window.__ytAbortReceipts&&window.__ytAbortReceipts();}catch(e){};true;';

/** 작업 검사 — 열 개 이하의 모양이 맞는 값만(주소에 들어가는 값이라 숫자 · PD · NP 모양만 받는다) */
export function checkReceiptsRun(r: ReceiptsRun): void {
  const num = (v: string | undefined, re: RegExp): boolean => v === undefined || re.test(v);
  if (!Array.isArray(r.jobs) || r.jobs.length < (r.scan === true ? 0 : 1) || r.jobs.length > 16) throw new Error('bad jobs');
  if (r.skip !== undefined && (!Array.isArray(r.skip) || r.skip.length > 600 || r.skip.some((x) => typeof x !== 'string' || !/^[0-9A-Za-z]{8,30}$/.test(x)))) throw new Error('bad skip');
  for (const j of r.jobs) {
    if (typeof j.key !== 'string' || j.key.length < 1 || j.key.length > 60) throw new Error('bad key');
    if (!/^\d{8,20}$/.test(j.orderNo)) throw new Error('bad orderNo');
    if (j.pinfo !== undefined && (j.pinfo !== true || !j.paymentId)) throw new Error('bad pinfo');
    if (j.osheet !== undefined && (j.osheet !== true || j.pinfo !== undefined || !/^\d{16}$/.test(j.orderNo))) throw new Error('bad osheet');
    if (!num(j.productOrderNo, /^(PD)?\d{8,24}$/) || !num(j.payId, /^\d{18,22}$/) || !num(j.tid, /^\d{18,22}$/) || !num(j.paymentId, /^\d{8}NP\d{6,14}$/)) throw new Error('bad pair');
  }
  if (![r.conc, r.staggerMs, r.gapMs, r.timeoutMs, r.deadlineMs].every((v) => Number.isInteger(v) && v >= 0 && v <= 60_000) || r.conc < 1 || r.conc > 8) throw new Error('bad run');
}

export function receiptsScript(r: ReceiptsRun): string {
  checkReceiptsRun(r);
  return String.raw`(function (a) {
  function post(o) { try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {} }
  var ctls = [];
  var aborted = false;
  window.__ytAbortReceipts = function () { aborted = true; for (var i = 0; i < ctls.length; i++) { try { ctls[i].abort(); } catch (e) {} } };
  var PAYID = /^\d{8}NP\d{6,14}$/;
  function digs(v, lo, hi) {
    var s = typeof v === 'number' ? String(v) : (typeof v === 'string' ? v : '');
    return /^\d+$/.test(s) && s.length >= lo && s.length <= hi ? s : undefined;
  }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : undefined; }
  function prim(v) { return typeof v === 'string' || typeof v === 'number' ? v : undefined; }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : undefined;
    if (typeof v === 'string' && /^[\d,\s]+$/.test(v) && /\d/.test(v)) return Number(v.replace(/[,\s]/g, ''));
    return undefined;
  }
  /* 20자리 아이디가 JSON 숫자로 오면 JS 가 끝자리를 잃는다(2^53 초과) — 16자리 이상 숫자는 문자열로 감싸서 읽는다(안 되면 그대로 읽는다) */
  function parseBig(t) {
    var s = String(t);
    try { return JSON.parse(s.replace(/([:\[,]\s*)(-?\d{16,})(?=\s*[,}\]])/g, '$1"$2"')); } catch (e) { return JSON.parse(s); }
  }
  /* ref: 대표님 브라우저가 이 요청을 부를 때의 Referer(영수증 보기 화면 주소, 같은 출처) — 서버가 출처 화면을 보는 경우를 닮게 한다 */
  function getJson(path, ref) { return request(path, ref, false); }
  /* asText 면 응답을 글자(HTML) 그대로 돌려준다 — 영수증 목록 화면(issue-history)은 JSON 이 아니라 화면이다 */
  function request(path, ref, asText) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    if (ctl) ctls.push(ctl);
    var timer = ctl ? setTimeout(function () { try { ctl.abort(); } catch (e) {} }, a.timeoutMs) : null;
    var init = { credentials: 'include', signal: ctl ? ctl.signal : undefined };
    if (!asText) init.headers = { accept: 'application/json, text/plain, */*' };
    if (ref) { init.referrer = ref; init.referrerPolicy = 'unsafe-url'; }
    return fetch(path, init).then(function (res) {
      if (timer) clearTimeout(timer);
      var s = res.status;
      if (s === 401 || (res.redirected && /nid\.naver\.com/i.test(String(res.url || '')))) return { st: 'login', status: s };
      if (s === 403 || s === 429) return { st: 'blocked', status: s };
      if (!res.ok) return { st: 'net', status: s };
      if (asText) return res.text().then(function (t) { return { st: 'ok', t: String(t || ''), status: s }; }, function () { return { st: 'net', status: s }; });
      var body = typeof res.text === 'function' ? res.text().then(parseBig) : res.json();
      return body.then(function (j) { return { st: 'ok', j: j, status: s }; }, function () { return { st: 'shape', status: s }; });
    }, function () { if (timer) clearTimeout(timer); return { st: 'net', status: 0 }; });
  }
  /* 진단(값 없음) — 실패한 줄 몇 개만 구조를 남긴다: 응답 키 구조(walk) + 아이디 칸의 자릿수 모양(fmt). 한 번 실행에 diagLeft 개까지 */
  var walk = ${SHAPE_WALK_JS};
  var sk = ${SAFE_KEY_JS};
  var diagLeft = 3;
  var cardSeen = false;
  function fmt(v) {
    var s = typeof v === 'number' ? String(v) : (typeof v === 'string' ? v : '');
    if (!s) return 'none';
    var out = '', i = 0;
    while (i < s.length && out.length < 40) {
      var c = s.charAt(i), kind = /[0-9]/.test(c) ? 'n' : (/[A-Za-z]/.test(c) ? 'a' : '_'), j = i;
      while (j < s.length && (/[0-9]/.test(s.charAt(j)) ? 'n' : (/[A-Za-z]/.test(s.charAt(j)) ? 'a' : '_')) === kind) j++;
      out += kind + (j - i);
      i = j;
    }
    return out;
  }
  var ID_KEY = /^(tid|payId|productOrderNo|paymentId)$/;   // 대표님 원문(22:29 · 23:20)의 칸 이름 — 이 이름이 어느 경로에 있는지(값 없이 모양만) 기록한다
  function idFmts(j) {
    var out = [], nodes = 0;
    function rec(o, p, d) {
      if (!o || typeof o !== 'object' || d > 8 || nodes++ > 3000 || out.length >= 24) return;
      if (Array.isArray(o)) { for (var i = 0; i < o.length && i < 2; i++) rec(o[i], p + '[' + i + ']', d + 1); return; }
      for (var k in o) {
        var v = o[k], path = p ? p + '.' + sk(k) : sk(k);
        if (ID_KEY.test(k) && (typeof v === 'string' || typeof v === 'number')) out.push('fmt ' + path + ' : ' + fmt(v));
        else if (v && typeof v === 'object') rec(v, path, d + 1);
        if (out.length >= 24) return;
      }
    }
    rec(j, '', 0);
    return out;
  }
  /* 대표님 10-29 14:19 원문: <a href="/receipts/preview/card?tid=…&productOrderNo=…&exitType=back&payId=…" data-nlog-click="rec.card">카드영수증</a>
     — href 가 /receipts/preview/card? 로 시작하거나 data-nlog-click="rec.card" 인 a 를 모두 찾고, 쿼리의 tid · productOrderNo · payId 를 그 이름 그대로 읽는다(&amp; 풀기) */
  function cardLinks(html) {
    var out = [], seen = {};
    var re = /<a\b[^>]*>/gi, m, n = 0;
    while ((m = re.exec(String(html || ''))) && n++ < 2000 && out.length < 20) {
      var tag = m[0];
      var hm = /\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
      if (!hm) continue;
      var href = (hm[2] !== undefined ? hm[2] : hm[3]).replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&#x26;/gi, '&');
      if (href.indexOf('/receipts/preview/card?') !== 0 && !/data-nlog-click\s*=\s*["']rec\.card["']/i.test(tag)) continue;
      var qi = href.indexOf('?');
      if (qi < 0) continue;
      var q = {};
      var parts = href.slice(qi + 1).split('&');
      for (var i = 0; i < parts.length; i++) { var kv = parts[i].split('='); if (kv.length >= 2) { try { q[kv[0]] = decodeURIComponent(kv.slice(1).join('=')); } catch (e) { q[kv[0]] = kv.slice(1).join('='); } } }
      var tid = digs(q.tid, 18, 22), payId = digs(q.payId, 18, 22);
      var po = typeof q.productOrderNo === 'string' && /^(PD)?\d{8,24}$/.test(q.productOrderNo) ? q.productOrderNo : undefined;
      if (!tid || !payId || !po) continue;
      if (seen[tid + '|' + po]) continue;
      seen[tid + '|' + po] = 1;
      // Referer = 그 href 를 절대 주소로 바꾼 값 그대로(원문 23:23 과 같은 모양)
      var ref = href.charAt(0) === '/' ? 'https://pay.naver.com' + href : href;
      if (!/^https:\/\/pay\.naver\.com\//.test(ref)) ref = undefined;   // 같은 출처일 때만 Referer 로 쓴다
      out.push({ tid: tid, productOrderNo: po, payId: payId, ref: ref });
    }
    return out;
  }
  /* 키 이름 트리(값 없음) — 배열은 앞 50개 항목의 키를 합쳐 [] 한 줄로, 깊이 maxD 까지 「tree 경로 : 형태들」. 줄은 200자 안 */
  function keyTree(root, maxD, maxLines) {
    var types = {}, order = [];
    function ty(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; }
    function add(p, v) { if (!types[p]) { types[p] = {}; order.push(p); } types[p][ty(v)] = 1; }
    (function rec(o, p, d) {
      if (d > maxD || order.length > 600 || !o || typeof o !== 'object') return;
      if (Array.isArray(o)) { for (var i = 0; i < o.length && i < 50; i++) { add(p + '[]', o[i]); rec(o[i], p + '[]', d + 1); } return; }
      for (var k in o) { var path = p ? p + '.' + sk(k) : sk(k); add(path, o[k]); rec(o[k], path, d + 1); }
    })(root, '', 1);
    var out = [];
    for (var i = 0; i < order.length && out.length < maxLines; i++) {
      var tail = ' : ' + Object.keys(types[order[i]]).join('|');
      var path = order[i].length > 180 - tail.length ? '…' + order[i].slice(order[i].length - (179 - tail.length)) : order[i];
      out.push('tree ' + path + tail);
    }
    return out;
  }
  /* 이름이 정확히 name 인 첫 값(깊이 14, 노드 20000까지) — 다른 이름은 보지 않는다 */
  function firstByName(root, name, ok) {
    var nodes = 0, hit;
    (function rec(o, d) {
      if (hit !== undefined || !o || typeof o !== 'object' || d > 14 || nodes++ > 20000) return;
      if (Array.isArray(o)) { for (var i = 0; i < o.length && i < 300; i++) rec(o[i], d + 1); return; }
      for (var k in o) { var v = o[k]; if (k === name && ok(v)) { hit = String(v); return; } if (v && typeof v === 'object') rec(v, d + 1); if (hit !== undefined) return; }
    })(root, 0);
    return hit;
  }
  /* 이름이 정확히 name 인 첫 객체 칸의 값(깊이 14) — orderReceipt 같은 덩이를 찾는다 */
  function firstObjByName(root, name) {
    var nodes = 0, hit;
    (function rec(o, d) {
      if (hit !== undefined || !o || typeof o !== 'object' || d > 14 || nodes++ > 20000) return;
      if (Array.isArray(o)) { for (var i = 0; i < o.length && i < 300; i++) rec(o[i], d + 1); return; }
      for (var k in o) { var v = o[k]; if (k === name && v && typeof v === 'object') { hit = v; return; } if (v && typeof v === 'object') rec(v, d + 1); if (hit !== undefined) return; }
    })(root, 0);
    return hit;
  }
  /* 간편결제(SIMPLE_PAYMENT) · 외부몰 네이버페이의 짝 얻기 — 11-02 대표님 확인 길(전부 HTTP, 화면을 열거나 단추를 누르지 않는다):
       GET https://orders.pay.naver.com/orderApi/payment/detail/info?paymentId=<결제번호>&yearMonthFormatDate=<YYYY-MM>
       (yearMonthFormatDate 를 비우면 400 · 아무 연-월이나 받는다) → result.receipt.card.url 안 tid.
     이 호출은 orders.pay.naver.com 출처에서만 된다(pay.naver.com 출처는 CORS 거절 — 11-02 PC 크롬 실측) → 흐름이 그 출처 화면을 한 번 열고 이 작업 묶음을 부른다 */
  function pinfoJob(job) {
    var d = new Date();
    var ym = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    return request('https://orders.pay.naver.com/orderApi/payment/detail/info?paymentId=' + encodeURIComponent(job.paymentId) + '&yearMonthFormatDate=' + ym, null).then(function (r) {
      var head = ['pinfo ' + r.st + ' ' + (r.status || 0)];
      if (r.st !== 'ok') return { key: job.key, st: r.st === 'login' || r.st === 'blocked' ? r.st : 'nopair', status: r.status, diag: mkDiag('pinfo', r.status || 0, null, head) };
      var cardUrl = r.j && r.j.result && r.j.result.receipt && r.j.result.receipt.card && r.j.result.receipt.card.url;
      var tid = typeof cardUrl === 'string' ? ((/[?&]tid=(\d{18,22})/.exec(cardUrl) || [])[1]) : undefined;
      // 카드영수증이 원래 없는 결제(receipt.card 없음)는 실패가 아니라 「영수증 없음」(대표님 11-02 ④)
      if (!tid) {
        var noCard = r.j && r.j.result && r.j.result.receipt && !r.j.result.receipt.card;
        // 카드가 아닌 간편결제(머니 · 포인트) — 이 결제 상세 응답을 영수증으로 읽는다(11-02 22:40 대표님 「영수증이 별도로 없고 주문상세에 있고」)
        var po = null;
        if (noCard) { try { po = osheetSlipOf(r.j.result); } catch (e) { po = null; } }
        if (po && !po.cancel && !po.card && po.slip.amount !== undefined) return { key: job.key, st: 'ok', slip: po.slip, diag: mkDiag('pinfoslip', r.status || 200, r.j, head.concat(osheetHead(po))) };
        return { key: job.key, st: noCard ? 'none' : 'nopair', status: r.status, diag: mkDiag('pinfo', r.status, r.j, head.concat(['have card.url ' + !!cardUrl])) };
      }
      return { key: job.key, st: 'pair', status: r.status, tid: tid, pos: [], paymentId: job.paymentId };
    });
  }
  /* 주문상세 = 영수증(카드가 아닌 결제) — 칸 구조 기록이 아직 없어(「미확인」) 이름으로만 찾는다: 첫 번째로 나온 이름의 값, 정해 둔 이름 차례로.
     결제수단은 이름에 means · method · payType 이 든 칸의 글자(MONEY · POINT · BANK · CARD), 취소 · 반품은 이름에 status 가 든 칸의 글자.
     읽은 칸이 맞는지 서버에서 볼 수 있게 늘 값을 가린 구조 기록(walk)을 같이 남긴다 */
  var OS_AMT = ['totalPayAmount', 'totalPaymentAmount', 'totalOrderAmount', 'paymentAmount'];   // 주문 전체 금액 이름만(상품 한 줄 금액을 주문 금액으로 잘못 읽지 않게)
  var OS_AT = ['paymentDateTime', 'payDateTime', 'paymentDate', 'payDate', 'orderDateTime', 'orderDate'];
  var OS_TITLE = ['productName', 'orderProductName', 'itemName'];
  var OS_SHOP = ['merchantName', 'sellerName', 'storeName', 'mallName', 'shopName'];
  function osheetSlipOf(root) {
    var first = {}, means = {}, cancel = false, nodes = 0;
    var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
    (function rec(o, d) {
      if (!o || typeof o !== 'object' || d > 14 || nodes++ > 20000) return;
      if (Array.isArray(o)) { for (var i = 0; i < o.length && i < 300; i++) rec(o[i], d + 1); return; }
      for (var k in o) {
        var v = o[k];
        if (typeof v === 'string' || typeof v === 'number') {
          if (!has(first, k)) first[k] = v;
          if (typeof v === 'string') {
            if (/means|method|paytype|paymenttype/i.test(k)) {
              if (/CARD|카드/i.test(v)) means.card = 1;
              if (/MONEY|머니|CHARGE/i.test(v)) means.money = 1;
              if (/POINT|포인트/i.test(v)) means.point = 1;
              if (/BANK|ACCOUNT|TRANSFER|계좌/i.test(v)) means.bank = 1;
            }
            if (/status/i.test(k) && /CANCEL|RETURN|취소|반품/i.test(v)) cancel = true;
          }
        } else if (v && typeof v === 'object') rec(v, d + 1);
      }
    })(root, 0);
    function pick(names, conv) { for (var i = 0; i < names.length; i++) if (has(first, names[i])) { var x = conv(first[names[i]]); if (x !== undefined) return x; } return undefined; }
    var amount = pick(OS_AMT, num);
    var labels = [];
    if (means.money) labels.push('머니');
    if (means.point) labels.push('포인트');
    if (means.bank) labels.push('계좌');
    // card: 올리지 않음 — 카드가 섞였거나 결제수단(머니 · 포인트 · 계좌)을 확인하지 못했다(카드 결제를 「네이버페이」로 올리지 않는다)
    return { cancel: cancel, card: !!means.card || labels.length === 0, slip: {
      orderSheet: true, amount: amount !== undefined && amount >= 1 && amount <= 1e9 ? Math.floor(amount) : undefined,
      approvalAt: pick(OS_AT, function (v) { return String(v).length >= 12 ? v : undefined; }),
      productName: pick(OS_TITLE, function (v) { return str(v, 120); }), sellerName: pick(OS_SHOP, function (v) { return str(v, 80); }),
      tradeType: '네이버페이 ' + labels.join('·') } };
  }
  function osheetHead(o) { return ['amount ' + (o.slip.amount !== undefined), 'at ' + (o.slip.approvalAt !== undefined), 'title ' + (o.slip.productName !== undefined), 'shop ' + (o.slip.sellerName !== undefined), 'means ' + o.slip.tradeType, 'card ' + o.card, 'cancel ' + o.cancel]; }
  /* 7071 웹 「상세 — 주문서(orderSheet)」 요청 그대로: orders.pay.naver.com/order/status/<주문번호> 출처에서 GET /orderApi/orderSheet/detail/?orderNo=<주문번호> */
  function osheetJob(job) {
    var ref = 'https://orders.pay.naver.com/order/status/' + job.orderNo;
    return request('https://orders.pay.naver.com/orderApi/orderSheet/detail/?orderNo=' + encodeURIComponent(job.orderNo), ref).then(function (r) {
      var head = ['osheet ' + r.st + ' ' + (r.status || 0)];
      if (r.st !== 'ok') return { key: job.key, st: r.st === 'login' || r.st === 'blocked' ? r.st : 'nopair', status: r.status, diag: mkDiag('osheet', r.status || 0, null, head) };
      var o = null;
      try { o = osheetSlipOf((r.j && r.j.result) || r.j); } catch (e) { o = null; }
      if (!o) return { key: job.key, st: 'shape', status: r.status, diag: mkDiag('osheet', r.status || 200, r.j, head) };
      var d = mkDiag('osheet', r.status || 200, r.j, head.concat(osheetHead(o)));
      // 취소 · 반품은 계속 거른다 · 카드로만 낸 결제는 카드 영수증 길(여기서 올리지 않는다)
      if (o.cancel || o.card) return { key: job.key, st: 'none', status: r.status, diag: d };
      return { key: job.key, st: 'ok', slip: o.slip, diag: d };
    });
  }
  function mkDiag(w, status, j, extra) {
    if (diagLeft <= 0) return undefined;
    diagLeft--;
    var lines = (extra || []).slice(0, 12);
    if (j) { try { lines = lines.concat(idFmts(j)); lines = lines.concat(walk(j)); } catch (e) {} }
    return { w: w, status: status || 0, lines: lines.slice(0, 300) };
  }
  /* card-single 응답(대표님 14:15 원문 칸): trade.{cardCompanyName · approvalNo · cardNo · type · ownerType · installmentType · approvalDateTime · cancelDateTime · productName · productOrderNo}
     · seller.{name · representative · businessNo · telNo · address} · merchant.{name · businessNo} · paymentDetails.{approvalAmount · cancelAmount · supplyAmount · taxAmount · totalAmount}
     + 14:31 실기록(rcpt-cardok)의 trade.{expiredYear · expiredMonth} · merchant.{representative · merchantNo · address} · paymentDetails.{serviceCharge · disposableCupAmount} */
  function slipOf(j) {
    var t = (j && j.trade) || {};
    var s = (j && j.seller) || {};
    var mc = (j && j.merchant) || {};
    var p = (j && j.paymentDetails) || {};
    var at = prim(t.approvalDateTime);
    if (at === undefined) return null;
    function word(v, max) { var x = prim(v); return x === undefined ? undefined : String(x).slice(0, max); }
    return { approvalNo: str(t.approvalNo, 40), cardCompany: str(t.cardCompanyName, 30), approvalAt: at, cancelAt: prim(t.cancelDateTime), productName: str(t.productName, 120),
      sellerName: str(s.name, 80), businessNo: str(s.businessNo, 20), amount: num(p.approvalAmount), cancelAmount: num(p.cancelAmount),
      cardNo: str(t.cardNo, 40), tradeType: word(t.type, 30), ownerType: word(t.ownerType, 30), installmentType: word(t.installmentType, 30), productOrderNo: str(t.productOrderNo, 40),
      sellerRepresentative: str(s.representative, 40), sellerTel: str(s.telNo, 30), sellerAddress: str(s.address, 200),
      merchantName: str(mc.name, 80), merchantBusinessNo: str(mc.businessNo, 20),
      supplyAmount: num(p.supplyAmount), taxAmount: num(p.taxAmount), totalAmount: num(p.totalAmount),
      expiredYear: str(t.expiredYear, 8), expiredMonth: str(t.expiredMonth, 8), merchantRepresentative: str(mc.representative, 40), merchantNo: str(mc.merchantNo, 30), merchantAddress: str(mc.address, 200),
      serviceCharge: num(p.serviceCharge), disposableCupAmount: num(p.disposableCupAmount) };
  }
  /* 현금영수증 화면(/receipts/integrated/cash) — 11-02 대표님 「현금영수증은 거르면 안 돼 가져와야지」.
     이 화면의 응답 칸 구조는 서버 기록이 아직 없다(값을 가린 구조 기록은 계속 남긴다) — 그래서 칸 이름으로만 찾는다:
     승인 시각 · 금액이 **같은 객체 안에** 함께 있는 첫 객체를 영수증으로 읽고, 시각이 분 단위까지 없거나 금액이 없으면 읽지 않는다(그때는 예전처럼 「영수증 없음」 + 구조 기록). */
  var CASH_AT = ['approvalDateTime', 'tradeDateTime', 'issueDateTime', 'issuedDateTime', 'approvalDate', 'tradeDate', 'issueDate', 'paidAt', 'paymentDateTime', 'useDateTime'];
  var CASH_AMT = ['totalAmount', 'approvalAmount', 'tradeAmount', 'paymentAmount', 'payAmount', 'useAmount', 'issueAmount', 'amount'];
  var CASH_NO = ['approvalNo', 'approvalNumber', 'cashReceiptNo', 'issueNo', 'confirmNo'];
  var CASH_SHOP = ['merchantName', 'sellerName', 'storeName', 'shopName', 'businessName'];
  var CASH_BIZ = ['businessNo', 'bizNo', 'businessNumber', 'merchantBusinessNo'];
  function pickName(o, names, conv) {
    for (var i = 0; i < names.length; i++) { var v = conv(o[names[i]]); if (v !== undefined) return v; }
    return undefined;
  }
  function cashSlipOf(root) {
    var nodes = 0, hit = null;
    function word(v) { return typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, 40) : undefined; }
    function when(v) { return (typeof v === 'string' || typeof v === 'number') && String(v).length >= 12 ? v : undefined; }
    (function rec(o, d) {
      if (hit || !o || typeof o !== 'object' || d > 14 || nodes++ > 20000) return;
      if (Array.isArray(o)) { for (var i = 0; i < o.length && i < 300; i++) rec(o[i], d + 1); return; }
      var at = pickName(o, CASH_AT, when), amount = pickName(o, CASH_AMT, num);
      if (at !== undefined && amount !== undefined && amount >= 1 && amount <= 1e9) {
        hit = { approvalNo: pickName(o, CASH_NO, word), approvalAt: at, cancelAt: prim(o.cancelDateTime), amount: Math.floor(amount), cancelAmount: num(o.cancelAmount),
          sellerName: pickName(o, CASH_SHOP, function (v) { return str(v, 80); }), businessNo: pickName(o, CASH_BIZ, function (v) { return str(v, 20); }), tradeType: '현금영수증' };
        return;
      }
      for (var k in o) { var v = o[k]; if (v && typeof v === 'object') rec(v, d + 1); if (hit) return; }
    })(root, 0);
    return hit;
  }
  function runJob(job) {
    /* ⑤ 현장결제 영수증(대표님 10-30 19:42) — orders.pay.naver.com 주문이 아닌 결제는 pay.naver.com/receipts/offline?paymentId=<결제번호> 로 받는다(화면 안 열고 같은 출처 요청).
       응답 칸 구조는 A32 웹뷰 셀프테스트의 구조 기록(walk)으로 먼저 확인하고, __NEXT_DATA__ 안에서 trade 가 든 객체를 slipOf 로 best-effort 읽는다(card-single 과 같은 trade 모양이면 바로 맞는다). */
    function findTrade(o, d) {
      if (!o || typeof o !== 'object' || d > 10) return null;
      if (o.trade && typeof o.trade === 'object') return o;
      for (var k in o) { var v = o[k]; if (v && typeof v === 'object') { var f = findTrade(v, d + 1); if (f) return f; } }
      return null;
    }
    function offlineReceipt(paymentId) {
      var ref = 'https://pay.naver.com/receipts/offline?paymentId=' + paymentId;
      return request('/receipts/offline?paymentId=' + encodeURIComponent(paymentId), ref, true).then(function (r) {
        if (r.st !== 'ok') return { key: job.key, st: (r.st === 'net' || r.st === 'shape') ? 'nopair' : r.st, status: r.status, diag: mkDiag('offline', r.status || 0, null, ['fmt paymentId : ' + fmt(paymentId)]) };
        var nd = null, ndm = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(r.t);
        if (ndm) { try { nd = parseBig(ndm[1]); } catch (e) { nd = null; } }
        var slip = null;
        if (nd) { try { var root = (nd && nd.props) || nd; var cand = findTrade(root, 0); slip = cand ? slipOf(cand) : null; } catch (e) {} }
        if (slip && (slip.approvalNo || slip.amount || slip.businessNo)) return { key: job.key, st: 'ok', slip: slip, diag: diagLeft > 0 ? (diagLeft--, { w: 'offlineok', status: r.status || 200, lines: walk(nd).slice(0, 200) }) : undefined };
        // 아직 못 읽음 — 구조만 기록해 A32 셀프테스트에서 칸 위치를 본 뒤 맞춘다
        return { key: job.key, st: 'nopair', status: r.status, diag: mkDiag('offline', r.status || 200, null, ['nextdata ' + (nd ? 'yes' : 'no'), 'html ' + Math.round((r.t || '').length / 1024) + 'KB']) };
      });
    }
    function single(pair) {
      // 원문 밖 재시도 없음(대표님 10-29 13:46) — 받은 상품 번호 그대로 한 번만 부른다
      var pos = [pair.po];
      function queryOf(po) {
        if (pair.payId && pair.tid && po) return 'payId=' + pair.payId + '&tid=' + pair.tid + '&productOrderNo=' + encodeURIComponent(po) + '&isFromPayCenter=false';
        if (pair.paymentId && pair.tid) return 'svcInfType=PD&paymentId=' + pair.paymentId + '&tid=' + pair.tid + '&isFromPayCenter=false';
        return null;
      }
      function attempt(i) {
        var po = pos[i];
        var q = queryOf(po);
        // ⑤ tid 로 card-single 을 못 만들면, 결제번호가 있으면 현장결제 영수증(receipts/offline)으로
        if (!q) return pair.paymentId ? offlineReceipt(pair.paymentId) : Promise.resolve({ key: job.key, st: 'nopair', diag: mkDiag('pair', 0, null, ['have payId ' + !!pair.payId + ' tid ' + !!pair.tid + ' po ' + !!pair.po + ' paymentId ' + !!pair.paymentId]) });
        var ref = pair.ref ? pair.ref : pair.payId && po
          ? 'https://pay.naver.com/receipts/preview/card?tid=' + pair.tid + '&productOrderNo=' + encodeURIComponent(po) + '&exitType=back&payId=' + pair.payId
          : 'https://pay.naver.com/receipts/preview/card?svcInfType=PD&paymentId=' + pair.paymentId + '&tid=' + pair.tid;
        return getJson('/web-api/receipts/card-single?' + q, ref).then(function (r) {
          if (r.st === 'ok') {
            var slip = slipOf(r.j);
            if (!slip) return { key: job.key, st: 'shape', status: r.status, diag: mkDiag('card', r.status, r.j) };
            // 실제 응답의 칸 이름 목록(값 없음) — 한 번 실행에 한 번. 대표님 22:30 캡처의 화면 항목과 짝지어 확인한다
            var okDiag;
            if (!cardSeen) { cardSeen = true; okDiag = { w: 'cardok', status: r.status || 200, lines: walk(r.j).slice(0, 300) }; }
            // 취소처럼 보이는 영수증 — 어느 규칙(취소 일시 칸 · 취소 금액)에 걸렸는지만(값 없음) 남긴다(10-29 15:36 「영수증 없음 5」)
            if (!okDiag && (slip.cancelAt || (slip.cancelAmount || 0) > 0)) okDiag = mkDiag('cancel', r.status || 200, null, ['cancelAt ' + fmt(slip.cancelAt), 'cancelAmount>0 ' + ((slip.cancelAmount || 0) > 0), 'cancel>=approval ' + ((slip.cancelAmount || 0) >= (slip.amount || 0))]);
            return okDiag ? { key: job.key, st: 'ok', slip: slip, diag: okDiag } : { key: job.key, st: 'ok', slip: slip };
          }
          if (r.st !== 'net' && r.st !== 'shape') return { key: job.key, st: r.st, status: r.status };
          var sent = ['sent ' + (pair.payId && po ? 'payId,tid,productOrderNo' : 'svcInfType,paymentId,tid'), 'tries ' + (i + 1)];
          if (pair.payId && po) { sent.push('fmt payId : ' + fmt(pair.payId)); sent.push('fmt productOrderNo : ' + fmt(po)); } else sent.push('fmt paymentId : ' + fmt(pair.paymentId));
          sent.push('fmt tid : ' + fmt(pair.tid));
          return { key: job.key, st: r.st, status: r.status, diag: mkDiag('card', r.status, null, sent) };
        });
      }
      return attempt(0);
    }
    if (job.pinfo) return pinfoJob(job);
    if (job.osheet) return osheetJob(job);
    if (job.tid && (job.payId || job.paymentId)) return single({ po: job.productOrderNo, tid: job.tid, payId: job.payId, paymentId: job.paymentId });
    /* 대표님 10-28 22:28 원문: pay.naver.com/receipts/issue-history?orderNo=<주문번호 16자리> — 화면을 열지 않고 같은 출처 요청으로 그 화면(HTML)을 받아 __NEXT_DATA__ 에서 짝을 읽는다.
       (10-29 13:35 실행: 원문에 없던 /web-api/receipts/{주문번호} 는 404 였다 — 그 주소는 뺐다) */
    return request('/receipts/issue-history?orderNo=' + encodeURIComponent(job.orderNo), null, true).then(function (r) {
      // ⑤ 쇼핑 주문이 아니면(현장결제 등) issue-history 가 비거나 404 — 결제번호가 있으면 receipts/offline 로
      if (r.st !== 'ok') return ((r.st === 'net' || r.st === 'shape') && job.paymentId) ? offlineReceipt(job.paymentId) : { key: job.key, st: r.st, status: r.status, diag: r.st === 'net' || r.st === 'shape' ? mkDiag('issue', r.status, null, ['fmt orderNo : ' + fmt(job.orderNo)]) : undefined };
      var links = cardLinks(r.t);
      if (links.length === 0) {
        // 11-02 대표님 확인: 링크가 없어도 __NEXT_DATA__ 의 orderReceipt 에 tid · 상품 주문번호 · payNo/firstOriginalPayNo(payId 자리)가 이름 그대로 있다
        var nd = null, ndm = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(r.t);
        if (ndm) { try { nd = parseBig(ndm[1]); } catch (e) { nd = null; } }
        var orc = nd ? firstObjByName(nd, 'orderReceipt') : null;
        if (orc) {
          var t2 = firstByName(orc, 'tid', function (v) { return !!digs(v, 18, 22); });
          var po2 = firstByName(orc, 'productOrderNo', function (v) { return /^(PD)?\d{8,24}$/.test(String(v)); });
          var pid3 = firstByName(orc, 'payNo', function (v) { return !!digs(v, 18, 22); }) || firstByName(orc, 'firstOriginalPayNo', function (v) { return !!digs(v, 18, 22); });
          if (t2 && po2 && pid3) return single({ po: String(po2), tid: t2, payId: pid3 });
        }
        // ⑤ 결제번호(현장결제)가 있으면 receipts/offline 로
        if (job.paymentId) return offlineReceipt(job.paymentId);
        // 카드영수증이 원래 없는 결제 — 실패가 아니라 「영수증 없음」(대표님 11-02 ④). 구조만 남긴다
        var noneDiag = ['anchor 0', 'html ' + Math.round(r.t.length / 1024) + 'KB', 'nextdata ' + (nd ? 'yes' : 'no'), 'orderReceipt ' + (orc ? 'yes' : 'no')];
        // 11-02 대표님 확인: 같은 화면의 현금영수증(/receipts/integrated/cash?pkgSeq=&payId=) · 구매 영수증(/receipts/purchase?orderNo=) — 로그인된 같은 출처 GET 만, 쿠키는 다루지 않는다. 이번 판은 구조(값 가림)만 남긴다
        var cm = /\/receipts\/integrated\/cash\?[^"'<>\s]+/.exec(r.t);
        var nextPath = cm ? cm[0].replace(/&amp;/g, '&') : '/receipts/purchase?orderNo=' + encodeURIComponent(job.orderNo);
        var w2 = cm ? 'cash' : 'purchase';
        return request(nextPath, null, true).then(function (r2) {
          var nd2 = null, m2 = r2.st === 'ok' ? /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(r2.t) : null;
          if (m2) { try { nd2 = parseBig(m2[1]); } catch (e) { nd2 = null; } }
          // 현금영수증이면 영수증으로 읽어 올린다(11-02 대표님 「현금영수증은 거르면 안 돼 가져와야지」) — 못 읽으면 예전처럼 「영수증 없음」 + 구조만
          var cs = null;
          if (w2 === 'cash' && nd2) { try { cs = cashSlipOf((nd2.props && nd2.props.pageProps) || nd2); } catch (e) { cs = null; } }
          if (cs) return { key: job.key, st: 'ok', slip: cs, diag: diagLeft > 0 ? (diagLeft--, { w: 'cashok', status: r2.status || 200, lines: walk(nd2).slice(0, 200) }) : undefined };
          return { key: job.key, st: 'none', status: r.status, diag: mkDiag(w2, r2.status, (nd2 && nd2.props && nd2.props.pageProps && (nd2.props.pageProps.dehydratedState || nd2.props.pageProps)) || null, noneDiag.concat([w2 + ' ' + r2.st, w2 + ' nextdata ' + (nd2 ? 'yes' : 'no'), w2 + ' dehydrated ' + (nd2 && nd2.props && nd2.props.pageProps && nd2.props.pageProps.dehydratedState ? 'yes' : 'no')])) };
        });
      }
      var pick = links[0];
      return single({ po: pick.productOrderNo, tid: pick.tid, payId: pick.payId, ref: pick.ref, anchors: links.length });
    });
  }
  /* 이 페이지(pay.naver.com/history)의 __NEXT_DATA__ 에서 대표님 23:20 원문 이름 paymentId · tid 로만 짝을 찾는다(같은 객체 안에 둘 다 있을 때만) */
  function scanNext(extra) {
    var out = { has: false, cut: false, pairs: [], hits: [], tree: [], rows: [], rowMiss: 0, itemKeys: [], miss: [], page: 0, pages: 0, instant: 0, instantPair: 0, instKeys: [] };
    /* 주소 모양 — 호스트 · 경로(숫자는 n자리), 쿼리는 키 이름만(값 없음) */
    function ushape(u) {
      if (typeof u !== 'string') return typeof u;
      var m2 = /^(https?:\/\/[^/?#]+)?([^?#]*)(\?[^#]*)?/.exec(u) || [];
      var keys = (m2[3] || '').slice(1).split('&').map(function (kv) { return kv.split('=')[0]; }).filter(Boolean).slice(0, 8).join(',');
      return ((m2[1] || '') + (m2[2] || '')).replace(/\d+/g, function (d) { return 'n' + d.length; }).slice(0, 80) + (keys ? '?' + keys : '');
    }
    /* buttons[] 의 글자 칸 중 영수증 주소(/receipts/preview/card?) — 쿼리 이름 그대로(tid · payId · productOrderNo · paymentId) */
    function buttonPair(btns) {
      for (var bi = 0; Array.isArray(btns) && bi < btns.length && bi < 10; bi++) {
        var b = btns[bi];
        if (!b || typeof b !== 'object') continue;
        for (var bk in b) {
          var v = b[bk];
          if (typeof v !== 'string' || v.indexOf('/receipts/preview/card?') < 0) continue;
          var q = {}, parts = v.slice(v.indexOf('?') + 1).replace(/&amp;/g, '&').split('&');
          for (var pi2 = 0; pi2 < parts.length; pi2++) { var kv = parts[pi2].split('='); if (kv.length >= 2) { try { q[kv[0]] = decodeURIComponent(kv.slice(1).join('=')); } catch (e) { q[kv[0]] = kv.slice(1).join('='); } } }
          var tid = digs(q.tid, 18, 22), payId = digs(q.payId, 18, 22), paymentId = typeof q.paymentId === 'string' && PAYID.test(q.paymentId) ? q.paymentId : undefined;
          var po = typeof q.productOrderNo === 'string' && /^(PD)?\d{8,24}$/.test(q.productOrderNo) ? q.productOrderNo : undefined;
          if (tid && ((payId && po) || paymentId)) return { tid: tid, payId: payId, po: po, paymentId: paymentId };
        }
      }
      return null;
    }
    /* 주문번호를 못 찾은 줄의 모양(12줄까지, 값 없음 — serviceType 은 종류 이름이라 그대로) */
    function missDiag(it) {
      if (out.miss.length >= 12) return;
      var ad = it.additionalData || {}, adk = [];
      for (var k3 in ad) adk.push(sk(k3));
      var b0 = Array.isArray(it.buttons) && it.buttons[0] && typeof it.buttons[0] === 'object' ? it.buttons[0] : null, bk2 = [], bu = '';
      if (b0) for (var k4 in b0) { bk2.push(sk(k4)); if (!bu && typeof b0[k4] === 'string' && /[/?]/.test(b0[k4])) bu = sk(k4) + '=' + ushape(b0[k4]); }
      var st = typeof it.serviceType === 'string' ? it.serviceType.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) : typeof it.serviceType;
      out.miss.push(('miss st=' + st + ' od=' + ushape(it.orderDetailUrl) + ' pd=' + ushape(it.productDetailUrl) + ' btn' + (Array.isArray(it.buttons) ? it.buttons.length : 0) + '=' + bk2.slice(0, 8).join(',') + (bu ? ' ' + bu : '') + ' ad=' + adk.slice(0, 20).join(',')).slice(0, 198));
    }
    try {
      var el = typeof document !== 'undefined' ? document.getElementById('__NEXT_DATA__') : null;
      var txt = el ? el.textContent : '';
      if (!txt || txt.length > 3000000) return out;
      out.has = true;
      var raw0 = parseBig(txt);
      var root = (raw0 && raw0.props) || raw0;
      // v2: _next/data 로 받은 뒤쪽들(extra, 이미 파싱된 root)도 같은 구조로 함께 읽는다 — 더보기/스크롤이 SPA 라 다음 쪽을 안 부르던 문제 대체(대표님 10-30)
      var roots = [root];
      if (extra && extra.length) for (var ei = 0; ei < extra.length; ei++) { var er = extra[ei]; if (er) roots.push((er && er.props) || er); }
      // 대표님 14:31 ③: paymentId · tid 이름이 이 화면 데이터의 어디에 있는지 — 키 이름 트리만(값 없음) 남긴다(첫 쪽만)
      try { out.tree = keyTree(root, 12, 270); } catch (e) { out.tree = []; }
      // 대표님 15:36 ⓑ: 내역 줄 pageProps.dehydratedState.queries[].state.data.pages[].items[] — additionalData.orderNo · payId · productOrderNo · date · additionalData.orderAmount(이름 그대로)
      try {
        for (var ri = 0; ri < roots.length; ri++) {
        var R = roots[ri];
        var qs = (R && R.pageProps && R.pageProps.dehydratedState && R.pageProps.dehydratedState.queries) || [];
        for (var qi = 0; Array.isArray(qs) && qi < qs.length && qi < 30; qi++) {
          var pages = qs[qi] && qs[qi].state && qs[qi].state.data && qs[qi].state.data.pages;
          for (var pi = 0; Array.isArray(pages) && pi < pages.length && pi < 30; pi++) {
            var its = pages[pi] && pages[pi].items;
            // 줄 수 상한 없음 — 전에는 앞 200줄만 읽어 그 뒤 쪽(10-31 실기록 774줄 중 574줄)을 아예 보지 않았다(혼자 만든 상한, 대표님 10-30 「혼자 만든 제한 금지」)
            for (var ii = 0; Array.isArray(its) && ii < its.length; ii++) {
              var it = its[ii] || {}, ad = it.additionalData || {};
              // 첫 줄의 키 이름 전체(값 없음) — 잘리지 않게 따로 남긴다(슬랙대표님요청 16:0x)
              if (out.itemKeys.length === 0) { for (var k1 in it) { out.itemKeys.push('item ' + sk(k1)); if (it[k1] && typeof it[k1] === 'object' && !Array.isArray(it[k1])) for (var k2 in it[k1]) out.itemKeys.push('item ' + sk(k1) + '.' + sk(k2)); } }
              // 주문번호: additionalData.orderNo, 없으면 orderDetailUrl 이 /order/status/<16자리> 모양일 때 그 번호(14:22 원문 Referer 모양)
              var ono = typeof ad.orderNo === 'string' && /^\d{16}$/.test(ad.orderNo) ? ad.orderNo : undefined;
              if (!ono && typeof it.orderDetailUrl === 'string') { var um = /\/order\/status\/(\d{16})(?:[?#/]|$)/.exec(it.orderDetailUrl); if (um) ono = um[1]; }
              // v2: 주소 쿼리의 orderNo=<16자리>(원문 이름)도 본다
              if (!ono && a.v2 && typeof it.orderDetailUrl === 'string') { var uq = /[?&]orderNo=(\d{16})(?:&|#|$)/.exec(it.orderDetailUrl); if (uq) ono = uq[1]; }
              var bp = !ono && a.v2 ? buttonPair(it.buttons) : null;
              // 간편결제(SIMPLE_PAYMENT): orderDetailUrl 이 orders.pay.naver.com/instantPay/detail/<결제번호> 모양이면 그 경로 그대로(16:36 실기록)
              var inst = null;
              if (!ono && !bp && a.v2 && typeof it.orderDetailUrl === 'string') {
                var im = /^https:\/\/orders\.pay\.naver\.com(\/instantPay\/detail\/(\d{8}NP\d{6,14})(\?[A-Za-z0-9=&%._~:\/+-]{0,400})?)$/.exec(it.orderDetailUrl);
                if (im) inst = { path: im[1], pid: im[2] };
              }
              if (!ono && !bp && !inst) { out.rowMiss++; if (a.v2) missDiag(it); continue; }
              var row = ono ? { orderNo: ono } : {};
              if (inst) {
                var itid = firstByName(it, 'tid', function (v) { return !!digs(v, 18, 22); });
                var ipid = firstByName(it, 'paymentId', function (v) { return typeof v === 'string' && PAYID.test(v); });
                if (itid) { row.tid = itid; row.paymentId = ipid || inst.pid; out.instantPair++; }
                else { row.instant = inst.path; row.paymentId = inst.pid; out.instant++; }
                // 첫 간편결제 항목의 키 이름 전체(값 없음, additionalData 하위 포함)
                if (out.instKeys.length === 0) { try { out.instKeys = keyTree(it, 4, 90).map(function (l) { return 'inst' + l.slice(4); }); } catch (e) {} }
              }
              if (bp) { row.tid = bp.tid; if (bp.payId) row.payId = bp.payId; if (bp.po) row.productOrderNo = bp.po; if (bp.paymentId) row.paymentId = bp.paymentId; }
              // 시각 · 금액(date · additionalData.orderAmount)은 있을 때만 — 없으면 서버 목록 줄 잇기만 건너뛴다
              if (typeof it.date === 'number' && isFinite(it.date)) row.at = it.date;
              if (typeof ad.orderAmount === 'number' && ad.orderAmount >= 1 && ad.orderAmount <= 1e9) row.amount = Math.floor(ad.orderAmount);
              // v2: 금액이 없으면 product.price(실기록 키)
              else if (a.v2 && it.product && typeof it.product.price === 'number' && it.product.price >= 1 && it.product.price <= 1e9) row.amount = Math.floor(it.product.price);
              var pid2 = digs(ad.payId, 18, 22); if (pid2 && !row.payId) row.payId = pid2;
              if ((typeof ad.productOrderNo === 'string' || typeof ad.productOrderNo === 'number') && /^\d{8,24}$/.test(String(ad.productOrderNo))) row.productOrderNo = String(ad.productOrderNo);
              // 취소 · 반품 줄(status.name · status.text 이름 그대로) — 영수증을 받지 않고 「취소된 주문」
              if (it.status && (/CANCEL|RETURN|REFUND/i.test(String(it.status.name || '')) || /취소|반품|환불/.test(String(it.status.text || '')))) row.cancelled = true;
              out.rows.push(row);
            }
          }
        }
        }
        // v2: 이 화면의 쪽 번호 — pages[] 마지막 칸의 curPage · totalPage(이름 그대로). 여러 root 면 가장 큰 쪽 수
        if (a.v2) for (var rk = 0; rk < roots.length; rk++) {
          var RK = roots[rk];
          var qk = (RK && RK.pageProps && RK.pageProps.dehydratedState && RK.pageProps.dehydratedState.queries) || [];
          for (var qj = 0; Array.isArray(qk) && qj < qk.length; qj++) {
            var pg = qk[qj] && qk[qj].state && qk[qj].state.data && qk[qj].state.data.pages;
            var last = Array.isArray(pg) && pg.length ? pg[pg.length - 1] : null;
            if (last && typeof last.curPage === 'number' && typeof last.totalPage === 'number') { if (last.curPage > out.page) out.page = last.curPage; if (last.totalPage > out.pages) out.pages = last.totalPage; break; }
          }
        }
      } catch (e) { out.rows = []; }
      var nodes = 0, seenHit = {};
      var hit = function (path, k, v) { var s = 'hit ' + path + (path ? '.' : '') + sk(k) + ' : ' + fmt(v); if (!seenHit[s] && out.hits.length < 14) { seenHit[s] = 1; out.hits.push(s); } };
      function rec(o, path, d) {
        if (!o || typeof o !== 'object') return;
        if (d > 14 || nodes++ > 30000) { out.cut = true; return; }
        if (Array.isArray(o)) { if (o.length > 300) out.cut = true; for (var i = 0; i < o.length && i < 300; i++) rec(o[i], path + '[' + (i < 1 ? '0' : 'n') + ']', d + 1); return; }
        var pid, tid;
        for (var k in o) {
          var v = o[k];
          // 대표님 23:20 원문 이름 paymentId · tid 로만 찾는다(값 모양으로 짝 찾기 없음, 10-29 13:5x)
          if (k === 'paymentId' && typeof v === 'string' && PAYID.test(v)) { if (!pid) pid = v; hit(path, k, v); }
          else if (k === 'tid' && digs(v, 18, 22)) { if (!tid) tid = String(v); hit(path, k, v); }
          else if (v && typeof v === 'object') rec(v, path ? path + '.' + sk(k) : sk(k), d + 1);
        }
        if (tid && pid) out.pairs.push({ paymentId: pid, tid: tid });
      }
      for (var rp = 0; rp < roots.length; rp++) rec(roots[rp], '', 0);
    } catch (e) {}
    // v2: 스크롤로 쌓인 내역 DOM 의 간편결제 상세 링크(확정 모양 /instantPay/detail/<결제번호>)에서 결제번호를 더 모은다 — __NEXT_DATA__ 1쪽에 없던 줄(화면에 실제로 있는 값만 = 원문). tid 는 상세를 열어야 나오므로 여기선 결제번호(instant 경로)만
    if (a.v2) try {
      var seenInst = {};
      for (var si = 0; si < out.rows.length; si++) { var ex = out.rows[si].instant; if (ex) { var em = /\/instantPay\/detail\/(\d{8}NP\d{6,20})/.exec(ex); if (em) seenInst[em[1]] = 1; } }
      var da = document.querySelectorAll ? document.querySelectorAll('a[href*="/instantPay/detail/"], [data-url*="/instantPay/detail/"], [onclick*="/instantPay/detail/"]') : [];
      for (var di = 0; di < da.length; di++) {
        var hv = (da[di].getAttribute && (da[di].getAttribute('href') || da[di].getAttribute('data-url') || da[di].getAttribute('onclick'))) || '';
        var dm = /\/instantPay\/detail\/(\d{8}NP\d{6,20})/.exec(hv);
        if (dm && ! seenInst[dm[1]]) { seenInst[dm[1]] = 1; out.rows.push({ instant: '/instantPay/detail/' + dm[1], paymentId: dm[1] }); out.instant++; out.domInst = (out.domInst || 0) + 1; }
      }
    } catch (e) {}
    return out;
  }
  var work = a.jobs.slice();
  var scanInfo = null;
  var npQueued = 0;
  var scrollLog = [];
  /* 내역 페이지에서 __NEXT_DATA__(buildId) 를 실제로 읽었나 — 못 읽은 셸(5KB)이면 흐름이 리로드해 다시 스캔한다(대표님 10-30). 완료(full)로 치지 않는다 */
  var ndBuildOk = false;
  /* v2: 내역을 _next/data 로 전부 받는다(11-02 대표님 확인 길). buildId 는 1쪽 __NEXT_DATA__. 경로는 리다이렉트를 따라 정한다:
     PC 크롬은 /history → /pc/history 307(데이터 요청은 200 JSON 의 pageProps.__N_REDIRECT 로 온다 — 11-02 실측) — _next/data/<buildId>/<그 경로>.json?page=N.
     page=1 부터 totalPage 까지(모르면 빈 items 가 나올 때까지, 안전 backstop 60). 쪽 사이 300~500ms.
     buildId 가 낡으면(404 · HTML) 1쪽을 다시 읽어 갱신하고 그 쪽만 한 번 재시도(그 밖은 멈춘다 — 무한 재시도 금지). 받은 쪽(root)들을 doneCb 로 넘기면 scanNext 가 함께 읽는다. */
  function fetchPages(doneCb) {
    if (! a.v2 || typeof fetch !== 'function' || typeof document === 'undefined') return doneCb([]);
    /* 데이터 경로 — 지금 페이지 경로(/pc/history · /history)가 맞으면 그것, 아니면 __N_REDIRECT, 끝으로 /history */
    function domPath(root) {
      try {
        var p = typeof location !== 'undefined' ? String(location.pathname || '') : '';
        if (/^\/(pc\/)?history/.test(p)) return p.replace(/\/$/, '');
        var red = root && root.pageProps && root.pageProps.__N_REDIRECT;
        if (typeof red === 'string' && red) { var u = new URL(red, 'https://pay.naver.com'); if (/^\/(pc\/)?history/.test(u.pathname)) return u.pathname.replace(/\/$/, ''); }
      } catch (e) {}
      return '';
    }
    function readDom() {
      var o = { bid: '', total: 0, dpath: '' };
      try {
        var el = document.getElementById('__NEXT_DATA__');
        if (el && el.textContent) {
          var r = parseBig(el.textContent);
          if (r && typeof r.buildId === 'string') o.bid = r.buildId;
          var root = (r && r.props) || r;
          o.dpath = domPath(root);
          var qs = (root && root.pageProps && root.pageProps.dehydratedState && root.pageProps.dehydratedState.queries) || [];
          for (var qi = 0; qi < qs.length; qi++) {
            var pg = qs[qi] && qs[qi].state && qs[qi].state.data && qs[qi].state.data.pages;
            var last = Array.isArray(pg) && pg.length ? pg[pg.length - 1] : null;
            if (last && typeof last.totalPage === 'number') { o.total = last.totalPage; break; }
          }
        }
      } catch (e) {}
      return o;
    }
    function itemsCount(j) {
      var n = 0;
      try {
        var root = (j && j.props) || j;
        var qs = (root && root.pageProps && root.pageProps.dehydratedState && root.pageProps.dehydratedState.queries) || [];
        for (var qi = 0; qi < qs.length; qi++) { var pages = qs[qi] && qs[qi].state && qs[qi].state.data && qs[qi].state.data.pages; for (var pi = 0; Array.isArray(pages) && pi < pages.length; pi++) { var its = pages[pi] && pages[pi].items; if (Array.isArray(its)) n += its.length; } }
      } catch (e) {}
      return n;
    }
    function refUrl() {
      try { var h = String(location.href || ''); if (/^https:\/\/pay\.naver\.com\//.test(h)) return h; } catch (e) {}
      return 'https://pay.naver.com/pc/history';
    }
    function fetchPage(bid, dpath, page, followed) {
      var url = 'https://pay.naver.com/_next/data/' + encodeURIComponent(bid) + dpath + '.json?page=' + page;
      return fetch(url, { credentials: 'include', headers: { 'x-nextjs-data': '1', accept: 'application/json, text/plain, */*' }, referrer: refUrl(), referrerPolicy: 'unsafe-url' }).then(function (res) {
        var s = res.status;
        if (s === 401) return { st: 'login' };
        if (s === 403 || s === 429) return { st: 'blocked' };
        if (s === 404) return { st: 'stale' };
        if (! res.ok) return { st: 'net', status: s };
        return res.text().then(function (t) {
          var str = String(t || '').replace(/^﻿/, '').replace(/^\s+/, '');
          if (str.charAt(0) !== '{') return { st: 'stale' };   // buildId 가 바뀌면 JSON 이 아니라 404 HTML 이 온다
          try {
            var j = parseBig(str);
            // 데이터 요청의 리다이렉트는 307 이 아니라 200 JSON 안의 pageProps.__N_REDIRECT 로 온다 — 한 번 따라간다(11-02 실측)
            var red = j && j.pageProps && j.pageProps.__N_REDIRECT;
            if (!followed && typeof red === 'string' && red) {
              var np = '';
              try { np = new URL(red, 'https://pay.naver.com').pathname.replace(/\/$/, ''); } catch (e) {}
              if (np && np !== dpath) return fetchPage(bid, np, page, true);
            }
            return { st: 'ok', j: j, dpath: dpath };
          } catch (e) { return { st: 'stale' }; }
        }, function () { return { st: 'net' }; });
      }, function () { return { st: 'net' }; });
    }
    function refreshBuildId() {
      return fetch('https://pay.naver.com/history?page=1', { credentials: 'include' }).then(function (res) { return res.text(); }).then(function (html) {
        var m = /"buildId"\s*:\s*"([^"]{1,80})"/.exec(String(html || ''));
        return m ? m[1] : '';
      }, function () { return ''; });
    }
    var roots = [];
    var waits = 0;
    // 막 띄운 숨은 웹뷰는 __NEXT_DATA__(buildId) 가 아직 없는 셸일 수 있다(대표님 10-30 「textLen 5052」, 0쪽). buildId 와 내역 쪽 수(totalPage)가 보일 때까지 0.5초씩 잠깐 기다렸다 읽는다(최대 ~5초). 끝까지 셸이면 0 으로 돌려주고(ndBuildOk false → full 아님) 흐름이 pay 페이지를 리로드해 다시 스캔한다
    function begin() {
      var dom = readDom();
      if (! dom.bid || (dom.total <= 0 && waits < 10)) {
        if (! aborted && waits < 10) { waits++; if (scrollLog.length < 60) scrollLog.push('nd wait ' + waits); setTimeout(begin, 500); return; }
        if (! dom.bid) { scrollLog.push('nd nobuildid'); return doneCb(roots); }
      }
      ndBuildOk = true;
      var bid = dom.bid;
      var dpath = dom.dpath || '/history';
      // totalPage 를 알면 그 쪽까지 전부(대표님 11-02 「최근 1년치 끝까지」 · 10-30 「totalPage 까지」, 인위적 상한 없음). 모를 때만 빈 items 가 나올 때까지 도는데, 쪽 수를 아예 못 읽는 경우의 안전 backstop 으로만 60(기존 흐름 MAX_SCAN_PAGES 와 같은 값) — 쪽 수를 알면 쓰지 않는다
      var total = dom.total > 0 ? dom.total : 60;
      scrollLog.push('nd start total' + total + (dom.total > 0 ? '' : '?') + ' ' + dpath + (waits ? ' wait' + waits : ''));
      var retried = false;
      function step(page) {
        if (aborted || page > total) { scrollLog.push('nd end p' + (page - 1)); return doneCb(roots); }
        fetchPage(bid, dpath, page).then(function (r) {
          if (r.st === 'ok') {
            if (r.dpath && r.dpath !== dpath) dpath = r.dpath;   // 따라간 리다이렉트 경로를 이어 쓴다
            var n = itemsCount(r.j);
            roots.push(r.j);
            if (scrollLog.length < 60) scrollLog.push('nd p' + page + ' items ' + n);
            if (n === 0 && page > 1) return doneCb(roots);   // 빈 items → 끝(1쪽은 리다이렉트로 비어 보일 수 있어 2쪽까지는 읽는다)
            setTimeout(function () { step(page + 1); }, 300 + Math.floor(Math.random() * 200));   // 쪽 사이 300~500ms
          } else if (r.st === 'stale' && ! retried) {
            retried = true;
            if (scrollLog.length < 60) scrollLog.push('nd p' + page + ' stale refresh');
            refreshBuildId().then(function (nb) { if (nb) { bid = nb; setTimeout(function () { step(page); }, 400); } else { scrollLog.push('nd refreshfail'); doneCb(roots); } });
          } else {
            if (scrollLog.length < 60) scrollLog.push('nd p' + page + ' ' + r.st + (r.status ? (' ' + r.status) : '') + ' stop');
            doneCb(roots);   // 그 밖 오류 · 재시도 소진 → 멈춘다(무한 재시도 금지, 대표님 10-30 서버 재시도 사고)
          }
        });
      }
      step(1);   // 1쪽부터 _next/data 로 — 흐름이 리로드 때 쪽 번호를 바꿔 들어와도(page=2·3) 1쪽을 빠뜨리지 않는다. DOM 1쪽은 scanNext 가 함께 읽어 중복은 걸러진다
    }
    begin();
  }
  function queueScan(extra) {
    scanInfo = scanNext(extra);
    var skip = {}, seen = {};
    for (var s = 0; a.skip && s < a.skip.length; s++) skip[a.skip[s]] = 1;
    for (var p = 0; p < scanInfo.pairs.length && npQueued < 200; p++) {
      var pr = scanInfo.pairs[p], id = pr.paymentId || pr.tid;
      if (skip[id] || skip[pr.tid] || seen[pr.tid]) continue;
      seen[pr.tid] = 1;
      npQueued++;
      work.push({ key: 'np:' + id, orderNo: id, paymentId: pr.paymentId, payId: pr.payId, productOrderNo: pr.po, tid: pr.tid });
    }
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
    for (var i = 0; i < work.length; i++) out.push(results[i] || { key: work[i].key, st: 'net' });
    if (scanInfo) out.push({ key: 'np:scan', st: 'none', found: npQueued, rows: scanInfo.rows, page: scanInfo.page, pages: scanInfo.pages, full: a.v2 === true && ndBuildOk && scanInfo.rows.length > 0, diag: { w: 'npscan', status: 200, lines: ['has ' + scanInfo.has, 'cut ' + scanInfo.cut, 'pairs ' + scanInfo.pairs.length, 'queued ' + npQueued, 'rows ' + scanInfo.rows.length + ' miss ' + scanInfo.rowMiss + (a.v2 ? ' page ' + scanInfo.page + '/' + scanInfo.pages + ' instant ' + scanInfo.instant + ' instantPair ' + scanInfo.instantPair + ' dom ' + (scanInfo.domInst || 0) : '')].concat(scrollLog).concat(scanInfo.miss).concat(scanInfo.instKeys).concat(scanInfo.itemKeys.slice(0, 100)).concat(scanInfo.hits).concat(scanInfo.tree).slice(0, 300) } });
    post({ type: 'nav', step: 'receipts', results: out });
  }
  function start(i) {
    var p;
    try { p = runJob(work[i]); } catch (e) { p = Promise.resolve({ key: work[i].key, st: 'net' }); }
    p.then(function (r) { return r; }, function () { return { key: work[i].key, st: 'net' }; }).then(function (r) {
      results[i] = r;
      inflight--;
      finished++;
      if (finished === work.length) done(); else pump();
    });
  }
  /* 동시에 a.conc 건까지 — 처음 a.conc 건은 staggerMs 간격으로, 그 뒤는 자리가 나는 대로 gapMs 쉬고 시작한다(막히면 흐름이 conc 1 · gapMs 로 늦춘다) */
  function pump() {
    if (aborted) return;
    while (inflight < a.conc && next < work.length) {
      var i = next++;
      inflight++;
      (function (i) { setTimeout(function () { if (!aborted) start(i); }, i < a.conc ? a.staggerMs * i : a.gapMs); })(i);
    }
  }
  // 영수증은 pay.naver.com 에서, 간편결제 짝 얻기(pinfo)는 orders.pay.naver.com 에서만(같은 출처 요청 — pay 출처는 CORS 거절, 11-02 실측)
  var pinfoRun = work.length > 0 && (work[0].pinfo === true || work[0].osheet === true);
  if (location.host !== (pinfoRun ? 'orders.pay.naver.com' : 'pay.naver.com')) { for (var z = 0; z < work.length; z++) results[z] = { key: work[z].key, st: 'net' }; done(); return; }
  if (a.scan === true) {
    var afterScan = function (extra) { queueScan(extra); if (work.length === 0) { done(); return; } setTimeout(done, a.deadlineMs); pump(); };
    if (a.v2) fetchPages(afterScan); else afterScan([]);
  }
  else { if (work.length === 0) { done(); return; } setTimeout(done, a.deadlineMs); pump(); }
})(${JSON.stringify(r)});true;`;
}
