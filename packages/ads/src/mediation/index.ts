/**
 * @jcurve/mediation — AdMob 미디에이션 어댑터(앱러빈 · 유니티 · 민티그럴 · 팽글 · 메타)를 넣는 Expo 설정 플러그인.
 *
 * 런타임 코드는 없다. 광고를 켜고 받는 시점(처음 광고 직전에 켜기 · 미리 안 받기, 9/22 발열 결정)은 @jcurve/ads 그대로다.
 * 어댑터는 GMA SDK 가 켜질 때(`mobileAds().initialize()`) 같이 켜지고, 어느 망을 쓸지는 AdMob 미디에이션 그룹에서 정한다.
 * 쓰는 법은 README, 앱이 부르는 것은 app.plugin.js 뿐이다. 여기 내보내는 것은 시험 · 확인용이다.
 */
export { NETWORKS, SPECS, DEFAULT_GMA, SKADNETWORK_IDS, type Network, type NetworkSpec } from './catalog';
export {
  cmpVersion,
  podSatisfies,
  pickVersions,
  PANGLE_TIKTOK_COMP,
  patchAppBuildGradle,
  patchProjectBuildGradle,
  patchPodfile,
  mergeSkAdNetworkItems,
  type MediationOptions,
  type Picked,
  type AndroidExclude,
  type SkanItem,
} from './patch';
