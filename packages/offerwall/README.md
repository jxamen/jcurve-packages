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

## 0.2.4 — 쉽게 1만P 모으기 (JS only, OTA 가능)

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
- 항목을 누르면 `onPressMission(mission, bundle)`. 없으면 `usn` 으로 오퍼월 전체를 연다(SDK 가 특정 캠페인을 직접 여는 호출을 주지 않는다) — 그 경우 「누르면 혜택 목록이 열려요. 같은 이름을 찾아 참여해 주세요.」 안내가 붙는다. 둘 다 없으면 눌러도 반응하지 않는다.

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

**팝업 · 푸시 · 링크로 들어오기** — 경로 이름은 `offerwall/combos` (`COMBOS_ROUTE`). 앱은 URL 스킴이 아니라 앱 안 이동 액션을 쓰므로 팝업 `action` / 푸시 `data.go` 를 받는 쪽에서 한 줄만 더한다.

```ts
import { isCombosRoute, requestOpenCombos } from '@jcurve/offerwall';
if (isCombosRoute(action)) { goTab('offerwall'); requestOpenCombos(); }   // 탭 이동 코드는 앱마다 다르다
```

`requestOpenCombos()` 는 마운트된 `ComboEntry` 가 있으면 바로 열고(찬스 탭이 홈보다 먼저, 같은 순위면 나중에 마운트된 쪽), 아직 없으면 10초까지 기다렸다가 처음 마운트되는 쪽에서 연다. 오래된 요청이 나중에 갑자기 열리지는 않는다. 구버전 앱에는 이 코드가 없으므로 서버 팝업은 `chancePromo=1` 처럼 지원 앱만 받는 조건을 따로 걸어야 한다.

**기준 가지 주의**: 0.2.3 이 두 갈래다 — `offerwall-v0.2.3` 태그(JS 찬스 퍼널, `OfferwallScreen` 없음)와 에그머니가 쓰는 `codex/chance-header-remove-1022`(`OfferwallScreen`, 퍼널 없음). 0.2.4 는 에그머니가 쓰는 쪽 위에서 만들었다. 퍼널 쪽은 합치지 않았다.
