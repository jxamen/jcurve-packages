# @jcurve/ads

리워드 앱 공용 **광고** 패키지 — AdMob 보상형 광고 · iOS 추적 허용(ATT) · 광고 식별자 · **틱톡 광고 전환(1.7)**.
「광고는 전부 이 패키지」(2026-10-02 대표님). 앱마다 다른 것은 **설정값**(광고 단위 ID · 어드민 설정 그룹 이름)뿐이다.
왜 이렇게 생겼는지(꼬꼬농장 실기기에서 밟은 것들)는 `src/index.ts` 머리말에 있다.

## 설치

```jsonc
// package.json
"@jcurve/ads": "https://github.com/jxamen/jcurve-packages/releases/download/ads-v1.8.0/jcurve-ads-1.8.0.tgz"
```

```jsonc
// app.json — 1.7 부터. 안드로이드 틱톡 SDK 의 JitPack 저장소를 넣는다
"plugins": ["@jcurve/ads"]
```

앱에 있어야 하는 것: `react-native-google-mobile-ads` · `expo-tracking-transparency` · `expo-updates` · `expo-constants`(Expo 기본).
1.7 은 네이티브 모듈(`JcurveTikTok`)이 들어 있어 **새 빌드**가 필요하다. 모듈이 없는 옛 빌드에 OTA 로 내려가도 틱톡만 조용히 꺼지고 나머지는 그대로 돈다.


## 미디에이션 — 광고 회사 5곳 기본(1.9)

`@jcurve/ads` 1.9 부터 AdMob 미디에이션 어댑터 **앱러빈 · 유니티 · 민티그럴 · 팽글 · 메타(입찰)** 가 같이 들어간다(대표님 10-09).
1.9.1 부터 이 패키지 안(`mediation.plugin.js` · `src/mediation`)에 있다 — 따로 쓰던 `@jcurve/mediation` 은 없앴다(대표님 10-09 「mediation은 없애」). 앱의 react-native-google-mobile-ads 가 고정한 AdMob SDK 판을 올리지 않는 어댑터를 골라
`build.gradle`(민티그럴 · 팽글 maven 저장소 포함) · `Podfile` · iOS `SKAdNetworkItems`(156개)에 넣는다. 런타임 코드는 없다(처음 광고 직전 켜기 · 미리 안 받기 그대로).

1. `package.json` 의 `@jcurve/ads` 를 1.9 릴리스 주소로 올린다. `app.json` 의 `plugins` 에 `"@jcurve/ads"` 가 있어야 한다(1.7 부터 있음).
2. `npx expo prebuild --clean` → **새 스토어 빌드**(네이티브가 바뀐다 — OTA 로는 안 된다). 판 · runtimeVersion 을 올린다.
3. 각 회사 키 · 앱 ID 는 **앱에 넣지 않는다** — AdMob 웹 「미디에이션 그룹」의 매핑에만 넣으면 새 빌드부터 쓰인다.

- 틱톡 비즈니스 SDK(이 패키지의 JcurveTikTok 또는 앱 `modules/*`)가 있으면 안드에서 팽글이 따로 들고 오는 `tiktok-business-android-sdk-comp` 만 빼고 앱의 틱톡 한 벌을 같이 쓴다(중복 클래스 방지).
- 끄기 `["@jcurve/ads", { "mediation": false }]` · 일부만 `{ "mediation": { "networks": ["applovin", "meta"] } }` · 팽글만 빼기 `{ "mediation": { "pangle": false } }`.
- 예전에 `@jcurve/mediation` 플러그인을 적어 둔 앱은 그 줄과 패키지를 지운다(남겨도 표시 사이만 다시 써서 같지만, 패키지는 더 고치지 않는다).

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

## 끝난 결과 하나로 받기 — `play()`(1.8)

앱이 닫힘 뒤 몇 백 ms 에 스스로 「끝까지 보지 않았어요」로 끝내면, 닫힘 **뒤에** 오는 보상(최대 1.2초)을 버린다(2026-10-02 여러 앱의
0.7초 판정). `play()` 는 엔진이 그 대기까지 끝낸 뒤 **결과 하나**만 준다 — 앱은 타이머로 판정하지 않는다.

```ts
const r = await ads.play({ userId, customData, onOpened: () => hideWaiting() });
if (r.busy) return;                       // 이미 다른 광고가 도는 중
if (r.earned) celebrate();                // 보상은 서버 SSV 가 확정, 이건 연출
else toast(r.message ?? '광고를 보지 못했어요');   // r.noAd 면 「잠시 후 다시」, 아니면 중간에 닫음
```

`show()` 와 콜백은 그대로 있다(옛 앱 그대로 돈다).

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
- **꺼져 있으면(어드민 값이 비면) Debug 에서도 로그가 없다** — `start()` 가 조용히 끝난다. 켜졌는지는 `tiktok.isOn()` 이나 「[tiktok] on」 줄로 본다.
  모듈이 실렸는지는 Xcode 로그의 `Registering module 'JcurveTikTok'`(iOS 확인 2026-10-02 앱빌드, 총무님 ea71a35 · Xcode 27).

## 앱 안 로컬 틱톡 모듈에서 옮길 때

앱에 따로 넣은 `modules/tiktok-business/` · `src/tiktok*.ts` 는 **지운다**(패키지 모듈은 이름이 `JcurveTikTok` 이라 겹치지는 않지만,
둘 다 있으면 같은 이벤트가 두 번 나간다). `expo-build-properties` 의 JitPack 줄은 남겨도 된다(플러그인이 겹치면 건너뛴다).
