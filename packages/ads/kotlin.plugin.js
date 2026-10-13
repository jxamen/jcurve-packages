/** Native-only compatibility for the reproduced RNGMA 16.5.0 / GMA 25.4.0 toolchain. */
const fs = require('fs');
const path = require('path');
const TAG = '@jcurve/ads(Android Kotlin)';
const MODULE = 'org.jetbrains.kotlin:kotlin-gradle-plugin';
const BASE = '2.3.20';

function unsupported(detail) {
  throw new Error(`${TAG}: ${detail}. Kotlin files were not changed; verify a stable compiler >= ${BASE} and align android.kotlinVersion with the root KGP classpath.`);
}

function stableVersion(value) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) unsupported(`Cannot safely compare Kotlin version ${JSON.stringify(value)}`);
  const parts = value.split('.').map(Number);
  if (parts.some((n) => !Number.isSafeInteger(n))) unsupported('Kotlin version is outside the numeric range');
  return parts;
}

function compare(left, right) {
  const a = stableVersion(left), b = stableVersion(right);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}

function chooseVersion(values) {
  let selected = BASE;
  for (const value of values) {
    const order = compare(value, BASE);
    // 2.1.20 is the reproduced RN 0.86.3 default. Other lower versions need their own proof.
    if (order < 0 && value !== '2.1.20') unsupported(`Unverified lower Kotlin version ${value}`);
    if (compare(value, selected) > 0) selected = value;
  }
  return selected;
}

/** Small Groovy lexer: braces inside strings/comments must never select another dependencies block. */
function lex(contents) {
  const tokens = [], stack = [], pairs = new Map();
  let depth = 0;
  for (let i = 0; i < contents.length;) {
    const ch = contents[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (contents.startsWith('//', i)) { const end = contents.indexOf('\n', i); i = end < 0 ? contents.length : end; continue; }
    if (contents.startsWith('/*', i)) {
      const end = contents.indexOf('*/', i + 2);
      if (end < 0) unsupported('Unterminated Gradle comment');
      i = end + 2; continue;
    }
    const start = i;
    let kind = 'symbol', value = ch;
    if (ch === '"' || ch === "'") {
      kind = 'string';
      const quote = contents.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch;
      i += quote.length;
      const valueStart = i;
      while (i < contents.length && !contents.startsWith(quote, i)) {
        if (contents[i] === '\\') i++;
        i++;
      }
      if (i >= contents.length) unsupported('Unterminated Gradle string');
      value = contents.slice(valueStart, i); i += quote.length;
    } else if (/[A-Za-z_$]/.test(ch)) {
      kind = 'identifier'; i++;
      while (i < contents.length && /[\w$]/.test(contents[i])) i++;
      value = contents.slice(start, i);
    } else i++;
    if (value === '}' && kind === 'symbol') depth--;
    const index = tokens.length;
    tokens.push({ kind, value, start, end: i, depth });
    if (kind === 'symbol' && '{(['.includes(value)) stack.push(index);
    if (kind === 'symbol' && '})]'.includes(value)) {
      const open = stack.pop();
      if (open === undefined || '{(['['})]'.indexOf(value)] !== tokens[open].value) unsupported('Unbalanced Gradle delimiters');
      pairs.set(open, index);
    }
    if (value === '{' && kind === 'symbol') depth++;
  }
  if (stack.length) unsupported('Unbalanced Gradle delimiters');
  return { tokens, pairs };
}

function gradleInfo(contents) {
  const { tokens, pairs } = lex(contents);
  const builds = tokens.map((t, i) => t.kind === 'identifier' && t.value === 'buildscript' && t.depth === 0 && tokens[i + 1]?.value === '{' ? i + 1 : -1).filter((i) => i >= 0);
  if (builds.length !== 1) unsupported('Expected one Groovy buildscript block');
  const start = builds[0], end = pairs.get(start);
  const blocks = [];
  for (let i = start + 1; i < end; i++) if (tokens[i].value === 'dependencies' && tokens[i].kind === 'identifier' && tokens[i].depth === 1 && tokens[i + 1]?.value === '{') blocks.push(i + 1);
  if (blocks.length !== 1) unsupported('Expected one buildscript.dependencies block');
  const opening = blocks[0], closing = pairs.get(opening);
  const dependencies = [], recognized = new Set(), assignments = [];
  for (let i = opening + 1; i < closing; i++) {
    const t = tokens[i];
    if (t.kind !== 'identifier' || t.value !== 'classpath' || t.depth !== 2) continue;
    let item = i + 1, last = item;
    if (tokens[item]?.value === '(') {
      last = pairs.get(item); item++;
      if (last !== item + 1) unsupported('Non-literal buildscript classpath');
    }
    const str = tokens[item];
    if (str?.kind !== 'string') unsupported('Non-literal buildscript classpath');
    if (str.value !== MODULE && !str.value.startsWith(`${MODULE}:`)) continue;
    if (tokens[last + 1]?.value === '{') unsupported('Kotlin classpath with a custom dependency closure');
    const version = str.value === MODULE ? null : str.value.slice(MODULE.length + 1);
    if (version !== null) stableVersion(version);
    recognized.add(item);
    dependencies.push({ start: t.start, end: tokens[last].end, str, version });
  }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === 'string' && t.value.startsWith('org.jetbrains.kotlin.') && !t.value.startsWith(MODULE)) unsupported('Kotlin plugin DSL needs manual verification');
    if (t.kind === 'identifier' && t.value === 'alias') unsupported('Gradle plugin alias needs manual verification');
    if (t.kind === 'string' && (t.value === MODULE || t.value.startsWith(`${MODULE}:`)) && !recognized.has(i)) unsupported('Kotlin classpath outside the supported root dependencies syntax');
    if (t.kind === 'string' && t.value === 'kotlinVersion') unsupported('Referenced Kotlin ext value needs manual verification');
    if (t.kind === 'identifier' && t.value === 'kotlinVersion' && tokens[i + 1]?.value === '=') {
      const rhs = tokens[i + 2], next = tokens[i + 3];
      if (rhs?.kind !== 'string' || (next && !/[\r\n]/.test(contents.slice(rhs.end, next.start)) && ![';', '}'].includes(next.value))) unsupported('Non-literal Kotlin ext value');
      stableVersion(rhs.value); assignments.push(rhs);
    } else if (t.kind === 'identifier' && t.value === 'kotlinVersion') {
      unsupported('Referenced Kotlin variable needs manual verification');
    }
  }
  return { insertion: tokens[opening].end, dependencies, assignments };
}

function propertyInfo(contents) {
  const entries = [];
  const lines = contents.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) || [];
  let at = 0, continuation = false;
  for (const line of lines) {
    if (!line) continue;
    const text = line.replace(/[\r\n]+$/, '');
    const key = text.match(/^\s*([^\s:=#!]+)/)?.[1];
    if (key?.includes('\\')) unsupported('Escaped Gradle property key needs manual verification');
    if (!/^\s*[#!]/.test(text) && text.includes('kotlinVersion')) {
      if (continuation) unsupported('Continued Kotlin Gradle property syntax');
      const match = text.match(/^\s*android\.kotlinVersion(?:\s*[:=]\s*|\s+)(\S+)\s*$/);
      if (!match) unsupported('Unsupported Kotlin Gradle property syntax');
      stableVersion(match[1]); entries.push({ start: at, end: at + line.length, value: match[1] });
    }
    continuation = /(?:^|[^\\])(?:\\\\)*\\$/.test(text) && !/^\s*[#!]/.test(text);
    at += line.length;
  }
  return entries;
}

function replaceSpans(contents, edits) {
  for (const edit of edits.sort((a, b) => b.start - a.start)) contents = contents.slice(0, edit.start) + edit.value + contents.slice(edit.end);
  return contents;
}

function removeStatement(contents, statement) {
  let start = statement.start, end = statement.end;
  if (contents[end] === ';') end++;
  const lineStart = contents.lastIndexOf('\n', start - 1) + 1;
  const next = contents.indexOf('\n', end);
  const lineEnd = next < 0 ? contents.length : next + 1;
  if (/^\s*$/.test(contents.slice(lineStart, start)) && /^\s*$/.test(contents.slice(end, lineEnd))) { start = lineStart; end = lineEnd; }
  return { start, end, value: '' };
}

/** Validate both final files before producing either replacement. Unknown SDK combinations are a no-op. */
function planKotlinCompatibility(input) {
  const { rngmaVersion, gmaVersion, gradleProperties, projectBuildGradle } = input;
  if (rngmaVersion !== '16.5.0' || gmaVersion !== '25.4.0') return { version: null, changed: false, gradleProperties, projectBuildGradle };
  const props = propertyInfo(gradleProperties), root = gradleInfo(projectBuildGradle);
  const version = chooseVersion([...props.map((p) => p.value), ...root.dependencies.map((d) => d.version).filter(Boolean), ...root.assignments.map((a) => a.value)]);
  const propEol = gradleProperties.includes('\r\n') ? '\r\n' : '\n';
  const propLine = `android.kotlinVersion=${version}${propEol}`;
  const nextProps = props.length ? replaceSpans(gradleProperties, props.map((p, i) => ({ ...p, value: i ? '' : propLine })))
    : gradleProperties + (gradleProperties && !/[\r\n]$/.test(gradleProperties) ? propEol : '') + propLine;
  const edits = root.assignments.map((t) => ({ start: t.start, end: t.end, value: `${projectBuildGradle[t.start]}${version}${projectBuildGradle[t.start]}` }));
  if (root.dependencies.length) {
    const first = root.dependencies[0].str, quote = projectBuildGradle[first.start];
    edits.push({ start: first.start, end: first.end, value: `${quote}${MODULE}:${version}${quote}` });
    for (const duplicate of root.dependencies.slice(1)) edits.push(removeStatement(projectBuildGradle, duplicate));
  } else {
    const eol = projectBuildGradle.includes('\r\n') ? '\r\n' : '\n';
    edits.push({ start: root.insertion, end: root.insertion, value: `${eol}    classpath('${MODULE}:${version}')` });
  }
  const nextRoot = replaceSpans(projectBuildGradle, edits);
  return { version, changed: nextProps !== gradleProperties || nextRoot !== projectBuildGradle, gradleProperties: nextProps, projectBuildGradle: nextRoot };
}

function readInstalledSdk(projectRoot) {
  try {
    const file = require.resolve('react-native-google-mobile-ads/package.json', { paths: [projectRoot] });
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { rngmaVersion: pkg.version, gmaVersion: pkg.sdkVersions?.android?.googleMobileAds };
  } catch { return {}; }
}

module.exports = function withKotlinCompatibility(config) {
  const projectRoot = config._internal?.projectRoot || process.cwd();
  const installed = readInstalledSdk(projectRoot);
  // Older consumers need neither a new hook nor a newer Expo plugin API for an unrelated SDK.
  if (installed.rngmaVersion !== '16.5.0' || installed.gmaVersion !== '25.4.0') return config;
  const { withFinalizedMod } = require('expo/config-plugins');
  return withFinalizedMod(config, ['android', async (value) => {
    if (value.modRequest.introspect) return value;
    const sdk = readInstalledSdk(value.modRequest.projectRoot);
    if (sdk.rngmaVersion !== '16.5.0' || sdk.gmaVersion !== '25.4.0') return value;
    const dir = value.modRequest.platformProjectRoot;
    if (fs.existsSync(path.join(dir, 'build.gradle.kts'))) unsupported('Kotlin DSL root build file');
    const propFile = path.join(dir, 'gradle.properties'), rootFile = path.join(dir, 'build.gradle');
    const originalProps = fs.readFileSync(propFile, 'utf8'), originalRoot = fs.readFileSync(rootFile, 'utf8');
    const plan = planKotlinCompatibility({ ...sdk, gradleProperties: originalProps, projectBuildGradle: originalRoot });
    if (!plan.changed) return value;
    // Validation above is atomic. If the second filesystem write fails, restore the first file.
    fs.writeFileSync(propFile, plan.gradleProperties);
    try { fs.writeFileSync(rootFile, plan.projectBuildGradle); }
    catch (error) { fs.writeFileSync(propFile, originalProps); throw error; }
    return value;
  }]);
};
module.exports.planKotlinCompatibility = planKotlinCompatibility;
