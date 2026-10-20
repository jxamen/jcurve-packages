/**
 * ATT 상태 — `unavailable` 은 iOS 가 아니거나 모듈이 없는 빌드, `unknown` 은 읽기가 실패한 것.
 * `proceed` 는 `ensureTrackingBeforeOfferwall` 만 돌려준다: 추적이 꺼져 있지만(거부 · 제한) **오퍼월은 열어도 된다**는 뜻이다.
 */
export type AttStatus = 'granted' | 'denied' | 'restricted' | 'undetermined' | 'unavailable' | 'unknown' | 'proceed';
export type AttTrigger = 'launch' | 'offerwall';
/** `request` = 시스템 창(중립 안내 뒤), `show` = 추적이 꺼져 있을 때의 가운데 팝업(오퍼월 진입 때만) */
export type AttAction = 'show' | 'request' | 'none';
/** 마지막으로 팝업을 띄운 날을 적어 둘 곳 — 앱이 `<AttDeniedSheet storage={AsyncStorage}>` 로 넘긴다. 안 넘기면 메모리(앱을 끄면 잊는다) */
export type AttStorage = {
    getItem: (key: string) => string | null | undefined | Promise<string | null | undefined>;
    setItem: (key: string, value: string) => void | Promise<void>;
};
/** 1.9.13 부터 쓰이지 않는다(옛 단계 시트 문구 모양 — 앱 코드가 타입을 가져다 써도 컴파일되도록 이름만 남김) */
export type AttSheetTexts = {
    title: string;
    body: string;
    steps: string[];
    guide: string;
    fallback: string;
    openSettings: string;
    later: string;
};
/** 1.9.13 부터 비어 있다 — 옛 단계 시트 문구를 지웠다(번들에 남기지 않는다). 앱이 import 해도 컴파일은 유지된다 */
export declare const ATT_SHEET_TEXTS: Readonly<AttSheetTexts>;
/** 시스템 ATT 창 앞 중립 안내 문구 */
export type AttPrimerTexts = {
    title: string;
    body: string;
    button: string;
};
/** 추적이 꺼져 있을 때의 가운데 팝업 문구 */
export type AttDeniedTexts = {
    title: string;
    body: string;
    /** 설정 앱을 연다 */
    openSettings: string;
    /** 그냥 닫고 이어서 간다 */
    proceed: string;
};
/** 시스템 ATT 창 앞 중립 안내 기본 문구(대표님 확정 문구 — 앱이 `primerTexts` 로 덮어쓸 수 있다) */
export declare const ATT_PRIMER_TEXTS: Readonly<AttPrimerTexts>;
/** 추적이 꺼져 있을 때의 가운데 팝업 기본 문구(대표님 확정 문구 — 앱이 `deniedTexts` 로 덮어쓸 수 있다) */
export declare const ATT_DENIED_TEXTS: Readonly<AttDeniedTexts>;
/** 로컬 달력 날짜(YYYY-MM-DD) — 「하루 한 번」은 기기 시간대의 자정 기준이다 */
export declare function localDay(d: Date): string;
/**
 * 무엇을 할지 — 기기 없이 판단하는 순수 함수.
 * - Android·웹 등 iOS 가 아니면 아무것도 안 한다.
 * - 미정이면 시스템 창(`request`) — 어느 시점이든. 그 앞에 중립 안내가 한 번 붙는다.
 * - 거부·제한이면 **오퍼월 진입 때만** 가운데 팝업(`show`, 하루 한 번은 호출 쪽이 센다). 앱을 켤 때(`launch`)는 절대 아니다.
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
/** 저장소 열쇠 — 마지막으로 가운데 팝업을 띄운 날(YYYY-MM-DD) */
export declare const ATT_DENIED_STORAGE_KEY = "jcurve.ads.attDenied.lastShown";
/**
 * 화면을 가진 쪽 — 마운트된 `AttDeniedSheet` 가 등록한다. 각 함수는 보이고, 사용자가 끝내면(그리고 창이 사라지면) `done` 을 부른다.
 * 등록된 곳이 없으면(앱이 안 붙였으면) 안내 없이 바로 넘어간다.
 */
export type AttHost = {
    primer: (done: () => void) => void;
    denied: (done: () => void) => void;
    /** 가운데 팝업을 띄운 날을 적어 둘 곳 — 없으면 메모리 */
    storage?: AttStorage;
};
export declare function registerAttHost(h: AttHost | null): void;
/** 시스템 ATT 창 앞 중립 안내 — **한 번만**(이번 실행 안에서: 끝난 약속을 그대로 돌려준다). 동시에 부르면 하나를 같이 기다린다. 화면이 없으면 바로 돌아온다 */
export declare function showAttPrimerOnce(): Promise<void>;
/**
 * 추적이 꺼져 있을 때의 가운데 팝업 — **하루 한 번**(기기 로컬 날짜). 오늘 이미 보였으면 띄우지 않고 바로 돌아온다.
 * 닫힐 때까지(「설정 열기」는 설정 앱에서 돌아올 때까지) 기다린다. 동시에 부르면 하나를 같이 기다린다. 화면이 없으면 바로 돌아온다.
 */
export declare function showAttDeniedOncePerDay(today?: string): Promise<void>;
/** 설정 앱에 다녀온 뒤 — 앱이 다시 앞으로 오면 돌아온다. 설정 앱으로 안 넘어가면(열기가 안 먹으면) `leaveMs` 뒤에 돌아온다 */
export declare const SETTINGS_LEAVE_MS = 2000;
export declare function waitForReturn(appState: any, leaveMs?: number): Promise<void>;
/** 판단에 쓰는 기기 값 묶음 — 시험에서는 가짜를 넣는다 */
export type AttDeps = {
    os: string;
    tracking: TrackingModule | null;
    /** 시스템 창 앞 중립 안내 — 기본은 `showAttPrimerOnce` */
    primer?: () => Promise<void>;
    /** 추적이 꺼져 있을 때의 가운데 팝업 — 기본은 `showAttDeniedOncePerDay` */
    denied?: () => Promise<void>;
};
/**
 * 오퍼월에 들어가기 전 — ATT 상태를 확인하고 **오퍼월을 열어도 되는지**를 돌려준다. 오퍼월을 막지 않는다.
 * - 미정: 중립 안내(한 번) → 시스템 창 → 그 결과.
 * - 거부 · 제한: 가운데 팝업(하루 한 번) → 닫히면 다시 읽은 상태(설정에서 켰을 수 있다). 팝업이 안 붙어 있거나 오늘 이미 봤으면 바로.
 * - 허용 · Android · 모듈 없음: 바로 돌려준다.
 * 돌려주는 값: `granted` · `unavailable` · `unknown` 은 그대로, 추적이 꺼져 있으면(거부 · 제한, 시스템 창에서 막 거부한 경우 포함) **`proceed`**.
 * 앱은 어떤 값이 와도 오퍼월을 연다 — 값은 참고용이다.
 */
export declare function ensureTrackingBeforeOfferwallWith(d: AttDeps): Promise<AttStatus>;
/** 앱이 오퍼월에 들어가기 전에 부른다 — 실제 기기 값과 마운트된 화면을 쓴다. `storage` 는 `<AttDeniedSheet storage>` 로 넘긴다(여기 인자는 쓰이지 않는다) */
export declare function ensureTrackingBeforeOfferwall(_storage?: AttStorage): Promise<AttStatus>;
