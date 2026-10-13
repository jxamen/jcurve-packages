import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createIdentity, identityMessage } from './identity';
import { normLang, t, tf } from './i18n';
import en from './i18n/locales/en';

const REASONS = ['CANCELED', 'NO_SESSION', 'NETWORK', 'KIAP_DISABLED', 'CONFIG_MISSING', 'ALREADY_VERIFIED', 'SESSION_EXPIRED',
  'RATE_LIMITED', 'DUPLICATE_CI', 'UID_CI_CONFLICT', 'CI_MISSING', 'RESULT_LOST', 'NEED_UPDATE', 'WHATEVER'];

describe('언어(1.0.1) — lang 없음 · ko 는 원문, en 은 영어', () => {
  it('lang 없음 = ko = 원문(바이트까지 같다)', () => {
    expect(identityMessage('CANCELED')).toBe('인증을 취소했어요.');
    expect(identityMessage('WHATEVER')).toBe('본인인증에 실패했어요. 다시 시도해 주세요. (WHATEVER)');
    for (const r of REASONS) {
      expect(identityMessage(r, 'ko')).toBe(identityMessage(r));
      expect(identityMessage(r, undefined)).toBe(identityMessage(r));
    }
  });

  it('en 이면 모든 사유가 영어(한글이 남지 않는다)', () => {
    expect(identityMessage('CANCELED', 'en')).toBe('Verification was canceled.');
    expect(identityMessage('WHATEVER', 'en-US')).toBe('ID verification failed. Please try again. (WHATEVER)');
    for (const r of REASONS) expect(identityMessage(r, 'en')).not.toMatch(/[가-힣]/);
  });

  it('createIdentity({ lang }) 의 message 는 그 언어로, lang 없으면 한국어', () => {
    const deps = { base: 'x', appToken: 'a', token: () => null, ret: 'r://k' };
    expect(createIdentity(deps).message('NETWORK')).toBe('연결이 불안정해요. 잠시 후 다시 시도해 주세요.');
    expect(createIdentity({ ...deps, lang: 'en' }).message('NETWORK')).toBe('Your connection is unstable. Please try again in a moment.');
  });

  it('표에 없는 언어 · 문구는 원문, 기기 값은 앞 글자만 본다', () => {
    expect(t('표에 없는 말', 'en')).toBe('표에 없는 말');
    expect(t('인증을 취소했어요.', 'ja')).toBe('인증을 취소했어요.');
    expect(normLang('EN_us')).toBe('en');
    expect(normLang('')).toBe('ko');
    expect(tf('본인인증에 실패했어요. 다시 시도해 주세요. ({0})', 'ko', 'X')).toBe('본인인증에 실패했어요. 다시 시도해 주세요. (X)');
  });

  it('코드의 t()/tf() 원문은 모두 영어 표에 있다', () => {
    const dir = __dirname;
    const keys = new Set<string>();
    for (const f of readdirSync(dir).filter((n) => /\.tsx?$/.test(n) && !n.includes('.test.'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/\bt[f]?\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]!.replace(/\\'/g, "'"));
    }
    for (const k of keys) expect(en[k], k).toBeTypeOf('string');
  });
});
