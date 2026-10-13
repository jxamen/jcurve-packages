/** 앱이 넘기는 언어 — 'ko' · 'en' 또는 'en-US' 같은 기기 값(앞 두세 글자만 본다) */
export type Lang = 'ko' | 'en' | (string & {});
/** 'en-US' · 'en_US' · 'EN' → 'en'. 못 읽으면 'ko' */
export declare function normLang(lang?: string | null): string;
/** 한국어 원문 → 그 언어. lang 이 없거나 ko 거나 표에 없으면 원문 그대로 */
export declare function t(ko: string, lang?: string | null): string;
/** `{0}` · `{1}` 자리에 값을 넣는다 — 원문(한국어)도 같은 자리표로 적는다(한국어면 예전 템플릿과 같은 글자) */
export declare function tf(ko: string, lang: string | null | undefined, ...args: unknown[]): string;
