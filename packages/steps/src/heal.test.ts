import { describe, expect, it, vi } from 'vitest';
import { HEAL_MAX_ASKS, healUnclaimedStages, type StepsHealApi } from './heal';
import type { StepsState } from './stages';

const stage = (i: number, claimed = false, available = true) => ({ stage_id: 'stage_' + i, threshold: i * 1000, points: 5, claimed, available, ad_purpose: `steps_stage:2026-10-28:stage_${i}` });
const state = (over: Partial<StepsState> = {}): StepsState => ({ ok: true, day: '2026-10-28', today_steps: 2400, daily_max: 25, earned_today: 5, stages: [stage(1, true), stage(2), stage(3)], ...over });
const claimed = (gained = 5) => vi.fn(async (_id: string, _day: string, _earned?: boolean) => ({ ...state(), gained, balance: 50 }));

describe('healUnclaimedStages', () => {
  it('without adSeen it does nothing and claims nothing', async () => {
    const claimStage = claimed();
    expect(await healUnclaimedStages({ claimStage }, [state()], { memory: new Map() })).toBe(0);
    expect(claimStage).not.toHaveBeenCalled();
  });
  it('claims exactly the claimable stage whose confirmation is on the server (earned=true), and tells the caller', async () => {
    const adSeen = vi.fn(async () => true); const claimStage = claimed(); const onClaimed = vi.fn();
    const n = await healUnclaimedStages({ adSeen, claimStage }, [state()], { memory: new Map(), onClaimed });
    expect(n).toBe(1);
    expect(adSeen).toHaveBeenCalledTimes(1);   // stage_1 claimed · stage_3 needs 3000 steps → only stage_2 is asked
    expect(adSeen).toHaveBeenCalledWith('steps_stage:2026-10-28:stage_2', Date.parse('2026-10-28T00:00:00+09:00') / 1000);
    expect(claimStage).toHaveBeenCalledWith('stage_2', '2026-10-28', true);
    expect(onClaimed).toHaveBeenCalledOnce();
  });
  it('a server replay (already claimed, 0P) is not counted as a recovered reward', async () => {
    const n = await healUnclaimedStages({ adSeen: async () => true, claimStage: claimed(0) }, [state()], { memory: new Map() });
    expect(n).toBe(0);
  });
  it('never asks about claimed, unavailable or too-early stages, nor when the daily max is reached', async () => {
    const adSeen = vi.fn(async () => true); const claimStage = claimed();
    await healUnclaimedStages({ adSeen, claimStage }, [state({ stages: [stage(1, true), stage(2, true)] }), state({ stages: [stage(2, false, false)] }), state({ today_steps: 100 }), state({ earned_today: 25 })], { memory: new Map() });
    expect(adSeen).not.toHaveBeenCalled(); expect(claimStage).not.toHaveBeenCalled();
  });
  it('a stage that got an answer (true or false) is not asked again; an unknown answer is retried up to three times in all', async () => {
    const memory = new Map<string, number>();
    const no = vi.fn(async () => false);
    await healUnclaimedStages({ adSeen: no, claimStage: claimed() }, [state()], { memory }); await healUnclaimedStages({ adSeen: no, claimStage: claimed() }, [state()], { memory });
    expect(no).toHaveBeenCalledTimes(1);
    const unknown = vi.fn(async () => null); const m2 = new Map<string, number>();
    for (let i = 0; i < 5; i++) await healUnclaimedStages({ adSeen: unknown, claimStage: claimed() }, [state()], { memory: m2 });
    expect(unknown).toHaveBeenCalledTimes(HEAL_MAX_ASKS);
  });
  it('swallows every failure (adSeen throws, claim refused) and keeps going to the next stage', async () => {
    const calls: string[] = [];
    const adSeen = vi.fn(async (purpose: string) => { calls.push(purpose); if (purpose.endsWith('stage_2')) throw new Error('offline'); return true; });
    const claimStage = vi.fn(async () => { throw { code: 'no_ad' }; });
    const s = state({ today_steps: 3500, stages: [stage(2), stage(3)] });
    await expect(healUnclaimedStages({ adSeen, claimStage }, [s], { memory: new Map() })).resolves.toBe(0);
    expect(calls).toHaveLength(2); expect(claimStage).toHaveBeenCalledTimes(1);
  });
  it('stops at once when the caller says it must not run (screen closed, user claiming by hand)', async () => {
    const adSeen = vi.fn(async () => true); let go = true;
    const n = await healUnclaimedStages({ adSeen, claimStage: claimed() }, [state({ today_steps: 3500, stages: [stage(2), stage(3)] })], { memory: new Map(), canRun: () => { const was = go; go = false; return was; } });
    expect(n).toBe(1); expect(adSeen).toHaveBeenCalledTimes(1);
  });
  it('heals yesterday\'s state with yesterday\'s day and since-time', async () => {
    const adSeen = vi.fn(async () => true); const claimStage = claimed();
    await healUnclaimedStages({ adSeen, claimStage }, [null, state({ day: '2026-10-27', stages: [{ ...stage(2), ad_purpose: 'steps_stage:2026-10-27:stage_2' }] })], { memory: new Map() });
    expect(adSeen).toHaveBeenCalledWith('steps_stage:2026-10-27:stage_2', Date.parse('2026-10-27T00:00:00+09:00') / 1000);
    expect(claimStage).toHaveBeenCalledWith('stage_2', '2026-10-27', true);
  });
});
