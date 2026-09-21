import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFunnel, FUNNEL_EVENTS, looksPersonal, pickVersion, referrerKeys, type FunnelEnv, type KeyValue } from './funnel';
import { createTrack, propOf, standardEvent } from './track';

function memory(init: Record<string, string> = {}): KeyValue & { data: Record<string, string> } {
  const data = { ...init };

  return {
    data,
    getItem: async (k) => data[k] ?? null,
    setItem: async (k, v) => { data[k] = v; },
  };
}

function env(o: Partial<FunnelEnv> = {}): FunnelEnv & { sent: Array<Record<string, any>> } {
  const sent: Array<Record<string, any>> = [];

  return {
    sent,
    os: () => 'android',
    appVersion: () => '1.0.6',
    post: async (_u, _h, body) => { sent.push(JSON.parse(body)); return true; },
    install: async () => null,
    now: () => 1_000_000,
    random: () => 'rnd',
    ...o,
  };
}

/** 보낸 것이 다 나갈 때까지 기다린다(모두 비동기로 나간다) */
const flush = () => new Promise((r) => setTimeout(r, 0));

const BASE = { base: 'https://api/v1/app', appToken: 'pub' };

describe('기기 ID — 설치 단위로 하나', () => {
  it('처음이면 만들어 저장하고 first_open 을 보낸다', async () => {
    const st = memory();
    const e = env();
    createFunnel({ ...BASE, storage: st }, e).appOpen();
    await flush(); await flush();
    expect(st.data['jc.device.v1']).toBeTruthy();
    expect(e.sent.map((s) => s.event)).toEqual(['first_open', 'app_open']);
  });

  it('**이미 쓰던 앱은 쓰던 키를 그대로 읽는다** — 바뀌면 전 사용자가 첫 실행으로 찍힌다', async () => {
    const st = memory({ 'kko.device.v1': 'old-device' });
    const e = env();
    createFunnel({ ...BASE, storage: st, keys: { device: 'kko.device.v1' } }, e).appOpen();
    await flush(); await flush();
    expect(e.sent.map((s) => s.event)).toEqual(['app_open']);
    expect(e.sent[0].device).toBe('old-device');
  });

  it('기능이 나오기 전부터 쓰던 사람은 기기 ID 가 없어도 첫 실행이 아니다', async () => {
    const e = env();
    createFunnel({ ...BASE, storage: memory(), existingUser: async () => true }, e).appOpen();
    await flush(); await flush();
    expect(e.sent.map((s) => s.event)).toEqual(['app_open']);
  });
});

describe('보내는 것', () => {
  it('서버 허용 목록에 없는 이름은 보내지 않는다 — 400 으로 조용히 버려진다', async () => {
    const e = env();
    const f = createFunnel({ ...BASE, storage: memory() }, e);
    f.event('login_native_ok');
    f.event('made_up_event');
    f.event('login_tap', 'kakao');
    await flush(); await flush();
    expect(e.sent.map((s) => s.event)).toEqual(['login_tap']);
    expect(e.sent[0].p).toBe('kakao');
  });

  it('꼬리표는 영문·숫자·_:.- 만, 40자 — 서버가 그 밖은 버린다', async () => {
    const e = env();
    createFunnel({ ...BASE, storage: memory() }, e).event('login_fail', 'kakao:오류 (x)' + 'a'.repeat(60));
    await flush(); await flush();
    expect(e.sent[0].p).toMatch(/^[A-Za-z0-9_:.-]{1,40}$/);
  });

  it('웹 미리보기에서는 아무것도 보내지 않는다', async () => {
    const e = env({ os: () => 'web' });
    const f = createFunnel({ ...BASE, storage: memory() }, e);
    f.appOpen();
    f.event('login_tap');
    await flush(); await flush();
    expect(e.sent).toEqual([]);
  });

  it('보내기가 실패해도 던지지 않는다 — 계측이 앱을 막으면 안 된다', async () => {
    const e = env({ post: async () => { throw new Error('down'); } });
    const f = createFunnel({ ...BASE, storage: memory() }, e);
    expect(() => { f.appOpen(); f.event('login_tap'); }).not.toThrow();
    await flush(); await flush();
  });
});

describe('설치 출처 (안드로이드)', () => {
  it('14일 안의 설치면 한 번 보내고, 확인되면 다시 안 보낸다', async () => {
    const st = memory({ 'jc.device.v1': 'd' });
    const e = env({ install: async () => ({ at: 1_000_000 - 3600_000, ref: 'utm_source=google' }) });
    createFunnel({ ...BASE, storage: st }, e).appOpen();
    await flush(); await flush(); await flush();
    expect(e.sent.find((s) => s.event === 'install_ref')?.ref).toBe('utm_source=google');
    expect(st.data['jc.installRef.v1']).toBe('1');
  });

  it('14일이 지난 설치는 보내지 않는다', async () => {
    const st = memory({ 'jc.device.v1': 'd' });
    const e = env({ install: async () => ({ at: 1_000_000 - 15 * 86400_000, ref: 'x' }) });
    createFunnel({ ...BASE, storage: st }, e).appOpen();
    await flush(); await flush(); await flush();
    expect(e.sent.some((s) => s.event === 'install_ref')).toBe(false);
    expect(st.data['jc.installRef.v1']).toBe('old');
  });

  it('보내기가 실패하면 표시하지 않는다 — 다음 실행에 다시 보낸다', async () => {
    const st = memory({ 'jc.device.v1': 'd' });
    const e = env({
      install: async () => ({ at: 1_000_000, ref: 'r' }),
      post: async (_u, _h, body) => !JSON.parse(body).ref,   // install_ref 만 실패
    });
    createFunnel({ ...BASE, storage: st }, e).appOpen();
    await flush(); await flush(); await flush();
    expect(st.data['jc.installRef.v1']).toBeUndefined();
  });
});

/*
 | 이름 목록이 서버와 어긋나면 **오류 없이 그 단계만 비어 보인다.** 같은 기계에 공용 API 저장소가
 | 있으면 대조한다. 없으면 건너뛴다 — 건너뛴 것을 통과로 읽지 말 것(CI 에서는 대조가 안 돈다).
 */
const SERVER = join(__dirname, '..', '..', '..', '..', 'jcurve-api', 'app', 'Http', 'Controllers', 'Api', 'FunnelController.php');

describe('서버 허용 목록과 같다', () => {
  it.skipIf(!existsSync(SERVER))('jcurve-api FunnelController::EVENTS 와 이름이 같다', () => {
    const php = readFileSync(SERVER, 'utf8');
    const block = php.match(/const EVENTS = \[([\s\S]*?)\];/);
    expect(block, 'EVENTS 를 찾지 못했다').toBeTruthy();
    const server = [...block![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect([...FUNNEL_EVENTS].sort()).toEqual(server);
  });
});

describe('기록기 — GA4 와 서버 퍼널에 같은 이름으로', () => {
  it('꼬리표는 제공자:사유', () => {
    expect(propOf({ provider: 'kakao', code: 'no_sdk' })).toBe('kakao:no_sdk');
    expect(propOf({ provider: 'google', reason: 'x y' })).toBe('google:xy');
    expect(propOf({ step: 1 })).toBeUndefined();
  });

  it('GA4 추천 이벤트로 한 번 더', () => {
    expect(standardEvent('signup_done', { provider: 'kakao' })).toEqual(['sign_up', { method: 'kakao' }]);
    expect(standardEvent('login_done', {})).toEqual(['login', undefined]);
    expect(standardEvent('onboarding_view', { step: 1 })?.[0]).toBe('tutorial_begin');
    expect(standardEvent('onboarding_view', { step: 2 })).toBeNull();
  });

  it('퍼널에 꼬리표를 붙여 보내고, GA4 에는 원래 이름 + 추천 이름', () => {
    const funnel: Array<[string, string | undefined]> = [];
    const ga: Array<[string, any]> = [];
    const track = createTrack(
      { funnel: { event: (n, p) => { funnel.push([n, p]); }, appOpen: () => undefined } },
      { ga: () => ({ getAnalytics: () => 'A', logEvent: (_a, n, p) => { ga.push([n, p]); } }) },
    );
    track('signup_done', { provider: 'kakao', extra: null });
    expect(funnel).toEqual([['signup_done', 'kakao']]);
    expect(ga).toEqual([['signup_done', { provider: 'kakao' }], ['sign_up', { method: 'kakao' }]]);
  });

  it('GA4 모듈이 없어도 퍼널은 남는다', () => {
    const funnel: string[] = [];
    const track = createTrack({ funnel: { event: (n) => { funnel.push(n); }, appOpen: () => undefined } }, { ga: () => null });
    track('login_tap', { provider: 'google' });
    expect(funnel).toEqual(['login_tap']);
  });

  it('GA4 가 던져도 앱을 막지 않는다', () => {
    const track = createTrack({}, { ga: () => ({ getAnalytics: () => { throw new Error('x'); }, logEvent: () => undefined }) });
    expect(() => track('login_tap')).not.toThrow();
  });
});

describe('Codex 지적 — 저장소·비동기·개인정보', () => {
  it('저장소를 못 읽으면 기기 ID 를 덮어쓰지 않고 첫 실행으로 세지 않는다(#7)', async () => {
    const st = memory({ 'jc.device.v1': 'keep-me' });
    st.getItem = async () => { throw new Error('io'); };
    const e = env();
    createFunnel({ ...BASE, storage: st }, e).appOpen();
    await flush(); await flush();
    expect(st.data['jc.device.v1'], '멀쩡한 ID 를 덮어썼다').toBe('keep-me');
    expect(e.sent.map((s) => s.event)).toEqual(['app_open']);
    expect(e.sent[0].device).toMatch(/^tmp-/);
  });

  it('저장을 못 하면 첫 실행으로 세지 않는다 — 실행마다 새 ID 라 매번 첫 실행이 된다', async () => {
    const st = memory();
    st.setItem = async () => { throw new Error('full'); };
    const e = env();
    createFunnel({ ...BASE, storage: st }, e).appOpen();
    await flush(); await flush();
    expect(e.sent.map((s) => s.event)).toEqual(['app_open']);
  });

  it('보내기가 거절해도 처리되지 않은 거절로 새지 않는다(#8)', async () => {
    const leaks: unknown[] = [];
    const onLeak = (r: unknown) => { leaks.push(r); };
    process.on('unhandledRejection', onLeak);
    try {
      const e = env({ post: () => Promise.reject(new Error('down')) });
      const f = createFunnel({ ...BASE, storage: memory() }, e);
      f.appOpen();
      f.event('login_tap');
      await new Promise((r) => setTimeout(r, 20));
      expect(leaks).toEqual([]);
    } finally {
      process.off('unhandledRejection', onLeak);
    }
  });

  it('GA4 logEvent 가 거절해도 새지 않는다(#8)', async () => {
    const leaks: unknown[] = [];
    const onLeak = (r: unknown) => { leaks.push(r); };
    process.on('unhandledRejection', onLeak);
    try {
      const track = createTrack({}, { ga: () => ({ getAnalytics: () => 'A', logEvent: () => Promise.reject(new Error('ga')) }) });
      track('signup_done', { provider: 'kakao' });
      await new Promise((r) => setTimeout(r, 20));
      expect(leaks).toEqual([]);
    } finally {
      process.off('unhandledRejection', onLeak);
    }
  });

  it('개인정보처럼 보이는 것은 서버 퍼널에도 GA4 에도 안 간다(#9)', async () => {
    const e = env();
    const funnel = createFunnel({ ...BASE, storage: memory() }, e);
    const ga: Array<[string, any]> = [];
    const track = createTrack({ funnel }, { ga: () => ({ getAnalytics: () => 'A', logEvent: (_a, n, p) => { ga.push([n, p]); } }) });
    track('login_fail', { provider: 'kakao', reason: '01012345678', email: 'a@b.com', phone: '010', memo: 'me@x.kr', step: 3 });
    await flush(); await flush();
    expect(e.sent[0].p, '번호가 꼬리표로 새었다').toBe('kakao');
    expect(ga[0][1]).toEqual({ provider: 'kakao', step: 3 });
  });
});

describe('Codex 2차 — 개인정보가 새는 길(#6)', () => {
  it('추천 이벤트의 method 도 거른다 — 아는 로그인 이름만', () => {
    expect(standardEvent('sign_up_x' as string, {})).toBeNull();
    expect(standardEvent('signup_done', { provider: 'alice@example.test' })).toEqual(['sign_up', undefined]);
    expect(standardEvent('login_done', { provider: 'naver' })).toEqual(['login', { method: 'naver' }]);
  });

  it('하이픈·공백으로 끊은 전화번호도 알아본다', () => {
    expect(looksPersonal('010-1234-5678')).toBe(true);
    expect(looksPersonal('010 1234 5678')).toBe(true);
    expect(looksPersonal(1012345678)).toBe(true);
    expect(looksPersonal('kakao:sdk_12501')).toBe(false);
  });

  it('GA4 로 숫자 회원번호·전화번호가 안 간다', () => {
    const ga: Array<[string, any]> = [];
    const track = createTrack({}, { ga: () => ({ getAnalytics: () => 'A', logEvent: (_a, n, p) => { ga.push([n, p]); } }) });
    track('login_fail', { provider: 'kakao', member_id: 123, seq: 1234567890, reason: '010-1234-5678', step: 2, ok: true });
    expect(ga[0][1]).toEqual({ provider: 'kakao', step: 2, ok: true });
  });

  it('설치 리퍼러는 광고 추적 키만 남긴다', () => {
    expect(referrerKeys('utm_source=google&email=a%40b.com&gclid=Cj0K&x=1&utm_medium=cpc'))
      .toBe('utm_source=google&gclid=Cj0K&utm_medium=cpc');
    expect(referrerKeys('')).toBe('');
  });

  it('설치 리퍼러 값에 개인정보가 보이면 그 쌍을 버린다(Codex 3차)', () => {
    expect(referrerKeys('utm_source=naver&utm_term=a%40b.com&utm_content=01012345678&utm_campaign=fall+sale'))
      .toBe('utm_source=naver&utm_campaign=fall+sale');
    expect(referrerKeys('gclid=Cj0K_a-B&gbraid=a%40b&wbraid=x%20y')).toBe('gclid=Cj0K_a-B');
  });

  it('꼬리표의 제공자도 아는 이름만(Codex 3차)', () => {
    expect(propOf({ provider: 'a@b.com', code: 'no_sdk' })).toBe('no_sdk');
    expect(propOf({ provider: 'hong', code: 'x' })).toBe('x');
    expect(propOf({ provider: 'apple_web', code: 'x' })).toBe('apple_web:x');
    expect(propOf({ provider: 'kakao_native' })).toBe('kakao_native');
  });
});

describe('앱 버전 — OTA 런타임이 없으면 앱 설정 버전(2.1.1)', () => {
  it('런타임 버전이 있으면 그것', () => { expect(pickVersion('1.0.6', '1.0.6')).toBe('1.0.6'); });
  it('OTA 가 꺼진 빌드(런타임 없음)는 앱 설정 버전 — 비우면 서버 app_ver 가 null 로 쌓인다', () => {
    expect(pickVersion('', '1.0.0')).toBe('1.0.0');
    expect(pickVersion(null, '1.0.0')).toBe('1.0.0');
  });
  it('둘 다 없으면 빈 문자열', () => { expect(pickVersion(undefined, undefined)).toBe(''); });
});
