/** ATT 상태 — `unavailable` 은 iOS 가 아니거나 모듈이 없는 빌드, `unknown` 은 읽기가 실패한 것 */
export type AttStatus = 'granted' | 'denied' | 'restricted' | 'undetermined' | 'unavailable' | 'unknown';
export type AttTrigger = 'launch' | 'offerwall';
/** `request` = 시스템 창(중립 안내 뒤), `show` = 거부 · 제한 단계 시트(오퍼월 진입 때만) */
export type AttAction = 'show' | 'request' | 'none';
/** 1.9.11 부터 쓰이지 않는다(앱 코드가 타입을 가져다 써도 컴파일되도록 이름만 남김) */
export type AttStorage = {
    getItem: (key: string) => string | null | undefined | Promise<string | null | undefined>;
    setItem: (key: string, value: string) => void | Promise<void>;
};
/** 거부 · 제한 단계 시트 문구 — 기본값은 아래 `ATT_SHEET_TEXTS`. `{appName}` 자리는 앱 이름으로 바뀐다 */
export type AttSheetTexts = {
    /** 맨 위 첫 줄 */
    title: string;
    /** 둘째 줄 — 기본은 비어 있다(안 그린다) */
    body: string;
    /** 다섯 단계 — 셋째 줄에 `{appName}` 이 들어간다 */
    steps: string[];
    /** 「설정에서 허용하기」를 누르면 3단계까지 바로 간다는 안내 */
    guide: string;
    /** 앱 화면에 「추적 허용」이 안 보일 때의 보조 안내(작은 글씨) */
    fallback: string;
    openSettings: string;
    later: string;
};
/** 시스템 ATT 창 앞 중립 안내 문구 */
export type AttPrimerTexts = {
    title: string;
    body: string;
    button: string;
};
/** 거부 · 제한 단계 시트 기본 문구(1.9.11: 첫 줄만 사실 설명으로 바꾸고 이익을 내세우던 문구는 지웠다 — 단계 안내는 그대로) */
export declare const ATT_SHEET_TEXTS: Readonly<AttSheetTexts>;
/** 시스템 ATT 창 앞 중립 안내 기본 문구(대표님 확정 문구 — 앱이 `primerTexts` 로 덮어쓸 수 있다) */
export declare const ATT_PRIMER_TEXTS: Readonly<AttPrimerTexts>;
/** 문구를 합친다 — 덮어쓴 값이 있으면 그것을, 단계의 `{appName}` 을 앱 이름으로 바꾼다 */
export declare function attSheetTexts(appName: string, overrides?: Partial<AttSheetTexts>): AttSheetTexts;
/** 로컬 달력 날짜(YYYY-MM-DD) */
export declare function localDay(d: Date): string;
/**
 * 무엇을 할지 — 기기 없이 판단하는 순수 함수.
 * - Android·웹 등 iOS 가 아니면 아무것도 안 한다.
 * - 미정이면 시스템 창(`request`) — 어느 시점이든. 그 앞에 중립 안내가 한 번 붙는다.
 * - 거부·제한이면 **오퍼월 진입 때만** 단계 시트(`show`). 앱을 켤 때(`launch`)는 절대 아니다.
 */
export declare function decideAttAction(i: {
    os: string;
    trigger: AttTrigger;
    status: string;
    lastShownDay?: string | null;
    today: string;
}): AttAction;
/** 추적 모듈 — 없거나 함수가 없으면 null. 가드된 require 는 이 한 곳에서만 한다 */
export type TrackingModule = {
    getTrackingPermissionsAsync: () => Promise<{
        status?: string;
    } | null | undefined>;
    requestTrackingPermissionsAsync: () => Promise<{
        status?: string;
    } | null | undefined>;
};
export declare function loadTracking(): TrackingModule | null;
/** react-native 를 가드된 require 로 — 웹·Expo Go 에서도 import 가 던지지 않게 */
export declare function loadRN(): any | null;
/** 현재 상태를 읽는다 — 실패하면 `unknown`(던지지 않는다) */
export declare function readStatus(tracking: TrackingModule): Promise<AttStatus>;
/** 시스템 ATT 창을 띄우고 결과 상태를 돌려준다(창이 없으면 미정 그대로) */
export declare function requestStatus(tracking: TrackingModule): Promise<AttStatus>;
/**
 * 화면을 가진 쪽 — 마운트된 `AttDeniedSheet` 가 등록한다. 각 함수는 보이고, 사용자가 끝내면(그리고 창이 사라지면) `done` 을 부른다.
 * 등록된 곳이 없으면(앱이 안 붙였으면) 안내 없이 바로 넘어간다.
 */
export type AttHost = {
    primer: (done: () => void) => void;
    sheet: (done: () => void) => void;
};
export declare function registerAttHost(h: AttHost | null): void;
/** 시스템 ATT 창 앞 중립 안내 — **한 번만**(이번 실행 안에서: 끝난 약속을 그대로 돌려준다). 동시에 부르면 하나를 같이 기다린다. 화면이 없으면 바로 돌아온다 */
export declare function showAttPrimerOnce(): Promise<void>;
/** 거부 · 제한 단계 시트 — 닫히면 돌아온다. 동시에 부르면 하나를 같이 기다린다. 화면이 없으면 바로 돌아온다 */
export declare function showAttSheet(): Promise<void>;
/** 판단에 쓰는 기기 값 묶음 — 시험에서는 가짜를 넣는다 */
export type AttDeps = {
    os: string;
    tracking: TrackingModule | null;
    /** 시스템 창 앞 중립 안내 — 기본은 `showAttPrimerOnce` */
    primer?: () => Promise<void>;
    /** 거부 · 제한 단계 시트 — 기본은 `showAttSheet` */
    sheet?: () => Promise<void>;
};
/**
 * 오퍼월에 들어가기 전 — ATT 상태를 확인하고 **결과 상태**를 돌려준다. 오퍼월을 막지 않는다.
 * - 미정: 중립 안내(한 번) → 시스템 창 → 그 결과.
 * - 거부 · 제한: 단계 시트를 열고, 닫히면 다시 읽은 상태(설정에서 켰을 수 있다). 시트가 안 붙어 있으면 그 상태를 바로 돌려준다.
 * - 허용 · Android · 모듈 없음: 바로 돌려준다.
 */
export declare function ensureTrackingBeforeOfferwallWith(d: AttDeps): Promise<AttStatus>;
/** 앱이 오퍼월에 들어가기 전에 부른다 — 실제 기기 값과 마운트된 화면을 쓴다. `storage` 는 1.9.11 부터 쓰이지 않는다(호출 코드가 그대로 컴파일되도록 남김) */
export declare function ensureTrackingBeforeOfferwall(_storage?: AttStorage): Promise<AttStatus>;
