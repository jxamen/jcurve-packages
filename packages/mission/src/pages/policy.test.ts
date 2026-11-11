import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// 0.4.0 페이지는 걸음 · 광고 · 네이티브 모듈을 가져오지 않는다(옛 빌드 충돌 방지 · 앱이 광고 소유)
const FORBIDDEN = [/^@jcurve\/steps/, /^@jcurve\/ads/, /^@jcurve\/overlay/, /^expo-/, /^react-native-svg$/, /^react-native-webview$/];

describe('페이지 파일은 새 네이티브 · 광고 · 걸음 모듈을 가져오지 않는다', () => {
  const files = readdirSync(__dirname).filter(n => /\.tsx?$/.test(n) && !n.includes('.test.'));
  it('pages 폴더에 파일이 있다', () => expect(files.length).toBeGreaterThanOrEqual(7));
  for (const f of files) {
    it(f, () => {
      const src = readFileSync(join(__dirname, f), 'utf8');
      // 주석 글이 아니라 가져오는 모듈 이름만 본다
      const modules = [...src.matchAll(/from\s+'([^']+)'/g)].map(m => m[1]!);
      for (const re of FORBIDDEN) expect(modules.filter(m => re.test(m)), re.source).toEqual([]);
    });
  }
});

// 0.4.1 — 화면 글자에 앱 이름 · 앱 말(당근 등)이 박히면 다른 앱에 그대로 보인다(앱보조2 10-20 「당근 뽑기」). 주석은 빼고 본다
describe('페이지 화면 글자에 앱 말이 박혀 있지 않다', () => {
  const files = readdirSync(__dirname).filter(n => /\.tsx?$/.test(n) && !n.includes('.test.'));
  for (const f of files) {
    it(f, () => {
      const code = readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
      for (const word of ['당근', '캐시팡팡', '머니트리', '에그머니', '영테크', '양분']) expect(code.includes(word), word).toBe(false);
    });
  }
});
