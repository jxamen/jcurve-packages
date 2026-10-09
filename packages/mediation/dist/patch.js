"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmpVersion = cmpVersion;
exports.podSatisfies = podSatisfies;
exports.pickVersions = pickVersions;
exports.patchAppBuildGradle = patchAppBuildGradle;
exports.patchProjectBuildGradle = patchProjectBuildGradle;
exports.patchPodfile = patchPodfile;
exports.mergeSkAdNetworkItems = mergeSkAdNetworkItems;
/**
 * 순수 함수(시험 가능) — 판 고르기 · build.gradle · Podfile · Info.plist 고치기.
 * 설정 플러그인(app.plugin.js)은 이 함수들을 expo 의 with… 에 끼우기만 한다.
 *
 * 여러 번 돌려도 같다: 우리 줄은 표시(시작 · 끝) 사이에만 쓰고, 다시 돌면 그 사이를 통째로 바꾼다.
 * (`expo prebuild` 를 --clean 없이 다시 돌려도 줄이 늘지 않고, 판을 바꾸면 그 판으로 바뀐다)
 */
const catalog_1 = require("./catalog");
/** 점으로 나뉜 판 비교 — 모자란 자리는 0 */
function cmpVersion(a, b) {
    const x = a.split('.').map(Number);
    const y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (x[i] ?? 0) - (y[i] ?? 0);
        if (d)
            return d < 0 ? -1 : 1;
    }
    return 0;
}
/** CocoaPods 조건 — `~> 13.0`(13.0 ≤ v < 14) · `~> 13.3.0`(13.3.0 ≤ v < 13.4) · `>= x` · `= x` · 그냥 판 */
function podSatisfies(requirement, version) {
    const m = requirement.trim().match(/^(~>|>=|>|<=|<|=)?\s*([\d.]+)$/);
    if (!m)
        return false;
    const [, op = '=', base] = m;
    const c = cmpVersion(version, base);
    if (op === '>=')
        return c >= 0;
    if (op === '>')
        return c > 0;
    if (op === '<=')
        return c <= 0;
    if (op === '<')
        return c < 0;
    if (op === '=')
        return c === 0;
    // ~> : 마지막 자리를 뺀 앞자리가 같아야 한다
    const parts = base.split('.');
    const head = parts.length > 1 ? parts.slice(0, -1) : parts;
    const vparts = version.split('.');
    return c >= 0 && head.every((p, i) => Number(vparts[i] ?? 0) === Number(p));
}
/** 앱의 GMA 판에 맞는 어댑터 중 가장 새 것 — 맞는 게 없으면 멈춘다(조용히 빼면 망이 안 붙은 줄 모른다) */
function pickVersions(opts = {}) {
    let networks = opts.networks && opts.networks.length ? opts.networks : [...catalog_1.NETWORKS];
    if (opts.hasTikTok && !opts.pangleWithTikTok)
        networks = networks.filter((n) => n !== 'pangle');
    const gmaAndroid = opts.gma?.android || catalog_1.DEFAULT_GMA.android;
    const gmaIos = opts.gma?.ios || catalog_1.DEFAULT_GMA.ios;
    return networks.map((network) => {
        const spec = catalog_1.SPECS[network];
        if (!spec)
            throw new Error(`@jcurve/mediation: 모르는 망 "${network}" — ${catalog_1.NETWORKS.join(' · ')} 중에서`);
        const force = opts.versions?.[network];
        const androidVersion = force?.android || spec.android.find(([, min]) => cmpVersion(min, gmaAndroid) <= 0)?.[0];
        if (!androidVersion)
            throw new Error(`@jcurve/mediation: ${network} 안드 어댑터 중 play-services-ads ${gmaAndroid} 에 맞는 판이 없다 — versions 로 정해 줄 것`);
        const iosVersion = force?.ios || spec.ios.find(([, req]) => podSatisfies(req, gmaIos))?.[0];
        if (!iosVersion)
            throw new Error(`@jcurve/mediation: ${network} iOS 어댑터 중 Google-Mobile-Ads-SDK ${gmaIos} 에 맞는 판이 없다 — versions 로 정해 줄 것`);
        const androidDeps = [`com.google.ads.mediation:${spec.artifact}:${androidVersion}`];
        if (spec.androidSdk)
            androidDeps.push(spec.androidSdk(androidVersion));
        return { network, androidDeps, androidVersion, pod: spec.pod, iosVersion, maven: spec.maven };
    });
}
const BEGIN = '@jcurve/mediation 시작 — prebuild 가 다시 쓴다, 손으로 고치지 말 것';
const END = '@jcurve/mediation 끝';
/** 표시 사이(표시 줄 포함)를 지운다 */
function stripBlock(src, comment) {
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`[ \\t]*${esc(comment)} ${esc(BEGIN)}[\\s\\S]*?${esc(comment)} ${esc(END)}[^\\n]*\\n?`, 'g');
    return src.replace(re, '');
}
function block(lines, indent, comment) {
    return [`${indent}${comment} ${BEGIN}`, ...lines.map((l) => indent + l), `${indent}${comment} ${END}`].join('\n') + '\n';
}
/** android/app/build.gradle — 맨 위 `dependencies {` 바로 안에 implementation 줄 */
function patchAppBuildGradle(src, picked) {
    const out = stripBlock(src, '//');
    if (!picked.length)
        return out;
    const m = out.match(/^dependencies\s*\{[^\n]*\n/m);
    if (!m || m.index === undefined)
        throw new Error('@jcurve/mediation: android/app/build.gradle 에서 dependencies { 를 못 찾음');
    const at = m.index + m[0].length;
    const lines = picked.flatMap((p) => p.androidDeps.map((d) => `implementation "${d}"`));
    return out.slice(0, at) + block(lines, '    ', '//') + out.slice(at);
}
const normUrl = (u) => u.trim().replace(/\/+$/, '').toLowerCase();
/** android/build.gradle — allprojects.repositories 에 망 저장소(이미 다른 데서 넣었으면 안 넣는다) */
function patchProjectBuildGradle(src, picked) {
    const out = stripBlock(src, '//');
    const have = out.toLowerCase().replace(/\/+(['")])/g, '$1');
    const urls = [...new Set(picked.map((p) => p.maven).filter((u) => !!u))].filter((u) => !have.includes(normUrl(u)));
    if (!urls.length)
        return out;
    const lines = urls.map((u) => `maven { url '${u}' }`);
    const m = out.match(/allprojects\s*\{\s*repositories\s*\{/);
    if (!m || m.index === undefined)
        return out + `\nallprojects {\n  repositories {\n${block(lines, '    ', '//')}  }\n}\n`;
    // 블록 **끝**(google() · mavenCentral() 뒤)에 — 앞에 두면 모든 의존성을 남의 저장소에 먼저 묻는다
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < out.length && depth; i++) {
        if (out[i] === '{')
            depth++;
        else if (out[i] === '}')
            depth--;
    }
    if (depth)
        throw new Error('@jcurve/mediation: android/build.gradle 의 allprojects.repositories 괄호가 안 닫힘');
    const open = m.index + m[0].length;
    const at = out.lastIndexOf('\n', i - 1) + 1; // 닫는 } 가 있는 줄의 처음
    if (at <= open)
        return out.slice(0, open) + '\n' + block(lines, '    ', '//') + out.slice(open); // 한 줄짜리 블록
    return out.slice(0, at) + block(lines, '    ', '//') + out.slice(at);
}
/** ios/Podfile — 앱 target 안(`target '…' do` 바로 아래)에 pod 줄. 판은 정확히 고정한다 */
function patchPodfile(src, picked) {
    const out = stripBlock(src, '#');
    if (!picked.length)
        return out;
    const m = out.match(/^target\s+['"][^'"]+['"]\s+do[^\n]*\n/m);
    if (!m || m.index === undefined)
        throw new Error("@jcurve/mediation: ios/Podfile 에서 target '…' do 를 못 찾음");
    const at = m.index + m[0].length;
    const lines = picked.map((p) => `pod '${p.pod}', '${p.iosVersion}'`);
    return out.slice(0, at) + block(lines, '  ', '#') + out.slice(at);
}
/** Info.plist SKAdNetworkItems — 있던 것(RNGMA skAdNetworkItems 포함)은 그대로 두고 없는 것만 뒤에(대소문자 무시) */
function mergeSkAdNetworkItems(existing, ids) {
    const list = Array.isArray(existing) ? [...existing] : [];
    const seen = new Set(list.map((x) => (x && typeof x.SKAdNetworkIdentifier === 'string' ? x.SKAdNetworkIdentifier.trim().toLowerCase() : '')));
    for (const raw of ids) {
        const id = raw.trim().toLowerCase();
        if (!id || seen.has(id))
            continue;
        seen.add(id);
        list.push({ SKAdNetworkIdentifier: id });
    }
    return list;
}
