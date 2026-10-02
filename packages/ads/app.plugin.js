/**
 * @jcurve/ads config plugin(1.7) — 앱 app.json `plugins: ["@jcurve/ads"]`.
 *
 * 틱톡 안드로이드 SDK 는 JitPack 에만 있다 — 루트 android/build.gradle 의 allprojects.repositories 에
 * `maven { url 'https://jitpack.io' }` 를 넣는다(이미 있으면 그대로). 앱마다 expo-build-properties 에
 * extraMavenRepos 를 적던 것을 대신한다(있어도 겹쳐 문제 되지 않는다).
 */
const JITPACK = "maven { url 'https://jitpack.io' }";

function addJitpack(contents) {
  if (contents.includes('jitpack.io')) return contents;
  const m = contents.match(/allprojects\s*\{\s*repositories\s*\{/);
  if (!m) return contents + `\nallprojects {\n  repositories {\n    ${JITPACK}\n  }\n}\n`;
  const at = m.index + m[0].length;

  return contents.slice(0, at) + `\n    ${JITPACK}` + contents.slice(at);
}

module.exports = function withJcurveAds(config) {
  // 플러그인이 돌 때만 읽는다 — 앱(expo)에는 늘 있고, 이 저장소의 시험은 addJitpack 만 본다
  const { withProjectBuildGradle } = require('expo/config-plugins');

  return withProjectBuildGradle(config, (c) => {
    if (c.modResults.language === 'groovy') c.modResults.contents = addJitpack(c.modResults.contents);

    return c;
  });
};
module.exports.addJitpack = addJitpack;
