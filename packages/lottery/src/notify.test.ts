import { describe, expect, it, vi } from 'vitest';
import { createNotifyController, notifyMode, type NotifyStatus } from './notify';
import { goldenLines, nextOpensWithAd, opensWithAd, parseLotteryState, type LotteryTier } from './lottery';

const tier = (over: Partial<LotteryTier>): LotteryTier => ({ tier: 1, missions: 1, maxWon: 100, maxPoints: 160, state: 'locked', missionState: 'locked', missionsLeft: 1, tickets: 0, unopened: 0, basic: 0, basicUnopened: 0, prize: null, ...over });

describe('알림 권한 → 줄 보이기', () => {
  it('켜짐은 숨기고, 꺼짐 · 안 물음 · 거절은 보이고, 모르면 조르지 않는다', () => {
    const modes = (s: NotifyStatus) => notifyMode(s);
    expect([true, 'granted'].map(modes)).toEqual(['on', 'on']);
    expect([false, 'undetermined'].map(modes)).toEqual(['ask', 'ask']);
    expect(['denied', 'blocked'].map(modes)).toEqual(['denied', 'denied']);
    expect([null, undefined, 'weird' as any].map(modes)).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('refresh: 꺼져 있으면 visible, 켜져 있거나 읽지 못하면 안 보인다', async () => {
    const make = (get: () => any) => createNotifyController({ getNotificationStatus: get, onEnableNotifications: vi.fn() });
    const off = make(() => 'undetermined');
    expect((await off.refresh()).visible).toBe(true);
    expect((await make(async () => 'denied').refresh()).visible).toBe(true);
    expect((await make(async () => 'granted').refresh()).visible).toBe(false);
    expect((await make(async () => { throw new Error('x'); }).refresh()).visible).toBe(false);
  });

  it('enable: 아직 안 물었으면 앱의 켜기 경로(권한 요청 + 토큰 등록)를 부르고, 켜지면 줄이 사라진다', async () => {
    let status: NotifyStatus = 'undetermined';
    const onEnable = vi.fn(async () => { status = 'granted'; });
    const openSettings = vi.fn();
    const c = createNotifyController({ getNotificationStatus: () => status, onEnableNotifications: onEnable, openSettings });
    await c.refresh();
    const seen: boolean[] = [];
    c.subscribe((v) => seen.push(v.busy));
    const v = await c.enable();
    expect(onEnable).toHaveBeenCalledWith('ask');
    expect(openSettings).not.toHaveBeenCalled();
    expect(v.visible).toBe(false);
    expect(seen).toContain(true);                      // 누르는 동안 busy
    expect(c.view().busy).toBe(false);
  });

  it('enable: 이미 거절했으면 설정 화면을 연다(앱 콜백은 부르지 않는다) — 돌아와 켰으면 다시 읽어 사라진다', async () => {
    let status: NotifyStatus = 'denied';
    const onEnable = vi.fn();
    const openSettings = vi.fn(async () => { status = 'granted'; });
    const c = createNotifyController({ getNotificationStatus: () => status, onEnableNotifications: onEnable, openSettings });
    await c.refresh();
    expect(c.view().mode).toBe('denied');
    const v = await c.enable();
    expect(openSettings).toHaveBeenCalledOnce();
    expect(onEnable).not.toHaveBeenCalled();
    expect(v.visible).toBe(false);
  });

  it('enable: 설정 여는 길을 안 주면 앱 콜백이 mode denied 로 받는다 · 실패해도 앱은 멀쩡하고 줄은 그대로', async () => {
    const onEnable = vi.fn(async () => { throw new Error('permission'); });
    const c = createNotifyController({ getNotificationStatus: () => 'denied', onEnableNotifications: onEnable });
    await c.refresh();
    const v = await c.enable();
    expect(onEnable).toHaveBeenCalledWith('denied');
    expect(v.visible).toBe(true);
    expect(v.busy).toBe(false);
  });

  it('enable: 보이지 않을 때 · 이미 누르는 중일 때는 아무것도 안 한다(중복 요청 없음)', async () => {
    const onEnable = vi.fn(() => new Promise((r) => setTimeout(r, 5)));
    const c = createNotifyController({ getNotificationStatus: () => 'undetermined', onEnableNotifications: onEnable });
    await c.enable();                                    // 아직 refresh 전 — visible 거짓
    expect(onEnable).not.toHaveBeenCalled();
    await c.refresh();
    const first = c.enable();
    const second = c.enable();                           // busy 중
    await Promise.all([first, second]);
    expect(onEnable).toHaveBeenCalledTimes(1);
    const on = createNotifyController({ getNotificationStatus: () => true, onEnableNotifications: onEnable });
    await on.refresh();
    await on.enable();
    expect(onEnable).toHaveBeenCalledTimes(1);           // 이미 켜져 있으면 요청하지 않는다
  });
});

describe('광고 칩 판단 · 황금 복권 설명', () => {
  it('opensWithAd: 매일 기본(황금) 복권만 남았을 때만 — 미션 복권이 열리는 줄 · 다 연 줄 · 광고 없는 설정은 아니다', () => {
    expect(opensWithAd(tier({ unopened: 1, missionState: 'locked', basicUnopened: 1 }))).toBe(true);
    expect(opensWithAd(tier({ unopened: 2, missionState: 'ready', basicUnopened: 1 }))).toBe(false);   // 서버는 미션 복권을 먼저 연다
    expect(opensWithAd(tier({ unopened: 0, missionState: 'opened', basicUnopened: 0 }))).toBe(false);
    expect(opensWithAd(tier({ unopened: 1, missionState: 'ready', basicUnopened: 0 }))).toBe(false);
    expect(opensWithAd(tier({ unopened: 1, missionState: 'locked', basicUnopened: 1 }), false)).toBe(false);
    expect(opensWithAd(null)).toBe(false);
  });
  it('nextOpensWithAd: 다음에 열 첫 단계가 황금뿐일 때', () => {
    const mk = (tiers: Partial<LotteryTier>[]) => parseLotteryState({ ok: true, day: 'd', wonToPoint: 160, participated: 0, unopened: 2, tiers: tiers.map((t, i) => tier({ tier: i + 1, ...t })) });
    expect(nextOpensWithAd(mk([{ unopened: 1, missionState: 'locked', basicUnopened: 1 }, { unopened: 1, missionState: 'ready' }]))).toBe(true);
    expect(nextOpensWithAd(mk([{ unopened: 1, missionState: 'ready', basicUnopened: 1 }]))).toBe(false);
    expect(nextOpensWithAd(mk([{ unopened: 0 }]))).toBe(false);
    expect(nextOpensWithAd(null)).toBe(false);
  });
  it('goldenLines: 쉬운 말 3줄 + 작은 글씨, 값은 넘긴 숫자(천 단위 쉼표)', () => {
    expect(goldenLines({ maxWon: 1000, maxPoints: 1600 })).toEqual({
      lines: ['하루에 한 장, 무료로 드려요', '광고 1번 보면 바로 열 수 있어요', '최대 1,000원(1,600P)이 포인트로 바로 들어와요'],
      note: '오늘 자정까지 열 수 있어요',
    });
    expect(goldenLines({ maxWon: 500 }).lines[2]).toBe('최대 500원이 포인트로 바로 들어와요');
    expect(goldenLines({ maxWon: 500, maxPoints: 0 }).lines[2]).toBe('최대 500원이 포인트로 바로 들어와요');
    expect(goldenLines({ maxWon: 1000, maxPoints: 1600, ad: false }).lines[1]).toBe('바로 열 수 있어요');
  });
});
