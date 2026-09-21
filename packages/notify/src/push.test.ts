import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createPush, type PushDeps, type PushEnv } from './push';

/* eslint-disable @typescript-eslint/no-explicit-any */

const SESSION = 'a'.repeat(64);

function setup(o: {
  session?: string | null;
  consent?: boolean;
  granted?: boolean;
  token?: string;
  noModule?: boolean;
  lastResponse?: any;
  platform?: string;
  tokenError?: string;
  reply?: () => unknown;
} = {}) {
  const errors: Array<{ stage: string; message: string }> = [];
  const calls: Array<{ url: string; headers: Record<string, string>; body: any }> = [];
  const opened: string[] = [];
  let respond: ((r: any) => void) | null = null;
  const s = { session: o.session === undefined ? SESSION : o.session, token: o.token ?? 'fcmTok:APA91b-device_token_0123456789' };
  const N = {
    getPermissionsAsync: async () => ({ granted: o.granted ?? true }),
    getDevicePushTokenAsync: async () => {
      if (o.tokenError) throw new Error(o.tokenError);
      return { type: o.platform ?? 'android', data: s.token };
    },
    getExpoPushTokenAsync: async () => { throw new Error('Expo 토큰은 쓰지 않는다'); },
    addNotificationResponseReceivedListener: (fn: (r: any) => void) => { respond = fn; },
    getLastNotificationResponseAsync: async () => o.lastResponse ?? null,
  };
  const env: PushEnv = {
    notifications: () => (o.noModule ? null : N),
    platform: () => o.platform ?? 'android',
    fetch: async (url, init) => { calls.push({ url, headers: init.headers, body: JSON.parse(init.body) }); return o.reply ? o.reply() : {}; },
    openUrl: (u) => { opened.push(u); },
  };
  const deps: PushDeps = {
    base: 'https://api.j-curve.co.kr/v1/kkokkofarm/',
    appToken: 'APPTOKEN',
    session: () => s.session,
    consent: o.consent === undefined ? undefined : () => o.consent as boolean,
    onError: (e) => { errors.push(e); },
  };
  const push = createPush(deps, env);
  const tap = (data: unknown) => respond?.({ notification: { request: { content: { data } } } });

  return { push, calls, opened, s, tap, errors };
}

describe('토큰 등록', () => {
  it('로그인·권한이 있으면 **기기 토큰**과 플랫폼을 서버에 올린다(Expo 토큰이 아니다)', async () => {
    const { push, calls } = setup();
    await push.register();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.j-curve.co.kr/v1/kkokkofarm/push/register');
    expect(calls[0].body).toEqual({ token: 'fcmTok:APA91b-device_token_0123456789', platform: 'android' });
    expect(calls[0].headers['X-App-Token']).toBe('APPTOKEN');
    expect(calls[0].headers.Authorization).toBe('Bearer ' + SESSION);
  });

  it('아이폰은 APNs 토큰을 ios 로 올린다 — 서버가 플랫폼으로 APNs 로 가른다', async () => {
    const { push, calls } = setup({ platform: 'ios', token: 'a'.repeat(64) });
    await push.register();
    expect(calls[0].body).toEqual({ token: 'a'.repeat(64), platform: 'ios' });
  });

  it('안드로이드·아이폰이 아니면(웹 미리보기) 올리지 않는다', async () => {
    const { push, calls } = setup({ platform: 'web' });
    await push.register();
    expect(calls).toHaveLength(0);
  });

  it('같은 토큰은 이번 실행에서 다시 올리지 않는다', async () => {
    const { push, calls } = setup();
    await push.register();
    await push.register();
    expect(calls).toHaveLength(1);
  });

  it('로그인 전(세션 없음)이면 아무것도 보내지 않는다', async () => {
    const { push, calls } = setup({ session: null });
    await push.register();
    expect(calls).toHaveLength(0);
  });

  it('계정이 동의하지 않았으면 올리지 않는다 — 기기 권한이 있어도', async () => {
    const { push, calls } = setup({ consent: false });
    await push.register();
    expect(calls).toHaveLength(0);
  });

  it('기기 권한이 없으면 올리지 않는다(권한 요청도 하지 않는다)', async () => {
    const { push, calls } = setup({ granted: false });
    await push.register();
    expect(calls).toHaveLength(0);
  });

  it('알림 모듈이 없는 빌드에서도 던지지 않는다', async () => {
    const { push, calls } = setup({ noModule: true });
    await expect(push.register()).resolves.toBeUndefined();
    expect(() => push.init()).not.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('기기 토큰을 못 받으면 onError(token) — 권한을 켰는데 안 오는 이유가 남는다(1.2)', async () => {
    const { push, calls, errors } = setup({ tokenError: 'no FCM sender' });
    await push.register();
    expect(calls).toHaveLength(0);
    expect(errors).toEqual([{ stage: 'token', message: 'no FCM sender' }]);
  });

  it('서버가 5xx 면 onError(register) 이고, **다음 register() 에 다시 올린다**(1.2 — 전에는 이번 실행 내내 안 올렸다)', async () => {
    let status = 503;
    const { push, calls, errors } = setup({ reply: () => ({ ok: status < 400, status }) });
    await push.register();
    expect(errors).toEqual([{ stage: 'register', message: 'http_503' }]);
    status = 200;
    await push.register();
    expect(calls).toHaveLength(2);
    await push.register();
    expect(calls).toHaveLength(2);   // 올라간 뒤에는 같은 토큰을 다시 안 올린다
  });

  it('통신이 끊겨도 던지지 않고 onError(register)', async () => {
    const { push, errors } = setup({ reply: () => { throw new Error('Network request failed'); } });
    await expect(push.register()).resolves.toBeUndefined();
    expect(errors).toEqual([{ stage: 'register', message: 'Network request failed' }]);
  });

  it('권한이 없거나 모듈이 없는 것은 오류가 아니다 — onError 를 부르지 않는다', async () => {
    const a = setup({ granted: false });
    await a.push.register();
    const b = setup({ noModule: true });
    await b.push.register();
    expect([...a.errors, ...b.errors]).toEqual([]);
  });

  it('끄면 서버에 알리고, 다시 동의하면 같은 토큰도 다시 올린다', async () => {
    const { push, calls } = setup();
    await push.register();
    await push.unregister();
    await push.register();
    expect(calls.map((c) => c.url.split('/push/')[1])).toEqual(['register', 'unregister', 'register']);
  });
});

describe('알림을 눌렀을 때', () => {
  it('열람을 보고하고 링크를 연다', async () => {
    const { push, calls, opened, tap } = setup();
    push.init();
    tap({ campaignId: 42, url: 'https://example.com/e' });
    await Promise.resolve();
    expect(calls[0].url.endsWith('/push/open')).toBe(true);
    expect(calls[0].body).toEqual({ campaign_id: 42 });
    expect(opened).toEqual(['https://example.com/e']);
  });

  it('**로그인 복원 전이면 들고 있다가** 세션이 생기면 보낸다 — 버리면 열람이 영영 0', async () => {
    const { push, calls, s, tap } = setup({ session: null });
    push.init();
    tap({ campaignId: '7' });
    expect(calls).toHaveLength(0);
    s.session = SESSION;
    push.flushOpen();
    await Promise.resolve();
    expect(calls[0].body).toEqual({ campaign_id: 7 });
    push.flushOpen();
    expect(calls, '한 번만').toHaveLength(1);
  });

  it('알림으로 앱이 켜진 경우(콜드 스타트)도 처리한다', async () => {
    const { push, calls } = setup({ lastResponse: { notification: { request: { content: { data: { campaignId: 9 } } } } } });
    push.init();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls[0]?.body).toEqual({ campaign_id: 9 });
  });

  it('캠페인이 아닌 알림(로컬 알림 등)은 보고하지 않는다', async () => {
    const { push, calls, opened, tap } = setup();
    push.init();
    tap({});
    tap(null);
    expect(calls).toHaveLength(0);
    expect(opened).toHaveLength(0);
  });
});

describe('Metro 가 빌드 때 찾을 수 있게', () => {
  it('require 안의 이름은 글자 그대로다 — 변수로 주면 실행 때 던지고, 모듈이 늘 없는 것처럼 돈다(1.1.0)', () => {
    for (const f of ['push.ts', 'notify.ts']) {
      // 주석은 빼고 본다 — 설명에 적은 `require(name)` 같은 글자까지 잡지 않게
      const src = readFileSync(new URL('./' + f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const calls = [...src.matchAll(/require\(\s*([^)]*)\)/g)].map((m) => m[1].trim());
      expect(calls.length, f + ' 에 require 가 있어야 검사가 의미 있다').toBeGreaterThan(0);
      for (const c of calls) expect(c, f).toMatch(/^['"][^'"]+['"]$/);
    }
  });
});
