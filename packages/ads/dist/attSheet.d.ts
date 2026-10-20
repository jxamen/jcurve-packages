/** 추적 허용 상태 — `unavailable` 은 iOS 가 아니거나 모듈이 없는 빌드, `unknown` 은 읽기가 실패한 것 */
export type AttStatus = 'granted' | 'denied' | 'restricted' | 'undetermined' | 'unavailable' | 'unknown';
export type AttTrigger = 'launch' | 'offerwall';
export type AttAction = 'show' | 'request' | 'none';
/** 저장소 열쇠 — 마지막으로 시트를 띄운 날 */
export declare const ATT_STORAGE_KEY = "jcurve.ads.attSheet.lastShown";
/** 마지막으로 시트를 띄운 날(YYYY-MM-DD) 저장소 — 앱이 넘기면 그것을, 없으면 메모리(앱을 끄면 잊는다) */
export type AttStorage = {
    getItem: (key: string) => string | null | undefined | Promise<string | null | undefined>;
    setItem: (key: string, value: string) => void | Promise<void>;
};
/** 시트 문구 — 기본값은 아래 `ATT_SHEET_TEXTS`. `{appName}` 자리는 앱 이름으로 바뀐다 */
export type AttSheetTexts = {
    title: string;
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
/** 기본 문구 — 「」 는 문장 안의 인용 부호만 남기고, 제목·본문·버튼 글자의 바깥 짝은 뺐다 */
export declare const ATT_SHEET_TEXTS: Readonly<AttSheetTexts>;
/** 문구를 합친다 — 덮어쓴 값이 있으면 그것을, 셋째 줄의 `{appName}` 을 앱 이름으로 바꾼다 */
export declare function attSheetTexts(appName: string, overrides?: Partial<AttSheetTexts>): AttSheetTexts;
/** 로컬 달력 날짜(YYYY-MM-DD) — 「하루 한 번」은 기기 시간대의 자정 기준이다 */
export declare function localDay(d: Date): string;
/**
 * 무엇을 할지 — 기기 없이 판단하는 순수 함수.
 * - Android·웹 등 iOS 가 아니면 아무것도 안 한다.
 * - 미정이면 시스템 창을 띄운다(시트는 안 띄운다). 두 경로 모두 같다.
 * - 거부·제한이면: 오퍼월은 매번 시트, 앱 켜기는 오늘 아직 안 보였을 때만 시트.
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
export declare const memoryStorage: AttStorage;
/** 현재 상태를 읽는다 — 실패하면 `unknown`(던지지 않는다) */
export declare function readStatus(tracking: TrackingModule): Promise<AttStatus>;
/** 시스템 ATT 창을 띄우고 결과 상태를 돌려준다(창이 없으면 미정 그대로) */
export declare function requestStatus(tracking: TrackingModule): Promise<AttStatus>;
/** 판단에 쓰는 기기 값 묶음 — 시험에서는 가짜를 넣는다 */
export type AttDeps = {
    os: string;
    tracking: TrackingModule | null;
    storage: AttStorage;
    today: () => string;
    /** 시스템 창을 띄우기 직전(앱이 앞에 올라올 때까지 기다리는 자리) — 기본은 없음 */
    beforeRequest?: () => Promise<void>;
};
/**
 * 앱 켤 때 — 「시트를 띄울지」를 돌려준다(`show`). 미정이면 시스템 창을 여기서 띄우고 `none`.
 * 시트를 띄우기로 하면 저장소에 오늘 날짜를 먼저 적는다.
 */
export declare function launchCheck(d: AttDeps): Promise<AttAction>;
/** 시트를 여는 자리 — 마운트된 `AttDeniedSheet` 가 등록한다. `done` 은 시트가 닫히면 부른다 */
export type AttSheetOpener = (done: () => void) => void;
export declare function setAttSheetOpener(f: AttSheetOpener | null): void;
/**
 * 오퍼월에 들어가기 전 — 추적 허용 상태를 확인하고 필요하면 안내/시스템 창을 띄운 뒤 **결과 상태**를 돌려준다.
 * - 미정: 시스템 창을 띄우고 그 결과를 돌려준다(시트는 안 띄운다).
 * - 거부·제한: 시트를 띄우고, 닫히면 다시 읽은 상태를 돌려준다. 시트가 안 붙어 있으면 그 상태를 바로 돌려준다.
 * - 허용 · Android · 모듈 없음: 바로 돌려준다.
 */
export declare function ensureTrackingBeforeOfferwallWith(d: AttDeps, opener: AttSheetOpener | null): Promise<AttStatus>;
/** 앱이 오퍼월에 들어가기 전에 부른다 — 실제 기기 값과 마운트된 시트를 쓴다 */
export declare function ensureTrackingBeforeOfferwall(storage?: AttStorage): Promise<AttStatus>;
