import { type StepsState } from './stages';
export type StepsHealApi = {
    /** `GET ads/seen?purpose=&since=`(읽기만) — 아직 청구 안 된 확인이 있으면 true, 없으면 false, 모르면 null(또는 오류) */
    adSeen?(purpose: string, sinceSec: number): Promise<boolean | null>;
    claimStage(stageId: string, day: string, earned?: boolean): Promise<StepsState & {
        gained: number;
        balance: number;
    }>;
};
/** 단계(`날짜:stage_id`)마다 몇 번 물었나 — 화면이 떠 있는 동안 들고 있는다(답을 받았거나 3번 모르면 더 안 묻는다) */
export type StepsHealMemory = Map<string, number>;
export declare const HEAL_MAX_ASKS = 3;
export type HealOptions = {
    memory: StepsHealMemory;
    /** 단계마다 부르기 전에 확인 — 화면이 닫혔거나 사용자가 직접 받는 중이면 false */
    canRun?: () => boolean;
    /** 되찾아 받았을 때(`next` = 청구 응답, `source` = 그때 보던 상태) */
    onClaimed?: (next: StepsState & {
        gained: number;
        balance: number;
    }, source: StepsState) => void | Promise<void>;
};
/** 되찾아 받은 단계 수(0P 로 이미 받은 것은 세지 않는다). 모든 실패는 삼킨다 — 받기 단추 등 화면은 그대로다. */
export declare function healUnclaimedStages(api: StepsHealApi, sources: ReadonlyArray<StepsState | null | undefined>, options: HealOptions): Promise<number>;
