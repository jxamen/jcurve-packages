import { describe, expect, it, vi } from 'vitest';
import {
  createLotteryOpener, fetchLotteryState, goldenLines, goldenRow, goldenTier, lotteryChipCount, lotteryMissionButton, lotteryMissionHint, lotteryMoreLabel, lotteryMoreMissionLabel,
  lotteryResultHeadline, lotteryResultTitle, lotteryTierAmount, lotteryTierButton, lotteryTierHint, lotteryTierTitle, lotteryWinnerLine, lotteryWinnerParts,
  newLotteryKey, nextTierToEarn, openLottery, parseLotteryState, parseWinners, readyTiers, toLotteryError, type LotteryTier,
} from './lottery';

const tier = (over: Partial<LotteryTier> = {}): LotteryTier => ({ tier: 1, missions: 1, maxWon: 100, maxPoints: 160, state: 'locked', missionState: 'locked', missionsLeft: 1, tickets: 0, unopened: 0, basic: 0, basicUnopened: 0, prize: null, unit: 'won', ...over });
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
    expect(r).toEqual({ ok: true, result: { tier: 3, maxWon: 1000, won: 200, points: 320, balance: 900, replayed: false, unopened: 1, unit: 'won' } });
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

describe('toLotteryError — 앱 요청 함수가 던지는 꼴을 그대로 읽는다', () => {
  it('ApiError.code · error · data.error · body.error · status', () => {
    const e = (o: object) => Object.assign(new Error('x'), o);
    expect(toLotteryError(e({ code: 'ad_required', status: 409 }))).toBe('ad_required');         // 앱 ApiError(code · status)
    expect(toLotteryError(e({ error: 'already_opened' }))).toBe('already_opened');
    expect(toLotteryError(e({ data: { error: 'key_conflict' } }))).toBe('key_conflict');
    expect(toLotteryError(e({ body: { error: 'not_reached' } }))).toBe('not_reached');
    expect(toLotteryError(e({ code: 'network' }))).toBe('network');
    expect(toLotteryError(e({ code: 'timeout' }))).toBe('network');
    expect(toLotteryError(e({ status: 404, code: 'weird' }))).toBe('off');
    expect(toLotteryError(e({ status: 503 }))).toBe('not_ready');
    expect(toLotteryError(null)).toBe('network');
    expect(toLotteryError('boom')).toBe('network');
  });
  it('openLottery 가 앱의 ApiError 꼴을 바꿔 던지지 않아도 읽는다', async () => {
    const apiError = (code: string, status: number) => async () => { throw Object.assign(new Error(code), { code, status }); };
    expect(await openLottery(apiError('ad_required', 409), { tier: 3, key: 'k', src: 'basic' })).toEqual({ ok: false, error: 'ad_required' });
    expect(await openLottery(apiError('not_found', 404), { tier: 1, key: 'k' })).toEqual({ ok: false, error: 'off' });
  });
});

describe('포인트 표(unit:points) — 읽기와 문구(0.1.3)', () => {
  it('state 단계 · 열기 결과 · 당첨 띠가 unit 과 P 를 읽고, 없으면 원 표(옛 응답 그대로)', () => {
    const s = parseLotteryState({ ok: true, day: 'd', wonToPoint: 160, participated: 1, unopened: 1, tiers: [
      { tier: 1, missions: 1, maxWon: 625, maxPoints: 1000, unit: 'points', state: 'ready', missionState: 'ready', missionsLeft: 0, tickets: 1, unopened: 1, basic: 0, basicUnopened: 0, prize: null },
      { tier: 2, missions: 5, maxWon: 500, maxPoints: 800, state: 'locked', missionState: 'locked', missionsLeft: 4, tickets: 0, unopened: 0, basic: 0, basicUnopened: 0, prize: null },
    ] })!;
    expect(s.tiers.map(t => t.unit)).toEqual(['points', 'won']);
    expect(lotteryTierTitle(s.tiers[0])).toBe('최대 1,000P 복권');
    expect(lotteryTierTitle(s.tiers[1])).toBe('최대 500원 복권');
    expect(lotteryTierAmount(s.tiers[0])).toBe('1,000P');
    expect(lotteryMoreLabel(parseLotteryState({ ok: true, day: 'd', wonToPoint: 160, participated: 0, unopened: 0, tiers: [{ tier: 1, missions: 1, maxWon: 625, maxPoints: 1000, unit: 'points', state: 'locked', missionState: 'locked', missionsLeft: 1 }] }))).toBe('한 번 더! 최대 1,000P 복권 받기');
    expect(lotteryMoreLabel(s)).toBe('한 번 더! 500원 복권 받기');
    const w = parseWinners({ ok: true, items: [
      { nick: 'Noe****', tierMax: 625, won: 3, unit: 'points', points: 5, tierMaxPoints: 1000 },
      { nick: 'Kim****', tierMax: 500, won: 500 },
    ] });
    expect(w).toEqual([
      { nick: 'Noe****', tierMax: 625, won: 3, unit: 'points', points: 5, tierMaxPoints: 1000 },
      { nick: 'Kim****', tierMax: 500, won: 500, unit: 'won' },
    ]);
    expect(lotteryWinnerLine(w[0])).toBe('Noe****님이 5P 당첨됐어요!');
    expect(lotteryWinnerParts(w[0])).toEqual({ pre: 'Noe****님이 ', amount: '5P', post: ' 당첨됐어요!' });
    expect(lotteryWinnerLine(w[1])).toBe('Kim****님이 500원 복권에 당첨됐어요!');
  });
  it('열기 결과: unit points 면 unit · maxPoints 를 싣는다', async () => {
    const r = await openLottery(async () => ({ ok: true, tier: 1, maxWon: 625, maxPoints: 1000, unit: 'points', won: 3, points: 5, balance: 5, replayed: false, unopened: 0 }), { tier: 1, key: 'k' });
    expect(r).toEqual({ ok: true, result: { tier: 1, maxWon: 625, won: 3, points: 5, balance: 5, replayed: false, unopened: 0, unit: 'points', maxPoints: 1000 } });
  });
  it('당첨 화면 큰 제목은 「5P 당첨!」, 황금 줄 · 미션 줄 문구와 버튼', () => {
    expect(lotteryResultHeadline(5)).toBe('5P 당첨!');
    expect(lotteryResultHeadline(1000)).toBe('1,000P 당첨!');
    expect(lotteryMissionButton({ missionState: 'ready' })).toEqual({ label: '열기', kind: 'open' });
    expect(lotteryMissionButton({ missionState: 'locked' })).toEqual({ label: '받기', kind: 'earn' });
    expect(lotteryMissionButton({ missionState: 'opened' })).toEqual({ label: '받기 완료', kind: 'done' });
    expect(lotteryMissionButton({ missionState: 'capped' })).toEqual({ label: '내일 받아요', kind: 'wait' });
    expect(lotteryMissionHint({ missions: 1, missionsLeft: 1, missionState: 'locked' })).toBe('미션 1개 하면 받아요');
    expect(lotteryMissionHint({ missions: 5, missionsLeft: 3, missionState: 'locked' })).toBe('미션 3개 더 하면 받아요');
    // 받은 뒤(ready · opened)에도 같은 말 — 「미션 N개로 받았어요」 폐지(0.1.4, 대표님 16:37)
    expect(lotteryMissionHint({ missions: 5, missionsLeft: 0, missionState: 'opened' })).toBe('미션 5개 하면 받아요');
    expect(lotteryMissionHint({ missions: 10, missionsLeft: 0, missionState: 'ready' })).toBe('미션 10개 하면 받아요');
    expect(lotteryMissionHint({ missions: 5, missionsLeft: 0, missionState: 'capped' })).toBe('내일 다시 받을 수 있어요');
  });
  it('미션 줄 설명은 어느 상태에서도 「받았어요」를 쓰지 않고, 1 · 5 · 10 · 20 · 30 줄이 같은 문장 꼴이다(0.1.4)', () => {
    const states = ['ready', 'opened', 'locked', 'capped'] as const;
    for (const missions of [1, 5, 10, 20, 30]) {
      for (const missionState of states) {
        for (const missionsLeft of [0, 1, missions - 1, missions]) {
          expect(lotteryMissionHint({ missions, missionsLeft, missionState })).not.toContain('받았어요');
        }
      }
      for (const missionState of ['ready', 'opened'] as const) {
        expect(lotteryMissionHint({ missions, missionsLeft: 0, missionState })).toBe('미션 ' + missions + '개 하면 받아요');
      }
      expect(lotteryMissionHint({ missions, missionsLeft: missions, missionState: 'locked' })).toBe('미션 ' + missions + '개 하면 받아요');   // 안 했으면 ready · opened 와 같은 문장
    }
  });
  it('goldenRow: 기본 복권이 있는 단계, 없으면 null · goldenLines 포인트 표는 P 만', () => {
    const mk = (tiers: any[]) => parseLotteryState({ ok: true, day: 'd', wonToPoint: 160, participated: 0, unopened: 0, tiers: tiers.map((t, i) => ({ tier: i + 1, missions: i + 1, maxWon: 100, maxPoints: 160, state: 'locked', missionState: 'locked', missionsLeft: 1, tickets: 0, unopened: 0, basic: 0, basicUnopened: 0, ...t })) });
    expect(goldenRow(mk([{}, {}]))).toBeNull();
    const g = goldenRow(mk([{}, { basic: 1, basicUnopened: 1 }]))!;
    expect([g.tier.tier, g.unopened, g.total]).toEqual([2, 1, 1]);
    expect(goldenRow(null)).toBeNull();
    expect(goldenLines({ maxWon: 625, maxPoints: 1000, unit: 'points' }).lines[2]).toBe('최대 1,000P가 바로 들어와요');
    expect(goldenLines({ maxWon: 1000, maxPoints: 1600 }).lines[2]).toBe('최대 1,000원(1,600P)이 포인트로 바로 들어와요');
  });
});
