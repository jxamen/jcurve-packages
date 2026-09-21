/**
 * OTA 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * **이 파일은 앱을 모른다.** 로그인했는지·로그인 중인지·메인에 있는지는 앱이 함수로 알려 준다.
 * 네이티브 모듈은 지연 `require` 로만 집는다 — 모듈이 빠진 빌드에서 정적 import 는 앱 시작 자체를
 * 죽이고, OTA 로 옛 런타임에 같은 JS 가 내려가므로 더 그렇다.
 */
/** expo-updates 의 네이티브 상태 — 쓰는 칸만 */
type NativeState = {
    isStartupProcedureRunning?: boolean;
    isDownloading?: boolean;
    isUpdatePending?: boolean;
    checkError?: unknown;
    downloadError?: unknown;
};
/**
 * expo-updates 에서 쓰는 것만 적는다 — **패키지가 그것을 의존성으로 들고 있지 않다.**
 * 들고 있으면 안 쓰는 앱에도 딸려 가고, 버전이 앱과 어긋나면 빌드가 깨진다.
 */
type ExpoUpdates = {
    isEnabled: boolean;
    isEmbeddedLaunch: boolean;
    updateId: string | null;
    reloadAsync: () => Promise<void>;
    /** 빌드에 박힌 「켤 때 받기」 설정 — ON_LOAD·WIFI_ONLY 면 네이티브가 받는다 */
    checkAutomatically?: string | null;
    checkForUpdateAsync?: () => Promise<{
        isAvailable?: boolean;
    }>;
    fetchUpdateAsync?: () => Promise<{
        isNew?: boolean;
    }>;
    latestContext?: NativeState;
    addUpdatesStateChangeListener?: (fn: (e: {
        context?: NativeState;
    }) => void) => {
        remove: () => void;
    };
};
/** 기기와 닿는 것 — **시험에서만** 갈아 끼운다(`__reset`) */
type Env = {
    updates: () => ExpoUpdates;
    /** 앱이 화면에 떠 있는가 — 뒤로 넘어간 사이(로그인 창·미션 매체)에는 적용하지 않는다 */
    active: () => boolean;
    dev: () => boolean;
};
/** 시험에서만 쓴다 — 기기 대신 흉내 낸 것을 쓴다. 인자 없이 부르면 원래대로 */
export declare function __reset(fake?: Partial<Env>): void;
/** 앱이 알려 주는 것 — 적용해도 되는 순간인지는 이 넷으로 정한다 */
export type AutoApplyDeps = {
    /** 로그인한 사람인가(세션이 있다) */
    signedIn: () => boolean;
    /** 이 실행에서 로그인 버튼을 눌러 봤는가 — `@jcurve/auth` 의 `hasTriedAuth` */
    triedAuth: () => boolean;
    /**
     * 지금 로그인·가입 중인가 — 로그인 화면·가입 화면이 떠 있거나 로그인 창을 다녀오는 중(`isAuthorizing`).
     * 앱이 뒤로 가 있는지는 패키지가 따로 본다.
     */
    busy: () => boolean;
    /** 로그인한 사람에게 적용해도 되는 자리인가 — 메인 화면(꼬꼬농장: 농장 탭 첫 화면) */
    atHome: () => boolean;
    /**
     * 「새 버전 알려 주기」가 켜져 있는가(2.2) — 켜져 있으면 **스스로 적용하지 않고** 띠를 띄울 수 있게 알린다
     * (`onUpdateReady`). 사람이 띠를 누르면 `applyUpdate()` 가 적용한다. 꺼져 있거나 주지 않으면 위 규칙대로 스스로 적용한다.
     * 도중에 바꿔도 따른다 — 켜 두었다가 끄면 다음 조용한 순간에 스스로 적용된다.
     */
    notice?: () => boolean;
};
/**
 * 지금 새 판으로 다시 시작하는 중인가(2.3) — **로그인·게스트 버튼은 이게 참이면 탭을 무시한다.**
 *
 * 재시작을 정한 순간부터 실제로 다시 뜨기까지 1초 남짓 걸린다. 그 사이 로그인 버튼을 누르면 로그인이 시작되자마자
 * 끊긴다 — 로그인 화면에서도 새 판을 적용하게 하면서(버튼 누르기 전) 남는 유일한 틈이다. 버튼이 무시하면 로그인은
 * 시작조차 안 되고, 잠시 뒤 새 판의 같은 화면이 뜬다.
 */
export declare const isRestarting: () => boolean;
/** 받아 둔 새 판이 있는가 */
export declare const hasWaiting: () => boolean;
/**
 * 새 판을 다 받으면 알려 달라 — 띠를 띄우는 화면이 부른다. **이미 받아 뒀으면 그 자리에서 한 번 부른다**
 * (받는 것이 화면보다 먼저 끝난 기기에서 알림을 놓쳐 띠가 영영 안 뜨던 구멍). 돌려주는 함수로 끊는다.
 */
export declare function onUpdateReady(fn: () => void): () => void;
/**
 * 지금 띠를 눌러 적용해도 되는가 — 받아 둔 것이 있고, **로그인·가입 중이 아니고** 앱이 떠 있을 때.
 * 띠는 이것이 참일 때만 보여 준다(로그인 중에 누르면 로그인이 끊긴다 — 이 패키지가 생긴 까닭이다).
 */
export declare function canApplyNow(): boolean;
/** 띠를 눌렀다 — 적용할 수 있으면 곧바로 다시 시작한다. 못 하면 거짓(로그인 중·받아 둔 것 없음) */
export declare function applyUpdate(): boolean;
/**
 * 네이티브가 받아 둔 새 버전을 **안전한 순간에** 적용한다 — 앱이 켜질 때 한 번 부른다. 돌려주는 함수로 멈춘다.
 *
 * 받는 것은 네이티브가 켤 때 한다(`app.json` 의 `checkAutomatically` 기본값). 여기서는 다 받았을 때
 * (`isUpdatePending`) 언제 다시 시작할지만 정한다:
 *  1. 로그인한 사람 — 켠 지 6초 안이면(시작 화면) 바로. 깜빡임이 안 보인다
 *  2. 로그인 전 — **로그인 버튼을 누르기 전이면** 바로. 새로 깐 사람이 스토어 빌드의 옛 코드에 갇히지 않게
 *  3. 그 밖 — 3초마다 보다가, 로그인 전이면 「아직 안 눌렀을 때」, 로그인했으면 「메인에 있을 때」
 * 어느 경우든 **로그인·가입 중이거나 앱이 뒤로 가 있으면 하지 않는다** — 끝내 기회가 없으면 다음 실행에 저절로 적용된다.
 */
export declare function autoApply(deps: AutoApplyDeps, opts?: {
    quickMs?: number;
    everyMs?: number;
    fetchDelayMs?: number;
}): () => void;
/**
 * 로그인 전 사람의 시작 화면을 **네이티브의 시작 확인이 끝날 때까지**(최대 `maxMs`) 붙잡는다.
 *
 * 확인이 도는 동안 앱 소개가 먼저 뜨면, 곧이어 받은 새 버전이 적용되며 화면이 덜컥 처음으로 돌아간다.
 * 시작 화면 뒤에서 끝내면 깜빡임이 보이지 않는다.
 */
export declare function startupSettled(maxMs?: number): Promise<void>;
/** 지금 돌고 있는 판 이름 — 기본 판(스토어에서 받은 그대로)이면 빈 문자열 */
export declare function bundleLabel(): string;
export {};
