import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const requirePlugin = createRequire(import.meta.url);
const kotlinPlugin = requirePlugin('../kotlin.plugin.js');
const { planKotlinCompatibility: plan } = kotlinPlugin;
// Verbatim final files from the native verifier's successful 2026-10-13 third Release build.
const ROOT = readFileSync(new URL('./fixtures/native-root-gradle.groovy', import.meta.url), 'utf8');
const PROPS = readFileSync(new URL('./fixtures/native-gradle.properties', import.meta.url), 'utf8');
const COORD = 'org.jetbrains.kotlin:kotlin-gradle-plugin';
const input = (root = ROOT, props = PROPS, sdk = '16.5.0', gma = '25.4.0') => ({ rngmaVersion: sdk, gmaVersion: gma, projectBuildGradle: root, gradleProperties: props });
const baseRoot = ROOT.replace(`    classpath('${COORD}:2.3.20')\n`, '');
const baseProps = PROPS.replace('android.kotlinVersion=2.3.20', '');
const directories: string[] = [];
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('native compiler compatibility: actual Gradle fixture', () => {
  it('normalizes the proven explicit + unversioned fixture into one root compiler and matching property', () => {
    const next = plan(input());
    expect(next.version).toBe('2.3.20');
    expect(next.projectBuildGradle.match(/org\.jetbrains\.kotlin:kotlin-gradle-plugin/g)).toHaveLength(1);
    expect(next.projectBuildGradle).toContain(`classpath('${COORD}:2.3.20')`);
    expect(next.gradleProperties).toContain('android.kotlinVersion=2.3.20');
    expect(plan(input(next.projectBuildGradle, next.gradleProperties))).toEqual({ ...next, changed: false });
  });
  it('repairs both files when the observed RN template has no property and an unversioned root classpath', () => {
    const next = plan(input(baseRoot, baseProps));
    expect(next.version).toBe('2.3.20');
    expect(next.projectBuildGradle).toContain(`classpath('${COORD}:2.3.20')`);
    expect(next.gradleProperties).toMatch(/android\.kotlinVersion=2\.3\.20\n$/);
    expect(next.projectBuildGradle).toContain("classpath('com.android.tools.build:gradle')");
    expect(next.projectBuildGradle).toContain("classpath('com.facebook.react:react-native-gradle-plugin')");
    expect(next.projectBuildGradle).toContain('apply plugin: "expo-root-project"');
    expect(next.gradleProperties).toContain('newArchEnabled=true');
  });
  it.each(['property', 'classpath', 'ext'])('elevates only the reproduced 2.1.20 default: %s', (where) => {
    const root = where === 'classpath' ? baseRoot.replace(COORD, `${COORD}:2.1.20`)
      : where === 'ext' ? baseRoot.replace('buildscript {', "buildscript {\n  ext { kotlinVersion = '2.1.20' }") : baseRoot;
    const next = plan(input(root, where === 'property' ? 'android.kotlinVersion=2.1.20\n' : baseProps));
    expect(next.gradleProperties).toContain('android.kotlinVersion=2.3.20');
    expect(next.projectBuildGradle).toContain(`${COORD}:2.3.20`);
    if (where === 'ext') expect(next.projectBuildGradle).toContain("kotlinVersion = '2.3.20'");
  });
  it.each(['2.3.21', '2.4.20', '2.10.0', '3.0.0'])('preserves a higher stable property and aligns the root: %s', (version) => {
    const next = plan(input(ROOT, `android.kotlinVersion=${version}\n`));
    expect(next.version).toBe(version);
    expect(next.projectBuildGradle).toContain(`${COORD}:${version}`);
    expect(next.gradleProperties).toBe(`android.kotlinVersion=${version}\n`);
  });
  it('preserves the highest root/extension version instead of downgrading it to a lower property', () => {
    const root = ROOT.replace(':2.3.20', ':2.4.20').replace('buildscript {', 'buildscript {\n  ext { kotlinVersion = "2.4.21" }');
    const next = plan(input(root));
    expect(next.version).toBe('2.4.21');
    expect(next.projectBuildGradle).toContain(`${COORD}:2.4.21`);
    expect(next.projectBuildGradle).toContain('kotlinVersion = "2.4.21"');
    expect(next.gradleProperties).toContain('android.kotlinVersion=2.4.21');
  });
  it('normalizes duplicate properties/dependencies with different valid versions and leaves unrelated lines intact', () => {
    const root = ROOT.replace(`classpath('${COORD}')`, `classpath "${COORD}:2.4.0"\n    classpath('com.example:keep:1.0')`);
    const next = plan(input(root, '# keep\nandroid.kotlinVersion:2.3.20\nandroid.kotlinVersion=2.4.21\nother=true\n'));
    expect(next.gradleProperties).toBe('# keep\nandroid.kotlinVersion=2.4.21\nother=true\n');
    expect(next.projectBuildGradle.match(/org\.jetbrains\.kotlin:kotlin-gradle-plugin/g)).toHaveLength(1);
    expect(next.projectBuildGradle).toContain("classpath('com.example:keep:1.0')");
    expect(plan(input(next.projectBuildGradle, next.gradleProperties)).changed).toBe(false);
  });
  it('preserves Kotlin component dependencies whose artifact is not the compiler plugin', () => {
    const root = ROOT.replace("classpath('com.android.tools.build:gradle')", `classpath('com.android.tools.build:gradle')\n    classpath('${COORD}-api:2.4.20')`);
    const next = plan(input(root));
    expect(next.projectBuildGradle).toContain(`classpath('${COORD}-api:2.4.20')`);
    expect(next.version).toBe('2.3.20');
  });
  it('inserts a missing KGP only into root buildscript.dependencies, ignoring commented braces/other blocks', () => {
    const root = baseRoot.replace(`    classpath('${COORD}')\n`, '').replace('buildscript {', '// fake buildscript { dependencies { } }\nbuildscript {') + '\ndependencies { implementation "com.example:keep:1" }\n';
    const next = plan(input(root, 'other=true'));
    expect(next.projectBuildGradle).toContain(`dependencies {\n    classpath('${COORD}:2.3.20')`);
    expect(next.projectBuildGradle).toContain('dependencies { implementation "com.example:keep:1" }');
    expect(next.gradleProperties).toBe('other=true\nandroid.kotlinVersion=2.3.20\n');
  });
  it('preserves CRLF files and comment text when removing duplicate compiler statements', () => {
    const root = ROOT.replace(`classpath('${COORD}')`, `classpath('${COORD}') // user comment`).replace(/\n/g, '\r\n');
    const next = plan(input(root, '# keep\r\nandroid.kotlinVersion=2.3.20\r\n'));
    expect(next.projectBuildGradle).toContain('// user comment\r\n');
    expect(next.projectBuildGradle.replace(/\r\n/g, '')).not.toContain('\n');
    expect(next.gradleProperties).toBe('# keep\r\nandroid.kotlinVersion=2.3.20\r\n');
  });
  it.each(['16.3.4', '16.5.1', '17.0.0', '', undefined])('does not infer a requirement for any other RNGMA: %s', (version) => {
    expect(plan({ ...input('unknown DSL', 'android.kotlinVersion=2.3.20-beta'), rngmaVersion: version })).toMatchObject({ changed: false, version: null, projectBuildGradle: 'unknown DSL' });
  });
  it.each(['25.0.0', '25.4.1', '26.0.0', undefined])('does not infer a requirement for another GMA: %s', (gmaVersion) => {
    expect(plan({ ...input('unknown DSL'), gmaVersion })).toMatchObject({ changed: false, version: null, projectBuildGradle: 'unknown DSL' });
  });
  it.each(['2.2.20', '2.3.0', '2.3.10', '2.4.0-Beta1', '2.3.20-RC', 'latest.release', '$kotlinVersion', '2.3.+', '2.03.20'])('rejects an unproven/unknown property without a partial plan: %s', (version) => {
    expect(() => plan(input(ROOT, `android.kotlinVersion=${version}\n`))).toThrow(/not changed/);
  });
  it.each(['other=value\\\nandroid.kotlinVersion=2.4.0\n', 'android.\\u006botlinVersion=2.4.0\n'])('rejects escaped/continued property keys rather than misreading a higher compiler', (props) => {
    expect(() => plan(input(ROOT, props))).toThrow(/not changed/);
  });
  it.each(['2.2.20', '2.4.0-Beta1', '${kotlinVersion}', '2.3.+'])('rejects an unknown root compiler instead of overriding it: %s', (version) => {
    expect(() => plan(input(ROOT.replace(':2.3.20', `:${version}`)))).toThrow(/not changed/);
  });
  it.each([
    "buildscript { dependencies { classpath(libs.kotlin.gradle.plugin) } }",
    `buildscript { dependencies { classpath group: 'org.jetbrains.kotlin', name: 'kotlin-gradle-plugin', version: '2.4.0' } }`,
    `buildscript { dependencies { classpath('${COORD}:2.4.0') { exclude group: 'com.example' } } }`,
    'buildscript { ext { kotlinVersion = findProperty("android.kotlinVersion") } dependencies { } }',
    'buildscript { ext.set("kotlinVersion", "2.4.0") dependencies { } }',
    `plugins { id 'org.jetbrains.kotlin.android' version '2.4.0' apply false }\n${ROOT}`,
    `plugins { alias(libs.plugins.kotlin.android) }\n${ROOT}`,
    `buildscript { dependencies { classpath "${COORD}" } }\nprintln(ext.kotlinVersion)`,
    'buildscript { repositories { google() } }',
    'buildscript { dependencies { } dependencies { } }',
    'buildscript { dependencies { }',
  ])('rejects unsupported Groovy syntax without rewriting unknown compiler configuration', (root) => {
    expect(() => plan(input(root))).toThrow(/not changed/);
  });
});

function staging(sdkVersion = '16.5.0', gmaVersion = '25.4.0') {
  const root = mkdtempSync(join(tmpdir(), 'jcurve-kotlin-')); directories.push(root);
  const android = join(root, 'android'), sdk = join(root, 'node_modules/react-native-google-mobile-ads');
  mkdirSync(android, { recursive: true }); mkdirSync(sdk, { recursive: true });
  writeFileSync(join(sdk, 'package.json'), JSON.stringify({ name: 'react-native-google-mobile-ads', version: sdkVersion, sdkVersions: { android: { googleMobileAds: gmaVersion } } }));
  writeFileSync(join(android, 'gradle.properties'), PROPS); writeFileSync(join(android, 'build.gradle'), ROOT);
  return { root, android, value: { modRequest: { projectRoot: root, platformProjectRoot: android, platform: 'android', introspect: false } } };
}

// Only registration is stubbed here; independent verifier exercises Expo's real mod compiler.
function register(plugin = kotlinPlugin, projectRoot = staging().root, expected = 1) {
  const Module = requirePlugin('node:module'), original = Module._load;
  const hooks: any[] = [];
  Module._load = function (name: string, ...args: any[]) {
    if (name === 'expo/config-plugins') return { withFinalizedMod: (config: any, hook: any) => { hooks.push(hook); return config; }, withProjectBuildGradle: (config: any) => config };
    return original.call(this, name, ...args);
  };
  try { plugin({ _internal: { projectRoot } }, { mediation: false }); } finally { Module._load = original; }
  expect(hooks).toHaveLength(expected);
  if (!expected) return undefined;
  expect(hooks[0][0]).toBe('android'); return hooks[0][1];
}

describe('Android finalized hook: two-file validation and native-only boundary', () => {
  it('unknown SDKs do not require the new finalized API during config registration', () => {
    const old = staging('16.3.4', '25.0.0');
    expect(register(kotlinPlugin, old.root, 0)).toBeUndefined();
  });
  it('writes the matching final pair and is idempotent, including mediation:false', async () => {
    const action = register(requirePlugin('../app.plugin.js')), s = staging();
    await action(s.value);
    const once = readFileSync(join(s.android, 'build.gradle'), 'utf8');
    expect(once.match(/org\.jetbrains\.kotlin:kotlin-gradle-plugin/g)).toHaveLength(1);
    await action(s.value); expect(readFileSync(join(s.android, 'build.gradle'), 'utf8')).toBe(once);
    expect(readFileSync(join(s.android, 'gradle.properties'), 'utf8')).toContain('android.kotlinVersion=2.3.20');
  });
  it('reads final generated higher properties rather than an earlier app config snapshot', async () => {
    const action = register(), s = staging();
    writeFileSync(join(s.android, 'gradle.properties'), 'android.kotlinVersion=2.4.21\n');
    await action(s.value); expect(readFileSync(join(s.android, 'build.gradle'), 'utf8')).toContain(`${COORD}:2.4.21`);
  });
  it('unknown root/property fails before either native file changes', async () => {
    for (const target of ['root', 'property']) {
      const s = staging(), action = register();
      if (target === 'root') writeFileSync(join(s.android, 'build.gradle'), ROOT.replace(':2.3.20', ':2.4.0-Beta1'));
      else writeFileSync(join(s.android, 'gradle.properties'), 'android.kotlinVersion=2.2.20\n');
      const before = ['build.gradle', 'gradle.properties'].map((file) => readFileSync(join(s.android, file), 'utf8'));
      await expect(action(s.value)).rejects.toThrow(/not changed/);
      expect(['build.gradle', 'gradle.properties'].map((file) => readFileSync(join(s.android, file), 'utf8'))).toEqual(before);
    }
  });
  it('introspection, SDK absence and an unknown SDK do not read or write native files', async () => {
    const action = register(), s = staging();
    rmSync(s.android, { recursive: true });
    await expect(action({ ...s.value, modRequest: { ...s.value.modRequest, introspect: true } })).resolves.toBeDefined();
    const unknown = staging('16.3.4', '25.0.0'); rmSync(unknown.android, { recursive: true });
    await expect(action(unknown.value)).resolves.toBeDefined();
    const absent = staging(); rmSync(join(absent.root, 'node_modules'), { recursive: true }); rmSync(absent.android, { recursive: true });
    await expect(action(absent.value)).resolves.toBeDefined();
  });
});
