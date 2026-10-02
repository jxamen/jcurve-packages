/**
 * 틱톡 광고 전환(TikTok Business SDK) — **광고는 전부 이 패키지**(1.7, 2026-10-02 대표님 「TikTok까지 패키지로 … 광고는 다」).
 * 앱총괄이 10개 앱에 따로 넣은 코드(당근캐시 release/tiktok 이 본보기)를 옮겼다. 앱마다 다른 것은 **설정 그룹 이름**뿐이다.
 *
 * 보내는 것:
 *  ① 설치 · 실행 — SDK 가 스스로 센다(InstallApp · LaunchAPP). 그래서 **앱이 켜질 때** 켠다(`boot`) — 로그인 전 설치가 핵심.
 *  ② 보상형 광고 열람(InAppADImpr) — `createRewarded({ tiktok })` 이면 광고가 열린 순간 패키지가 보낸다(앱 코드 없음).
 *  ③ 가입(Registration) · 로그인 — `track('signup_done' | 'login_done')`. 앱만의 이벤트는 `events` 로 더한다.
 *  ④ 회원 — `identify(회원번호)` 만(이름 · 전화 · 이메일은 보내지 않는다), `logout()`.
 *
 * **열쇠와 틱톡 앱 ID 는 번들에 굽지 않는다** — 어드민 「앱 설정」(custom)의 `{그룹}.tiktok_sdk_access` ·
 * `{그룹}.tiktok_android_sdk_access`(없으면 공용) · `{그룹}.tiktok_app_id_ios` · `{그룹}.tiktok_app_id_android` 를
 * 켤 때 읽는다(새 빌드 없이 재발급 · 교체). 시크릿이나 그 플랫폼 ID 가 비면 그 플랫폼은 꺼져 있다(앱은 그대로 돈다).
 *
 * **ATT 창은 여기서 띄우지 않는다** — 켜는 순간 설치가 나가므로 iOS 는 `waitForTracking`(보통 `ads.requestTracking`)의
 * 답을 기다린 뒤 켠다(30초 상한). 같은 약속이라 창이 두 번 뜨지 않는다. 안드로이드는 기다리지 않는다.
 *
 * **네이티브 모듈이 없는 빌드에서도 같은 JS 가 돈다**(OTA 로 옛 빌드에 내려가도) — 모듈이 없으면 전부 아무 일도 안 한다.
 * 인앱 결제 자동 추적은 네이티브에서 끈다(안드 `disableAutoIapTrack`).
 */
import { type StandardKey, type TikTokCall } from './tiktok.map';
export type TikTokNative = {
    initialize(accessToken: string, appId: string, tiktokAppId: string, debug: boolean): Promise<string | null>;
    trackStandard(key: StandardKey): void;
    trackCustom(name: string, properties?: Record<string, string | number | boolean>): void;
    identify(externalId: string, userName: string | null, phone: string | null, email: string | null): void;
    logout(): void;
    updateAccessToken(accessToken: string): void;
};
export type TikTokOptions = {
    /** 어드민 「앱 설정」 그룹 이름 — `carrot` 이면 `carrot.tiktok_sdk_access` … 를 읽는다 */
    group: string;
    /** 앱스토어 앱 번호(공개 값). 비면 app.json `extra.appleAppId` */
    appleAppId?: string;
    /** 안드로이드 패키지 이름. 비면 app.json `extra.androidPackage` */
    androidPackage?: string;
    /** 시험 빌드 — 켜면 SDK 디버그 모드 · 테스트 이벤트 코드를 콘솔에 찍는다. 보통 `isTestAds(...)` 와 같은 값 */
    test?: boolean;
    /** iOS: 켜기 전에 기다릴 ATT 답 — 보통 `ads.requestTracking` */
    waitForTracking?: () => Promise<unknown>;
    /** 앱만의 이벤트 — 예: 당근 `(n, p) => n === 'harvest_done' && p?.daily ? { custom: 'WeeklyMission' } : null` */
    events?: (name: string, params?: Record<string, unknown>) => TikTokCall | null | undefined;
};
export type TikTok = {
    /** 어드민 custom values 를 받아 켠다 — 여러 번 불러도 된다(처음 한 번만 켜고, 열쇠가 바뀌면 바꿔 끼운다) */
    start: (values: Record<string, unknown> | null | undefined) => void;
    /**
     * 앱 루트가 켤 때 한 번 — `load` 로 custom 값을 읽어 `start`, 앞으로 올 때마다 다시 읽는다(열쇠 교체).
     * `load` 는 인증 없는 공개 설정 조회여야 한다(로그인 전 설치를 잡으려고).
     */
    boot: (load: () => Promise<Record<string, unknown> | null | undefined>) => void;
    /** 앱 이벤트 이름 — 틱톡이 받는 것만 보낸다(가입 · 로그인 + `events`) */
    track: (name: string, params?: Record<string, unknown>) => void;
    /** 보상형 광고가 화면에 뜬 순간 — `createRewarded({ tiktok })` 이면 패키지가 부른다 */
    adImpression: () => void;
    /** 로그인 · 세션 복원 — 회원 번호만 */
    identify: (memberId: string | number | null | undefined) => void;
    logout: () => void;
    /** 지금 켜져 있나(시험 · 화면 표시용) */
    isOn: () => boolean;
};
type AppStateLike = {
    addEventListener: (t: 'change', fn: (s: string) => void) => unknown;
};
/** 기기와 닿는 것 — **시험에서만** 갈아 끼운다 */
export type TikTokEnv = {
    native: () => TikTokNative | null;
    os: () => string;
    extra: () => Record<string, unknown>;
    appState: () => AppStateLike | null;
    log: (...a: unknown[]) => void;
};
export declare function createTikTok(opts: TikTokOptions, env?: TikTokEnv): TikTok;
export {};
