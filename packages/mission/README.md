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
const fallbackCards = [{ id: 'shopping', type: 'apihub_shopping', title: '일주일 쇼핑 미션', desc: '매일 상품을 구경하고 포인트를 받아요' }, { id: 'place', type: 'place_stamp', title: '일주일 장소 미션' }];
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
