export declare const SNAPPLAY_PROVIDER_ID = "snapplay";
/** 스냅플레이 RN 플러그인이 내놓는 네이티브 모듈 이름(Android `getName()` · iOS `RCT_EXPORT_MODULE()` 가 같다). */
export declare const SNAPPLAY_NATIVE_MODULE = "S2OfferwallModule";
export declare const SNAPPLAY_DEFAULT_PLACEMENT = "main";
export declare const SNAPPLAY_INIT_TIMEOUT_MS = 10000;
/** 서버가 앱마다 · OS 마다 주는 값. 앱 ID 가 없는 OS 에서는 제공자가 꺼진다. */
export type SnapPlayServerConfig = {
    android: string;
    ios: string;
    placement: string;
    enabled: boolean;
};
/**
 * 서버 응답 → 설정. `{ ok: true, config: { android: { appId }, ios: { appId }, placement?, enabled? } }` 모양을 받고, `config` 없이 같은 칸이 바로 와도,
 * `appId` 대신 `mediaKey` 라고 와도, OS 값이 문자열 하나여도 읽는다. `ok:false` · 앱 ID 가 둘 다 없음 · 모양이 다름이면 null.
 */
export declare function parseSnapPlayConfig(data: unknown): SnapPlayServerConfig | null;
/** 앱이 설정 값을 직접 넣을 때(시험 · 서버 없이 쓰는 앱). 모양은 `parseSnapPlayConfig` 와 같다. 못 읽으면 설정을 비운다. */
export declare function configureSnapPlay(raw: unknown): boolean;
/** 이 빌드에 스냅플레이 네이티브 모듈이 들어 있는가 — `NativeModules` 속성 조회뿐, `require` 없음. */
export declare function hasSnapPlayNative(): boolean;
export type SnapPlayStatus = {
    native: boolean;
    configured: boolean;
    enabled: boolean;
    hasAppId: boolean;
    initialized: boolean;
    placement: string;
};
/** 진단용(값은 내보내지 않는다): 네이티브 모듈이 있는지 · 설정이 왔는지 · 이 OS 의 앱 ID 가 있는지 · 초기화가 끝났는지. */
export declare function snapPlayStatus(): SnapPlayStatus;
/**
 * 서버 설정을 받아 둔다 — `fetcher` 는 앱이 준다(앱 서버 주소 · 토큰을 패키지가 모르게): `content/config/snapplay` 응답 JSON 을 돌려준다.
 * 이미 설정이 있으면 다시 받지 않는다. 실패하면 조용히 그대로(탭이 안 나올 뿐). 네이티브 모듈이 없는 빌드에서는 받지도 않는다.
 */
export declare function resolveSnapPlayConfig(fetcher: () => Promise<unknown>): Promise<SnapPlayStatus>;
/** 로그아웃 · 회원 바뀜: SDK 에 남은 회원을 지운다(초기화한 적이 없으면 아무것도 안 한다). `resetOfferwall()` 이 부른다. */
export declare function forgetSnapPlayUser(): void;
/** 설정까지 모두 비운다(앱 바뀜 · 시험). SDK 초기화 상태는 프로세스가 사는 동안 유지된다. */
export declare function resetSnapPlay(): void;
