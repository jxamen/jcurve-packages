/** 서버 POST apihub/entry → { ok, url } 또는 { ok:false, error }. 앱이 자기 요청 함수(토큰 · 재시도)를 넘긴다 */
export type EntryResult = {
    ok: true;
    url: string;
} | {
    ok: false;
    reason: 'off' | 'not_ready' | 'network' | 'invalid';
};
export type Requester = (path: string, options?: {
    method?: string;
    body?: unknown;
}) => Promise<unknown>;
/** 허용 origin(스킴 + 호스트, 포트 없음) */
export declare const ALLOWED_ORIGINS: string[];
/** 이 주소가 승인된 APIHUB origin(https · 약속된 호스트 · 포트 · 계정 정보 없음)인가 */
export declare function isAllowedOrigin(url: unknown): boolean;
/**
 * 서버가 준 웹뷰 첫 주소 — 승인된 origin 의 /alwayz/entry.php 이고 필수 파라미터(pubKey · uid · trackingId)가 비어 있지 않을 때만.
 * 이상한 주소로 웹뷰를 열지 않는다. 공개 컴포넌트(MissionWebView)에 들어오는 url 도 같은 검사를 한다.
 */
export declare function isEntryUrl(url: unknown): url is string;
export declare function fetchEntry(request: Requester, adId?: string): Promise<EntryResult>;
