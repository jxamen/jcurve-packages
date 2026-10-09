/**
 * @jcurve/mediation 설정 플러그인(0.2) — app.json `plugins: ["@jcurve/mediation"]`
 * (망을 고를 때 `["@jcurve/mediation", { "networks": ["applovin", "pangle"] }]`).
 *
 * - 안드: android/app/build.gradle 에 어댑터 implementation, android/build.gradle 의 allprojects.repositories 에
 *   민티그럴 · 팽글 저장소.
 * - iOS: ios/Podfile 의 앱 target 에 `pod 'GoogleMobileAdsMediation…', '<판>'`, Info.plist 에 SKAdNetworkItems 합치기.
 * - 판은 앱의 react-native-google-mobile-ads 가 고정한 GMA 판(package.json sdkVersions)에 맞춰 고른다(src/catalog.ts).
 * 런타임 코드는 넣지 않는다 — 광고를 켜는 시점 · 미리 안 받기(9/22 발열 결정)는 그대로다.
 */
const fs = require('fs');
const path = require('path');
const { pickVersions, patchAppBuildGradle, patchProjectBuildGradle, patchPodfile, mergeSkAdNetworkItems, SKADNETWORK_IDS } = require('./dist');

const TAG = '@jcurve/mediation';

/** 앱이 깐 RNGMA 의 sdkVersions — 못 읽으면 null(기본값 RNGMA 16.3.4 = iOS 13.1.0 · 안드 25.0.0) */
function readAppGma(projectRoot) {
  try {
    const file = require.resolve('react-native-google-mobile-ads/package.json', { paths: [projectRoot] });
    const s = JSON.parse(fs.readFileSync(file, 'utf8')).sdkVersions || {};
    return { ios: s.ios && s.ios.googleMobileAds, android: s.android && s.android.googleMobileAds };
  } catch {
    return null;
  }
}

/**
 * 틱톡 비즈니스 SDK 가 앱에 들었는지 — 있으면 팽글 어댑터 줄에서 PAG SDK 의 틱톡 사본(comp)을 뺀다(src/patch.ts pangleWithTikTok).
 * ① @jcurve/ads 1.7+ 의 틱톡 네이티브 모듈 ② 앱 안 로컬 Expo 모듈(modules/<이름>) 이 틱톡 SDK 를 끌어오는 것
 *    (안드 com.github.tiktok:tiktok-business-android-sdk · iOS TikTokBusinessSDK pod — 10-09 당근캐시 안드 빌드가
 *    checkReleaseDuplicateClasses 로 멈춘 원인: 앱 모듈의 1.7.1 과 팽글의 tiktok-business-android-sdk-comp 1.6.0).
 */
function hasTikTokModule(projectRoot) {
  try {
    const dir = path.dirname(require.resolve('@jcurve/ads/package.json', { paths: [projectRoot] }));
    if (fs.existsSync(path.join(dir, 'ios', 'JcurveTikTok.podspec')) || fs.existsSync(path.join(dir, 'android', 'build.gradle'))) return true;
  } catch {}
  try {
    const mods = path.join(projectRoot, 'modules');
    for (const name of fs.existsSync(mods) ? fs.readdirSync(mods) : []) {
      const gradle = path.join(mods, name, 'android', 'build.gradle');
      if (fs.existsSync(gradle) && /tiktok-business-android-sdk|com\.github\.tiktok/.test(fs.readFileSync(gradle, 'utf8'))) return true;
      const ios = path.join(mods, name, 'ios');
      for (const f of fs.existsSync(ios) ? fs.readdirSync(ios).filter((x) => x.endsWith('.podspec')) : []) {
        if (/TikTokBusinessSDK/.test(fs.readFileSync(path.join(ios, f), 'utf8'))) return true;
      }
    }
  } catch {}
  return false;
}

/** ATT 문구를 누가 넣는지 — plugin 은 늦게 적힌 것부터 돌아서 우리 차례엔 아직 Info.plist 에 없을 수 있다 */
function hasAttText(config, plist) {
  if (plist.NSUserTrackingUsageDescription || (config.ios && config.ios.infoPlist && config.ios.infoPlist.NSUserTrackingUsageDescription)) return true;
  return (config.plugins || []).some((p) => {
    const [name, o] = Array.isArray(p) ? p : [p, undefined];
    if (name === 'expo-tracking-transparency') return !(o && o.userTrackingPermission === false);
    return name === 'react-native-google-mobile-ads' && !!(o && o.userTrackingUsageDescription);
  });
}

function withJcurveMediation(config, props = {}) {
  // expo 는 앱이 가진 것을 쓴다(패키지는 의존하지 않는다)
  const { withAppBuildGradle, withProjectBuildGradle, withDangerousMod, withInfoPlist, WarningAggregator } = require('expo/config-plugins');
  const opts = props || {};
  const root = (config._internal && config._internal.projectRoot) || process.cwd();

  const found = readAppGma(root);
  if (!found) WarningAggregator.addWarningAndroid(TAG, 'react-native-google-mobile-ads 를 못 찾아 GMA 판을 iOS 13.1.0 · 안드 25.0.0 으로 보고 골랐다');
  const hasTikTok = hasTikTokModule(root);
  const wantsPangle = opts.pangle !== false && (!opts.networks || !opts.networks.length || opts.networks.includes('pangle'));
  if (hasTikTok && wantsPangle && opts.pangleWithTikTok === false) {
    const msg = 'pangleWithTikTok: false — 틱톡 비즈니스 SDK 가 있어 팽글을 뺐다(README 「팽글과 틱톡」)';
    WarningAggregator.addWarningAndroid(TAG, msg);
    WarningAggregator.addWarningIOS(TAG, msg);
  }
  const picked = pickVersions({ ...opts, hasTikTok, gma: { ...(found || {}), ...(opts.gma || {}) } });

  config = withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== 'groovy') throw new Error(`${TAG}: groovy app/build.gradle 만 지원`);
    c.modResults.contents = patchAppBuildGradle(c.modResults.contents, picked);
    return c;
  });

  config = withProjectBuildGradle(config, (c) => {
    if (c.modResults.language !== 'groovy') throw new Error(`${TAG}: groovy build.gradle 만 지원`);
    c.modResults.contents = patchProjectBuildGradle(c.modResults.contents, picked);
    return c;
  });

  config = withDangerousMod(config, [
    'ios',
    async (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, 'Podfile');
      fs.writeFileSync(file, patchPodfile(fs.readFileSync(file, 'utf8'), picked));
      return c;
    },
  ]);

  config = withInfoPlist(config, (c) => {
    if (opts.skadnetwork !== false) c.modResults.SKAdNetworkItems = mergeSkAdNetworkItems(c.modResults.SKAdNetworkItems, SKADNETWORK_IDS);
    // 메타 · 앱러빈 등은 ATT 허용을 보고 값을 매긴다 — 문구는 앱(또는 RNGMA 플러그인)이 넣는다. 여기선 알리기만
    if (!hasAttText(c, c.modResults)) {
      WarningAggregator.addWarningIOS(TAG, 'NSUserTrackingUsageDescription 이 없다 — ATT 를 못 물으면 미디에이션 망 단가가 낮다(README)');
    }
    return c;
  });

  return config;
}

module.exports = withJcurveMediation;
