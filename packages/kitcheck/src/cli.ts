#!/usr/bin/env node
/**
 * jcurve-kitcheck [저장소 경로] [--json] [--warn]
 *   exit 0 모두 최신 · 1 옛 판 있음(--warn 이면 0) · 2 최신 판 표를 못 읽음
 */
import { check, format } from './check';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const warn = args.includes('--warn');
  const root = args.find((a) => !a.startsWith('--')) ?? process.cwd();
  try {
    const rep = await check(root);
    process.stdout.write((json ? JSON.stringify(rep, null, 2) : format(rep)) + '\n');
    return rep.old > 0 && !warn ? 1 : 0;
  } catch (e) {
    process.stderr.write('jcurve-kitcheck: 최신 판 표를 못 읽었습니다 — ' + (e instanceof Error ? e.message : String(e)) + '\n');
    return 2;
  }
}

main().then((code) => { process.exitCode = code; });
