import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  ATT_SHEET_TEXTS, ATT_STORAGE_KEY, attSheetTexts, decideAttAction, ensureTrackingBeforeOfferwallWith, launchCheck, localDay,
  type AttDeps, type AttStorage, type TrackingModule,
} from './attSheet';

const TODAY = '2026-10-20';
const YESTERDAY = '2026-10-19';

function fakeTracking(status: string, req?: string): TrackingModule & { get: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> } {
  const get = vi.fn(async () => ({ status }));
  const request = vi.fn(async () => ({ status: req ?? status }));

  return { get, request, getTrackingPermissionsAsync: get, requestTrackingPermissionsAsync: request };
}

function memStore(initial?: string): AttStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(ATT_STORAGE_KEY, initial);

  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
}

function deps(over: Partial<AttDeps> & { tracking?: TrackingModule | null }): AttDeps {
  return { os: 'ios', tracking: null, storage: memStore(), today: () => TODAY, ...over } as AttDeps;
}

describe('decideAttAction — 상태 × 시점 × 마지막 표시일', () => {
  const act = (status: string, trigger: 'launch' | 'offerwall', lastShownDay: string | null = null) =>
    decideAttAction({ os: 'ios', trigger, status, lastShownDay, today: TODAY });

  it('앱 켤 때 거부·제한이고 오늘 안 보였으면 시트', () => {
    expect(act('denied', 'launch')).toBe('show');
    expect(act('restricted', 'launch', YESTERDAY)).toBe('show');
  });
  it('앱 켤 때 거부·제한이라도 오늘 이미 보였으면 아무것도 안 함(하루 한 번)', () => {
    expect(act('denied', 'launch', TODAY)).toBe('none');
    expect(act('restricted', 'launch', TODAY)).toBe('none');
  });
  it('오퍼월은 거부·제한이면 마지막 표시일과 상관없이 매번 시트', () => {
    expect(act('denied', 'offerwall', TODAY)).toBe('show');
    expect(act('restricted', 'offerwall', TODAY)).toBe('show');
    expect(act('denied', 'offerwall')).toBe('show');
  });
  it('미정이면 어느 시점이든 시트가 아니라 시스템 요청', () => {
    expect(act('undetermined', 'launch')).toBe('request');
    expect(act('undetermined', 'offerwall', TODAY)).toBe('request');
  });
  it('허용됐거나 알 수 없는 상태는 아무것도 안 함', () => {
    expect(act('granted', 'launch')).toBe('none');
    expect(act('granted', 'offerwall')).toBe('none');
    expect(act('unknown', 'offerwall')).toBe('none');
    expect(act('unavailable', 'launch')).toBe('none');
  });
  it('Android 는 어떤 상태든 아무것도 안 한다(no-op)', () => {
    for (const status of ['denied', 'restricted', 'undetermined', 'granted']) {
      expect(decideAttAction({ os: 'android', trigger: 'launch', status, lastShownDay: null, today: TODAY })).toBe('none');
      expect(decideAttAction({ os: 'android', trigger: 'offerwall', status, lastShownDay: null, today: TODAY })).toBe('none');
    }
  });
});

describe('launchCheck — 앱 켤 때', () => {
  it('거부면 시트를 돌려주고 오늘 날짜를 저장한다', async () => {
    const st = memStore(YESTERDAY);
    expect(await launchCheck(deps({ tracking: fakeTracking('denied'), storage: st }))).toBe('show');
    expect(st.data.get(ATT_STORAGE_KEY)).toBe(TODAY);
  });
  it('오늘 이미 보였으면 시트를 띄우지 않는다(하루 한 번 캡)', async () => {
    const t = fakeTracking('denied');
    expect(await launchCheck(deps({ tracking: t, storage: memStore(TODAY) }))).toBe('none');
    expect(t.request).not.toHaveBeenCalled();
  });
  it('미정이면 시스템 요청을 부르고 시트는 안 띄운다', async () => {
    const t = fakeTracking('undetermined', 'granted');
    const before = vi.fn(async () => {});
    expect(await launchCheck(deps({ tracking: t, beforeRequest: before }))).toBe('none');
    expect(before).toHaveBeenCalledTimes(1);
    expect(t.request).toHaveBeenCalledTimes(1);
  });
  it('beforeRequest 가 던져도 시스템 요청은 한다', async () => {
    const t = fakeTracking('undetermined');
    await launchCheck(deps({ tracking: t, beforeRequest: async () => { throw new Error('x'); } }));
    expect(t.request).toHaveBeenCalledTimes(1);
  });
  it('Android 는 추적 모듈을 건드리지 않고 none', async () => {
    const t = fakeTracking('denied');
    expect(await launchCheck(deps({ os: 'android', tracking: t }))).toBe('none');
    expect(t.get).not.toHaveBeenCalled();
  });
  it('모듈이 없으면(Expo Go 등) 던지지 않고 none', async () => {
    await expect(launchCheck(deps({ tracking: null }))).resolves.toBe('none');
  });
  it('상태 읽기가 던지면 unknown 으로 보고 none', async () => {
    const bad: TrackingModule = {
      getTrackingPermissionsAsync: async () => { throw new Error('boom'); },
      requestTrackingPermissionsAsync: async () => { throw new Error('boom'); },
    };
    await expect(launchCheck(deps({ tracking: bad }))).resolves.toBe('none');
  });
  it('저장소가 던져도 시트 판단은 한다(마지막 날짜를 모르면 오늘 안 본 것으로)', async () => {
    const broken: AttStorage = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('y'); } };
    expect(await launchCheck(deps({ tracking: fakeTracking('denied'), storage: broken }))).toBe('show');
  });
});

describe('ensureTrackingBeforeOfferwallWith — 오퍼월 들어가기 전', () => {
  it('거부면 매번 시트를 열고, 닫힌 뒤 다시 읽은 상태를 돌려준다', async () => {
    const t = fakeTracking('denied');
    const opener = vi.fn((done: () => void) => { t.get.mockResolvedValueOnce({ status: 'granted' }); done(); });
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: t }), opener)).toBe('granted');
    expect(opener).toHaveBeenCalledTimes(1);
  });
  it('시트를 두 번 불러도 두 번 연다(오퍼월은 하루 캡이 없다)', async () => {
    const t = fakeTracking('restricted');
    const opener = vi.fn((done: () => void) => done());
    await ensureTrackingBeforeOfferwallWith(deps({ tracking: t, storage: memStore(TODAY) }), opener);
    await ensureTrackingBeforeOfferwallWith(deps({ tracking: t, storage: memStore(TODAY) }), opener);
    expect(opener).toHaveBeenCalledTimes(2);
  });
  it('시트가 안 붙어 있으면 시트 없이 현재 상태를 돌려준다', async () => {
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: fakeTracking('denied') }), null)).toBe('denied');
  });
  it('미정이면 시스템 요청 결과를 돌려주고 시트는 안 연다', async () => {
    const t = fakeTracking('undetermined', 'denied');
    const opener = vi.fn();
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: t }), opener)).toBe('denied');
    expect(t.request).toHaveBeenCalledTimes(1);
    expect(opener).not.toHaveBeenCalled();
  });
  it('허용이면 바로 돌려준다', async () => {
    const opener = vi.fn();
    expect(await ensureTrackingBeforeOfferwallWith(deps({ tracking: fakeTracking('granted') }), opener)).toBe('granted');
    expect(opener).not.toHaveBeenCalled();
  });
  it('Android 는 unavailable 을 돌려주고 아무것도 안 한다', async () => {
    const t = fakeTracking('denied');
    const opener = vi.fn();
    expect(await ensureTrackingBeforeOfferwallWith(deps({ os: 'android', tracking: t }), opener)).toBe('unavailable');
    expect(t.get).not.toHaveBeenCalled();
    expect(opener).not.toHaveBeenCalled();
  });
  it('모듈이 없으면 unavailable', async () => {
    await expect(ensureTrackingBeforeOfferwallWith(deps({ tracking: null }), vi.fn())).resolves.toBe('unavailable');
  });
});

describe('localDay — 로컬 달력 날짜', () => {
  it('YYYY-MM-DD 로 0 을 채운다', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDay(new Date(2026, 9, 20, 0, 1))).toBe('2026-10-20');
  });
});

describe('문구 — 정확한 한국어와 앱 이름 자리', () => {
  it('기본 문구는 정해진 글자 그대로다', () => {
    expect(ATT_SHEET_TEXTS.title).toBe('추적을 허용하면 포인트를 더 받을 수 있어요');
    expect(ATT_SHEET_TEXTS.body).toBe('참여형 미션 포인트는 추적 허용이 켜져 있어야 적립돼요');
    expect(ATT_SHEET_TEXTS.steps).toEqual([
      '「설정」 앱을 열어요',
      '「앱」으로 가요',
      '「{appName}」을 찾아 눌러요',
      '「추적 허용」을 켜요',
      '앱으로 돌아오면 바로 적립돼요',
    ]);
    expect(ATT_SHEET_TEXTS.guide).toBe('아래 「설정에서 허용하기」를 누르면 3단계까지 바로 가요');
    expect(ATT_SHEET_TEXTS.fallback).toBe('앱 화면에 「추적 허용」이 안 보이면: 설정 → 개인정보 보호 및 보안 → 추적 → 맨 위 「앱이 추적을 요청하도록 허용」을 먼저 켜요');
    expect(ATT_SHEET_TEXTS.openSettings).toBe('설정에서 허용하기');
    expect(ATT_SHEET_TEXTS.later).toBe('나중에');
  });
  it('셋째 줄의 {appName} 을 앱 이름으로 바꾼다', () => {
    const t = attSheetTexts('꼬꼬농장');
    expect(t.steps[2]).toBe('「꼬꼬농장」을 찾아 눌러요');
    expect(t.steps[0]).toBe('「설정」 앱을 열어요');
  });
  it('덮어쓴 문구가 있으면 그것을 쓰고, 빠진 항목은 기본을 쓴다', () => {
    const t = attSheetTexts('앱', { later: '다음에', title: '제목' });
    expect(t.later).toBe('다음에');
    expect(t.title).toBe('제목');
    expect(t.openSettings).toBe('설정에서 허용하기');
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
  it('ATT 시트 파일은 react · react-native · expo-tracking-transparency 만 쓴다', () => {
    const allowed = ['react', 'react-native', 'expo-tracking-transparency'];
    for (const f of ['attSheet.ts', 'AttDeniedSheet.ts']) {
      for (const spec of specsOf(f)) expect(allowed, `${f} → ${spec}`).toContain(spec);
    }
  });
});
