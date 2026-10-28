const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

// There is no native compiler on the machine that makes this package: these checks only keep the three sides (JS, Android, iOS) from drifting apart.
const NAME = 'JCurveSnapPlayView';

test('the view name is the same in JS, Android and iOS, and the JS constant is the one the screens use', () => {
  assert.match(read('src/snapPlay.ts'), new RegExp(`SNAPPLAY_VIEW_NAME = '${NAME}'`));
  assert.match(read('android/src/main/java/kr/co/jcurve/offerwall/JCurveSnapPlayViewManager.java'), new RegExp(`getName\\(\\) \\{ return "${NAME}"; \\}`));
  assert.match(read('ios/JCurveSnapPlayViewManager.m'), new RegExp(`RCT_EXPORT_MODULE\\(${NAME}\\)`));
});

test('props and events match what snapPlay.ts passes: placement, onLoginRequested, onCloseRequested', () => {
  const js = read('src/snapPlay.ts');
  for (const word of ['placement:', 'onLoginRequested:', 'onCloseRequested:']) assert.ok(js.includes(word), word);
  const java = read('android/src/main/java/kr/co/jcurve/offerwall/JCurveSnapPlayViewManager.java');
  assert.match(java, /@ReactProp\(name = "placement"\)/);
  assert.match(java, /"topLoginRequested", MapBuilder\.of\("registrationName", "onLoginRequested"\)/);
  assert.match(java, /"topCloseRequested", MapBuilder\.of\("registrationName", "onCloseRequested"\)/);
  assert.match(java, /emit\("topLoginRequested"\)/);
  assert.match(java, /emit\("topCloseRequested"\)/);
  const objc = read('ios/JCurveSnapPlayViewManager.m');
  for (const prop of ['placement, NSString', 'onLoginRequested, RCTDirectEventBlock', 'onCloseRequested, RCTDirectEventBlock']) assert.ok(objc.includes(`RCT_EXPORT_VIEW_PROPERTY(${prop})`), prop);
});

test('Android: the SDK is compileOnly (the app brings it), the view manager is registered only when the SDK class exists, R8 will not fail on its absence', () => {
  assert.match(read('android/build.gradle'), /compileOnly 'io\.snapplay:s2offerwall-aos-sdk:1\.0\.38'/);
  assert.match(read('android/build.gradle'), /consumerProguardFiles 'consumer-rules\.pro'/);
  assert.match(read('android/consumer-rules.pro'), /-dontwarn s2\.adapi\.sdk\.offerwall\.\*\*/);
  const pkg = read('android/src/main/java/kr/co/jcurve/offerwall/JCurveOfferwallPackage.java');
  assert.match(pkg, /Class\.forName\("s2\.adapi\.sdk\.offerwall\.S2OfferwallView"\)/);
  assert.match(pkg, /if \(snapPlaySdkPresent\(\)\) managers\.add\(new JCurveSnapPlayViewManager\(\)\)/);
  assert.match(pkg, /managers\.add\(new JCurveOfferwallViewManager\(\)\)/, 'the AdPopcorn view is still registered first');
});

test('iOS: the pod depends on the SnapPlay pod at the SDK version and the whole view is compiled out when the Swift header is missing', () => {
  assert.match(read('JCurveOfferwall.podspec'), /s\.dependency 's2offerwall', '~> 1\.0\.38'/);
  const objc = read('ios/JCurveSnapPlayViewManager.m');
  assert.match(objc, /#if __has_include\(<s2offerwall\/s2offerwall-Swift\.h>\)/);
  assert.ok(objc.trimEnd().endsWith('#endif'));
  assert.match(objc, /loadWithPlacementName:self\.placement/);
});

test('the SDK versions that react-native-s2offerwall 1.0.38 pins are the ones the native files are written against', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.peerDependencies['react-native-s2offerwall'], '1.0.38');
});
