"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HEAL_MAX_ASKS = void 0;
exports.healUnclaimedStages = healUnclaimedStages;
/**
 * 0.3.2 — 놓친 걷기 단계 광고 보상 되찾기(화면 없이). 서버에 「이 단계 광고의 구글 확인(SSV)이 와 있고 아직 청구 안 됐다」가 남아 있는데
 * 앱이 청구를 못 마친 경우(광고 도중 앱 종료 · 응답 유실 · 앱 쪽 재시작 복구에 `steps_stage:<날짜>:<단계>` 갈래가 없음)에 그 단계를 받는다.
 *
 * 중복 지급은 없다 — 서버 `steps/stages/claim`: 회원 행 잠금 아래에서 (1) 이미 받은 단계는 `replayed` + 0P (2) 광고 확인 한 줄을 `consumeAd` 가
 * `claimed_at IS NULL` 비교 갱신으로 한 번만 쓰고 (3) `steps_stage_claims(app, member, day, stage)` 와 원장 `ledger_ref` 가 유일 키다.
 *
 * 앱이 이 함수를 부르는 곳: 걷기 화면이 단계 상태(오늘 · 어제)를 불러온 직후. 패키지 `<StepsScreen>` 은 이미 부른다. `adSeen` 이 없으면 아무것도 안 한다.
 */
const days_1 = require("./days");
const stages_1 = require("./stages");
exports.HEAL_MAX_ASKS = 3;
/** 되찾아 받은 단계 수(0P 로 이미 받은 것은 세지 않는다). 모든 실패는 삼킨다 — 받기 단추 등 화면은 그대로다. */
async function healUnclaimedStages(api, sources, options) {
    const seen = api.adSeen;
    if (!seen)
        return 0;
    let claimed = 0;
    for (const src of sources) {
        if (!src)
            continue;
        for (const stage of src.stages) {
            if (options.canRun && !options.canRun())
                return claimed;
            if (!(0, stages_1.canClaimStage)(src, stage))
                continue; // 이미 받음 · 아직 못 받는 단계 · 걸음 모자람 · 하루 최대 — 묻지 않는다
            const key = src.day + ':' + stage.stage_id;
            const asked = options.memory.get(key) ?? 0;
            if (asked >= exports.HEAL_MAX_ASKS)
                continue;
            let answer = null;
            try {
                answer = await seen(stage.ad_purpose, (0, days_1.kstDayStartSec)(src.day));
            }
            catch {
                answer = null;
            }
            if (answer === null || answer === undefined) {
                options.memory.set(key, asked + 1);
                continue;
            } // 모름 — 다음 불러오기에 다시(최대 3번)
            options.memory.set(key, exports.HEAL_MAX_ASKS); // 답을 받았다 — 이 화면에서는 더 묻지 않는다
            if (answer !== true)
                continue;
            try {
                const next = await api.claimStage(stage.stage_id, src.day, true);
                if (next.gained)
                    claimed += 1;
                await options.onClaimed?.(next, src);
            }
            catch { /* 이미 받음 · 날짜 지남 · 확인 아직 없음 · 네트워크 — 조용히 넘긴다 */ }
        }
    }
    return claimed;
}
