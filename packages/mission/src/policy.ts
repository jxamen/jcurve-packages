/**
 * 웹뷰가 열어 달라고 하는 주소(openAppTarget)를 거르는 규칙 — APIHUB 가이드 「블랙리스트 방식」.
 * javascript: data: file: content: about: blob: 만 막고, naversearchapp:// · coupang:// 같은 앱 스킴과 intent:// 는 그대로 연다.
 */
export const BLOCKED_SCHEMES = ['javascript', 'data', 'file', 'content', 'about', 'blob'] as const;

/** 주소의 스킴(소문자). 없거나 이상하면 null. 앞뒤 공백 · 제어 문자 제거 후 본다(「java\tscript:」 같은 우회 방지) */
export function schemeOf(url: string): string | null {
  const clean = String(url ?? '').replace(/[\u0000- \u007f]/g, '');
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(clean);
  return m ? m[1].toLowerCase() : null;
}

export function isBlocked(url: unknown): boolean {
  if (typeof url !== 'string' || url.trim() === '') return true;
  const s = schemeOf(url);
  return s === null || (BLOCKED_SCHEMES as readonly string[]).includes(s);
}

export type Target = { url: string; fallbackUrl?: string };

/**
 * 열 주소를 앱이 열 수 있는 모양으로 바꾼다.
 *  - intent://host/path#Intent;scheme=xxx;package=yyy;S.browser_fallback_url=zzz;end → xxx://host/path (+ 폴백 zzz)
 *  - market://details?id=… → https://play.google.com/store/apps/details?id=…
 * 막힌 주소면 null.
 */
export function resolveTarget(rawUrl: unknown, fallbackUrl?: unknown): Target | null {
  const main = convert(rawUrl);
  if (!main) return null;
  let fallback = typeof fallbackUrl === 'string' ? convertFallback(fallbackUrl) : undefined;
  // intent 의 browser_fallback_url 은 직접 준 fallbackUrl 이 없을 때만 쓴다
  if (!fallback && main.intentFallback) fallback = convertFallback(main.intentFallback);
  return fallback ? { url: main.url, fallbackUrl: fallback } : main.url ? { url: main.url } : null;
}

type Converted = { url: string; intentFallback?: string };

/** 열 주소를 앱이 열 수 있는 모양으로. intent:// → scheme://…, market:// → https://play.google.com/store/apps/… 막힌 주소면 null */
function convert(rawUrl: unknown): Converted | null {
  if (typeof rawUrl !== 'string' || isBlocked(rawUrl)) return null;
  let url = rawUrl.trim();
  let intentFallback: string | undefined;

  if (schemeOf(url) === 'intent') {
    const hash = url.indexOf('#Intent;');
    const body = hash >= 0 ? url.slice(hash + '#Intent;'.length) : '';
    const parts: Record<string, string> = {};
    for (const piece of body.split(';')) {
      const eq = piece.indexOf('=');
      if (eq > 0) parts[piece.slice(0, eq)] = piece.slice(eq + 1);
    }
    const scheme = parts.scheme;
    const bf = parts['S.browser_fallback_url'];
    if (bf) {
      try { intentFallback = decodeURIComponent(bf); } catch { intentFallback = bf; }
    }
    const rest = (hash >= 0 ? url.slice(0, hash) : url).replace(/^intent:/i, '');
    // 열 앱 스킴을 알 수 없거나, 막힌 스킴 · 또 다른 intent 를 끼워 넣으면 이 주소는 열지 않는다(폴백이 있으면 폴백만)
    if (!scheme || !/^[a-z][a-z0-9+.-]*$/i.test(scheme) || isBlocked(scheme + '://') || scheme.toLowerCase() === 'intent') {
      const fb = intentFallback ? convertFallback(intentFallback) : undefined;
      return fb ? { url: fb } : null;
    }
    url = scheme + ':' + rest;
  }
  if (schemeOf(url) === 'market') {
    url = url.replace(/^market:\/\//i, 'https://play.google.com/store/apps/');
  }
  if (isBlocked(url)) return null;   // 변환한 뒤에도 한 번 더 확인
  return { url, intentFallback };
}

/** 폴백 주소 — 변환은 한 번만(중첩 intent 거절), 변환 뒤에도 막힌 스킴이면 버린다 */
function convertFallback(raw: string): string | undefined {
  if (isBlocked(raw) || schemeOf(raw) === 'intent') return undefined;
  let url = raw.trim();
  if (schemeOf(url) === 'market') url = url.replace(/^market:\/\//i, 'https://play.google.com/store/apps/');
  return isBlocked(url) ? undefined : url;
}

export function isWebUrl(url: string): boolean {
  const s = schemeOf(url);
  return s === 'http' || s === 'https';
}
