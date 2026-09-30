/**
 * `@jcurve/identity/server` — 간편 인증(KICA SecuKit One-S) **서버 몫** 공통 함수(Node).
 *
 * 플랫폼 API(jcurve-api, PHP `App\Services\Kiap`)와 **같은 판정**을 자체 서버(스터디숲 apps/admin 같은 Node)에서 쓰게 모았다.
 * DB · 세션 · 가입은 앱 서버 몫이다 — 여기는 KICA 와 주고받는 것과 판정만.
 *
 * 2026-09-30 스터디숲에서 고친 것을 모두 담았다:
 *  - #302 시작 페이지를 IP 로 막지 않는다(프록시 · Cloudflare 뒤에서는 모두 같은 IP) — 막는 코드 자체를 두지 않았다
 *  - #304 Referrer-Policy 는 도메인을 보내는 값(PAGE_HEADERS) — no-referrer 면 KICA 가 E4108(요청 도메인 오류)
 *  - #305 기관은 KICA 창에서 한 번만(하나면 바로 · 여럿이면 켠 것만 · default_provider), 오류는 코드와 함께 화면에
 *  - #305 · #306 CI — 칸 이름 여럿 · 원문 CI · 읽을 수 있는 복호화 값만 · 테스트 키(개발 주소)만 번호로 대신 · 운영은 필수
 *  - #308 생년월일을 결과에서 받는다
 *  - 허용 도메인 · 공개 주소(publicBase) · 테스트/운영 주소(KIAP_HOST)
 */
import { createDecipheriv, createHmac } from 'node:crypto';

export const KIAP_HOST = { dev: 'https://kiapdev.signgate.com', prod: 'https://kiap.signgate.com' } as const;

/** 인증 페이지 응답 머리글 — Referrer-Policy 가 no-referrer 면 KICA iframe 이 부른 쪽 도메인을 못 봐 E4108 */
export const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
} as const;

/** 흔한 사유 코드 — 복귀 주소의 `reason` 과 서버 로그에 쓰는 이름(앱 쪽 identityMessage 와 같은 목록) */
export const REASONS = [
  'CANCELED', 'CONFIG_MISSING', 'SESSION_USED', 'SESSION_EXPIRED', 'RATE_LIMITED', 'CALLBACK_FIELDS_MISSING',
  'PROVIDER_NOT_ALLOWED', 'RESULT_BINDING_MISMATCH', 'DECRYPT_FAILED', 'CI_MISSING', 'DUPLICATE_CI', 'RACE_BLOCKED',
  'KIAP_TIMEOUT', 'KIAP_BADJSON', 'KIAP_HTTP_<상태>', 'KIAP_<KICA 코드>',
] as const;

/** 응답 칸 복호화 — AES-CBC/PKCS5, 키 = base64(auth_token)(16·24·32바이트), IV 고정. 실패 · 빈 값은 '' */
export function kiapDecrypt(enc: unknown, authToken: string): string {
  if (typeof enc !== 'string' || !enc) return '';
  try {
    const key = Buffer.from(authToken, 'base64');
    const alg = ({ 16: 'aes-128-cbc', 24: 'aes-192-cbc', 32: 'aes-256-cbc' } as Record<number, string>)[key.length];
    if (!alg) return '';
    const d = createDecipheriv(alg, key, Buffer.from('secureiv12345678'));
    return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export const normName = (s: string) => s.normalize('NFC').replace(/[\s​-‍　]+/gu, '');
export function normPhone(s: string): string {
  let d = s.replace(/[^0-9+]/g, '');
  if (d.startsWith('+82')) d = '0' + d.slice(3);
  else if (d.startsWith('82') && d.length >= 10) d = '0' + d.slice(2);
  return d.replace(/\D/g, '');
}

/**
 * CI 꺼내기 — 칸 이름이 다르고(ci · CI · connInfo · conn_info) 원문(88자 base64)으로 올 수도 있다.
 * 원문을 복호화하면 드물게 「성공」하며 깨진 글자가 나와 **읽을 수 있는 글자일 때만** 복호화 값을 쓴다.
 * CI 가 없으면 `dev`(테스트 키 · 개발 주소)일 때만 번호로 대신한다 — 운영은 빈 값(호출한 쪽이 CI_MISSING).
 */
export function extractCi(d: Record<string, unknown>, authToken: string, opt: { dev: boolean; phone: string }):
  { ci: string; from: 'dec' | 'raw' | 'dev' | 'none'; key: string | null } {
  const key = ['ci', 'CI', 'connInfo', 'conn_info'].find((k) => typeof d[k] === 'string' && d[k]) ?? null;
  const raw = key ? String(d[key]) : '';
  if (raw) {
    const dec = kiapDecrypt(raw, authToken);
    if (dec && /^[\x20-\x7E]+$/.test(dec)) return { ci: dec, from: 'dec', key };
    if (/^[A-Za-z0-9+/]{86}==$/.test(raw)) return { ci: raw, from: 'raw', key };
  }
  if (opt.dev && opt.phone) return { ci: `dev-noci:${opt.phone}`, from: 'dev', key };
  return { ci: '', from: 'none', key };
}

/** 생년월일 — YYYYMMDD · YYYY-MM-DD 모두 받아 YYYY-MM-DD, 모양이 아니면 null */
export function extractBirth(d: Record<string, unknown>, authToken: string): string | null {
  const b = kiapDecrypt(d.birthday ?? d.birth, authToken).replace(/\D/g, '');
  if (!/^(19|20)\d{6}$/.test(b)) return null;
  const [y, m, day] = [+b.slice(0, 4), +b.slice(4, 6), +b.slice(6, 8)];
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day ? `${b.slice(0, 4)}-${b.slice(4, 6)}-${b.slice(6, 8)}` : null;
}

/** CI 검색 해시 — HMAC-SHA256 base64url. 키는 앱 서버가 가진 비밀(바꾸면 기존 해시가 모두 무효) */
export const ciHash = (ci: string, key: Buffer | string) => createHmac('sha256', key).update(ci).digest('base64url');

/** getResult — Bearer 는 콜백 form 의 **동적** access_token(콘솔의 고정 토큰이면 401) */
export async function kiapResult(host: string, dynToken: string, ids: { provider_id: string; client_tx_id: string; server_tx_id: string },
  timeoutMs = 5000): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${host}/kiap-service/api/v1/getResult`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${dynToken}` },
      body: JSON.stringify(ids), signal: AbortSignal.timeout(timeoutMs),
    });
    if (r.status !== 200) return { ok: false, error: `KIAP_HTTP_${r.status}` };
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    if (!j) return { ok: false, error: 'KIAP_BADJSON' };
    if (j.code !== '0000') return { ok: false, error: `KIAP_${String(j.code ?? 'NOCODE').replace(/\W/g, '')}` };
    return { ok: true, data: j };
  } catch {
    return { ok: false, error: 'KIAP_TIMEOUT' };
  }
}

export type Verified = { ok: true; name: string; phone: string; birth: string | null; ci: string; ciFrom: string; provider: string; fields: string[] };

/**
 * 콜백 판정 ①②③ — ① KICA 결과 코드 ② getResult + 이 거래 · 이 기관 · AUTH 인지 ③ 복호화 · CI.
 * ④ 1인 1계정(CI 해시 대조)과 세션 · 가입은 앱 서버가 한다. 실패는 사유 코드만(값은 밖으로 내지 않는다).
 * `form` 은 KICA 가 콜백에 form POST 로 준 값 그대로.
 */
export async function verifyCallback(form: Record<string, string>, cfg: { host: string }): Promise<Verified | { ok: false; reason: string }> {
  const code = form.code ?? '';
  if (code !== '0000') return { ok: false, reason: code ? `KIAP_${code.replace(/\W/g, '').slice(0, 20)}` : 'KIAP_CODE_MISSING' };
  const authToken = form.auth_token ?? '', provider = (form.provider_id ?? '').toUpperCase();
  const clientTx = form.client_tx_id ?? '', serverTx = form.server_tx_id ?? '', dynToken = form.access_token ?? '';
  if (!authToken || !provider || !clientTx || !serverTx || !dynToken) return { ok: false, reason: 'CALLBACK_FIELDS_MISSING' };
  // 기관은 KICA 창이 고른다 — 모양만 보고, 진짜 여부는 getResult 가 확인
  if (!/^[A-Z_]{2,16}$/.test(provider)) return { ok: false, reason: 'PROVIDER_NOT_ALLOWED' };

  const r = await kiapResult(cfg.host, dynToken, { provider_id: provider, client_tx_id: clientTx, server_tx_id: serverTx });
  if (!r.ok) return { ok: false, reason: r.error };
  const d = r.data;
  if (d.client_tx_id !== clientTx || d.server_tx_id !== serverTx || String(d.provider_id ?? '').toUpperCase() !== provider || d.service_code !== 'AUTH') {
    return { ok: false, reason: 'RESULT_BINDING_MISMATCH' };
  }

  const name = normName(kiapDecrypt(d.name, authToken));
  const phone = normPhone(kiapDecrypt(d.phone, authToken));
  if (!name || name.length > 40 || !/^01\d{8,9}$/.test(phone)) return { ok: false, reason: 'DECRYPT_FAILED' };
  const c = extractCi(d, authToken, { dev: cfg.host === KIAP_HOST.dev, phone });
  if (!c.ci) return { ok: false, reason: 'CI_MISSING' };

  return { ok: true, name, phone, birth: extractBirth(d, authToken), ci: c.ci, ciFrom: c.from, provider, fields: Object.keys(d).sort() };
}

/**
 * 인증 페이지 · 콜백 · SDK 의 공개 주소 — KICA 는 **허용 도메인**에서만 창을 띄운다.
 * `KIAP_PUBLIC_BASE` 가 있으면 그 주소, 없으면 요청이 들어온 주소(프록시 머리글 x-forwarded-* 존중) + `suffix`.
 */
export function publicBase(req: { url: string; headers: { get(k: string): string | null } } | null, env = process.env.KIAP_PUBLIC_BASE, suffix = '/api/v1'): string | null {
  const own = (env ?? '').replace(/\/+$/, '');
  if (own) return own;
  if (!req) return null;
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim() || url.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  return `${proto}://${host}${suffix}`;
}

/** 복귀 주소에 쿼리를 붙인다 */
export const withQuery = (ret: string, q: Record<string, string | number>) =>
  ret + (ret.includes('?') ? '&' : '?') + Object.entries(q).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

/** 앱으로 돌려보내는 작은 페이지 — 콜백은 KICA iframe 안이라 top 을 옮긴다 */
export const backPageHtml = (url: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>(window.top||window).location.replace(${js(url)});</script><p style="font-family:sans-serif;text-align:center;margin-top:40vh">앱으로 돌아가요…</p>`;

const BRAND: Record<string, [string, string]> = {
  KAKAO: ['#FEE500', '#191919'], NAVER: ['#03C75A', '#FFFFFF'], TOSS: ['#0064FF', '#FFFFFF'], PASS: ['#E4002B', '#FFFFFF'], SAMSUNG: ['#1428A0', '#FFFFFF'],
};

/**
 * 인증 시작 페이지 HTML — 응답 머리글은 PAGE_HEADERS 를 쓴다.
 * `providers` 가 하나면 우리 화면 없이 그 기관으로 바로 열고, 여럿이면 켠 것만 버튼으로 보이며 누르면 default_provider 로 넘긴다.
 * 비우면 KICA 창의 목록 하나로 연다. 오류는 코드와 함께 화면에(조용히 삼키지 않는다).
 */
export function startPageHtml(o: {
  title: string; host: string; clientId: string; accessToken: string; sdkUrl: string; callbackUrl: string; cancelUrl: string;
  providers?: { code: string; label: string }[]; lead?: string;
}): string {
  const list = o.providers ?? [];
  const pick = list.length === 1 ? list[0].code : null;
  const buttons = list.length > 1
    ? list.map((p) => { const [bg, fg] = BRAND[p.code] ?? ['#E9E2D6', '#3A2E1F']; return `<button class="btn" style="background:${bg};color:${fg}" onclick="go(${esc(js(p.code))})">${esc(p.label)}</button>`; }).join('\n')
    : `<button class="btn again" onclick="go(PICK)">인증 창 다시 열기</button>`;
  const lead = o.lead ?? (pick ? `${list[0].label}(으)로 인증해요.` : list.length > 1 ? '쓰고 있는 앱을 골라 주세요.' : '인증 창이 열리면 쓰고 있는 앱을 골라 주세요.');
  return `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex, nofollow">
<title>${esc(o.title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'Pretendard',sans-serif;background:#FFFDF7;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px}
h1{font-size:20px;color:#1F2A1C}p{font-size:14px;color:#6B6A5E;text-align:center;line-height:1.5;margin-bottom:8px}
.btn{width:100%;max-width:320px;padding:15px 0;border:0;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer}
.again{background:#3A2E1F;color:#fff}.cancel{background:none;color:#6B6A5E;font-size:14px;font-weight:400;margin-top:8px}
#err{display:none;color:#C0392B;font-size:13px;max-width:320px}
#kiap-sass{height:100dvh!important}
</style>
<script src="${esc(o.sdkUrl)}"></script>
</head><body>
<h1>간편 인증</h1>
<p>${esc(lead)}<br>인증 결과는 한 사람이 한 계정만 쓰도록 확인하는 데만 써요.</p>
${buttons}
<p id="err"></p>
<button class="btn cancel" onclick="location.replace(CFG.cancelUrl)">취소하고 돌아가기</button>
<script>
var CFG = ${js({ host: o.host, clientId: o.clientId, accessToken: o.accessToken, callbackUrl: o.callbackUrl, cancelUrl: o.cancelUrl })};
var PICK = ${js(pick)}, MANY = ${list.length > 1 ? 'true' : 'false'};
function showErr(t){var el=document.getElementById('err');el.textContent=t;el.style.display='block';}
window.addEventListener('unhandledrejection',function(ev){var r=ev.reason||{};showErr('인증 창을 열지 못했어요 ('+(r.code||r.name||'NET')+') '+(r.message||'')+' — 잠시 뒤 다시 해 주세요.');});
window.addEventListener('error',function(ev){if(ev&&ev.message)showErr('인증 창을 열지 못했어요 (JS) '+ev.message);});
window.kiap&&kiap.configure({host:CFG.host,mode:'iframe'});
function go(provider){
  if(!window.kiap){showErr('인증 모듈을 불러오지 못했어요 (SDK_MISSING) — 잠시 뒤 다시 해 주세요.');return;}
  var opt={service_code:'AUTH',callback_url:CFG.callbackUrl,device_type:'MO'};
  if(provider)opt.default_provider=provider;
  kiap.request(CFG.clientId,CFG.accessToken,opt).catch(function(e){
    var code=e&&e.code?String(e.code):'',msg=e&&e.message?String(e.message):'';
    if(!code||/CANCEL/i.test(code)||/cancel/i.test(msg))return;
    showErr('인증 창을 열지 못했어요 ('+code+')'+(msg?' '+msg:'')+' — 다시 누르거나 잠시 뒤 다시 해 주세요.');
  });
}
window.addEventListener('load',function(){if(!MANY)go(PICK);});
</script>
</body></html>`;
}
