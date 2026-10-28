"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showProbeButton = void 0;
exports.shapeName = shapeName;
exports.shapePath = shapePath;
exports.buildPayload = buildPayload;
exports.probeCollectScript = probeCollectScript;
exports.probeObserveScript = probeObserveScript;
/**
 * 구조 기록(대표님 계정 전용) — 로그인 창에 열린 사이트의 **모양만** 모아 서버에 보낸다(서버 계약 POST receipt-link/probe).
 * 글자 · 입력값 · 쿠키 값 · 토큰은 읽지도 보내지도 않는다. 아래 스크립트 문자열에는 innerText · textContent · 입력값 · 인증 헤더 접근이 없다.
 * 모양 함수는 순수 함수라 노드 시험(probe.test.ts)이 바로 읽는다.
 */
/** 서버가 받는 문자 밖은 지운다: 영문 · 숫자 · 허용 기호 · 공백 · 한글 「가」(한글은 전부 「가」로 바꾼 뒤) */
const DISALLOWED = /[^A-Za-z0-9 _\-:./\[\]=#,*()>+~|@'"가]/g;
const EMAIL = /[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/;
const LIMIT = { outline: 300, repeat: 20, keys: 30, cookies: 50, requests: 40, text: 200 };
/** 이름 한 덩이 — 한글은 전부 「가」, 24자 이상 긴 영숫자는 앞 8자 + `~`, 숫자 7자리 이상 연속은 `:n` */
function shapeName(s) {
    return s
        .replace(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g, '가')
        .replace(/[A-Za-z0-9_-]{24,}/g, (t) => t.slice(0, 8) + '~')
        .replace(/\d{7,}/g, ':n');
}
/**
 * 경로 — 세그먼트마다 숫자만 · UUID · 16자 이상 토큰은 `:n` · `:id` 로 바꾼다.
 * 숫자 줄이기는 서버가 막는 「숫자 7자리 연속」을 피하려고 `9999999` 대신 `:n` 을 쓴다(보고서 참고).
 */
function shapePath(path) {
    return path.split('/').map((seg) => {
        if (!seg)
            return seg;
        if (/^\d+$/.test(seg))
            return ':n';
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg))
            return ':id';
        if (/^[A-Za-z0-9_-]{16,}$/.test(seg))
            return ':id';
        return shapeName(seg);
    }).join('/');
}
/** 허용 문자만 남기고 상한 길이로 자른다. 이메일 모양이나(dropEquals 면) `=` 든 쿠키 문자열은 통째로 버린다 */
function cleanText(v, max = LIMIT.text, dropEquals = false) {
    if (typeof v !== 'string')
        return null;
    if (EMAIL.test(v) || (dropEquals && v.includes('=')))
        return null;
    const t = shapeName(v).replace(DISALLOWED, '').replace(/\s+/g, ' ').trim();
    return t ? t.slice(0, max) : null;
}
const strings = (v, max, dropEquals = false) => {
    if (!Array.isArray(v))
        return [];
    return v.map((x) => cleanText(x, LIMIT.text, dropEquals)).filter((x) => x !== null).slice(0, max);
};
const obj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
/**
 * 웹뷰가 보낸 원본 한 덩이 → 서버 본문. 어떤 모양이 와도 허용 문자 · 상한만 지키고, 틀린 칸은 빈 값으로 둔다.
 * raw 키는 probeCollectScript 가 만든다(host · path · queryKeys · cookieNames · outline · repeat · requests).
 */
function buildPayload(raw, platform = 'naver') {
    const r = obj(raw);
    const repeat = {};
    for (const [k, v] of Object.entries(obj(r.repeat))) {
        const key = cleanText(k);
        if (key && typeof v === 'number' && v >= 3 && Object.keys(repeat).length < LIMIT.repeat)
            repeat[key] = Math.floor(v);
    }
    const requests = (Array.isArray(r.requests) ? r.requests : []).slice(0, LIMIT.requests).map((q) => {
        const x = obj(q);
        const status = typeof x.status === 'number' && Number.isInteger(x.status) ? x.status : 0;
        return {
            method: (cleanText(x.method, 10) ?? 'GET').toUpperCase(),
            host: cleanText(x.host, 80) ?? '',
            path: shapePath(typeof x.path === 'string' ? x.path.slice(0, 300) : ''),
            status,
            response_keys: strings(x.responseKeys, LIMIT.keys),
        };
    });
    return {
        platform,
        page: {
            host: cleanText(r.host, 80) ?? '',
            path: shapePath(typeof r.path === 'string' ? r.path.slice(0, 300) : ''),
            query_keys: strings(r.queryKeys, LIMIT.keys),
        },
        cookie_names: strings(r.cookieNames, LIMIT.cookies, true),
        dom: { outline: strings(r.outline, LIMIT.outline), repeat_counts: repeat },
        requests,
    };
}
/** 구조 기록 단추를 그릴지 — 대표님 계정(probe === true)일 때만. 상태가 없거나 없는 칸이면 false */
const showProbeButton = (s) => s?.probe === true;
exports.showProbeButton = showProbeButton;
/**
 * 구조 기록 스크립트(단추를 누르면 한 번 실행). 글자 · 입력값을 읽지 않고 요소의 모양만 모아 앱에 보낸다.
 * DOM 은 body 아래 깊이 6까지 요소만 본다. 속성은 data- 이름만 — 값은 안 읽는다.
 */
function probeCollectScript() {
    return `(function(){try{
var out=[];var rep={};
function cls(el){return (el.getAttribute('class')||'').split(/\\s+/).filter(Boolean).slice(0,4);}
function tag(el){var s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;var c=cls(el);if(c.length)s+='.'+c.join('.');var at=[];for(var i=0;i<el.attributes.length;i++){var n=el.attributes[i].name;if(n.indexOf('data-')===0&&at.length<4)at.push(n);}if(at.length)s+='['+at.join(',')+']';return s;}
function walk(el,d){if(out.length>=${LIMIT.outline}||d>6)return;var t=tag(el);out.push(t);var ch=el.children||[];var kids={};
for(var i=0;i<ch.length;i++){var k=ch[i].tagName.toLowerCase()+'.'+cls(ch[i]).join('.');kids[k]=(kids[k]||0)+1;}
for(var key in kids){if(kids[key]>=3&&Object.keys(rep).length<${LIMIT.repeat})rep[t+' > '+key]=kids[key];}
for(var j=0;j<ch.length;j++)walk(ch[j],d+1);}
if(document.body)walk(document.body,0);
var qk=[];try{new URLSearchParams(location.search).forEach(function(v,k){if(qk.length<${LIMIT.keys}&&qk.indexOf(k)<0)qk.push(k);});}catch(e){}
var ck=[];try{(document.cookie||'').split(';').forEach(function(c){var n=c.split('=')[0].trim();if(n&&ck.length<${LIMIT.cookies})ck.push(n);});}catch(e){}
var rq=(window.__ytProbe||[]).slice(-${LIMIT.requests});
window.ReactNativeWebView.postMessage(JSON.stringify({type:'probe',raw:{host:location.host,path:location.pathname,queryKeys:qk,cookieNames:ck,outline:out,repeat:rep,requests:rq}}));
}catch(e){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'probe_error'}));}catch(_){}}})(); true;`;
}
/**
 * 관찰 래퍼(로그인 창이 열릴 때 페이지보다 먼저 심는다 — 대표님 계정만). fetch · XHR 을 감싸 호출마다
 * {method, host, path, status, responseKeys} 를 최근 40건 링 버퍼(window.__ytProbe)에 쌓는다. 요청 · 응답 값은 저장하지 않는다.
 * 원래 호출은 그대로 돌려주고, 래퍼 안의 예외는 삼킨다.
 */
function probeObserveScript() {
    return `(function(){try{if(window.__ytProbeOn)return;window.__ytProbeOn=true;window.__ytProbe=[];
function push(e){try{var a=window.__ytProbe;a.push(e);if(a.length>${LIMIT.requests})a.shift();}catch(_){}}
function where(u){try{var x=new URL(String(u),location.href);return{host:x.host,path:x.pathname};}catch(_){return{host:'',path:''};}}
function keys(v,d){var out=[];if(v===null||typeof v!=='object'||d>2)return out;var src=Array.isArray(v)?(v[0]||null):v;if(src===null||typeof src!=='object')return out;
Object.keys(src).forEach(function(k){if(out.length<${LIMIT.keys})out.push(k);});
if(d<2){Object.keys(src).forEach(function(k){keys(src[k],d+1).forEach(function(s){if(out.length<${LIMIT.keys})out.push(k+'.'+s);});});}return out;}
if(window.fetch){var of=window.fetch;window.fetch=function(input,init){var m=(init&&init.method)||(input&&input.method)||'GET';var u=typeof input==='string'?input:(input&&input.url)||'';var p=where(u);
return of.apply(this,arguments).then(function(res){try{var e={method:String(m).toUpperCase(),host:p.host,path:p.path,status:res.status,responseKeys:[]};var ct=(res.headers&&res.headers.get&&res.headers.get('content-type'))||'';
if(ct.indexOf('json')>=0){res.clone().json().then(function(j){e.responseKeys=keys(j,0);push(e);},function(){push(e);});}else push(e);}catch(_){}return res;});};}
if(window.XMLHttpRequest){var X=window.XMLHttpRequest;var op=X.prototype.open;var se=X.prototype.send;
X.prototype.open=function(m,u){this.__ytM=m;this.__ytU=u;return op.apply(this,arguments);};
X.prototype.send=function(){var x=this;x.addEventListener('loadend',function(){try{var p=where(x.__ytU);var e={method:String(x.__ytM||'GET').toUpperCase(),host:p.host,path:p.path,status:x.status,responseKeys:[]};var ct=x.getResponseHeader('content-type')||'';if(ct.indexOf('json')>=0){try{e.responseKeys=keys(JSON.parse(x.responseText),0);}catch(_){}}push(e);}catch(_){}});return se.apply(this,arguments);};}
}catch(e){}})(); true;`;
}
