/**
 * 열린 광고 복구 (0.2.0) — 광고가 열렸는데 결과를 못 받은 채 앱이 꺼져도, 다음 실행에서 서버 `ads/seen` 으로 확인하고 그 자리의 청구를 다시 부른다.
 *
 * 10개 앱에 10가지 모양으로 흩어져 있던 것을 하나로 맞춘다. 기준은 캐시팡팡 `pendingAd.ts`(기록 저장 → 앱 시작 때 한 번 순서대로 → 서버가 확인해 주면 청구)이고,
 * 거기서 **세 가지만** 바꿨다:
 *  1. 용도 표를 이름 **정확 일치**로만 찾지 않고 `steps_stage:*` 같은 **접두 일치**도 지원한다(걷기 단계 용도는 `steps_stage:<날짜>:<단계>` 처럼 접미사가 붙는다).
 *  2. 표에 **없는 용도의 기록을 조용히 지우지 않는다** — 남겨 두고(24시간 뒤 정리) `onUndeclared` 로 알린다. 지우려면 표에 `skip`(서버 청구가 없는 용도 — 앱 로컬 지급 ·
 *     다른 곳이 되살림)으로 **선언**해야 한다. 앱의 시험에서 `undeclaredPurposes()` 로 용도 목록 전체가 선언됐는지 확인한다.
 *  3. 서버 확인 경로가 없는 앱을 위해 `seen` 이 `null`(모름)이면 청구를 바로 부른다(꿀꿀의 방식 — 청구 경로가 서버 확인을 대신한다). `false`(아직 안 옴)이면 남겨 둔다.
 *
 * 저장소는 주입한다(RN 없이 시험된다). 같은 실행에서 두 번 불러도 한 번만 돈다.
 */
export type PendingAd = {
    id: string;
    purpose: string;
    openedAt: number;
    memberId: string;
};
export type RecoveryStorage = {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
};
export declare const MAX_PENDING_AGE: number;
/** 열린 광고 기록 저장소 — 같은 id 는 한 건만, 종료하면 지우고, 24시간 지난 것은 목록을 읽을 때 정리한다. 쓰기는 순서대로 한 줄로 선다. */
export declare function createPendingAds(storage: RecoveryStorage, key: string): {
    add: (row: PendingAd) => Promise<void>;
    remove: (id: string) => Promise<void>;
    list: (now?: number) => Promise<PendingAd[]>;
};
export type PendingAds = ReturnType<typeof createPendingAds>;
/**
 * 용도 한 칸. `claim` = 서버 청구형(확인이 오면 이 함수로 다시 청구, 키는 `ad-recovery:<id>`).
 * `skip` = 이 복구가 다루지 않는 용도 — 앱이 로컬로 지급하거나(꼬꼬 룰렛 등) 다른 곳이 되살리는 것(황금 복권은 복권 쪽). 기록은 조용히 지워도 된다고 **선언**한 것.
 */
export type PurposeRule = {
    kind: 'claim';
    claim: (key: string, row: PendingAd) => Promise<unknown>;
} | {
    kind: 'skip';
    why: string;
};
/** 이름 또는 `접두:*` (예: `'steps_stage:*'`). 정확한 이름이 접두보다 먼저, 접두끼리는 더 긴 쪽이 먼저. */
export type PurposeTable = Record<string, PurposeRule>;
export declare function resolvePurpose(table: PurposeTable, purpose: string): PurposeRule | undefined;
/** 앱의 시험용: 앱이 광고에 쓰는 용도 이름 목록 가운데 표에 선언되지 않은 것(예: 접미사 붙은 용도는 대표 이름 하나를 넣는다). 비어 있어야 한다. */
export declare function undeclaredPurposes(purposes: ReadonlyArray<string>, table: PurposeTable): string[];
/** 서버가 「이미 처리됨」이라고 답한 오류 코드 — 기록을 지운다. 그 밖의 오류(네트워크 · 시간 초과)는 남겨서 다음 실행에 다시 시도한다. */
export declare const SETTLED_CODES: RegExp;
export type RecoveryOptions = {
    pending: PendingAds;
    memberId: string;
    /** true = 서버에 아직 안 쓴 시청 확인이 와 있다 · false = 아직 없다(남겨 둔다) · null = 확인 경로가 없다(청구 경로가 서버 확인을 대신한다) */
    seen: (row: PendingAd) => Promise<boolean | null>;
    purposes: PurposeTable;
    refresh: () => Promise<void>;
    say: (line: string) => void;
    /** 표에 없는 용도의 기록을 만났다(실행마다 용도당 한 번) — 지우지 않고 남겨 둔다. 앱은 여기서 로그/진단으로 알리고 표에 선언을 더한다. */
    onUndeclared?: (row: PendingAd) => void;
    message?: string;
};
/** 앱당 한 번, 순차 실행. 실패한 네트워크 요청은 다음 실행에서 같은 키로 재시도한다. */
export declare function createAdRecovery(): (o: RecoveryOptions) => Promise<void>;
