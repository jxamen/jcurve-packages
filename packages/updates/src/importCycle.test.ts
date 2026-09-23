/**
 * **src 에 import 고리가 0 개다**(2026-09-23, 제출 전 점검표 13).
 *
 * 머니트리 production OTA 네 판이 「지금 적용」 때 앱을 죽였다 — api → rewarded → track → api 고리.
 * 번들러는 고리를 오류로 잡지 않고, 켤 때 한쪽이 아직 undefined 인 채로 불려 죽는다. 여기서 잡는다.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const SRC = __dirname;

it('src 의 상대 import 에 고리가 없다', () => {
  const files = readdirSync(SRC).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const graph = new Map<string, string[]>();
  for (const f of files) {
    const code = readFileSync(join(SRC, f), 'utf8');
    const deps = [...code.matchAll(/(?:from|require\()\s*['"]\.\/([\w-]+)['"]/g)].map((m) => m[1] + '.ts');
    graph.set(f, deps.filter((d) => files.includes(d)));
  }
  const cycles: string[] = [];
  const walk = (f: string, path: string[]) => {
    if (path.includes(f)) { cycles.push([...path.slice(path.indexOf(f)), f].join(' → ')); return; }
    for (const d of graph.get(f) ?? []) walk(d, [...path, f]);
  };
  for (const f of files) walk(f, []);
  expect(cycles).toEqual([]);
});
