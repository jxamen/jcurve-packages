/**
 * 2.9 — 로그아웃 · 탈퇴 때 SNS SDK 정리(다시 누르면 계정 선택), 새 가입 구분, 빈 이름 안전, 네이버 돌아오기 플러그인.
 */
import { describe, expect, it } from 'vitest';
import { createAuth, isNewMember, memberLabel, type AuthEnv } from './auth';

/* eslint-disable @typescript-eslint/no-explicit-any */

function setup(o: { serverWithdraw?: () => Promise<unknown>; kakaoFail?: boolean } = {}) {
  const calls: string[] = [];
  const naver = { initialize: () => undefined, login: async () => ({}), logout: async () => { calls.push('naver.logout'); }, deleteToken: async () => { calls.push('naver.deleteToken'); } };
  const kakaoUser = { login: async () => ({}), logout: async () => { calls.push('kakao.logout'); if (o.kakaoFail) throw Object.assign(new Error('x'), { code: 'NotLoggedIn' }); },
    unlink: async () => { calls.push('kakao.unlink'); } };
  const google = { GoogleSignin: { signOut: async () => { calls.push('google.signOut'); }, revokeAccess: async () => { calls.push('google.revoke'); } } };
  const env: AuthEnv = {
    os: () => 'ios', kakaoCore: () => ({ initializeKakaoSDK: async () => undefined }), kakaoUser: () => kakaoUser, google: () => google, apple: () => null,
    browser: () => null, linking: () => null, wait: async () => undefined,
  };
  const auth = createAuth<any>({
    keys: { kakaoNative: 'realkey123', googleWeb: 'web.apps.googleusercontent.com' },
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
