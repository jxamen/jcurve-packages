import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// 훅 파일이 react 를 부르므로 시험에서는 가짜로 — localizeSection 만 본다
vi.mock('react', () => ({ useCallback: (f: unknown) => f, useEffect: () => undefined, useMemo: (f: () => unknown) => f(), useState: (v: unknown) => [v, () => undefined] }));

import { localizeSection } from './hook';
import { t, tf } from './i18n';
import en from './i18n/locales/en';
import { DEFAULT_SECTION } from './load';

describe('언어(1.1.1) — lang 없음 · ko 는 원문, en 은 영어', () => {
  it('lang 없음 · ko 면 어드민 칸 설정을 받은 객체 그대로', () => {
    const sec = { on: true, title: '추천 앱 둘러보기', desc: '포인트 앱 모음' };
    expect(localizeSection(sec)).toBe(sec);
    expect(localizeSection(sec, 'ko')).toBe(sec);
    expect(localizeSection(DEFAULT_SECTION)).toBe(DEFAULT_SECTION);
  });

  it('en 이면 표에 있는 어드민 문구만 영어, 나머지 · null 은 그대로', () => {
    expect(localizeSection({ on: true, title: '추천 앱 둘러보기', desc: '포인트 앱 모음' }, 'en'))
      .toEqual({ on: true, title: 'Explore Featured Apps', desc: '포인트 앱 모음' });
    expect(localizeSection(DEFAULT_SECTION, 'en')).toEqual(DEFAULT_SECTION);
  });

  it('시트 문구 — ko 는 원문(자리표 포함), en 은 영어', () => {
    expect(t('추천 앱')).toBe('추천 앱');
    expect(t('추천 앱', 'en')).toBe('Featured Apps');
    expect(tf('{0}, 받으러 가기', undefined, '꼬꼬농장')).toBe('꼬꼬농장, 받으러 가기');
    expect(tf('{0}, 받으러 가기', 'en', '꼬꼬농장')).toBe('꼬꼬농장, get the app');
  });

  it('코드의 tr()/t()/tf() 원문은 모두 영어 표에 있다', () => {
    const keys = new Set<string>();
    for (const f of readdirSync(__dirname).filter((n) => /\.tsx?$/.test(n) && !n.includes('.test.'))) {
      const src = readFileSync(join(__dirname, f), 'utf8');
      for (const m of src.matchAll(/\b(?:tr|t|tf)\(\s*(?:section\?\.\w+ \?\? )?'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]!.replace(/\\'/g, "'").replace(/\\n/g, '\n'));
    }
    expect(keys.size).toBeGreaterThanOrEqual(10);
    for (const k of keys) expect(en[k], k).toBeTypeOf('string');
  });
});
