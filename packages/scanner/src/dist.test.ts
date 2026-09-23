/**
 * **커밋된 `dist/` 가 소스와 같은지** 확인한다.
 *
 * 이 패키지는 설치할 때 빌드하지 않는다 — `dist/` 를 함께 두고 그대로 받는다. `@jcurve/auth` 가
 * `prepare` 로 `tsc` 를 돌리게 두었다가 깨끗한 `npm ci` 에서 죽은 뒤로 굳힌 방식이다.
 *
 * 그러면 **소스만 고치고 `dist/` 를 안 만드는 것**이 가장 무섭다. 앱들은 옛 코드를 받고,
 * 고쳤다고 믿는데 안 고쳐져 있고, 아무 오류도 안 난다. 여기서 잡는다.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const OUT = mkdtempSync(join(tmpdir(), 'jcscan-'));

afterAll(() => { rmSync(OUT, { recursive: true, force: true }); });

describe('커밋된 dist 가 소스와 같다', () => {
  it('지금 빌드한 것과 글자까지 같다', () => {
    execFileSync('npx', ['tsc', '-p', 'tsconfig.json', '--outDir', OUT], {
      cwd: ROOT,
      shell: process.platform === 'win32',
      stdio: 'pipe',
    });
    const built = readdirSync(OUT).sort();
    const committed = readdirSync(join(ROOT, 'dist')).sort();
    expect(committed).toEqual(built);
    // 줄바꿈은 기계마다 다를 수 있다(윈도우 CRLF). 글자만 비교한다
    const flat = (s: string) => s.replace(/\r\n/g, '\n');
    for (const file of built) {
      expect(flat(readFileSync(join(ROOT, 'dist', file), 'utf8')), file)
        .toBe(flat(readFileSync(join(OUT, file), 'utf8')));
    }
  });
});
