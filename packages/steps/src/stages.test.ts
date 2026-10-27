import { describe, it, expect } from 'vitest';
import { kstDay, recentDays, mergeDays, emptyBook, todayOf, yesterdayKst, keepRecent, stepsOn } from './days';
import { DEFAULT_THRESHOLDS, stepsEnabled, canClaimStage, claimableStages, yesterdayView, type StepsStage, type StepsState } from './stages';
import { syncToday } from './sync';
describe('daily steps', () => {
  it('uses KST midnight', () => {
    expect(kstDay(Date.parse('2026-10-19T14:59:59Z'))).toBe('2026-10-19');
    expect(kstDay(Date.parse('2026-10-19T15:00:00Z'))).toBe('2026-10-20');
    expect(recentDays(Date.parse('2026-10-19T15:01:00Z'), 1)[0].start).toBe(Date.parse('2026-10-19T15:00:00Z'));
  });
  it('keeps maxima without carryover', () => {
    const now = Date.parse('2026-10-19T07:00:00Z');
    const book = mergeDays(emptyBook(), [{ date: '2026-10-18', steps: 10000, source: 'sensor' }, { date: '2026-10-19', steps: 3000, source: 'sensor' }, { date: '2026-10-19', steps: 2000, source: 'healthconnect' }]);
    expect(todayOf(book, now)).toBe(3000); expect(todayOf(book, now + 86400000)).toBe(0);
  });
  it('syncs today and yesterday only (never older), normalizes iOS source', async () => {
    let body: unknown;
    const now = Date.parse('2026-10-19T07:00:00Z');
    await syncToday([{ date: '2026-10-17', steps: 9, source: 'sensor' }, { date: '2026-10-18', steps: 10000, source: 'sensor' }, { date: '2026-10-19', steps: 1, source: 'coremotion' }, { date: '2026-10-20', steps: 5, source: 'sensor' }], async b => { body = b; }, now);
    expect(body).toEqual({ days: [{ date: '2026-10-18', steps: 10000, source: 'sensor' }, { date: '2026-10-19', steps: 1, source: 'cmpedometer' }] });
    expect(await syncToday([{ date: '2026-10-10', steps: 3, source: 'sensor' }], async () => 'sent', now)).toBeNull();
  });
  it('yesterday is the previous KST date, also around midnight', () => {
    expect(yesterdayKst(Date.parse('2026-10-19T15:00:00Z'))).toBe('2026-10-19'); // KST 10-20 00:00 → yesterday 10-19
    expect(yesterdayKst(Date.parse('2026-10-19T14:59:59Z'))).toBe('2026-10-18'); // KST 10-19 23:59:59
    expect(yesterdayKst(Date.parse('2026-03-01T00:00:00Z'))).toBe('2026-02-28'); // month edge
    expect(yesterdayKst(Date.parse('2027-01-01T00:00:00Z'))).toBe('2026-12-31'); // year edge
    expect(keepRecent([{ date: '2026-10-18', steps: 1, source: 'sensor' }, { date: '2026-10-19', steps: 2, source: 'sensor' }, { date: '2026-10-16', steps: 3, source: 'sensor' }], Date.parse('2026-10-19T07:00:00Z')).map(d => d.date)).toEqual(['2026-10-18', '2026-10-19']);
  });
  it('stepsOn picks that day only (the largest record), null when there is none', () => {
    const days = [{ date: '2026-10-18', steps: 9000, source: 'sensor' as const }, { date: '2026-10-19', steps: 10, source: 'sensor' as const }, { date: '2026-10-19', steps: 25, source: 'healthconnect' as const }];
    expect(stepsOn(days, '2026-10-19')).toBe(25); expect(stepsOn(days, '2026-10-18')).toBe(9000); expect(stepsOn(days, '2026-10-17')).toBeNull();
  });
  it('defaults off and gates claimed stages and cap', () => {
    expect(DEFAULT_THRESHOLDS).toEqual([1,1000,3000,5000,10000]); expect(stepsEnabled()).toBe(false);
    expect(stepsEnabled({ 'steps.on': '1' })).toBe(true);
    const stage: StepsStage = { stage_id: 'stage_1', threshold: 1, points: 5, claimed: false, available: true, ad_purpose: 'p' };
    const state: StepsState = { ok: true, day: '2026-10-19', today_steps: 1, earned_today: 20, daily_max: 25, stages: [stage] };
    expect(canClaimStage(state, stage)).toBe(true); expect(canClaimStage({ ...state, today_steps: 0 }, stage)).toBe(false);
    expect(canClaimStage({ ...state, earned_today: 25 }, stage)).toBe(false); expect(canClaimStage(state, { ...stage, claimed: true })).toBe(false);
  });
});

describe('yesterdayView (server state of yesterday)', () => {
  const now = Date.parse('2026-10-20T07:00:00Z'); // KST 10-20 → yesterday 2026-10-19
  const stage = (i: number, over: Partial<StepsStage> = {}): StepsStage => ({ stage_id: 'stage_' + i, threshold: i * 1000, points: 5, claimed: false, available: true, ad_purpose: 'steps_stage:2026-10-19:stage_' + i, ...over });
  const state = (over: Partial<StepsState> = {}): StepsState => ({ ok: true, day: '2026-10-19', today_steps: 3200, earned_today: 5, daily_max: 250, stages: [stage(1, { claimed: true }), stage(2), stage(3), stage(4)], ...over });
  it('shows what the server says is still claimable (2 and 3 here; 4 needs more steps)', () => {
    const v = yesterdayView(state(), now);
    expect(v).toMatchObject({ show: true, day: '2026-10-19', steps: 3200, left: 2, points: 5, earned: 5 });
    expect(v.first?.stage_id).toBe('stage_2');
    expect(claimableStages(state()).map(x => x.stage_id)).toEqual(['stage_2', 'stage_3']);
  });
  it('hides when nothing is left: no steps, everything claimed, daily max reached, or the server marks them unavailable', () => {
    expect(yesterdayView(state({ today_steps: 0 }), now).show).toBe(false);
    expect(yesterdayView(state({ stages: [stage(1, { claimed: true }), stage(2, { claimed: true })] }), now).show).toBe(false);
    expect(yesterdayView(state({ earned_today: 250 }), now).show).toBe(false);
    expect(yesterdayView(state({ stages: [stage(1, { available: false }), stage(2, { available: false })] }), now).show).toBe(false);
  });
  it('hides when the state is missing or is not yesterday (midnight passed, or the server answered with today)', () => {
    expect(yesterdayView(null, now).show).toBe(false);
    expect(yesterdayView(undefined, now).show).toBe(false);
    expect(yesterdayView(state({ day: '2026-10-20' }), now).show).toBe(false);
    expect(yesterdayView(state({ day: '2026-10-18' }), now).show).toBe(false);
    expect(yesterdayView(state(), Date.parse('2026-10-21T07:00:00Z')).show).toBe(false); // the app stayed open past the next midnight
  });
});
