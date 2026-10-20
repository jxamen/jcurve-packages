# @jcurve/mission

APIHUB **일주일 방문미션** 공용 — 웹뷰로 열고, 웹페이지가 부르는 `MocationNativeBridge` 를 받아 주고, 에러·점검 화면을 그린다.

```
서버 POST {앱}/apihub/entry  →  { ok, url }     (trackingId · uid 는 서버가 만든다)
앱 화면                       →  <MissionWebView url={url} />
웹페이지 → 앱                 →  openAppTarget(url, fallbackUrl) 만 이 OTA 판에서 동작
```

## 0.3.1 — 오버레이(@jcurve/overlay, 안드 AAB 줄의 「0.3.0」) + 단계 기록(0.3.0) 합친 판

안드 새 런타임 줄이 vendor 에 두던 mission 「0.3.0」(feat/overlay-1014, 오버레이 권한)과 GitHub 에 낸 0.3.0(단계 기록 · 10초 안내)은 **내용이 다른 같은 번호**였다. 0.3.1 은 둘을 합친 것 — 모든 줄(iOS · 안드 옛 런타임 · 안드 AAB 줄)이 이 판을 쓴다.

## 쓰는 법

```tsx
import { MissionWebView, MissionState, fetchEntry } from '@jcurve/mission';

const r = await fetchEntry(request);           // request = 앱 자기 요청 함수(토큰 · 재시도)
if (!r.ok) return <MissionState kind={r.reason === 'network' ? 'error' : r.reason === 'off' ? 'off' : 'notReady'} />;
return <MissionWebView url={r.url} onClose={close} onEvent={(n, p) => track(n, p)} theme={…} />;
```

- `react-native-webview`(≥13)가 앱에 있어야 한다(없으면 새 빌드가 필요하다 — OTA 로는 못 넣는다).
- `fetchEntry` 는 서버가 준 주소가 `https://service.mocation.co.kr` · `test.mocation.co.kr` 의 `/alwayz/entry.php` 일 때만 쓴다.
- 패키지는 아무 데도 보내지 않는다. 계측은 `onEvent`(mission_open · mission_loaded · mission_error · mission_target_open · mission_target_blocked …)로 앱이 보낸다.

## 브릿지(가이드 규격)

| 페이지가 부르는 것 | 이 판의 동작 |
|---|---|
| `openAppTarget({url, fallbackUrl?})` | 열기 — 못 열면 fallbackUrl. 막는 스킴 `javascript data file content about blob` 만 거절, 앱 스킴 · `intent://` · `market://` 는 변환해서 연다 |
| `showFloatingPopup` · `requestOverlayPermission` · `hasOverlayPermission` | **Android 오버레이는 네이티브 모듈이 필요**해서 이 판은 `hasOverlayPermission` 이 항상 false 이고 나머지는 `onFloatingPopup` · `onOverlayRequest` 콜백으로 알리기만 한다. 오버레이는 다음 빌드 묶음 |

iOS 는 가이드대로 `openAppTarget` 만. 페이지가 「`MocationNativeBridge` 가 있으면 Android」로 가를 수 있어 **그 기기 방식 하나만** 심는다.

## 아직 안 한 것

- 일주일 참여 배너(7칸 진행 점)·복구 팝업 — 진행 상황을 알려 주는 조회 API 가 APIHUB 문서에 없다(문의 중).
- 파일 선택(갤러리), 카메라 권한 문구(Info.plist) — 네이티브 설정이라 빌드 묶음.

## 0.2.0 공용 미션 페이지

```tsx
import { MissionCards, ShoppingMission } from '@jcurve/mission';
const fetchJson = (path, options) => options?.method === 'POST' ? api.post(path, options.body) : api.get(path);
const fallbackCards = [{ id: 'shopping', type: 'apihub_shopping', title: '쇼핑 태그 퀴즈1', desc: '매일 상품을 구경하고 포인트를 받아요' }, { id: 'place', type: 'place_stamp', title: '플레이스 & 쇼핑 태그 퀴즈2' }];
function Missions() {
  const [shopping, setShopping] = React.useState(false);
  const insets = useSafeAreaInsets();
  return shopping
    ? <ShoppingMission fetchJson={fetchJson} safeAreaInsets={insets} onClose={() => setShopping(false)} />
    : <MissionCards fetchJson={fetchJson} fallbackCards={fallbackCards} onOpenShopping={() => setShopping(true)} onOpenStamps={() => navigation.navigate('Stamps')} renderAfterCards={() => <HarvestNative />} />;
}
```

예시는 앱에 있는 `api`, `React`, `useSafeAreaInsets`, `navigation`, `HarvestNative`를 사용한다. TypeScript 앱에서는 fallback에 `MissionCard[]` 타입을 붙인다. 새 의존성은 추가하지 않는다.

- `MissionCardsProps`: 필수 `fetchJson: Requester`, `onOpenShopping(card)`, `onOpenStamps(card)`. 선택 `fallbackCards`, `title`, `subtitle`, `theme: { colors?: Partial<MissionTheme>, radius?: number }`, `icons: Partial<Record<MissionCardType, ReactNode | ImageSourcePropType>>`, `character: ReactNode`, `renderAfterCards: () => ReactNode`.
- 서버 `GET mission/cards`의 `{ ok: true, cards: [{ id, type, title, desc, icon, order, enabled? }] }`를 읽는다. 실패·누락·잘못된 응답은 fallback을 사용한다. 성공한 빈 목록은 유지한다. 알 수 없는 type·꺼진 카드·잘못된 행·중복 id는 제거하고 `order`로 안정 정렬한다. 기본 순서는 서버처럼 `(index + 1) * 10`이다.
- 서버의 HTTPS `icon`이 우선이고, 없으면 앱의 `icons[type]`을 쓴다. 캐릭터·색·반경만 앱이 바꾸며 화면 구조는 같다. 광고 슬롯은 카드와 같은 가로 영역 안에 놓이며 위 간격은 16이다.
- `ShoppingMissionProps`: 필수 `fetchJson`, `onClose`, `safeAreaInsets: { top, bottom, left?, right? }`. 선택 `title`, `adId`, `source`(요청 출처: `popup`|`push`|`tab`|`card`|기본 `other`) 및 기존 웹뷰의 `theme`, `onEvent`, `onFloatingPopup`, `onOverlayRequest`, `overlayReady`. `fetchEntry`로 입장 주소를 받아 로딩·실패·재시도·웹뷰를 그린다.
  - `hint?: boolean`(기본 true) — 「10초만 구경하면 포인트」 안내 띠 표시
  - `hintText?: string` — 안내 문구 커스터마이징
- Modal로 열 때 `safeAreaInsets`는 **Modal 바깥에서** 읽은 값을 전달한다. 닫기와 뒤로가기는 최소 48 높이·`hitSlop={12}`이며 머리글에 z-index/elevation을 적용한다. 오른쪽 뒤로가기는 웹 기록이 없거나 오류/복구 중이면 비활성이다.
- 기존 `MissionWebView`에 선택 `onNavigationChange({ canGoBack, goBack })`와 단계 기록 `traceStage`를 추가했다. 기존 API는 그대로 사용할 수 있다.
- 순수 함수 `normalizeCards`, `parseCardsResponse`, `fetchCards`를 공개한다. 요청 함수는 렌더마다 새로 만들지 말고 모듈 상수 또는 `useCallback`으로 전달한다. fallback 배열도 안정된 참조를 권장한다.

## 0.3.0 단계 기록 · 힌트 안내

**단계 기록(Stage Tracing)**: 입장 → 로드 → 보상 단계를 서버 `POST {앱}/apihub/trace` 로 기록해서 iOS ↔ Android 이탈 지점을 파악한다.
- `traceEntry(requester, { stage: 'entry'|'load_ok'|'load_fail'|'close'|'reward', source: 'popup'|'push'|'tab'|'card'|'other', ms?, code?, url? })` 내부 함수 — 조용한 오류 처리
- `ShoppingMission`에 `source` prop(기본 `'other'`)을 추가했다. `traceStage` 콜백으로 `load_ok` · `load_fail` · `close`를 자동 기록한다.
- `MissionWebView`에 선택 `traceStage` prop을 추가했다. 웹뷰 로드 성공/실패를 기록한다.
- 같은 단계는 세션당 1회만 기록되고, requester 없으면 무시된다(옛 앱 호환).
- `reward` 단계는 웹페이지나 앱이 보상을 알게 되는 지점에서 호출해야 한다(reward 단계에도 같은 source 를 실어야 전환율이 맞음).

**「10초 구경하면 포인트」 안내**: 웹뷰 위에 작은 띠로 표시하고 X 로 닫을 수 있다.
- `ShoppingMission`에 `hint?: boolean`(기본 true) · `hintText?: string` prop을 추가했다.
- 기존 테마 색을 사용하며 새 디자인 체계를 만들지 않는다.

**사용 예시**:
```tsx
<ShoppingMission
  fetchJson={fetchJson}
  safeAreaInsets={insets}
  source="popup"         // 어디에서 열었는지
  hint={true}           // 안내 띠 표시
  hintText="상품을 10초만 보세요" // 커스텀 안내(선택)
  onClose={() => setShopping(false)}
/>
```

## 0.2.1 언어(`lang`)

`MissionCards` · `ShoppingMission` · `MissionWebView` · `MissionState` · `MissionLoading` 에 `lang` 하나(예 `lang="en"`).
**언어는 앱이 넘긴다** — 패키지는 기기 언어를 읽지 않는다. 없거나 `'ko'` 면 지금과 바이트까지 같은 한국어.
바뀌는 것: 기본 제목 · 부제(`title` · `subtitle` 을 주면 그 글 그대로), 닫기 · 뒤로가기 · 불러오는 중, 상태 화면(오류 · 점검 · 마감 · 준비 중) 문구(`stateCopy(kind, lang)`).
안 바뀌는 것: 서버 카드 제목 · 설명(mission/cards), 웹뷰 안 APIHUB 페이지 글.
언어 추가는 `src/i18n/locales/<언어>.ts` 표 하나 + `locales/index.ts` 한 줄.

## 0.3.2 바로 받는 혜택

```tsx
import { BenefitQuickList } from '@jcurve/mission';

<BenefitQuickList
  title="바로 받는 혜택"
  accentColor="#EE7A33"
  seeAllLabel="혜택 전체보기"
  onSeeAll={() => navigation.navigate('Benefits')}
  items={[{
    key: 'attendance', title: '매일 출석 체크',
    subtitle: '하루 한 번 눌러서 포인트 받기', ctaLabel: '출석하기',
    icon: 'calendar', tint: '#E8F0FD', done: todayDone,
    onPress: () => navigation.navigate('ShoppingMission'),
  }]}
  footer={<HarvestNative />}
/>
```

예시의 navigation·todayDone·HarvestNative는 앱이 제공한다.
`title` 기본값은 「바로 받는 혜택」, `accentColor`는 `#EE7A33`.
`seeAllLabel`과 `onSeeAll`을 모두 주면 전체보기 버튼을 표시한다.
각 item은 key·title·subtitle·ctaLabel·icon·tint·onPress가 필수이고,
`hidden`이면 행을 생략한다. `done`이면 회색 「완료」 버튼으로 바꾸고 콜백을 무시한다.
`icon`은 calendar/bag/pin/star/ticket/friend 또는 ReactNode이며,
기본 아이콘은 RN View 도형이다. 앱 고유 아이콘색·모양은 ReactNode로 바꾼다.
`footer`는 목록 카드 아래 14 간격으로 표시한다. 외부 좌우 여백은 앱이 정한다.
패키지는 이동·완료 판정·보상 규칙·광고 로딩을 알지 않으며 새 네이티브 의존성이 없다.

### 0.3.3

`doneLabel?: string`은 완료 버튼과 접근성 문구에 쓰이며 기본값은 `완료`다.
`buttonWidth?: number`는 모든 행의 버튼 폭으로 기본값은 100pt다(한 줄 표시).
item의 `badge?: string`은 제목 옆 작은 배지를 표시한다.

## 0.4.0 독립 페이지 6개 · 표준 줄 2개

당근 화면 모양 그대로, 색 · 아이템 이름 · 데이터 · 콜백만 앱이 넣는다. **새 네이티브 의존성은 없다**(react · react-native 만).
걸음 · 광고 · 보상 규칙은 패키지가 모른다. 광고 자리는 `footer?: ReactNode`(맨 아래)로 받는다.
모든 페이지는 `‹ 제목` 머리글과 안드로이드 뒤로 가기 → `onBack` 을 가진다. 문구는 한국어 원문만(0.4.0에서 번역 표는 없음).

```tsx
import { FreeItemPage, freeItemRow, MissionPageTheme } from '@jcurve/mission';

const theme: Partial<MissionPageTheme> = { accent: '#FFC23D', accentText: '#9A5B0E', itemName: '먹이', itemIcon: <Text>🐛</Text> };
<FreeItemPage theme={theme} onBack={goBack} slots={slots} onClaim={(id) => claimSlot(id)} footer={<NativeAd />} />

// 홈 「바로 받는 혜택」 목록에 넣는 표준 줄
items={[freeItemRow({ itemName: '먹이', left: 2, onPress: () => openFreeItem() })]}
```

### 테마 · 공통

| 이름 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `MissionPageTheme` | 타입 | — | `bg, card, text, sub, accent, accentText, accentSoft, line, done` + `character?`, `itemName?`, `itemIcon?` |
| `DEFAULT_PAGE_THEME` | 값 | 주황 `#EE7A33` 계열, `itemName: '아이템'` | 기본 색 |
| 페이지 `theme` | `Partial<MissionPageTheme>` | `{}` | 일부만 줘도 된다(나머지는 기본) |
| `PAGE_BUTTON` | 값 | `{ width: 72, height: 34 }` | 줄 버튼 크기(carrot 홈과 같음) |

### 페이지

| 이름 | 주요 props (타입 · 기본값 · 설명) |
| --- | --- |
| `FreeItemPage` | `slots: FreeItemSlot[]` · `onClaim(slotId)` · `onBack` · `title?` 기본 「무료 {아이템} 받기」 · `subtitle?` · `theme?` · `footer?` · `buttonWidth?` 72 · `buttonHeight?` 34 |
| `TodayMissionPage` | `rows: TodayMissionRow[]` · `bonus: number` · `claimed?` false · `onClaim()` (false/reject 면 실패 문구) · `onBack` · `title?` 「오늘의 미션」 · `theme?` · `footer?` · `buttonWidth?` · `buttonHeight?` |
| `StepsPage` | `todaySteps: number` · `stages: StepsStage[]` · `stepsAvailable: boolean` · `onUpdate()` · `onClaim(stage)` · `onBack` · `earnedToday?` 0 · `everySteps?` 1000 · `guide?` · `title?` 「만보기」 · `theme?` · `footer?` |
| `LuckyChancePage` | `freeLeft: number` · `adLeft: number` · `onDraw(ad: boolean)` · `waitUntil?` epoch ms · `prizes?` · `boost?` 0 · `boostText?` (0.4.1, 없으면 「확률권 N장」만) · `drawTitle?` 「행운 뽑기」(0.4.1) · `busy?` · `offerwall?: {name, onOpen}` · `onBack` · `title?` 「행운 찬스」 · `theme?` · `footer?` |
| `InvitePage` | `code: string` · `locked?` false · `lockReason?` 'verify' · `onVerify()` · `onSignup?()` · `verifying?` · `inviterPoint` · `inviteePoint` · `inviterBoost?` 0 · `inviteeBoost?` 0 · `invited` · `waiting` · `joined?` · `rewarded?` · `onJoin(code) → {ok, message?}` · `onShare()` · `onBack` · `notice?` · `title?` 「친구 초대」 · `theme?` · `footer?` |
| `AppHubPage` | `apps: AppHubItem[]` (`key, name, desc?, icon?, onOpen`) · `onBack` · `title?` 「추천 앱」 · `emptyText?` · `theme?` · `footer?` |

슬롯 · 단계 · 줄 타입:

| 타입 | 필드 |
| --- | --- |
| `FreeItemSlot` | `id, name, fromHour, toHour, step, reward, done, missed, claimable` — 상태는 앱이 정한다 |
| `StepsStage` | `id, threshold(걸음), points, claimed` |
| `TodayMissionRow` | `key, title, sub, done: boolean \| null, icon?, hidden?, onGo()` — `null` 은 모름(완료로 세지 않음) |

### 만보기 — 패키지는 `@jcurve/steps` 를 가져오지 않는다

`stepsAvailable={false}`(옛 빌드)면 걸음 수는 읽기만 되고, 「업데이트하면 걸음 보상을 받을 수 있어요」 안내와 「업데이트하기」 단추가 뜨며, 받기 단추는 `onUpdate()` 를 부른다(옛 바이너리 충돌 방지).

### 표준 줄 (`rows.ts`)

| 이름 | 인자 · 기본값 | 결과 |
| --- | --- | --- |
| `freeItemRow` | `itemName` · `left?` · `total?` 3 · `onPress` · `icon?` 🌱 · `tint?` · `hidden?` · `key?` 'freeItem' | 「무료 {item} 받기 · 하루 3번 광고 없이 받기 [받기]」. `left` 를 주면 칸 막대 「N번 남았어요」, 0 이면 「완료」 |
| `appHubRow` | `onPress` · `subtitle?` 「추천 앱 둘러보기」 · `icon?` ⭐ · `tint?` · `hidden?` · `key?` 'apphub' | 「추천 앱 둘러보기 [보러가기]」 |

### 친구 초대

「간편 인증」이다(문자 인증 아님). 자격이 없으면 「간편 인증하면 초대할 수 있어요」 와 「간편 인증하기」 단추가 뜨고, 누르면 `onVerify` 만 부른다.

## 0.4.3 — 목록 눌림 · 쇼핑 미션 나가기(대표님 10-20 11:42 · 11:44)

- **`BenefitQuickList` 줄 하나 = Pressable 하나.** 0.4.0~0.4.2 는 줄 Pressable 안에 버튼 Pressable 이 겹쳐 있었다. 이제 오른쪽 버튼은 그림(`View`, `pointerEvents="none"`)이고 줄 전체가 한 단추(`accessibilityRole="button"`, 라벨 「제목, 버튼 글」)다.
- 빠른 두 번 누름은 `TAP_GUARD_MS`(700ms) 동안만 무시한다(`pressOnce`). 잠금 상태가 없어서 영영 남지 않는다 — 화면 이동 · 실패 · 취소를 기다리지 않는다.
- 페이지(`StepsPage` · `InvitePage`) 「확인 중…」 잠금은 앱 약속이 끝나지 않아도 `BUSY_LIMIT_MS`(75초) 뒤 반드시 풀린다(`settleWithin`).
- **`ShoppingMission` 나가는 길**
  - 「뒤로가기」는 늘 켜져 있다: 웹 기록이 있으면 웹에서 한 칸, 없으면 화면 닫기. 전에는 웹 기록이 없으면 꺼져 있었다.
  - 안드로이드 뒤로(`BackHandler`)는 로딩 · 오류 화면에서도 같은 규칙을 쓴다.
  - iOS 는 왼쪽 가장자리(24pt)를 오른쪽으로 밀면 뒤로가기다.
  - iOS 에서 `safeAreaInsets.top` 이 0 으로 오면(Modal 안에서 읽은 값) 47(노치 기기) · 20 으로 짐작한다. 이제 「닫기」가 상태 표시줄 밑에 깔리지 않는다.
  - 닫기 기록(trace)이 실패해도 닫는다.
- **`ShoppingMissionModal`(새)**: 안드로이드 뒤로 버튼은 Modal 안에서 `BackHandler` 가 아니라 `onRequestClose` 로 온다. 앱이 `onRequestClose={() => 닫기}` 로 직접 물리면 웹 기록을 건너뛴다. 이 껍데기를 쓰면 같은 규칙(웹 기록 → 닫기)이 된다. 자기 Modal 을 계속 쓰려면 `backRef` 를 넘기고 `onRequestClose={() => backRef.current?.()}` 로 바꾼다.

```tsx
<ShoppingMissionModal visible={shopping} fetchJson={fetchJson} source={from} safeAreaInsets={insets} onClose={() => setShopping(false)} />
```

## 0.4.4 — 홈 「바로 받는 혜택」 목록을 서버(어드민)에서 앱별로 (대표님 10-20 17:12~17:14 「이 패키지 써」 · 「목록 순서는 어드민에서 앱별로」 · 「넣고 빼고 순서랑」)

0.4.3 위에 0.5.0 의 서버 목록(`home.ts`)만 옮겼다 — **새 네이티브 0**(@jcurve/overlay · lottery 는 안 따라온다). `BenefitQuickList` 가 서버 `GET mission/home` 의 home_rows(어드민 `mission.home_rows`, 앱 DB별)를 **스스로 읽어** 앱 기본 items 에 적용한다.

**앱에서 할 일 3줄**
```tsx
<BenefitQuickList
  items={items}                                                     // 앱 기본 줄 그대로
  fetchJson={fetchJson}                                             // ① 앱의 요청 함수 — 이것을 주면 서버 목록을 적용한다(없으면 예전 그대로)
  homeKeys={{ bag: 'quiz1', pin: 'quiz2', ticket: 'lucky_chance' }} // ② 앱 줄 key → 서버 key(아래 9개) 맞춤표. key 가 이미 서버 key 와 같은 줄은 안 적어도 된다
  itemName="양분" onFreeItem={() => openFreeItem()}                  // ③ 「무료 양분 받기 · 하루 3번 들르면 양분 받기」 기본 줄(없으면 그 줄을 안 만든다)
  onRow={key => openByKey(key)}                                     // (선택) 서버 목록에 있는데 앱 items 에 없는 줄을 눌렀을 때 — 없으면 그런 줄은 안 그린다
  refreshKey={tab === 'home'}                                       // (선택) 홈으로 돌아올 때 다시 읽기(앱이 앞으로 돌아올 때는 알아서 다시 읽는다)
/>
```
서버 줄 key 는 9개 고정: `quiz1 · quiz2 · checkin · steps · free_item · today_missions · lucky_chance · invite · recommend`. 어드민 한 곳에서 앱별로 저장하면 모든 앱이 같은 key 로 말해 같은 목록이 된다.

**규칙(앱별 서버 home_rows 를 그대로 따른다)** — 순서: home_rows 순서대로(서버 key 와 짝이 없는 앱 전용 줄은 그 뒤에) · 빼기: 서버 key 로 맞춘 앱 줄이 home_rows 에 없으면 안 그리고, 있어도 보임 false 면 숨김 · 넣기: home_rows 에 있는데 앱 items 에 없는 key 는 서버 값(제목 · 설명 · 버튼 · 배지)으로 기본 줄을 만들어 `onRow(key)` 에 넘긴다(`onRow` 없으면 안 만든다) ·
home_rows 가 없거나 읽기에 실패하면 **앱 기본 그대로**(60초 캐시 · 앱이 앞으로 돌아올 때 · `refreshKey` 가 바뀔 때 다시). 누르는 동작 · 완료 · 칸 막대 · 앱이 숨긴 줄은 늘 앱 것 — 서버가 바꾸는 것은 제목 · 설명 · 버튼 · 배지 · 보임 · 순서뿐이다.
**free_item 줄은 패키지 기본**: 앱 items 에 free_item(맞춤표 기준)이 이미 있으면(예: `freeItemRow` 를 쓰는 에그머니 · 머니트리 · 영테크) 겹치지 않는다.
순수 함수도 내보낸다: `composeHomeRows` · `withFreeItemRow` · `freeItemHomeRow` · `resolveHomeKeys` · `fetchHomeConfig` · `applyHomeRows`(0.5.0 방식 — 서버에 없는 줄도 뒤에 남김) · `useHomeRows`.

## 0.4.5 — 서버 title 을 비우면 앱 제목 그대로 (대표님 10-20 「동적 제목은 서버 고정 제목이 덮지 않게 — 덮으면 그 key는 서버 title 비우기」)

서버 home_rows 줄의 **`title` 이 비어 있으면 앱 items 의 제목을 그대로** 둔다 — 만보기 「오늘 N걸음」 · 오늘 미션 보너스 문구 같은 **동적 제목**을 어드민의 고정 제목이 덮지 않게. 제목을 적은 줄만 그 제목으로 바뀐다(설명 · 버튼 · 배지가 비면 앱 값이 살아 있는 것과 같은 규칙).
앱에 짝이 없어 새로 만드는 줄(`onRow`)은 title 이 비었으면 key별 기본 제목(만보기 · 오늘의 미션 · 행운 찬스 …). 서버가 빈 title 줄을 내려 주는 것은 jcurve-api `fix/mission-home-optional-title`(07d3286) 이 반영된 뒤 — **옛 앱(0.4.4 이하)은 빈 제목 줄을 버리므로**, 어드민에서 title 을 비우는 것은 0.4.5 가 나간 앱부터 한다.


## 0.4.6 — 켤 때 목록 순서가 바뀌지 않게: 마지막으로 받은 서버 목록을 저장해 먼저 그린다 (대표님 10-20 18:54 「쇼핑 탭이 왜 뒤늦게 나오지?」)

0.4.4~0.4.5 는 서버 home_rows 를 **60초 메모리 캐시**로만 들고 있어서, 앱을 켤 때마다 앱 기본 순서로 먼저 그렸다가 서버 순서로 바뀌었다. 이제 앱이 저장소를 넘기면 마지막으로 받은 응답을 저장해 두고 **켤 때 그 값으로 먼저** 그린 뒤 서버 응답으로 갱신한다.

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';   // ⚠ 0.4.6 은 get/set 모양만 받는다 — 순정 AsyncStorage(getItem/setItem)는 0.4.7 부터 그대로 된다

<BenefitQuickList fetchJson={fetchJson} storage={AsyncStorage} items={items} … />
// 또는 훅: const { items, ready } = useHomeRows(fetchJson, baseItems, keys, tab === 'home', { storage: AsyncStorage });
```

- `storage?: { get(key): Promise<string|null>; set(key, value): Promise<void> }` — 0.4.6 은 이 모양만(AsyncStorage 는 `{ get: k => AsyncStorage.getItem(k), set: (k, v) => AsyncStorage.setItem(k, v) }` 어댑터로). **0.4.7 부터는 getItem/setItem 모양도 그대로 받는다.** **안 넘기면 0.4.5 와 똑같다.**
- 저장하는 것: 서버가 **정상으로** 답한 응답만(`ok:true`). 실패 · 깨진 응답 · 60초 캐시 적중은 저장하지 않는다. 읽을 때도 서버 응답처럼 다시 거른다(모르는 key · 길이 제한). 키 기본값 `jcurve.mission.home.v1`(`storageKey` 로 바꿈), 20KB 넘거나 판(v)이 다르면 무시.
- 켤 때: 저장값을 읽는 동안(최대 300ms) **목록을 그리지 않고** 기다렸다가 저장값으로 그린다 → 서버 응답이 오면 바뀐 것만 갱신. 저장된 값이 없는 **첫 설치**는 저장소 확인 직후 앱 기본으로 그린다. 서버가 먼저 오면 저장값은 무시.
- 서버 호출이 실패하면 이미 그린 저장값을 **그대로 둔다**(앱 기본으로 되돌리면 순서가 또 바뀐다).
- `useHomeRows` 는 `{ items, config, ready }` 를 준다 — 저장소를 쓰는데 훅을 직접 쓰는 앱은 `ready` 가 false 인 동안 목록을 그리지 않는다. 순서 규칙은 순수 함수 `homeReduce`(시험).
- 새 네이티브 0 · 새 의존 0. 서버 변경 없음.

## 0.4.7 — 방문형 「무료 ○○ 받기」 받은 횟수 · 줄별 완료 글자(0.7.4 포팅) + 저장소 getItem/setItem (대표님 10-20 19:01)

**① `freeItemRow` 받은 횟수(`received`) · 줄별 완료 글자(`doneLabel`)** — 0.7.4 와 같다. 방문형 「무료 ○○ 받기」 줄은 아침 · 점심을 **놓친 칸**이 있어 「남은 칸 0 = 다 받음」이 아니다 — 저녁 1번만 받아도 남은 칸은 0 이다.
- `freeItemRow({ …, received, left, doneLabel })`: **`received`**(오늘 받은 횟수, 0~total) — 막대의 초록 칸은 `received` 만큼, 글자는 받은 횟수대로(0<r<total 「오늘 r번 받았어요」 · r=total 「오늘 다 받았어요」 · r=0 「오늘은 시간이 지났어요」).
  `left` 는 「N번 남았어요」(받을 칸이 남았을 때)와 완료(done) 판정에만 쓴다(`left=0` 이면 done). `received` 를 안 주면 예전과 같다.
- **`BenefitQuickItem.doneLabel`**: done 줄의 버튼 글자를 **줄마다** 정한다(안 주면 목록의 `doneLabel`, 기본 「완료」) — 버튼 글자와 접근성 이름 둘 다.
- 방문형 한 줄: `freeItemRow({ itemName: '감자', left, received, doneLabel: '내일 다시', onPress })`.

**② `storage` 가 getItem/setItem 모양도 받는다** — 0.4.6 은 `{ get, set }` 만 받아서 순정 AsyncStorage(`getItem`/`setItem`)를 그대로 넘기면 저장값이 조용히 없는 것으로 떨어졌다(앱보조3 지적). 0.4.7 은 `get/set` **또는** `getItem/setItem` 둘 다 받는다 —
`storage={AsyncStorage}` 그대로 된다. 둘 다 있으면 get/set 이 먼저, 모양이 안 맞는 값은 저장소를 안 넘긴 것과 같다(목록을 늦추지 않는다 — `homeStorageUsable`). 메서드는 저장소 객체에 붙여 부른다(this 를 쓰는 저장소도 동작).

## 0.4.8 — (0.7.5 포팅) 홈 목록 9줄의 정의 전체를 패키지가 (대표님 10-20 20:23 「패키지잖아 갖다 넣으면 똑같은 게 그냥 튀어 나와야 하는데」)

앱마다 홈 목록이 달랐던 것(아이콘 · 부제 · 숨김을 앱이 정함)을 없앤다 — **제목 · 부제 · 버튼 · 아이콘 · 바탕색 · 순서를 패키지가 가진다**(기준 = 당근캐시 홈, ota/carrot-ios-106-benefit-1020 814f2f4 FarmScreen HOME_BENEFITS).
앱은 **아이템 이름 · 포인트 이름 · 줄마다 누르기 동작**과 값만 넘긴다. 앱이 아이콘 · 부제 · 숨김을 덮어쓸 수 없고, **동작을 안 넘긴 줄은 그 앱에서 빠진다**.

```tsx
<BenefitQuickList
  homeActions={{ quiz1: openQuiz1, quiz2: openQuiz2, checkin: openCheckin, steps: openSteps, free_item: openFree, today_missions: openMissions, lucky_chance: openLuck, invite: openInvite, recommend: openApps }}
  homeContext={{ itemName: '감자', pointName: '포인트', steps: todaySteps, free: { left, received }, todayMissions: { title: bonusText }, recommend: { desc: promo.desc } }}
  fetchJson={fetchJson} storage={AsyncStorage} refreshKey={tab === 'home'}      // 서버 home_rows(순서 · 제목 · 설명 · 버튼 · 배지 · 보임)는 지금처럼 얹힌다
/>
```
- **줄 key = 서버 key**(`quiz1 · quiz2 · checkin · steps · free_item · today_missions · lucky_chance · invite · recommend`) — 맞춤표(`homeKeys`)가 필요 없다. 순서는 이 순서.
- 당근 기준 값: 쇼핑 태그 퀴즈1(쇼핑백 · 참여하기) · 플레이스 & 쇼핑 태그 퀴즈2(핀) · 매일 출석 체크(달력 · 출석하기) · 만보기/오늘 N걸음(👟 · 보상 받기) · 무료 ○○ 받기(🌱 · 받기, 부제 「하루 3번 들르면 ○○ 받기」) · 오늘의 미션(별 · 보러가기) · 행운 찬스(티켓 · 뽑기, 「하루 기회로 ○○ 뽑기」) · 친구 초대하기(사람+ · 초대하기) · 추천 앱 둘러보기(캐릭터 · 보러가기).
- 앱 값: `itemName`(기본 「포인트」 — 「무료 ○○ 받기」「하루 기회로 ○○ 뽑기」), `pointName`(기본 「포인트」), `pointUnit`(기본 「P」, 「최대 100P」), `steps`(걸음 수 — 없으면 「만보기」), `free`(`total` 기본 3 · `left` · `received` — 막대는 받은 횟수, 놓친 칸이 있어도 다 받음으로 안 나온다, 완료 글자 「내일 다시」),
  `itemIcon`(무료 줄 아이템 그림), `todayMissions`(앱의 동적 제목 · 막대), `recommend`(서버 부제 · 캐릭터 그림). `appName` 은 받아 두기만 한다(지금 문구에는 안 들어간다).
- **서버 home_rows 와의 관계**: 서버가 덮는 것은 제목 · 설명 · 버튼 · 배지 · 보임 · 순서뿐(빈 제목 = 패키지 제목 유지). **아이콘 · 바탕색은 늘 패키지 정의**. 서버에만 있고 동작이 없는 줄은 그리지 않는다(`onRow` 도 이 경우 안 쓴다). 서버 설정이 없거나 실패하면 패키지 정의 그대로.
- `homeActions` 를 안 주면 예전 `items` 방식 그대로(호환) — 단 새 앱은 `homeActions` 를 쓴다. 순수 정의는 `homeDefs.ts`(`buildHomeItems` · `homeItem` · `HOME_ORDER`)로 따로 내보낸다.
- **줄이 빠지는 앱**(현재 서버 home_rows 기준): 꼬꼬 · 꾹테크는 무료 아이템 줄 없음(앱이 `free_item` 동작을 안 넘김. 꾹테크는 「무료 뽑기권」 줄을 붙이는 중 — 서버 `capsule/visit` 값을 `free` 로 넘기면 됨), 나머지 앱은 9줄. 당근은 서버 행이 없어 패키지 정의 9줄.
- (0.4.8) 바탕색 정정: `steps` 줄 `#FFEEE2`(당근 carrotSoft), `free_item` 줄 `#E6F5EA`(당근 heartSoft) — 0.7.5 는 둘 다 `#FDE6D6` 이었다(앱관리가 당근 theme.ts 로 확인). `recommend` 캐릭터는 앱이 `homeContext.recommend.icon` 으로 넘긴다.
