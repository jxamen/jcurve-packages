import { describe, expect, it } from 'vitest';
import { createLotteryOpener, fetchLotteryState, fetchLotteryWinners, goldenTier, lotteryChipCount, openLottery, readyTiers } from './lottery';
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
  it('5단계(1 · 5 · 10 · 20 · 30)도 줄 수 있다 — tiers 옵션(0.1.4 시험 예)', async () => {
    const m = createMockLotteryApi({ seed: 3, golden: false, tiers: [1, 5, 10, 20, 30].map(n => ({ missions: n, max: n * 100 })) });
    m.setParticipated(20);
    const s = (await fetchLotteryState(m.fetchJson))!;
    expect(s.tiers.map(t => t.missions)).toEqual([1, 5, 10, 20, 30]);
    expect(s.tiers.map(t => t.state)).toEqual(['ready', 'ready', 'ready', 'ready', 'locked']);
    expect(s.tiers.map(t => t.maxWon)).toEqual([100, 500, 1000, 2000, 3000]);
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
  it('adFree 를 false 로 두면 황금 복권은 서버처럼 광고 확인이 있어야 열린다(grantAd) · 기본은 시뮬이 막히지 않게 바로', async () => {
    const m = createMockLotteryApi({ seed: 3, adFree: false });
    const open = createLotteryOpener(m.fetchJson);
    expect(await open(3, 'basic')).toEqual({ ok: false, error: 'ad_required' });
    m.grantAd();
    const r = await open(3, 'basic');
    expect(r.ok && r.result.won).toBeGreaterThan(0);
    expect((await fetchLotteryState(m.fetchJson))!.unopened).toBe(0);
    const free = createMockLotteryApi({ seed: 3 });
    expect((await openLottery(free.fetchJson, { tier: 3, key: 'x', src: 'basic' })).ok).toBe(true);
  });
  it('열 때마다 남은 장수가 줄어 0이 되면 칩이 사라진다(감자밭 시뮬: 「다음 복권 열기」가 같은 결과를 계속 주던 것)', async () => {
    const m = createMockLotteryApi({ seed: 5, participated: 10 });            // 미션 복권 3장 + 황금 1장
    const open = createLotteryOpener(m.fetchJson);
    expect((await fetchLotteryState(m.fetchJson))!.unopened).toBe(4);
    const left: number[] = [];
    for (let i = 0; i < 4; i++) {
      const s = (await fetchLotteryState(m.fetchJson))!;
      const next = readyTiers(s)[0];
      const r = await open(next.tier);
      expect(r.ok).toBe(true);
      if (r.ok) left.push(r.result.unopened);
    }
    expect(left).toEqual([3, 2, 1, 0]);
    const end = (await fetchLotteryState(m.fetchJson))!;
    expect(lotteryChipCount(end)).toBe(0);
    expect(readyTiers(end)).toEqual([]);
    expect(await open(1)).toEqual({ ok: false, error: 'already_opened' });
  });
  it('서버 꺼짐(off) 은 404 라 state 가 null — 같은 씨앗이면 같은 추첨 — reset 으로 처음부터', async () => {
    expect(await fetchLotteryState(createMockLotteryApi({ off: true }).fetchJson)).toBeNull();
    const a = createMockLotteryApi({ seed: 42 });
    const b = createMockLotteryApi({ seed: 42 });
    const ra = await openLottery(a.fetchJson, { tier: 3, key: 'a' });
    const rb = await openLottery(b.fetchJson, { tier: 3, key: 'a' });
    expect(ra).toEqual(rb);
    a.reset();
    expect(a.calls).toHaveLength(0);
    expect((await fetchLotteryState(a.fetchJson))!.unopened).toBe(1);
  });
});
