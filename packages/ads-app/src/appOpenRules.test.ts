import { beforeEach, describe, expect, it } from 'vitest';
import {
  AFTER_RETURN_MS, COLD_HOLD_MS, coldPrecheck, decide, DEFAULT_APP_OPEN, EMPTY_GUARD, EMPTY_STORE, guardActive, kstDay, markReturn,
  noteShown, onForeground, shouldHold, shownToday, type AppOpenConfig, type DecideInput,
} from './appOpenRules';
import {
  guardForeground, isFullScreenAd, isGuarded, markReturnGuard, noAppOpenFor, resetAppOpenGuard, setFullScreenAd,
} from './appOpenGuard';

const H = 3_600_000;
const D = 24 * H;
/** 2026-10-10 12:00 KST */
const NOW = Date.parse('2026-10-10T03:00:00Z');

const cfg = (o: Partial<AppOpenConfig> = {}): AppOpenConfig => ({ ...DEFAULT_APP_OPEN, on: true, ...o });
const input = (o: Partial<DecideInput> = {}): DecideInput => ({
  cfg: cfg(), unitId: 'unit', trigger: 'cold', splash: true, loaded: true, fullScreenShowing: false, guarded: false,
  store: { ...EMPTY_STORE, firstLaunchAt: NOW - 3 * D, lastUseAt: NOW - 5 * H },
  now: NOW, ...o,
});
const reason = (o: Partial<DecideInput>) => {
  const d = decide(input(o));

  return d.show ? 'show' : d.reason;
};

describe('앱 오프닝 판단', () => {
  it('모든 조건이 맞으면 콜드 스타트에 띄운다', () => expect(reason({})).toBe('show'));

  it('기본 설정은 꺼짐', () => {
    expect(DEFAULT_APP_OPEN.on).toBe(false);
    expect(reason({ cfg: DEFAULT_APP_OPEN })).toBe('off');
  });

  it('단위 ID 가 없으면 건너뛴다', () => expect(reason({ unitId: '' })).toBe('no_unit'));

  it('아직 못 불러왔으면 기다린다', () => expect(reason({ loaded: false })).toBe('not_loaded'));

  it('콜드 스타트인데 스플래시가 끝났으면 건너뛴다', () => {
    expect(reason({ trigger: 'cold', splash: false })).toBe('cold_after_splash');
  });

  it('웜 스타트는 on_resume=0 이면 안 띄운다', () => {
    expect(reason({ trigger: 'resume', splash: false })).toBe('resume_off');
  });

  it('웜 스타트는 on_resume=1 이면 띄운다(스플래시와 무관)', () => {
    expect(reason({ trigger: 'resume', splash: false, cfg: cfg({ onResume: true }) })).toBe('show');
  });

  describe('간격 — 마지막으로 앱을 쓴 때 기준', () => {
    it('4시간 안에 썼으면 콜드 스타트도 건너뛴다', () => {
      expect(reason({ store: { ...EMPTY_STORE, firstLaunchAt: NOW - 3 * D, lastUseAt: NOW - 3 * H } })).toBe('interval');
    });
    it('정확히 4시간은 아직 아니다(초과여야 한다)', () => {
      expect(reason({ store: { ...EMPTY_STORE, firstLaunchAt: NOW - 3 * D, lastUseAt: NOW - 4 * H } })).toBe('interval');
    });
    it('4시간을 넘겼으면 띄운다', () => {
      expect(reason({ store: { ...EMPTY_STORE, firstLaunchAt: NOW - 3 * D, lastUseAt: NOW - 4 * H - 1 } })).toBe('show');
    });
    it('웜 스타트도 뒤로 간 지 4시간 안이면 건너뛴다', () => {
      const store = { ...EMPTY_STORE, firstLaunchAt: NOW - 3 * D, lastUseAt: NOW - 10 * 60_000 };
      expect(reason({ trigger: 'resume', splash: false, cfg: cfg({ onResume: true }), store })).toBe('interval');
    });
    it('간격을 바꾸면 따른다', () => {
      const store = { ...EMPTY_STORE, firstLaunchAt: NOW - 3 * D, lastUseAt: NOW - 3 * H };
      expect(reason({ cfg: cfg({ intervalH: 2 }), store })).toBe('show');
    });
  });

  describe('하루 최대 — KST', () => {
    const store = (day: string, count: number) =>
      ({ ...EMPTY_STORE, firstLaunchAt: NOW - 3 * D, lastUseAt: NOW - 5 * H, day, count });

    it('오늘 3번 띄웠으면 건너뛴다', () => expect(reason({ store: store(kstDay(NOW), 3) })).toBe('daily_max'));
    it('2번이면 한 번 더', () => expect(reason({ store: store(kstDay(NOW), 2) })).toBe('show'));
    it('어제 3번이었으면 오늘은 0 부터', () => {
      expect(shownToday(store('2026-10-09', 3), NOW)).toBe(0);
      expect(reason({ store: store('2026-10-09', 3) })).toBe('show');
    });
    it('KST 자정에 넘어간다(UTC 15:00)', () => {
      const before = Date.parse('2026-10-10T14:59:00Z');   // 10-10 23:59 KST
      const after = Date.parse('2026-10-10T15:01:00Z');    // 10-11 00:01 KST
      expect(kstDay(before)).toBe('2026-10-10');
      expect(kstDay(after)).toBe('2026-10-11');
      const st = { ...EMPTY_STORE, firstLaunchAt: before - 3 * D, lastUseAt: before - 5 * H, day: '2026-10-10', count: 3 };
      expect(decide(input({ now: before, store: st }))).toEqual({ show: false, reason: 'daily_max' });
      expect(decide(input({ now: after, store: { ...st, lastUseAt: after - 5 * H } }))).toEqual({ show: true });
    });
    it('noteShown 은 횟수를 올리고 날이 바뀌면 1 부터', () => {
      const a = noteShown(store(kstDay(NOW), 1), NOW);
      expect(a.count).toBe(2);
      expect(noteShown(store('2026-10-09', 3), NOW).count).toBe(1);
    });
    it('최대를 0 으로 두면 안 띄운다', () => expect(reason({ cfg: cfg({ dailyMax: 0 }) })).toBe('daily_max'));
  });

  describe('설치 후 건너뛰기', () => {
    const st = (first: number | null) => ({ ...EMPTY_STORE, firstLaunchAt: first, lastUseAt: NOW - 5 * H });
    it('설치한 날(KST)은 안 띄운다', () => expect(reason({ store: st(NOW - 2 * H) })).toBe('skip_days'));
    it('기록이 없는 첫 실행도 설치일이다', () => expect(reason({ store: st(null) })).toBe('skip_days'));
    it('다음 날(KST)부터 띄운다 — 시각이 아니라 날짜로 센다', () => {
      const first = Date.parse('2026-10-09T14:00:00Z');   // 10-09 23:00 KST
      expect(reason({ store: st(first) })).toBe('show');   // 지금은 10-10 12:00 KST
    });
    it('skip_days=3 이면 사흘 뒤부터', () => {
      expect(reason({ cfg: cfg({ skipDays: 3 }), store: st(NOW - 2 * D) })).toBe('skip_days');
      expect(reason({ cfg: cfg({ skipDays: 3 }), store: st(NOW - 3 * D) })).toBe('show');
    });
    it('0 이면 설치 당일에도', () => expect(reason({ cfg: cfg({ skipDays: 0 }), store: st(NOW - H) })).toBe('show'));
  });

  it('전체화면 광고가 떠 있으면 안 띄운다', () => expect(reason({ fullScreenShowing: true })).toBe('fullscreen'));
  it('가드 중이면 안 띄운다', () => expect(reason({ guarded: true })).toBe('guard'));
});

describe('가드 창', () => {
  it('흐름을 시작하면 떠나 있는 동안 막힌다', () => {
    const g = markReturn(EMPTY_GUARD, 'mission', NOW);
    expect(guardActive(g, NOW + 20 * 60_000)).toBe(true);
  });

  it('돌아오면 그 순간부터 일정 시간 더 막힌다 — 오래 떠났다 와도', () => {
    const g = markReturn(EMPTY_GUARD, 'mission', NOW);
    const back = NOW + 50 * 60_000;
    const g2 = onForeground(g, back);
    expect(g2.pending).toBeNull();
    expect(guardActive(g2, back)).toBe(true);
    expect(guardActive(g2, back + AFTER_RETURN_MS - 1)).toBe(true);
    expect(guardActive(g2, back + AFTER_RETURN_MS + 1)).toBe(false);
  });

  it('떠난 흐름이 없는 평범한 복귀는 막지 않는다', () => {
    expect(guardActive(onForeground(EMPTY_GUARD, NOW), NOW)).toBe(false);
  });

  it('오래 지나 만료된 흐름은 이후 복귀를 막지 않는다', () => {
    const g = markReturn(EMPTY_GUARD, 'rewarded', NOW);
    const back = NOW + 2 * H;
    expect(guardActive(onForeground(g, back), back)).toBe(false);
  });

  it.each(['rewarded', 'interstitial', 'mission', 'payment', 'login', 'external'] as const)('%s 에서 돌아오면 막는다', (r) => {
    const g = markReturn(EMPTY_GUARD, r, NOW);
    expect(guardActive(onForeground(g, NOW + 10_000), NOW + 10_000)).toBe(true);
  });
});

describe('가드 모듈', () => {
  beforeEach(() => resetAppOpenGuard());

  it('markReturnGuard → 복귀 직후 막힘', () => {
    markReturnGuard('login');
    guardForeground();
    expect(isGuarded()).toBe(true);
  });

  it('noAppOpenFor 는 그 시간 동안 막는다', () => {
    expect(isGuarded()).toBe(false);
    noAppOpenFor(1000);
    expect(isGuarded()).toBe(true);
    expect(isGuarded(Date.now() + 2000)).toBe(false);
  });

  it('전체화면 광고 표시는 겹쳐도 센다', () => {
    setFullScreenAd(true);
    setFullScreenAd(true);
    setFullScreenAd(false);
    expect(isFullScreenAd()).toBe(true);
    setFullScreenAd(false);
    expect(isFullScreenAd()).toBe(false);
    setFullScreenAd(false);
    expect(isFullScreenAd()).toBe(false);
  });
});

describe('스플래시 붙잡기(shouldHold)', () => {
  const base = { cfg: cfg(), unitId: 'unit', store: { ...EMPTY_STORE, firstLaunchAt: NOW - 3 * D, lastUseAt: NOW - 5 * H }, now: NOW };
  const hold = (o: Partial<Parameters<typeof shouldHold>[0]> & { elapsedMs: number; loaded: boolean }) => shouldHold({ ...base, ...o });

  it('상한은 5초(대표님 기준 3~5초 이내)', () => expect(COLD_HOLD_MS).toBe(5000));
  it('로드 지연 0초: 이미 로드됐으면 붙잡지 않는다', () => expect(hold({ elapsedMs: 0, loaded: true })).toBe(false));
  it('로드 전 0초 · 2초 · 3초 · 4.6초(A32 실측 로드 시각): 붙잡는다', () => {
    expect(hold({ elapsedMs: 0, loaded: false })).toBe(true);
    expect(hold({ elapsedMs: 2000, loaded: false })).toBe(true);
    expect(hold({ elapsedMs: 3000, loaded: false })).toBe(true);
    expect(hold({ elapsedMs: 4631, loaded: false })).toBe(true);
    expect(hold({ elapsedMs: 4999, loaded: false })).toBe(true);
  });
  it('4.6초에 로드가 끝나면 더 붙잡지 않고(띄운다), 5초 · 7초에도 안 됐으면 놓는다', () => {
    expect(hold({ elapsedMs: 4631, loaded: true })).toBe(false);
    expect(decide(input({ loaded: true })).show).toBe(true);
    expect(hold({ elapsedMs: 5000, loaded: false })).toBe(false);
    expect(hold({ elapsedMs: 7000, loaded: false })).toBe(false);
  });
  it('쉬는 날 · 간격 · 하루 최대에 걸리는 실행은 붙잡지 않는다', () => {
    expect(hold({ elapsedMs: 0, loaded: false, store: { ...base.store, firstLaunchAt: NOW - 3 * H } })).toBe(false);
    expect(hold({ elapsedMs: 0, loaded: false, store: { ...base.store, lastUseAt: NOW - 1 * H } })).toBe(false);
    expect(hold({ elapsedMs: 0, loaded: false, store: { ...base.store, day: kstDay(NOW), count: 3 } })).toBe(false);
  });
  it('서버 규칙이 꺼짐(on=0)이거나 단위 ID 가 없으면 붙잡지 않는다', () => {
    expect(hold({ elapsedMs: 0, loaded: false, cfg: cfg({ on: false }) })).toBe(false);
    expect(hold({ elapsedMs: 0, loaded: false, unitId: '' })).toBe(false);
  });
  it('coldPrecheck 는 규칙만으로 판단한다(로드 · 스플래시 여부 무관)', () => {
    expect(coldPrecheck(base).show).toBe(true);
    const d = coldPrecheck({ ...base, store: { ...base.store, lastUseAt: NOW - 1 * H } });
    expect(d.show ? 'show' : d.reason).toBe('interval');
  });
});
