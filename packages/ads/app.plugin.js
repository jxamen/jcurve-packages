/**
 * @jcurve/ads config plugin(1.7) — 앱 app.json `plugins: ["@jcurve/ads"]`.
 *
 * 1.9 — AdMob 미디에이션 어댑터(앱러빈 · 유니티 · 민티그럴 · 팽글 · 메타)를 기본으로 넣는다(@jcurve/mediation 0.2 를 그대로 부름,
 *   대표님 10-09 「광고회사 5개 더 붙이는 걸 패키지에 넣으면 안 돼?」). 판을 올리고 prebuild → 새 스토어 빌드, 키는 AdMob 웹 매핑에만.
 *   끄기: `["@jcurve/ads", { "mediation": false }]` · 일부만: `{ "mediation": { "networks": ["applovin","meta"] } }` · 팽글만 빼기: `{ "mediation": { "pangle": false } }`.
 *   앱이 @jcurve/mediation 플러그인을 따로 적어 두었어도 괜찮다 — 표시 사이만 다시 써서 두 번 돌아도 같다.
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

module.exports = function withJcurveAds(config, props) {
  // 플러그인이 돌 때만 읽는다 — 앱(expo)에는 늘 있고, 이 저장소의 시험은 addJitpack 만 본다
  const { withProjectBuildGradle } = require('expo/config-plugins');

  config = withProjectBuildGradle(config, (c) => {
    if (c.modResults.language === 'groovy') c.modResults.contents = addJitpack(c.modResults.contents);

    return c;
  });
  const mediation = props && props.mediation;
  if (mediation === false) return config;
  const withMediation = require('@jcurve/mediation/app.plugin');
  return withMediation(config, typeof mediation === 'object' && mediation ? mediation : {});
};
module.exports.addJitpack = addJitpack;
