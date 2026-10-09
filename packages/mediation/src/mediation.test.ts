/**
 * 미디에이션 플러그인(0.1) — 판 고르기(앱 GMA 판 기준) · build.gradle · Podfile · Info.plist 고치기가
 * 두 번 돌려도 같고(prebuild 재실행), 있던 SKAdNetwork 를 지우지 않는지.
 */
import { describe, expect, it } from 'vitest';
import { NETWORKS, SKADNETWORK_IDS, SPECS } from './catalog';
import { cmpVersion, mergeSkAdNetworkItems, patchAppBuildGradle, patchPodfile, patchProjectBuildGradle, pickVersions, podSatisfies } from './patch';

const APP_GRADLE = `apply plugin: "com.android.application"

android {
    namespace 'kr.co.jcurve.carrotcash'
}

dependencies {
    // The version of react-native is set by the React Native Gradle Plugin
    implementation("com.facebook.react:react-android")
}
`;

const ROOT_GRADLE = `buildscript {
  repositories {
    google()
    mavenCentral()
  }
}

allprojects {
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
  }
}
`;

const PODFILE = `platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'

target 'app' do
  use_expo_modules!
  config = use_native_modules!(config_command)
end
`;

describe('판 비교 · CocoaPods 조건', () => {
  it('cmpVersion', () => {
    expect(cmpVersion('25.0.0', '25.0')).toBe(0);
    expect(cmpVersion('24.9.0', '25.0.0')).toBe(-1);
    expect(cmpVersion('7.9.1.1.0', '7.9.1.0.0')).toBe(1);
  });
  it('~> 는 마지막 자리 앞까지 같아야', () => {
    expect(podSatisfies('~> 13.0', '13.1.0')).toBe(true);
    expect(podSatisfies('~> 13.3', '13.1.0')).toBe(false);
    expect(podSatisfies('~> 12.0', '13.1.0')).toBe(false);
    expect(podSatisfies('~> 13.3.0', '13.3.4')).toBe(true);
    expect(podSatisfies('~> 13.3.0', '13.4.0')).toBe(false);
    expect(podSatisfies('~> 12.0', '12.14.0')).toBe(true);
  });
});

describe('판 고르기', () => {
  it('RNGMA 16.3.4(iOS 13.1.0 · 안드 25.0.0) — 앱의 GMA 를 올리지 않는 가장 새 판', () => {
    const p = Object.fromEntries(pickVersions({ gma: { ios: '13.1.0', android: '25.0.0' } }).map((x) => [x.network, x]));
    expect(Object.keys(p)).toEqual([...NETWORKS]);
    expect([p.applovin.androidVersion, p.applovin.iosVersion]).toEqual(['13.6.1.0', '13.6.2.0']);
    expect([p.unity.androidVersion, p.unity.iosVersion]).toEqual(['4.17.0.0', '4.18.1.0']);
    expect([p.mintegral.androidVersion, p.mintegral.iosVersion]).toEqual(['17.1.11.0', '8.1.3.0']);
    expect([p.pangle.androidVersion, p.pangle.iosVersion]).toEqual(['7.9.1.1.0', '7.9.1.1.0']);
    expect([p.meta.androidVersion, p.meta.iosVersion]).toEqual(['6.21.0.1', '6.21.1.0']);
    expect(p.unity.androidDeps).toEqual(['com.google.ads.mediation:unity:4.17.0.0', 'com.unity3d.ads:unity-ads:4.17.0']);
    expect(p.meta.androidDeps).toEqual(['com.google.ads.mediation:facebook:6.21.0.1']);
    expect(p.meta.pod).toBe('GoogleMobileAdsMediationFacebook');
  });
  it('RNGMA 16.0.3(꼬꼬농장 — iOS 12.14.0 · 안드 24.9.0)', () => {
    const p = Object.fromEntries(pickVersions({ gma: { ios: '12.14.0', android: '24.9.0' } }).map((x) => [x.network, [x.androidVersion, x.iosVersion]]));
    expect(p).toEqual({
      applovin: ['13.5.1.0', '13.5.0.0'], unity: ['4.16.6.0', '4.16.6.0'], mintegral: ['17.0.91.0', '8.0.5.2'],
      pangle: ['7.9.0.9.0', '7.8.5.8.1'], meta: ['6.21.0.1', '6.21.0.1'],
    });
  });
  it('기본값은 16.3.4 · networks 로 고르기 · versions 로 덮기', () => {
    expect(pickVersions().find((x) => x.network === 'pangle')!.androidVersion).toBe('7.9.1.1.0');
    const p = pickVersions({ networks: ['pangle'], versions: { pangle: { ios: '7.9.0.8.0' } } });
    expect(p.map((x) => [x.network, x.androidVersion, x.iosVersion])).toEqual([['pangle', '7.9.1.1.0', '7.9.0.8.0']]);
  });
  it('틱톡(@jcurve/ads 1.7+)이 있으면 팽글을 뺀다 — pangleWithTikTok 로만 넣는다', () => {
    expect(pickVersions({ hasTikTok: true }).map((x) => x.network)).toEqual(['applovin', 'unity', 'mintegral', 'meta']);
    expect(pickVersions({ hasTikTok: true, networks: ['pangle'] })).toEqual([]);
    expect(pickVersions({ hasTikTok: true, pangleWithTikTok: true }).map((x) => x.network)).toContain('pangle');
  });
  it('맞는 판이 없으면 멈춘다', () => {
    expect(() => pickVersions({ gma: { ios: '11.0.0', android: '25.0.0' } })).toThrow(/iOS/);
    expect(() => pickVersions({ networks: ['nope' as never] })).toThrow(/모르는 망/);
  });
  it('표는 새 판이 앞', () => {
    for (const n of NETWORKS) {
      const a = SPECS[n].android.map(([v]) => v);
      expect([...a].sort((x, y) => cmpVersion(y, x))).toEqual(a);
      const i = SPECS[n].ios.map(([v]) => v);
      expect([...i].sort((x, y) => cmpVersion(y, x))).toEqual(i);
    }
  });
});

describe('build.gradle · Podfile', () => {
  const picked = pickVersions();

  it('app/build.gradle — dependencies 안에, 두 번 돌려도 같다', () => {
    const once = patchAppBuildGradle(APP_GRADLE, picked);
    expect(once).toContain('    implementation "com.google.ads.mediation:applovin:13.6.1.0"');
    expect(once).toContain('implementation "com.unity3d.ads:unity-ads:4.17.0"');
    expect(once.indexOf('applovin')).toBeGreaterThan(once.indexOf('dependencies {'));
    expect(patchAppBuildGradle(once, picked)).toBe(once);
    // 판을 바꾸면 줄이 바뀐다(늘지 않는다)
    const other = patchAppBuildGradle(once, pickVersions({ networks: ['meta'] }));
    expect(other.match(/com\.google\.ads\.mediation/g)).toHaveLength(1);
    expect(patchAppBuildGradle(once, [])).toBe(APP_GRADLE);
  });

  it('build.gradle — allprojects.repositories 에 민티그럴 · 팽글, 두 번 돌려도 같다', () => {
    const once = patchProjectBuildGradle(ROOT_GRADLE, picked);
    expect(once.match(/mbridge_android_sdk_oversea/g)).toHaveLength(1);
    expect(once.match(/artifact\.bytedance\.com\/repository\/pangle/g)).toHaveLength(1);
    // allprojects 안 · 구글 저장소들 뒤
    expect(once.indexOf('bytedance')).toBeGreaterThan(once.lastIndexOf('jitpack'));
    expect(once.indexOf('bytedance')).toBeLessThan(once.lastIndexOf('}'));
    const one = patchProjectBuildGradle('allprojects { repositories { google() } }\n', picked);
    expect(one.indexOf('bytedance')).toBeGreaterThan(one.indexOf('repositories {'));
    expect(one.indexOf('bytedance')).toBeLessThan(one.indexOf('google()'));
    expect(patchProjectBuildGradle(one, picked)).toBe(one);
    expect(patchProjectBuildGradle(once, picked)).toBe(once);
    // 앱이 이미 넣은 저장소(끝 / 차이)는 또 넣지 않는다
    const has = ROOT_GRADLE.replace("maven { url 'https://www.jitpack.io' }", "maven { url 'https://artifact.bytedance.com/repository/pangle' }");
    expect(patchProjectBuildGradle(has, picked).match(/bytedance/g)).toHaveLength(1);
    // 저장소가 필요 없는 망만이면 그대로
    expect(patchProjectBuildGradle(ROOT_GRADLE, pickVersions({ networks: ['meta', 'applovin'] }))).toBe(ROOT_GRADLE);
  });

  it('Podfile — target 안에 정확한 판, 두 번 돌려도 같다', () => {
    const once = patchPodfile(PODFILE, picked);
    expect(once).toContain("  pod 'GoogleMobileAdsMediationPangle', '7.9.1.1.0'");
    expect(once.indexOf('GoogleMobileAdsMediation')).toBeGreaterThan(once.indexOf("target 'app' do"));
    expect(once.indexOf('GoogleMobileAdsMediation')).toBeLessThan(once.indexOf('use_expo_modules!'));
    expect(patchPodfile(once, picked)).toBe(once);
    expect(() => patchPodfile('platform :ios', picked)).toThrow();
  });
});

describe('SKAdNetwork', () => {
  it('목록은 소문자 · 겹침 없음 · 구글 것 포함', () => {
    expect(new Set(SKADNETWORK_IDS).size).toBe(SKADNETWORK_IDS.length);
    expect(SKADNETWORK_IDS.every((x) => /^[a-z0-9]+\.skadnetwork$/.test(x))).toBe(true);
    expect(SKADNETWORK_IDS).toContain('cstr6suwn9.skadnetwork');   // 구글
    expect(SKADNETWORK_IDS).toContain('kbd757ywx3.skadnetwork');   // 민티그럴
    expect(SKADNETWORK_IDS).toContain('v9wttpbfk9.skadnetwork');   // 메타
  });
  it('있던 것(RNGMA skAdNetworkItems · 대문자)은 두고 없는 것만 더한다, 두 번 해도 같다', () => {
    const existing = [{ SKAdNetworkIdentifier: 'CSTR6SUWN9.skadnetwork' }, { SKAdNetworkIdentifier: 'custom123.skadnetwork' }];
    const once = mergeSkAdNetworkItems(existing, SKADNETWORK_IDS);
    expect(once.slice(0, 2)).toEqual(existing);
    expect(once).toHaveLength(SKADNETWORK_IDS.length + 1);
    expect(mergeSkAdNetworkItems(once, SKADNETWORK_IDS)).toEqual(once);
    expect(mergeSkAdNetworkItems(undefined, ['A.skadnetwork'])).toEqual([{ SKAdNetworkIdentifier: 'a.skadnetwork' }]);
  });
});
