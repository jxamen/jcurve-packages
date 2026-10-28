# @jcurve/offerwall

애드팝콘 서버 보상 오퍼월 공용 패키지. 앱은 입구 버튼과 안내 화면을 만들고, 실제 지급은 서버 콜백에서만 한다. `react-native-adpopcorn-reward@1.0.0`(Android 9.2.6 / iOS 5.2.3)을 사용한다.

`@jcurve/mission`과 같은 `packages/<이름>/src`, `dist`, 타입 선언 구조다. `dist`를 커밋하고 추후 승인된 릴리스 작업에서 `offerwall-v0.1.0/jcurve-offerwall-0.1.0.tgz` 형태의 GitHub Release 파일로 배포한다. **이번 작업은 커밋만 하며 릴리스·npm publish를 하지 않는다.**

## 앱별 연동 순서

1. 애드팝콘에 Android/iOS 앱을 등록하고 앱키·해시키·콜백 발신 IP(선택)를 받는다. 애드팝콘 어드민은 **자체 서버**로 설정한다. 서버의 해당 앱 `app_configs` 키 `adpopcorn`에 `{"android":{"mediaKey":"","hashKey":""},"ios":{"mediaKey":"","hashKey":""},"callbackIps":[]}`를 준비하고 어드민 앱 관리 → 앱 설정 → 애드팝콘에서 OS별 매체 키·해시 키를 채운다. 콜백 URL은 `https://api.j-curve.co.kr/v1/offerwall/adpopcorn/callback/{app}`. 서버 DB 준비는 서버의 `docs/adpopcorn.md` 참고.
2. 앱에 이 패키지와 SDK를 설치한다. 현재는 로컬 검토용 경로 또는 로컬 `npm pack` 결과로 설치한다. 릴리스가 없으므로 아래 GitHub 릴리스 주소를 지금 의존성에 넣지 않는다.

   ```sh
   # 패키지 저장소에서 로컬 설치 파일 만들기 (publish 아님)
   npm run build --workspace @jcurve/offerwall
   npm pack --workspace @jcurve/offerwall --pack-destination /tmp
   # 대상 앱 폴더에서
   npm install /tmp/jcurve-offerwall-0.1.0.tgz react-native-adpopcorn-reward@1.0.0 expo-constants
   ```

   SDK는 **키가 비어 있는 빌드에서도 설치**한다(Metro는 정적인 require 경로를 해석한다). SDK가 없는 구형 바이너리/Expo Go에서는 네이티브 모듈을 열지 않고 `준비 중`을 반환한다. SDK의 RN New Architecture 지원 여부는 대상 앱 빌드에서 확인한다.
3. `app.json`에 플러그인을 등록한다. 아래 appKey/hashKey는 **Android 매체 값만** 로컬/빌드 설정에서 주입한다. iOS 키는 빌드 설정에 넣지 않는다. 실제 값은 커밋하지 않는다.

   ```json
   {
     "expo": {
       "plugins": [["@jcurve/offerwall", {
         "appKey": "",
         "hashKey": "",
         "trackingPermission": "맞춤형 광고와 참여 보상 확인을 위해 광고 식별자를 사용합니다."
       }]]
     }
   }
   ```

   Android는 두 값이 있어야 AndroidManifest의 `adpopcorn_app_key`, `adpopcorn_hash_key`, `adpopcorn_reward_server_type=server`를 넣는다. RN SDK 1.0.0 Android의 setAppKey는 미지원이므로 서버 키로 런타임 교체할 수 없다. Android 키 변경에는 새 빌드가 필요하다.

   iOS는 키가 비어 있어도 플러그인이 ATT 설명과 `useAdPopcornRewardServer=false`를 추가한다. 서버 API에서 받은 iOS mediaKey/hashKey를 JS가 `setAppKey`에 전달하고 SDK 로그를 끈다. iOS는 Expo extra/플러그인에 든 Android 키를 읽지 않는다.

   앱 설정/로그인 초기화에서 아래를 먼저 await한 다음 오퍼월 화면을 마운트한다. 기존 앱 HTTP 클라이언트를 쓸 때도 응답을 로깅하지 않는다.

   ```ts
   import { initializeOfferwall, resetOfferwall } from '@jcurve/offerwall';
   const result = await initializeOfferwall({
     configUrl: `https://api.j-curve.co.kr/v1/${appSlug}/content/config/adpopcorn`,
     headers: { 'X-App-Token': appToken },
   });
   // result.ok이면 오퍼월 화면을 마운트한다. 로그아웃/앱 전환 때:
   resetOfferwall();
   ```

   서버 키는 메모리에만 둔다. 요청 실패·누락 키는 `not_ready`이며 이전 iOS 키를 재사용하지 않는다. reset 이후 도착한 이전 응답도 무시한다. SDK 초기화 응답·키는 로그에 출력하지 않는다.
4. 로그인 후 기존 앱/회원 인증 헤더로 `GET /v1/{app}/offerwall/adpopcorn/usn`을 호출한다. 응답의 64자 `usn`을 그대로 사용한다. 전화번호·이메일·광고 ID·회원 번호를 대신 보내거나 앱에서 별칭을 생성하지 않는다. 로그아웃·계정 변경 시 저장한 usn을 버리고 새로 받는다.
5. 진입 직전에 현재 회원 usn을 전달한다. 닫힘 훅에서는 서버의 잔액·참여 내역을 다시 조회한다. SDK 완료/닫힘 이벤트로 포인트를 직접 지급하지 않는다.

   ```tsx
   import { openOfferwall, getOfferwallTotalRewardInfo, useOfferwallClosed } from '@jcurve/offerwall';

   function OfferwallButton({ usn, refreshBalance }) {
     useOfferwallClosed(refreshBalance);
     const open = () => {
       const result = openOfferwall({ usn });
       if (!result.ok) alert(result.message); // 키 미설정: 준비 중
     };
     // 앱의 기존 Button 컴포넌트에서 open 호출
   }

   const result = await getOfferwallTotalRewardInfo({ usn });
   if (result.ok && result.info?.queryResult) {
     // info.totalCount, info.totalReward: 안내용 적립 가능량, 잔액이 아님
   }
   ```
6. `expo prebuild`와 iOS pods/Android Gradle을 포함한 **새 네이티브 스토어 빌드가 필요**하다. Expo Go/OTA만으로 SDK를 추가할 수 없다. 키·ATT 문구·서버 모드 같은 네이티브 설정 변경도 새 빌드가 필요하다. 이미 같은 SDK/네이티브 설정을 담은 바이너리에서 JS 화면만 바꾸는 경우에는 기존 OTA 정책을 적용할 수 있다. 이 작업에서는 prebuild, 스토어 빌드, 배포를 실행하지 않았다.

## API

- `openOfferwall({usn})`: 동기 결과 `{ok:true}` 또는 `{ok:false,reason,message}`. 성공은 SDK 열기 요청을 보냈다는 뜻이다.
- `getOfferwallTotalRewardInfo({usn,timeoutMs?})`: 이벤트 응답까지 대기(기본 10초), 구독 정리. `{ok:true,info:{queryResult,totalCount,totalReward}}`. 한 번씩 순차 조회한다.
- `onOfferwallClosed(callback)`: 구독 해제 함수를 반환한다.
- `useOfferwallClosed(callback)`: React hook, 언마운트 시 해제. 앱 루트처럼 유지되는 화면에서 등록한다.
- `initializeOfferwall({configUrl,headers})`: 서버 설정 API를 읽고 OS별로 초기화한다. iOS 기본 경로다.
- `resetOfferwall()`: 메모리 설정과 진행 중 요청을 무효화한다. 로그아웃·앱 전환 시 호출한다.
- `configureOfferwall({appKey,hashKey,title?,color?})`: 별도 HTTP 클라이언트로 받은 iOS 키를 명시 주입하는 bare RN용. 빌드 키를 넣는 용도로 쓰지 않는다. Android Expo 기본은 플러그인의 Android 값만 읽는다. bare RN은 네이티브 서버 모드/키/ATT 설정을 직접 적용해야 한다.

키 없음, Expo Go/미연결 네이티브 모듈, 웹에서는 SDK를 호출하지 않고 `준비 중`을 반환한다. 테스트는 실제 키 없이 실행한다.

```sh
npm run build --workspace @jcurve/offerwall
npm test --workspace @jcurve/offerwall
```

SDK 원본의 `openBridge`, `openCSPage`, `AdPopcornRewardNativeAd`는 필요한 앱에서 SDK API로 별도 사용할 수 있다. 본 패키지의 기본 진입은 오퍼월·조회·닫힘 훅이다. 해당 SDK 직접 호출에도 먼저 서버 usn과 iOS 앱키를 설정해야 한다.

공식 근거: [Android 설정](https://adpopcorn.notion.site/46f86f37c5274f1cb3f6961907ac5177), [iOS Swift 설정](https://adpopcorn.notion.site/ecb9c53764eb4cbb9d02363e7e6e52d1), [RN 1.0.0 원본](https://unpkg.com/react-native-adpopcorn-reward@1.0.0/src/index.ts), [공식 SDK](https://github.com/IGAWorksDev/AdPopcornSDK/tree/master/AdPopcornOfferwall).

## 17d — 공용 문서·앱 진입점 기준

플랫폼 개발 문서 `18-오퍼월-광고SDK-패키지.md`에서 설치·OS별 키·콜백·다음 빌드 순서를 한 번에 확인한다. 서버 상세 명세는 `jcurve-api/docs/adpopcorn.md`와 `docs/offerwall-providers.md`다.

당근 16w3 기준 메뉴는 **행운 탭 맨 아래 「오퍼월 시험」**. 기존 `custom.values['kiap.test_members']`의 정확한 회원 ID 일치만 허용한다. 설정 실패/일반 회원은 숨기고 시험 회원이 빈 키로 누르면 「준비 중」. 다른 앱의 대응 찬스 탭에도 같은 규칙을 적용한다. Android 두 키는 빌드 환경에서 주입하고, iOS 두 키는 서버/어드민 설정을 조회한다. **Android 키를 넣지 않은 바이너리를 나중에 어드민 설정만으로 켤 수 없다.**

`useOfferwallClosed`는 등록 순간 SDK가 준비돼 있어야 한다. 클릭 때 초기화하는 화면은 **initializeOfferwall 성공 후 onOfferwallClosed를 등록**하고 재등록/언마운트 때 해제한다. 초기화 전에 마운트한 훅은 자동으로 다시 구독하지 않는다.

```ts
const ready = await initializeOfferwall({configUrl, headers});
if (ready.ok) {
  removePreviousClose?.();
  removePreviousClose = onOfferwallClosed(() => { void refreshBalance(); });
  openOfferwall({usn});
}
// 언마운트/계정 전환: removePreviousClose?.(); resetOfferwall();
```

새 네트워크는 별도 `@jcurve/offerwall-buzzvil` 준비 패키지로 분리했다. AdPopcorn만 쓰는 앱에 Buzzvil과 미디에이션 의존성이 자동 추가되지 않는다. Buzzvil은 공식 네이티브 SDK 기반 JCurve 브리지이며 앱 미설치·네이티브 컴파일 미검증·서버 콜백 비활성 상태다. 공식 SDK·무료 도입 조건이 확인되지 않은 후보는 의존성으로 추가하지 않는다.

## 0.2 — 앱 머리글/탭 사이에 목록 넣기 (네이티브 재빌드 필수)

`initializeOfferwall` 성공 및 기존 서버 USN 조회 후 `<OfferwallView usn={usn} style={{flex: 1}} onLoaded={...} onError={...} />`를 마운트한다. iOS는 SDK `AdPopcornOfferwallViewController`의 ViewMode + child VC, Android는 SDK `ApRewardWebOfferWallLayout` + `AdpopcornExtension.setCustomWebOfferwallLayout`을 사용한다. 별도 광고 지면 ID가 필요한 NativeAd와 다르다. `onError`는 초기화/미연결/USN 오류이며 SDK 네트워크 실패 통지는 아니므로 호스트에서 로딩 시간 초과와 재시도를 제공한다.

부모는 높이를 정하고 스크롤 뷰로 감싸지 않는다. 화면 퇴장·로그아웃·회원 변경 때 반드시 언마운트한다. iOS 크기 변경은 `changeViewModeSize:viewHeight:`, Android는 부모 레이아웃을 따른다. SDK가 전역 사용자 한 명을 보유하므로 동시에 두 오퍼월을 마운트하지 않는다. 상세 화면/외부 광고 앱은 SDK 고유 동작이다.

기존 `openOfferwall`과 콜백/보상 API는 유지한다. 이 컴포넌트는 보상을 계산하거나 지급하지 않는다. iOS/Android autolinking 설정과 네이티브 소스가 추가되었으므로 기존 바이너리에 OTA로 배포하면 안 된다. RN 0.86 호환 뷰 인터롭을 사용하며 네이티브 컴파일과 실기기 검증은 별도로 필요하다.

## 0.2.2 — 키 고르기: expoConfig → 빌드에 박힌 설정 → 서버(2026-10-20)

OTA 발행 환경에 ADPOPCORN_* 가 없어 manifest `extra.jcurveOfferwall` 키가 빈 문자열로 나가자 안드로이드 오퍼월이 「준비 중」이 됐다(A32 캐시팡팡).
패키지(`options()`)와 앱 키 가드가 둘 다 `Constants.expoConfig.extra` 만 봤다. 0.2.2 부터 안드로이드 키는 이 순서로 고른다(두 키가 다 있어야 한다).

1. `Constants.expoConfig.extra.jcurveOfferwall` — 예전과 같다
2. 빌드 때 박힌 app config(`ExponentConstants.manifest`) — OTA 가 못 바꾼다. 플러그인이 빌드 때 넣은 값이다
3. 서버 `content/config/adpopcorn` — `initializeOfferwall` 이나 `resolveOfferwallKeys(fetcher)` 가 받아 둔 값

- `builtOfferwallKeys()` → `{ appKey, hasAppKey, hasHashKey, source: 'expoConfig' | 'embedded' | 'server' | 'none' }`. hashKey 값은 내보내지 않는다.
- `await resolveOfferwallKeys(() => api.get('content/config/adpopcorn'))` 는 1 · 2 가 다 비었을 때만 서버를 부른다. 앱이 fetcher 를 준다.
- 번들 표식: `OFFERWALL_KEYS_MARK` = `jcurve-offerwall-keys:expoConfig>embedded>server`
- 네이티브 변경 없음(0.2.1 과 같은 android · ios · plugin). OTA 로 바로 적용된다.

앱 키 가드는 `builtAndroidKey()` 를 `builtOfferwallKeys().appKey` 로 바꾼다.

## 0.2.3 — 공용 찬스 탭 화면

`OfferwallScreen({usn, onClose, onRetry, loadingColor?, topInset?})`가 헤더 없는 찬스 화면을 제공합니다.
앱의 복제된 화면 대신 이 컴포넌트로 연결합니다. 기존 로딩, 20초 시간 초과, 재시도와 Android 뒤로가기를 유지합니다.
상태 표시줄과 하단 탭의 safe area는 호스트 책임입니다. 호스트가 상단 inset을 적용하지 않을 때만 topInset을 전달합니다(기본 0, 이중 여백 방지).
애드팝콘 SDK 화면과 그 내부 광고 표시는 수정하지 않습니다. 앱 자체의 ‹ / 찬스 / 광고 머리줄만 없습니다.
네이티브/플러그인 변경 없음. 심사 중 런타임에는 시험판 포함 OTA 발행 금지.

## 0.2.4 — 포인트 빨리 모으기 (JS only, OTA 가능)

목표(1천 · 5천 · 1만P)별로 묶은 오늘의 할 일 조합을 보여 주는 칩 · 배너 · 안내 페이지. 화면은 서버 값을 그리기만 하고 포인트 지급은 하지 않는다. 새 네이티브 의존성 · 권한 없음. 이름은 `COMBO_NAME` 한 곳에서만 바꾼다.

```tsx
import { ComboEntry, comboThemeFromTokens } from '@jcurve/offerwall';
const theme = comboThemeFromTokens({ C, R, F, shadow });   // 앱의 src/ui/theme.ts 토큰 그대로(없으면 기본값 = 같은 계열)
// 찬스 탭 — 오퍼월과 같은 크기의 한 틀 안에 나란히
<View style={{ flex: 1 }}>
  <OfferwallScreen usn={usn} onClose={...} onRetry={...} />
  <ComboEntry placement="chance" load={() => api.get('offerwall/combos')} loadKey={memberId} usn={usn} theme={theme} />
</View>
// 홈에 배너를 쓰려면 홈에도 한 번 (서버가 home: 'banner' 로 켤 때만 보인다)
<ComboEntry placement="home" load={() => api.get('offerwall/combos')} loadKey={memberId} usn={usn} theme={theme} />
```

- 데이터는 `load`(앱이 자기 API 함수로 요청해 파싱된 JSON 을 돌려줌 — 인증 · 기기 · OTA 헤더 · 401 처리를 앱이 그대로 쓴다) 또는 `url` + `headers` 로 받는다. `loadKey`(회원 번호 · 토큰)가 바뀌면 이전 회원 데이터를 즉시 버린다. `load` 함수 모양만 바뀌어서는 다시 받지 않는다.

- **찬스 탭**: 오퍼월 위에 작은 칩 하나만 얹는다(띠 · 감싸는 여백 없음, 칩 밖 터치는 오퍼월로 간다). 오퍼월 자체 머리줄(「리워드 충전소」 · 프로필 아이콘) 오른쪽 빈자리에 맞춰 `chipTop` 6 · `chipRight` 52 (iPhone 402pt · Galaxy A32 411dp 캡처에서 잰 값, 머리줄은 스크롤해도 고정). 칩을 누르면 칩 아래에서 시트가 올라오고, 칩을 다시 누르거나 「닫기」 · 바깥을 누르면 닫혀 오퍼월은 그대로다. 오퍼월은 RN 화면 안에 들어간 뷰(iOS `UIView` 자식 · Android `FrameLayout` 자식)라 그 위에 RN 뷰가 올라간다 — 올라가지 못하는 건 SDK 전체 화면 `openOfferwall()` 뿐이다.
- **홈**: 배너 → 눌러서 전체 화면(Modal)으로 연다.
- `url` 이 없으면 아무것도 그리지 않는다. 고정 예시(`TODAY_COMBOS_SAMPLE`)는 `sample` 을 켠 화면 작업에서만 나온다 — **릴리스에 `sample` 금지**.
- **한 줄 = 캠페인 하나**, 줄마다 「하러 가기 ›」. `onPressMission(mission, bundle)` 을 주면 그 탭을 통째로 넘겨받는다. 안 주면 `ComboEntry` 가 스스로 연다:
  1. 네이티브 브리지가 있는 빌드(0.3.0~)면 이 **순서**로 시도한다(0.3.1~). ① 서버가 준 키(`mission.campaignKey`, 없으면 숫자 `mission.id`)로 SDK 상세를 **바로** 연다 — SDK 목록을 기다리지 않는다. ② 안 되면 SDK 가 지금 열 수 있는 캠페인 목록(키 · 이름)을 한 번 읽어(회원마다, 비면 다시) **이름이 같은** 캠페인의 상세를 연다 — 정확히 같음 → 공백 · 기호를 뺀 이름이 같음 → 괄호 부분까지 뺀 이름이 같음 순이고, 단계마다 **하나로 정해질 때만** 쓴다(둘 이상이면 틀린 캠페인을 열지 않으려고 포기). ③ 서버 `mission.id` 가 목록의 키면 그것을. 같은 키는 두 번 시도하지 않고, SDK 가 네이티브 대기 시간(iOS 5초 · Android 8초) 가까이 걸려 `false` 를 주면(페이지가 아직 뜨는 중일 수 있다) 다른 키로 두 번째 화면을 열지 않고 바로 폴백으로 간다. **실측: 이 목록은 오퍼월 전체가 아니라 10개 안팎만 온다**(517개 중) — 그래서 이름 맞추기는 보조이고, 서버가 진짜 캠페인 키를 `mission.campaignKey`(또는 숫자 `id`)로 주는 것이 본선이다. `reportCampaigns(list)` 로 받은 목록을 앱이 서버에 올릴 수 있다(시험 회원일 때만 올리게 앱이 판단).
     - **`onDiagnostic(d)`**(0.3.1~): 「하러 가기」를 누를 때마다 한 번 불린다 — `{t:'tap', mission, name, bridge, listCount, listError?, listSample?, how:'server_key'|'name'|'id_in_list'|'none', key?, attempts, open:true|false|'error'|'skipped', openError?, openMs?, copied?, ms}`. 회원 · 기기 · 광고 ID 는 담지 않는다(미션 id · 이름 · 키 · 숫자 · 짧은 오류 문장뿐). 보내는 쪽은 앱의 몫이고, 던지거나 reject 해도 탭은 멈추지 않는다.
  2. 브리지가 없거나(옛 바이너리) 못 찾았거나 SDK 가 거절하면 **폴백**: 위쪽에 「"이름" 를 찾아 주세요」를 4.5초 띄우고(복사가 되면 「 · 이름을 복사했어요」 — 복사가 안 됐으면 그 말을 하지 않는다), 찬스 탭은 안내 시트를 닫아 아래 오퍼월 목록이 보이게, 홈은 0.7초 뒤 오퍼월 전체를 연다. 복사는 `copyText` 또는 0.3.0 브리지의 `setClipboard`, 둘 다 없으면 복사 없이.
- **깜박임**: 아직 안내를 열어 보지 않은 날에는 칩(찬스 탭)과 홈 배너가 은은하게 깜박인다 — 불투명도 1 ↔ 0.55, 650ms 씩(한 주기 1.3초), `Animated.loop` + `useNativeDriver` 라 JS 스레드를 쓰지 않아 OTA 로 나간다. 안내를 한 번 열면(칩 · 배너 · 팝업 · 푸시 어느 쪽이든) **그날은 멈추고** 한국 날짜가 바뀌면 다시 깜박인다. 칩과 배너는 같은 「오늘 봤음」 표시를 쓴다. 기기 저장은 회원별(`storage` 를 주면 AsyncStorage, 안 주면 앱을 닫을 때까지 메모리). 접근성 **「동작 줄이기」** 를 켠 기기는 깜박이지 않고, 그 설정을 읽기 전에도 가만히 있는다(켜고 끄는 도중 바뀌면 바로 따른다). 서버가 칩을 끄거나 데이터가 없으면 깜박이지 않는다.
- **다 한 미션 체크**: 줄 앞 동그라미를 눌러 체크하면 그 줄은 아래로 내려가 흐려지고(취소선 · 「완료」) 묶음 합계가 「남은 합계」로 바뀐다(모두 하면 「모두 마쳤어요」). 같은 캠페인(같은 id)은 묶음이 달라도 한 번만 체크된다. `storage`(AsyncStorage 모양 `getItem`/`setItem`, 앱의 `AsyncStorage` 를 그대로)를 주면 **기기에 회원별 · 하루 단위**로 저장되고 날짜가 바뀌면 비어 있다. 안 주면 앱을 닫을 때까지만.
- **옛 바이너리 안전(OTA 규칙)**: 네이티브 모듈은 `require` 하지 않고 `NativeModules.JCurveOfferwallModule` 속성 조회만 한다(없으면 undefined → 폴백). 가져오는 순간 실행되는 최상위 호출 없음. 새 네이티브 뷰 · 뷰 prop 을 쓰지 않는다. 0.2.4 의 `android/` · `ios/` · 플러그인 · podspec 은 0.2.3 과 diff 0 이라 이미 나간 바이너리에 OTA 로 얹어도 된다.

**서버 응답** (`ok: false` 이거나 모양이 틀리면 숨긴다. 값은 모두 검증해서 쓴다)

```json
{ "ok": true, "combos": {
  "date": "2026-10-27",
  "display": { "chance": "chip", "home": "off" },
  "bundles": [ { "goal": 1000, "missions": [
    { "id": "c-101", "name": "간단한 설문 하나", "points": 450, "todo": "질문 5개에 답하기", "level": "easy", "minutes": 3 } ] } ] } }
```

- `date`(KST)가 **없거나** 오늘이 아니면 보여 주지 않는다. 앱을 자정 넘어 켜 둬도 어제 조합은 사라지고, 자정 5초 뒤에 새로 받는다. url · 헤더(회원)가 바뀌면 이전 회원 데이터는 즉시 버린다.
- `display.chance`: `chip`(기본) / `off`, `display.home`: `banner` / `off`(기본). **켜고 끄기는 서버 값으로**. `chance` 가 `off` 여도 팝업 · 푸시로 들어오는 길은 살아 있다.
- `level`: `easy`(쉬움) / `normal`(보통) / `hard`(조금 걸려요). 합계는 화면에서 항목 포인트를 더해 만들고, 합이 `goal` 에 못 미치는 묶음은 통째로 뺀다.
- 묶음 최대 4개(1단계 · 2단계 · 3단계 길로 그린다), 묶음당 항목 최대 12개, 항목 포인트 1천만 이하, 이름 40자 · 할 일 80자.
- **`singles` (선택)** — 「한 번에 끝내기」 칸: `"singles": [ { "goal": 1000, "missions": [ {…} ] }, … ]`. 목표마다 **미션 하나로 목표를 채우는** 것들을 종류를 섞어 보낸다(같은 goal 이 여러 번 와도 된다, 앱이 goal 별로 모은다). 각 단계 묶음 카드 아래에 「한 번에 끝내기 · 아래 중 하나만 해도 1,000P를 채워요」 칸이 같은 모양의 미션 줄(이름 · +포인트 · 할 일 · 쉬움/시간 · 하러 가기 · 체크)로 나온다. 규칙: 그 미션의 **포인트가 goal 이상**이어야 한다(모자라면 「한 번에 끝내기」가 거짓말이 되니 뺀다) · 묶음이 없는 goal 의 것은 뺀다(보여 줄 단계가 없다) · goal 마다 서로 다른 미션 최대 6개 · 항목 필드 규칙은 묶음과 같다. **`singles` 가 없거나 그 단계에 없으면 칸을 숨긴다** — 옛 서버 응답과 그대로 호환. `todo` 에 「결제 필요」가 오면 그대로 보여 준다. 같은 캠페인(같은 id)이 묶음과 칸에 함께 있으면 체크는 한 번만, 둘 다 완료로 보인다.
- **`easy` (선택, 0.3.1~)** — 「쉽게 모으기」 탭: `"easy": { "missions": [ {…}, … ], "total_points": 600 }`. 인스타 팔로우 · 구독 · 설치 후 열기처럼 3~5분이면 끝나는 **작은 미션**만 모은 목록이다(포인트가 1천P에 못 미쳐도 된다 — 목표 없음). 단계 탭 **앞**에 「쉽게 모으기」 탭이 하나 생기고 **그 탭이 먼저 열린다**. 카드는 「쉽게 모으기 · 다 하면 +N P」(체크하면 「남은 합계」, 모두 하면 「모두 마쳤어요」)와 같은 모양의 미션 줄(이름 · +포인트 · 할 일 · 하러 가기 · 체크)이다. 규칙: 서로 다른 미션 **전부**(0.3.9~: 15·20개로 자르지 않는다. 터무니없는 본문만 막는 300개 상한이 있다. 팝업 「쉬운 미션 n개」도 이 개수), 항목 필드 규칙은 묶음과 같다, 합계는 남긴 줄로 다시 계산하고 서버의 `total_points` 는 쓰지 않는다. `onPressMission(mission, bundle)` 에서 `bundle.goal === 0` 이면 쉽게 모으기 탭이다(`bundle.total` · `bundle.missions` 는 그 목록). 한 단계 묶음 안의 「한 번에 끝내기」 칸은 쉽게 모으기 탭에 나오지 않는다. **`easy` 가 없거나 쓸 줄이 없으면 탭을 숨긴다**(옛 응답과 그대로 호환, 단계가 하나뿐이어도 `easy` 가 있으면 탭은 둘). 같은 캠페인(같은 id)은 다른 곳과 체크를 함께 쓴다. 이름은 `COMBO_EASY_NAME` 한 곳.

**팝업 · 푸시 · 링크로 들어오기** — 푸시 `data.go` · 링크는 `offerwall/combos` (`COMBOS_ROUTE`), 서버 팝업은 `app_popups.action` 칸이 10자라 `combos` (`COMBOS_POPUP_ACTION`). `isCombosRoute` 가 둘 다 알아본다. 앱은 URL 스킴이 아니라 앱 안 이동 액션을 쓰므로 팝업 `action` / 푸시 `data.go` 를 받는 쪽에서 한 줄만 더한다.

```ts
import { isCombosRoute, requestOpenCombos } from '@jcurve/offerwall';
if (isCombosRoute(action)) { goTab('offerwall'); requestOpenCombos(); }   // 탭 이동 코드는 앱마다 다르다
```

`requestOpenCombos()` 는 마운트된 `ComboEntry` 가 있으면 바로 열고(찬스 탭이 홈보다 먼저, 같은 순위면 나중에 마운트된 쪽), 아직 없으면 10초까지 기다렸다가 처음 마운트되는 쪽에서 연다. 오래된 요청이 나중에 갑자기 열리지는 않는다. 구버전 앱에는 이 코드가 없으므로 서버 팝업은 `chancePromo=1` 처럼 지원 앱만 받는 조건을 따로 걸어야 한다.

**기준 가지 주의**: 0.2.3 이 두 갈래다 — `offerwall-v0.2.3` 태그(JS 찬스 퍼널, `OfferwallScreen` 없음)와 에그머니가 쓰는 `codex/chance-header-remove-1022`(`OfferwallScreen`, 퍼널 없음). 0.2.4 는 에그머니가 쓰는 쪽 위에서 만들었다. 퍼널 쪽은 합치지 않았다.

## 0.3.0 — 애드팝콘 SDK 네이티브 브리지 (새 빌드 필요, 이 줄부터는 OTA 로 쓴다)

`react-native-adpopcorn-reward` 1.0.0 은 JS 에 9개 메서드만 내놓는다(setAppKey · setLogEnable · openOfferwall · openBridge · openCSPage · setUserId · setStyle · getOfferwallTotalRewardInfo · getBridgeTotalRewardInfo). SDK(Android 9.2.6 · iOS 5.2.3, **업그레이드 없이**) 안에는 더 많은 공개 기능이 있어, 새 빌드에서 JS 에 열어 두면 다음부터는 OTA 로 쓸 수 있다. 네이티브 모듈 이름은 `JCurveOfferwallModule`(Android `JCurveOfferwallModule.java` · iOS `JCurveOfferwallModule.m`), JS 는 `src/native.ts`.

- **옛 바이너리 안전**: 모듈은 `NativeModules.JCurveOfferwallModule` 속성 조회로만 찾는다(`require` 안 함). 없으면 모든 함수가 `code: 'E_UNSUPPORTED'` 로 reject 하고 던지지 않는다. `hasNativeBridge()` 로 먼저 물을 수 있다. 새 뷰 prop 은 브리지가 있을 때만 네이티브 뷰에 넘긴다.
- **오류 코드**: `E_UNSUPPORTED`(이 플랫폼 · 빌드에 없음) · `E_FAILED`(SDK 가 던짐) · `E_LOAD_FAILED`(목록 받기 실패) · `E_NO_ACTIVITY`(앞에 화면 없음, Android). 시간이 지나도 SDK 가 답이 없으면 reject 대신 `false`/`null`/`[]` 로 끝난다(8~10초).
- **SDK 콜백은 이름으로 연결**한다(Android 는 `java.lang.reflect.Proxy`, 메서드 서명을 추측하지 않음). 앱이 R8 을 켜도 SDK 의 `-keep class com.igaworks.adpopcorn.** { *; }` 가 이름을 지킨다.
- 이벤트는 `addOfferwallNativeListener(cb)` (`NativeEventEmitter`, iOS 가 청취자를 세야 이벤트를 보낸다): `detailClosed` · `customNativeClickSuccess|Failed|Completed` · `customCpmClickSuccess|Failed|Completed`.
- 컴파일 · 실기기 확인 **전**의 소스다. 이 코드를 쓴 PC 에는 Xcode · JDK 가 없어 맥북16 빌드에서 처음 컴파일된다.

| JS 함수 | 하는 일 | Android (SDK 9.2.6) | iOS (SDK 5.2.3) |
|---|---|---|---|
| `openCampaignDetail(key)` | 캠페인 키로 상세 열기 → true/false | `Adpopcorn.openCampaignDetailPage` | `+openCampaignDetailViewController:campaignKey:delegate:` |
| `tryParticipateCampaign(key)` | SDK 가 대신 참여 시도 → `{success, code, message, landingUrl}` | `AdpopcornExtension.tryParticipateCampaign` | `+tryParticipateCampaign:` (결과는 공용 델리게이트로 와서 잠시 빌렸다 돌려줌) |
| `loadCustomCampaigns(max)` | 지금 열 수 있는 캠페인 목록 `[{campaignKey, title, description, reward, iconImageURL, mainImageURL}]` | `ApCustomReward` (`setMaxCampaignCount` · `loadAd`) | `AdPopcornCustomReward` (`ApCustomRewardLoadSuccess:`, 모델 `ApCustomRewardModel`) |
| `clickCustomCampaign(key)` | 그 목록의 캠페인 참여 | `ApCustomReward.clickCampaign` | `-clickCampaign:` |
| `destroyCustomCampaigns()` | 목록 객체 정리 | `ApCustomReward.destroy` | `-stopAd` |
| `loadCustomNativeAds(placementId)` | 콘솔 지면의 커스텀 네이티브 광고 목록 | `AdPopcornRewardCustomNativeAd` | `AdPopcornRewardCustomNativeAd` |
| `impressionCustomNativeAd(id)` · `clickCustomNativeAd(id)` | 노출 · 클릭 기록 | 같은 이름 | 같은 이름 |
| `completeCustomNativeAd()` | 선택한 캠페인 완료 | `completeSelectedCampaign` | **지원 안 함** |
| `loadCustomCpm(max)` · `impressionCustomCpm(id)` · `clickCustomCpm(id)` | CPM 형 커스텀 목록 | `ApCustomRewardCPM` | `AdPopcornCustomRewardCPM` |
| `getEarnableTotalRewardInfo()` | 적립 가능 캠페인 수 · 총 포인트 | `AdpopcornExtension.getEarnableTotalRewardInfo` | `+getEarnableTotalRewardInfo:` |
| `getBridgeTotalRewardInfo(placementId)` | 브릿지 지면의 같은 값 | `AdpopcornExtension.getBridgeTotalRewardInfo` | `+getBridgeTotalRewardInfo:delegate:` |
| `openOfferwallWithFilter({k: v})` | 사용자 필터를 주고 오퍼월 열기 | `setUserFilter` 를 키마다 부른 뒤 `openOfferwall` | `openOfferWallWithViewController:…userDataDictionaryForFilter:` |
| `closeOfferwall()` | 열려 있는 오퍼월 닫기 | **지원 안 함**(공개 API 없음) | `+closeOfferwallViewController` |
| `setUserAgreement(bool)` | 개인정보 동의 전달 | `AdpopcornExtension.setUserAgreement` | **지원 안 함** |
| `useFlagShowWhenLocked(bool)` | 잠금 화면 위 표시 | `AdpopcornExtension.useFlagShowWhenLocked` | **지원 안 함** |
| `setClipboard(text)` | 클립보드 복사(별도 모듈 없이) | `ClipboardManager` | `UIPasteboard` |
| `getOfferwallNativeCapabilities()` | 이 빌드의 플랫폼 · SDK · 메서드 목록 | 〃 | 〃 |
| `<OfferwallView campaignKeys={[…]}>` | 목록을 이 캠페인들로 거르기 | `setFilterCampaignKeyList` | **지원 안 함** |
| `<OfferwallView detailCampaignKey="…">` | 목록 안에서 이 캠페인 상세로 열기 | **지원 안 함** | `AdPopcornOfferwallViewController.detailPageCampaignKey` |

**이미 래퍼가 주는 것(그대로 쓴다)**: `setAppKey` · `setUserId` · `setStyle` · `setLogEnable` · `openOfferwall` · `openBridge(placementId)` · `openCSPage` · `getOfferwallTotalRewardInfo` · `getBridgeTotalRewardInfo` 와 이벤트 `OnClosedOfferWallPage` · `OnCompletedCampaign` · `OnOfferwallTotalRewardInfo` · `OnBridgeTotalRewardInfo`(`useOfferwallClosed` 등).

**열지 않은 공개 기능과 이유(SDK 파일에서 확인한 것)**
- 시작 탭 · 탭 지정: 공개 옵션이 없어 함수를 만들지 않았다(Android 시작 탭은 코드에 0 으로 고정, iOS 는 헤더에 속성 없음).
- 클라이언트 보상 방식(`setClientRewardCallbackListener` · `getClientPendingRewardItems` · `didGiveRewardItemWithRewardKey` · iOS `setUseClientRewardServer:`): 우리는 **서버 콜백 보상**이라 쓰지 않는다(앱이 지급을 맡으면 안 된다).
- `AdpopcornExtension.openOnestoreOfferWall`: 원스토어 전용.
- `AdpopcornExtension.openURL` · `setAppKeyAndHashKey` · `setFromPluginAPI` · Android `setCustomWebOfferwallLayout`/`setOfferwallImpressions`(임베드 뷰가 이미 사용) · iOS `setAppKey:andHashKey:`(래퍼가 제공) · `setLogLevel:`(래퍼 `setLogEnable`): 용도 불명이거나 이미 있다.
- `AdPopcornCustomRewardCPM.setNewsCampaignAuth:`(iOS 전용 인증 문자열): 용도 불명.
- 상세 페이지 열림 · 닫힘 외의 델리게이트(`willOpenOfferWall` 등): 래퍼 모듈이 필요한 것만 JS 로 보낸다. 우리 모듈은 참여 시도 중에만 공용 델리게이트를 잠시 가져가고 받은 호출은 래퍼에 넘긴다.

**실기기에서 확인할 것(소스만 있는 상태)**: (가) 커스텀 목록이 콘솔 설정 없이 오는지(`CAN_NOT_FIND_AVAILABLE_CAMPAIGN` 이면 비어 올 수 있음) (나) 커스텀 목록 이름이 오퍼월에 보이는 이름과 같은지 (다) 상세 열기가 실제로 열리고 `OnOpenSuccess`/`onOpenCampaignDetailPage` 가 오는지 (라) iOS `detailCampaignKey` 가 임베드 목록에서 상세로 열리는지.

## 0.3.1 — 하러 가기 서버 키 먼저 · 진단 · 쉽게 모으기 (JS only, 0.3.0 빌드에 OTA 가능)

0.3.0 의 android · ios · 플러그인 · podspec 과 **diff 0**(JS 만 바뀜). 1.1.6(0.3.0 빌드)에 런타임 1.1.6 OTA 로 얹는 용도다.

- **실기기 결과(2026-10-27 18:54, iOS TestFlight 1.1.6)**: 「하러 가기」가 상세를 못 열고 폴백만 나왔다. 서버에 올라온 SDK 목록(시험 회원)은 **10개**뿐이었고(오퍼월 전체는 517개) 그날 미션 이름이 거기에 없었다 — 이름 맞추기는 구조적으로 부족하다. 그래서 순서를 **서버 키 → 이름 → 폴백**으로 바꿨다(위 「한 줄 = 캠페인 하나」 항목의 ①②③).
- `onDiagnostic` — 누를 때마다 무엇이 일어났는지(브리지 여부 · 목록 개수/오류/앞 5개 이름 · 시도한 키와 방법 · `open` 결과와 걸린 시간 · 복사 여부). 앱이 시험 회원일 때만 서버로 보낸다.
- `combos.easy` — 「쉬운 것부터 가볍게」 탭, 위 서버 응답 절 참고.
- **알려진 한계**: iOS 모듈은 `onOpenCampaignDetailPage` 가 5초 안에 안 오면 `false` 로 끝낸다. 상세는 웹 페이지라 느리면 열렸는데도 `false` 가 날 수 있다 — 그래서 5초 가까운 `false` 뒤에는 다른 키를 더 시도하지 않는다. 시간 자체를 늘리려면 네이티브 수정이 필요해 다음 빌드 몫이다. 서버 키만으로 SDK 가 상세를 여는지(목록 없이)는 SDK 바이너리 문자열로는 목록이 필수가 아닌 것으로 보이나 **실기기로 확인 전**이다. 대안: 임베드 뷰 `OfferwallView detailCampaignKey`(iOS) · `campaignKeys`(Android).

## 0.3.4 — 찬스 탭 추천 팝업 (JS only, 0.3.0 빌드에 OTA 가능, iOS · 안드)

0.3.1 위에서 만든 JS 변경이다(0.3.2 의 iOS 네이티브 변경과 0.3.3 의 임베드 상세는 **들어 있지 않다** — 임베드 상세는 SDK `pageType` 때문에 목록만 떠서 되돌렸다). `android/` · `ios/` · plugin · podspec 은 0.3.0 과 바이트 동일.

- **무엇**: 찬스 탭에 **직접 들어오면** 오퍼월이 다 뜬 뒤(`OfferwallScreen` 이 `onLoaded` 를 받은 시점, 0.6초 대기) 오퍼월 위 가운데에 추천 팝업이 한 번 뜬다. 제목 「포인트 빨리 모으기」, 본문은 서버 `combos` 로 만든 한두 줄(예: 「쉬운 미션 20개로 +9,205P」 · 「1천 · 5천 · 1만P 길 추천」, `comboPopupLines`), 버튼 「닫기」 / 「추천 보기」. 「추천 보기」는 팝업을 닫고 「포인트 빨리 모으기」 바텀시트를 연다. 머리줄 칩은 팝업 아래로 가리지 않고(zIndex 30 > 팝업 22) 그대로 남는다. 어두운 배경을 누르면 닫힌다.
- **하루 한 번**: 회원별 · 한국 날짜 기준 한 번(`jcurve.combos.popup:<회원>` 에 `{d: 날짜}` 저장, `storage` 를 주면 기기에 저장). 그날 **안내를 이미 연 경우**(칩 · 메인 팝업 · 푸시 어느 쪽이든)와 이번 방문에서 시트를 연 경우에는 띄우지 않는다.
- **메인 팝업 · 푸시로 들어온 경우**: 앱이 탭을 옮긴 뒤 `requestOpenCombos()` 를 부르면(기존 combos 팝업 · 푸시 `offerwall/combos` 와 같은 길) 시트가 **바로 열리고**, 그날 추천 팝업도 이미 본 것으로 처리한다(오퍼월이 늦게 떠도, 시트를 닫은 뒤에도 안 뜸). 직접 탭을 누른 경우에는 `requestOpenCombos()` 를 부르지 않는다.
- **서버 스위치**: `display.chance_popup: "off"` 면 팝업을 안 띄운다(없거나 `"on"` 이면 켜짐). 칩 · 시트에는 영향이 없다. `normalizeTodayCombos` 는 두 번 돌려도 같은 결과(`display.popup === 'off'` 도 읽음).
- **신호**: `wallSignal.ts` — `notifyWallLoaded()` / `notifyWallGone()` / `onWallState(cb)` / `isWallLoaded()`. `OfferwallScreen` 이 보내고 `ComboEntry` 가 듣는다(두 화면이 한 틀 안에 나란히 있으므로). 홈 배너 · 데이터가 없는 항목 · 서버가 칩을 끈 경우에는 팝업이 없다.
- 새 네이티브 모듈 · 뷰 · prop 없음. 시험: `test/combos-popup.test.cjs`(12개) — 시간 · 하루 한 번 · 회원별 · 닫기 · 추천 보기 · 서버 off · 시트를 이미 연 날 · 메인 팝업 경로 · 홈.

## 0.3.5 — 추천 팝업 「항상」 모드: `display.chance_popup: "always"` (JS only)

0.3.4 위의 JS 한 가지 변경이다(네이티브 0.3.0 과 바이트 동일). 시험 계정이 매번 팝업을 확인할 수 있게 한다.

- 서버 `display.chance_popup` 값: `"on"`/없음 = 하루 한 번(0.3.4 그대로) · `"off"` = 안 띄움 · **`"always"` = 하루 한 번 · 「그날 안내를 이미 열었음」 표시를 무시하고, 찬스 탭에 직접 들어올 때마다(오퍼월 `onLoaded` 뒤 0.6초) 한 번** 띄운다. `normalizeTodayCombos` 는 `display.popup` 에 `'off' | 'always'` 를 남기고 두 번 돌려도 같다. 모르는 값은 「하루 한 번」으로 본다.
- **방문 단위**: 찬스 탭에 들어올 때마다 `ComboEntry` 가 새로 마운트되므로 그때마다 한 번이다. 같은 방문에서 오퍼월이 다시 뜨거나(재시도) 팝업을 닫은 뒤에는 다시 뜨지 않는다.
- 메인 팝업 · 푸시로 들어와 `requestOpenCombos()` 로 시트가 바로 열린 방문에는 「항상」이어도 팝업이 없다. 홈 · 데이터 없음 · 칩이 꺼진 경우도 그대로.
- 기기에 쓰는 「오늘 봤음」 표시는 그대로 기록되므로(칩 깜박임 규칙) 「항상」을 끄면 다음 날부터 평소 규칙으로 돌아간다.

## 0.3.6 — 안내 시트를 「쇼핑 탭」처럼 깔끔하게 (JS only, 0.3.0 빌드에 OTA 가능)

대표님 10/27 「디자인이 너무 투박하고 안 예뻐. 쇼핑처럼 좀 깔끔하게」. 에그머니 쇼핑 탭(`@jcurve/shopping` 0.1.16 + 앱 `ShopScreen` 테마)의 값에 맞춰 `ComboGuideScreen` 을 다시 짰다. 동작 · 서버 응답 · 접근성 라벨은 그대로고 모양만 바뀐다(네이티브 0.3.0 과 바이트 동일).

- **바탕 · 글자**: 흰 바탕, 글자 `#191F28` / 보조 `#6B7684`, 구분선 `#E5E8EB`. 테마에 선택 토큰 `chipBg`(안 고른 칩 · 로딩 중 아이콘 바탕, 기본 `#F2F4F6`) · `thumbBg` 추가. 에그머니는 `bg/card/line/divider/text/sub` 를 쇼핑 탭 값으로 덮어써서 넘긴다(앱 `EggCombos.tsx`).
- **머리**: 높이 52, 제목(18/700) + 「닫기」(14/600 보조색). 큰 제목 · 설명 문단 · 카드 · 그림자 삭제.
- **단계 탭**: 작고 납작한 칩(높이 34 · 둥글기 17 · 글자 14/600, 칩 사이 8) — 「쉽게 모으기」 · 「1천P」 · 「5천P」 · 「1만P」. 고른 칩 = 연한 주색 바탕(`accentSoft`) + 진한 주색 글자(`accentText`), 안 고른 칩 = `chipBg` + 보조색 글자. 가로로 넘치면 옆으로 민다. 화면 읽기용 라벨은 그대로(`1단계 1천P` · `쉽게 모으기`).
- **합계**: 칩 아래 한 줄 — 「다 하면 +5,965P」 · 「합계 1,008P」 · 체크하면 「남은 합계 …」 · 다 하면 「모두 마쳤어요」.
- **미션 줄**: 왼쪽 캠페인 아이콘(정사각 · 둥근 모서리 44) · 가운데 이름(한 줄, 넘치면 …) + 할 일(13, 회색, 한 줄) · 오른쪽 `+102P`(`point` 강조색) · 맨 오른쪽 작은 체크 동그라미(22). **줄 전체가 「하러 가기」 버튼**이다(큰 버튼 · 번호 동그라미 · 쉬움/시간 칩 삭제, 눌렀을 때 옅은 회색). 체크한 줄은 아래로 내려가 흐려지고 이름에 취소선, 체크는 채워진 ✓. `onToggleDone` 이 없으면 체크는 그리지 않는다.
- **아이콘**: 서버 미션의 `icon`(별칭 `icon_url` · `iconUrl`, **https 주소만** — http · data: · 공백 · 스크립트 주소는 버림)을 쓴다. 없거나 불러오기에 실패하면 이름 첫 글자(이모지 포함 한 글자) 동그라미(`accentSoft` 바탕 · `accentText` 글자). `ComboMissionIcon` 으로 내보낸다.
- 「한 번에 끝내기」는 같은 줄 모양의 두 번째 목록(제목 16/700 + 보조 문구)으로 단계 목록 아래에 나온다. 맨 아래 작은 안내 문구(합계 기준)는 그대로.
- 시험: `test/combos-clean.test.cjs`(6개) + 옛 모양을 단정하던 9개를 새 모양에 맞게 고침(제거된 글자 · 버튼은 「없음」 단정으로).

**추천 팝업도 같이 다시 만들었다**(대표님 「팝업이 좀 약하네」): 위에 큰 그림(앱 동전 그림 `popupArt` — 없으면 뷰로 그린 동전 + 반짝이 — 연한 주색 바탕 블록 132) · 큰 숫자 제목 「오늘 **+5,965P**」 줄바꿈 「모을 수 있어요」(서버 easy 합계, 숫자 34/900 주색 · 나머지 20/700, 가운데에서 말이 끊기지 않게 일부러 두 줄) · 한 줄 부제 「쉬운 미션 18개 · 하나에 5분이면 끝」(서버가 준 `minutes` 의 **가운데 값**, 없으면 개수만) · **넓은 강조색 버튼 하나**(「추천 보기」, 높이 52, 칩과 같은 노랑) · 「닫기」는 작은 글자 링크(14/600 보조색) · **커지며 뜨는 등장**(0.88→1 · 투명 0→1, 240ms, 네이티브 드라이버) · 배경 어둡기 0.4→0.55 · 글자 색은 쇼핑 탭 값(`text` / `sub`). `comboPopupContent(combos)` 가 문구를 만든다(easy 가 없으면 가장 큰 목표가 숫자: 「오늘 **1만P** 까지 모을 수 있어요」). `ComboEntry` 에 `popupArt` prop 추가. 팝업 시험 +4 · 위치와 동작(하루 한 번 · 「항상」 · 메인 팝업 경로)은 그대로.

## 0.3.7 — 미션 줄 왼쪽을 다시 번호로 (JS only)

대표님 10/27 21:03 「리스트 아까처럼 숫자로 하자」. 0.3.6 의 새 시트(흰 바탕 · 납작한 칩 · 한 줄 이름/할 일/포인트 · 줄 전체 탭 · 새 팝업)는 그대로 두고 **줄 왼쪽의 아이콘 자리만 번호 동그라미**로 바꿨다.

- **번호 동그라미**: 지름 30, 바탕 쇼핑 탭 회색(`chipBg` `#F2F4F6`), 숫자 14/700 `text`. 체크하지 않은 줄만 위에서부터 1 · 2 · 3 …(체크하면 아래로 내려가고 번호는 남은 줄로 **다시 1부터**), 체크한 줄은 동그라미에 보조색 ✓. 「한 번에 끝내기」 목록은 자기 번호를 1부터 센다. 화면 읽기용 라벨(`1번 …`)은 그대로.
- **서버 `icon`**: 파싱(https만)은 그대로지만 **줄에는 그리지 않는다**. `ComboMissionIcon` 은 그림이 필요한 곳을 위해 그대로 내보낸다.
- 시험: 줄 시험을 번호 기준으로 고치고 번호 다시 매기기 · 한 번에 끝내기 번호 시험 +2.

## 0.3.8 — 자동 체크 · 체크는 날이 바뀌어도 유지 (JS only; 0.3.7 + 이것, 0.3.7 은 발행되지 않고 이 판으로 대체)

대표님 10/27 「체크는 자동으로 되는 건가?」 · 「날이 바뀌어도 한 거 안 한 거 알아야 하니까」.

- **서버 `combos.done`**: 이 회원이 지금까지 적립받은 캠페인 키 목록(오늘 조합에 나온 키만). 문자열이나 숫자, 한 키 64자 이하, 중복 없이 최대 500개로 받는다(64자를 넘는 값은 키가 아니라 버린다). 없거나 비면 필드 없음(옛 응답과 호환).
- **자동 「다 함」**: 줄의 `campaignKey`(서버가 id 를 키로 주면 `id`)가 `done` 에 있으면 그 줄은 스스로 다 한 줄이다 — 아래로 내려가고, 남은 합계에서 빠지고, 번호는 남은 줄로 다시 1부터, 체크는 채워지고 **누를 수 없다**(진짜 적립된 것이라). `autoDoneIds(combos)` 가 그 줄 id 를 구한다. 손으로 누르는 체크는 나머지 줄에 그대로 된다.
- **손으로 누른 체크는 날짜로 지우지 않는다**: 회원별 · **캠페인 키별**(`mission.campaignKey`, 없으면 줄 id)로 기기에 계속 저장한다(`useDoneMissions({ storage, scope })`, 하루 초기화 없음, 회원당 최대 1000개 · 오래된 것부터 버림). 다음 날 줄 id 가 달라도 같은 캠페인 키면 그대로 다 한 줄이다. 다시 누르면 풀린다(서버가 「안 함」으로 되돌릴 근거는 없으므로). 저장 모양은 예전과 같은 `{ d, ids }` 라서 옛 버전도 읽을 수 있고, 예전 날짜로 저장된 값도 읽는다. `storage` 가 없으면 앱을 닫을 때까지 메모리(탭을 나갔다 들어와도 유지).
- **다시 받기**: 시트를 열 때 · 앱이 앞으로 돌아올 때(`AppState` `active`) · SDK 상세 화면이 닫힐 때(브리지 이벤트 `detailClosed`) `combos` 를 조용히 다시 받는다(`useTodayCombos().refresh()` — 로딩 표시 없이 줄은 그대로 두고, 받기에 실패하면 지금 화면을 그대로 둔다). 직전 받기 2.5초 안(`COMBO_REFRESH_GAP_MS`)이면 건너뛰고, 처음 받기도 그 시각에 센다. `AppState` 나 브리지가 없어도 던지지 않는다.
- 시험: `test/combos-autodone.test.cjs`(8개)와 옛 「날짜별 체크」 시험을 새 규칙으로 고침.

## 0.3.9 — 추천 팝업: 오른쪽 위 ✕ · 아래 「닫기」 삭제 · 선착순 안내 · 앱 광고 자리 (JS only)

대표님 10/27 22:01 「닫기는 상단 우측 엑스 버튼으로 바꾸고 닫기 제거하고 아래 네이티브 배너 광고 넣어」 · 22:02 「선착순 안내도 추가」. 0.3.8 위의 JS 한 가지 변경이다(네이티브 0.3.0 과 바이트 동일).

- **닫기**: 카드 **오른쪽 위 ✕**(34 동그라미, 접근성 라벨 `닫기`)로 닫는다. 아래 「닫기」 글자 링크는 없다. 어두운 배경을 눌러도 닫히는 것은 그대로. ✕ 는 카드가 스크롤돼도 제자리에 있다.
- **선착순 한 줄**(`COMBO_POPUP_NOTICE` = 「선착순 · 캠페인마다 인원이 차면 끝나요」): 큰 숫자 · 부제 아래 연한 주색 알약. 애드팝콘 캠페인은 수량이 차면 닫히는 것이 사실이라 그 뜻 그대로의 문장이다(약속이 아님). `comboPopupContent(combos)` 가 `notice` 로 준다.
- **앱 광고 자리**: `ComboEntry` 의 새 prop `popupAd?: () => ReactElement | null` 이 「추천 보기」 버튼 **아래**에 그려진다. 앱이 직접 위 간격(버튼과 광고 사이 16 이상)을 주고, 광고가 안 채워졌으면 null 을 돌려 자리가 남지 않게 한다. 에그머니는 기존 팝업 광고(`HarvestNative` 기존 단위 + `usePopupNativeOn`)를 그대로 넣는다 — 새 광고 단위 없음.
- **카드 높이**: 광고 카드는 커서 팝업 카드를 **화면 높이의 86%** 로 제한하고 그 안을 스크롤한다(`bounces` 끔 · 스크롤바 숨김). 그림 · 숫자 · 버튼 · 광고가 모두 한 스크롤 안에 있다.
- 시험 +3 · 옛 팝업 시험 4개를 새 모양에 맞게 고침.
- **참여 한도 소진(대표님 10/27 22:05)**: 애드팝콘이 「현재 캠페인의 참여 한도가 소진되어 참여할 수 없습니다」를 상세에서 띄워도 SDK 는 앱에 코드를 주지 않는다(문장이 SDK 안에 없다 = 서버 메시지; iOS 는 `onOpenCampaignDetailPage` / `onCloseCampaignDetailPage` 뿐, 안드는 `OnOpenSuccess` / `OnOpenFailed` / `OnClosed`). 그래서 **서버가 정한다**:
  - 응답 `soldout: ["campaignKey", …]` — 이 키(또는 키가 id 인 줄)의 줄은 단계 · 한 번에 끝내기 · 쉽게 모으기에서 모두 빠지고, 합계는 남은 줄로 다시 계산한다. 목표에 못 미치게 된 단계는 단계째 빠진다(지킬 수 없는 약속을 안 한다). **오늘 이미 적립받은(`done`) 줄은 그대로 남는다**(완료 줄). 다음 날 서버가 목록에서 빼면 자동으로 다시 보인다. 앱은 스스로 숨기지 않는다.
  - `onDetailSignal({result, campaignKey, platform, ms})` — 전체 회원, 키마다 한 번: `open_failed` = 상세를 못 열었거나(안드 `OnOpenFailed`, iOS 5초 안에 열림 신호 없음) 연 흔적이 없음(`ms` = 기다린 시간), `closed_fast` = 열린 뒤 15초(`COMBO_CLOSED_FAST_MS`) 안에 닫힘(`ms` = 머문 시간). 서버가 그 캠페인만 바로 마감 확인하는 **힌트**다(빠른 참여도 같게 보인다). 신호를 보낸 3초 뒤(`COMBO_SIGNAL_REFRESH_MS`) 오늘의 조합을 다시 받아 `soldout` 이 오면 줄이 바로 빠진다.
- **쉬운 미션은 서버가 보낸 만큼 전부**(15·20개로 자르지 않는다. 터무니없는 본문만 막는 300개 상한). 팝업 「쉬운 미션 n개」도 그 개수.

## 0.3.10 — 추천 팝업 손질: 카드 높이를 떠 있는 칸에 맞춤 · 동전 칸 반 · 제목 한 줄 · 숫자 안 잘림 · 작은 버튼 (0.3.9 의 고침 · JS only)

대표님 10/27 22:27~22:28 실폰 캡처(0.3.9 OTA acc92067)에서 나온 것을 한 판으로 고친다. 네이티브 diff 0.

- **카드 높이(✕ 가 보이게)**: 0.3.9 는 팝업 카드를 **화면 높이의 86 %** 까지만 키웠는데, 팝업이 뜨는 자리(찬스 탭의 오퍼월 칸)는 화면보다 작다(아이폰에서 684 정도). 광고 카드가 붙어 카드가 그 칸보다 커지면 위 · 아래가 잘려 ✕ 가 「포인트 빨리 모으기」 칩 줄 쪽으로 밀려났다. 이제 팝업 바깥 칸(`onLayout`)의 **실제 높이**를 재서 카드 `maxHeight` = 그 높이 − 위 44(`POPUP_TOP` · 칩 줄은 가리지 않고 눌림 그대로) − 아래 16(`POPUP_EDGE`), 최소 260. 재기 전에는 창 높이의 86 %. 넘치면(큰 광고) 안쪽이 스크롤되고 ✕ 는 카드 모서리에 그대로 있다.
- **동전 칸 반**: 위 노란 그림 칸 132 → **66**, 동전은 큰 것 96 → 48 · 작은 것 40 → 20(반짝이도 같이 작게).
- **제목 한 줄**: 「오늘 +5,597P 모을 수 있어요」(전에는 두 줄). 글자는 말 18 · 숫자 34 로 시작해, 카드 폭(276)에 안 들어가면 **둘이 같은 비율로** 줄어든다(최소 0.6 · `popupHeadlineSizes`, 6자리 P 도 들어감). `numberOfLines=1` + `adjustsFontSizeToFit` 이 안전망이다.
- **숫자 윗부분 안 잘림**: 말과 숫자가 **같은 lineHeight**(숫자 크기 × 1.25)를 쓴다 — 부모 줄 높이(30)보다 큰 안쪽 글자(숫자 34)가 iOS 에서 윗부분이 잘리던 것이 원인이었다.
- **「추천 보기」 버튼** 높이 52 → **36**(글자 17 → 15, 위 간격 18 → 14), **선착순 알약** 위 · 아래 여백 6 → 3(글자 13 → 12).
- 이 밖에 0.3.9 와 같다. 0.3.9 tgz 는 iOS OTA 한 번으로 이미 나갔고 같은 이름으로 바꿔 끼우면 잠금 무결성이 깨지므로 새 번호로 낸다.

## 0.3.11 — 무료체험: 동의 팝업 · 「무료체험」 탭 · 「무료체험 확인」 목록 · 푸시로 목록 열기 (JS only)

대표님 10/27 22:11~22:29. 서버(앱보조5)가 정한 계약 그대로이고 앱은 보여 주기만 한다. 네이티브 diff 0.

- **응답 필드**(`GET offerwall/combos`): `trials: [{campaignKey, name, icon(https만), points, trial_days, trial_hours, charge_amount(이후 월 원), cancel_after_hours}]`(합계 · 조합에 안 들어가는 별도 목록, 읽히지 않은 값은 키 없음), `trial_keys: [...]`(무료체험 캠페인 전체 키), `trial_consent: {키(소문자): true|false}`(이 회원이 이미 답한 것). 소진된 키(`soldout`)는 목록에서 빠진다(오늘 이미 받은 것은 남음).
- **「무료체험」 탭**: 시트 탭 줄 맨 끝(「쉽게 모으기 · 1천P · 5천P · 1만P · 무료체험」, 탭 줄은 가로로 밀린다). 탭 위에 한 줄 「끝나기 전에 해지하면 무료 · 해지 안내를 받을 수 있어요」, 줄은 번호 줄 모양(이름 · 「7일 무료 · 이후 월 16,500원」 · +P · 체크)이고 **합계는 없다**(위 합계와 따로). 누르면 `onPressTrial(trial)`(없으면 `onPressMission`에 미션 모양으로). `trialLine(trial)` · `trialMissions(combos)` · `COMBO_TRIAL_NAME` · `COMBO_TRIAL_NOTE`.
- **동의 팝업**: 캠페인 상세를 열기 전에 그 키가 `trial_keys`(또는 `trials`)에 있고 아직 답하지 않았으면(`trial_consent` 에도 이번 방문에도 없으면) 「무료체험이 끝나기 전에 해지 안내를 받으시겠어요?」 [안내 받기] [괜찮아요]. 둘 다 그 캠페인을 열고 답은 `onTrialConsent(campaignKey, agree)` 로 앱이 서버에 보낸다(`POST offerwall/trials/consent`, 실패해도 열린다). 어두운 배경 · 뒤로가기는 답이 아니다: 열지 않고 다음에 다시 묻는다. `onTrialConsent` 를 안 주면 묻지 않는다. 내 목록에서 누르는 줄은 이미 참여한 것이라 다시 묻지 않는다. `needsTrialConsent` · `isTrialKey`.
- **「무료체험 확인」**: 「포인트 빨리 모으기」 칩 **왼쪽**의 작은 버튼(`ComboTrialsChip`, 칩은 같은 줄에서 한 단계 작아진다). 앱이 `loadTrials()`(`GET offerwall/trials` 본문 전체)를 주고 서버가 체험을 켰을 때(`trials` 또는 `trial_keys` 가 옴)만 나온다. 누르면 내 목록 시트: 줄마다 아이콘 · 이름 · 「10/27 참여 · 11/3 결제 예정 · 월 29,900원」 · 상태 알약(체험 중 / 지금 해지 가능 / 결제 시작됨 — 서버가 계산). 해지할 때가 지났고 아직 해지 표시가 없으면 「해지했나요?」 [했어요] [아직] → `onTrialCancelled(campaignKey, true|false)`(`POST offerwall/trials/{key}/cancelled`), 했어요면 「해지 완료 ✓」가 바로 보이고 보내기가 실패하면 목록을 다시 받는다. 줄을 누르면 그 캠페인 상세. `parseMyTrials(body)` 는 모양이 틀리면 null(「목록을 불러오지 못했어요」 + 다시 불러오기).
- **푸시 → 목록**: `requestOpenTrials(campaignKey?)` — 칩이 있는 찬스 탭 화면이 아직 없으면 10초까지 기다렸다가 처음 뜨는 곳이 받는다(`requestOpenCombos` 와 같다). 그 캠페인 줄이 맨 위에서 강조된다.
- **칩 줄 간격**(대표님 10/27 22:47): 「무료체험」 버튼은 「포인트 빨리 모으기」 칩 바로 왼쪽에 8 띄워 붙고(`COMBO_CHIP_GAP`), 앱 자체 제목 「리워드 충전소」(왼쪽에서 약 150, `COMBO_TITLE_END`)와는 8 이상 떨어진다(`COMBO_TITLE_GAP`). 화면 폭에 맞춰 `comboChipFit(폭, 오른쪽 여백)` 이 글자를 고른다: 넓으면 둘 다 전체, 아이폰 402 · A32 411 은 칩이 「빨리 모으기」, 360 은 버튼도 「체험」(스크린리더 이름은 항상 전체).
- 새 props(모두 선택): `onTrialConsent` · `loadTrials` · `onTrialCancelled`. 안 주면 0.3.10 과 똑같이 동작한다.

## 0.3.12 — 동의 팝업 새 문구 (항목별 탭은 0.3.13)

- **동의 팝업 문구**(대표님 10/27 22:51): 제목 「무료체험, 안심하고 참여하세요」, 본문 「체험이 끝나기 전에 해지할 때를 알림으로 알려 드려요. 해지하면 돈이 나가지 않아요.」, 그 캠페인의 「7일 무료 · 이후 월 29,900원」 한 줄(서버 `trials` 에 있을 때), 버튼 [안내 받고 참여하기](강조) · [안내 없이 참여하기]. 둘 다 그 캠페인을 열고, 「안내 받고 참여하기」는 상세를 열기 전에 토스트 「해지 알림을 맞춰 뒀어요」(0.7초, `COMBO_CONSENT_TOAST_MS`)를 보여 준다. 문구 상수: `COMBO_CONSENT_TITLE` · `COMBO_CONSENT_BODY` · `COMBO_CONSENT_AGREE` · `COMBO_CONSENT_DECLINE` · `COMBO_CONSENT_TOAST`.

## 0.3.13 — 항목별 탭 · 두 칩 같은 크기 · 탭 터치 · 팝업 서버 숫자 · 알림 확인 (JS only)

대표님 10/27 22:49~23:11. 네이티브 diff 0.

- **항목별 탭**: 서버 `combos.categories` 가 있으면 시트 탭이 **카테고리 순서 그대로**(회원가입 · 팔로우·구독 · 앱 설치 · 무료체험 · 게임 · 쇼핑 · 보험 · 상담·조회 · 계좌·카드 · 그 밖)가 된다. 없으면 전과 같은 화면(쉽게 모으기 · 1천P · 5천P · 1만P · 무료체험).
  - 응답: `categories: [{ key, title, total_points(null = 합계 없음), count, items: [{ campaignKey, name, icon, points, line, done, cost, trial_days, charge_amount }] }]` — 배열 순서 = 탭 순서, 탭 안은 P 큰 순, `total_points` 는 돈이 안 드는(`cost` 없는) 항목의 합, 빈 탭은 안 온다. `key`/`title` 모르는 키는 `CATEGORY_TITLES` 로 이름을 붙이고 이름도 모르면 뺀다. 마감 키는 빠지고(오늘 받은 것은 남음), 한 탭 600개 상한.
  - 탭 맨 위 한 줄: `total_points` 가 있으면 항상 「다 하면 +N P」 하나(앞말은 탭마다 안 바뀐다 — 서버 합계에서 이미 한 돈 안 드는 줄만 빼고, 다 했으면 「모두 마쳤어요」). **서버가 `total_points` 를 null 로 준 탭(게임 · 쇼핑 · 무료체험, 23:04~)은 합계 줄이 아예 없다** — 앱이 줄 P 를 더해 채우지 않는다. 무료체험 탭만 그 자리에 「끝나기 전에 해지하면 무료 · 해지 안내를 받을 수 있어요」.
  - 줄은 지금 번호 줄 그대로: 번호 · 이름 · 조건 한 줄(`line`; 게임은 「목표 · 기한」) · +P · 체크. **`cost` 가 있으면 줄 아래 작은 주황 알약**(「월 1,100원」 「보험료 납입 필요」 「3만원 이상 구매」), 없으면 없음. 서버가 `done: true` 로 준 줄은 ✓ 로 아래로. 많은 탭(게임 230개)은 **40개씩 「더 보기」**.
  - 줄을 누르면 `onPressMission` 에 캠페인 키가 `id` · `campaignKey` 인 미션으로 간다. 무료체험 줄은 동의 팝업 → 상세(팝업의 「7일 무료 · 이후 월 …원」 은 그 줄의 `trial_days` · `charge_amount` 에서). `ComboCategoryScreen` · `categoryMissions` · `trialTerms` · `COMBO_CATEGORY_PAGE`.
- **칩 두 개 같은 크기**: 「무료체험」 버튼과 「포인트 빨리 모으기」 칩이 **같은 높이(34) · 같은 너비 · 같은 글자 크기 · 같은 둥글기**(색만 다름: 흰 바탕 노란 테두리 / 노랑). 폭이 모자라면 둘이 같이 줄어든다: 넓은 화면은 전체 이름, 아이폰 402 · A32 411 은 「빨리 모으기」 / 「무료체험」, 360 폭은 「모으기」 / 「체험」(스크린리더 이름은 항상 전체). 제목 「리워드 충전소」(왼쪽에서 약 150)와는 8 이상 떨어진다. `comboChipFit(폭, 오른쪽 여백)`.
- **탭 터치**(「눌렀다 안 눌렀다」): 탭 칩은 터치 영역이 넓고(`COMBO_TAB_HIT_SLOP`, 높이 34 → 36), 누르는 즉시 색이 바뀌고, 가로 칩 줄이 터치를 시트 제스처 · 스크롤에 안 넘기게 한다(`keyboardShouldPersistTaps` · `nestedScrollEnabled` · `directionalLockEnabled`). **선택한 탭은 위치가 아니라 key 로 기억**해서(쉬운 미션 탭이 앞에 생기거나 탭이 빠져도, 다시 받아도) 그 탭에 그대로 있다.
- **팝업 숫자**: 서버 `combos.popup { points, count }`(돈 안 드는 것 + 무료체험, 게임 · 쇼핑 제외)가 있으면 「오늘 +N P 모을 수 있어요」 아래에 「미션 n개」(「쉬운」 없이). 없으면 전과 같이 `easy` 로.
- **동의 팝업은 「무료체험」 탭에 들어갈 때 한 번**(대표님 23:14 · 줄을 누를 때 뜨던 0.3.11/0.3.12 팝업은 없어졌다): 제목 「무료체험, 안심하고 참여하세요」 · 본문 · 「여기 있는 체험은 끝나면 자동 결제돼요. 끝나기 전에 해지 알림을 보내 드려요.」 · 강조 버튼 **「해지 알림 켜고 참여하기」** · 「괜찮아요」(바깥 · 뒤로가기도 같다). 앱이 `onTrialConsent` 를 줄 때만, 이 방문에서 아직 안 눌렀을 때만 뜬다. 위 칩 옆 「무료체험」 버튼(내 목록)에는 안 뜬다. 판정은 화면이 탭에 들어올 때 부르는 `onTrialTab`(단계 화면의 「무료체험」 탭 · 카테고리 화면의 `trial` 탭 둘 다).
  - **「해지 알림 켜고 참여하기」**: ① 앱이 `onTrialNotify` 로 OS 알림 권한을 묻고(거절 상태면 설정으로 안내하고 돌아오면 다시 확인) 푸시 토큰을 다시 등록해 `'on' | 'off' | 'none'` 을 돌려준다 ② **기기에 저장**(회원별, 다시 안 묻는다: `useTrialNoticeAgreed`) ③ 토스트 — `'on'` 「해지 알림을 맞춰 뒀어요」 / 그 밖 「알림이 꺼져 있어 안내를 못 받아요」. 알림이 꺼져 있어도 저장은 된다. 이 뒤로는 **체험 줄을 누르면 팝업 없이 그 캠페인 동의(`onTrialConsent(key, true)`)를 자동 저장하고 바로 상세**.
  - **「괜찮아요」**: 그날은 다시 안 띄우고(`trialNoticeDeclineKey`, 한국 날짜 단위) 다음 날 탭에 들어가면 다시 묻는다. 저장도 전송도 하지 않는다 — 이 상태에서 줄을 누르면 묻지도 저장하지도 않고 그냥 상세를 연다.
  - 앱 알림 설정의 「새 혜택과 이벤트」 스위치(광고성 수신 동의)는 **건드리지 않는다**: 해지 안내는 동의자에게 그 스위치와 무관하게 서버가 보낸다(앱보조5, 23:16).
- **「무료체험 확인」 목록의 버튼은 「해지했어요」 하나**(대표님 23:16): 해지 시점(72시간)이 안 됐어도 모든 줄에 있다(해지했나요? 문구는 해지할 때가 된 줄에만). 누르면 그 줄이 「해지 완료 ✓ · 알림을 그만 보낼게요」(`COMBO_CANCELLED_TEXT`)가 되고 서버에는 `onTrialCancelled(key, true)`. 「아직」 버튼은 없어졌다. 푸시를 누르면 그 줄이 맨 위에서 강조된다(0.3.11 그대로).

## 0.3.14 — 자정 직후 어제 문서가 와도 칩 · 시트가 사라지지 않게 (JS only)

대표님 10/28 00:00 「없어졌어」. 서버가 자정 직후 몇 분 동안 어제(10-27) 문서를 내려 주었는데, 0.3.13 까지는 `combos.date` 가 오늘(한국)이 아니면 **통째로 버렸다**(`parseCombosBody` 가 `stale` 로 거절 + `useTodayCombos` 가 렌더마다 어제 문서를 숨김). 그래서 칩과 시트가 비어 사라졌다. 네이티브 diff 0.
- **지난 날짜 문서도 그대로 보여 준다**: `parseCombosBody` · `fetchTodayCombos` · `loadTodayCombos` 는 날짜가 있는 문서면 `{ ok: true, combos, stale: true }` 로 돌려준다(오늘 문서는 `stale` 없음). 날짜가 아예 없는 응답은 예전처럼 `{ ok: false, reason: 'stale' }`(어제 것인지 구별 불가).
- **어제 「다 함」 표시는 뺀다**(`withoutDone`): 지난 날짜 문서는 `combos.done` 과 `categories[].items[].done` 을 비워서 **어제 한 것이 오늘 한 것처럼 보이지 않는다**(줄 자체는 같은 캠페인이라 그대로). 문서별로 캐시되어 렌더마다 같은 객체가 나온다.
- **오늘 문서가 올 때까지 60초마다 다시 받는다**(`COMBO_STALE_RETRY_MS`, 지난 문서를 들고 있는 동안만 · 오늘 문서가 오면 멈춘다). 자정 +5초 재요청은 그대로. 앱 쪽 변경은 없다(앱이 날짜를 따로 비교하지 않는 경우).
- `useTodayCombos` 는 자정이 지나 렌더되어도 가지고 있던 문서를 숨기지 않고 같은 규칙(done 표시 없이 보여 주고 다시 받기)을 쓴다.

## 0.3.15 — 캠페인 777개 · 응답 335KB 에서도 가볍게: 모든 화면 40개씩 · 렌더 계산 캐시 · 시트 열림 ms 훅 (JS only)

대표님 10/28 00:3x. 자정 한도 초기화로 캠페인이 777개로 늘어(쉬운 미션 186 · 게임 210 · popup 221개) 응답이 335KB 가 됐다. 네이티브 diff 0.
- **모든 탭이 40개씩 「더 보기 (N개 남음)」**(`COMBO_PAGE_ROWS` = 40): 항목별 탭 화면(`categories`)은 0.3.13 부터 그랬고(`COMBO_CATEGORY_PAGE` 는 같은 값), **옛 화면**(`categories` 가 없을 때: 쉬운 미션 최대 300줄 · 단계 · 무료체험 최대 100줄)에도 같은 규칙이 생겼다. 탭마다 자기 개수를 기억한다. 줄은 번호 · 이름 · 조건 · +P · 체크뿐이라 **줄마다 로드할 이미지가 없다**(아이콘은 옛 화면의 `ComboIcon` 만 쓰고, 그것도 마운트된 40줄만 불러온다) — 40개씩만 마운트하니 긴 목록을 따로 가상화할 일이 없다(186줄 탭: 첫 화면 요소 약 305개, 끝까지 펼쳐도 약 1,370개).
- **서버 개수 상한 없음**: 한 탭 600줄까지 그대로 읽는다(`MAX_CATEGORY_ITEMS`, 쉬운 미션 옛 필드는 300). 777캠페인 합성 응답으로 줄이 빠지지 않음을 시험했다(`test/combos-big.test.cjs`).
- **렌더마다 도는 계산은 문서별로 한 번만**: `autoDoneIds` · `categoryMissions` · `trialMissions` · 새 `missionRowsOf`(모든 미션 줄을 합친 목록, `ComboEntry` 가 쓴다)를 문서 객체별 `WeakMap` 에 캐시한다(문서는 파싱 뒤 바뀌지 않고 새 문서는 새 객체). 같은 문서면 같은 객체가 돌아온다.
- **시트 열림 시간 재기**: `ComboEntry` 의 새 `onSheetShown(info)` — 시트를 연 렌더부터 첫 화면이 그려진 뒤 2프레임까지의 **ms** 와 `{ tabs, rows(첫 탭의 첫 쪽), total(서로 다른 캠페인 수) }` 를 시트를 열 때마다 한 번 알려 준다. **패키지는 아무 데도 보내지 않는다**; 앱이 로그로 남겨 실기기(안드 `adb logcat` · iOS 콘솔)에서 읽는다(예 `console.log('[combos] sheet shown', JSON.stringify(info))`). 던져도 시트는 그대로.
- 측정(10/28, 777캠페인 합성 응답 246KB · V8 기준, 이 PC 에 Hermes 실행기가 없어 Hermes 값은 아님): `JSON.parse` 0.3ms · 정규화(`parseCombosBody`) 0.4~0.7ms · 렌더마다 도는 계산 0.1ms 미만. Hermes(인터프리터)는 이런 반복문에서 보통 10~30배 느려 아이폰 수십 ms 이하로 예상하지만 **추정**이다 — 실제 숫자는 위 `onSheetShown` 로그로 확인한다.
- 팝업 숫자 6자리(+157,090P)는 **이미 한 줄**: `popupHeadlineSizes` 가 폭(276)에 맞춰 숫자 글자를 34 → 28pt 로 줄인다(최소 0.6배 = 20pt, +999,999P 도 한 줄).

## 0.3.16 — 아이폰 목록 「준비 중」 응답(iOS 키만 · `preparing` · `notice`)에서도 칩이 사라지지 않게 (JS only)

앱보조5 10/28 01:01. `x-ota-platform: ios` 면 서버가 iOS 키가 있는 캠페인만 내려 주고(처음엔 5개), 응답에 `preparing`(boolean, iOS 키 30개 미만이면 true)과 `notice`(문장, 예 「아이폰 목록을 준비 중이에요」)가 붙는다. 안드는 그대로(`preparing` false · `notice` null). 네이티브 diff 0.
- **0.3.15 까지의 문제**: `bundles`(목표별 묶음 — 줄들이 목표 포인트를 채워야 성립)가 비어 있고 `categories` 만 있는 응답, 또는 줄이 하나도 없는 응답을 「잘못된 응답」으로 버려서 칩 · 시트가 통째로 안 보였다(5개짜리 iOS 목록에는 묶음이 안 만들어진다).
- **이제**: `bundles` 가 없거나 비어도 `categories` 에 줄이 있으면 정상 문서이고, `preparing: true` 면 줄이 하나도 없어도 정상 문서다(칩 유지). 둘 다 아니면 예전처럼 버린다(`preparing` 이 문자열 `'true'` 등이면 무시). `TodayCombos` 에 `preparing?: true` · `notice?: string`(**`preparing` 일 때만**, 줄바꿈 정리 · 80자까지)이 생겼다. 안드 응답(`preparing` 없음)은 달라지는 게 없다.
- **시트 맨 위에 `notice` 한 줄**(두 화면 모두 — 항목별 탭 화면 · 옛 단계 화면): 회색 알약 칸에 서버 문장. 줄이 하나도 없으면 그 문장만 보이고 「지금은 준비하고 있어요」 두 번째 문구는 안 나온다(`comboNoticeOf(combos)`).
- **줄이 없으면 부르지 않는다**(`hasComboRows(combos)`): 추천 팝업은 뜨지 않고(그날의 한 번 기회도 쓰지 않는다), 홈 배너도 안 나온다. 칩은 항상 보인다.
- 어제 문서(0.3.14 의 `stale`)도 `preparing` · `notice` 를 그대로 가진다.

## 0.4.0 — 포인트 빨리 모으기 화면 전부 패키지 안으로 · iPhone 목록 읽기 · 상세 열림/닫힘 이벤트 (새 빌드 + 옛 빌드 OTA, tgz 하나)

**한 판으로 두 곳에 쓴다.** (A) 지금 운영 중인 바이너리(대부분 0.2.2/0.2.3 네이티브: 뷰 `JCurveOfferwallView` 하나뿐, `JCurveOfferwallModule` 없음)에는 **JS 만 OTA** 로 나간다. (B) 새 스토어 빌드에는 같은 tgz 의 네이티브가 컴파일되어 들어간다. JS 가 모듈과 `getOfferwallNativeCapabilities().methods` 를 스스로 확인해서, 없는 기능은 그 기능만 꺼진다(모듈 안 찾기는 `NativeModules` 속성 조회뿐 — `require` 없음, import 순간 실행되는 호출 없음, throw 없음).

### 앱이 하는 일 — 키 · 주소 · 광고 단위 · 색/이름뿐

```tsx
import { OfferwallCombos, OfferwallScreen } from '@jcurve/offerwall';

<View style={{ flex: 1 }}>
  <OfferwallScreen /* 기존 그대로 */ />
  <OfferwallCombos
    placement="chance"               // 'chance' = 오퍼월 위 칩 · 'home' = 홈 배너
    usn={usn}                        // GET offerwall/adpopcorn/usn 이 준 64자
    memberId={member?.id}            // 없으면 아무것도 안 그리고 아무것도 요청하지 않는다
    serverUrl={API_BASE}             // 앱 서버 주소 (offerwall/… 앞까지)
    getAuthHeaders={() => ({ 'X-App-Token': TOKEN, Authorization: 'Bearer ' + session.token, ...ota })}
    onUnauthorized={dropSession}     // 서버가 401 을 주면 알려 줌 (선택)
    tokens={{ C, R, F, shadow }}     // 앱의 색 · 둥글기 · 글자 크기 (comboThemeFromTokens 와 같다)
    theme={{ /* 낱개로 덮을 값 */ }}
    popupArt={require('./coin.png')} // 추천 팝업 위 그림 (없으면 동전을 그린다)
    adUnit={{ ios: '…', android: '…' }}  // 추천 팝업 아래 네이티브 광고. 없으면 광고도 자리도 없다
    popupAd={remoteAdOn}             // 앱의 끔 스위치 (기본 true)
    isTestMember={async () => …}     // 시험 회원 판정 (없으면 아무도 아님; 알 수 없으면 null → 이번엔 아님, 다음에 다시 물음)
    syncPushToken={syncPushToken}    // 무료체험 알림 허용 뒤 푸시 토큰을 앱 서버에 다시 올리는 앱 함수
  />
</View>
```

앱에 자기 요청 계층(401 처리 · 재시도 · 기기/OTA 헤더)이 이미 있으면 `serverUrl`/`getAuthHeaders`/`onUnauthorized` 대신 `client={{ get: (path) => …, post: (path, body) => … }}` 를 넘길 수 있다(경로는 `offerwall/combos` 처럼 앱 서버 기준 상대 경로). 에그머니가 이 방식이다.

앱 코드에 남는 것: 위 값들과 알림을 눌렀을 때의 화면 이동(`comboPushTarget(data)` 가 `'combos' | 'trials' | null` 을 주고, 열기는 기존 `requestOpenCombos()` / `requestOpenTrials(campaignKey)`). **앱에서 사라지는 것**: `EggCombos`류 글루 전부 — 요청(`offerwall/combos` · `campaigns` · `combos/diag` · `trials` · `trials/consent` · `trials/{key}/cancelled`), 시험 회원 분기, 「항상」 팝업 막기(`hasAlwaysPopup`/`dropAlwaysPopup`), 요청 본문(`campaignsBody` · `diagBody` · `detailSignalBody`), 푸시 길(`isTrialsRoute` · `pushCampaignKey` · `comboPushTarget`), 알림 권한 묻기(`ensureTrialNotify`), 팝업 네이티브 광고(`OfferwallPopupAd`), iPhone 목록 읽기와 올리기. 화면을 직접 짜는 앱은 같은 함수들(`createOfferwallClient` · `createComboHandlers` · 위 본문 함수)을 따로 쓸 수 있다.

**서버 약속(앱보조5, 10/28 02:13 서버 반영)**
- `GET offerwall/combos` 의 `display`: `chance`(`chip`|`off`) · `home`(`banner`|`off`) · `chance_popup`(`off`|`always`|없음) · `list_tap`(`"on"` 일 때만 켜짐, **없거나 다른 값 = 꺼짐**). 칩과 따로 움직인다 — iOS 에서 칩이 꺼져도 `{chance:"off", home:"off", chance_popup:"off", list_tap:"on"}` 로 내려온다. 켜져 있는데 목록이 없으면 빈 문서(`bundles []` · `categories []` · `preparing true`)가 200 으로 온다. 꺼져 있고 목록도 없으면 404 `no_combos`.
- **서버가 말해야 켜진다**: 응답이 없거나 실패하면 아무것도 안 보이고, `display.chance` 가 없는 응답은 칩을 **끈 채**로 둔다(`guardedBody`). 캠페인 키가 앱마다 · OS 마다 달라 서버가 앱별 · OS별로 켜 준다.
- `POST offerwall/campaigns`: `campaigns[{campaignKey ≤128, name ≤255, reward 정수, info? ≤1500, icon? https ≤300}]`, 한 번에 600개 · 분당 20회. 시험 회원은 바로 쓰이고 일반 회원(iOS)은 서로 다른 회원 2명 이상이 같은 키를 올려야 화면에 쓰인다. 긴 값은 서버가 잘라 저장한다(422 없음).
- 시험 회원만 보내는 것: SDK 목록(`campaigns`), 하러 가기 진단(`combos/diag` 의 `t:'tap'`). 전체 회원이 보내는 것: 상세 신호(`combos/diag` 의 네 칸 result · campaignKey · platform · ms), iPhone 목록 읽기를 서버가 켜 준 회원의 목록.

### iPhone 목록 읽기 (웹 탭) — 서버 스위치 `display.list_tap`, 기본 꺼짐

iOS 의 애드팝콘 오퍼월 목록(「전체 미션」)은 SDK 안의 웹 화면이고 JS 가 읽을 수 있는 API 가 없다. 서버가 켠 회원의 iPhone 에서만(`display.list_tap:"on"`, iOS, 0.4.0 네이티브 모듈이 있을 때만) 네이티브가 그 웹 화면에 **읽기 전용 스크립트**를 넣는다. 서버가 `list_tap` 을 안 주면 `setWebTap` 은 **한 번도 호출되지 않고** 웹뷰 가로채기(`-[WKWebView initWithFrame:configuration:]` 교체)는 설치되지 않는다 — 심사 빌드는 이 상태로 나간다(`startWebTap` 이 처음 `enabled:true` 로 불릴 때 처음 한 번만 설치).
- **읽는 것(화이트리스트)**: 캠페인 키 · 이름 · 보상(정수) · 설명 한 줄 · 아이콘(https) · 상세의 참여 안내 글. 모양 확인용 `shape` 메시지는 **키 이름만**(값 없음) — 앱은 `[combos] tap shape` 로 로그만 남긴다.
- **절대 안 읽는 것**: 캠페인 `Auth` 토큰 · `getParameter`(앱 키 · 회원 · 광고 ID 가 든다) · `EventBody`/`EventParam` · usn · ifa · 쿠키 · 헤더. 스크립트가 버리고, 네이티브가 한 번, JS `parseTapMessage` 가 한 번 더 걸러낸다. 호스트가 `*.offerwall.adpopcorn.com` 이 아닌 페이지에서는 스크립트가 아무것도 설치하지 않고, 네이티브 핸들러도 메인 프레임 · 같은 호스트의 것만 받는다.
- **올리기는 드물게**: 목록은 오퍼월을 열 때마다 오지만 앱은 10분 간격으로 최대 한 번, **같은 날 같은 목록이면 다시 올리지 않고**(회원별 기록을 기기에 남김) 상세 글은 다음 목록 올리기에 얹어 보낸다. 실패하면 나중에 다시(세 번까지). 스위치가 꺼지거나 404 가 오면 스크립트를 끈다(새로 만들어지는 웹뷰부터 적용).
- **약관 확인 전**이다. 애드팝콘 문의 초안(`adpopcorn-api-inquiry-draft-1028.txt`)의 5번 질문이 이 점이고, 켤지는 승인 · 답변 뒤 대표님이 정한다. 그때까지 서버는 모든 앱에서 끈다.

### 0.2.x 바이너리에서 켜지는 / 꺼지는 기능

바이너리 세대: **0.2.x** = 지금 운영 대부분(뷰만, 모듈 없음) · **0.3.0** = 에그머니 1.1.6 TF(모듈 · `detailCampaignKey` 있음) · **0.4.0** = 이번 새 빌드. 표의 「JS」는 이 tgz 의 JS 를 OTA 로 얹은 것.

| 기능 | 0.2.x 바이너리 (JS OTA) | 0.3.0 바이너리 (JS OTA) | 0.4.0 새 빌드 |
|---|---|---|---|
| 칩 · 안내 시트(항목별 탭 · 쉽게 모으기 · 한 번에 끝내기 · 합계) | **켜짐** | 켜짐 | 켜짐 |
| 찬스 탭 추천 팝업 · 「항상」(시험 회원) · 앱 광고 자리 | **켜짐** | 켜짐 | 켜짐 |
| 무료체험 동의 · 「무료체험」 탭 · 「무료체험 확인」 목록 · 푸시로 열기 | **켜짐** | 켜짐 | 켜짐 |
| 무료체험 알림 권한 묻기(`ensureTrialNotify`) | 켜짐(`expo-notifications` 가 앱에 있을 때) | 켜짐 | 켜짐 |
| 자정 · 어제 문서 · 40개씩 더 보기 · 준비 중(`preparing`) 응답 | **켜짐** | 켜짐 | 켜짐 |
| 하러 가기 → 상세 바로 열기 / SDK 목록에서 이름 찾기 | **꺼짐**(모듈 없음) → 이름을 보여 주고 찬스 탭 목록을 펼침 | 켜짐 | 켜짐 |
| 이름 복사 | **꺼짐** → 복사 시도 없이 「이름을 기억해 두세요」 | 켜짐 | 켜짐 |
| 상세 닫힘 신호(`closed_fast`) · 열림 실패 신호(`open_failed`) | **꺼짐** | 켜짐 | 켜짐 |
| 시험 회원의 SDK 목록 올리기 · 하러 가기 진단 | 꺼짐(목록 읽기 불가) · 진단은 `bridge:false` 로 올라감 | 켜짐 | 켜짐 |
| 임베드 `<OfferwallView detailCampaignKey>` 의 캠페인 상세(iOS, `pageType 5`) · 상세 열림/닫힘 뷰 이벤트 | 꺼짐(뷰에 prop 안 넘김) | iOS 는 상세가 아니라 목록이 뜸(0.3.0 은 `pageType 0` 이라 키를 무시) | **켜짐** |
| iPhone 목록 읽기(웹 탭) · 올리기 | **꺼짐**(`setWebTap` 없음 → `{ok:false}`) | 꺼짐 | 서버 `list_tap:"on"` 일 때만 |
| 안드 SDK 목록 읽기 | 꺼짐 | 켜짐 | 켜짐 |

- 모듈이 없을 때 새 뷰 prop(`campaignKeys` · `detailCampaignKey` · `onDetailOpened` · `onDetailClosed`)은 **네이티브 뷰에 넘기지 않는다**(0.2.x 뷰가 모르는 prop 은 오류가 된다). 뷰는 `usn` · `onLoaded` 만 받는 옛 모양 그대로다.
- 위의 「꺼짐」은 그 기능의 버튼 · 칩 · 탭이 보이고 아무 일 없는 상태가 아니라, 그 기능 대신 쓰는 폴백이 도는 것이다(하러 가기는 이름 안내 + 목록 펼침).

### 0.2.3 → 0.4.0 변경 목록 (앱이 알아야 하는 것)

- **그대로인 것(바이트 동일)**: `app.plugin.js` · `react-native.config.js`. 새 권한 · `Info.plist` 키 · `AndroidManifest` 항목 · 앱 플러그인 옵션 **없음**. Android 쪽 gradle 의존성 추가 없음.
- **바뀐 것**: `JCurveOfferwall.podspec` — `s.frameworks = 'WebKit'` 한 줄.
- **네이티브 추가(새 빌드에서만 컴파일, OTA 에는 실리지 않는다)**
  - 0.3.0: Android `JCurveOfferwallModule.java`(+`JCurveOfferwallPackage` 등록 · `JCurveOfferwallViewManager` 에 `campaignKeys`) · iOS `JCurveOfferwallModule.m`(상세 열기 · 커스텀 목록 · 참여 시도 · 클립보드 · 이벤트 등, 위 0.3.0 표) · iOS 뷰 `detailCampaignKey`.
  - 0.4.0: iOS `JCurveOfferwallWebTap.h/.m`(웹뷰 스크립트 주입, 서버 스위치가 켜질 때만 설치) · `JCurveOfferwallModule.m`(`setWebTap` · `JCurveOfferwallTap` 이벤트 · `detailOpened` 이벤트 · capabilities 에 `bridge:2`) · `JCurveOfferwallViewManager.m`(`detailCampaignKey` 가 있으면 `pageType = 5`, `onDetailOpened`/`onDetailClosed`). Android 는 0.3.0 에서 바뀐 것 없음(`closeOfferwall` · `setWebTap` 은 Android 에 없고 JS `call()` 이 `E_UNSUPPORTED` 로 끝낸다).
- **JS 추가**: `OfferwallCombos` · `createComboHandlers` · `createOfferwallClient` · `campaignsBody`/`diagBody`/`detailSignalBody`/`hasAlwaysPopup`/`dropAlwaysPopup`/`listTapSwitch`/`guardedBody` · `comboPushTarget`/`isTrialsRoute`/`pushCampaignKey` · `ensureTrialNotify`/`defaultTrialNotifyDeps`/`notifyState` · `OfferwallPopupAd`/`popupAdAvailable`/`popupAdUnit` · `startWebTap`/`parseTapMessage`/`WEB_TAP_*` · `createTapUploader`. `TodayCombos.display.listTap` 신설.
- **동작이 바뀐 것**: (1) 복사할 수단이 없으면 복사를 시도하지 않고 「…찾아 주세요 · 이름을 기억해 두세요」(이전엔 「…찾아 주세요」만). (2) `display` 에 `list_tap:"on"` 만 있는 문서도 받는다(칩은 끈 채). (3) `OfferwallCombos` 로 쓰면 `display.chance` 가 없는 응답은 칩을 켜지 않는다(`ComboEntry` 를 직접 쓰는 옛 방식은 예전 기본값 `chip` 그대로).
- **선택 peer(없어도 import 가 깨지지 않는다)**: `react-native-google-mobile-ads`(팝업 광고) · `expo-notifications`(알림 권한) · `@react-native-async-storage/async-storage`(체크 · 오늘 봤음 표시 저장).
- **확인 상태**: 단위 테스트 275개(손으로 만든 React 대역 위) 통과, `tsc` 통과. **네이티브(ObjC · Java)는 아직 컴파일해 본 적이 없다** — 첫 컴파일은 맥북16 빌드 잡(에그머니 iOS)이고, 웹 탭 스크립트는 Node `vm` 의 가짜 페이지에서만 돌려 봤다. 실기기 · 시뮬레이터 확인 전이다.

## 0.4.1 — iPhone 목록 읽기가 실제로 돌게 (JS만 · 네이티브 변경 없음 · 0.4.0 새 빌드 위에 OTA 가능)

**원인(에그머니 iOS 1.1.7 실기기, 10/28 대표님 아이폰)**: 웹 탭의 스크립트는 `setWebTap(enabled:true)` 뒤에 **새로 만들어지는** 웹뷰에만 들어간다. 그런데 오퍼월 웹뷰는 `OfferwallView` 의 첫 레이아웃에서 바로 만들어지고, 서버의 `display.list_tap:"on"` 은 `GET offerwall/combos` 응답 뒤에야 알게 되므로, 평소 첫 방문에서는 **웹뷰가 탭보다 먼저 있었고 스크립트가 한 번도 들어가지 못했다.** 그래서 업로드는 옛 방식(SDK 목록의 키 · 이름뿐)만 갔다.

고친 것
- **웹뷰 다시 만들기**: 탭이 켜진 뒤 `OfferwallView` 가 **마운트된 지 30초 안**이면 네이티브 뷰를 한 번 더 마운트한다(`key` 변경) → 새 웹뷰에 스크립트가 들어간다. 탭이 이미 켜진 채 마운트되었거나, 보고 있던 지 30초가 넘었으면 건드리지 않는다. (`webTapGate.ts`)
- **일찍 시작**: 서버가 마지막으로 준 명시적 「켜짐」을 기기에 7일간 기억해(`jcurve.offerwall.listtap:<회원>`) 다음에는 마운트 때 응답을 기다리지 않고 탭을 시작한다. 서버가 「꺼짐」이나 404 를 주면 바로 끄고 「꺼짐」을 기억한다. 「서버가 말해야 켜진다」 규칙은 그대로다(기억도 서버의 명시적 응답이 만든 값).
- **진단**: 스크립트가 시작하면 `hello`(호스트 · 문서 상태)를, 페이지가 부르는 경로를 `net`(경로만, 쿼리 없음, 최대 12개)으로 알린다. 시험 회원 기기는 시작 25초 · 100초 뒤에 `POST offerwall/combos/diag` 로 요약 `{t:'webtap', started, reason, hello, lists, maxList, details, natives, shapes, paths[]}`(개수 · 경로 이름뿐)를 올린다 — 목록이 안 올 때 어디서 막혔는지(시작 실패 / 스크립트가 안 뜸 / 다른 경로) 서버에서 읽을 수 있다. 콘솔에는 `[combos] tap hello|list|shape` 로 남는다.
- 기타: `OfferwallScreen` 의 `StyleSheet.absoluteFill` 펼침을 같은 값의 객체로 바꿨다(새 RN 타입 호환, 동작 같음).

## 0.4.2 — 목록을 실제 필드 이름으로 읽기 (JS만 · 네이티브 변경 없음 · 0.4.0 새 빌드 위에 OTA 가능)

**원인(에그머니 iOS 1.1.7 실기기, 10/28 13:32 대표님 아이폰)**: 0.4.1 로 스크립트는 들어갔다(`hello` 1 · 경로 11개) 그런데 `lists 0 · shapes 1`. 0.4.0/0.4.1 의 파서는 미션 줄을 `CampaignKey` · 숫자 `Reward` 로 찾았고, 애드팝콘 오퍼월 페이지의 실제 줄은 그렇지 않다. 페이지의 공개 코드(`offerwall.adpopcorn.com/assets/*.js`)와 안드로이드 A32 실응답(키 이름 · 형식만 받음)이 같다:
`POST /ap/v3/sdk/media/campaigns` → `{ Result, IsTest, ResultCode, ResultMsg, CampaignList: [ { Key, Title, Description, IconImage, MainImage, Reward: { Quantity, Unit }, ParticipationStep: [..], RewardCondition: [..], Auth, … 33칸 } ] }` (안드 456줄 · 약 1.4MB). `CampaignKey` · `IconUrl` · 숫자 `Reward` 는 라이브커머스 줄의 이름이고 그 줄은 `PartiTypeCode` · 방송 시간도 가진다 — 미션이 아니다. `/api/v1/list/adpopcornof` 는 오퍼월 코드에 없다(광고 SSP 웹 SDK 호출).

고친 것
- **읽는 이름**: `Key` · `Title` · `Description`(400자) · `Reward.Quantity` · `IconImage`(없으면 `IconUrl` · `MainImage`, https 만) · `ParticipationStep` + `RewardCondition` 문장 → `info`(1500자). 이전 이름(`CampaignKey`)은 라이브커머스 모양이 아닐 때만 받는다. `CPMCampaignList` 는 건너뛴다.
- **큰 목록**: 응답은 1.4MB 지만 밖으로 나가는 건 화이트리스트 필드뿐이다. 그래도 네이티브 메시지 상한(1,500,000자)을 넘지 않도록 한 메시지가 60만 자를 넘으면 나눠 보낸다(보통 한 메시지, 456줄 약 20만 자).
- **업로드 합치기**: 페이지가 탭(영역)마다 따로 목록을 부르므로, 업로더가 마지막 메시지만 쓰지 않고 읽는 동안 본 캠페인을 키로 합친다(새 줄이 옛 줄을 바꿈, 800줄까지).
- **진단 `resp`**: 페이지가 받은 응답마다(경로당 3번, 미션 목록은 6번, 모두 16개까지) 종류(`json|html|jsonp|text|empty|big`) · 상태 · 길이 · 최상위 키 이름 · 배열 이름/길이/첫 줄의 키 이름 · 첫 줄 안 객체의 키 이름을 올린다 — **값은 한 글자도 안 나간다**(`cleanResp` 가 30자 이름과 숫자만 남김). 시험 회원의 `webtap` 요약(`resp: [...]`)에 실린다. 콘솔: `[combos] tap resp`.
- 상세 응답(`{ Campaign: { Key … } }`)의 참여 문장은 목록 줄에서 이미 만든 `info` 가 있으면 그것을 지키고, 없을 때만 상세에서 모은다.

## 0.5.0 — 스냅플레이 오퍼월 · 찬스 화면 위 「찬스1 · 찬스2」 탭 (JS 는 OTA 가능 · 스냅플레이 SDK 는 새 스토어 빌드)

**무엇이 바뀌나**: 찬스 탭(`OfferwallScreen`) 위쪽에 「찬스1 · 찬스2」 탭이 생긴다. 찬스1 = 지금의 애드팝콘 화면(그대로, 탭을 오가도 다시 불러오지 않고 숨기기만), 찬스2 = 스냅플레이(탭을 누르면 SDK 전체 화면이 열리고, 닫고 돌아오면 「찬스 열기」 칸). **쓸 수 있는 제공자가 하나뿐이면 탭도 오류도 없이 예전 화면 그대로**다 — 스냅플레이 네이티브가 없는 옛 빌드, 서버 설정(앱 ID)이 아직 없는 앱, 서버가 끈 앱이 모두 여기에 든다. 탭 이름은 「찬스1 · 찬스2」뿐이고 제공자 이름은 이용자에게 보이지 않는다(`showProviderNames` 를 켜면 작게 보인다).

| 부분 | 어디서 | 옛 빌드(OTA) | 새 스토어 빌드 |
|---|---|---|---|
| 제공자 목록 · 탭 · 「찬스 열기」 칸 · 스냅플레이 제공자(JS) | 이 패키지 | OTA 가능 — 모듈이 없으면 찬스2 가 숨는다 | 같음 |
| `react-native-s2offerwall` 1.0.38 (스냅플레이 SDK: iOS 포드 `s2offerwall ~> 1.0.38` · Android `io.snapplay:s2offerwall-aos-sdk:1.0.38`) | 앱 `package.json` | 없음 → 찬스2 숨김 | 들어감 → 찬스2 보임(앱 ID 가 있으면) |
| iOS 사진 · 카메라 사용 문구 | 이 패키지의 Expo 플러그인 | — | 빌드 때 `Info.plist` 에 들어감 |

### 앱이 하는 일

1. `package.json` — `"@jcurve/offerwall": "file:vendor/jcurve-offerwall-0.5.0.tgz"` 와 `"react-native-s2offerwall": "1.0.38"`(정확히 이 판).
2. `app.config.js` 의 `@jcurve/offerwall` 플러그인 옵션에 `snapPlay: true`(생략하면 패키지가 설치돼 있을 때 자동으로 켜짐; `false` 로 끔). 사진 · 카메라 문구는 앱에 이미 있으면 건드리지 않고, 없을 때만 `photoPermission` · `cameraPermission` 옵션(또는 기본 문구)을 넣는다. 플러그인은 `expo-build-properties` 의 `ios.deploymentTarget` 이 16.0 보다 낮거나 `android.minSdkVersion` 이 24 보다 낮으면 **프리빌드를 이유와 함께 멈춘다**(아무것도 안 적으면 Expo 57 / RN 0.86 기본값 16.4 · 24 라 괜찮다).
3. 앱 ID 읽기 — 오퍼월 키를 읽는 자리(`initializeOfferwall` 성공 뒤, 회원 별칭 `usn` 을 받아 화면을 열기 전)에 한 줄:
   ```ts
   await resolveSnapPlayConfig(() => fetch(`${API_BASE}/content/config/snapplay`, { headers, cache: 'no-store' }).then((r) => r.json()));
   ```
   `headers` 는 `initializeOfferwall` 에 주는 것과 같은 앱 인증 헤더. 이 함수는 던지지 않는다(못 받으면 탭이 안 나올 뿐). 네이티브 모듈이 없는 빌드에서는 서버에 묻지도 않는다.
4. 그 밖의 코드 변경 없음: `OfferwallScreen` 을 이미 쓰는 앱은 그대로 탭이 생긴다. 선택 props: `tabColor` · `showProviderNames` · `autoOpenLauncher`(기본 true) · `displayName`(닉네임, 가려서) · `launcherCopy`.

### 서버 약속 (앱보조5)

- `GET {앱 서버}/content/config/snapplay` → `{ ok: true, config: { android: { appId }, ios: { appId }, placement?: "main", enabled?: true } }`. `appId` 대신 `mediaKey` 라고 와도, OS 값이 문자열 하나여도, `config` 없이 같은 칸이 바로 와도 읽는다. 앱 ID 가 한 OS 만 오면 그 OS 만 켜진다. **콜백 키(`verify_cd` 검증용)는 이 응답에 넣지 않는다**(서버만 안다).
- 콜백(스냅플레이 → 우리 서버): `pub_user_nm` = 앱이 SDK 에 준 사용자 이름 = 회원의 오퍼월 별칭 `usn`(64자 SHA256 hex) — 애드팝콘 별칭 표로 회원을 찾는다. `tr_id` 로 중복 처리, `verify_cd = SHA256(콜백키 + tr_id)` 검증, `test_yn` 처리는 서버 쪽 일.

### SDK 를 부르는 순서 (`snapPlay.ts`)

앱 ID(`setAppIdForIOS` / `setAppIdForAndroid`) → 이벤트 듣기(`onInitCompleted` · `onLoginRequested`) → `initSdk()` → 초기화 완료 이벤트(최대 10초, 안 오면 실패로 보고 다음 열기에서 다시) → `setUserName(usn, displayName)` → `showOfferwall(placement)`(기본 `"main"`). iOS 모듈은 JS 가 듣기 시작한 뒤에만 이벤트를 내보내므로 듣기가 `initSdk()` 보다 먼저다. `removeAllListeners()` 와 `presentATTPopup()` 은 부르지 않는다(ATT 창은 광고 패키지가 앱에서 이미 띄운다). 앱 리워드 광고 연결(`onRewardedAdRequested`)은 하지 않는다 — 안 달면 SDK 가 「광고 없음」으로 답하고 웹 광고로 넘어간다. 회원이 바뀌면(`resetOfferwall()` 이 `forgetSnapPlayUser()` 를 부른다) 다음 열기에서 새 회원으로 다시 설정한다.

### 확인된 것 / 확인 못 한 것

- 확인(이 PC, 시험 23 + 16 + 4): 레지스트리 · 제공자 순서 · 모듈 유무 판정(없으면 `require` 도 안 함) · 설정 파싱 · SDK 호출 순서 · 초기화 실패/시간 초과 · 회원 바뀜 · 탭이 나오고 사라질 때 애드팝콘 화면이 다시 마운트되지 않음 · 플러그인 문구/가드. 기존 298 개 시험 그대로 통과.
- **이 PC 에서 확인하지 못한 것**: 네이티브 컴파일(`useFrameworks: static` 인 10앱에서 `s2offerwall`(Swift 바이너리 포드) + 플러그인 Objective-C 가 같이 빌드되는지 · `showOfferwall` 이 쓰는 `UIApplication.delegate.window.rootViewController` 가 Expo 57 AppDelegate 에서 잡히는지 · Android 첫 실행의 개인정보 동의 창) — 첫 빌드와 실기기에서 처음 확인된다. `showOfferwall` 이 실패하면 찬스2 칸에 「잠시 후 다시 시도해 주세요」 와 「다시 열기」 가 보이고 앱은 죽지 않는다.

## 0.5.1 — 「찬스1 · 찬스2」 탭 줄을 「포인트 빨리 모으기」 버튼이 가리지 않게 (JS만 · 네이티브 변경 없음 · 0.5.0 빌드에 OTA 가능)

**원인(에그머니 1.1.8 TF, 대표님 20:06)**: 「포인트 빨리 모으기 ›」 칩은 앱이 `OfferwallCombos` 로 찬스 화면 옆에 그리고, 위치는 상자 맨 위에서 6(`COMBO_CHIP_TOP`)이다. 탭 줄이 생기기 전에는 그 자리가 애드팝콘 화면의 「리워드 충전소」 제목 줄이었는데, 0.5.0 부터 맨 위가 탭 줄이라 칩이 찬스2 탭을 덮었다.

고친 것: `OfferwallScreen` 이 탭 줄의 높이(`onLayout` 로 잰 값, 재기 전에는 45)를 `setChanceTabInset()` 으로 알리고(탭이 없으면 0), `ComboEntry`(찬스 자리)가 칩 줄 · 안내 시트 · 토스트를 그만큼 아래로 민다 → 칩은 다시 제목 줄의 오른쪽(사람 아이콘 왼쪽)에, 탭 줄은 「찬스1 | 찬스2」 두 탭이 반반으로 다 보인다. 칩은 두 탭 모두에서 같은 자리(찬스2 에서는 그 화면 위쪽)에 있다 — 탭마다 화면 안에 하나씩. 앱 코드 변경 없음(`chipTop` 을 직접 준 앱은 그 값 위에 탭 높이가 더해진다). 시험 4 + 1 개 추가.

## 0.6.0 — 스냅플레이 화면을 찬스2 탭 안에 그대로 (새 스토어 빌드 필요 · 0.5.1 칩 고침 포함)

**무엇이 바뀌나**: 찬스2 를 누르면 스냅플레이가 전체 화면 모달(「혜택받기」 · 왼쪽 X · 검색 · ?)로 떠서 위 「찬스1 · 찬스2」 탭과 아래 앱 메뉴를 가렸다(대표님 10-28 20:07). 이제 SDK 의 `S2OfferwallView` 를 네이티브 뷰 `JCurveSnapPlayView` 로 감싸 **탭 줄 아래 · 앱 메뉴 위 영역 안에** 끼워 보여 준다(애드팝콘 찬스1 과 같은 자리). 「포인트 빨리 모으기」 칩은 0.5.1 대로 탭 줄 아래 각 탭 화면 안에 하나씩.

| 부분 | 어디서 | 필요한 것 |
|---|---|---|
| Android `JCurveSnapPlayViewManager`(S2OfferwallView 를 FrameLayout 에 넣고 직접 measure/layout, 로그인 · 닫기 · 권한 요청 이벤트) | 이 패키지 `android/` | **새 빌드** — SDK 는 `compileOnly`(앱이 `react-native-s2offerwall` 로 가져옴), SDK 클래스가 있을 때만 등록, R8 은 `consumer-rules.pro` 로 `-dontwarn` |
| iOS `JCurveSnapPlayView`(UIView 호스트 + `S2OfferwallView`, SDK 문서의 제약 방식) | 이 패키지 `ios/` | **새 빌드** — podspec 이 `s2offerwall ~> 1.0.38` 에 의존, `s2offerwall-Swift.h` 가 없으면 통째로 컴파일에서 빠진다 |
| JS: 찬스2 탭이 뷰를 끼워 보임(`provider.canEmbed` / `embed`), 뷰가 없는 빌드(0.5.x)는 전체 화면(모달) 그대로 | `chanceProviders.ts` · `snapPlay.ts` · `OfferwallScreen.ts` | OTA 로도 나가지만 뷰는 0.6.0 빌드에서만 보인다 |

**동작**: 찬스2 를 누르면 SDK 시작 · 회원 설정(`prepare`)을 마친 뒤에 뷰를 그린다(실패하면 「잠시 후 다시 시도해 주세요」 + 「다시 열기」). 뷰 안의 스냅플레이 화면이 로그인을 요청하면 가장 최근 회원(`usn`)으로 답하고, 닫기를 요청하면 찬스1 로 돌아간다. 앱 리워드 광고는 SDK 전역 리스너 그대로(연결 안 함). **서버에서 끄기**: `content/config/snapplay` 응답에 `"embed": false` 를 주면 뷰 대신 전체 화면(모달)으로 연다(앱 업데이트 없이).

**확인 못 한 것(이 PC 는 네이티브 컴파일 불가 — 첫 빌드가 처음 확인한다)**: ① Android: `S2OfferwallView(Context, null)` · `load(String)` · `S2Offerwall.EventListener` 3개 메서드는 SDK 문서 · RN 플러그인 소스와 AAR 클래스 이름에서 옮겼고, 컴파일 오류가 나면 이 파일 하나뿐이다. ② iOS: `S2OfferwallView` 를 `[[S2OfferwallView alloc] init]` 으로 만들고 문서의 4방향 제약으로 붙임(`useFrameworks: static` 에서 `<s2offerwall/s2offerwall-Swift.h>` 가 잡히는지는 첫 빌드). ③ 실기기: 뷰 안 스냅플레이 화면의 높이 · 스크롤 · 검색 · 사진 권한 · 칩과 겹침(칩 줄이 스냅플레이 화면 오른쪽 위 아이콘을 가릴 수 있음). 문제가 생기면 서버의 `embed:false` 로 바로 모달로 돌릴 수 있다.

