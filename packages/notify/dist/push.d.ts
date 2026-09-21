/**
 * 원격 푸시 — 기기 토큰 등록·끄기, 알림을 눌렀을 때 열람 보고·링크 열기(1.1, 꼬꼬농장 방식).
 *
 * 로그인 세션이 생기면 **기기 토큰**(`getDevicePushTokenAsync` — 안드로이드는 FCM, 아이폰은 APNs)을
 * 서버(`POST {app}/push/register`)에 올린다. **서버가 FCM·APNs 로 직접 보낸다** — Expo 중계를 거치지
 * 않는다(2026-09-22 오너 결정: 한 단계 덜 거치고, 우리 키를 Expo 에 올리지 않고, 규모가 커져도 Expo 의
 * 초당 600건 제한에 막히지 않게). 옛 판이 올린 Expo 토큰은 기기 토큰이 들어오는 순간 서버가 끈다.
 *
 * ⚠ **서버에 그 앱의 FCM 키가 먼저 있어야 한다**(`/www/jcurve/secrets/<슬러그>-fcm.json`). 없는 채로
 * 이 판을 내면 안드로이드 푸시가 끊긴다 — 옛 Expo 토큰은 꺼지고 기기 토큰으로는 보낼 수 없어서.
 *
 * 어드민이 캠페인을 쏘면 알림 data 에 `campaignId`·`url` 이 실려 오고, 알림을 누르면 열람을 보고
 * (`/push/open` — 어드민 열람 수)하고 링크를 연다.
 *
 * 앱이 켜져 있을 때 온 알림을 배너로 보여 주는 것은 `createNotify().init()` 이 한다 — 둘 다 부른다.
 * 네이티브 모듈은 지연 `require` 로만 집는다 — 옛 빌드에서 OTA 가 죽지 않게.
 */
/** 기기와 닿는 것 — **시험에서만** 갈아 끼운다 */
export type PushEnv = {
    notifications: () => any | null;
    platform: () => string;
    fetch: (url: string, init: {
        method: string;
        headers: Record<string, string>;
        body: string;
    }) => Promise<unknown>;
    openUrl: (url: string) => void;
};
export type PushDeps = {
    /** API 주소 — `https://api.j-curve.co.kr/v1/{앱}`. 순환 import 가 있는 앱은 getter 로 준다 */
    base: string;
    /** 앱 토큰(`X-App-Token`) */
    appToken: string;
    /**
     * 서버 세션 토큰 — **서버에 있는 세션만** 준다. 없거나 데모 세션이면 비워 둔다
     * (그때는 서버에 아무것도 보내지 않는다).
     */
    session: () => string | null | undefined;
    /**
     * 이 계정이 알림 받기에 동의했는가. 기기 권한은 폰에 붙어 있어서, 한 폰으로 계정을 바꾸면
     * 권한만으로는 새 계정의 뜻을 알 수 없다(꼬꼬농장 2026-09-14 — 계정마다 따로 묻는다).
     */
    consent?: () => boolean | Promise<boolean>;
};
export type Push = {
    /** 앱 시작에 한 번 — 알림을 눌렀을 때를 걸고, 알림으로 켜진 경우도 처리한다 */
    init: () => void;
    /** 세션이 생겼을 때·동의했을 때 — 권한이 있으면 기기 토큰을 서버에 올린다(권한 요청은 하지 않는다) */
    register: () => Promise<void>;
    /** 이 계정은 알림을 원하지 않는다 — 서버에 걸린 이 회원의 토큰을 끈다 */
    unregister: () => Promise<void>;
    /** 로그인이 복원된 뒤 한 번 — 알림으로 켜져 들고 있던 열람 보고를 보낸다 */
    flushOpen: () => void;
};
export declare function createPush(deps: PushDeps, env?: PushEnv): Push;
