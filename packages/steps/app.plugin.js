/**
 * 헬스 커넥트 권한 설명 화면(개인정보 처리방침) — 안드로이드.
 *
 * 헬스 커넥트 권한 창의 「개인정보처리방침」 링크를 누르면 헬스 커넥트가 앱에 두 가지 신호를 보낸다.
 *   - 안드로이드 13 이하: `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`
 *   - 안드로이드 14 이상: `VIEW_PERMISSION_USAGE` + `HEALTH_PERMISSIONS`(START_VIEW_PERMISSION_USAGE 로 지킨 별칭)
 * 이 신호를 받을 화면이 없으면 **구글 플레이 헬스 커넥트 심사에서 거절된다.**
 *
 * `react-native-health-connect` 의 플러그인은 이 신호를 **앱 첫 화면(MainActivity)** 으로 보낸다 — 그러면 홈이
 * 열릴 뿐 방침이 보이지 않는다. 그래서 그 플러그인은 쓰지 않고, 방침 웹 주소를 여는 작은 화면
 * (`StepsRationaleActivity`)을 만들어 두 신호를 거기로 보낸다. 권한 위임(permission delegate)은
 * 라이브러리의 Expo 모듈이 스스로 붙이므로 플러그인이 없어도 된다.
 */
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const ACTIVITY = '.StepsRationaleActivity';
const ALIAS = 'ViewPermissionUsageActivity';
const RATIONALE = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';

function privacyUrl(config) {
  const base = (config.extra && config.extra.legalBase) || '';

  const url = config.extra?.stepsPrivacyUrl || (base ? base.replace(/\/$/, '') + '/privacy/' : '');
  if (!/^https:\/\//.test(url)) throw new Error('stepsPrivacyUrl (https) required');
  return url.replace(/[\"\\$\n\r]/g, '');
}

const withRationaleActivitySource = (config) =>
  withDangerousMod(config, ['android', async (config) => {
    const pkg = config.android && config.android.package;
    if (!pkg) throw new Error('withStepsRationale: android.package 가 없다');
    const dir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'StepsRationaleActivity.kt'), `package ${pkg}

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/** 헬스 커넥트 권한 설명 — 개인정보 처리방침 웹 페이지를 열고 닫힌다(plugins/withStepsRationale.js 가 만든다) */
class StepsRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    try {
      startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${privacyUrl(config)}")))
    } catch (_: Exception) {
    }
    finish()
  }
}
`);

    return config;
  }]);

const withRationaleManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app.activity = (app.activity || []).filter((a) => a.$['android:name'] !== ACTIVITY);
    app.activity.push({
      $: {
        'android:name': ACTIVITY,
        'android:exported': 'true',
        'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
      },
      'intent-filter': [{ action: [{ $: { 'android:name': RATIONALE } }] }],
    });

    app['activity-alias'] = (app['activity-alias'] || []).filter((a) => a.$['android:name'] !== ALIAS);
    app['activity-alias'].push({
      $: {
        'android:name': ALIAS,
        'android:exported': 'true',
        'android:targetActivity': ACTIVITY,
        'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
      },
      'intent-filter': [{
        action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
        category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
      }],
    });

    return config;
  });

module.exports = (config) => withRationaleManifest(withRationaleActivitySource(config));
