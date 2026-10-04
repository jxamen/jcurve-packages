/**
 * 2.9 — 로그아웃 · 탈퇴 때 SNS SDK 정리(다시 누르면 계정 선택), 새 가입 구분, 빈 이름 안전, 네이버 돌아오기 플러그인.
 */
import { describe, expect, it } from 'vitest';
import { AuthError, KAKAO_ACCOUNT_HINT, createAuth, isNewMember, memberLabel, type AuthEnv } from './auth';

/* eslint-disable @typescript-eslint/no-explicit-any */

function setup(o: { serverWithdraw?: () => Promise<unknown>; kakaoFail?: boolean } = {}) {
  const calls: string[] = [];
  const naver = { initialize: () => undefined, login: async () => ({}), logout: async () => { calls.push('naver.logout'); }, deleteToken: async () => { calls.push('naver.deleteToken'); } };
  const kakaoUser = { login: async () => ({}), logout: async () => { calls.push('kakao.logout'); if (o.kakaoFail) throw Object.assign(new Error('x'), { code: 'NotLoggedIn' }); },
    unlink: async () => { calls.push('kakao.unlink'); } };
  const google = { GoogleSignin: { configure: () => undefined, signOut: async () => { calls.push('google.signOut'); }, revokeAccess: async () => { calls.push('google.revoke'); } } };
  const env: AuthEnv = {
    os: () => 'ios', kakaoCore: () => ({ initializeKakaoSDK: async () => undefined }), kakaoUser: () => kakaoUser, google: () => google, apple: () => null,
    browser: () => null, linking: () => null, wait: async () => undefined,
  };
  const auth = createAuth<any>({
    keys: { kakaoNative: 'realkey123', googleWeb: 'web.apps.googleusercontent.com', naver: () => ({ consumerKey: 'cid', consumerSecret: 'sec', appName: 'a', serviceUrlScheme: 'jcurveapp' }) },
    naverSdk: () => ({ default: naver }),
    server: { kakao: async () => ({}), google: async () => ({}), apple: async () => ({}),
      logout: async () => { calls.push('server.logout'); throw new Error('net'); }, withdraw: o.serverWithdraw ?? (async () => { calls.push('server.withdraw'); }) },
  }, env);

  return { auth, calls };
}

describe('로그아웃 · 탈퇴 SDK 정리 (2.9)', () => {
  it('로그아웃 — 서버가 실패해도 네이버 · 카카오 · 구글을 다 정리한다', async () => {
    const { auth, calls } = setup();
    expect(await auth.signOut()).toEqual({});
    expect(calls.sort()).toEqual(['google.signOut', 'kakao.logout', 'naver.logout', 'server.logout']);
  });

  it('탈퇴 — 서버가 되면 연결까지 끊는다(네이버 토큰 삭제 · 카카오 unlink · 구글 revoke)', async () => {
    const { auth, calls } = setup();
    const r = await auth.withdraw();
    expect(r.ok).toBe(true);
    expect(calls.sort()).toEqual(['google.revoke', 'google.signOut', 'kakao.unlink', 'naver.deleteToken', 'server.withdraw']);
  });

  it('탈퇴 — 서버가 실패하면 연결은 그대로 두고 이유를 돌려준다', async () => {
    const { auth, calls } = setup({ serverWithdraw: async () => { throw new Error('출금 대기 중인 포인트가 있어요'); } });
    expect(await auth.withdraw()).toEqual({ ok: false, error: '출금 대기 중인 포인트가 있어요' });
    expect(calls).toEqual([]);
  });

  it('SDK 하나가 실패해도 나머지는 정리하고 사유만 돌려준다', async () => {
    const { auth, calls } = setup({ kakaoFail: true });
    expect(await auth.forgetSdks()).toEqual({ kakao: 'NotLoggedIn' });
    expect(calls).toContain('naver.logout');
  });
});

describe('새 가입 · 이름 (2.9)', () => {
  it('isNewMember — 서버 isNew 먼저, 없으면 needsSignup', () => {
    expect(isNewMember({ isNew: false, member: { needsSignup: true } })).toBe(false);
    expect(isNewMember({ member: { needsSignup: true } })).toBe(true);
    expect(isNewMember(null)).toBe(false);
  });

  it('memberLabel — 이름 → 이메일 → 「네이버로 가입」', () => {
    expect(memberLabel({ name: ' 구름 ', email: 'a@b' })).toBe('구름');
    expect(memberLabel({ name: null, email: 'a@b.c' })).toBe('a@b.c');
    expect(memberLabel({ provider: 'naver' })).toBe('네이버로 가입');
    expect(memberLabel(undefined)).toBe('회원');
  });

  it('네이버 돌아오기 플러그인 — open url 맨 앞에, 두 번 넣지 않는다', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { patchNaverReturn } = require('../app.plugin.js');
    const src = 'import Expo\n\nclass AppDelegate {\n  public override func application(\n    _ app: UIApplication,\n    open url: URL,\n    options: [UIApplication.OpenURLOptionsKey: Any] = [:]\n  ) -> Bool {\n    return true\n  }\n}';
    const out = patchNaverReturn(src, 'jcurvefactoo');
    expect(out).toContain('import NaverThirdPartyLogin');
    expect(out).toContain('url.host == "thirdPartyLoginResult" || url.scheme == "jcurvefactoo"');
    expect(patchNaverReturn(out, 'x')).toBe(out);
  });
});

describe('이메일 꼭 받기 (2.9.1)', () => {
  function kakaoEnv(me: any, second: () => Promise<any>) {
    const logins: any[] = [];
    const user = {
      isKakaoTalkLoginAvailable: async () => true,
      login: async (arg?: any) => { logins.push(arg ?? 'talk'); return arg?.scopes ? second() : { accessToken: 'T1' }; },
      me: async () => me,
    };
    const env: AuthEnv = { os: () => 'ios', kakaoCore: () => ({ initializeKakaoSDK: async () => undefined }), kakaoUser: () => user, google: () => null, apple: () => null,
      browser: () => null, linking: () => null, wait: async () => undefined };
    const seen: string[] = [];
    const auth = createAuth<any>({ keys: { kakaoNative: 'realkey123', requireEmail: true },
      server: { kakao: async (t) => { seen.push(t); return { ok: true }; }, google: async () => ({}), apple: async () => ({}) } }, env);

    return { auth, logins, seen };
  }

  it('이메일 동의가 없으면 이메일만 다시 묻고 새 토큰으로', async () => {
    const { auth, logins, seen } = kakaoEnv({ emailNeedsAgreement: true }, async () => ({ accessToken: 'T2' }));
    await auth.signIn('kakao');
    expect(logins).toEqual(['talk', { useKakaoAccountLogin: true, scopes: ['account_email'] }]);
    expect(seen).toEqual(['T2']);
  });

  it('거절하면 처음 토큰으로 그대로 로그인', async () => {
    const { auth, seen } = kakaoEnv({ emailNeedsAgreement: true }, async () => { throw Object.assign(new Error('user cancelled'), { code: 'Cancelled' }); });
    await auth.signIn('kakao');
    expect(seen).toEqual(['T1']);
  });

  it('이미 동의했으면 묻지 않는다', async () => {
    const { auth, logins } = kakaoEnv({ emailNeedsAgreement: false }, async () => ({ accessToken: 'T2' }));
    await auth.signIn('kakao');
    expect(logins).toEqual(['talk']);
  });
});

describe('네이버 정리는 초기화 뒤에만 (2.9.2)', () => {
  function env2(withKeys: boolean) {
    const calls: string[] = [];
    const naver = { initialize: () => { calls.push('naver.init'); }, login: async () => ({}), logout: async () => { calls.push('naver.logout'); } };
    const env: AuthEnv = { os: () => 'android', kakaoCore: () => null, kakaoUser: () => null, google: () => null, apple: () => null, browser: () => null, linking: () => null, wait: async () => undefined };
    const auth = createAuth<any>({ keys: withKeys ? { naver: () => ({ consumerKey: 'cid', consumerSecret: 'sec', appName: 'a' }) } : {},
      naverSdk: () => ({ default: naver }), server: { kakao: async () => ({}), google: async () => ({}), apple: async () => ({}) } }, env);

    return { auth, calls };
  }

  it('이번 실행에서 초기화 안 했으면 키로 초기화한 뒤 logout', async () => {
    const { auth, calls } = env2(true);
    await auth.signOut();
    expect(calls).toEqual(['naver.init', 'naver.logout']);
  });

  it('키가 없으면 네이버는 건너뛴다(초기화 전 logout 은 안드로이드에서 앱이 죽는다)', async () => {
    const { auth, calls } = env2(false);
    expect(await auth.signOut()).toEqual({});
    expect(calls).toEqual([]);
  });
});

describe('카카오 · 구글 정리도 SDK 를 켠 뒤에만 (2.9.3)', () => {
  it('카카오 키가 없으면 카카오는 건너뛰고, 있으면 초기화 뒤 logout · 구글은 configure 뒤 signOut', async () => {
    const calls: string[] = [];
    const kakaoUser = { login: async () => ({}), logout: async () => { calls.push('kakao.logout'); } };
    const google = { GoogleSignin: { configure: () => { calls.push('google.configure'); }, signOut: async () => { calls.push('google.signOut'); } } };
    const mk = (kakaoNative: string | undefined, googleWeb: string | undefined) => {
      calls.length = 0;
      const env: AuthEnv = { os: () => 'android', kakaoCore: () => ({ initializeKakaoSDK: async () => { calls.push('kakao.init'); } }), kakaoUser: () => kakaoUser,
        google: () => google, apple: () => null, browser: () => null, linking: () => null, wait: async () => undefined };

      return createAuth<any>({ keys: { kakaoNative, googleWeb }, server: { kakao: async () => ({}), google: async () => ({}), apple: async () => ({}) } }, env);
    };
    await mk(undefined, undefined).signOut();
    expect(calls).toEqual([]);
    await mk('realkey123', 'web.apps.googleusercontent.com').signOut();
    expect(calls).toEqual(['kakao.init', 'google.configure', 'kakao.logout', 'google.signOut']);
  });
});

describe('카카오톡 없는 기기의 카카오 계정 로그인 실패 (2.9.4)', () => {
  it('SDK 오류를 그대로 던지지 않고 안내가 붙은 AuthError 로 · 네이티브 글을 기록에 남긴다', async () => {
    const tracked: Array<[string, any]> = [];
    const user = {
      isKakaoTalkLoginAvailable: async () => false,
      login: async () => { throw Object.assign(new Error('presentation anchor not found'), { code: 'ClientFailed' }); },
    };
    const env: AuthEnv = { os: () => 'ios', kakaoCore: () => ({ initializeKakaoSDK: async () => undefined }), kakaoUser: () => user, google: () => null, apple: () => null,
      browser: () => null, linking: () => null, wait: async () => undefined };
    const auth = createAuth<any>({ keys: { kakaoNative: 'realkey123' }, track: (n, p) => { tracked.push([n, p]); },
      server: { kakao: async () => ({}), google: async () => ({}), apple: async () => ({}) } }, env);
    const e = await auth.signIn('kakao').catch((x) => x);
    expect(e).toBeInstanceOf(AuthError);
    expect([e.code, e.tag, e.hint]).toEqual(['failed', 'kakao_account:ClientFailed', KAKAO_ACCOUNT_HINT]);
    const fb = tracked.find(([n, p]) => n === 'login_native_fallback' && String(p?.code).startsWith('sdk_'));
    expect(fb?.[1].detail).toContain('presentation anchor not found');
  });
});
