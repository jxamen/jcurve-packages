import { describe, expect, it, vi } from 'vitest';
import { createAdRecovery, createPendingAds, MAX_PENDING_AGE, parseStepsStagePurpose, resolvePurpose, stepsStageRule, undeclaredPurposes, type PurposeTable } from './recovery';

const memory = () => { const store = new Map<string, string>(); return { store, storage: { get: async (k: string) => store.get(k) ?? null, set: async (k: string, v: string) => { store.set(k, v); } } }; };
const setup = () => createPendingAds(memory().storage, 'test.pendingAds');
const row = { id: 'unique', purpose: 'ticket', memberId: '7', openedAt: Date.now() };
const claimRule = (claim: (key: string) => Promise<unknown>) => ({ kind: 'claim' as const, claim });

describe('pending ads store (캐시팡팡 pendingAd.ts 시험 이전)', () => {
  it('같은 열림은 한 건만 저장하고 종료하면 삭제한다', async () => {
    const p = setup(); await Promise.all([p.add(row), p.add(row)]);
    expect(await p.list()).toEqual([row]); await p.remove(row.id); expect(await p.list()).toEqual([]);
  });
  it('24시간 지난 건을 정리한다', async () => {
    const p = setup(); await p.add(row); expect(await p.list(row.openedAt + MAX_PENDING_AGE)).toEqual([]);
  });
  it('깨진 저장값은 빈 목록으로 읽는다', async () => {
    const { store, storage } = memory(); store.set('k', '{not json'); expect(await createPendingAds(storage, 'k').list()).toEqual([]);
  });
});

describe('createAdRecovery', () => {
  it.each(['ticket', 'reroll', 'balloon_blow', 'cash', 'draw'])('%s: seen 이면 한 번 청구하고 삭제 · 갱신 · 안내한다 (같은 실행에서 두 번 불러도 한 번)', async (purpose) => {
    const pending = setup(); await pending.add({ ...row, purpose });
    const claim = vi.fn(async () => {}); const refresh = vi.fn(async () => {}); const say = vi.fn();
    const run = createAdRecovery();
    const o = { pending, memberId: '7', seen: async () => true, purposes: { [purpose]: claimRule(claim) }, refresh, say };
    await Promise.all([run(o), run(o)]);
    expect(claim).toHaveBeenCalledTimes(1); expect(claim).toHaveBeenCalledWith('ad-recovery:unique', expect.objectContaining({ id: 'unique' }));
    expect(await pending.list()).toEqual([]); expect(refresh).toHaveBeenCalledTimes(1); expect(say).toHaveBeenCalledWith('광고 보상을 받았어요');
  });
  it.each(['no_ad', 'duplicate', 'already', 'already_claimed', 'network', 'timeout'])('오류 %s 의 보존 여부', async (code) => {
    const pending = setup(); await pending.add(row); const say = vi.fn();
    await createAdRecovery()({ pending, memberId: '7', seen: async () => true, purposes: { ticket: claimRule(async () => { throw { code }; }) }, refresh: async () => {}, say });
    expect((await pending.list()).length).toBe(['network', 'timeout'].includes(code) ? 1 : 0); expect(say).not.toHaveBeenCalled();
  });
  it('SSV 가 아직 없으면(false) 청구하지 않고 보존한다', async () => {
    const pending = setup(); await pending.add(row); const claim = vi.fn();
    await createAdRecovery()({ pending, memberId: '7', seen: async () => false, purposes: { ticket: claimRule(claim) }, refresh: async () => {}, say: vi.fn() });
    expect(claim).not.toHaveBeenCalled(); expect(await pending.list()).toEqual([row]);
  });
  it('확인 경로가 없으면(null) 청구 경로가 서버 확인을 대신해 바로 청구한다 (꿀꿀 방식)', async () => {
    const pending = setup(); await pending.add(row); const claim = vi.fn(async () => ({}));
    await createAdRecovery()({ pending, memberId: '7', seen: async () => null, purposes: { ticket: claimRule(claim) }, refresh: async () => {}, say: vi.fn() });
    expect(claim).toHaveBeenCalledTimes(1); expect(await pending.list()).toEqual([]);
  });
  it('청구가 ok:false 로 거절하면(뽑기) 안내 · 새로고침 없이 조용히 지운다', async () => {
    const pending = setup(); await pending.add({ ...row, purpose: 'draw' }); const say = vi.fn(); const refresh = vi.fn(async () => {});
    await createAdRecovery()({ pending, memberId: '7', seen: async () => true, purposes: { draw: claimRule(async () => ({ ok: false })) }, refresh, say });
    expect(say).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled(); expect(await pending.list()).toEqual([]);
  });
  it('다른 회원의 기록은 건드리지 않는다', async () => {
    const pending = setup(); await pending.add({ ...row, memberId: '9' }); const claim = vi.fn();
    await createAdRecovery()({ pending, memberId: '7', seen: async () => true, purposes: { ticket: claimRule(claim) }, refresh: async () => {}, say: vi.fn() });
    expect(claim).not.toHaveBeenCalled(); expect(await pending.list()).toHaveLength(1);
  });
});

describe('용도 표 — 접두 일치 · 선언 (0.2.0 의 달라진 점)', () => {
  const table = (claim: () => Promise<unknown>): PurposeTable => ({ 'steps_stage:*': claimRule(claim), 'steps_stage:2026-10-28:*': { kind: 'skip', why: 'x' }, ticket: claimRule(claim) });
  it('이름 정확 일치가 접두보다 먼저, 접두끼리는 더 긴 쪽이 먼저', () => {
    const t: PurposeTable = { 'a:*': claimRule(async () => 1), 'a:b:*': { kind: 'skip', why: 's' }, 'a:b:c': claimRule(async () => 2) };
    expect(resolvePurpose(t, 'a:b:c')?.kind).toBe('claim');
    expect(resolvePurpose(t, 'a:b:d')?.kind).toBe('skip');
    expect(resolvePurpose(t, 'a:z')?.kind).toBe('claim');
    expect(resolvePurpose(t, 'b:z')).toBeUndefined();
    expect(resolvePurpose({ '*': claimRule(async () => 1) }, 'anything')).toBeUndefined();   // 접두가 비어 있는 별표는 쓰지 않는다
  });
  it('걷기 단계 용도 steps_stage:<날짜>:<단계> 가 접두 갈래로 청구된다 — 꿀꿀의 「이름이 없어 조용히 삭제」가 없다', async () => {
    const pending = setup(); await pending.add({ ...row, id: 'w1', purpose: 'steps_stage:2026-10-27:stage_2' });
    const claim = vi.fn(async () => ({}));
    await createAdRecovery()({ pending, memberId: '7', seen: async () => true, purposes: { 'steps_stage:*': claimRule(claim) }, refresh: async () => {}, say: vi.fn() });
    expect(claim).toHaveBeenCalledWith('ad-recovery:w1', expect.objectContaining({ purpose: 'steps_stage:2026-10-27:stage_2' })); expect(await pending.list()).toEqual([]);
  });
  it('선언 안 된 용도는 지우지 않고 남기며 실행마다 용도당 한 번 알린다 (청구 · 확인도 안 한다)', async () => {
    const pending = setup(); await pending.add({ ...row, id: 'u1', purpose: 'mystery' }); await pending.add({ ...row, id: 'u2', purpose: 'mystery' });
    const seen = vi.fn(async () => true); const onUndeclared = vi.fn();
    await createAdRecovery()({ pending, memberId: '7', seen, purposes: {}, refresh: async () => {}, say: vi.fn(), onUndeclared });
    expect(onUndeclared).toHaveBeenCalledTimes(1); expect(onUndeclared).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'mystery' }));
    expect(seen).not.toHaveBeenCalled(); expect((await pending.list()).map((r) => r.id)).toEqual(['u1', 'u2']);
  });
  it('onUndeclared 가 던져도 복구는 계속된다', async () => {
    const pending = setup(); await pending.add({ ...row, id: 'u1', purpose: 'mystery' }); await pending.add(row); const claim = vi.fn(async () => ({}));
    await createAdRecovery()({ pending, memberId: '7', seen: async () => true, purposes: { ticket: claimRule(claim) }, refresh: async () => {}, say: vi.fn(), onUndeclared: () => { throw new Error('log failed'); } });
    expect(claim).toHaveBeenCalledTimes(1);
  });
  it('skip 으로 선언한 용도의 기록은 확인 · 청구 없이 지운다 (캐시팡팡 「미지원 용도」 시험의 선언판)', async () => {
    const pending = setup(); await pending.add({ ...row, purpose: 'lottery_basic' }); const seen = vi.fn(); const onUndeclared = vi.fn();
    await createAdRecovery()({ pending, memberId: '7', seen, purposes: { lottery_basic: { kind: 'skip', why: '복권 쪽이 되살린다' } }, refresh: async () => {}, say: vi.fn(), onUndeclared });
    expect(seen).not.toHaveBeenCalled(); expect(onUndeclared).not.toHaveBeenCalled(); expect(await pending.list()).toEqual([]);
  });
  it('undeclaredPurposes: 앱의 용도 목록에서 표에 빠진 이름을 찾아 준다 (앱 시험용)', () => {
    expect(undeclaredPurposes(['ticket', 'steps_stage:2026-10-28:stage_1', 'shake', 'meal'], table(async () => 1))).toEqual(['shake', 'meal']);
    expect(undeclaredPurposes([], {})).toEqual([]);
  });
});

describe('0.2.1 — only 과 걷기 용도 해석', () => {
  it('only 에 안 걸리는 용도의 기록은 건드리지도 알리지도 않는다 (꿀꿀의 복권 분리)', async () => {
    const pending = setup(); await pending.add({ ...row, id: 'l1', purpose: 'lottery_basic' }); await pending.add(row);
    const claim = vi.fn(async () => ({})); const seen = vi.fn(async () => true); const onUndeclared = vi.fn();
    await createAdRecovery()({ pending, memberId: '7', only: (p) => p !== 'lottery_basic', seen, purposes: { ticket: claimRule(claim) }, refresh: async () => {}, say: vi.fn(), onUndeclared });
    expect(claim).toHaveBeenCalledTimes(1); expect(seen).toHaveBeenCalledTimes(1); expect(onUndeclared).not.toHaveBeenCalled();
    expect((await pending.list()).map((r) => r.id)).toEqual(['l1']);
  });
  it('parseStepsStagePurpose: steps_stage:<날짜>:<단계> 만 풀고 나머지는 null', () => {
    expect(parseStepsStagePurpose('steps_stage:2026-10-28:stage_2')).toEqual({ day: '2026-10-28', stageId: 'stage_2' });
    for (const bad of ['steps_stage:2026-10-28', 'steps_stage:28-10-2026:stage_2', 'steps_stage:2026-10-28:stage_0', 'steps_stage:2026-10-28:stage_99x', 'steps_2', '', 'steps_stage:2026-10-28:stage_2:x']) expect(parseStepsStagePurpose(bad), bad).toBeNull();
  });
  it('걷기 청구가 날짜 지남 · 없는 단계로 거절하면(day_changed · bad_day · bad_stage) 기록을 지우고, 네트워크 오류는 남긴다', async () => {
    for (const [code, kept] of [['day_changed', 0], ['bad_day', 0], ['bad_stage', 0], ['network', 1]] as const) {
      const pending = setup(); await pending.add({ ...row, purpose: 'steps_stage:2026-10-20:stage_2' });
      await createAdRecovery()({ pending, memberId: '7', seen: async () => true, purposes: { 'steps_stage:*': claimRule(async () => { throw { code }; }) }, refresh: async () => {}, say: vi.fn() });
      expect((await pending.list()).length, code).toBe(kept);
    }
  });
});

describe('0.2.2 — 캐시팡팡 10-23 「대기 뿌리 뽑기」 줄 (30분 · settled) 을 패키지로', () => {
  const run = (o: Record<string, unknown>) => createAdRecovery()({ memberId: '7', refresh: async () => {}, say: vi.fn(), ...o } as never);
  it('maxAgeMs: 30분 줄은 30분 넘은 기록을 목록에서 정리한다 (기본 24시간은 그대로)', async () => {
    const short = createPendingAds(memory().storage, 'k', { maxAgeMs: 30 * 60 * 1000 }); await short.add(row);
    expect(short.maxAgeMs).toBe(1_800_000); expect(await short.list(row.openedAt + 31 * 60 * 1000)).toEqual([]);
    expect(setup().maxAgeMs).toBe(MAX_PENDING_AGE);
  });
  it.each(['claimed', 'expired'])('settled(%s) 는 청구 · 0P 안내 없이 기록만 지운다', async (settledBy) => {
    const pending = setup(); await pending.add(row); const claim = vi.fn(); const say = vi.fn(); const refresh = vi.fn(async () => {});
    await run({ pending, seen: async () => ({ seen: false, settled: true, settledPoints: 0, settledBy }), purposes: { ticket: claimRule(claim) }, say, refresh });
    expect(claim).not.toHaveBeenCalled(); expect(say).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled(); expect(await pending.list()).toEqual([]);
  });
  it('settledPoints > 0 이면 청구 없이 기존 안내만 낸다', async () => {
    const pending = setup(); await pending.add(row); const claim = vi.fn(); const say = vi.fn(); const refresh = vi.fn(async () => {});
    await run({ pending, seen: async () => ({ settled: true, settledPoints: 3 }), purposes: { ticket: claimRule(claim) }, say, refresh });
    expect(claim).not.toHaveBeenCalled(); expect(say).toHaveBeenCalledTimes(1); expect(refresh).toHaveBeenCalledTimes(1); expect(await pending.list()).toEqual([]);
  });
  it('객체 응답: seen:true 면 청구, seen 이 true 가 아니면(false · 없음) 남긴다', async () => {
    for (const [status, claims] of [[{ seen: true }, 1], [{ seen: false }, 0], [{}, 0]] as const) {
      const pending = setup(); await pending.add(row); const claim = vi.fn(async () => ({}));
      await run({ pending, seen: async () => status, purposes: { ticket: claimRule(claim) } });
      expect(claim).toHaveBeenCalledTimes(claims); expect((await pending.list()).length).toBe(claims ? 0 : 1);
    }
  });
  it('저장소 나이가 맞지 않아도 복구 루프에서 한 번 더 30분 넘은 기록을 지운다', async () => {
    const pending = createPendingAds(memory().storage, 'k', { maxAgeMs: 60_000 }); await pending.add({ ...row, openedAt: Date.now() - 30_000 });
    const claim = vi.fn(async () => ({}));
    await run({ pending, seen: async () => false, purposes: { ticket: claimRule(claim) } });
    expect(claim).not.toHaveBeenCalled(); expect((await pending.list()).length).toBe(1);   // 아직 60초 안 — 확인 안 왔으니 남김
  });
  it('extraSettledCodes: 앱이 쓰던 「이미 처리됨」 코드로 거절되면 기록을 지운다 (꿀꿀 8개), 목록에 없으면 남긴다', async () => {
    for (const [code, kept] of [['basket_full', 0], ['daily_max', 0], ['network', 1]] as const) {
      const pending = setup(); await pending.add(row);
      await run({ pending, seen: async () => true, purposes: { ticket: claimRule(async () => { throw { code }; }) }, extraSettledCodes: ['basket_full', 'daily_max', 'already_opened', 'not_full', 'ssv_pending', 'not_ready', 'not_reached', 'off'] });
      expect((await pending.list()).length, code).toBe(kept);
    }
  });
  it('stepsStageRule: 받았을 때만(gained>0) 안내가 나가고, 이미 받은 단계(0P)의 남은 SSV 행은 조용히 지운다', async () => {
    for (const [gained, said] of [[5, 1], [0, 0]] as const) {
      const pending = setup(); await pending.add({ ...row, purpose: 'steps_stage:2026-10-28:stage_2' }); const say = vi.fn();
      const claimStage = vi.fn(async () => ({ gained }));
      await run({ pending, seen: async () => true, purposes: { 'steps_stage:*': stepsStageRule(claimStage) }, say, message: '지난 광고 보상이에요!' });
      expect(claimStage).toHaveBeenCalledWith('stage_2', '2026-10-28'); expect(say).toHaveBeenCalledTimes(said); expect(await pending.list()).toEqual([]);
      if (said) expect(say).toHaveBeenCalledWith('지난 광고 보상이에요!');
    }
  });
  it('stepsStageRule: 모양이 다른 용도는 던지지 않고 조용히 지운다', async () => {
    const pending = setup(); await pending.add({ ...row, purpose: 'steps_stage:oops' }); const claimStage = vi.fn(); const say = vi.fn();
    await run({ pending, seen: async () => true, purposes: { 'steps_stage:*': stepsStageRule(claimStage) }, say });
    expect(claimStage).not.toHaveBeenCalled(); expect(say).not.toHaveBeenCalled(); expect(await pending.list()).toEqual([]);
  });
});
