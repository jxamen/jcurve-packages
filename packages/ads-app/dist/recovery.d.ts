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
export declare function createPendingAds(storage: RecoveryStorage, key: string, options?: {
    maxAgeMs?: number;
}): {
    add: (row: PendingAd) => Promise<void>;
    remove: (id: string) => Promise<void>;
    list: (now?: number) => Promise<PendingAd[]>;
    maxAgeMs: number;
};
export type PendingAds = ReturnType<typeof createPendingAds>;
/**
 * 용도 한 칸. `claim` = 서버 청구형(확인이 오면 이 함수로 다시 청구, 키는 `ad-recovery:<id>`).
 * `skip` = 이 복구가 다루지 않는 용도 — 앱이 로컬로 지급하거나(꼬꼬 룰렛 등) 다른 곳이 되살리는 것(황금 복권은 복권 쪽). 기록은 조용히 지워도 된다고 **선언**한 것.
 */
/** `ads/seen` 응답을 그대로 줄 수도 있다(0.2.2): 서버가 「이미 처리됨」(settled)이라고 하면 청구 없이 기록을 지우고, settledPoints > 0 이면 보상 안내만 낸다. */
export type SeenStatus = {
    seen?: boolean | null;
    settled?: boolean;
    settledPoints?: number;
    settledBy?: string;
};
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
/** 걷기 단계 용도 `steps_stage:<YYYY-MM-DD>:<stage_id>` → { day, stageId } (0.2.1). 모양이 다르면 null. 복구 표의 `'steps_stage:*'` 청구 함수가 `claimStepsStage(stageId, day)` 를 부를 때 쓴다. */
export declare function parseStepsStagePurpose(purpose: string): {
    day: string;
    stageId: string;
} | null;
export type RecoveryOptions = {
    pending: PendingAds;
    memberId: string;
    /** true = 서버에 아직 안 쓴 시청 확인이 와 있다 · false = 아직 없다(남겨 둔다) · null = 확인 경로가 없다(청구 경로가 서버 확인을 대신한다) */
    seen: (row: PendingAd) => Promise<boolean | null | SeenStatus>;
    purposes: PurposeTable;
    refresh: () => Promise<void>;
    say: (line: string) => void;
    /**
     * (0.2.1) 이 복구가 다룰 용도만 — 아니면 그 기록은 **건드리지도 알리지도 않는다**(예: 꿀꿀은 황금 복권을 복권 화면이 따로 되살리므로 `purpose !== 'lottery_basic'`).
     * 표에 `skip` 으로 선언하는 것(지운다)과 다르다. 안 주면 모든 용도를 다룬다.
     */
    only?: (purpose: string) => boolean;
    /** 표에 없는 용도의 기록을 만났다(실행마다 용도당 한 번) — 지우지 않고 남겨 둔다. 앱은 여기서 로그/진단으로 알리고 표에 선언을 더한다. */
    onUndeclared?: (row: PendingAd) => void;
    message?: string;
    /** (0.2.2) 앱이 쓰던 「이미 처리됨」 오류 코드가 더 있으면(꿀꿀: already_opened · basket_full · not_full · daily_max · ssv_pending · not_ready · not_reached · off) 기본 목록에 더한다. 이 코드로 거절된 기록은 지운다. */
    extraSettledCodes?: ReadonlyArray<string>;
};
/** 앱당 한 번, 순차 실행. 실패한 네트워크 요청은 다음 실행에서 같은 키로 재시도한다. */
export declare function createAdRecovery(): (o: RecoveryOptions) => Promise<void>;
/**
 * 걷기 단계 복구 칸 (0.2.2) — `purposes['steps_stage:*']` 에 그대로 넣는다. 용도에서 날짜 · 단계를 풀어 `claimStage(stageId, day)` 를 부르고,
 * **받은 포인트가 있을 때만**(`gained > 0`) 결과를 돌려준다. 이미 받은 단계(0P · replayed)의 남은 SSV 행은 `{ ok: false }` 로 돌려 조용히 지운다 — 가짜 「보상 받았어요」 안내가 뜨지 않는다.
 * 모양이 다른 용도면 던지지 않고 `{ ok: false }`.
 */
export declare function stepsStageRule(claimStage: (stageId: string, day: string) => Promise<{
    gained?: number;
} | null | undefined>): PurposeRule;
