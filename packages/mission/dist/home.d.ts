/**
 * (0.5.0) 메인 「바로 받는 혜택」 목록을 **서버 설정으로** — 대표님 10-20 10:56 「메인 패키지 반영도 바로 안되고」.
 * 줄 제목 · 설명 · 버튼 · 배지 · 보임 · 순서를 어드민 앱 설정(mission.home_rows)에서 바꾸면 앱 빌드 · OTA 없이 1분 안에 바뀐다.
 * 서버 GET mission/home → { ok, rows: HomeRow[] | null, list: { adAfter, shoppingFirst } }. rows 가 null(설정 없음) · 실패면 앱의 기본 목록 그대로.
 * react-native 를 가져오지 않는다(시험이 바로 돈다).
 */
import type { BenefitQuickItem } from './BenefitQuickList';
import type { Requester } from './entry';
/** 서버가 아는 줄 행동 — jcurve-api MissionCardsController::HOME_KEYS 와 같다 */
export declare const HOME_KEYS: readonly ["quiz1", "quiz2", "checkin", "steps", "free_item", "today_missions", "lucky_chance", "invite", "recommend"];
export type HomeRowKey = typeof HOME_KEYS[number];
export type HomeRow = {
    key: HomeRowKey;
    title: string;
    desc: string;
    button: string;
    badge: string;
    visible: boolean;
    order: number;
};
export type HomeConfig = {
    rows: HomeRow[] | null;
    list: {
        adAfter: number | null;
        shoppingFirst: boolean | null;
    };
};
export declare const EMPTY_HOME: HomeConfig;
/** 서버 응답을 믿지 않고 다시 거른다 — 모르는 key · 빈 제목 · 같은 key 두 번째는 버린다. 깨진 응답은 EMPTY_HOME */
export declare function parseHomeResponse(response: unknown): HomeConfig;
/**
 * (0.4.6) 앱이 넘기는 간단한 저장소 — React Native 의 AsyncStorage 가 그대로 맞는다(새 네이티브 의존 없음).
 * 마지막으로 받은 서버 목록을 저장해 두었다가 **앱을 켤 때 그 값으로 먼저 그린 뒤** 서버 응답으로 갱신한다 — 켤 때 앱 기본 순서로 그렸다가 서버 순서로 바뀌는 것(대표님 10-20 18:54)을 막는다.
 */
export type HomeStorage = {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<unknown>;
} | {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<unknown>;
};
/** 이 저장소를 쓸 수 있는가(get/set 또는 getItem/setItem). 쓸 수 없으면 저장소를 안 넘긴 것과 같다 — 목록을 기다리게 하지 않는다 */
export declare function homeStorageUsable(storage: HomeStorage | undefined | null): boolean;
/** 저장 키 기본값 — 앱이 서버 · 계정마다 다른 목록을 쓰면 `storageKey` 로 바꾼다 */
export declare const HOME_STORAGE_KEY = "jcurve.mission.home.v1";
/** 저장값을 읽는 데 이만큼(ms)까지만 기다린다 — 저장소가 응답이 없어도 목록이 영영 안 뜨지 않게 */
export declare const HOME_STORAGE_WAIT_MS = 300;
/** 저장해 둔 마지막 서버 목록 — 없음 · 깨짐 · 모르는 판 · 저장소 오류는 null(앱 기본). 읽을 때도 서버 응답처럼 다시 거른다 */
export declare function readStoredHome(storage: HomeStorage | undefined, key?: string): Promise<HomeConfig | null>;
/** 서버에서 **정상으로** 받은 목록을 저장한다 — 저장소 오류는 삼킨다(목록은 이미 그려졌다) */
export declare function saveStoredHome(storage: HomeStorage | undefined, config: HomeConfig, key?: string): Promise<void>;
/**
 * (0.4.6) GET mission/home — 값과 함께 **서버에서 정상으로 받았는가**(`ok`)를 준다. `maxAgeMs`(기본 60초) 안이면 받아 둔 것(ok).
 * 실패(던짐 · 깨진 응답)면 받아 둔 것 또는 EMPTY_HOME 과 ok:false — 저장값을 이미 그렸다면 호출한 쪽이 그것을 지킨다.
 * `storage` 를 주면 **정상 응답일 때만** 저장한다(캐시 적중 · 실패 · 깨진 응답은 저장하지 않는다).
 */
export declare function fetchHomeResult(fetchJson: Requester, opts?: {
    maxAgeMs?: number;
    now?: number;
    storage?: HomeStorage;
    storageKey?: string;
}): Promise<{
    value: HomeConfig;
    ok: boolean;
}>;
/** GET mission/home — `maxAgeMs`(기본 60초) 안이면 받아 둔 것. 실패하면 받아 둔 것 또는 EMPTY_HOME(앱 기본 목록) */
export declare function fetchHomeConfig(fetchJson: Requester, opts?: {
    maxAgeMs?: number;
    now?: number;
    storage?: HomeStorage;
    storageKey?: string;
}): Promise<HomeConfig>;
/** 시험용 · 로그아웃 · 앱 전환 */
export declare function resetHomeConfig(): void;
/**
 * (0.4.6) 화면에 그릴 서버 설정이 정해지는 순서 — 저장값(있으면) → 서버 응답. React 를 쓰지 않는 순수 함수라 시험이 바로 돈다.
 *  - `ready`: 처음 그려도 되는가. 저장소를 쓰면 저장값을 읽을 때까지(최대 HOME_STORAGE_WAIT_MS) false — 앱 기본 순서를 잠깐 그렸다가 바꾸지 않으려고 목록을 늦추지 않고 **그리지 않는다**.
 *    저장소를 안 쓰면 처음부터 true(예전과 같다)
 *  - 서버에서 정상으로 받으면 그것이 이긴다(저장값은 그 뒤에 도착해도 무시). 서버가 실패하면 이미 그린 저장값을 지킨다(앱 기본으로 되돌리면 순서가 또 바뀐다)
 */
export type HomeState = {
    config: HomeConfig;
    ready: boolean;
    fresh: boolean;
    fromStorage: boolean;
    storage: boolean;
};
export type HomeEvent = {
    type: 'stored';
    config: HomeConfig | null;
} | {
    type: 'server';
    value: HomeConfig;
    ok: boolean;
} | {
    type: 'timeout';
};
export declare function homeInitial(hasStorage: boolean): HomeState;
export declare function homeReduce(s: HomeState, e: HomeEvent): HomeState;
/**
 * 앱의 기본 목록에 서버 설정을 얹는다 — `keys` 는 앱 줄 key → 서버 행동 key(예 { bag: 'quiz1', pin: 'quiz2', ticket: 'lucky_chance' }).
 *  - 설정이 있는 줄: 제목은 서버 것, 설명 · 버튼 · 배지는 서버 값이 있을 때만(빈 값이면 앱 것 그대로), visible:false 면 숨김
 *  - 순서: 설정이 있는 줄은 서버 순서대로 앞에, 설정에 없는 줄(앱만의 줄 · 서버가 안 적은 줄)은 그 뒤에 원래 순서대로
 *  - rows 가 null 이면 아무것도 안 바꾼다. 누르는 동작(onPress) · 완료 · 칸 막대는 늘 앱 것
 */
export declare function applyHomeRows(items: readonly BenefitQuickItem[], rows: readonly HomeRow[] | null, keys: Readonly<Record<string, HomeRowKey>>): BenefitQuickItem[];
/**
 * 목록 사이 광고 자리(list.adAfter) — 앞에서 몇 번째 **보이는** 줄 뒤에 둘지. null 이면 앱 기본, 0 이면 맨 앞, 보이는 줄 수보다 크면 맨 뒤
 */
export declare function adSlotIndex(items: readonly BenefitQuickItem[], adAfter: number | null, fallback: number | null): number | null;
/**
 * (0.4.4) 앱 줄 key → 서버 9개 key 맞춤표를 만든다 — `homeKeys`(앱이 적은 것)가 이기고, 안 적은 줄은 **key 가 서버 key 와 같으면 그대로**.
 * 서버 줄 key 는 9개 고정(HOME_KEYS)이라 모든 앱이 같은 key 로 말해야 어드민 한 곳이 모든 앱 목록이 된다(대표님 17:12 「이 패키지 써」)
 */
export declare function resolveHomeKeys(items: readonly BenefitQuickItem[], homeKeys?: Readonly<Record<string, HomeRowKey>>): Record<string, HomeRowKey>;
/** 기본 「무료 ○○ 받기 · 하루 3번 들르면 ○○ 받기」 줄(key free_item) — 당근과 같은 문구. ○○ 는 앱 아이템 이름 */
export declare function freeItemHomeRow(itemName: string, onPress: () => void): BenefitQuickItem;
/**
 * (0.4.4) free_item 줄은 **패키지 기본**이다 — 앱 items 에 free_item(맞춤표 기준)이 이미 있으면(예: freeItemRow 를 쓰는 에그머니 · 머니트리 · 영테크) 겹치지 않게 그대로 두고,
 * 없고 `onFreeItem` 이 있으면 기본 줄을 맨 뒤에 더한다(자리 · 보임은 서버 home_rows 가 정한다). `onFreeItem` 이 없으면 줄을 만들지 않는다(눌러도 갈 곳이 없다)
 */
export declare function withFreeItemRow(items: readonly BenefitQuickItem[], homeKeys: Readonly<Record<string, HomeRowKey>> | undefined, itemName: string | undefined, onFreeItem: (() => void) | undefined): BenefitQuickItem[];
/**
 * (0.4.4) 앱별 서버 home_rows 를 **그대로 따른다**(대표님 17:14 「목록 순서는 어드민에서 앱별로 · 넣고 빼고 순서랑」):
 *  - **순서**: home_rows 순서대로(설정에 있는 줄이 앞, 서버 key 와 짝이 없는 앱 전용 줄은 그 뒤에 원래 순서로)
 *  - **빼기**: 서버 key 로 맞춰진 앱 줄인데 home_rows 에 없으면 그리지 않는다. 있어도 visible:false 면 숨긴다
 *  - **넣기**: home_rows 에 있는데 앱 items 에 짝이 없는 key 는 그 줄(제목 · 설명 · 버튼 · 배지는 서버 값)을 기본 그림으로 만들어 넣고, 누르면 `onRow(key)` 를 부른다 — `onRow` 가 없으면 그 줄은 만들지 않는다(눌러도 갈 곳이 없다)
 *  - **제목**(0.4.5): 서버 title 이 비어 있으면 앱 제목을 그대로 둔다(동적 제목 보호) — 적혀 있을 때만 덮는다. 새로 만드는 줄은 비었으면 key별 기본 제목
 *  - rows 가 null(설정 없음 · 실패)이면 앱 기본 그대로
 * 누르는 동작 · 완료 · 칸 막대는 늘 앱 것(앱 줄) — 서버 줄이 바꾸는 것은 제목 · 설명 · 버튼 · 배지 · 보임 · 순서뿐
 */
export declare function composeHomeRows(items: readonly BenefitQuickItem[], rows: readonly HomeRow[] | null, keys: Readonly<Record<string, HomeRowKey>>, opts?: {
    onRow?: (key: HomeRowKey) => void;
}): BenefitQuickItem[];
