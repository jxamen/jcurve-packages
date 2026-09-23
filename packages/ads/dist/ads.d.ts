/** 플랫폼마다 따로인 광고 단위 ID */
export type AdUnits = {
    android?: string;
    ios?: string;
};
export type AdsOptions = {
    units: {
        /** 보상형 — 「광고 보고 받기」 */
        rewarded: AdUnits;
        /** 보상형 전면 — 안내 카운트다운 뒤 저절로 시작하는 것(없으면 안 쓴다) */
        rewardedInterstitial?: AdUnits;
    };
    /**
     * 구글 테스트 광고를 쓸까 — 보통 `isTestAds(process.env.EXPO_PUBLIC_ADMOB_TEST, testDevices.length > 0)`.
     * 개발 실행(`__DEV__`)은 이 값과 무관하게 테스트 광고다.
     */
    test: boolean;
    /**
     * 애드몹 테스트 기기 ID(1.1, 당근캐시). 여기 적힌 기기는 **실제 광고 단위로도 테스트 광고**를 받는다 —
     * 검수 기기에 실광고가 뜨면 정책 위반이고, 실단위라야 SSV 가 와서 보상 흐름을 끝까지 시험할 수 있다.
     * ID 는 그 기기에서 광고를 한 번 요청하면 로그에 찍힌다(`testDeviceIdentifiers = @[ @"…" ]`). 서명 키마다 다르다.
     */
    testDevices?: string[];
    /**
     * 기기 ID 를 돌려주는 함수(선택) — 주면 SSV 값(`customData`)에 **`dev` 로 함께 실어 보낸다**(1.5, 2026-09-23).
     *
     * 광고 기록에 회원번호밖에 없어 「한 사람이 많이 보는가, 계정이 여럿인가」를 가릴 수 없었다.
     * 앱이 **이미 만들어 둔** 값을 받아 쓸 뿐이라 새로 걷는 항목이 아니고, 광고 식별자(adid)도 아니다.
     * 보통 `device: funnel.deviceId`(`@jcurve/auth`). 빈 문자열이면 그 광고만 그냥 나간다.
     */
    device?: () => string;
    /**
     * 광고 식별자(IDFA/광고 ID)를 SSV 값에 `adid` 로 실을까(1.5). **기본은 끄기.**
     *
     * 서버가 이것으로 **폰 하나당 하루 몇 회**를 전 앱 합산해 센다 — 앱이 스스로 만든 기기 ID 는
     * 앱을 넘지 못해 합산이 안 된다. 새로 걷는 항목은 아니지만(미션이 이미 쓴다) **쓰는 목적이 늘어난다** —
     * 그래서 **개인정보처리방침에 「부정 이용 방지·전체 하루 상한 합산에 쓴다」가 들어간 앱만** 켠다.
     * 추적을 껐거나 iOS 미동의면 값이 없고, 그때는 싣지 않는다(서버도 그런 기기는 막지 않는다).
     */
    adid?: boolean;
};
export type ShowOptions = {
    /** 서버 보상 확인(SSV)에 실을 회원 번호 — 둘러보기면 비운다 */
    userId?: string;
    /** SSV 에 같이 실을 값(무엇에 대한 보상인지). 미리 받아 둔 광고는 이 값까지 같아야 쓴다 */
    customData?: string;
    /** 보상형 전면으로 띄울까 */
    interstitial?: boolean;
    /** 끝까지 봤다 — 광고가 아직 전체화면일 때 온다(연출은 onClosed 뒤에) */
    onEarned: () => void;
    /**
     * 못 봤다 — 보상을 주지 말고 남은 횟수도 깎지 않는다.
     *
     * `noAd` 는 **광고가 열리지도 않았다**(재고 없음·로드 실패·시간 초과)는 뜻이다(1.1, 당근캐시). 중간에 닫은 것
     * (`noAd: false`)과 가를 자리가 있다 — 이미 번 것을 꺼내는 동작은 광고를 못 띄웠다는 이유로 잠그면 안 되고,
     * 중간에 닫은 것은 멈춰야 한다. 인자 하나만 받는 함수를 줘도 된다.
     */
    onFail: (msg: string, noAd: boolean) => void;
    onClosed?: () => void;
    onOpened?: () => void;
};
export type Rewarded = {
    /** 실제 광고를 띄울 수 있는 빌드인가(Expo Go·웹은 거짓 — 앱이 목업으로 넘어간다) */
    available: boolean;
    /** 보상형 전면을 띄울 수 있는가 */
    interstitialAvailable: boolean;
    /** 광고를 띄운다. 이미 하나가 도는 중이라 시작하지 못하면 거짓 */
    show: (o: ShowOptions) => Promise<boolean>;
    /**
     * **(1.2) 아무것도 하지 않는다** — 광고를 미리 받지 않는다(2026-09-22 사용자 결정 「미리 받아 오는 거 없애자」).
     * 받아 두고 안 보여 준 광고는 AdMob 에 요청만 있고 노출이 없는 것으로 쌓인다. 부르는 앱이 깨지지 않게 이름만 남겼다.
     */
    warm: (userId?: string, customData?: string, interstitial?: boolean) => void;
    /** (1.2) 늘 거짓 — 미리 받아 두지 않으므로. 대기 화면은 늘 뜬다 */
    warmReady: (userId?: string, customData?: string, interstitial?: boolean) => boolean;
    /** 기다리기를 그만둔다(대기 화면의 「그만두기」) — 실패로 세지 않는다 */
    cancel: () => void;
    /** 광고 자리를 접어 둔 시간이 얼마나 남았나 — 0 이면 평소대로 */
    mutedMs: () => number;
    /**
     * iOS 추적 허용(ATT)을 묻는다 — **앱을 켤 때 앱 루트가 한 번 부른다**(1.3). 광고를 열 때도 부르지만 그것만으로는
     * 심사자가 창을 못 찾는다(용돈캡슐 2026-09-21 거절 「iOS 27 에서 ATT 창을 찾을 수 없다」).
     * 앱이 앞에 올라온 뒤 0.6초 기다렸다 묻고, 창 없이 넘어가면(답이 미정) 다음 호출에 다시 묻는다.
     * 알림 권한 창과 겹치면 ATT 가 창 없이 끝난다 — 알림을 묻기 전에 이 약속을 기다린다.
     */
    requestTracking: () => Promise<void>;
    /**
     * 광고 식별자(IDFA · AAID) — **읽기만 한다**(1.4). ATT 는 묻지 않는다 — 묻는 것은 `requestTracking` 이 켤 때 한다.
     * iOS 는 추적을 허용했을 때만 값, 안드로이드는 그대로. 초기화된 식별자(0000-…)·시뮬레이터는 null.
     * 미션 매체가 참여자를 가리는 데 쓴다(당근·영테크·용돈캡슐·캐시팡이 각자 들고 있던 adid.ts — 그중 몇은 여기서
     * ATT 를 따로 물어 심사 기준과 어긋났다).
     */
    advertisingId: () => Promise<string | null>;
};
type AppStateLike = {
    currentState: string;
    addEventListener: (t: 'change', fn: (s: string) => void) => {
        remove: () => void;
    };
};
/** 기기와 닿는 것 — **시험에서만** 갈아 끼운다 */
export type AdsEnv = {
    sdk: () => any | null;
    tracking: () => any | null;
    os: () => string;
    appState: () => AppStateLike | null;
    dev: () => boolean;
};
export declare function createRewarded(opts: AdsOptions, env?: AdsEnv): Rewarded;
export {};
