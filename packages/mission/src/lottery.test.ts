import { describe, expect, it, vi } from 'vitest';
import {
  createLotteryOpener, fetchLotteryState, goldenTier, lotteryChipCount, lotteryMoreLabel, lotteryMoreMissionLabel, lotteryResultTitle, lotteryTierButton, lotteryTierHint, lotteryTierTitle,
  lotteryWinnerLine, newLotteryKey, nextTierToEarn, openLottery, parseLotteryState, parseWinners, readyTiers, type LotteryTier,
} from './lottery';

const tier = (over: Partial<LotteryTier> = {}): LotteryTier => ({ tier: 1, missions: 1, maxWon: 100, maxPoints: 160, state: 'locked', missionState: 'locked', missionsLeft: 1, tickets: 0, unopened: 0, basic: 0, basicUnopened: 0, prize: null, ...over });
const wire = (tiers: Partial<LotteryTier>[], over: Record<string, unknown> = {}) => ({ ok: true, day: '2026-10-20', wonToPoint: 160, participated: 0, unopened: 0, tiers: tiers.map((t, i) => tier({ tier: i + 1, ...t })), ...over });

describe('상태 읽기', () => {
  it('서버 응답을 다시 읽고 단계를 번호 순으로, 꺼진 · 깨진 응답은 null', () => {
    const s = parseLotteryState(wire([{ missions: 5, maxWon: 500, state: 'ready', unopened: 1 }, { missions: 1, maxWon: 100 }]).tiers.length ? { ...wire([{}, {}]), tiers: [{ ...tier({ tier: 2, missions: 5, maxWon: 500, state: 'ready', unopened: 1 }) }, { ...tier({ tier: 1 }) }] } : null)!;
    expect(s.tiers.map(t => t.tier)).toEqual([1, 2]);
    expect(s.tiers[1].state).toBe('ready');
    for (const bad of [null, {}, { ok: false }, { ok: true, tiers: [] }, { ok: true, tiers: 'x' }, { ok: true, tiers: [{ tier: 0 }] }, { ok: true, tiers: [null, { tier: 'a' }] }]) expect(parseLotteryState(bad)).toBeNull();
  });
  it('모르는 상태는 locked · 음수는 0 · missionState 가 없으면 state 와 같게', () => {
    const s = parseLotteryState({ ok: true, tiers: [{ tier: 1, state: 'weird', missionsLeft: -3, unopened: -1 }] })!;
    expect(s.tiers[0]).toMatchObject({ state: 'locked', missionState: 'locked', missionsLeft: 0, unopened: 0 });
  });
  it('fetchLotteryState 는 GET lottery/state · 실패하면 null(칩이 안 보인다)', async () => {
    const ok = vi.fn(async () => wire([{}]));
    expect((await fetchLotteryState(ok))!.tiers).toHaveLength(1);
    expect(ok).toHaveBeenCalledWith('lottery/state', { method: 'GET' });
    expect(await fetchLotteryState(async () => { throw Object.assign(new Error('x'), { status: 404 }); })).toBeNull();
  });
  it('당첨 띠는 20개까지 · 이름 없는 줄은 버린다', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ nick: i === 3 ? '' : '김철****', tierMax: 500, won: 100 }));
    expect(parseWinners({ ok: true, items })).toHaveLength(19);
    expect(parseWinners({ ok: false })).toEqual([]);
    expect(parseWinners(null)).toEqual([]);
  });
});

describe('열기', () => {
  it('POST lottery/open 에 단계 · 키 · src 를 싣고 결과를 읽는다', async () => {
    const req = vi.fn(async () => ({ ok: true, tier: 3, maxWon: 1000, won: 200, points: 320, balance: 900, replayed: false, unopened: 1 }));
    const r = await openLottery(req, { tier: 3, key: 'k1', src: 'basic' });
    expect(req).toHaveBeenCalledWith('lottery/open', { method: 'POST', body: { tier: 3, idempotency_key: 'k1', src: 'basic' } });
    expect(r).toEqual({ ok: true, result: { tier: 3, maxWon: 1000, won: 200, points: 320, balance: 900, replayed: false, unopened: 1 } });
    await openLottery(req, { tier: 1, key: 'k2' });
    expect((req.mock.calls[1] as any)[1].body).toEqual({ tier: 1, idempotency_key: 'k2' });
  });
  it('서버 오류 이름은 던져진 오류 · 본문 · 상태 코드 어디서든 읽는다', async () => {
    const thrown = (e: object) => async () => { throw Object.assign(new Error('x'), e); };
    expect((await openLottery(thrown({ error: 'ad_required' }), { tier: 3, key: 'k' }))).toEqual({ ok: false, error: 'ad_required' });
    expect((await openLottery(thrown({ data: { error: 'already_opened' } }), { tier: 1, key: 'k' }))).toEqual({ ok: false, error: 'already_opened' });
    expect((await openLottery(thrown({ status: 404 }), { tier: 1, key: 'k' }))).toEqual({ ok: false, error: 'off' });
    expect((await openLottery(thrown({ status: 503 }), { tier: 1, key: 'k' }))).toEqual({ ok: false, error: 'not_ready' });
    expect((await openLottery(thrown({}), { tier: 1, key: 'k' }))).toEqual({ ok: false, error: 'network' });
    expect((await openLottery(async () => ({ ok: false, error: 'not_reached' }), { tier: 2, key: 'k' }))).toEqual({ ok: false, error: 'not_reached' });
    expect((await openLottery(async () => ({ foo: 1 }), { tier: 2, key: 'k' }))).toEqual({ ok: false, error: 'invalid' });
  });
  it('열기 함수 — 한 번에 하나만, 네트워크 오류 뒤 재시도는 같은 키, 서버가 답한 뒤에는 새 키, 잠금은 반드시 풀린다', async () => {
    const keys: string[] = [];
    let n = 0;
    const req = vi.fn(async (_p: string, o?: any) => {
      keys.push(o.body.idempotency_key);
      n++;
      if (n === 1) throw new Error('offline');
      if (n === 3) throw Object.assign(new Error('x'), { error: 'ad_required' });
      return { ok: true, tier: 1, maxWon: 100, won: 10, points: 16, balance: 16, replayed: false, unopened: 0 };
    });
    const open = createLotteryOpener(req as any);
    expect((await open(1)).ok).toBe(false);                    // 네트워크 오류
    expect((await open(1)).ok).toBe(true);                     // 같은 키로 다시
    expect(keys[1]).toBe(keys[0]);
    expect((await open(1, 'basic'))).toEqual({ ok: false, error: 'ad_required' });
    expect((await open(1)).ok).toBe(true);                     // 서버가 답한 뒤에는 새 키
    expect(keys[3]).not.toBe(keys[0]);
    // 동시에 두 번 — 둘째는 busy, 첫째가 끝나면 다시 열린다
    let release!: () => void;
    const slow = createLotteryOpener((async () => new Promise(res => { release = () => res({ ok: true, tier: 1, maxWon: 100, won: 10, points: 16, balance: 16, replayed: false, unopened: 0 }); })) as any);
    const first = slow(1);
    expect(await slow(1)).toEqual({ ok: false, error: 'busy' });
    release();
    expect((await first).ok).toBe(true);
    const again = slow(1);
    release();
    expect((await again).ok).toBe(true);
  });
  it('열기 키는 매번 다르다', () => {
    expect(new Set(Array.from({ length: 50 }, newLotteryKey)).size).toBe(50);
    expect(newLotteryKey()).toMatch(/^lot-[a-z0-9]+-[a-z0-9]+$/);
  });
});

describe('문구와 판단', () => {
  it('단계 제목 · 설명 · 버튼', () => {
    expect(lotteryTierTitle(tier({ maxWon: 1000 }))).toBe('최대 1,000원 복권');
    expect(lotteryTierHint(tier({ missions: 5, missionsLeft: 5 }))).toBe('쇼핑 · 플레이스 미션 5개 참여하면 받아요');
    expect(lotteryTierHint(tier({ missions: 5, missionsLeft: 2 }))).toBe('미션 2개 더 하면 받아요');
    expect(lotteryTierHint(tier({ missions: 1, missionState: 'ready', state: 'ready' }))).toBe('쇼핑 · 플레이스 미션 1개 참여로 받았어요');
    expect(lotteryTierHint(tier({ missionState: 'capped' }))).toBe('오늘 받을 수 있는 복권을 모두 받았어요');
    expect(lotteryTierHint(tier({ missions: 10, missionsLeft: 10, basic: 1 }))).toBe('황금 복권이나 쇼핑 · 플레이스 미션 10개 참여하면 받아요');
    expect(lotteryTierHint(tier({ missions: 10, missionsLeft: 0, basic: 1 }))).toBe('황금 복권을 이용해서 얻을 수 있어요');
    expect(lotteryTierButton({ state: 'ready' })).toEqual({ label: '열기', kind: 'open' });
    expect(lotteryTierButton({ state: 'opened' })).toEqual({ label: '획득 완료', kind: 'done' });
    expect(lotteryTierButton({ state: 'capped' })).toEqual({ label: '내일 받아요', kind: 'wait' });
    expect(lotteryTierButton({ state: 'locked' })).toEqual({ label: '받기', kind: 'earn' });
  });
  it('다음 단계 · 더 받기 문구 · 결과 제목 · 당첨 띠 · 칩 수', () => {
    const s = parseLotteryState(wire([{ state: 'opened', missionState: 'opened' }, { missions: 5, maxWon: 500, missionsLeft: 3 }, { missions: 10, maxWon: 1000, missionsLeft: 8 }], { unopened: 2 }))!;
    expect(nextTierToEarn(s)!.tier).toBe(2);
    expect(lotteryMoreLabel(s)).toBe('한 번 더! 500원 복권 받기');
    expect(lotteryMoreMissionLabel(s)).toBe('미션 3개 더 하고 500원 복권 받기');
    expect(lotteryResultTitle(1600)).toBe('축하해요 보상 1,600P 당첨!');
    expect(lotteryWinnerLine({ nick: '김철****', tierMax: 500, won: 100 })).toBe('김철****님이 500원 복권에 당첨됐어요!');
    expect(lotteryChipCount(s)).toBe(2);
    expect(lotteryChipCount(null)).toBe(0);
    const all = parseLotteryState(wire([{ missionState: 'opened', state: 'opened' }]))!;
    expect(lotteryMoreLabel(all)).toBeNull();
    expect(lotteryMoreMissionLabel(all)).toBeNull();
  });
  it('황금 복권 대상 · 열 수 있는 단계', () => {
    const s = parseLotteryState(wire([{ unopened: 1, state: 'ready' }, {}, { basic: 1, basicUnopened: 1, unopened: 1, state: 'ready' }]))!;
    expect(goldenTier(s)!.tier).toBe(3);
    expect(readyTiers(s).map(t => t.tier)).toEqual([1, 3]);
    expect(goldenTier(parseLotteryState(wire([{ basic: 1, basicUnopened: 0 }]))!)).toBeNull();
    expect(goldenTier(null)).toBeNull();
    expect(readyTiers(null)).toEqual([]);
  });
});
