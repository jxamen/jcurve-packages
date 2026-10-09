/**
 * 순수 함수(시험 가능) — 판 고르기 · build.gradle · Podfile · Info.plist 고치기.
 * 설정 플러그인(app.plugin.js)은 이 함수들을 expo 의 with… 에 끼우기만 한다.
 *
 * 여러 번 돌려도 같다: 우리 줄은 표시(시작 · 끝) 사이에만 쓰고, 다시 돌면 그 사이를 통째로 바꾼다.
 * (`expo prebuild` 를 --clean 없이 다시 돌려도 줄이 늘지 않고, 판을 바꾸면 그 판으로 바뀐다)
 */
import { type Network } from './catalog';
export interface MediationOptions {
    /** 넣을 망 — 비우면 다섯 개 다 */
    networks?: Network[];
    /** 판을 손으로 정할 때 — 예 `{ pangle: { android: '7.9.1.1.0', ios: '7.9.1.1.0' } }` */
    versions?: Partial<Record<Network, {
        android?: string;
        ios?: string;
    }>>;
    /** SKAdNetwork ID 를 Info.plist 에 합칠지(기본 켬) */
    skadnetwork?: boolean;
    /** 앱의 GMA 판 — 보통 비운다(플러그인이 react-native-google-mobile-ads 의 sdkVersions 를 읽는다) */
    gma?: {
        ios?: string;
        android?: string;
    };
    /** false 면 팽글을 뺀다(`networks` 에서 빼는 것과 같다) */
    pangle?: boolean;
    /**
     * 틱톡 SDK 가 있을 때 팽글을 같이 넣을지 — 0.2.0 부터 기본 켬. false 면 0.1 처럼 팽글을 뺀다.
     * 팽글 PAG SDK 는 틱톡 비즈니스 SDK 를 **자기 안에 또 들고 온다**(안드 com.pangle.global:tiktok-business-android-sdk-comp 1.6.x).
     * 앱의 틱톡(JitPack com.github.tiktok:tiktok-business-android-sdk 1.7.1)과 같은 com.tiktok.* 클래스라 Duplicate class 로 빌드가 멈춘다.
     * 그래서 틱톡이 있으면 팽글 어댑터 줄에서 comp 를 뺀다(PANGLE_TIKTOK_COMP) — PAG 는 com.tiktok.* 를 직접 부르지 않고(7.9.0.9 · 7.9.1.1 ·
     * 8.3.0.4 확인), 1.7.1 은 comp 1.6.0 의 공개 API 를 다 가진다. iOS 는 고칠 것이 없다(README 「팽글과 틱톡」).
     */
    pangleWithTikTok?: boolean;
    /** 앱에 틱톡 비즈니스 SDK(@jcurve/ads 1.7+ 또는 앱 modules/*)가 있는지 — 플러그인이 채운다 */
    hasTikTok?: boolean;
}
export interface AndroidExclude {
    group: string;
    module: string;
}
/** 팽글 PAG SDK 가 끌어오는 틱톡 비즈니스 SDK 사본 — 앱의 틱톡(com.github.tiktok 1.7.1)과 com.tiktok.* 가 겹친다 */
export declare const PANGLE_TIKTOK_COMP: AndroidExclude;
export interface Picked {
    network: Network;
    /** app/build.gradle 에 넣을 좌표들(어댑터 + 필요하면 망 SDK) */
    androidDeps: string[];
    /** 어댑터 줄에서 뺄 전이 의존성(틱톡과 겹치는 팽글 comp) */
    androidExcludes?: AndroidExclude[];
    androidVersion: string;
    pod: string;
    iosVersion: string;
    maven?: string;
}
/** 점으로 나뉜 판 비교 — 모자란 자리는 0 */
export declare function cmpVersion(a: string, b: string): number;
/** CocoaPods 조건 — `~> 13.0`(13.0 ≤ v < 14) · `~> 13.3.0`(13.3.0 ≤ v < 13.4) · `>= x` · `= x` · 그냥 판 */
export declare function podSatisfies(requirement: string, version: string): boolean;
/** 앱의 GMA 판에 맞는 어댑터 중 가장 새 것 — 맞는 게 없으면 멈춘다(조용히 빼면 망이 안 붙은 줄 모른다) */
export declare function pickVersions(opts?: MediationOptions): Picked[];
/** android/app/build.gradle — 맨 위 `dependencies {` 바로 안에 implementation 줄 */
export declare function patchAppBuildGradle(src: string, picked: Picked[]): string;
/** android/build.gradle — allprojects.repositories 에 망 저장소(이미 다른 데서 넣었으면 안 넣는다) */
export declare function patchProjectBuildGradle(src: string, picked: Picked[]): string;
/** ios/Podfile — 앱 target 안(`target '…' do` 바로 아래)에 pod 줄. 판은 정확히 고정한다 */
export declare function patchPodfile(src: string, picked: Picked[]): string;
export interface SkanItem {
    SKAdNetworkIdentifier: string;
}
/** Info.plist SKAdNetworkItems — 있던 것(RNGMA skAdNetworkItems 포함)은 그대로 두고 없는 것만 뒤에(대소문자 무시) */
export declare function mergeSkAdNetworkItems(existing: unknown, ids: readonly string[]): SkanItem[];
