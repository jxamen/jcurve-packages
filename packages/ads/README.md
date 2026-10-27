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

## 언어 — `lang`(1.9.2)

실패 안내(`onFail` 의 글 · `play()` 의 `message`)를 앱이 정한 언어로 낸다.

```ts
export const ads = createRewarded({ units, test, lang: 'en' });
ads.setLang('en');   // 켠 뒤 바꿀 때 — 다음 광고부터
```

**언어는 앱이 넘긴다** — 패키지는 기기 언어를 읽지 않는다. 없거나 `'ko'` 면 지금과 바이트까지 같은 한국어.
안내 글자를 비교하는 앱 코드는 영어에서 어긋나니 `noAd` · `earned` 로 가른다. 언어 추가는 `src/i18n/locales/<언어>.ts` + `locales/index.ts` 한 줄.

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


## TabBarBanner — 첫 광고를 더 빨리: 미리 요청 + 빠른 재시도 (1.9.14, 대표님 10-21 00:50 「광고 로딩이 너무 느려」)

두 가지로 첫 표시까지의 시간을 줄인다. **화면 · 높이 · 광고 단위 · 영상은 버린다는 정책은 그대로.**

**① 슬롯이 붙기 전에 첫 요청을 미리 보낸다 — `prefetchTabBarBanner(unitId)`**
```ts
import { prefetchTabBarBanner } from '@jcurve/ads';

// 앱 시작 때 한 번 — 앱의 광고 시작(iOS 는 ATT 답) 뒤, 슬롯에 줄 것과 같은 unitId 로
void ads.requestTracking().then(() => prefetchTabBarBanner(NATIVE_TAB_UNIT));
// …나중에 슬롯이 붙으면(원격 설정을 읽은 뒤 등) 받아 둔 광고가 바로 보인다
<TabBarBanner enabled={remoteOn} unitId={NATIVE_TAB_UNIT} format="native" />
```
- **광고 SDK 를 시작한다**(슬롯과 같다) — iOS 는 앱의 ATT 답 **뒤에** 부른다(안 그러면 SDK 가 답보다 먼저 켜져 식별자 없이 시작한다).
- 첫 소재 **하나만** 받아 둔다. 영상이면 슬롯과 같이 버리고 빠른 재시도(1 · 3 · 10 · 30초)를 돈다. 슬롯이 붙으면 그 소재를 그대로 넘겨받아 **요청 없이 바로 보이고**(`onState` 에 `loaded`), 그 뒤는 평소처럼 1분마다 교체한다. 요청 중에 붙으면 그 답을 기다려 보인다(요청을 또 보내지 않는다).
- 슬롯이 안 붙으면: 소재는 **30분**(`NATIVE_HOLD_TTL_MS`) 뒤 버린다(오래 둔 광고는 못 쓸 수 있다). 빠른 재시도를 다 쓰고도 못 받았으면 **멈춘다**(분당 요청을 돌리지 않는다) — 나중에 붙는 슬롯이 스스로 묻는다. 광고가 꺼져 있는 앱(원격 off)은 부르지 않는 게 맞다(마지막으로 받아 둔 설정값으로 판단하거나, 켜짐 설정이 온 뒤에 부른다).
- 같은 단위로 두 번 부르거나 그 단위 슬롯이 이미 붙어 있으면 아무것도 안 한다. 웹 · 광고 SDK 없음 · 단위 없음도 조용히 넘어간다. 던지지 않는다.

**② 첫 시도가 영상 · 채움 없음이면 빠른 재시도를 앞당겼다**: 1 · 3 · 10 · 30초 뒤(예전 3 · 10 · 30 · 60초), 그 뒤는 앱이 앞에 있는 동안 60초마다(1.9.12 그대로). 첫 광고를 받기까지 **빠른 재시도 구간이 103초 → 44초**로 줄었다.

⚠ **한계 (솔직히)**: 꼬꼬 단위처럼 **영상 소재가 대부분 오는 단위**는 미리 · 빨리 물어도 비는 시간이 남는다(실단위 시뮬에서 영상이 연달아 4번 와서 버려졌다). 이 변경은 **요청을 일찍 · 촘촘히 보낼 뿐** 영상을 안 오게 하지는 못한다. 영상이 안 오게 하는 요청 옵션은 SDK(16.3.4)에 없다 — 광고 단위 설정 쪽 결정이다. 요청 수는 늘어난다(빠른 재시도 구간에 5번, 그 뒤 분당 1번).

## TabBarBanner — 영상만 올 때도 포기하지 않는다 (1.9.12, 대표님 10-20 23:00 「꼬꼬 홈이 계속 빈칸」)

**1.9.11 까지**: native 한 줄이 첫 요청 + 빠른 재시도(그때는 3 · 10 · 30 · 60초)까지 영상 소재만 받으면 그 화면에서는 **영영 포기**해서 홈이 계속 비었다. 자리는 1.9.8 부터 고정이라 늦게 와도 탭 줄이 움찔하지 않으니, **포기하지 않는다**.
- **빠른 재시도가 끝나도 앱이 앞에 있는 동안 60초(`NATIVE_REFRESH_MS`)마다 계속 요청한다.** 영상이 아닌 소재가 오면 바로 보이고, 그 뒤는 예전처럼 60초마다 교체.
- **앱이 뒤로 가 있는 동안은 멈춘다**(`AppState` 의 `background` · `inactive`). 뒤에서 때가 된 요청은 잃지 않고 보류했다가, **앞으로 돌아오면** — 자리가 **비어 있으면 즉시 한 번**, 광고가 떠 있으면 요청 없이 교체 주기만 이어 간다. 요청은 마지막 요청에서 **10초(`NATIVE_MIN_GAP_MS`)** 이상 지난 뒤에만 나가서, 앱을 오가도 요청이 쏟아지지 않는다. 요청이 아직 답을 기다리는 중이면 두 번째를 보내지 않고, 광고 SDK 초기화가 끝나기 전에는 앱 상태 변화로 아무것도 시작하지 않는다.
- **`onState`**: 옛 `retries-exhausted` 는 **`waiting`** 으로 바뀌었다 — 빠른 재시도를 다 쓴 직후 **한 번만** 알리고, 그 뒤에도 `requesting` · `video-dropped`/`no-fill` · `loaded` 는 계속 알린다(`tries` 는 계속 올라간다).
- 자리 높이 · 모양 · 정책 처리(영상은 여전히 버린다)는 그대로. banner(BannerAd) 형식은 SDK 가 알아서 하므로 **그대로**이고 앱 상태도 듣지 않는다. 새 네이티브 0.
- ⚠ 요청이 늘어나는 만큼 광고 요청 수가 늘어난다: 앱이 앞에 있고 계속 영상만 오는 화면은 분당 1회. 실기기 · 운영 숫자는 시험판 이후 확인이 필요하다.

## TabBarBanner — native 줄에 CTA 버튼 (1.9.10, AdMob 정책 필수 요소)

AdMob 네이티브 광고 정책 표(`support.google.com/admob/answer/6329638`, 2026-10-20 확인)는 **Ad badge · Title · Call to action 을 Required**, Icon 을 「Required if provided」로 적고, 「The native app install ad must include a call to action button that users can click to download/install the app. You can display an app download icon instead of a button or text」, 「The background of the ad must be not clickable (no clickable "white space")」라고 한다. 1.9.9 까지 native 한 줄은 AD 배지 · 아이콘 · 제목뿐이라 **CTA 가 빠져 있었다.**

**1.9.10**: `format="native"` 의 40dp 한 줄 오른쪽 끝에 **작은 CTA 버튼**(`NativeAsset CALL_TO_ACTION`)을 더한다.
- **글자** = 광고의 `callToAction`, **비어 있으면 「설치」**(앱 언어 `lang="en"` 이면 「Install」). 앞뒤 공백은 자른다. 함수 `nativeCtaLabel(callToAction, lang)` 도 내보낸다.
- **모양**: 짙은 회색(`#555`) 바탕 + 흰 글자 12pt 굵게, 한 줄, 폭 최대 96. **버튼은 줄어들지 않고(`flexShrink: 0`) 제목이 줄어든다**(긴 문구에 밀려 CTA 가 잘리지 않게). 양옆 28 여백은 그대로 — AdChoices 가 기본으로 **오른쪽 위**에 붙으니 CTA 와 겹치지 않게 비워 둔다. 줄은 여전히 가운데 정렬(10-19 대표님), CTA 가 묶음의 오른쪽 끝이다.
- **높이 40 불변**(바깥 자리 · NativeAdView · 줄 모두). banner(BannerAd) 형식은 SDK 가 그리므로 **그대로**. 새 네이티브 0.
- **배경 · 빈 자리는 눌리지 않는다**: 눌림은 SDK 가 **등록된 자산**(아이콘 · 제목 · CTA)과 AdChoices 에만 건다. NativeAdView · 줄 · AD 배지는 자산으로 등록하지 않았고, Pressable · 터치 핸들러도 달지 않았다(시험으로 고정). 영상 소재는 위 1.9.9 와 같이 버리므로 MediaView 가 필요 없다.
- ⚠ **실기기 눌림은 이 PC 에서 못 봤다.** 구조(어느 뷰가 자산인가)는 시험으로 보장하지만, 실제 눌림 처리는 구글 SDK 몫이다 — 시험판에서 **CTA · 제목 · 아이콘을 눌러 광고가 열리는지**, **배지 옆 빈 자리를 눌러도 아무 일 없는지**, 좁은 폰(폭 360)에서 CTA 가 AdChoices 와 겹치지 않는지 한 번 봐 주세요.

## TabBarBanner — 왜 비었는지 보기 `onState` (1.9.9, 대표님 10-20 21:39 「꼬꼬농장 배너 광고가 안 나와」 진단용)

선택 prop **`onState?(s: TabBarBannerState)`** — 슬롯이 채워지는 **과정**을 앱에 알려 준다. **동작 · 높이 · 시각은 그대로**(콜백만 더함, 안 주면 아무 일도 없다), 새 네이티브 0. 콜백이 던져도 무시한다. 렌더마다 새 함수를 넘겨도 로더가 다시 시작되지 않는다(늘 최신 콜백을 부른다). 언마운트 뒤에는 부르지 않는다.

| `state` | 뜻 |
|---|---|
| `requesting` | 요청을 보냈다(native 는 시도마다, banner 는 BannerAd 를 붙일 때) |
| `loaded` | 광고가 화면에 있다 |
| `video-dropped` | **영상 소재가 와서 버렸다**(아래 「영상은 왜 버리나」) |
| `no-fill` | 요청이 실패했거나 광고가 없다 — `error` 에 SDK 메시지(`코드: 메시지`, 200자까지) |
| `waiting` | native 가 빠른 재시도(1 · 3 · 10 · 30초)를 다 썼다 — 이제 **앱이 앞에 있는 동안 60초마다** 계속 묻는다(1.9.12). 그 시도의 `video-dropped`/`no-fill` **바로 뒤**에 한 번만 알린다(옛 이름 `retries-exhausted` 는 1.9.12 에서 이것으로 바뀌었다) |
| `init-failed` | 광고 SDK 초기화 실패 |

`tries` = 마지막 `loaded` 이후 보낸 요청 수(첫 요청 = 1, banner 는 1). 광고가 떠 있는 동안 갱신 요청이 실패하면 `no-fill`/`video-dropped` 만 알리고(포기 아님) 광고는 그대로 둔다.

```tsx
<TabBarBanner unitId={u} format="native" enabled={on}
  onState={s => log('tabbanner', s.state, s.tries, s.error)} />   // 서버 로그 · 개발 화면 등 앱이 정한 곳으로
```
꼬꼬식 판별: `requesting → video-dropped → … → waiting` 면 **영상 소재가 계속 와서** 비는 것, `no-fill` 이면 AdMob 이 채우지 못한 것(`error` 확인), `init-failed` 면 SDK 쪽이다.

**영상은 왜 버리나** (정책 근거, 2026-10-20 AdMob 네이티브 광고 정책 페이지 `support.google.com/admob/answer/6329638` 확인):
- 필수 요소 표에서 영상 광고는 **「Video (for video ads) — Required」**(영상 광고에 한해 표시 필수)이고, 「MediaView is required to render the main video asset in an ad.」 영상용 MediaView 는 **120×120dp 이상**이어야 한다(그보다 작으면 영상 광고가 안 나간다고 적혀 있다).
- 40dp 한 줄 슬롯은 영상을 규정대로 그릴 수 없다. 그래서 **영상 소재를 아이콘 · 제목만으로 보여 주는 것은 정책상 맞지 않아** 지금처럼 버리고 다시 요청한다. **영상만 오는 동안은 자리가 비어 있는 것이 설계**다(1.9.12 부터는 포기하지 않고 계속 다시 묻는다) — 영상까지 보이려면 120dp 이상의 MediaView 를 가진 더 큰 카드가 필요하다(이 슬롯의 일이 아니다).
- 반대로 **영상이 아닌 소재**는 같은 표에서 이미지가 「Recommended」(권장)이고 「A main video or image asset is not required.」라 아이콘 · 제목만으로 보여도 된다.

## TabBarBanner — 자리 고정 (1.9.8, 대표님 10-20 21:22)

> 「탭 메뉴 아래 광고가 나오는데, 광고가 나오면 메뉴가 위로 툭 올라가. 광고 자리를 고정해 두고 광고만 나왔으면 좋겠어.」

**1.9.7 까지** 는 광고가 오기 전·실패일 때 높이 0 이었다가(`No fill means no space`) 광고가 오면 0 → 높이로 커져서 **탭 줄이 밀려 올라갔다.** **1.9.8 부터** 광고 자리를 **처음부터 고정 높이 View 한 개**로 그린다 — 광고는 그 안에서만 나타난다.

- **바깥 높이는 mount 뒤 어떤 상태에서도 안 바뀐다** — 로드 전 · SDK 초기화 중 · 실패(`onAdFailedToLoad`) · 영상 광고 거름 · 계속 묻는 중 · 광고 교체 중 모두 같은 높이. 빈 자리는 배경색(`backgroundColor`)만 보인다.
- **`backgroundColor`**(기본 `'#fff'`): 빈 자리 색. **앱 탭바 색을 넘기면** 빈 자리가 눈에 안 띈다. 예: `<TabBarBanner unitId={u} enabled={on} backgroundColor={theme.tabBar} />`.
- **native**(`format="native"`): 높이 **40** 고정(`NATIVE_SLOT_HEIGHT`) — 예전에도 광고 높이가 40 이었고, 이제 자리를 먼저 잡는다.
- **banner**(기본, ANCHORED_ADAPTIVE): 높이를 **화면 폭으로 미리 계산**해 고정한다 — `bannerSlotHeight(width, height)` =
  `ceil(폭 × 50 / 320)` 를 **[50, min(90, 화면 높이의 15%)]** 로 자른다. 예) 폭 360 → 57, 390 → 61, 412 → 65, 태블릿 → 90, 가로 모드 844×390 → 58.
  - **근거**: 구글 문서는 앵커 적응형 배너가 「320×50 표준 배너와 비슷한 고정 가로세로 비」를 쓰고, 높이는 **50 이상 · 기기 높이의 15% 이하**(Unity 안내는 90 상한도 적음)라고만 적고 **공식 계산식은 공개하지 않는다.** 그래서 위 값은 **추정**이다.
  - SDK 가 실제로 주는 높이가 추정과 몇 dp 달라도 **바깥 높이는 안 바뀐다** — 광고를 가운데 두고 `overflow: hidden` 으로 자른다(작으면 위아래에 배경색 여백, 크면 가장자리가 조금 잘림). 올림(`ceil`)이라 대개 여백 쪽이다.
  - 실기기에서 실제 높이를 재면 **`bannerHeight={실제값}`** 으로 넘겨 맞춘다(native 에는 무시). 모르면 안 넘겨도 된다.
- **자리가 0 인 경우**(옛날과 같음): `enabled=false` · `unitId` 없음 · 웹 · 광고 SDK 없음(Expo Go) → `null`, 자리도 없다. 원격으로 끈 앱은 자리도 없다.
- **`enabled` 가 false → true 로 바뀌는 순간**에는 자리가 한 번 생긴다(탭 줄이 한 번 올라감). 앱에서 막으려면 **원격 설정이 오기 전에는 마지막으로 받은 값**(AsyncStorage 등에 저장해 둔 `enabled`)을 첫 값으로 쓰고, 값이 같으면 아무것도 안 바뀐다. 처음 설치라 저장값이 없으면 `false` 로 시작해 한 번만 생기는 건 어쩔 수 없다.
- 새 네이티브 의존 0 — `react-native` 의 `View` · `Dimensions` 만 더 쓴다. 보상형·ATT·틱톡·미디에이션 동작은 그대로. 1.9.5 는 금지판이라 1.9.6 이상에서 올라온다.

아래는 1.9.3 에 쓴 기본 사용법이다(「zero height」 문장은 위 1.9.8 로 대체됨).

## TabBarBanner (1.9.3)

Place `<TabBarBanner unitId={existingUnit} enabled={remoteOn} />` immediately after the tab row,
inside a footer above the app's bottom safe-area inset. `enabled` should default to false.
The default `format="banner"` uses the SDK anchored adaptive BannerAd, including SDK attribution.
For an existing **native** unit use `format="native"`: a 40dp single-line NativeAdView with icon/headline,
SDK AdChoices, and the mandatory AD attribution (native SDK does not supply attribution text).
Never send a native unit ID to BannerAd. Video-only native responses are destroyed without retries.
(1.9.8: only disabled / missing-unit / web / no-SDK occupy zero height — pending and failed requests keep the fixed slot.) Unmount destroys native ads;
a late response after unmount is destroyed too. Existing SDK test device configuration is retained.
Pass a Google test unit from the app's existing test-mode logic when appropriate.
No native module, plugin, reward, frequency or mediation changes are required relative to 1.9.2.

## ATT 안내 — `AttDeniedSheet` · `ensureTrackingBeforeOfferwall`(1.9.5 → 1.9.11 개편 → **1.9.13 가운데 팝업**, 대표님 10-21 00:20 · 애플 심사 대비)

> 1.9.6: `expo-tracking-transparency` 는 네이티브(`ExpoTrackingTransparency`)가 바이너리에 있는지 **먼저 본 뒤에만** require 한다(`src/native.ts`, @jcurve/steps 0.1.1 과 같은 방식). 없으면 안내는 안 뜨고 함수는 던지지 않고 돌아온다.

애플은 ATT 동의를 **조건이나 대가로 삼는 것**을 허용하지 않고(5.1.2(i)), 시스템 창 **앞에 설명을 보여 주는 것**은 투명하게 하면 허용한다(5.1.1(iv)) — 앱관리가 인용한 애플 개발자 FAQ(`developer.apple.com/app-store/user-privacy-and-data-use`) 기준이다. 그래서 안내는 **두 가지**이고, **어느 쪽도 오퍼월 진입을 막지 않는다.**

| 상황 | 앱을 켤 때 (`ads.requestTracking()`) | 오퍼월 · 미션을 누를 때 (`ensureTrackingBeforeOfferwall()`) |
| --- | --- | --- |
| **미정** | 중립 안내(한 번) → 시스템 ATT 창 | 중립 안내(이미 봤으면 생략) → 시스템 ATT 창 |
| **거부 · 제한** | **아무것도 안 뜬다** | **가운데 팝업(하루 한 번)** → 어느 버튼이든 이어서 진입 |
| 허용 | 아무것도 안 뜬다 | 바로 진입 |
| Android · 모듈 없음 | 아무것도 안 한다 | 바로 진입 |

```tsx
import { AttDeniedSheet, ensureTrackingBeforeOfferwall } from '@jcurve/ads';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 앱 루트에 한 번 — 붙이는 것만으로는 아무것도 뜨지 않는다(호출이 있을 때만 열린다).
// storage 를 주면 「하루 한 번」이 앱을 껐다 켜도 지켜진다(안 주면 껐다 켜면 다시 한 번 뜬다)
<AttDeniedSheet storage={AsyncStorage} />

// 오퍼월 · 참여형 미션에 들어가기 전 (앱을 켤 때 ATT 는 기존대로 ads.requestTracking())
const status = await ensureTrackingBeforeOfferwall();
openOfferwall();   // ⚠ status 가 무엇이든 연다 — 돌려주는 값으로 오퍼월을 막지 않는다
```

### 돌려주는 값 — 오퍼월을 막는 분기를 두지 않는다 (1.9.13)

`ensureTrackingBeforeOfferwall()` 은 **오퍼월을 열어도 되는지**를 돌려준다. 어떤 값이 와도 연다 — 값은 참고용이다.
- `granted` · `unavailable`(Android · 모듈 없음) · `unknown`(읽기 실패): 그대로.
- **`proceed`** (새 값): 추적이 꺼져 있다(거부 · 제한 — 시스템 창에서 방금 거부한 경우 포함). **그래도 오퍼월은 열어도 된다**는 뜻이다. 옛 값 `denied` · `restricted` 는 더 이상 돌려주지 않는다.
- ⚠ **앱 쪽**: 예전에 `denied`/`restricted` 면 오퍼월을 안 열던 분기가 있으면 **지운다.** (`status !== 'granted'` 로 막는 분기도 지운다 — `proceed` 가 오기 때문이다.)

### 안내 문구 (확정)

**① 시스템 창 앞 중립 안내** (`ATT_PRIMER_TEXTS`, 상태가 **미정일 때만 · 한 번 · 버튼 하나 · 닫기 없음**, 가운데 카드)
- 제목 「다음 화면에서 앱 추적 허용 여부를 물어봐요」
- 본문 「허용하면 앱 사용 기록이 광고와 참여형 미션 참여 확인에 쓰여요. 허용하지 않아도 앱은 그대로 이용할 수 있어요.」
- 버튼 「계속」 → 안내가 사라진 뒤(0.4초) 곧바로 시스템 창.
- 시스템 창을 흉내 내지 않고(허용/거부 두 버튼 없음), 닫거나 건너뛴 뒤 다시 묻지 않으며, 거부된 뒤에는 뜨지 않는다. 앱이 `primerTexts` 로 문구를 덮어쓸 수 있다.

**② 추적이 꺼져 있을 때의 가운데 팝업** (`ATT_DENIED_TEXTS`, **오퍼월 진입 + 거부/제한일 때만 · 하루 한 번**)
- 제목 「추적이 꺼져 있어요」
- 본문 「추적이 꺼져 있으면 일부 미션은 참여 확인이 안 될 수 있어요. 원하시면 설정에서 켤 수 있어요.」
- 버튼 「그냥 보기」 · 「설정 열기」 — **같은 모양 · 같은 크기**(한쪽으로 몰아가지 않는다).
  - 「그냥 보기」: 닫고 바로 이어서 진입.
  - 「설정 열기」: `Linking.openSettings()` 로 설정 앱에 가고, **앱이 다시 앞으로 돌아오면** 이어서 진입한다(설정 앱으로 못 넘어갔으면 2초 뒤에 이어서). 돌아와서 켜져 있으면 `granted`.
- **하루 한 번**: 기기 로컬 날짜 기준. 오늘 이미 봤으면 팝업 없이 바로 진입. 앱을 껐다 켜도 지키려면 `<AttDeniedSheet storage={AsyncStorage}>` 로 저장소를 준다(없으면 실행 안에서만 센다). 날짜는 팝업을 띄우기 **전에** 적는다.
- 앱을 켤 때 · 홈 · 루트 마운트로는 **절대** 열리지 않는다. 앱이 `deniedTexts` 로 문구를 덮어쓸 수 있다.
- 대가 · 압박 말 없음, 업체 이름 없음(시험이 소스 · 빌드 결과 · 번역표를 스캔한다). 1.9.11 의 5단계 시트 문구는 번들에서 지웠다.

### 앱 팝업 모양 — `renderPopup` (1.9.14)

문구 · 버튼 · 동작(하루 한 번 · 진입을 막지 않음 · 중립 안내는 한 번)은 **패키지가 그대로 정하고, 모양만 앱 것**으로 그릴 수 있다. 안 주면 기본 흰 카드.
```tsx
<AttDeniedSheet storage={AsyncStorage} renderPopup={(p) => <AppPopup {...p} />} />
// p = { kind: 'primer' | 'denied', title, body, buttons: [{ label, onPress }] }
```
- 안내가 열려 있는 동안에만 불리고(닫히면 더는 안 불린다), 돌려준 요소(보통 앱의 Modal 팝업)를 그린다. 훅을 쓰려면 함수 안이 아니라 **컴포넌트**를 돌려준다(위 예).
- `primer`(시스템 창 앞): 버튼 하나 — 닫기 · 건너뛰기를 만들지 않는다. `denied`(추적이 꺼져 있을 때): 버튼 둘 **「그냥 보기」 · 「설정 열기」(이 순서)** — 같은 비중으로 그린다. 버튼의 `onPress` 를 그대로 부르면 된다.
- **오퍼월 화면 위에는 띄울 수 없다**: 오퍼월은 RN 화면이 아니라 SDK 가 네이티브 전체 화면으로 올린다(iOS 루트 뷰컨트롤러에서 present, Android 는 Activity 시작). RN 팝업은 그 위로 못 올라가고, 팝업이 떠 있는 동안 SDK 가 올리면 iOS 가 실패한다. 그래서 **진입 전에 보이고, 사라진 뒤(0.4초)에 오퍼월이 이어서 열린다**.

### 기본 카드 — 큰 글자에서도 화면 안에 (1.9.15)

`renderPopup` 을 안 주면 그리는 **기본 흰 카드**(중립 안내 · 꺼짐 팝업 모두)는 iOS 접근성 최대 글자(본문 약 ×3.1)에서 제목 · 본문이 길어져
카드가 화면 높이를 넘었다 — 키 작은 폰(667pt)에서는 위 · 아래가 잘리고, 중립 안내는 닫을 수 없는데 **「계속」 버튼이 화면 밖**으로 밀렸다.
- 제목 · 본문은 **스크롤 영역**(`ScrollView`)에 넣고, 버튼은 그 **밖 바닥에 고정**한다 — 글이 길어도 버튼은 늘 보이고 눌린다.
- 카드는 `maxHeight: '100%'` + 위 · 아래 여백 64(노치 · 다이내믹 아일랜드 ~59 · 홈 인디케이터 ~34 밖, `CARD_EDGE`) 안에 머문다.
- **모양 · 문구 · 닫기 규칙은 그대로**: 글이 짧아 다 들어가면 1.9.14 와 같은 모양이다(스크롤 영역은 내용 높이만큼만 차지한다). 중립 안내는 여전히 닫기 · 뒤로가기로 건너뛸 수 없다.
- `renderPopup` 으로 자기 팝업을 그리는 앱은 영향이 없다(그 팝업의 큰 글자 처리는 앱 몫). JS 만 바뀌어 OTA 로 나간다(네이티브 변경 없음 · 1.9.14 와 같은 런타임에서 교체 가능).

### `AttDeniedSheet` props

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `storage` | `{ getItem(key), setItem(key, value) }` | 아니오 | 가운데 팝업을 띄운 날을 적어 둘 곳(예 AsyncStorage) |
| `theme` | `{ background?, text?, subText?, primary?, primaryText?, overlay? }` | 아니오 | 색 토큰. 빠진 것은 기본 색 |
| `primerTexts` | `Partial<{ title, body, button }>` | 아니오 | 중립 안내 문구 덮어쓰기. 빠진 항목은 `ATT_PRIMER_TEXTS` |
| `deniedTexts` | `Partial<{ title, body, openSettings, proceed }>` | 아니오 | 가운데 팝업 문구 덮어쓰기. 빠진 항목은 `ATT_DENIED_TEXTS` |
| `renderPopup` | `(p) => ReactNode` | 아니오 | **(1.9.14) 앱이 자기 팝업 모양으로 그린다** — 아래 「앱 팝업 모양」 |
| `appName` · `texts` | — | 아니오 | **쓰이지 않는다**(옛 단계 시트용 — 옛 호출 코드가 그대로 컴파일되도록 남김) |

문구는 한국어 하나다(다국어 표 없음) — 영어 앱은 `primerTexts` · `deniedTexts` 로 넘긴다. `ATT_SHEET_TEXTS`(옛 단계 시트 문구)는 이름만 남고 값은 모두 비어 있다.

### 알아 둘 것
- **`<AttDeniedSheet />` 를 안 붙인 앱**은 안내가 없다: 중립 안내와 팝업을 건너뛰고, 시스템 ATT 창은 예전처럼 바로 묻는다.
- 중립 안내는 **이번 실행 안에서 한 번**이다. 시스템 창에 한 번 답하면(허용 · 거부) 그 뒤로는 다시 뜨지 않는다.
- 안내가 사라지는 0.4초를 기다린 뒤에 시스템 창을 올린다 — 겹치면 iOS 가 뒤의 것을 놓친다.
- 새 네이티브 0 · 권한 · Info.plist 변경 없음(OTA). **앱 쪽 확인**: `NSUserTrackingUsageDescription`(시스템 창의 설명 글)에도 이익을 내세우는 말이 없는지 한 번 봐 주세요 — 심사관이 보는 글이다(이 패키지 밖).
