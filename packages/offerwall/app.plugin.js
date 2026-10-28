const { withAndroidManifest, withInfoPlist, withAppDelegate } = require('expo/config-plugins');

// 0.5.0 — SnapPlay (react-native-s2offerwall). The SDK needs iOS 16.0 and Android minSdk 24, and its iOS side asks for the photo library and the camera
// (ads that need a screenshot). `snapPlay: true | false` forces it; left out, it is on when the app has the package installed.
const SNAPPLAY_PACKAGE = 'react-native-s2offerwall';
const SNAPPLAY_IOS_MIN = 16.0;
const SNAPPLAY_ANDROID_MIN = 24;
function snapPlayInstalled() {
  try { require.resolve(SNAPPLAY_PACKAGE + '/package.json', { paths: [process.cwd()] }); return true; } catch { return false; }
}
function buildPropertiesOf(config) {
  const entry = (config.plugins || []).find(item => Array.isArray(item) && item[0] === 'expo-build-properties');
  return (entry && entry[1]) || {};
}
// Fails the build early, with the reason, instead of at pod install / Gradle merge time.
function snapPlayBuildProblems(config) {
  const properties = buildPropertiesOf(config);
  const problems = [];
  const iosTarget = properties.ios && properties.ios.deploymentTarget;
  if (iosTarget !== undefined && !(parseFloat(String(iosTarget)) >= SNAPPLAY_IOS_MIN)) problems.push(`expo-build-properties ios.deploymentTarget is ${iosTarget}; SnapPlay needs ${SNAPPLAY_IOS_MIN.toFixed(1)} or higher`);
  const minSdk = properties.android && properties.android.minSdkVersion;
  if (minSdk !== undefined && !(Number(minSdk) >= SNAPPLAY_ANDROID_MIN)) problems.push(`expo-build-properties android.minSdkVersion is ${minSdk}; SnapPlay needs ${SNAPPLAY_ANDROID_MIN} or higher`);
  return problems;
}

module.exports = function withOfferwall(config, options = {}) {
  const appKey = typeof options.appKey === 'string' ? options.appKey.trim() : '';
  const hashKey = typeof options.hashKey === 'string' ? options.hashKey.trim() : '';
  const ready = Boolean(appKey && hashKey);
  const snapPlay = options.snapPlay === undefined ? snapPlayInstalled() : options.snapPlay === true;
  if (snapPlay) {
    const problems = snapPlayBuildProblems(config);
    if (problems.length) throw new Error('@jcurve/offerwall: ' + problems.join('; '));
  }
  // Android bridge reads manifest keys. iOS fetches its keys from the server at runtime.
  config.extra = { ...config.extra, jcurveOfferwall: { appKey, hashKey } };
  config = withInfoPlist(config, mod => {
    {
      mod.modResults.NSUserTrackingUsageDescription = options.trackingPermission ||
        mod.modResults.NSUserTrackingUsageDescription || '맞춤형 광고와 참여 보상 확인을 위해 광고 식별자를 사용합니다.';
    }
    if (snapPlay) {
      // The app's own strings (it may already pick photos) are never replaced.
      mod.modResults.NSPhotoLibraryUsageDescription = mod.modResults.NSPhotoLibraryUsageDescription ||
        options.photoPermission || '광고 참여 확인용 스크린샷을 올릴 때 사진을 고르는 데 사용해요.';
      mod.modResults.NSCameraUsageDescription = mod.modResults.NSCameraUsageDescription ||
        options.cameraPermission || '광고 참여 확인용 사진을 찍을 때 사용해요.';
    }
    return mod;
  });
  config = withAppDelegate(config, mod => {
    mod.modResults.contents = setServerMode(mod.modResults.contents, mod.modResults.language, true);
    return mod;
  });
  return withAndroidManifest(config, mod => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android application manifest missing');
    const names = ['adpopcorn_app_key', 'adpopcorn_hash_key', 'adpopcorn_reward_server_type'];
    application['meta-data'] = (application['meta-data'] || []).filter(item => !names.includes(item.$?.['android:name']));
    if (ready) {
      for (const [name, value] of [[names[0], appKey], [names[1], hashKey], [names[2], 'server']]) {
        application['meta-data'].push({ $: { 'android:name': name, 'android:value': value } });
      }
    }
    return mod;
  });
};

// AppDelegate runs before the JS SDK. The RN bridge does not expose this iOS flag.
function setServerMode(source, language, ready) {
  source = source.replace(/\n[ \t]*\/\/ @jcurve\/offerwall begin[\s\S]*?\/\/ @jcurve\/offerwall end\n/g, '\n');
  source = source.replace(/^import AdPopcornOfferwall \/\/ @jcurve\/offerwall\n/gm, '')
    .replace(/^#import <AdPopcornOfferwall\/AdPopcornOfferwall.h> \/\/ @jcurve\/offerwall\n/gm, '');
  if (!ready) return source;
  const swift = language === 'swift';
  if (!swift && !['objc', 'objcpp'].includes(language)) throw new Error('Unsupported AppDelegate language');
  const anchor = swift ? /^([ \t]*)return super\.application\(/m : /^([ \t]*)return (?:\[super application:|YES;)/m;
  if (!anchor.test(source)) throw new Error('Cannot configure AdPopcorn server mode: unsupported AppDelegate.');
  const statement = swift ? 'AdPopcornOfferwall.shared().useAdPopcornRewardServer = false' : '[AdPopcornOfferwall shared].useAdPopcornRewardServer = NO;';
  source = source.replace(anchor, (match, indent) =>
    `${indent}// @jcurve/offerwall begin\n${indent}${statement}\n${indent}// @jcurve/offerwall end\n${match}`);
  return (swift ? 'import AdPopcornOfferwall' : '#import <AdPopcornOfferwall/AdPopcornOfferwall.h>') + ' // @jcurve/offerwall\n' + source;
}
module.exports.setServerMode = setServerMode;
module.exports.snapPlayBuildProblems = snapPlayBuildProblems;
