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
} = {}) {
  const calls: Array<{ url: string; headers: Record<string, string>; body: any }> = [];
  const opened: string[] = [];
  let respond: ((r: any) => void) | null = null;
  const s = { session: o.session === undefined ? SESSION : o.session, token: o.token ?? 'fcmTok:APA91b-device_token_0123456789' };
  const N = {
    getPermissionsAsync: async () => ({ granted: o.granted ?? true }),
    getDevicePushTokenAsync: async () => ({ type: o.platform ?? 'android', data: s.token }),
    getExpoPushTokenAsync: async () => { throw new Error('Expo 토큰은 쓰지 않는다'); },
    addNotificationResponseReceivedListener: (fn: (r: any) => void) => { respond = fn; },
    getLastNotificationResponseAsync: async () => o.lastResponse ?? null,
  };
  const env: PushEnv = {
    notifications: () => (o.noModule ? null : N),
    platform: () => o.platform ?? 'android',
    fetch: async (url, init) => { calls.push({ url, headers: init.headers, body: JSON.parse(init.body) }); return {}; },
    openUrl: (u) => { opened.push(u); },
  };
  const deps: PushDeps = {
    base: 'https://api.j-curve.co.kr/v1/kkokkofarm/',
    appToken: 'APPTOKEN',
    session: () => s.session,
    consent: o.consent === undefined ? undefined : () => o.consent as boolean,
  };
  const push = createPush(deps, env);
  const tap = (data: unknown) => respond?.({ notification: { request: { content: { data } } } });

  return { push, calls, opened, s, tap };
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
