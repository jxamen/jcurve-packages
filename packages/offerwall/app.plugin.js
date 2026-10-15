const { withAndroidManifest, withInfoPlist, withAppDelegate } = require('expo/config-plugins');

module.exports = function withOfferwall(config, options = {}) {
  const appKey = typeof options.appKey === 'string' ? options.appKey.trim() : '';
  const hashKey = typeof options.hashKey === 'string' ? options.hashKey.trim() : '';
  const ready = Boolean(appKey && hashKey);
  // Android bridge reads manifest keys. iOS fetches its keys from the server at runtime.
  config.extra = { ...config.extra, jcurveOfferwall: { appKey, hashKey } };
  config = withInfoPlist(config, mod => {
    {
      mod.modResults.NSUserTrackingUsageDescription = options.trackingPermission ||
        mod.modResults.NSUserTrackingUsageDescription || '맞춤형 광고와 참여 보상 확인을 위해 광고 식별자를 사용합니다.';
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
