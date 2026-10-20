import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as pkg from './index';
import {
  ATT_PRIMER_TEXTS, ATT_SHEET_TEXTS, attSheetTexts, decideAttAction, ensureTrackingBeforeOfferwall, ensureTrackingBeforeOfferwallWith, localDay,
  type AttDeps, type TrackingModule,
} from './attSheet';

const TODAY = '2026-10-20';

function fakeTracking(status: string, req?: string): TrackingModule & { get: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> } {
  const get = vi.fn(async () => ({ status }));
  const request = vi.fn(async () => ({ status: req ?? status }));

  return { get, request, getTrackingPermissionsAsync: get, requestTrackingPermissionsAsync: request };
}

const deps = (over: Partial<AttDeps>): AttDeps => ({ os: 'ios', tracking: null, ...over });

describe('decideAttAction — 언제 무엇을 하나(1.9.11)', () => {
  const act = (status: string, trigger: 'launch' | 'offerwall', os = 'ios') =>
    decideAttAction({ os, trigger, status, lastShownDay: null, today: TODAY });

  it('미정이면 어느 시점이든 시스템 창 요청(그 앞에 중립 안내가 붙는다)', () => {
    expect(act('undetermined', 'launch')).toBe('request');
    expect(act('undetermined', 'offerwall')).toBe('request');
  });
  it('거부 · 제한은 오퍼월 진입 때만 단계 시트', () => {
    expect(act('denied', 'offerwall')).toBe('show');
    expect(act('restricted', 'offerwall')).toBe('show');
  });
  it('거부 · 제한이라도 앱을 켤 때(launch)는 절대 시트를 안 띄운다 — 홈 · 루트 자동 팝업 없음', () => {
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

describe('ensureTrackingBeforeOfferwallWith — 오퍼월 들어가기 전', () => {
  it('거부면 단계 시트를 열고, 닫힌 뒤 다시 읽은 상태를 돌려준다 — 시스템 창 · 중립 안내는 안 부른다', async () => {
    const t = fakeTracking('denied');
    const sheet = vi.fn(async () => { t.get.mockResolvedValueOnce({ status: 'granted' }); });
    const primer = vi.fn(async () => undefined);
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: t, sheet, primer }))).toBe('granted');
    expect(sheet).toHaveBeenCalledTimes(1);
    expect(primer).not.toHaveBeenCalled();
    expect(t.request).not.toHaveBeenCalled();
  });
  it('제한도 같다 · 오퍼월을 누를 때마다 연다(탭할 때만 — 자동으로는 안 뜬다)', async () => {
    const t = fakeTracking('restricted');
    const sheet = vi.fn(async () => undefined);
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: t, sheet }))).toBe('restricted');
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: t, sheet }))).toBe('restricted');
    expect(sheet).toHaveBeenCalledTimes(2);
  });
  it('시트가 던져도 막히지 않고 상태를 돌려준다', async () => {
    const sheet = vi.fn(async () => { throw new Error('x'); });
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: fakeTracking('denied'), sheet }))).toBe('denied');
  });
  it('화면이 안 붙어 있으면(AttDeniedSheet 미마운트) 시트 없이 바로 상태를 돌려준다', async () => {
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: fakeTracking('denied') }))).toBe('denied');
  });
  it('미정이면 중립 안내가 먼저, 그 뒤에 시스템 창 — 순서가 바뀌지 않는다', async () => {
    const order: string[] = [];
    const t = fakeTracking('undetermined', 'denied');
    t.request.mockImplementation(async () => { order.push('system'); return { status: 'denied' }; });
    const primer = vi.fn(async () => { order.push('primer'); });
    const sheet = vi.fn(async () => undefined);
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: t, primer, sheet }))).toBe('denied');
    expect(order).toEqual(['primer', 'system']);
    expect(sheet).not.toHaveBeenCalled();
  });
  it('중립 안내가 던져도 시스템 창은 묻는다', async () => {
    const t = fakeTracking('undetermined', 'granted');
    const primer = vi.fn(async () => { throw new Error('x'); });
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: t, primer }))).toBe('granted');
    expect(t.request).toHaveBeenCalledTimes(1);
  });
  it('허용이면 아무것도 안 띄우고 바로 돌려준다', async () => {
    const primer = vi.fn(async () => undefined);
    const sheet = vi.fn(async () => undefined);
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: fakeTracking('granted'), primer, sheet }))).toBe('granted');
    expect(primer).not.toHaveBeenCalled();
    expect(sheet).not.toHaveBeenCalled();
  });
  it('Android 는 unavailable 을 돌려주고 추적 모듈도 안내도 건드리지 않는다', async () => {
    const t = fakeTracking('denied');
    const sheet = vi.fn(async () => undefined);
    expect(await ensureTrackingBeforeOfferwallWith(deps({ os: 'android', tracking: t, sheet }))).toBe('unavailable');
    expect(t.get).not.toHaveBeenCalled();
    expect(sheet).not.toHaveBeenCalled();
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

describe('화면 등록 — 중립 안내는 한 번, 단계 시트는 부를 때마다', () => {
  const fresh = async () => { vi.resetModules(); return import('./attSheet'); };

  it('화면이 없으면 둘 다 바로 돌아온다(안내 없이 지나간다)', async () => {
    const m = await fresh();
    await expect(m.showAttPrimerOnce()).resolves.toBeUndefined();
    await expect(m.showAttSheet()).resolves.toBeUndefined();
  });
  it('중립 안내: 사용자가 끝낼 때까지 기다리고, 한 번 보인 뒤에는 다시 안 보인다', async () => {
    const m = await fresh();
    let finish: () => void = () => undefined;
    const primer = vi.fn((done: () => void) => { finish = done; });
    m.registerAttHost({ primer, sheet: vi.fn() });
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
  it('중립 안내: 동시에 부르면 하나를 같이 기다린다', async () => {
    const m = await fresh();
    let finish: () => void = () => undefined;
    const primer = vi.fn((done: () => void) => { finish = done; });
    m.registerAttHost({ primer, sheet: vi.fn() });
    const both = Promise.all([m.showAttPrimerOnce(), m.showAttPrimerOnce()]);
    await Promise.resolve();
    finish(); await both;
    expect(primer).toHaveBeenCalledTimes(1);
  });
  it('중립 안내: 화면이 던져도 돌아오고, 그 뒤엔 다시 안 연다', async () => {
    const m = await fresh();
    const primer = vi.fn(() => { throw new Error('x'); });
    m.registerAttHost({ primer, sheet: vi.fn() });
    await expect(m.showAttPrimerOnce()).resolves.toBeUndefined();
    await m.showAttPrimerOnce();
    expect(primer).toHaveBeenCalledTimes(1);
  });
  it('단계 시트: 닫힐 때까지 기다리고, 닫힌 뒤 다시 부르면 다시 열린다 · 동시 호출은 하나', async () => {
    const m = await fresh();
    const dones: Array<() => void> = [];
    const sheet = vi.fn((done: () => void) => { dones.push(done); });
    m.registerAttHost({ primer: vi.fn(), sheet });
    const both = Promise.all([m.showAttSheet(), m.showAttSheet()]);
    await Promise.resolve();
    expect(sheet).toHaveBeenCalledTimes(1);
    dones[0](); await both;
    const again = m.showAttSheet();
    await Promise.resolve();
    expect(sheet).toHaveBeenCalledTimes(2);
    dones[1](); await again;
  });
  it('화면 등록을 풀면(언마운트) 다시 안내 없이 지나간다', async () => {
    const m = await fresh();
    const sheet = vi.fn((done: () => void) => done());
    m.registerAttHost({ primer: vi.fn(), sheet });
    m.registerAttHost(null);
    await m.showAttSheet();
    expect(sheet).not.toHaveBeenCalled();
  });
});

describe('localDay — 로컬 달력 날짜', () => {
  it('YYYY-MM-DD 로 0 을 채운다', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDay(new Date(2026, 9, 20, 0, 1))).toBe('2026-10-20');
  });
});

describe('문구 — 정해진 글자 그대로, 대가 · 압박 문구는 어디에도 없다(애플 5.1.2(i))', () => {
  it('시스템 창 앞 중립 안내는 확정 문구 그대로, 버튼은 하나', () => {
    expect(ATT_PRIMER_TEXTS).toEqual({
      title: '다음 화면에서 앱 추적 허용 여부를 물어봐요',
      body: '허용하면 앱 사용 기록이 광고와 참여형 미션 참여 확인에 쓰여요. 허용하지 않아도 앱은 그대로 이용할 수 있어요.',
      button: '계속',
    });
  });
  it('거부 · 제한 단계 시트: 첫 줄만 바뀌었고 단계는 다섯 개 그대로', () => {
    expect(ATT_SHEET_TEXTS.title).toBe('애드팝콘 참여형 미션은 설치 · 참여 확인을 위해 추적 허용이 필요해요');
    expect(ATT_SHEET_TEXTS.body).toBe('');
    expect(ATT_SHEET_TEXTS.steps).toEqual([
      '「설정」 앱을 열어요',
      '「앱」으로 가요',
      '「{appName}」을 찾아 눌러요',
      '「추적 허용」을 켜요',
      '앱으로 돌아오면 바로 이용할 수 있어요',
    ]);
    expect(ATT_SHEET_TEXTS.guide).toBe('아래 「설정에서 허용하기」를 누르면 3단계까지 바로 가요');
    expect(ATT_SHEET_TEXTS.fallback).toBe('앱 화면에 「추적 허용」이 안 보이면: 설정 → 개인정보 보호 및 보안 → 추적 → 맨 위 「앱이 추적을 요청하도록 허용」을 먼저 켜요');
    expect(ATT_SHEET_TEXTS.openSettings).toBe('설정에서 허용하기');
    expect(ATT_SHEET_TEXTS.later).toBe('나중에');
  });
  it('셋째 줄의 {appName} 을 앱 이름으로 바꾸고, 덮어쓴 문구는 그것을 쓴다', () => {
    expect(attSheetTexts('꼬꼬농장').steps[2]).toBe('「꼬꼬농장」을 찾아 눌러요');
    const t = attSheetTexts('앱', { later: '다음에', title: '제목' });
    expect([t.later, t.title, t.openSettings]).toEqual(['다음에', '제목', '설정에서 허용하기']);
  });

  const srcDir = join(__dirname);
  const distDir = join(__dirname, '..', 'dist');
  // 대가를 걸거나 못 쓴다고 압박하는 말 — 문구 값 · 코드 · 번역표 · 빌드 결과 어디에도 없어야 한다
  const FORBIDDEN = ['포인트', '적립', '보상', '혜택', '더 받', '쿠폰', '캐시', '못 써', '이용할 수 없', '사용할 수 없', 'points', 'reward', 'bonus', 'earn '];
  const hits = (text: string): string[] => FORBIDDEN.filter((w) => text.toLowerCase().includes(w));
  const read = (...p: string[]): string => readFileSync(join(...p), 'utf8');

  it('문구 값(중립 안내 · 단계 시트)에 금지 문구가 없다', () => {
    const values = [...Object.values(ATT_PRIMER_TEXTS), ...Object.values(ATT_SHEET_TEXTS).flat()];
    expect(values.length).toBeGreaterThan(10);
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
