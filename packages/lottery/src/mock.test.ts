import { describe, expect, it } from 'vitest';
import { createLotteryOpener, fetchLotteryState, fetchLotteryWinners, goldenTier, openLottery } from './lottery';
import { createMockLotteryApi } from './mock';

describe('createMockLotteryApi — 서버 없이 시뮬에서 보이게', () => {
  it('처음에는 황금(기본) 복권 한 장만 — 미션 복권은 잠김', async () => {
    const m = createMockLotteryApi({ seed: 1 });
    const s = (await fetchLotteryState(m.fetchJson))!;
    expect(s.unopened).toBe(1);
    expect(s.tiers.map(t => t.state)).toEqual(['locked', 'locked', 'ready']);
    expect(goldenTier(s)!.maxWon).toBe(1000);
    expect(m.calls[0].path).toBe('lottery/state');
    expect((await fetchLotteryWinners(m.fetchJson)).length).toBeGreaterThan(0);
  });
  it('미션 수를 올리면 복권이 생기고, 열면 포인트가 나오고, 같은 키는 다시 주고, 이미 열면 이미 열림', async () => {
    const m = createMockLotteryApi({ seed: 7, golden: false });
    m.setParticipated(5);
    const s = (await fetchLotteryState(m.fetchJson))!;
    expect(s.tiers.map(t => t.state)).toEqual(['ready', 'ready', 'locked']);
    const a = await openLottery(m.fetchJson, { tier: 2, key: 'k1' });
    expect(a.ok && a.result.points).toBeGreaterThan(0);
    const again = await openLottery(m.fetchJson, { tier: 2, key: 'k1' });
    expect(again.ok && again.result.replayed).toBe(true);
    expect(again.ok && again.result.points).toBe(a.ok && a.result.points);
    expect(await openLottery(m.fetchJson, { tier: 2, key: 'k2' })).toEqual({ ok: false, error: 'already_opened' });
    expect(await openLottery(m.fetchJson, { tier: 1, key: 'k1' })).toEqual({ ok: false, error: 'key_conflict' });
    expect(await openLottery(m.fetchJson, { tier: 3, key: 'k3' })).toEqual({ ok: false, error: 'not_reached' });
    expect(await openLottery(m.fetchJson, { tier: 9, key: 'k4' })).toEqual({ ok: false, error: 'bad_tier' });
    expect(await openLottery(m.fetchJson, { tier: 1, key: 'bad key!' })).toEqual({ ok: false, error: 'bad_key' });
  });
  it('황금 복권은 광고 확인이 있어야 열린다(grantAd) · adFree 면 바로', async () => {
    const m = createMockLotteryApi({ seed: 3 });
    const open = createLotteryOpener(m.fetchJson);
    expect(await open(3, 'basic')).toEqual({ ok: false, error: 'ad_required' });
    m.grantAd();
    const r = await open(3, 'basic');
    expect(r.ok && r.result.won).toBeGreaterThan(0);
    expect((await fetchLotteryState(m.fetchJson))!.unopened).toBe(0);
    const free = createMockLotteryApi({ seed: 3, adFree: true });
    expect((await openLottery(free.fetchJson, { tier: 3, key: 'x', src: 'basic' })).ok).toBe(true);
  });
  it('서버 꺼짐(off) 은 404 라 state 가 null — 같은 씨앗이면 같은 추첨 — reset 으로 처음부터', async () => {
    expect(await fetchLotteryState(createMockLotteryApi({ off: true }).fetchJson)).toBeNull();
    const a = createMockLotteryApi({ seed: 42, adFree: true });
    const b = createMockLotteryApi({ seed: 42, adFree: true });
    const ra = await openLottery(a.fetchJson, { tier: 3, key: 'a' });
    const rb = await openLottery(b.fetchJson, { tier: 3, key: 'a' });
    expect(ra).toEqual(rb);
    a.reset();
    expect(a.calls).toHaveLength(0);
    expect((await fetchLotteryState(a.fetchJson))!.unopened).toBe(1);
  });
});
