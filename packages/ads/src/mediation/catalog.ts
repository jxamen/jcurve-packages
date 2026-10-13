/**
 * 어댑터 판 목록 · 추가 Maven 저장소 · SKAdNetwork ID — 2026-10-09 에 직접 확인한 값.
 *
 * - 안드로이드: maven.google.com 의 `com.google.ads.mediation:<망>` POM 이 끌어오는 `play-services-ads` 판을 「최소 GMA」로 적었다.
 *   그보다 높은 판의 어댑터를 넣으면 Gradle 이 앱의 play-services-ads 를 **올려 버린다**(RNGMA 가 고정한 판과 어긋남).
 * - iOS: CocoaPods 스펙의 `Google-Mobile-Ads-SDK` 조건(`~> 13.0` 등). RNGMA 는 GMA 를 **정확한 판**으로 고정하므로
 *   조건이 안 맞으면 `pod install` 이 아예 실패한다.
 * - 망마다 「최소 GMA 가 바뀌는 지점」의 가장 새 판만 남겼다 — 앱의 GMA 판에 맞는 것 중 가장 새 것을 고른다(pick.ts).
 * 새 어댑터가 나와 판을 올릴 때는 이 표의 맨 앞에 한 줄 더하고 README 의 판 표도 고친다.
 */

export type Network = 'applovin' | 'unity' | 'mintegral' | 'pangle' | 'meta';

export const NETWORKS: readonly Network[] = ['applovin', 'unity', 'mintegral', 'pangle', 'meta'];

/** [어댑터 판, 최소 GMA] — 새 판이 앞 */
export type AndroidRow = readonly [version: string, minGma: string];
/** [어댑터 판, CocoaPods 의 Google-Mobile-Ads-SDK 조건] — 새 판이 앞 */
export type IosRow = readonly [version: string, gmaRequirement: string];

export interface NetworkSpec {
  /** com.google.ads.mediation:<artifact> */
  artifact: string;
  /** GoogleMobileAdsMediation<…> */
  pod: string;
  /** Google Maven 이 아닌 곳에 망 SDK 가 있으면 그 저장소 */
  maven?: string;
  /** 어댑터가 망 SDK 를 끌어오지 않는 경우(유니티 안드) — 어댑터 판에서 SDK 좌표를 만든다 */
  androidSdk?: (adapter: string) => string;
  android: readonly AndroidRow[];
  ios: readonly IosRow[];
}

export const SPECS: Record<Network, NetworkSpec> = {
  applovin: {
    artifact: 'applovin',
    pod: 'GoogleMobileAdsMediationAppLovin',
    android: [['13.6.4.2', '25.4.0'], ['13.6.2.0', '25.1.0'], ['13.6.1.0', '25.0.0'], ['13.5.1.0', '24.7.0'], ['13.4.0.0', '24.5.0'], ['13.3.1.1', '24.4.0']],
    ios: [['13.6.4.0', '~> 13.3'], ['13.6.2.0', '~> 13.0'], ['13.5.0.0', '~> 12.0']],
  },
  unity: {
    artifact: 'unity',
    pod: 'GoogleMobileAdsMediationUnity',
    // 안드 유니티 어댑터 POM 에는 unity-ads 가 없다 — 구글 문서도 따로 적게 한다(Maven Central). 어댑터 앞 세 자리 = SDK 판
    androidSdk: (v) => `com.unity3d.ads:unity-ads:${v.split('.').slice(0, 3).join('.')}`,
    android: [['4.21.0.0', '25.5.0'], ['4.20.1.0', '25.4.0'], ['4.18.1.0', '25.3.0'], ['4.18.0.0', '25.2.0'], ['4.17.0.0', '25.0.0'], ['4.16.6.0', '24.9.0'], ['4.16.5.0', '24.8.0'], ['4.16.4.0', '24.7.0']],
    ios: [['4.21.0.0', '~> 13.3'], ['4.18.1.0', '~> 13.0'], ['4.16.6.0', '~> 12.0']],
  },
  mintegral: {
    artifact: 'mintegral',
    pod: 'GoogleMobileAdsMediationMintegral',
    maven: 'https://dl-maven-android.mintegral.com/repository/mbridge_android_sdk_oversea',
    android: [['17.1.81.1', '25.4.0'], ['17.1.61.0', '25.2.0'], ['17.1.41.0', '25.1.0'], ['17.1.11.0', '25.0.0'], ['17.0.91.0', '24.9.0']],
    ios: [['8.1.7.0', '~> 13.3'], ['8.1.3.0', '~> 13.0'], ['8.0.5.2', '~> 12.0']],
  },
  pangle: {
    artifact: 'pangle',
    pod: 'GoogleMobileAdsMediationPangle',
    maven: 'https://artifact.bytedance.com/repository/pangle/',
    android: [['8.3.0.4.0', '25.5.0'], ['8.3.0.3.0', '25.4.0'], ['8.1.0.3.0', '25.3.0'], ['8.0.0.5.0', '25.2.0'], ['7.9.1.3.0', '25.1.0'], ['7.9.1.1.0', '25.0.0'], ['7.9.0.9.0', '24.9.0']],
    // 8.2.0.3.0 은 Ads-Global-Beta 를 끌어와 뺐다. 7.9.1.1.1 은 `~> 13.3.0`(13.3.x 만)이라 뺐다
    ios: [['8.3.0.8.0', '~> 13.6'], ['8.1.1.1.0', '~> 13.3'], ['7.9.1.1.0', '~> 13.0'], ['7.8.5.8.1', '~> 12.0']],
  },
  meta: {
    artifact: 'facebook',
    pod: 'GoogleMobileAdsMediationFacebook',
    android: [['6.22.0.1', '25.4.0'], ['6.21.0.3', '25.2.0'], ['6.21.0.2', '25.1.0'], ['6.21.0.1', '24.9.0'], ['6.21.0.0', '24.7.0']],
    // 6.22.0.0 부터 iOS 15 이상(Expo 57 은 15.1 이라 문제없다)
    ios: [['6.22.0.0', '~> 13.3'], ['6.21.1.0', '~> 13.0'], ['6.21.0.1', '~> 12.0']],
  },
};

/** RNGMA 의 sdkVersions 를 못 읽을 때 쓰는 값 — RNGMA 16.3.4 */
export const DEFAULT_GMA = { ios: '13.1.0', android: '25.0.0' } as const;

/**
 * SKAdNetwork ID(소문자, 겹침 없음) 156개 — 구글(developers.google.com/admob/ios/3p-skadnetworks 50) ∪ 앱러빈
 * (skadnetwork-ids.applovin.com/v1/skadnetworkids.json) ∪ 유니티(skan.mz.unity3d.com/v3/partner/skadnetworks.plist.json)
 * ∪ 민티그럴(dev.mintegral.com/skadnetworkids.json) ∪ 팽글(pangleglobal.com/integration/ios14-readiness) ∪ 메타(n38lu8286q · v9wttpbfk9).
 */
export const SKADNETWORK_IDS: readonly string[] = [
  '22mmun2rn5.skadnetwork', '238da6jt44.skadnetwork', '24t9a8vw3c.skadnetwork', '24zw6aqk47.skadnetwork',
  '252b5q8x7y.skadnetwork', '275upjj5gd.skadnetwork', '294l99pt4k.skadnetwork', '2fnua5tdw4.skadnetwork',
  '2u9pt9hc89.skadnetwork', '32z4fx6l9h.skadnetwork', '3l6bd9hu43.skadnetwork', '3qcr597p9d.skadnetwork',
  '3qy4746246.skadnetwork', '3rd42ekr43.skadnetwork', '3sh42y64q3.skadnetwork', '424m5254lk.skadnetwork',
  '4468km3ulz.skadnetwork', '44jx6755aq.skadnetwork', '44n7hlldy6.skadnetwork', '47vhws6wlr.skadnetwork',
  '488r3q3dtq.skadnetwork', '4dzt52r2t5.skadnetwork', '4fzdc2evr5.skadnetwork', '4mn522wn87.skadnetwork',
  '4pfyvq9l8r.skadnetwork', '4w7y6s5ca2.skadnetwork', '523jb4fst2.skadnetwork', '52fl2v3hgk.skadnetwork',
  '54nzkqm89y.skadnetwork', '578prtvx9j.skadnetwork', '5a6flpkh64.skadnetwork', '5f5u5tfb26.skadnetwork',
  '5l3tpt7t6e.skadnetwork', '5lm9lj6jb7.skadnetwork', '5tjdwbrq8w.skadnetwork', '6964rsfnh4.skadnetwork',
  '6g9af3uyq4.skadnetwork', '6p4ks3rnbw.skadnetwork', '6v7lgmsu45.skadnetwork', '6xzpu9s2p8.skadnetwork',
  '6yxyv74ff7.skadnetwork', '737z793b9f.skadnetwork', '74b6s63p6l.skadnetwork', '77y3x8wds4.skadnetwork',
  '79pbpufp6p.skadnetwork', '7fmhfwg9en.skadnetwork', '7rz58n8ntl.skadnetwork', '7ug5zh24hu.skadnetwork',
  '84993kbrcf.skadnetwork', '89z7zv988g.skadnetwork', '8c4e2ghe7u.skadnetwork', '8m87ys6875.skadnetwork',
  '8r8llnkz5a.skadnetwork', '8s468mfl3y.skadnetwork', '97r2b46745.skadnetwork', '9b89h5y424.skadnetwork',
  '9nlqeag3gk.skadnetwork', '9rd848q2bz.skadnetwork', '9t245vhmpl.skadnetwork', '9vvzujtq5s.skadnetwork',
  '9yg77x724h.skadnetwork', 'a2p9lx4jpn.skadnetwork', 'a7xqa6mtl2.skadnetwork', 'a8cz6cu7e5.skadnetwork',
  'av6w8kgt66.skadnetwork', 'b9bk5wbcq9.skadnetwork', 'bxvub5ada5.skadnetwork', 'c3frkrj4fj.skadnetwork',
  'c6k4g5qg8m.skadnetwork', 'cg4yq2srnc.skadnetwork', 'cj5566h2ga.skadnetwork', 'cp8zw746q7.skadnetwork',
  'cs644xg564.skadnetwork', 'cstr6suwn9.skadnetwork', 'dbu4b84rxf.skadnetwork', 'dkc879ngq3.skadnetwork',
  'dzg6xy7pwj.skadnetwork', 'e5fvkxwrpn.skadnetwork', 'ecpz2srf59.skadnetwork', 'eh6m2bh4zr.skadnetwork',
  'ejvt5qm6ak.skadnetwork', 'f38h382jlk.skadnetwork', 'f73kdq92p3.skadnetwork', 'f7s53z58qe.skadnetwork',
  'feyaarzu9v.skadnetwork', 'g28c52eehv.skadnetwork', 'g2y4y55b64.skadnetwork', 'g6gcrrvk4p.skadnetwork',
  'ggvn48r87g.skadnetwork', 'glqzh8vgby.skadnetwork', 'gta8lk7p23.skadnetwork', 'gta9lk7p23.skadnetwork',
  'hb56zgv37p.skadnetwork', 'hdw39hrw9y.skadnetwork', 'hs6bdukanm.skadnetwork', 'k674qkevps.skadnetwork',
  'k6y4y55b64.skadnetwork', 'kbd757ywx3.skadnetwork', 'kbmxgpxpgc.skadnetwork', 'klf5c3l5u5.skadnetwork',
  'krvm3zuq6h.skadnetwork', 'lr83yxwka7.skadnetwork', 'ludvb6z3bs.skadnetwork', 'm297p6643m.skadnetwork',
  'm5mvw97r93.skadnetwork', 'm8dbw4sv7c.skadnetwork', 'mj797d8u6f.skadnetwork', 'mlmmfzh3r3.skadnetwork',
  'mls7yz5dvl.skadnetwork', 'mp6xlyr22a.skadnetwork', 'mqn7fxpca7.skadnetwork', 'mtkv5xtk9e.skadnetwork',
  'n38lu8286q.skadnetwork', 'n66cz3y3bx.skadnetwork', 'n6fk4nfna4.skadnetwork', 'n9x2a789qt.skadnetwork',
  'nzq8sh4pbs.skadnetwork', 'p78axxw29g.skadnetwork', 'ppxm28t8ap.skadnetwork', 'prcb7njmu6.skadnetwork',
  'pwa73g5rt2.skadnetwork', 'pwdxu55a5a.skadnetwork', 'qqp299437r.skadnetwork', 'qu637u8glc.skadnetwork',
  'r45fhb6rf7.skadnetwork', 'rvh3l7un93.skadnetwork', 'rx5hdcabgc.skadnetwork', 's39g8k73mm.skadnetwork',
  's69wq72ugq.skadnetwork', 'su67r6k2v3.skadnetwork', 't38b2kh725.skadnetwork', 'tl55sbb4fm.skadnetwork',
  'u679fj5vs4.skadnetwork', 'uw77j35x4d.skadnetwork', 'v4nxqhlyqp.skadnetwork', 'v72qych5uu.skadnetwork',
  'v79kvwwj4g.skadnetwork', 'v9wttpbfk9.skadnetwork', 'vcra2ehyfk.skadnetwork', 'vhf287vqwu.skadnetwork',
  'vutu7akeur.skadnetwork', 'w9q455wk68.skadnetwork', 'wg4vff78zm.skadnetwork', 'wzmmz9fp6w.skadnetwork',
  'x44k69ngh6.skadnetwork', 'x5l83yy675.skadnetwork', 'x8jxxk4ff5.skadnetwork', 'x8uqf25wch.skadnetwork',
  'xga6mpmplv.skadnetwork', 'xy9t38ct57.skadnetwork', 'y45688jllp.skadnetwork', 'y5ghdn5j9k.skadnetwork',
  'yclnxrl5pm.skadnetwork', 'ydx93a7ass.skadnetwork', 'zmvfpc5aq8.skadnetwork', 'zq492l623r.skadnetwork',
];
