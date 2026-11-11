import { describe, it, expect } from 'vitest';
import { slotButtonLabel, slotStatusLine, slotWindowLabel, slotCount, missionProgress, bonusButtonLabel, stepsSummary, stepsBubble, UPDATE_NOTICE, waitLeftMs, clockText, drawLabel, drawSubLine, prizeLine, normalizeInviteCode, inviteHeadline, type FreeItemSlot, type StepsStage, boostLine } from './logic';

const slot = (o: Partial<FreeItemSlot> = {}): FreeItemSlot => ({ id: 'a', name: '아침', fromHour: 9, toHour: 11, step: 1, reward: 10, done: false, missed: false, claimable: false, ...o });

describe('무료 아이템 칸(0.4.0, carrot HeartCard visits 와 같은 글)', () => {
  it('버튼 글: 받았어요 > 놓쳤어요 > 받기 > 아직 순서', () => {
    expect(slotButtonLabel(slot({ done: true }))).toBe('받았어요');
    expect(slotButtonLabel(slot({ missed: true }))).toBe('놓쳤어요');
    expect(slotButtonLabel(slot({ claimable: true }))).toBe('받기');
    expect(slotButtonLabel(slot())).toBe('아직');
  });
  it('칸 줄 · 시간 글', () => {
    expect(slotStatusLine(slot({ done: true, step: 2 }), '양분')).toBe('2회차로 받았어요');
    expect(slotStatusLine(slot({ missed: true }), '양분')).toBe('시간이 지났어요');
    expect(slotStatusLine(slot({ step: 3, reward: 30 }), '먹이')).toBe('3회차 · 먹이 30');
    expect(slotWindowLabel(slot())).toBe('아침 9시~11시');
  });
  it('받은 칸 수 / 전체', () => {
    expect(slotCount([slot({ done: true }), slot(), slot({ done: true })])).toEqual({ done: 2, total: 3 });
  });
});

describe('오늘의 미션 진행', () => {
  it('null(모름)은 완료로 세지 않는다 · 퍼센트', () => {
    const p = missionProgress([{ done: true }, { done: null }, { done: false }, { done: true }]);
    expect(p).toEqual({ done: 2, total: 4, allDone: false, percent: 50 });
  });
  it('전부 완료 · 빈 목록은 allDone 아님', () => {
    expect(missionProgress([{ done: true }, { done: true }]).allDone).toBe(true);
    expect(missionProgress([])).toEqual({ done: 0, total: 0, allDone: false, percent: 0 });
  });
  it('보너스 글', () => {
    expect(bonusButtonLabel(3)).toBe('모두 완료하고 3P 받기');
    expect(bonusButtonLabel(1200)).toBe('모두 완료하고 1,200P 받기');
  });
});

describe('만보기 단계', () => {
  const stages: StepsStage[] = [
    { id: 's1', threshold: 1000, points: 5, claimed: false },
    { id: 's2', threshold: 2000, points: 5, claimed: false },
    { id: 's3', threshold: 3000, points: 5, claimed: true },
  ];
  it('받을 수 있는 단계 · 다음 단계 · 남은 걸음', () => {
    const s = stepsSummary(2500, stages);
    expect(s.claimable.map(x => x.id)).toEqual(['s1', 's2']);
    expect(s.next).toBeUndefined();
    expect(stepsSummary(1500, stages)).toMatchObject({ next: { id: 's2' }, remaining: 500, allClaimed: false });
    expect(stepsSummary(0, stages).claimable).toEqual([]);
  });
  it('말풍선: 업데이트 전 · 받을 수 있음 · 다음 걸음 · 다 받음', () => {
    expect(stepsBubble({ available: false, todaySteps: 5000, stages })).toBe(UPDATE_NOTICE);
    expect(stepsBubble({ available: true, todaySteps: 2500, stages })).toBe('포인트를 2번 받을 수 있어요');
    expect(stepsBubble({ available: true, todaySteps: 500, stages })).toBe('500걸음 더 걸으면 5P');
    const done = stages.map(x => ({ ...x, claimed: true }));
    expect(stepsBubble({ available: true, todaySteps: 9000, stages: done })).toBe('오늘 걸음 보상을 다 받았어요');
  });
  it('업데이트 안내 문구는 대표님 지시 그대로', () => {
    expect(UPDATE_NOTICE).toBe('업데이트하면 걸음 보상을 받을 수 있어요');
  });
});

describe('행운 찬스 · 뽑기', () => {
  it('대기 남은 시간 · 초읽기 글', () => {
    expect(waitLeftMs(10_000, 4_000)).toBe(6_000);
    expect(waitLeftMs(10_000, 12_000)).toBe(0);
    expect(waitLeftMs(undefined, 1)).toBe(0);
    expect(clockText(65_000)).toBe('1:05');
    expect(clockText(-5)).toBe('0:00');
  });
  it('뽑기 단추 · 줄 글', () => {
    expect(drawLabel({ free: true, waitMs: 0 })).toBe('무료로 뽑기');
    expect(drawLabel({ free: false, waitMs: 0 })).toBe('광고 보고 한 번 더 뽑기');
    expect(drawLabel({ free: true, waitMs: 61_000 })).toBe('1:01 뒤에 뽑아요');
    expect(drawSubLine({ free: 1, ad: 0, waitMs: 0 })).toBe('오늘 무료 뽑기가 1번 남았어요');
    expect(drawSubLine({ free: 0, ad: 0, waitMs: 0 })).toBe('오늘은 여기까지예요. 내일 또 뽑아요');
  });
  it('뽑기 상품 줄', () => {
    expect(prizeLine(['당근 10개', '확률권'])).toBe('꽝 없이 당근 10개 / 확률권');
    expect(prizeLine([])).toBeNull();
  });
});

describe('친구 초대', () => {
  it('초대 코드 입력 정리: 대문자 · 영숫자 · 14자', () => {
    expect(normalizeInviteCode('ab-12 cd')).toBe('AB12CD');
    expect(normalizeInviteCode('a'.repeat(20))).toHaveLength(14);
  });
  it('헤드라인', () => {
    expect(inviteHeadline(1000)).toBe('1,000P 받으세요');
  });
});

describe('boostLine (0.4.1)', () => {
  it('설명이 없으면 「확률권 N장」만, 있으면 붙인다', () => {
    expect(boostLine(2)).toBe('확률권 2장');
    expect(boostLine(2, '  ')).toBe('확률권 2장');
    expect(boostLine(1, '다음 뽑기 확률이 올라가요')).toBe('확률권 1장 — 다음 뽑기 확률이 올라가요');
  });
});
