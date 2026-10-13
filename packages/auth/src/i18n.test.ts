import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AuthError, KAKAO_ACCOUNT_HINT, createAuth, memberLabel, type AuthEnv } from './auth';
import { t } from './i18n';
import en from './i18n/locales/en';

const PROVIDERS = ['kakao', 'naver', 'google', 'apple', 'toss', 'guest', 'line', undefined];

/** 카카오톡 없는 기기 — 카카오 계정 창이 안 열린다(auth29.test 와 같은 장면) */
const kakaoFail = async (lang?: string) => {
  const user = {
    isKakaoTalkLoginAvailable: async () => false,
    login: async () => { throw Object.assign(new Error('presentation anchor not found'), { code: 'ClientFailed' }); },
  };
  const env: AuthEnv = { os: () => 'ios', kakaoCore: () => ({ initializeKakaoSDK: async () => undefined }), kakaoUser: () => user, google: () => null, apple: () => null,
    browser: () => null, linking: () => null, wait: async () => undefined };
  const auth = createAuth<any>({ keys: { kakaoNative: 'realkey123' }, lang,
    server: { kakao: async () => ({}), google: async () => ({}), apple: async () => ({}) } }, env);

  return auth.signIn('kakao').catch((x) => x as AuthError);
};

describe('언어(2.9.5) — lang 없음 · ko 는 원문, en 은 영어', () => {
  it('memberLabel: lang 없음 = ko = 원문(바이트까지 같다)', () => {
    expect(memberLabel({ provider: 'kakao' })).toBe('카카오로 가입');
    expect(memberLabel({ provider: 'apple' })).toBe('Apple로 가입');
    expect(memberLabel({})).toBe('회원');
    for (const p of PROVIDERS) expect(memberLabel({ provider: p }, 'ko')).toBe(memberLabel({ provider: p }));
  });

  it('memberLabel: en 이면 영어, 이름 · 이메일은 그대로', () => {
    expect(memberLabel({ provider: 'naver' }, 'en')).toBe('Signed up with Naver');
    expect(memberLabel({ provider: 'apple' }, 'en')).toBe('Signed up with Apple');
    expect(memberLabel({}, 'en')).toBe('Member');
    expect(memberLabel({ name: '구름' }, 'en')).toBe('구름');
    for (const p of PROVIDERS) expect(memberLabel({ provider: p }, 'en')).not.toMatch(/[가-힣]/);
  });

  it('카카오 계정 창 안내(hint): lang 없음 · ko 는 원문 상수, en 은 영어', async () => {
    expect((await kakaoFail()).hint).toBe(KAKAO_ACCOUNT_HINT);
    expect((await kakaoFail('ko')).hint).toBe(KAKAO_ACCOUNT_HINT);
    const e = await kakaoFail('en');
    expect(e.tag).toBe('kakao_account:ClientFailed');
    expect(e.hint).toBe('Couldn\'t open the Kakao Account sign-in window. Please install KakaoTalk or sign in another way.');
  });

  it('표에 없는 언어는 원문', () => {
    expect(t('회원', 'ja')).toBe('회원');
  });

  it('코드의 t()/tf() 원문은 모두 영어 표에 있다', () => {
    const keys = new Set<string>(['카카오', '네이버', '구글', '토스', '게스트', KAKAO_ACCOUNT_HINT]);
    for (const f of readdirSync(__dirname).filter((n) => /\.tsx?$/.test(n) && !n.includes('.test.'))) {
      const src = readFileSync(join(__dirname, f), 'utf8');
      for (const m of src.matchAll(/\bt[f]?\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]!.replace(/\\'/g, "'"));
    }
    for (const k of keys) expect(en[k], k).toBeTypeOf('string');
  });
});
