/** Canonicalize known Naver product/place URLs; preserve all other targets. */
export declare function normalizeTargetUrl(input: string): string;
export declare function targetUrlId(input: string, kind?: 'shop' | 'place'): string | undefined;
export declare function validateTargetUrl(input: string, kind: 'shop' | 'place'): string | null;
