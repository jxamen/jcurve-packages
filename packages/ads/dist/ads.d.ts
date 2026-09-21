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
     * 구글 테스트 광고를 쓸까 — 보통 `isTestAds(process.env.EXPO_PUBLIC_ADMOB_TEST)`.
     * 개발 실행(`__DEV__`)은 이 값과 무관하게 테스트 광고다.
     */
    test: boolean;
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
    /** 못 봤다 — 보상을 주지 말고 남은 횟수도 깎지 않는다 */
    onFail: (msg: string) => void;
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
    /** 안내 팝업이 뜨는 순간 미리 받아 둔다 — **앱 시작에는 부르지 않는다**(발열) */
    warm: (userId?: string, customData?: string, interstitial?: boolean) => void;
    /** 미리 받아 둔 광고가 바로 열 수 있는가 — 대기 화면을 띄울지 정한다 */
    warmReady: (userId?: string, customData?: string, interstitial?: boolean) => boolean;
    /** 기다리기를 그만둔다(대기 화면의 「그만두기」) — 실패로 세지 않는다 */
    cancel: () => void;
    /** 광고 자리를 접어 둔 시간이 얼마나 남았나 — 0 이면 평소대로 */
    mutedMs: () => number;
    /** iOS 추적 허용(ATT)을 한 번만 묻는다 — 미션 제출 중간에 창이 뜨지 않게 미리 부를 수 있다 */
    requestTracking: () => Promise<void>;
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
