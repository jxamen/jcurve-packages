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
/** auto 이면 답 메시지에 auto:true 가 붙는다 — 흐름이 자동으로 모으는 것이라 화면 문구를 바꾸지 않게 구별한다(손으로 누른 것은 붙지 않는다) */
export declare function probeCollectScript(auto?: boolean): string;
/**
 * 관찰 래퍼(로그인 창이 열릴 때 페이지보다 먼저 심는다 — 대표님 계정만). fetch · XHR 을 감싸 호출마다
 * {method, host, path, status, responseKeys} 를 최근 40건 링 버퍼(window.__ytProbe)에 쌓는다. 요청 · 응답 값은 저장하지 않는다.
 * 원래 호출은 그대로 돌려주고, 래퍼 안의 예외는 삼킨다.
 */
export declare function probeObserveScript(): string;
/** 한 번 실행에서 같은 화면 모양마다 한 번 모으는 요청 목록 구조 기록의 상한 */
export declare const AUTO_COLLECT_MAX = 6;
/** 한 번 실행에서 흐름이 자동으로 보내는 구조 요약의 상한 — 서버는 회원당 최근 40건만 남기므로(PROBE_KEEP) 합쳐서 40 아래로 둔다 */
export declare const FLOW_RECORD_MAX = 20;
/** 한 번 실행에서 구조 기록기(shapeTap)가 올리는 tap 구조 기록의 상한 */
export declare const TAP_RECORD_MAX = 8;
/** 합쳐서 서버 보관 한도(회원당 40건) 아래 — 손으로 누르는 「구조 기록」 몫을 남긴다 */
export declare const RUN_RECORD_MAX: number;
/** 화면 모양 이름 — 호스트 + 경로(숫자만인 칸은 :n, 긴 토큰은 :id, 한글은 가). 쿼리 · 해시는 보지 않는다. `host/path` 모양(흐름의 구조 요약 주소)을 받는다 */
export declare function screenKey(hostAndPath: string): string;
/**
 * 대표님 계정이 한 번 돌릴 때 구조 기록이 서버로 얼마나 가는지 정하는 문 — 순수 함수라 노드에서 시험한다.
 *  - allowFlowRecord: 흐름이 자동으로 보내는 구조 요약. 최대 FLOW_RECORD_MAX 건.
 *  - allowCollect: 요청 목록(경로 · 쿼리 키 · 응답 키)이 든 구조 수집. 같은 화면 모양은 한 번만, 최대 AUTO_COLLECT_MAX 건. 허용하면 그 화면을 쓴 것으로 센다.
 *  - allowTap: 구조 기록기가 보낸 tap(화면 + target + 요청 경로 모양). 같은 모양은 한 번만, 최대 TAP_RECORD_MAX 건.
 * 한 실행에서 서버로 가는 구조 기록은 많아야 RUN_RECORD_MAX(= FLOW_RECORD_MAX + AUTO_COLLECT_MAX + TAP_RECORD_MAX = 34)건이다(손으로 누른 「구조 기록」 제외).
 */
export declare function createProbeGate(opts?: {
    flowMax?: number;
    collectMax?: number;
    tapMax?: number;
}): {
    allowFlowRecord(): boolean;
    allowCollect(hostAndPath: string): boolean;
    allowTap(key: string): boolean;
};
