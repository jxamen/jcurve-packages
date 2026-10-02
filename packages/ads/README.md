# @jcurve/ads

리워드 앱 공용 **광고** 패키지 — AdMob 보상형 광고 · iOS 추적 허용(ATT) · 광고 식별자 · **틱톡 광고 전환(1.7)**.
「광고는 전부 이 패키지」(2026-10-02 대표님). 앱마다 다른 것은 **설정값**(광고 단위 ID · 어드민 설정 그룹 이름)뿐이다.
왜 이렇게 생겼는지(꼬꼬농장 실기기에서 밟은 것들)는 `src/index.ts` 머리말에 있다.

## 설치

```jsonc
// package.json
"@jcurve/ads": "https://github.com/jxamen/jcurve-packages/releases/download/ads-v1.7.0/jcurve-ads-1.7.0.tgz"
```

```jsonc
// app.json — 1.7 부터. 안드로이드 틱톡 SDK 의 JitPack 저장소를 넣는다
"plugins": ["@jcurve/ads"]
```

앱에 있어야 하는 것: `react-native-google-mobile-ads` · `expo-tracking-transparency` · `expo-updates` · `expo-constants`(Expo 기본).
1.7 은 네이티브 모듈(`JcurveTikTok`)이 들어 있어 **새 빌드**가 필요하다. 모듈이 없는 옛 빌드에 OTA 로 내려가도 틱톡만 조용히 꺼지고 나머지는 그대로 돈다.

## 쓰는 법

```ts
import { createRewarded, createTikTok, isTestAds } from '@jcurve/ads';

export const ads = createRewarded({
  units: { rewarded: { android: 'ca-app-pub-…', ios: 'ca-app-pub-…' } },
  test: isTestAds(process.env.EXPO_PUBLIC_ADMOB_TEST),
});

// 틱톡 — 그룹 이름만 앱마다 다르다
export const tiktok = createTikTok({
  group: 'carrot',
  test: isTestAds(process.env.EXPO_PUBLIC_ADMOB_TEST),
  waitForTracking: () => ads.requestTracking(),   // iOS: ATT 답을 기다린 뒤 켠다(창은 한 번)
  // events: (name, p) => (name === 'harvest_done' && p?.daily ? { custom: 'WeeklyMission' } : null),   // 앱만의 이벤트(선택)
});
ads.setTikTok(tiktok);   // 보상형 광고가 열리면 InAppADImpr 를 패키지가 보낸다

// 앱 루트 — 켤 때 한 번(로그인 전 설치를 잡는다). 인증 없는 공개 설정 조회를 넘긴다
useEffect(() => {
  void ads.requestTracking().then(() => askNotifyOnce());
  tiktok.boot(() => fetchCustomConfig().then((c) => c?.values));
}, []);

tiktok.track('signup_done');   // 가입 → Registration · 'login_done' → Login
tiktok.identify(memberId);     // 로그인 · 세션 복원(회원 번호만)
tiktok.logout();
```

## 틱톡 값표

| 어디 | 칸 | 값 | 비면 |
|---|---|---|---|
| 어드민 앱 설정(custom) | `{그룹}.tiktok_sdk_access` | 이벤트 관리자 App Secret(공용) | 틱톡 꺼짐 |
| 어드민 앱 설정(custom) | `{그룹}.tiktok_android_sdk_access` | 안드 전용 App Secret(다를 때만) | 공용 칸을 쓴다 |
| 어드민 앱 설정(custom) | `{그룹}.tiktok_app_id_ios` | 이벤트 관리자 iOS 앱 ID(**글자**, 19자리) | iOS 꺼짐 |
| 어드민 앱 설정(custom) | `{그룹}.tiktok_app_id_android` | 이벤트 관리자 안드 앱 ID(**글자**) | 안드 꺼짐 |
| app.json `extra` | `appleAppId` | 앱스토어 앱 번호(공개) | iOS 꺼짐 (`createTikTok({ appleAppId })` 로도) |
| app.json `extra` | `androidPackage` | 안드로이드 패키지 이름 | 안드 꺼짐 (`createTikTok({ androidPackage })` 로도) |
| 코드 | `createTikTok({ group })` | 어드민 설정 그룹 이름(예: `carrot`) | — |

- 칸 이름이 `_secret`·`_token` 으로 끝나면 서버가 앱에 안 내려준다(9/22) — 그래서 `_access` · `_id_*` 다. 열쇠는 번들에 굽지 않는다(재발급을 새 빌드 없이).
- 틱톡 앱 ID 는 숫자로 넣으면 자릿수가 깨진다(2^53 초과) — **글자로** 넣는다. 숫자로 오면 무시한다.
- 보내는 이벤트: 설치 · 실행(SDK 자동) · 보상형 광고 열람 `InAppADImpr`(자동) · 가입 `Registration` · 로그인 `Login` · `identify`(회원 번호만) · `logout` · 앱이 `events` 로 더한 것.
- 인앱 결제 자동 추적은 끈다(안드 `disableAutoIapTrack`, Play 결제 라이브러리를 싣지 않아 BILLING 권한이 생기지 않는다).
- 시험 빌드(`test: true`)는 SDK 디버그 모드 — 콘솔에 「[tiktok] on · test event code …」가 찍힌다(이벤트 관리자 › 테스트 이벤트).

## 앱 안 로컬 틱톡 모듈에서 옮길 때

앱에 따로 넣은 `modules/tiktok-business/` · `src/tiktok*.ts` 는 **지운다**(패키지 모듈은 이름이 `JcurveTikTok` 이라 겹치지는 않지만,
둘 다 있으면 같은 이벤트가 두 번 나간다). `expo-build-properties` 의 JitPack 줄은 남겨도 된다(플러그인이 겹치면 건너뛴다).
