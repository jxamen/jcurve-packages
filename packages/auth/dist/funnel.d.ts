/**
 * 가입 퍼널을 **우리 서버**(jcurve-api `{app}/funnel`)에 남긴다.
 *
 * GA4 에 가는 같은 이벤트를 조회 권한 없이도 볼 수 있어야 해서다 — 설치 79건에 가입 20명일 때
 * 어디서 멈추는지(앱을 안 열었는지·로그인 화면에서 떠났는지) 서버 기록만으로는 알 수 없었다
 * (꼬꼬농장 2026-09-15).
 *
 * **앱마다 이름이 같아야 한다.** 어드민의 「시간대별 가입 비교」·퍼널은 이 이름으로 앱을 나란히
 * 놓는다. 앱마다 `login_click`·`tap_login` 처럼 제각각이면 비교가 깨진다 — 그래서 로그인과 한
 * 패키지에 둔다.
 *
 * **개인정보를 보내지 않는다** — 설치 때 만든 난수 기기 ID·단계·플랫폼·앱 버전·짧은 꼬리표뿐.
 * 실패해도 조용히 넘긴다(계측이 앱을 막으면 안 된다).
 */
/**
 * 서버가 받는 이벤트 — **jcurve-api `FunnelController::EVENTS` 와 같아야 한다.**
 *
 * 여기 없는 이름은 보내지 않는다. 서버에 없는 이름을 보내면 400 으로 버려지는데, 앱에서는
 * 아무 오류도 안 보여 「그 단계만 조용히 비어 있다」로만 드러난다.
 */
export declare const FUNNEL_EVENTS: readonly string[];
/**
 * 개인정보처럼 보이는 값인가 — 이메일(@) 이나 숫자가 7개 넘게 이어진 것(전화번호·회원번호).
 *
 * 「개인정보를 보내지 않는다」가 약속뿐이면 언젠가 누가 `reason` 에 번호를 넣는다(Codex #9).
 * 완전한 차단은 아니다 — **눈에 띄는 것**만 막는다. 이름 같은 것은 부르는 쪽이 넣지 않아야 한다.
 */
export declare function looksPersonal(v: string | number): boolean;
/** AsyncStorage 모양 — 앱의 것을 그대로 준다 */
export type KeyValue = {
    getItem: (k: string) => Promise<string | null>;
    setItem: (k: string, v: string) => Promise<void>;
};
export type FunnelDeps = {
    /** 예: `https://api.j-curve.co.kr/v1/kkokkofarm` */
    base: string;
    /** 앱 공개 토큰(`X-App-Token`) */
    appToken: string;
    storage: KeyValue;
    /**
     * 저장 키 — **이미 쓰던 앱은 쓰던 이름을 그대로 준다.**
     *
     * 이름이 바뀌면 모든 기기가 새 ID 를 받아 **하루에 전 사용자가 「첫 실행」으로 찍힌다.**
     * 기본값은 새 앱용이다.
     */
    keys?: {
        device?: string;
        installRef?: string;
    };
    /**
     * 이 기능이 나오기 **전부터** 쓰던 사람인가 — 그러면 기기 ID 가 없어도 첫 실행으로 세지 않는다.
     *
     * 앱마다 알아보는 방법이 다르다(로그인 세션·앱 소개를 본 기록 등). 안 주면 기기 ID 가 없는
     * 사람을 모두 새 설치로 본다 — **새 앱에서만** 그래도 된다.
     */
    existingUser?: () => Promise<boolean>;
};
export type Funnel = {
    /** 퍼널 이벤트면 보낸다. `prop` 은 제공자·사유 같은 한 토막(영문·숫자·`_:.-`, 40자) */
    event: (name: string, prop?: string) => void;
    /** 앱 실행마다 한 번 — 설치 후 첫 실행이면 `first_open` 도, 안드로이드면 설치 출처도 한 번 */
    appOpen: () => void;
    /**
     * 이 기기 ID — **동기로** 꺼낸다. 아직 안 읽혔으면 `''`.
     *
     * 광고 기록에 함께 남기려고 연다(`@jcurve/ads` 의 `device`). 광고를 여는 순간 값을 만들어야 해서
     * 기다릴 수가 없다 — 그래서 없으면 빈 문자열을 주고 **그 광고만 기기 ID 없이** 나간다(다음 광고부터 실린다).
     * 새로 걷는 값이 아니다. 퍼널이 이미 만들어 저장해 둔 임의의 문자열이고 광고 식별자(adid)가 아니다.
     */
    deviceId: () => string;
};
/** 기기와 닿는 것 — 시험에서만 갈아 끼운다 */
export type FunnelEnv = {
    os: () => string;
    appVersion: () => string;
    post: (url: string, headers: Record<string, string>, body: string) => Promise<boolean>;
    /** 안드로이드 설치 시각·리퍼러. 모듈이 없으면 null */
    install: () => Promise<{
        at: number;
        ref: string;
    } | null>;
    now: () => number;
    random: () => string;
};
/**
 * 퍼널에 적을 앱 버전 — OTA 런타임 버전이 있으면 그것, **없으면 앱 설정의 버전**(2.1.1).
 * OTA 가 꺼진 빌드는 runtimeVersion 이 비어 서버 app_ver 가 null 로 쌓였다(AWeek 2026-09-22 — 전에는 1.0.0 을 보냈다).
 */
export declare const pickVersion: (runtimeVersion: unknown, configVersion: unknown) => string;
export declare function referrerKeys(raw: string): string;
export declare function createFunnel(deps: FunnelDeps, env?: FunnelEnv): Funnel;
