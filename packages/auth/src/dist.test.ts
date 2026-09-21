/**
 * **커밋된 `dist/` 가 소스와 같은지** 확인한다.
 *
 * 이 패키지는 git 으로 설치된다(`npm i github:jxamen/jc-auth`). 그래서 `dist/` 를 저장소에
 * 함께 커밋해 두고 **설치할 때 빌드하지 않는다** — `prepare` 로 `tsc` 를 돌리게 두었더니
 * 깨끗한 `npm ci` 에서 실패했다(2026-09-18 앱빌드 세션 제보). 받는 쪽 기계에
 * `@types/node` 가 없어 `Cannot find name 'require'` 로 죽었는데, 만든 기계에서는 상위
 * 폴더의 타입이 잡혀 **여기서만 통과**했다.
 *
 * 빌드를 없앴으니 이제 **소스만 고치고 `dist/` 를 안 만들면** 세 앱이 옛 코드를 받는다.
 * 그게 더 무섭다 — 고쳤다고 믿는데 안 고쳐져 있고, 아무 오류도 안 난다.
 * 그래서 `npm test` 가 그걸 잡는다.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const OUT = mkdtempSync(join(tmpdir(), 'jcauth-'));

afterAll(() => { rmSync(OUT, { recursive: true, force: true }); });

describe('커밋된 dist 가 소스와 같다', () => {
  it('지금 빌드한 것과 글자까지 같다', () => {
    execFileSync('npx', ['tsc', '-p', 'tsconfig.json', '--outDir', OUT], {
      cwd: ROOT,
      shell: process.platform === 'win32',
      stdio: 'pipe',
    });

    const fresh = readdirSync(OUT).sort();
    const kept = readdirSync(join(ROOT, 'dist')).sort();
    expect(kept, '파일 목록이 다르다 — `npm run build` 를 돌려 커밋하라').toEqual(fresh);

    for (const f of fresh) {
      const a = readFileSync(join(OUT, f), 'utf8');
      const b = readFileSync(join(ROOT, 'dist', f), 'utf8');
      // 줄바꿈은 기계마다 다르다(윈도우 CRLF) — 내용만 본다
      expect(b.replace(/\r\n/g, '\n'), f + ' 가 낡았다 — `npm run build` 를 돌려 커밋하라')
        .toBe(a.replace(/\r\n/g, '\n'));
    }
  }, 60_000);
});
