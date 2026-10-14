/**
 * 웹뷰가 열어 달라고 하는 주소(openAppTarget)를 거르는 규칙 — APIHUB 가이드 「블랙리스트 방식」.
 * javascript: data: file: content: about: blob: 만 막고, naversearchapp:// · coupang:// 같은 앱 스킴과 intent:// 는 그대로 연다.
 */
export declare const BLOCKED_SCHEMES: readonly ["javascript", "data", "file", "content", "about", "blob"];
/** 주소의 스킴(소문자). 없거나 이상하면 null. 앞뒤 공백 · 제어 문자 제거 후 본다(「java\tscript:」 같은 우회 방지) */
export declare function schemeOf(url: string): string | null;
export declare function isBlocked(url: unknown): boolean;
export type Target = {
    url: string;
    fallbackUrl?: string;
};
/**
 * 열 주소를 앱이 열 수 있는 모양으로 바꾼다.
 *  - intent://host/path#Intent;scheme=xxx;package=yyy;S.browser_fallback_url=zzz;end → xxx://host/path (+ 폴백 zzz)
 *  - market://details?id=… → https://play.google.com/store/apps/details?id=…
 * 막힌 주소면 null.
 */
export declare function resolveTarget(rawUrl: unknown, fallbackUrl?: unknown): Target | null;
export declare function isWebUrl(url: string): boolean;
