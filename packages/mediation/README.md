# @jcurve/mediation


> **0.2.0 (10-09)** — 틱톡 비즈니스 SDK 가 있는 앱에도 **팽글을 넣는다**(기본). 안드는 팽글 어댑터 줄에서 PAG SDK 가 끌어오는 틱톡 사본
> `com.pangle.global:tiktok-business-android-sdk-comp` 를 빼서 앱의 틱톡 1.7.1 하나만 남긴다(5절). 빼려면 `"pangle": false`.
>
> **0.1.1 (10-09)** — 앱 안 로컬 모듈(`modules/<이름>`)이 틱톡 비즈니스 SDK(안드 `com.github.tiktok:tiktok-business-android-sdk` · iOS `TikTokBusinessSDK` pod)를 끌어와도 틱톡이 있다고 보고 팽글을 뺀다. 0.1.0 은 `@jcurve/ads` 의 틱톡만 봐서 당근캐시 안드 빌드가 `checkReleaseDuplicateClasses`(앱 1.7.1 × 팽글 tiktok-business-android-sdk-comp 1.6.0)로 멈췄다.

리워드 앱 공용 **AdMob 미디에이션 어댑터** — 앱러빈 · 유니티 · 민티그럴 · 팽글 · 메타(Audience Network)를
앱에 넣는 **Expo 설정 플러그인**. 런타임 코드는 없다(`import` 할 것이 없다).

AdMob 보상형 광고 요청이 AdMob 한 곳이 아니라 여러 망의 입찰(비딩)로 채워지게 하는 **네이티브 부품**만 넣는다.
어느 망을 실제로 쓸지, 단가 · 순서는 전부 **AdMob 화면(미디에이션 그룹)** 에서 정한다. 광고를 띄우는 코드는 `@jcurve/ads` 그대로다.

| 플랫폼 | 하는 일 |
|---|---|
| 안드로이드 | `android/app/build.gradle` 에 `implementation "com.google.ads.mediation:<망>:<판>"`(유니티는 `com.unity3d.ads:unity-ads` 도), `android/build.gradle` 의 `allprojects.repositories` 끝에 민티그럴 · 팽글 저장소 |
| iOS | `ios/Podfile` 앱 target 에 `pod 'GoogleMobileAdsMediation<망>', '<판>'`(판 고정), `Info.plist` 의 `SKAdNetworkItems` 에 망들의 ID 156개를 **합친다** |

`expo prebuild` 를 두 번 돌려도 줄이 늘지 않는다(표시 `@jcurve/mediation 시작 · 끝` 사이를 매번 다시 쓴다).

---

## 1. ⚠ 새 스토어 빌드가 있어야 한다

어댑터는 네이티브 라이브러리다. **OTA 로는 들어가지 않는다.** 이 플러그인을 넣은 뒤 나간 스토어 빌드부터 미디에이션이 돈다.
옛 빌드는 그대로 AdMob 혼자 채운다(앱이 죽거나 하지 않는다 — 단지 다른 망 입찰이 없다).

## 2. 설치

```bash
npm i https://github.com/jxamen/jcurve-packages/releases/download/mediation-v0.2.0/jcurve-mediation-0.2.0.tgz
```

`app.json` 의 `plugins` 에 — **`react-native-google-mobile-ads` 뒤에** 적는다(앞에 적어도 결과는 같다. SKAdNetwork 는 어느 쪽이든 합친다).

```jsonc
"plugins": [
  ["react-native-google-mobile-ads", { "androidAppId": "…", "iosAppId": "…", "userTrackingUsageDescription": "…" }],
  "@jcurve/mediation"
]
```

옵션(전부 생략 가능):

```jsonc
["@jcurve/mediation", {
  "networks": ["applovin", "unity", "mintegral", "pangle", "meta"],   // 넣을 망 — 기본 다섯 개 다
  "pangle": false,                                                     // 팽글만 뺄 때(networks 에서 빼는 것과 같다)
  "pangleWithTikTok": false,                                           // 틱톡 SDK 가 있는 앱에서만 팽글을 뺄 때(0.1 동작)
  "versions": { "pangle": { "android": "7.9.1.1.0", "ios": "7.9.1.1.0" } },   // 판을 손으로 정할 때만
  "skadnetwork": true                                                  // false 면 Info.plist 는 안 건드린다
}]
```

- 앱에 다른 키 · ID 를 넣을 것이 **없다.** 망 앱 키 · 플레이스먼트 ID 는 전부 AdMob 의 망 매핑에 넣는다(구글 문서: 다섯 망 모두
  「No additional code is required」). 앱러빈 SDK 키도 Info.plist · 매니페스트에 넣지 않는다(어댑터가 안 읽은 지 오래다).
- `NSUserTrackingUsageDescription`(ATT 문구)은 이 플러그인이 넣지 않는다. 우리 앱은 RNGMA 플러그인 `userTrackingUsageDescription` ·
  `expo-tracking-transparency` 로 이미 넣는다. **없으면 prebuild 때 경고가 뜬다** — 그 앱은 ATT 를 못 물어 메타 · 앱러빈 등 단가가 낮다.
- 팽글 · 유니티 · 메타 등은 안드 minSdk 23~24 · iOS 13 이상이면 된다(Expo 57 = 안드 24 · iOS 15.1 — 따로 할 것 없다).

## 3. 망 켜기 — AdMob 미디에이션 그룹

빌드에 어댑터가 들어간 것만으로는 아무 일도 없다. AdMob 에서 켠다.

1. AdMob → **미디에이션** → 미디에이션 그룹 만들기(형식 **보상형**, 플랫폼별 하나씩) → 앱의 보상형 광고 단위를 넣는다.
2. **입찰(Bidding) 광고 소스 추가** → AppLovin · Unity Ads · Mintegral · Pangle · Meta Audience Network.
   망마다 그 망 콘솔에서 만든 값(앱러빈 SDK 키, 유니티 게임 ID · 플레이스먼트 ID, 민티그럴 App ID · App Key · Placement ID · Unit ID,
   팽글 App ID · 플레이스먼트 ID, 메타 플레이스먼트 ID)을 매핑에 넣는다. 각 망과 **계정 연결(파트너십 동의)** 이 먼저 필요하다.
3. 개인정보 · 메시지 → GDPR · 미국 주 개인정보 「광고 파트너」 목록에 망들을 넣는다(구글 문서가 요구 — 한국 앱도 목록은 맞춰 둔다).
4. 확인은 광고 검사기(Ad Inspector)의 단일 광고 소스 테스트로. 메타 테스트는 기기에 페이스북 앱 로그인이 필요하다.
   출시 전 각 망 콘솔의 **테스트 모드를 끈다.**

유니티 폭포(waterfall)는 2026-01-31 로 끝났다 — 입찰로만 넣는다. 메타는 2021 년부터 입찰 전용이다.

## 4. 판 — 앱의 GMA 판을 올리지 않는 가장 새 어댑터

어댑터는 각자 최소 GMA SDK 판을 요구한다. 그보다 새 어댑터를 넣으면 **안드는 Gradle 이 앱의 `play-services-ads` 를 몰래 올리고**,
**iOS 는 `pod install` 이 실패한다**(RNGMA 가 `Google-Mobile-Ads-SDK` 를 정확한 판으로 고정하므로).
그래서 플러그인이 앱에 깔린 `react-native-google-mobile-ads/package.json` 의 `sdkVersions` 를 읽고, 그 판에 맞는 것 중 가장 새 판을 고른다
(`src/catalog.ts`, 2026-10-09 Google Maven · CocoaPods 에서 직접 확인). RNGMA 를 올리면 다음 prebuild 에서 어댑터도 따라 올라간다.

**RNGMA 16.3.4 (GMA iOS 13.1.0 · 안드 play-services-ads 25.0.0)** — 당근캐시 등

| 망 | 안드로이드 | 요구 GMA | iOS pod | 요구 GMA |
|---|---|---|---|---|
| 앱러빈 | `com.google.ads.mediation:applovin:13.6.1.0` | 25.0.0 | `GoogleMobileAdsMediationAppLovin 13.6.2.0` | ~> 13.0 |
| 유니티 | `com.google.ads.mediation:unity:4.17.0.0` + `com.unity3d.ads:unity-ads:4.17.0` | 25.0.0 | `GoogleMobileAdsMediationUnity 4.18.1.0` | ~> 13.0 |
| 민티그럴 | `com.google.ads.mediation:mintegral:17.1.11.0` | 25.0.0 | `GoogleMobileAdsMediationMintegral 8.1.3.0` | ~> 13.0 |
| 팽글 | `com.google.ads.mediation:pangle:7.9.1.1.0` | 25.0.0 | `GoogleMobileAdsMediationPangle 7.9.1.1.0` | ~> 13.0 |
| 메타 | `com.google.ads.mediation:facebook:6.21.0.1` | 24.9.0 | `GoogleMobileAdsMediationFacebook 6.21.1.0` | ~> 13.0 |

**RNGMA 16.0.3 (GMA iOS 12.14.0 · 안드 24.9.0)** — 꼬꼬농장

| 망 | 안드로이드 | iOS pod |
|---|---|---|
| 앱러빈 | 13.5.1.0 | 13.5.0.0 |
| 유니티 | 4.16.6.0 (+ unity-ads 4.16.6) | 4.16.6.0 |
| 민티그럴 | 17.0.91.0 | 8.0.5.2 |
| 팽글 | 7.9.0.9.0 | 7.8.5.8.1 |
| 메타 | 6.21.0.1 | 6.21.0.1 |

최신 어댑터(앱러빈 13.6.4.x · 유니티 4.21 · 민티그럴 17.1.81 · 팽글 8.3 · 메타 6.22)는 GMA 안드 25.4~25.5 · iOS 13.3~13.6 을 요구한다 —
RNGMA 가 그 판을 고정하는 날 표에 이미 있으니 자동으로 올라간다. 새 어댑터를 더할 때는 `src/catalog.ts` 맨 앞에 한 줄.

추가 Maven 저장소(Google 문서 그대로): 민티그럴 `https://dl-maven-android.mintegral.com/repository/mbridge_android_sdk_oversea`,
팽글 `https://artifact.bytedance.com/repository/pangle/`. 나머지는 google() · mavenCentral() 에 있다.

## 5. 팽글과 틱톡

팽글 SDK 는 **틱톡 비즈니스 SDK 를 자기 안에 또 들고 온다** — 안드 `com.pangle.global:tiktok-business-android-sdk-comp`
(PAG 7.9.0.9 ~ 8.1 은 1.6.0, 8.3 은 1.6.1), iOS `Ads-Global/TikTokBusinessSDK.xcframework`(1.6.0, 정적 라이브러리).
앱의 틱톡(앱 `modules/tiktok-business` 또는 `@jcurve/ads` 1.7+ — 안드 JitPack `com.github.tiktok:tiktok-business-android-sdk:1.7.1` ·
iOS pod `TikTokBusinessSDK` 1.7.2)과 **같은 `com.tiktok.*` 클래스**라, 그냥 두면 안드 `checkReleaseDuplicateClasses` 가 멈춘다.

0.2.0 부터 플러그인이 틱톡을 찾으면 **팽글은 넣고, 팽글 어댑터 줄에서 comp 만 뺀다**(틱톡이 없는 앱은 그대로):

```groovy
implementation("com.google.ads.mediation:pangle:7.9.1.1.0") { exclude group: 'com.pangle.global', module: 'tiktok-business-android-sdk-comp' }
```

- 왜 앱의 1.7.1 을 남기나: PAG SDK(7.9.0.9 · 7.9.1.1 · 8.3.0.4 의 classes.jar · 매니페스트 · .so)는 `com.tiktok.*` 를 **한 번도 직접 부르지 않는다**
  (comp 에는 R8 keep 규칙도 없어 틱톡 없는 앱의 릴리스에서는 통째로 지워진다). 1.7.1 은 comp 1.6.0 의 공개 API 를 다 가진다
  (빠진 것은 내부 결제 프록시 `V5_V8BillingProxy` 뿐). 반대로 comp 를 남기면 우리 모듈이 1.6.0 으로 내려가 1.7 기능을 잃는다.
- iOS 는 고칠 것이 없다: 두 사본 모두 `-framework TikTokBusinessSDK` 하나로 링크되어 **먼저 찾은 하나만** 들어간다(당근캐시 iOS 빌드 · 업로드 통과).
  어느 쪽이 들어가도 우리 모듈이 쓰는 API(`TikTokConfig` · `initializeSdk` · `trackTTEvent` · `identify` · `logout` · `updateAccessToken` ·
  `getTestEventCode`)는 1.6.0 · 1.7.2 헤더에 똑같이 있다.
- 남은 위험: 팽글이 실행 중 내려받는 코드가 틱톡 SDK 를 리플렉션으로 부를 가능성(확인 안 됨 — 1.7.1 이 1.6.0 의 상위 집합이라 깨질 일은 적다).
  팽글이 틱톡 SDK 를 자기 앱 ID 로 켜는 일은 찾지 못했다. 이상하면 `"pangle": false` 로 빼고 비교한다.

## 6. 처음 광고 직전 켜기 · 미리 안 받기와 미디에이션

우리 광고는 **SDK 를 처음 광고 직전에 켜고, 광고를 미리 받지 않는다**(2026-08-26 · 09-22 발열 결정). 이 패키지는 그 동작을
**바꾸지 않는다** — JS 를 넣지 않고, 시작 시 초기화도 넣지 않는다. 다만 미디에이션에는 이런 영향이 있다. 알고 쓰자.

- **첫 광고가 조금 더 늦다.** `mobileAds().initialize()` 는 이제 다섯 망 어댑터 초기화까지 기다린다(망 SDK 마다 네트워크 왕복).
  `@jcurve/ads` 는 초기화를 **5초까지만** 기다리고 광고를 요청하므로, 그때까지 못 끝낸 망은 첫 요청 입찰에 **빠진다** —
  첫 광고는 AdMob · 일부 망끼리만 경쟁해 **단가(eCPM)가 조금 낮거나 채움이 조금 떨어질 수 있다.** 두 번째 광고부터는 다 켜진 상태다.
  앱을 새로 켤 때(콜드 스타트)마다 이것이 반복된다.
- **입찰 토큰은 요청할 때 모은다.** 미리 받지 않으니 광고 요청 → 각 망 입찰 → 낙찰 → 소재 다운로드가 전부 사용자가 「광고 보기」를
  누른 뒤에 일어난다. 미디에이션은 AdMob 혼자보다 이 과정이 길다(망마다 토큰 · 영상 소재). 그래도 15초 열림 제한 안이다 —
  광고가 없으면 몇 초 안에 실패가 오고, 15초를 넘는 것은 SDK 가 응답을 안 줄 때뿐이다. 다만 **첫 광고(초기화 5초 + 로딩)** 가 느린 망 · 느린 회선에서
  15초에 가까워질 수 있다 — 출시 뒤 첫 광고 실패율(`광고를 불러오지 못했어요`)을 한 번 본다.
- **일부 망 SDK 는 앱 시작에 스스로 조금 돈다.** 안드 AAR 매니페스트에 시작 시 실행되는 부품이 있다 — 앱러빈 `AppLovinInitProvider`,
  메타 `AudienceNetworkContentProvider`, 민티그럴 `MBComponentLifecycleProvider`(+ 네트워크 변화 수신기), 유니티 `androidx.startup` 의
  `AdsSdkInitializer`. 이것들은 우리 JS 와 상관없이 프로세스 시작 때 가볍게 돈다(광고를 받는 것은 아니다). 발열 결정을 깨는 수준은
  아닐 것으로 보지만, 출시 뒤 기기 온도 · 배터리 불만이 늘면 이 망부터 의심한다(`networks` 로 빼서 비교).
- **망이 늘어도 미리 받기는 없다.** 미디에이션은 「무엇을 받느냐」를 바꿀 뿐 「언제 받느냐」는 그대로다. 받아 두고 안 보여 준 광고가 없으니
  망 쪽 노출률 · 만료 문제도 없다.

발열 결정을 지키면서 할 수 있는 것 — **꼭 해야 할 것은 없다.** 하고 싶으면:
- 처음 광고 수치를 보고 나쁘면 어댑터 초기화가 느린 망(보통 영상 망)을 `networks` 에서 빼 본다.
- 안드 RNGMA 플러그인의 `optimizeInitialization` · `optimizeAdLoading`(기본 켬)은 그대로 둔다 — 초기화 · 로딩을 메인 스레드 밖에서 한다.
- 미리 받기 · 앱 시작 초기화로 되돌리는 것은 **하지 않는다**(9/22 결정).

## 7. 개별 망 메모(구글 문서)

- 앱러빈 · 민티그럴 · 유니티 · 팽글의 미국 주 개인정보 호출(`setDoNotSell` 등)은 선택이다 — 한국 대상이라 넣지 않았다.
- 메타 iOS: Audience Network 6.15+ · iOS 17+ 는 `setAdvertiserTrackingEnabled` 가 필요 없다(ATT 상태를 SDK 가 직접 읽는다).
  iOS 14.5~16.x 기기에서는 이 값을 안 넣으면 메타가 추적 안 함으로 보고 단가가 낮다 — 네이티브 코드가 필요해 넣지 않았다.
- 메타 안드: 영상 캐시가 `127.0.0.1` 평문 통신을 쓴다는 메타 문서가 있다(Android 9+ network security config). 넣지 않았다 —
  개발 빌드의 Metro 평문 연결을 막을 수 있어서다. 메타 영상 채움이 이상하면 그때 본다.
- 팽글: ProGuard 로 팽글 SDK 를 난독화하지 말라는 문서가 있다 — AAR 에 든 규칙을 쓴다(따로 넣지 않았다).

## 8. 시험

```bash
cd packages/mediation && npx tsc -p tsconfig.json && npx vitest run
```

0.2.0 은 당근캐시(앱 틱톡 1.7.1 + 팽글 7.9.1.1.0) 새 클론에서 `expo prebuild --platform android --clean` 뒤
`./gradlew :app:checkReleaseDuplicateClasses` 와 릴리스 빌드로 확인했다(dex 에 `com.tiktok.*` 한 벌 · `com.bytedance.sdk.openadsdk` 같이 있음).

당근캐시(RNGMA 16.3.4) · 꼬꼬농장(16.0.3) 새 클론에서 `expo prebuild --clean` 결과 build.gradle · Podfile · Info.plist 를 확인했고,
두 번 더 돌려도 같았다. CocoaPods 의존성 풀이(다운로드 없이)도 두 앱 모두 통과(GMA 13.1.0 · 12.14.0 그대로).
