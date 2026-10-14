// @jcurve/overlay config plugin — AndroidManifest 에 SYSTEM_ALERT_WINDOW(다른 앱 위에 표시) 권한을 넣는다.
// modResults 는 매니페스트 문서 전체({ manifest: { 'uses-permission': [...], application: [...] } })라 반드시 .manifest 안에 넣는다 —
// 처음 판은 문서 루트에 넣어 </manifest> 뒤에 태그가 붙었고 gradle 의 ManifestMerger2 가 「Error parsing AndroidManifest.xml」로 실패했다(2026-10-14 용돈캡슐 빌드).
const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSION = 'android.permission.SYSTEM_ALERT_WINDOW';

module.exports = function withJcurveOverlay(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = [];
    }
    const exists = manifest['uses-permission'].some((p) => p && p.$ && p.$['android:name'] === PERMISSION);
    if (!exists) {
      manifest['uses-permission'].push({ $: { 'android:name': PERMISSION } });
    }
    return config;
  });
};
