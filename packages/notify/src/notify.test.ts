import { describe, expect, it } from 'vitest';
import { clampQuiet, fillVars, planItems, type NotifyConfig } from './notify';

/** 지역 시각으로 만든다 — 기계의 시간대가 달라도 같은 결과가 나오게 */
const at = (h: number, m = 0, day = 15) => new Date(2026, 8, day, h, m, 0, 0).getTime();
const hourOf = (t: number) => new Date(t).getHours();
const dayOf = (t: number) => new Date(t).getDate();

const QUIET = { from: 21, to: 8, at: '08:30' };

describe('안 울리는 시간대', () => {
  it('밤에 걸린 것은 다음 날 아침으로', () => {
    const t = clampQuiet(at(22, 10), QUIET);
    expect(dayOf(t)).toBe(16);
    expect(hourOf(t)).toBe(8);
    expect(new Date(t).getMinutes()).toBe(30);
  });

  it('새벽에 걸린 것은 같은 날 아침으로 — 하루를 더하면 안 된다', () => {
    const t = clampQuiet(at(3), QUIET);
    expect(dayOf(t)).toBe(15);
    expect(hourOf(t)).toBe(8);
  });

  it('낮은 그대로 둔다', () => {
    expect(clampQuiet(at(13, 7), QUIET)).toBe(at(13, 7));
  });

  it('경계 — to 시각 정각은 이미 깨어 있는 시간이다', () => {
    expect(clampQuiet(at(8), QUIET)).toBe(at(8));
    expect(clampQuiet(at(7, 59), QUIET)).not.toBe(at(7, 59));
  });

  it('자정을 안 넘는 창도 된다 (1~6시)', () => {
    const t = clampQuiet(at(3), { from: 1, to: 6, at: '06:00' });
    expect(dayOf(t)).toBe(15);
    expect(hourOf(t)).toBe(6);
  });

  it('설정이 없거나 창이 비면 손대지 않는다', () => {
    expect(clampQuiet(at(23), null)).toBe(at(23));
    expect(clampQuiet(at(23), { from: 8, to: 8, at: '09:00' })).toBe(at(23));
  });

  it('시각이 깨져 있어도 던지지 않는다 — 알림이 안 뜨는 것보다 낫다', () => {
    const t = clampQuiet(at(23), { from: 21, to: 8, at: '엉망' });
    expect(hourOf(t)).toBe(8);   // 기본값 8:30 으로 떨어진다
  });

  it('한 번만 옮긴다 — 잘못 넣은 설정에 영원히 돌지 않는다', () => {
    // 미룰 시각(07:00)이 또 창 안이다. 그래도 끝나야 한다
    const t = clampQuiet(at(23), { from: 21, to: 8, at: '07:00' });
    expect(hourOf(t)).toBe(7);
  });
});

describe('문구 자리 채우기', () => {
  it('값을 넣는다', () => {
    expect(fillVars('물 {water}개가 기다려요', { water: 5 })).toBe('물 5개가 기다려요');
  });

  it('모르는 이름은 그대로 둔다 — 빈칸이 되면 무슨 말인지 알 수 없다', () => {
    expect(fillVars('{없는것} 개', { water: 5 })).toBe('{없는것} 개');
  });

  it('값이 없으면 문구를 건드리지 않는다', () => {
    expect(fillVars('그냥 문구')).toBe('그냥 문구');
  });
});

const NOW = at(13);   // 낮 1시 — 야간 규칙이 끼어들지 않는 시각에서 센다

const CFG: NotifyConfig = {
  quiet: QUIET,
  items: [
    { key: 'feed', title: '배고파요', body: '사료를 주세요', repeatAfterMin: 360 },
    { key: 'well', title: '우물이 찼어요', body: '물 {water}개', repeatAfterMin: 120 },
    { key: 'egg', title: '알이 완성됐어요', body: '받아 가세요' },
  ],
};

describe('무엇을 걸지 정하기', () => {
  it('앱이 준 시각에 어드민 문구를 붙인다', () => {
    const got = planItems(CFG, { feed: NOW + 3600_000 }, { now: NOW });
    expect(got).toHaveLength(2);                       // 본 알림 + 재알림
    expect(got[0].title).toBe('배고파요');
    expect(got[1].at - got[0].at).toBe(360 * 60_000);
  });

  it('시각을 안 준 항목은 그냥 없는 것이다', () => {
    const got = planItems(CFG, { feed: NOW + 3600_000 }, { now: NOW });
    expect(got.every((i) => i.key === 'feed')).toBe(true);
  });

  it('어드민이 끄면 아무에게도 안 간다', () => {
    const off = { ...CFG, items: CFG.items!.map((i) => (i.key === 'feed' ? { ...i, on: false } : i)) };
    expect(planItems(off, { feed: NOW + 3600_000 }, { now: NOW })).toHaveLength(0);
  });

  it('사용자가 끄면 그 사람만 안 받는다', () => {
    const got = planItems(CFG, { feed: NOW + 3600_000 }, { now: NOW, prefs: { feed: false } });
    expect(got).toHaveLength(0);
  });

  it('설정에 없는 키를 켜 둬도 영향이 없다 — 기본은 켜짐이다', () => {
    const got = planItems(CFG, { egg: NOW + 3600_000 }, { now: NOW, prefs: { 다른것: false } });
    expect(got).toHaveLength(1);
  });

  it('시각을 여러 개 줄 수 있다 (1시간 뒤·하루 뒤)', () => {
    const got = planItems(CFG, { egg: [NOW + 3600_000, NOW + 24 * 3600_000] }, { now: NOW });
    expect(got).toHaveLength(2);
  });

  it('이미 지난 시각은 안 건다', () => {
    expect(planItems({ ...CFG, items: [{ key: 'egg', title: 'a', body: 'b' }] },
      { egg: NOW - 1000 }, { now: NOW })).toHaveLength(0);
  });

  it('너무 가까운 것도 안 건다 — 지금 보고 있는 사람에게 울릴 뿐이다', () => {
    expect(planItems({ ...CFG, items: [{ key: 'egg', title: 'a', body: 'b' }] },
      { egg: NOW + 5_000 }, { now: NOW })).toHaveLength(0);
  });

  it('시각이 지났어도 재알림은 지금부터 센다 — 이미 가득인 채로 나간 사람', () => {
    // 우물이 이미 찼다(시각이 과거). 본 알림은 안 걸리지만 2시간 뒤 재알림은 걸려야 한다
    const got = planItems(CFG, { well: NOW - 10 * 60_000 }, { now: NOW, vars: { water: 3 } });
    expect(got).toHaveLength(1);
    expect(got[0].at).toBe(NOW + 120 * 60_000);
    expect(got[0].body).toBe('물 3개');
  });

  it('밤에 떨어지는 예약은 아침으로 밀린다', () => {
    const got = planItems(CFG, { egg: at(23) }, { now: NOW });
    expect(got).toHaveLength(1);
    expect(hourOf(got[0].at)).toBe(8);
    expect(dayOf(got[0].at)).toBe(16);
  });

  it('이른 것부터 나온다 — 배지 번호를 이 순서로 매긴다', () => {
    const got = planItems(CFG, { feed: NOW + 7200_000, well: NOW + 600_000 }, { now: NOW, vars: { water: 1 } });
    for (let i = 1; i < got.length; i++) expect(got[i].at).toBeGreaterThanOrEqual(got[i - 1].at);
  });

  it('설정이 비면 아무것도 안 건다 — 서버를 못 읽었을 때 옛 문구가 새지 않는다', () => {
    expect(planItems(null, { feed: NOW + 3600_000 }, { now: NOW })).toHaveLength(0);
    expect(planItems({ items: [] }, { feed: NOW + 3600_000 }, { now: NOW })).toHaveLength(0);
  });
});
