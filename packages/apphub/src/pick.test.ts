import { describe, expect, it } from 'vitest';
import { familyRows, tintOf, type FamilyApp } from './pick';

const app = (o: Partial<FamilyApp> & { slug: string; name: string }): FamilyApp => ({
  site: null, ios: null, android: null, ...o,
});

describe('계열 앱 모아보기 — 기기에 맞는 주소 고르기', () => {
  it('아이폰은 App Store, 안드로이드는 Play 주소를 쓴다', () => {
    const items = [app({ slug: 'moneytree', name: '머니트리', ios: 'https://apps.apple.com/x', android: 'https://play.google.com/y' })];

    expect(familyRows(items, 'ios')[0].url).toBe('https://apps.apple.com/x');
    expect(familyRows(items, 'android')[0].url).toBe('https://play.google.com/y');
  });

  it('그 기기 스토어에 없는 앱은 목록에서 뺀다 — 누를 수 없는 줄을 남기지 않는다', () => {
    const items = [app({ slug: 'pig', name: '꿀꿀캐시', ios: 'https://apps.apple.com/z' })];

    expect(familyRows(items, 'ios')).toHaveLength(1);
    expect(familyRows(items, 'android')).toHaveLength(0);
  });

  it('아이콘이 없으면 이름 첫 글자를 쓴다', () => {
    const rows = familyRows([app({ slug: 'eggfarm', name: '꼬꼬농장', android: 'https://play.google.com/a' })], 'android');


    expect(rows[0].icon).toBeNull();
    expect(rows[0].initial).toBe('꼬');
  });

  it('색은 slug 로 고른다 — 같은 앱은 늘 같은 색, 다른 앱은 되도록 다른 색', () => {
    expect(tintOf('carrotcash')).toBe(tintOf('carrotcash'));
    expect(new Set(['carrotcash', 'moneytree', 'moneycapsule', 'pigcash'].map(tintOf)).size).toBeGreaterThan(1);
  });

  it('빈 목록은 빈 목록', () => {
    expect(familyRows([], 'ios')).toEqual([]);
  });
});
