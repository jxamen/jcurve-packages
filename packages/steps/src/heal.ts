/**
 * 0.3.2 — 놓친 걷기 단계 광고 보상 되찾기(화면 없이). 서버에 「이 단계 광고의 구글 확인(SSV)이 와 있고 아직 청구 안 됐다」가 남아 있는데
 * 앱이 청구를 못 마친 경우(광고 도중 앱 종료 · 응답 유실 · 앱 쪽 재시작 복구에 `steps_stage:<날짜>:<단계>` 갈래가 없음)에 그 단계를 받는다.
 *
 * 중복 지급은 없다 — 서버 `steps/stages/claim`: 회원 행 잠금 아래에서 (1) 이미 받은 단계는 `replayed` + 0P (2) 광고 확인 한 줄을 `consumeAd` 가
 * `claimed_at IS NULL` 비교 갱신으로 한 번만 쓰고 (3) `steps_stage_claims(app, member, day, stage)` 와 원장 `ledger_ref` 가 유일 키다.
 *
 * 앱이 이 함수를 부르는 곳: 걷기 화면이 단계 상태(오늘 · 어제)를 불러온 직후. 패키지 `<StepsScreen>` 은 이미 부른다. `adSeen` 이 없으면 아무것도 안 한다.
 */
import { kstDayStartSec } from './days';
import { canClaimStage, type StepsState } from './stages';

export type StepsHealApi = {
  /** `GET ads/seen?purpose=&since=`(읽기만) — 아직 청구 안 된 확인이 있으면 true, 없으면 false, 모르면 null(또는 오류) */
  adSeen?(purpose: string, sinceSec: number): Promise<boolean | null>;
  claimStage(stageId: string, day: string, earned?: boolean): Promise<StepsState & { gained: number; balance: number }>;   // heal 은 earned 를 넘기지 않는다
};
/** 단계(`날짜:stage_id`)마다 몇 번 물었나 — 화면이 떠 있는 동안 들고 있는다(답을 받았거나 3번 모르면 더 안 묻는다) */
export type StepsHealMemory = Map<string, number>;
export const HEAL_MAX_ASKS = 3;

export type HealOptions = {
  memory: StepsHealMemory;
  /** 단계마다 부르기 전에 확인 — 화면이 닫혔거나 사용자가 직접 받는 중이면 false */
  canRun?: () => boolean;
  /** 되찾아 받았을 때(`next` = 청구 응답, `source` = 그때 보던 상태) */
  onClaimed?: (next: StepsState & { gained: number; balance: number }, source: StepsState) => void | Promise<void>;
};

/** 되찾아 받은 단계 수(0P 로 이미 받은 것은 세지 않는다). 모든 실패는 삼킨다 — 받기 단추 등 화면은 그대로다. */
export async function healUnclaimedStages(api: StepsHealApi, sources: ReadonlyArray<StepsState | null | undefined>, options: HealOptions): Promise<number> {
  const seen = api.adSeen;
  if (!seen) return 0;
  let claimed = 0;
  for (const src of sources) {
    if (!src) continue;
    for (const stage of src.stages) {
      if (options.canRun && !options.canRun()) return claimed;
      if (!canClaimStage(src, stage)) continue;           // 이미 받음 · 아직 못 받는 단계 · 걸음 모자람 · 하루 최대 — 묻지 않는다
      const key = src.day + ':' + stage.stage_id;
      const asked = options.memory.get(key) ?? 0;
      if (asked >= HEAL_MAX_ASKS) continue;
      let answer: boolean | null = null;
      try { answer = await seen(stage.ad_purpose, kstDayStartSec(src.day)); } catch { answer = null; }
      if (answer === null || answer === undefined) { options.memory.set(key, asked + 1); continue; }   // 모름 — 다음 불러오기에 다시(최대 3번)
      options.memory.set(key, HEAL_MAX_ASKS);                                                          // 답을 받았다 — 이 화면에서는 더 묻지 않는다
      if (answer !== true) continue;
      try {
        // `earned` 를 주지 않는다 — 서버가 광고 확인(SSV) 한 줄을 소비해야만 지급하고, 앱 말만 믿는 길(`X-Ad-Client-Earned`)은 이 호출에 켜지 않는다
        const next = await api.claimStage(stage.stage_id, src.day);
        if (next.gained) claimed += 1;
        await options.onClaimed?.(next, src);
      } catch { /* 이미 받음 · 날짜 지남 · 확인 아직 없음 · 네트워크 — 조용히 넘긴다 */ }
    }
  }
  return claimed;
}
