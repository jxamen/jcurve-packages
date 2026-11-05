import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GITHUB_RELEASES, LATEST_URL, compare, compareVersions, fetchLatest, format, latestFromTags, readDeps, versionFromSpec } from './check';

const RL = 'https://github.com/jxamen/jcurve-packages/releases/download/receipt-link-v1.1.2/jcurve-receipt-link-1.1.2.tgz';

function repo(installed: Record<string, string>, deps: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'kitcheck-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', dependencies: deps, devDependencies: { typescript: '^5' } }));
  for (const [name, v] of Object.entries(installed)) {
    mkdirSync(join(root, 'node_modules', name), { recursive: true });
    writeFileSync(join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version: v }));
  }
  return root;
}

const fetchOf = (map: Record<string, unknown>) => async (url: string) => {
  const body = map[url];
  return { ok: body !== undefined, status: body !== undefined ? 200 : 404, json: async () => body };
};

describe('kitcheck', () => {
  it('판 비교 — 두 자리 넘는 숫자도 숫자로', () => {
    expect(compareVersions('1.1.2', '1.1.10')).toBe(-1);
    expect(compareVersions('2.10.0', '2.6.3')).toBe(1);
    expect(compareVersions('1.1.3', '1.1.3')).toBe(0);
  });

  it('주소에서 판 읽기', () => {
    expect(versionFromSpec(RL)).toBe('1.1.2');
    expect(versionFromSpec('file:vendor/jcurve-receipt-link-1.1.3.tgz')).toBe('1.1.3');
    expect(versionFromSpec('^1.2.3')).toBe('1.2.3');
    expect(versionFromSpec('workspace:*')).toBeNull();
  });

  it('의존성 — node_modules 판 우선, 없으면 주소 속 판', () => {
    const root = repo({ '@jcurve/receipt-link': '1.1.1' }, { '@jcurve/receipt-link': RL, '@jcurve/updates': 'file:vendor/jcurve-updates-2.6.3.tgz', react: '18' });
    expect(readDeps(root)).toEqual([
      { name: '@jcurve/receipt-link', spec: RL, installed: '1.1.1' },
      { name: '@jcurve/updates', spec: 'file:vendor/jcurve-updates-2.6.3.tgz', installed: '2.6.3' },
    ]);
  });

  it('릴리스 태그 → 최신 판', () => {
    expect(latestFromTags(['receipt-link-v1.1.2', 'receipt-link-v1.1.10', 'updates-v2.6.3', 'junk', 'v1.0.0'])).toEqual({ 'receipt-link': '1.1.10', updates: '2.6.3' });
  });

  it('최신 표 — 서버 먼저, 안 되면 GitHub', async () => {
    const a = await fetchLatest(fetchOf({ [LATEST_URL]: { ok: true, latest: { 'receipt-link': '1.1.3' } } }));
    expect(a).toEqual({ latest: { 'receipt-link': '1.1.3' }, source: 'api.j-curve.co.kr' });
    const b = await fetchLatest(fetchOf({ [GITHUB_RELEASES]: [{ tag_name: 'receipt-link-v1.1.3' }, { tag_name: 'receipt-link-v9.9.9', draft: true }] }));
    expect(b).toEqual({ latest: { 'receipt-link': '1.1.3' }, source: 'github.com' });
    await expect(fetchLatest(fetchOf({}))).rejects.toThrow('latest_unavailable:404');
  });

  it('견주기 · 표 — 옛 판이 있으면 old 가 센다', () => {
    const rep = compare(
      [
        { name: '@jcurve/receipt-link', spec: RL, installed: '1.1.2' },
        { name: '@jcurve/updates', spec: '', installed: '2.6.3' },
        { name: '@jcurve/mystery', spec: '', installed: '1.0.0' },
      ],
      { 'receipt-link': '1.1.3', updates: '2.6.3' },
      'test',
    );
    expect(rep.old).toBe(1);
    expect(rep.rows.map((r) => r.state)).toEqual(['old', 'ok', 'unknown']);
    const text = format(rep);
    expect(text).toContain('@jcurve/receipt-link');
    expect(text).toContain('옛 판 1개');
    expect(format({ rows: [], old: 0, source: '-' })).toContain('없습니다');
  });
});
