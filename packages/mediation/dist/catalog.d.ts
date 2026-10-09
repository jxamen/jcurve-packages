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
export declare const NETWORKS: readonly Network[];
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
export declare const SPECS: Record<Network, NetworkSpec>;
/** RNGMA 의 sdkVersions 를 못 읽을 때 쓰는 값 — RNGMA 16.3.4 */
export declare const DEFAULT_GMA: {
    readonly ios: "13.1.0";
    readonly android: "25.0.0";
};
/**
 * SKAdNetwork ID(소문자, 겹침 없음) 156개 — 구글(developers.google.com/admob/ios/3p-skadnetworks 50) ∪ 앱러빈
 * (skadnetwork-ids.applovin.com/v1/skadnetworkids.json) ∪ 유니티(skan.mz.unity3d.com/v3/partner/skadnetworks.plist.json)
 * ∪ 민티그럴(dev.mintegral.com/skadnetworkids.json) ∪ 팽글(pangleglobal.com/integration/ios14-readiness) ∪ 메타(n38lu8286q · v9wttpbfk9).
 */
export declare const SKADNETWORK_IDS: readonly string[];
