/**
 * @jcurve/kitcheck — 공용 패키지(@jcurve/*) 판 점검.
 * 2026-11-05 대표님 「저장소가 달라도 패키지 최신 버전 점검하는 건 기능을 설치하면 되는 거 아냐」 — 우리 저장소든 외부(사임캐시) 저장소든
 * `npx jcurve-kitcheck` 한 줄로: package.json 의 @jcurve/* 의존성마다 깔린 판(node_modules, 없으면 주소 속 판)과 최신 릴리스를 견준다.
 * 최신 판 표는 jcurve-api `GET /v1/packages/latest`(공개) 에서, 안 되면 GitHub 릴리스 목록(jxamen/jcurve-packages 공개)에서 읽는다.
 * 비밀 값 없음 · 네트워크는 읽기만.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LATEST_URL = 'https://api.j-curve.co.kr/v1/packages/latest';
export const GITHUB_RELEASES = 'https://api.github.com/repos/jxamen/jcurve-packages/releases?per_page=100';

export type Dep = { name: string; spec: string; installed: string | null };
export type Row = Dep & { latest: string | null; state: 'ok' | 'old' | 'unknown' | 'ahead' };
export type Report = { rows: Row[]; old: number; source: string };

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** 판 문자열 비교 — 숫자 세 자리만 본다(1.1.2 < 1.1.10) */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** 의존성 주소(tgz · 릴리스 태그)에서 판을 읽는다 — node_modules 가 없을 때의 대안 */
export function versionFromSpec(spec: string): string | null {
  const m = /(?:^|[-v/@^~=])(\d+\.\d+\.\d+)(?:\.tgz|$|[^.\d])/.exec(spec);
  return m?.[1] ?? null;
}

/** 저장소의 @jcurve/* 의존성 — dependencies · devDependencies */
export function readDeps(root: string): Dep[] {
  const pj = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const all = { ...(pj.dependencies ?? {}), ...(pj.devDependencies ?? {}) };
  return Object.keys(all)
    .filter((k) => k.startsWith('@jcurve/'))
    .sort()
    .map((name) => {
      const spec = String(all[name] ?? '');
      const file = join(root, 'node_modules', name, 'package.json');
      let installed: string | null = null;
      if (existsSync(file)) {
        try { installed = String((JSON.parse(readFileSync(file, 'utf8')) as { version?: string }).version ?? '') || null; } catch { installed = null; }
      }
      return { name, spec, installed: installed ?? versionFromSpec(spec) };
    });
}

/** 릴리스 태그 `<이름>-v<판>` 목록 → 이름별 최신 판 */
export function latestFromTags(tags: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of tags) {
    const m = /^([a-z][a-z0-9-]*)-v(\d+\.\d+\.\d+)$/.exec(t);
    if (!m || !m[1] || !m[2]) continue;
    const cur = out[m[1]];
    if (!cur || compareVersions(m[2], cur) > 0) out[m[1]] = m[2];
  }
  return out;
}

/** 최신 판 표 — 서버 먼저, 안 되면 GitHub. 둘 다 안 되면 Error */
export async function fetchLatest(fetchFn: Fetch = fetch as unknown as Fetch): Promise<{ latest: Record<string, string>; source: string }> {
  try {
    const r = await fetchFn(LATEST_URL);
    if (r.ok) {
      const j = (await r.json()) as { latest?: Record<string, string> };
      if (j && j.latest && typeof j.latest === 'object' && Object.keys(j.latest).length > 0) return { latest: j.latest, source: 'api.j-curve.co.kr' };
    }
  } catch { /* 아래 GitHub 로 */ }
  const g = await fetchFn(GITHUB_RELEASES);
  if (!g.ok) throw new Error('latest_unavailable:' + g.status);
  const rel = (await g.json()) as Array<{ tag_name?: string; draft?: boolean; prerelease?: boolean }>;
  if (!Array.isArray(rel)) throw new Error('latest_unavailable:shape');
  return { latest: latestFromTags(rel.filter((x) => !x.draft && !x.prerelease).map((x) => String(x.tag_name ?? ''))), source: 'github.com' };
}

export function compare(deps: readonly Dep[], latest: Record<string, string>, source: string): Report {
  const rows: Row[] = deps.map((d) => {
    const short = d.name.replace(/^@jcurve\//, '');
    const l = latest[short] ?? null;
    let state: Row['state'] = 'unknown';
    if (d.installed && l) {
      const c = compareVersions(d.installed, l);
      state = c < 0 ? 'old' : c > 0 ? 'ahead' : 'ok';
    }
    return { ...d, latest: l, state };
  });
  return { rows, old: rows.filter((r) => r.state === 'old').length, source };
}

export async function check(root: string, fetchFn?: Fetch): Promise<Report> {
  const deps = readDeps(root);
  if (deps.length === 0) return { rows: [], old: 0, source: '-' };
  const { latest, source } = await fetchLatest(fetchFn);
  return compare(deps, latest, source);
}

/** 사람이 읽는 표 — 한 줄에 한 패키지 */
export function format(rep: Report): string {
  if (rep.rows.length === 0) return 'jcurve-kitcheck: @jcurve/* 의존성이 없습니다';
  const w = Math.max(...rep.rows.map((r) => r.name.length));
  const lines = rep.rows.map((r) => {
    const mark = r.state === 'old' ? '옛 판 ✗' : r.state === 'ok' ? '최신 ✓' : r.state === 'ahead' ? '최신보다 높음' : '모름';
    return `${r.name.padEnd(w)}  깔린 판 ${(r.installed ?? '없음').padEnd(8)} 최신 ${(r.latest ?? '?').padEnd(8)} ${mark}`;
  });
  const tail = rep.old > 0
    ? `옛 판 ${rep.old}개 — package.json 의 주소를 최신 판으로 바꾸고 npm install 하세요 (https://github.com/jxamen/jcurve-packages/releases)`
    : '모두 최신입니다';
  return [`jcurve-kitcheck (최신 판 표: ${rep.source})`, ...lines, tail].join('\n');
}
