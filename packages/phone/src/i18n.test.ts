import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPhone, message } from './phone';
import { t } from './i18n';
import en from './i18n/locales/en';

const ERRORS = ['phone_taken', 'same_phone', 'signup_required', 'sms_off', 'bad_phone', 'too_soon', 'too_many', 'daily_max',
  'expired', 'not_sent', 'wrong', 'network', 'unknown', 'whatever'];
const EXTRAS = [undefined, { waitMs: 41_200 }, { left: 3 }];

describe('언어(1.2.1) — lang 없음 · ko 는 원문, en 은 영어', () => {
  it('lang 없음 = ko = 원문(바이트까지 같다)', () => {
    expect(message('too_soon', { waitMs: 41_200 })).toBe('잠시 후에 다시 보낼 수 있어요. (42초)');
    expect(message('wrong', { left: 3 })).toBe('인증번호가 맞지 않아요. (3번 남음)');
    expect(message('network')).toBe('잠시 후에 다시 시도해 주세요.');
    for (const e of ERRORS) for (const x of EXTRAS) expect(message(e, x, 'ko')).toBe(message(e, x));
  });

  it('en 이면 모든 오류가 영어(한글이 남지 않는다)', () => {
    expect(message('too_soon', { waitMs: 41_200 }, 'en')).toBe('You can resend in a moment. (42s)');
    expect(message('wrong', { left: 3 }, 'en')).toBe('The code doesn\'t match. (3 tries left)');
    for (const e of ERRORS) for (const x of EXTRAS) expect(message(e, x, 'en')).not.toMatch(/[가-힣]/);
  });

  it('createPhone({ lang }) 의 message 는 그 언어로, lang 없으면 한국어', () => {
    const deps = { base: 'x', headers: () => null };
    expect(createPhone(deps).message('bad_phone')).toBe('휴대폰 번호를 다시 확인해 주세요.');
    expect(createPhone({ ...deps, lang: 'en' }).message('bad_phone')).toBe('Please check your phone number.');
  });

  it('표에 없는 언어는 원문', () => {
    expect(t('휴대폰 번호를 다시 확인해 주세요.', 'ja')).toBe('휴대폰 번호를 다시 확인해 주세요.');
  });

  it('코드의 t()/tf() 원문은 모두 영어 표에 있다', () => {
    const keys = new Set<string>();
    for (const f of readdirSync(__dirname).filter((n) => /\.tsx?$/.test(n) && !n.includes('.test.'))) {
      const src = readFileSync(join(__dirname, f), 'utf8');
      for (const m of src.matchAll(/\bt[f]?\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]!.replace(/\\'/g, "'"));
    }
    expect(keys.size).toBeGreaterThan(10);
    for (const k of keys) expect(en[k], k).toBeTypeOf('string');
  });
});
