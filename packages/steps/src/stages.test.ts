import { describe, it, expect } from 'vitest';
import { kstDay, recentDays, mergeDays, emptyBook, todayOf } from './days';
import { DEFAULT_THRESHOLDS, stepsEnabled, canClaimStage, type StepsStage, type StepsState } from './stages';
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
  it('only syncs today and normalizes iOS source', async () => {
    let body: unknown;
    await syncToday([{ date: '2026-10-18', steps: 10000, source: 'sensor' }, { date: '2026-10-19', steps: 1, source: 'coremotion' }], async b => { body = b; }, Date.parse('2026-10-19T07:00:00Z'));
    expect(body).toEqual({ days: [{ date: '2026-10-19', steps: 1, source: 'cmpedometer' }] });
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
