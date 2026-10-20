/**
 * (2.10) **메인에 도착했을 때만** 새 판을 적용한다 — 대표님 10-20 11:51 「앱 열면 메인에서 자동 ota 되는것도 다 넣어」 ·
 * 11:52 「껐다 켤 필요 없게」 · 11:54 「로그인에서는 아니야」.
 *
 *  - 켤 때 · 로그인 · 가입 · 약관 · 본인인증 화면: `prefetchUpdate()` — **받기만** 한다(다시 시작하지 않는다)
 *  - 메인 진입 · 메인으로 돌아올 때: `onMainReady()` — 받아 둔 새 판이 있으면 바로 다시 시작. 없으면 묻고 받아
 *    `timeoutMs`(기본 5000) 안에 다 받으면 그 자리에서, 넘으면 받던 것은 계속 받고 다음 메인 도착 때
 *  - 광고 · 뽑기 · 결제 · 영상 · 가입 중: `setBusy(reason)` … `clearBusy(reason)` — 그동안 미루고, 마지막 사유가 풀리면 (메인이면) 적용
 *  - 같은 판 id 로 두 번 다시 시작하지 않는다(앱마다 있던 bootUpdate 의 marker 그대로): 다시 시작 **전에** id 를 적고,
 *    적지 못하면 다시 시작하지 않는다(저장 실패가 재시작 반복이 되지 않게). 다시 뜬 판이 그 id 면 표시를 지운다
 *  - 실패는 모두 조용히 넘어간다 — 지금 판은 멀쩡하다
 *
 * 네이티브는 expo-updates 만(지연 require). 저장소(marker)는 앱이 준다 — 패키지는 AsyncStorage 를 들고 있지 않다.
 * **`autoApply` · `launchUpdate` 와 같이 쓰지 않는다** — 이 방식으로 옮기는 앱은 그 둘을 빼고 이것만 부른다.
 */
export type MainReadyResult = 'applied' | 'none' | 'held' | 'timeout' | 'skipped';
/** 기기와 닿는 것 — 시험에서 갈아 끼운다 */
export type MainReadyDeps = {
    enabled: boolean;
    /** 지금 돌고 있는 판 id(Updates.updateId) */
    currentId: string | null;
    check(): Promise<{
        isAvailable?: boolean;
    }>;
    fetch(): Promise<{
        isNew?: boolean;
        manifest?: {
            id?: string;
        } | null;
    }>;
    reload(): Promise<void>;
    getMarker(): Promise<string | null>;
    setMarker(id: string): Promise<void>;
    clearMarker(): Promise<void>;
    /** 앱이 화면에 떠 있는가 — 뒤로 가 있으면 다시 시작하지 않는다 */
    active(): boolean;
    /** 네이티브가 켤 때 확인 · 받는 중인가 — 그동안은 겹쳐 묻지 않고 기다린다(선택) */
    nativeBusy?(): boolean;
    now?(): number;
    /** 기다리기(시험에서 갈아 끼운다) */
    sleep?(ms: number): Promise<void>;
};
export type MainReadyOptions = {
    /** 메인 도착 때 묻고 받는 최대 시간(기본 5000) — 넘으면 이번엔 적용하지 않는다 */
    timeoutMs?: number;
    /** 새 판을 다시 묻는 최소 간격(기본 60000) — 메인 진입마다 서버를 두드리지 않게. 받아 둔 판 적용은 간격과 상관없이 바로 */
    checkEveryMs?: number;
    /** 지금 메인 화면인가 — busy 가 풀릴 때 이것이 참이면 미뤄 둔 적용을 한다(없으면 마지막 onMainReady 이후 메인으로 본다) */
    atMain?: () => boolean;
};
export declare const MAIN_READY_TIMEOUT_MS = 5000;
export declare const MAIN_READY_CHECK_EVERY_MS = 60000;
export type MainReady = {
    prefetchUpdate(): Promise<void>;
    onMainReady(): Promise<MainReadyResult>;
    setBusy(reason: string): void;
    clearBusy(reason: string): void;
    isBusy(): boolean;
    isRestarting(): boolean;
    /** 받아 둔(이번 실행에서 받은) 새 판 id */
    waitingId(): string | null;
};
export declare function createMainReady(d: MainReadyDeps, opts?: MainReadyOptions): MainReady;
/** 앱이 주는 저장소 — AsyncStorage 그대로 넣어도 된다 */
export type MarkerStorage = {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
};
type ExpoLike = {
    isEnabled: boolean;
    updateId: string | null;
    checkForUpdateAsync: () => Promise<{
        isAvailable?: boolean;
    }>;
    fetchUpdateAsync: () => Promise<{
        isNew?: boolean;
        manifest?: {
            id?: string;
        } | null;
    }>;
    reloadAsync: () => Promise<void>;
    latestContext?: {
        isStartupProcedureRunning?: boolean;
        isDownloading?: boolean;
    };
};
/**
 * 앱이 켜질 때 한 번 — expo-updates 와 앱의 저장소로 묶는다. 그 뒤 `prefetchUpdate` · `onMainReady` · `setBusy` · `clearBusy` 를 부른다.
 * 개발 빌드 · 웹 · 모듈 없는 빌드면 아무것도 하지 않는다(skipped).
 */
export declare function configureMainReady(cfg: MainReadyOptions & {
    storage: MarkerStorage;
    markerKey: string;
    updates?: () => ExpoLike;
    dev?: boolean;
}): MainReady;
/** 켤 때 · 로그인 · 가입 · 약관 · 본인인증 화면 — 받기만 */
export declare const prefetchUpdate: () => Promise<void>;
/** 메인 진입 · 메인으로 돌아올 때 — 받아 둔 새 판이 있으면 바로 적용 */
export declare const onMainReady: () => Promise<MainReadyResult>;
/** 광고 · 뽑기 · 결제 · 영상 · 가입 중 — 끝날 때 clearBusy 를 같은 사유로 */
export declare const setBusy: (reason: string) => void;
export declare const clearBusy: (reason: string) => void;
/** 새 판으로 다시 시작하는 중 — 로그인 · 게스트 버튼은 참이면 탭을 무시한다 */
export declare const isMainReadyRestarting: () => boolean;
/** 시험에서만 */
export declare const __resetMainReady: () => void;
export {};
