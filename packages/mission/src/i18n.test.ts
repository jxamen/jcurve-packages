import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stateCopy, type StateKind } from './copy';
import { t } from './i18n';
import en from './i18n/locales/en';

const KINDS: StateKind[] = ['error', 'maintenance', 'maintenanceDaily', 'session', 'soldOut', 'off', 'notReady'];

describe('언어(0.2.1) — lang 없음 · ko 는 원문, en 은 영어', () => {
  it('상태 화면 문구: lang 없음 = ko = 원문(바이트까지 같다)', () => {
    expect(stateCopy('error')).toEqual({ title: '불러오지 못했어요', body: '네트워크를 확인하고 다시 시도해 주세요.', button: '다시 시도' });
    for (const k of KINDS) expect(stateCopy(k, 'ko')).toEqual(stateCopy(k));
  });

  it('상태 화면 문구: en 이면 모두 영어(한글이 남지 않는다)', () => {
    expect(stateCopy('soldOut', 'en')).toEqual({ title: 'Campaign Closed', body: 'Thanks to everyone who joined, this campaign has closed.', button: 'See Other Missions' });
    for (const k of KINDS) expect(JSON.stringify(stateCopy(k, 'en'))).not.toMatch(/[가-힣]/);
    expect(Object.keys(stateCopy('maintenance', 'en'))).toEqual(Object.keys(stateCopy('maintenance')));
  });

  it('머리글 · 기본 제목', () => {
    expect(t('일주일 쇼핑 미션')).toBe('일주일 쇼핑 미션');
    expect(t('일주일 쇼핑 미션', 'en')).toBe('Weekly Shopping Mission');
    expect(t('뒤로가기', 'en-US')).toBe('Back');
    expect(t('뒤로가기', 'ja')).toBe('뒤로가기');
  });

  it('코드의 t() 원문은 모두 영어 표에 있다', () => {
    const keys = new Set<string>();
    for (const f of readdirSync(__dirname).filter((n) => /\.tsx?$/.test(n) && !n.includes('.test.'))) {
      const src = readFileSync(join(__dirname, f), 'utf8');
      for (const m of src.matchAll(/\bt[f]?\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]!.replace(/\\'/g, "'"));
    }
    expect(keys.size).toBeGreaterThanOrEqual(6);
    for (const k of keys) expect(en[k], k).toBeTypeOf('string');
  });
});
