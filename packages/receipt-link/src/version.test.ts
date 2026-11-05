import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PKG_NAME, PKG_VERSION } from './version';

describe('version', () => {
  it('package.json 의 version · name 과 같다', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { name: string; version: string };
    expect(PKG_VERSION).toBe(pkg.version);
    expect('@jcurve/' + PKG_NAME).toBe(pkg.name);
    expect(PKG_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
