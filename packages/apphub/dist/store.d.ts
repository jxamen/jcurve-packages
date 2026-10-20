/**
 * (1.2.0) 마지막으로 받은 「앱 모아보기」 목록 · 칸 설정(section)을 앱 저장소에 두었다가 **켤 때 그 값으로 먼저** 그린다 —
 * 입구(「추천 앱 둘러보기」)가 서버 응답(`section.on`)을 받기 전에는 숨겨져 있다가 늦게 나타나던 것(대표님 10-20 19:01 「늦게 로딩」)을 막는다.
 * React 를 가져오지 않는다(시험이 바로 돈다).
 */
import { type Hub } from './load';
/**
 * 앱이 넘기는 저장소 — `get`/`set` 모양과 `getItem`/`setItem` 모양(순정 AsyncStorage 가 이쪽) 둘 다 받는다. 새 네이티브 의존 없음.
 * 둘 다 있으면 get/set 이 먼저. 어느 쪽도 아닌 값은 저장소를 안 넘긴 것과 같다.
 */
export type HubStorage = {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<unknown>;
} | {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<unknown>;
};
/** 이 저장소를 쓸 수 있는가. 쓸 수 없으면 저장소를 안 넘긴 것과 같다 — 입구를 기다리게 하지 않는다 */
export declare function hubStorageUsable(storage: HubStorage | undefined | null): boolean;
/** 저장 키 기본값 — 서버 · 계정마다 다른 목록을 쓰는 앱만 `storageKey` 로 바꾼다 */
export declare const HUB_STORAGE_KEY = "jcurve.apphub.family.v1";
/** 저장값을 읽는 데 이만큼(ms)까지만 기다린다 — 저장소가 응답이 없어도 입구가 영영 안 뜨지 않게 */
export declare const HUB_STORAGE_WAIT_MS = 300;
/** 저장해 둔 마지막 목록 · 칸 설정 — 없음 · 깨짐 · 모르는 판 · 저장소 오류는 null(첫 설치와 같다). 읽을 때도 서버 응답처럼 다시 거른다 */
export declare function readStoredHub(storage: HubStorage | undefined, key?: string): Promise<Hub | null>;
/** 서버에서 **정상으로** 받은 목록 · 칸 설정을 저장한다 — 저장소 오류는 삼킨다(화면은 이미 그려졌다). 칸이 꺼짐(on:false)이라는 것도 저장한다 */
export declare function saveStoredHub(storage: HubStorage | undefined, hub: Hub, key?: string): Promise<void>;
/**
 * 입구가 그려지는 순서 — 저장값(있으면) → 서버 응답. 순수 함수라 시험이 바로 돈다.
 *  - `ready`: 입구를 그려도 되는가. 저장소를 쓰면 저장값을 읽을 때까지(최대 HUB_STORAGE_WAIT_MS) false — 켜짐/꺼짐을 모르는 채 보였다 숨기지 않으려고. 저장소를 안 쓰면 처음부터 true(예전과 같다)
 *  - 저장값이 없는 **첫 설치**는 켜짐(기본 section). **서버가 분명히 꺼짐(on:false)이라고 답한 뒤에만** 숨기고, 그 꺼짐도 저장해 다음 켜기부터는 처음부터 숨긴다
 *  - 서버에서 정상으로 받으면 그것이 이긴다(저장값은 그 뒤에 도착해도 무시). 서버가 실패하면 이미 그린 저장값을 지킨다
 */
export type HubState = {
    hub: Hub | null;
    ready: boolean;
    fresh: boolean;
    fromStorage: boolean;
    failed: boolean;
    storage: boolean;
};
export type HubEvent = {
    type: 'stored';
    hub: Hub | null;
} | {
    type: 'server';
    hub: Hub;
} | {
    type: 'failed';
} | {
    type: 'retry';
} | {
    type: 'timeout';
};
export declare function hubInitial(hasStorage: boolean): HubState;
export declare function hubReduce(s: HubState, e: HubEvent): HubState;
/** 화면이 쓰는 값 — 받기 전(첫 설치 · 저장값 없음)에는 기본 칸 설정(켜짐 · 기존 문구) */
export declare function hubView(s: HubState): {
    items: Hub['items'] | null;
    section: Hub['section'];
    visible: boolean;
};
