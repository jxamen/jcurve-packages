import type { LinkPlatform } from './model';
/** 이름 한 덩이 — 한글은 전부 「가」, 24자 이상 긴 영숫자는 앞 8자 + `~`, 숫자 7자리 이상 연속은 `:n` */
export declare function shapeName(s: string): string;
/**
 * 경로 — 세그먼트마다 숫자만 · UUID · 16자 이상 토큰은 `:n` · `:id` 로 바꾼다.
 * 숫자 줄이기는 서버가 막는 「숫자 7자리 연속」을 피하려고 `9999999` 대신 `:n` 을 쓴다(보고서 참고).
 */
export declare function shapePath(path: string): string;
export type ProbePayload = {
    platform: LinkPlatform;
    page: {
        host: string;
        path: string;
        query_keys: string[];
    };
    cookie_names: string[];
    dom: {
        outline: string[];
        repeat_counts: Record<string, number>;
    };
    requests: {
        method: string;
        host: string;
        path: string;
        status: number;
        response_keys: string[];
    }[];
};
/**
 * 웹뷰가 보낸 원본 한 덩이 → 서버 본문. 어떤 모양이 와도 허용 문자 · 상한만 지키고, 틀린 칸은 빈 값으로 둔다.
 * raw 키는 probeCollectScript 가 만든다(host · path · queryKeys · cookieNames · outline · repeat · requests).
 */
export declare function buildPayload(raw: unknown, platform?: LinkPlatform): ProbePayload;
/** 구조 기록 단추를 그릴지 — 대표님 계정(probe === true)일 때만. 상태가 없거나 없는 칸이면 false */
export declare const showProbeButton: (s: {
    probe?: boolean;
} | null | undefined) => boolean;
/**
 * 구조 기록 스크립트(단추를 누르면 한 번 실행). 글자 · 입력값을 읽지 않고 요소의 모양만 모아 앱에 보낸다.
 * DOM 은 body 아래 깊이 6까지 요소만 본다. 속성은 data- 이름만 — 값은 안 읽는다.
 */
export declare function probeCollectScript(): string;
/**
 * 관찰 래퍼(로그인 창이 열릴 때 페이지보다 먼저 심는다 — 대표님 계정만). fetch · XHR 을 감싸 호출마다
 * {method, host, path, status, responseKeys} 를 최근 40건 링 버퍼(window.__ytProbe)에 쌓는다. 요청 · 응답 값은 저장하지 않는다.
 * 원래 호출은 그대로 돌려주고, 래퍼 안의 예외는 삼킨다.
 */
export declare function probeObserveScript(): string;
