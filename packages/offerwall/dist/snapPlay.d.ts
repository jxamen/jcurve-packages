/**
 * 0.5.0 — 스냅플레이(SnapPlay) 오퍼월 제공자. 찬스 화면의 「찬스2」 탭이 이것이다. SDK 는 `react-native-s2offerwall`(네이티브 모듈 `S2OfferwallModule`)이고
 * **스토어 빌드에 들어가야** 쓸 수 있다. 이 파일은 JS 라서 OTA 로 나가도 되고, 네이티브가 없는 옛 빌드에서는 제공자가 「쓸 수 없음」이라 탭이 나오지 않는다.
 *
 * 지키는 것:
 *  - 모듈 유무는 `NativeModules` 속성 조회로만 본다. 없으면 `require('react-native-s2offerwall')` 도 하지 않는다(그 패키지는 모듈이 없으면 불러오는 순간 던진다).
 *  - 앱 ID 는 서버 설정에서 읽는다(`resolveSnapPlayConfig`) — 앱 안에 박지 않는다. 콜백 키(`verify_cd` 검증용)는 서버만 알고 앱에는 오지 않는다.
 *  - 회원 식별값(`setUserName`)은 오퍼월 별칭 `usn`(64자 SHA256 hex) — 실제 회원 번호 · 전화번호 · 이메일이 아니다.
 *  - SDK 순서: 앱 ID → 이벤트 듣기(`onInitCompleted` · `onLoginRequested`) → `initSdk()` → 초기화 완료 → `setUserName` → `showOfferwall`.
 *    (iOS 모듈은 JS 가 듣기 시작한 뒤에만 이벤트를 내보낸다 — 듣기가 `initSdk()` 보다 먼저여야 한다.)
 *  - `removeAllListeners()` 는 부르지 않는다(앱의 다른 SDK 이벤트까지 지워진다). ATT 창(`presentATTPopup`)도 부르지 않는다 — 광고 패키지가 이미 앱 시작에 띄운다.
 *  - 앱 리워드 광고(`onRewardedAdRequested`)는 연결하지 않는다: 안 달면 SDK 가 알아서 「광고 없음」으로 답하고 웹 광고로 넘어간다.
 */
import { type ChanceContext } from './chanceProviders';
export declare const SNAPPLAY_PROVIDER_ID = "snapplay";
/** 스냅플레이 RN 플러그인이 내놓는 네이티브 모듈 이름(Android `getName()` · iOS `RCT_EXPORT_MODULE()` 가 같다). */
export declare const SNAPPLAY_NATIVE_MODULE = "S2OfferwallModule";
export declare const SNAPPLAY_DEFAULT_PLACEMENT = "main";
export declare const SNAPPLAY_INIT_TIMEOUT_MS = 10000;
/** 0.6.0 — the native view (`JCurveSnapPlayViewManager`, Android + iOS) that shows SnapPlay's own screen inside the tab. Only in builds made with 0.6.0 and the SnapPlay SDK. */
export declare const SNAPPLAY_VIEW_NAME = "JCurveSnapPlayView";
/** 서버가 앱마다 · OS 마다 주는 값. 앱 ID 가 없는 OS 에서는 제공자가 꺼진다. */
export type SnapPlayServerConfig = {
    android: string;
    ios: string;
    placement: string;
    enabled: boolean;
    /** 0.6.0 — `false` 면 탭 안에 끼우지 않고 전체 화면(모달)으로 연다(서버에서 끄는 스위치; 기본 true) */
    embed: boolean;
    /**
     * 0.6.2 — 광고 목록 읽기 · 추천 미션 직접 열기에 쓰는 플레이스먼트. 스냅플레이 문서가 목록용으로 "main" 을 못 쓰게 해서, 콘솔에서 따로 만든 이름을 서버가 `listPlacement` 로 준다.
     * 비어 있으면 직접 열기는 꺼지고(찬스2 탭으로만 보냄) 목록도 읽지 않는다.
     */
    listPlacement: string;
    /**
     * 0.6.8 — 찬스2 를 이 회원에게 연다(서버의 허용 목록 · 테스트 회원). 없거나 `true` 가 아니면 닫힘: 탭은 「준비 중입니다」 만 보여 준다.
     * 설정은 앱이 받을 때 한 번 정해지니, 회원을 넣거나 빼면 그 뒤 앱을 다시 열어야 한다.
     */
    open: boolean;
};
/**
 * 서버 응답 → 설정. `{ ok: true, config: { android: { appId }, ios: { appId }, placement?, enabled? } }` 모양을 받고, `config` 없이 같은 칸이 바로 와도,
 * `appId` 대신 `mediaKey` 라고 와도, OS 값이 문자열 하나여도 읽는다. `ok:false` · 앱 ID 가 둘 다 없음 · 모양이 다름이면 null.
 */
export declare function parseSnapPlayConfig(data: unknown): SnapPlayServerConfig | null;
/** 앱이 설정 값을 직접 넣을 때(시험 · 서버 없이 쓰는 앱). 모양은 `parseSnapPlayConfig` 와 같다. 못 읽으면 설정을 비운다. */
export declare function configureSnapPlay(raw: unknown): boolean;
/** 0.6.12: the app is in the foreground. Without AppState (tests, odd hosts) it counts as active. */
export declare function appIsActive(): boolean;
/** 이 빌드에 스냅플레이 네이티브 모듈이 들어 있는가 — `NativeModules` 속성 조회뿐, `require` 없음. */
export declare function hasSnapPlayNative(): boolean;
export type SnapPlayStatus = {
    native: boolean;
    configured: boolean;
    enabled: boolean;
    hasAppId: boolean;
    initialized: boolean;
    placement: string; /** 0.6.2 — 목록 읽기 · 직접 열기가 가능한가(플러그인에 Data API 가 있고 서버가 `listPlacement` 를 줬다) */
    directOpen: boolean;
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
/** SDK 의 Data API 가 주는 광고 한 건(필요한 칸만). `advId` 가 캠페인 키이고 `openAdItem` 에 그대로 쓴다. */
export type SnapPlayAd = {
    advId: string;
    title: string;
    description: string;
    /** 목록의 `user_pnt`(사용자 적립 포인트) — 전환 비율이 이미 반영된 값인지는 문서에 없다. 실기기에서 같은 광고의 화면 표시와 비교해 확인한다. */
    points: number;
    /** `org_user_pnt` — 2배 이벤트 같은 때의 원래 값(없으면 `points`) */
    originalPoints: number;
    unit: string;
    icon: string;
    feed: string;
    advType: number;
    actionType: number;
    actions: number;
    /** `detail_yn === 'Y'`: 상세 화면이 있다(`openAdItem` 의 `needDetail`) */
    detail: boolean;
    /** `adid_yn === 'Y'`: 광고 ID 가 있어야 참여할 수 있는 광고 */
    needsAdid: boolean;
};
export declare const SNAPPLAY_LIST_TIMEOUT_MS = 6000;
/** 읽은 목록을 이만큼(ms) 다시 쓴다 — 미션을 연달아 누를 때마다 SDK 를 부르지 않게. */
export declare const SNAPPLAY_LIST_TTL_MS = 60000;
/**
 * `requestOfferwallData` 의 JSON 문자열(또는 이미 읽은 객체) → 광고 목록. `ret_cd` 가 0 이 아니거나 `ret_list` 가 배열이 아니면 null(= 목록을 못 읽음, 빈 목록과 다르다).
 * 광고 번호가 없거나 제목이 없는 건은 버리고, 같은 번호는 한 번만, 최대 500건.
 */
export declare function parseSnapPlayAds(raw: unknown): SnapPlayAd[] | null;
export type SnapPlayAdsResult = {
    ok: true;
    ads: SnapPlayAd[];
    cached: boolean;
} | {
    ok: false;
    reason: 'unsupported' | 'not_ready' | 'invalid_usn' | 'list_failed';
};
/**
 * 스냅플레이 SDK 에서 지금 참여할 수 있는 광고 목록을 읽는다(`requestOfferwallData(listPlacement, false)` = 전체 목록). 먼저 SDK 를 준비한다(앱 ID · 회원).
 * 같은 목록을 `SNAPPLAY_LIST_TTL_MS` 동안 다시 쓰고, 동시에 부르면 한 번만 읽는다. 목록은 OS · 기기에 따라 다르다. 던지지 않는다.
 */
export declare function readSnapPlayAds(context?: ChanceContext, opts?: {
    fresh?: boolean;
}): Promise<SnapPlayAdsResult>;
export type SnapPlayOpenResult = {
    ok: true;
    listCount: number;
}
/** `gone`: 방금 읽은 최신 목록에 그 광고가 없다(마감되었거나 이 기기에 해당 없음). `unsupported`/`list_failed`/`not_ready`/`invalid_usn`/`sdk_error`: 직접 열 수 없었다 — 앱은 찬스2 탭 목록으로 안내한다. */
 | {
    ok: false;
    reason: 'unsupported' | 'not_ready' | 'invalid_usn' | 'list_failed' | 'gone' | 'sdk_error';
    listCount: number;
};
/**
 * 추천 미션 → 그 광고의 SDK 화면(`openAdItem`). 광고 번호가 방금 읽은 목록에 있는지 먼저 본다 — 목록에서 상세 화면 여부(`detail_yn`)를 알아야 하고, 없으면 마감으로 본다.
 * 캐시된 목록에 없으면 한 번 새로 읽고 나서 판단한다. SDK 가 화면을 열었는지는 돌려주지 않으므로 `ok` 는 「열기를 요청했다」까지다. 던지지 않는다.
 */
export declare function openSnapPlayAd(advId: string | number, context?: ChanceContext): Promise<SnapPlayOpenResult>;
/** 이 빌드에 스냅플레이 화면 뷰가 있는가 — `UIManager` 의 뷰 목록 조회뿐(없으면 false, 던지지 않음). */
export declare function snapPlayViewAvailable(): boolean;
/** 스냅플레이 화면을 끼워 넣는 네이티브 뷰. `prepare`(SDK 시작 · 회원 설정) 뒤에 그린다. */
export declare function SnapPlayView({ onClose, style }: {
    onClose?: () => void;
    style?: unknown;
}): import('react').ReactElement | null;
