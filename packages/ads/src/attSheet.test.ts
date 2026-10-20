import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as pkg from './index';
import {
  ATT_DENIED_STORAGE_KEY, ATT_DENIED_TEXTS, ATT_PRIMER_TEXTS, ATT_SHEET_TEXTS, decideAttAction, ensureTrackingBeforeOfferwall,
  ensureTrackingBeforeOfferwallWith, localDay, waitForReturn,
  type AttDeps, type AttStorage, type TrackingModule,
} from './attSheet';

const TODAY = '2026-10-21';

function fakeTracking(status: string, req?: string): TrackingModule & { get: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> } {
  const get = vi.fn(async () => ({ status }));
  const request = vi.fn(async () => ({ status: req ?? status }));

  return { get, request, getTrackingPermissionsAsync: get, requestTrackingPermissionsAsync: request };
}

const deps = (over: Partial<AttDeps>): AttDeps => ({ os: 'ios', tracking: null, ...over });

describe('decideAttAction — 언제 무엇을 하나', () => {
  const act = (status: string, trigger: 'launch' | 'offerwall', os = 'ios') =>
    decideAttAction({ os, trigger, status, lastShownDay: null, today: TODAY });

  it('미정이면 어느 시점이든 시스템 창 요청(그 앞에 중립 안내가 붙는다)', () => {
    expect(act('undetermined', 'launch')).toBe('request');
    expect(act('undetermined', 'offerwall')).toBe('request');
  });
  it('거부 · 제한은 오퍼월 진입 때만 가운데 팝업', () => {
    expect(act('denied', 'offerwall')).toBe('show');
    expect(act('restricted', 'offerwall')).toBe('show');
  });
  it('거부 · 제한이라도 앱을 켤 때(launch)는 절대 안 띄운다 — 홈 · 루트 자동 팝업 없음', () => {
    expect(act('denied', 'launch')).toBe('none');
    expect(act('restricted', 'launch')).toBe('none');
  });
  it('허용됐거나 알 수 없는 상태는 아무것도 안 함', () => {
    for (const status of ['granted', 'unknown', 'unavailable']) {
      expect(act(status, 'launch')).toBe('none');
      expect(act(status, 'offerwall')).toBe('none');
    }
  });
  it('Android 는 어떤 상태든 아무것도 안 한다', () => {
    for (const status of ['denied', 'restricted', 'undetermined', 'granted']) {
      expect(act(status, 'launch', 'android')).toBe('none');
      expect(act(status, 'offerwall', 'android')).toBe('none');
    }
  });
});

describe('ensureTrackingBeforeOfferwallWith — 오퍼월 들어가기 전: 막지 않고, 열어도 된다는 값을 돌려준다', () => {
  it('거부면 가운데 팝업을 열고, 닫힌 뒤에도 꺼져 있으면 proceed — 시스템 창 · 중립 안내는 안 부른다', async () => {
    const t = fakeTracking('denied');
    const denied = vi.fn(async () => undefined);
    const primer = vi.fn(async () => undefined);
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: t, denied, primer }))).toBe('proceed');
    expect(denied).toHaveBeenCalledTimes(1);
    expect(primer).not.toHaveBeenCalled();
    expect(t.request).not.toHaveBeenCalled();
  });
  it('제한도 같다 — proceed', async () => {
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: fakeTracking('restricted'), denied: vi.fn(async () => undefined) }))).toBe('proceed');
  });
  it('팝업을 보는 동안 설정에서 켰으면 granted 를 돌려준다', async () => {
    const t = fakeTracking('denied');
    const denied = vi.fn(async () => { t.get.mockResolvedValueOnce({ status: 'granted' }); });
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: t, denied }))).toBe('granted');
  });
  it('팝업이 던져도 막히지 않고 proceed', async () => {
    const denied = vi.fn(async () => { throw new Error('x'); });
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: fakeTracking('denied'), denied }))).toBe('proceed');
  });
  it('화면이 안 붙어 있으면(AttDeniedSheet 미마운트) 팝업 없이 바로 proceed', async () => {
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: fakeTracking('denied') }))).toBe('proceed');
  });
  it('미정이면 중립 안내가 먼저, 그 뒤에 시스템 창 — 순서가 바뀌지 않는다. 시스템 창에서 막 거부해도 proceed', async () => {
    const order: string[] = [];
    const t = fakeTracking('undetermined', 'denied');
    t.request.mockImplementation(async () => { order.push('system'); return { status: 'denied' }; });
    const primer = vi.fn(async () => { order.push('primer'); });
    const denied = vi.fn(async () => undefined);
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: t, primer, denied }))).toBe('proceed');
    expect(order).toEqual(['primer', 'system']);
    expect(denied).not.toHaveBeenCalled();                 // 막 답한 사람에게 같은 자리에서 또 안내하지 않는다
  });
  it('미정에서 허용하면 granted', async () => {
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: fakeTracking('undetermined', 'granted'), primer: vi.fn(async () => undefined) }))).toBe('granted');
  });
  it('중립 안내가 던져도 시스템 창은 묻는다', async () => {
    const t = fakeTracking('undetermined', 'granted');
    const primer = vi.fn(async () => { throw new Error('x'); });
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: t, primer }))).toBe('granted');
    expect(t.request).toHaveBeenCalledTimes(1);
  });
  it('허용이면 아무것도 안 띄우고 바로 granted', async () => {
    const primer = vi.fn(async () => undefined);
    const denied = vi.fn(async () => undefined);
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: fakeTracking('granted'), primer, denied }))).toBe('granted');
    expect(primer).not.toHaveBeenCalled();
    expect(denied).not.toHaveBeenCalled();
  });
  it('Android 는 unavailable 을 돌려주고 추적 모듈도 안내도 건드리지 않는다', async () => {
    const t = fakeTracking('denied');
    const denied = vi.fn(async () => undefined);
    expect(await ensureTrackingBeforeOfferwallWith(deps({ os: 'android', tracking: t, denied }))).toBe('unavailable');
    expect(t.get).not.toHaveBeenCalled();
    expect(denied).not.toHaveBeenCalled();
  });
  it('모듈이 없으면 unavailable · 상태 읽기가 던지면 unknown', async () => {
    await expect(ensureTrackingBeforeOfferwallWith(deps({ tracking: null }))).resolves.toBe('unavailable');
    const bad: TrackingModule = {
      getTrackingPermissionsAsync: async () => { throw new Error('boom'); },
      requestTrackingPermissionsAsync: async () => { throw new Error('boom'); },
    };
    await expect(ensureTrackingBeforeOfferwallWith(deps({ tracking: bad }))).resolves.toBe('unknown');
  });
  it('앱이 부르는 공개 함수는 같은 호출 모양(storage 인자 선택)으로 던지지 않고 돌아온다', async () => {
    await expect(ensureTrackingBeforeOfferwall()).resolves.toBe('unavailable');       // 시험 환경: react-native 도 추적 모듈도 없다
    await expect(ensureTrackingBeforeOfferwall({ getItem: () => null, setItem: () => undefined })).resolves.toBe('unavailable');
  });
});

describe('화면 등록 — 중립 안내는 한 번, 가운데 팝업은 하루 한 번', () => {
  const fresh = async () => { vi.resetModules(); return import('./attSheet'); };
  const memStore = (initial?: string) => {
    const data = new Map<string, string>();
    if (initial !== undefined) data.set('jcurve.ads.attDenied.lastShown', initial);
    const store: AttStorage & { data: Map<string, string> } = { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };

    return store;
  };

  it('화면이 없으면 둘 다 바로 돌아온다(안내 없이 지나간다)', async () => {
    const m = await fresh();
    await expect(m.showAttPrimerOnce()).resolves.toBeUndefined();
    await expect(m.showAttDeniedOncePerDay()).resolves.toBeUndefined();
  });
  it('중립 안내: 사용자가 끝낼 때까지 기다리고, 한 번 보인 뒤에는 다시 안 보인다', async () => {
    const m = await fresh();
    let finish: () => void = () => undefined;
    const primer = vi.fn((done: () => void) => { finish = done; });
    m.registerAttHost({ primer, denied: vi.fn() });
    let settled = false;
    const p = m.showAttPrimerOnce().then(() => { settled = true; });
    await Promise.resolve();
    expect(primer).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    finish(); await p;
    expect(settled).toBe(true);
    await m.showAttPrimerOnce(); await m.showAttPrimerOnce();
    expect(primer).toHaveBeenCalledTimes(1);               // 거부 뒤 · 다음 호출에서 다시 조르지 않는다
  });
  it('중립 안내: 동시에 부르면 하나를 같이 기다린다 · 화면이 던져도 돌아오고 다시 안 연다', async () => {
    const m = await fresh();
    let finish: () => void = () => undefined;
    const primer = vi.fn((done: () => void) => { finish = done; });
    m.registerAttHost({ primer, denied: vi.fn() });
    const both = Promise.all([m.showAttPrimerOnce(), m.showAttPrimerOnce()]);
    await Promise.resolve();
    finish(); await both;
    expect(primer).toHaveBeenCalledTimes(1);
    const m2 = await fresh();
    const boom = vi.fn(() => { throw new Error('x'); });
    m2.registerAttHost({ primer: boom, denied: vi.fn() });
    await expect(m2.showAttPrimerOnce()).resolves.toBeUndefined();
    await m2.showAttPrimerOnce();
    expect(boom).toHaveBeenCalledTimes(1);
  });

  it('가운데 팝업: 닫힐 때까지 기다리고, 같은 날 다시 부르면 안 열린다(하루 한 번)', async () => {
    const m = await fresh();
    let finish: () => void = () => undefined;
    const denied = vi.fn((done: () => void) => { finish = done; });
    m.registerAttHost({ primer: vi.fn(), denied });
    let settled = false;
    const p = m.showAttDeniedOncePerDay('2026-10-21').then(() => { settled = true; });
    await vi.waitFor(() => expect(denied).toHaveBeenCalledTimes(1));
    expect(settled).toBe(false);
    finish(); await p;
    expect(settled).toBe(true);
    await m.showAttDeniedOncePerDay('2026-10-21');
    await m.showAttDeniedOncePerDay('2026-10-21');
    expect(denied).toHaveBeenCalledTimes(1);               // 오늘은 이미 봤다 — 팝업 없이 바로 지나간다
  });
  it('가운데 팝업: 날짜가 바뀌면(기기 로컬 날짜) 다시 한 번 뜬다', async () => {
    const m = await fresh();
    const denied = vi.fn((done: () => void) => done());
    m.registerAttHost({ primer: vi.fn(), denied });
    await m.showAttDeniedOncePerDay('2026-10-21');
    await m.showAttDeniedOncePerDay('2026-10-22');
    await m.showAttDeniedOncePerDay('2026-10-22');
    expect(denied).toHaveBeenCalledTimes(2);
  });
  it('가운데 팝업: 앱이 준 저장소에 날짜를 적고, 앱을 껐다 켜도(저장된 날짜) 같은 날은 안 뜬다', async () => {
    const m = await fresh();
    const store = memStore();
    const denied = vi.fn((done: () => void) => done());
    m.registerAttHost({ primer: vi.fn(), denied, storage: store });
    await m.showAttDeniedOncePerDay('2026-10-21');
    expect(store.data.get(ATT_DENIED_STORAGE_KEY)).toBe('2026-10-21');
    // 새 실행 — 메모리는 비어 있고 저장소에는 오늘 날짜가 있다
    const m2 = await fresh();
    const denied2 = vi.fn((done: () => void) => done());
    m2.registerAttHost({ primer: vi.fn(), denied: denied2, storage: store });
    await m2.showAttDeniedOncePerDay('2026-10-21');
    expect(denied2).not.toHaveBeenCalled();
    await m2.showAttDeniedOncePerDay('2026-10-22');
    expect(denied2).toHaveBeenCalledTimes(1);
  });
  it('가운데 팝업: 날짜는 띄우기 전에 적는다 — 팝업을 보다가 앱이 꺼져도 오늘 또 뜨지 않는다', async () => {
    const m = await fresh();
    const store = memStore();
    let seenWhenOpened: string | undefined;
    m.registerAttHost({ primer: vi.fn(), denied: () => { seenWhenOpened = store.data.get(ATT_DENIED_STORAGE_KEY); }, storage: store });
    void m.showAttDeniedOncePerDay('2026-10-21');
    await vi.waitFor(() => expect(seenWhenOpened).toBe('2026-10-21'));
  });
  it('가운데 팝업: 저장소가 던져도 팝업은 뜬다(마지막 날짜를 모르면 오늘 안 본 것으로)', async () => {
    const m = await fresh();
    const broken: AttStorage = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('y'); } };
    const denied = vi.fn((done: () => void) => done());
    m.registerAttHost({ primer: vi.fn(), denied, storage: broken });
    await m.showAttDeniedOncePerDay('2026-10-21');
    expect(denied).toHaveBeenCalledTimes(1);
  });
  it('가운데 팝업: 동시에 부르면 하나만 열고 같이 기다린다 · 화면이 던져도 돌아온다', async () => {
    const m = await fresh();
    let finish: () => void = () => undefined;
    const denied = vi.fn((done: () => void) => { finish = done; });
    m.registerAttHost({ primer: vi.fn(), denied });
    const both = Promise.all([m.showAttDeniedOncePerDay('2026-10-21'), m.showAttDeniedOncePerDay('2026-10-21')]);
    await vi.waitFor(() => expect(denied).toHaveBeenCalledTimes(1));
    finish(); await both;
    expect(denied).toHaveBeenCalledTimes(1);
    const m2 = await fresh();
    m2.registerAttHost({ primer: vi.fn(), denied: () => { throw new Error('x'); } });
    await expect(m2.showAttDeniedOncePerDay('2026-10-21')).resolves.toBeUndefined();
  });
  it('화면 등록을 풀면(언마운트) 다시 안내 없이 지나간다', async () => {
    const m = await fresh();
    const denied = vi.fn((done: () => void) => done());
    m.registerAttHost({ primer: vi.fn(), denied });
    m.registerAttHost(null);
    await m.showAttDeniedOncePerDay('2026-10-21');
    expect(denied).not.toHaveBeenCalled();
  });
});

describe('waitForReturn — 설정 앱에 다녀온 뒤', () => {
  afterEach(() => { vi.useRealTimers(); });
  const fakeApp = () => {
    const listeners = new Set<(s: string) => void>();
    const app = { addEventListener: (_t: string, fn: (s: string) => void) => { listeners.add(fn); return { remove: () => { listeners.delete(fn); } }; } };

    return { app, listeners, emit: (s: string) => { for (const fn of [...listeners]) fn(s); } };
  };

  it('앱이 뒤로 갔다가 앞으로 돌아오면 돌아온다 — 듣기도 풀린다', async () => {
    vi.useFakeTimers();
    const a = fakeApp();
    let done = false;
    void waitForReturn(a.app).then(() => { done = true; });
    a.emit('inactive'); a.emit('background');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(done, '뒤에 있는 동안은 기다린다 — 시간이 아무리 지나도').toBe(false);
    a.emit('active'); await Promise.resolve();
    expect(done).toBe(true);
    expect(a.listeners.size).toBe(0);
  });
  it('설정 앱으로 안 넘어갔으면(열기가 안 먹었으면) 2초 뒤에 돌아온다', async () => {
    vi.useFakeTimers();
    const a = fakeApp();
    let done = false;
    void waitForReturn(a.app).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(1999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(a.listeners.size).toBe(0);
  });
  it('떠나기 전의 active 에는 반응하지 않는다', async () => {
    vi.useFakeTimers();
    const a = fakeApp();
    let done = false;
    void waitForReturn(a.app, 5000).then(() => { done = true; });
    a.emit('active'); await Promise.resolve();
    expect(done).toBe(false);
  });
  it('앱 상태를 못 들으면 바로 돌아온다', async () => {
    await expect(waitForReturn(undefined)).resolves.toBeUndefined();
    await expect(waitForReturn({})).resolves.toBeUndefined();
    await expect(waitForReturn({ addEventListener: () => { throw new Error('x'); } })).resolves.toBeUndefined();
  });
});

describe('localDay — 로컬 달력 날짜', () => {
  it('YYYY-MM-DD 로 0 을 채운다', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDay(new Date(2026, 9, 20, 0, 1))).toBe('2026-10-20');
  });
});

describe('문구 — 정해진 글자 그대로, 대가 · 압박 · 업체 이름은 어디에도 없다(애플 5.1.2(i))', () => {
  it('시스템 창 앞 중립 안내는 확정 문구 그대로, 버튼은 하나', () => {
    expect(ATT_PRIMER_TEXTS).toEqual({
      title: '다음 화면에서 앱 추적 허용 여부를 물어봐요',
      body: '허용하면 앱 사용 기록이 광고와 참여형 미션 참여 확인에 쓰여요. 허용하지 않아도 앱은 그대로 이용할 수 있어요.',
      button: '계속',
    });
  });
  it('추적이 꺼져 있을 때의 가운데 팝업도 확정 문구 그대로', () => {
    expect(ATT_DENIED_TEXTS).toEqual({
      title: '추적이 꺼져 있어요',
      body: '추적이 꺼져 있으면 일부 미션은 참여 확인이 안 될 수 있어요. 원하시면 설정에서 켤 수 있어요.',
      openSettings: '설정 열기',
      proceed: '그냥 보기',
    });
  });
  it('옛 단계 시트 문구(ATT_SHEET_TEXTS)는 모두 비어 있다 — 이름만 남았다', () => {
    expect(ATT_SHEET_TEXTS).toEqual({ title: '', body: '', steps: [], guide: '', fallback: '', openSettings: '', later: '' });
  });

  const srcDir = join(__dirname);
  const distDir = join(__dirname, '..', 'dist');
  // 대가를 걸거나 못 쓴다고 압박하거나 업체 이름을 대는 말 + 옛 단계 시트의 문구 — 문구 값 · 코드 · 번역표 · 빌드 결과 어디에도 없어야 한다
  const FORBIDDEN = [
    '포인트', '적립', '보상', '혜택', '더 받', '쿠폰', '캐시', '못 써', '이용할 수 없', '사용할 수 없', '필요해요', '애드팝콘',
    '「설정」 앱을 열어요', '3단계까지', '앱이 추적을 요청하도록', '설정에서 허용하기', '나중에',
    'points', 'reward', 'bonus', 'earn ', 'adpopcorn',
  ];
  const hits = (text: string): string[] => FORBIDDEN.filter((w) => text.toLowerCase().includes(w.toLowerCase()));
  const read = (...p: string[]): string => readFileSync(join(...p), 'utf8');

  it('문구 값(중립 안내 · 팝업)에 금지 문구가 없다', () => {
    const values = [...Object.values(ATT_PRIMER_TEXTS), ...Object.values(ATT_DENIED_TEXTS)];
    expect(values).toHaveLength(7);
    for (const v of values) expect(hits(v), v).toEqual([]);
  });
  it('ATT 파일(소스 · 빌드 결과)에 금지 문구가 없다 — 심사관이 번들 문자열을 볼 수 있다', () => {
    for (const f of ['attSheet.ts', 'AttDeniedSheet.ts']) expect(hits(read(srcDir, f)), f).toEqual([]);
    for (const f of ['attSheet.js', 'attSheet.d.ts', 'AttDeniedSheet.js', 'AttDeniedSheet.d.ts']) expect(hits(read(distDir, f)), f).toEqual([]);
  });
  it('번역표(i18n 전체, 소스와 dist)에도 없다', () => {
    for (const base of [join(srcDir, 'i18n'), join(distDir, 'i18n')]) {
      const files: string[] = [];
      const locDir = join(base, 'locales');
      for (const f of readdirSync(locDir).filter((x) => /\.(ts|js)$/.test(x) && !x.endsWith('.d.ts'))) files.push(join(locDir, f));
      expect(files.length, base).toBeGreaterThan(1);
      for (const f of files) expect(hits(readFileSync(f, 'utf8')), f).toEqual([]);
    }
  });
  it('index 의 옛 이름들은 그대로 export 된다(앱이 import 해도 컴파일 · 실행 유지)', () => {
    expect(typeof pkg.AttDeniedSheet).toBe('function');
    expect(typeof pkg.ensureTrackingBeforeOfferwall).toBe('function');
    expect(typeof pkg.decideAttAction).toBe('function');
    expect(typeof pkg.localDay).toBe('function');
    expect(pkg.ATT_SHEET_TEXTS).toBe(ATT_SHEET_TEXTS);
    expect(pkg.ATT_PRIMER_TEXTS).toBe(ATT_PRIMER_TEXTS);
    expect(pkg.ATT_DENIED_TEXTS).toBe(ATT_DENIED_TEXTS);
  });
});

describe('정책 — 새 네이티브 모듈을 들이지 않는다', () => {
  const srcDir = join(__dirname);
  const specsOf = (file: string): string[] => {
    const s = readFileSync(join(srcDir, file), 'utf8');
    const out: string[] = [];
    for (const m of s.matchAll(/require\('([^']+)'\)|from '([^']+)'/g)) out.push(m[1] ?? m[2]);

    // 상대 경로 · 테스트 도구 · node 내장 · 문서 예시(index.ts 머리말의 @jcurve/ads)는 빼고 본다
    return out.filter((x) => !x.startsWith('.') && x !== 'vitest' && !x.startsWith('node:') && x !== '@jcurve/ads');
  };
  // 1.9.4 까지 src 가 이미 쓰던 외부 모듈 — 이 밖의 것을 들이면 실패한다
  const BASELINE = ['react', 'react-native', 'react-native-google-mobile-ads', 'expo-tracking-transparency', 'expo-updates', 'expo-constants', 'expo-modules-core'];

  it('src 의 모든 외부 모듈은 기존 목록 안에 있다', () => {
    const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    for (const f of files) {
      for (const spec of specsOf(f)) expect(BASELINE, `${f} → ${spec}`).toContain(spec);
    }
  });
  it('ATT 파일은 react · react-native · expo-tracking-transparency 만 쓴다', () => {
    const allowed = ['react', 'react-native', 'expo-tracking-transparency'];
    for (const f of ['attSheet.ts', 'AttDeniedSheet.ts']) {
      for (const spec of specsOf(f)) expect(allowed, `${f} → ${spec}`).toContain(spec);
    }
  });
});
