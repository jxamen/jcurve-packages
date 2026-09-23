/**
 * 스토어 업데이트(2.6) — **최소 설치 버전**(강제)과 **권장 버전**(권유) 두 단계. 꼬꼬농장 `ForceUpdate.tsx` 를 떼어 왔다.
 *
 *  - 설치 버전 < 최소: 닫을 수 없는 창 → 스토어로. 스토어에 갔다 돌아오면 다시 뜬다
 *  - 설치 버전 < 권장: 「나중에」가 있는 창. **같은 권장 버전은 하루 한 번**
 *  - 권장 = 어드민 권장과 iOS 앱스토어 공개 버전(iTunes lookup) 중 높은 쪽 — 새 버전이 승인되면 설정 없이 권한다
 *  - 최소가 비어 있으면 강제하지 않고, 권장까지 비어 있으면 아무것도 안 한다
 *
 * 값은 서버 `GET {app}/app/version` 이 준다(어드민 「앱 관리」의 최소·권장 버전 + 스토어 번호).
 * **JS 뿐이다** — 창은 RN `Alert`, 설치 버전은 이미 든 `expo-application` 으로 읽어서 OTA 로 퍼진다.
 * 이 파일은 `updates.ts` 를 부르지 않는다(import 고리를 만들지 않는다).
 */
/** a < b 면 음수, 같으면 0, a > b 면 양수. 자릿수가 모자라면 0 으로 본다(1.0 == 1.0.0) */
export declare function cmpVersion(a: string, b: string): number;
/** 서버 `app/version` 이 주는 한 플랫폼 몫 */
export type StorePlatform = {
    min?: string | null;
    recommend?: string | null;
    appStoreId?: string | null;
    bundleId?: string | null;
    package?: string | null;
};
export type StoreVersionInfo = {
    ios?: StorePlatform;
    android?: StorePlatform;
};
export type StoreDecision = {
    kind: 'force';
    installed: string;
    target: string;
} | {
    kind: 'recommend';
    installed: string;
    target: string;
} | null;
/**
 * 막을까·권할까·그냥 둘까. 순수 함수 — 자체 화면을 그리는 앱(꼬꼬농장)도 이것만 가져다 쓸 수 있다.
 * 설치 버전을 모르면(개발 실행) 아무것도 하지 않는다.
 */
export declare function decideStoreUpdate(installed: string | null | undefined, p: StorePlatform | undefined, storeLatest?: string | null): StoreDecision;
/** 스토어 주소 — 앱으로 여는 주소와, 안 열리면 쓸 웹 주소. 번호를 모르면 null */
export declare function storeLinks(os: string, p: StorePlatform | undefined): {
    app: string;
    web: string;
} | null;
type AlertButton = {
    text: string;
    style?: 'cancel' | 'default';
    onPress?: () => void;
};
export type StoreVersionDeps = {
    /** 앱의 인증된 GET 으로 `app/version` 을 부른다 — 예 `() => api.get('app/version')` */
    fetch: () => Promise<unknown>;
    /** 권유 창을 띄워도 되는 때인가(선택) — 로그인 전·가입 중이면 false 를 준다(가입 이탈). 강제 창은 이것과 무관하다 */
    canRecommend?: () => boolean;
    /** 창 문구(선택) — 앱 이름을 넣고 싶을 때 */
    text?: {
        forceTitle?: string;
        forceBody?: string;
        recTitle?: string;
        recBody?: string;
        update?: string;
        later?: string;
    };
};
/** 기기와 닿는 것 — 시험에서만 갈아 끼운다 */
export type StoreVersionEnv = {
    os: () => string;
    dev: () => boolean;
    installed: () => string | null;
    alert: (title: string, body: string, buttons: AlertButton[]) => void;
    openURL: (url: string) => Promise<unknown>;
    onActive: (fn: () => void) => () => void;
    lookup: (bundleId: string) => Promise<string | null>;
    getItem: (k: string) => Promise<string | null>;
    setItem: (k: string, v: string) => Promise<void>;
    now: () => number;
};
/** 시험용 — 기기 대신 가짜를 넣는다 */
export declare function __resetStoreVersion(fake?: Partial<StoreVersionEnv>): void;
/**
 * 앱을 켤 때 한 번 부른다. 켤 때 바로 한 번, 앱이 앞으로 돌아올 때 10분에 한 번 다시 본다.
 * 돌려주는 함수로 멈춘다. 웹·개발 실행에서는 아무것도 하지 않는다.
 *
 * 서버를 못 읽거나 스토어 주소를 모르면 **막지 않는다** — 막고 못 보내면 사람이 갇힌다.
 */
export declare function checkStoreVersion(deps: StoreVersionDeps): () => void;
export {};
