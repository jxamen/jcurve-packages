# @jcurve/lottery

공용 복권(대표님 2026-10-20 14:08 · 14:15 · 14:24 「이것도 패키지로 빼」). mission 0.6.0 에 있던 복권 조각을 따로 뺐다 — **조각 이름 · props 는 그대로**라서 감자밭은 import 이름만 `@jcurve/mission` → `@jcurve/lottery` 로 바꾸면 된다.
peer 는 `react` · `react-native` 뿐이고 새 네이티브는 0이다(`@jcurve/mission` · `@jcurve/ads` 에 의존하지 않는다 — 광고는 앱이 넘기는 함수).

서버(jcurve-api `feat/lottery-server`)가 장부 · 지급 · 추첨을 모두 한다. 규칙 · 금액 · 확률은 어드민 앱 설정(`lottery`)이고 이 패키지에는 없다. 서버가 꺼져 있으면(404 off) `state` 가 null 이라 칩이 안 보인다(서버보다 먼저 앱에 넣어도 안전).

- 미션 1 · 5 · 10개(서로 다른 **쇼핑 · 플레이스 미션**) 참여하면 최대 100 · 500 · 1000원 복권, **매일 기본(황금) 복권**은 미션 없이 앱에 들어오면 지급, 받은 복권은 한국 자정에 사라진다.

```tsx
import { useLottery, LotteryChip, LotterySheet, LotteryResult, GoldenLotteryPopup, goldenTier } from '@jcurve/lottery';
const lot = useLottery(fetchJson, tab === 'home');                  // 홈으로 돌아올 때 다시 읽는다(읽는 순간 서버가 오늘 줄 복권을 만든다)
<LotteryChip count={lot.chip} bottomOffset={tabBarHeight + 12} onPress={() => { void lot.loadWinners(); setSheet(true); }} />
<LotterySheet open={sheet} state={lot.state} winners={lot.winners} busy={lot.busy}
  onOpen={async tier => { const r = await lot.open(tier); if (r.ok) setResult(r.result); }}
  onEarn={tier => goMission()} onClose={() => setSheet(false)} onEnableNotify={askNotify} />
{result ? <LotteryResult result={result} state={lot.state} onOpenNext={…} onMore={goMission} onClose={…} renderNative={() => <HarvestNative />} /> : null}
```

## 조각

- **`LotteryChip`** — 안 연 복권이 있을 때만, 다 열면 사라진다. 기본은 **띠 없이 떠 있는 흰 알약(그림자, `FloatingRewardChip` 과 같은 모양 · 위아래 4px 움직임, 접근성 「동작 줄이기」를 켜면 멈춤)** — 화면 안쪽(탭 바 위)에 두고 `bottomOffset`(아래에서 띄울 거리, 기본 16)만 준다. `floating={false}` 면 줄 안에 놓는 작은 색 알약(0.6.0 모양), `icon` 으로 그림을 바꾼다.
- **`LotterySheet`** — 단계 줄(열기 · 받기 · 획득 완료) · 당첨 띠 · 「한 번 더! ○원 복권 받기」 · 알림 켜기 · `renderNative` 칸. 내용이 화면보다 길면 **시트 안에서 스크롤**한다(0.1.1 — 맨 위 줄이 상태줄 밑으로 잘리던 것). 안전 영역 위 값 `topInset={insets.top}` 을 주면 그 아래에서 끝나고, 안 주면 짐작한다.
- **`LotteryResult`** — 「축하해요 보상 ○P 당첨!」, **큰 아이콘 없음**. `renderNative={() => <Ad />}` 에는 앱이 이미 쓰는 네이티브 광고 컴포넌트를 넘기기만 하면 된다 — **버튼 아래**에 그려진다(0.1.1 에서 바로잡음). 남은 복권이 있으면 「다음 복권 열기」, 없으면 「미션 하고 복권 더 받기」(다음 단계까지 남은 미션 수), 둘 다 「다음에 할게요」.
- **`GoldenLotteryPopup`** — 「황금 복권이 나타났어요!」 하루 한 번(띄운 날짜 기억은 앱, 띄울지는 `goldenTier(lot.state)` 가 null 이 아닌지). **0.1.2에서 읽기 쉽게 다시 짰다**: 닫기(X, 자기 줄) → 황금 복권 그림(앱 그림은 `icon`, 없으면 기본 티켓) → 제목 → 쉬운 말 3줄(「하루에 한 장, 무료로 드려요」 · 「광고 1번 보면 바로 열 수 있어요」 · 「최대 1,000원(1,600P)이 포인트로 바로 들어와요」) + 작은 글씨 「오늘 자정까지 열 수 있어요」 → 버튼 → 「다음에 열기」. 바깥 여백 28 · 제목 ↔ 설명 ↔ 버튼 16~24. **값은 서버 state 에서**: `const g = goldenTier(lot.state); <GoldenLotteryPopup maxWon={g.maxWon} maxPoints={g.maxPoints} …/>` (하드코딩 없음). `bottomInset={insets.bottom}` 으로 아래 안전 영역. 문구는 `lines` · `note` · `buttonLabel` · `closeLabel` 로 바꾼다(다국어). 버튼 「광고 보고 황금 복권 열기」 안 오른쪽에 **「광고」 칩**(광고가 바로 열린다) — 서버 `daily_basic.ad` 가 꺼진 앱은 `ad={false}`(칩 · 광고 문구 없음). 버튼에서 앱이 **보상형 광고를 customData `lottery_basic` 으로** 보여 준 뒤 `lot.open(tier, 'basic')` 을 부른다 — 광고 시청은 **서버가 구글 SSV 로 확인**한다(없으면 `ad_required`, 광고 확인이 늦게 도착하면 한 번 더 시도). 앱의 `AdPurpose` 타입에 `'lottery_basic'` 한 줄을 더한다(@jcurve/ads 판은 필요 없다).
- 모두 상태가 없고 Modal 이 아니라 화면 위 덮개다(보상형 광고가 Modal 뒤에 깔리지 않게). 색은 `theme`(`MissionPageTheme` 을 그대로 넘겨도 됨).

## 열기와 오류

- `lot.open(tier, src?)`: 한 번에 하나만, 네트워크가 끊겨 다시 보낼 때는 같은 멱등 키(서버가 저장된 결과를 다시 준다), 서버가 답한 뒤에는 새 키. 잠금은 끝나면 반드시 풀린다.
- **`toLotteryError(e)`** — 앱 요청 함수가 던지는 꼴(`ApiError.code`/`status`, `{error}`, `{data:{error}}`, `{body:{error}}`)을 그대로 읽는다. 앱이 `{error, status}` 로 바꿔 던질 필요가 없다. 서버 이름이 아니면 404 → `off`, 503 → `not_ready`, 그 밖은 `network`.

## 시험 모드(서버 없이 보기)

`createMockLotteryApi()` 가 서버와 같은 응답 모양 · 오류 이름 · 규칙의 가짜 요청 함수를 준다. 시뮬 / 시험 모드에서만 `fetchJson` 자리에 꽂는다(운영 빌드에는 꽂지 않는다).

```tsx
const mock = useMemo(() => createMockLotteryApi({ participated: 5, golden: true }), []);
const lot = useLottery(__DEV__ && simMode ? mock.fetchJson : fetchJson, tab);
mock.setParticipated(10);   // 기준을 채우면 다음 읽기 때 복권이 생긴다
mock.grantAd();             // 황금 복권을 열 광고 확인 한 건(없으면 ad_required)
```
옵션: `participated` · `golden`(기본 true) · `adFree`(**기본 true** — 시뮬 · 테스트 광고는 SSV 를 못 받는다. false 로 두면 서버처럼 `ad_required`, `grantAd()` 로 한 건씩) · `wonToPoint`(기본 160) · `tiers` · `winners` · `seed`(같은 추첨) · `latencyMs` · `off`(서버 꺼짐 흉내). `mock.calls` 로 무엇을 불렀는지 본다. 금액 · 확률은 시험용 값이다.

## 낱개

`fetchLotteryState` · `fetchLotteryWinners` · `openLottery` · `createLotteryOpener` · `parseLotteryState` · 문구 함수(`lotteryTierTitle` · `lotteryTierHint` · `lotteryTierButton` · `lotteryMoreLabel` …).
옛 「복권 뽑기 N번 남았어요」 칩(tree/draw 풀)은 새 칩이 들어가면 앱 홈에서 뺀다 — 새 복권은 별도 장부(`lottery_tickets`)라 행운 찬스 · 오늘의 미션 chance 판정과 섞이지 않는다.

`mock` 은 열 때마다 남은 장수를 줄인다 — 다 열면 `state.unopened` 가 0 이 되어 칩이 사라진다(0.1.1 — 감자밭 시뮬에서 확인).

## 광고 칩 (0.1.2)

광고가 **바로 열리는** 버튼에만 「광고」 작은 칩을 둔다(앱 홈 「감자 키우기 [광고]」 · 「풍선 더 받기 [광고]」와 같은 모양), 광고 없이 열리는 버튼에는 두지 않는다.
- 황금 복권 팝업: 버튼 안 오른쪽(`ad` 기본 true).
- `LotterySheet`: 줄의 「열기」 버튼 — 그 단계에 미션 복권이 아니라 **황금 복권만** 남았을 때(`opensWithAd(tier, basicAd)`). `basicAd={false}` 면 없음. 칩 글자는 `adLabel`.
- `LotteryResult`: 「다음 복권 열기」 — `nextAd={nextOpensWithAd(lot.state, basicAd)}` 를 넘긴다(안 주면 칩 없음).

## 🔔 복권 받기 알림 켜기 (0.1.2)

알림이 **꺼져 있을 때만** 시트 · 황금 팝업 · 결과 창에 「🔔 복권 받기 알림 켜기 / 매일 새 복권이 나오면 알려 드릴게요」 줄이 보인다(켜져 있으면 없음). **알림 발송은 이 패키지에 없다** — 버튼과 권한 유도만.

```tsx
const notify = useLotteryNotify({
  getNotificationStatus: async () => (await Notifications.getPermissionsAsync()).status,   // 'granted' | 'denied' | 'undetermined' (true/false 도 됨)
  onEnableNotifications: async () => { await Notifications.requestPermissionsAsync(); await registerPushToken(); },   // 앱의 기존 push 경로(토큰 등록 포함)
});
<LotterySheet … notify={notify} />  <GoldenLotteryPopup … notify={notify} />  <LotteryResult … notify={notify} />
```
누르면 아직 안 물은 기기는 `onEnableNotifications('ask')`(OS 권한 요청 + 토큰 등록은 앱 경로), 이미 거절한 기기('denied')는 `Linking.openSettings()` 로 설정 화면을 연다(`openSettings: false` 면 앱 콜백이 `'denied'` 로 받는다). 화면이 뜰 때 · 앱이 앞으로 돌아올 때(설정에서 켜고 온 경우) 권한을 다시 읽어 줄이 사라진다. 권한을 모르면(콜백이 던지면) 조르지 않는다. 옛 `onEnableNotify` 줄(항상 보임)은 그대로 있다.

## 0.1.3 — 바텀 시트 · 당첨 전체 화면 · 포인트 표 (대표님 10-20 15:53~15:57)

- **복권 목록 · 황금 복권은 확실한 바텀 시트**: 뒤 화면 어둡게(딤, 누르면 닫힘) · 오른쪽 위 X · 위 손잡이 바 · 둥근 위 모서리 · 아래 안전 영역(`bottomInset={insets.bottom}`) · Android 뒤로 가기는 닫기. 기본(`presentation="overlay"`)은 RN Modal 이 아니라 **부모 영역을 덮는 absolute 판**이다 —
  보상형 광고가 Modal 뒤에 깔리지 않게(iOS 는 RN Modal 이 떠 있으면 AdMob 이 광고를 못 연다). **탭 메뉴까지 덮으려면 앱 루트(탭 · 상태줄 바깥)에서 그린다.** `presentation="modal"` 이면 RN Modal(탭 · 상태줄 위) — 그때는 광고를 열기 전에 먼저 닫을 것.
- **복권 시트 구성**(참고 캡처 IMG_9331): 큰 제목 2줄 + 회색 한 줄 → 회색 둥근 당첨 띠(**서버 winners 의 실제 기록이 있을 때만**, 없으면 숨김) → 줄(왼쪽 숫자 카드 1 · 5 · 10 · 황금 ★, 색이 다름 · 「최대 ○ 복권」 · 회색 설명 · 오른쪽 「열기」/「받기」/「받기 완료」) → 큰 「한 번 더! ○ 복권 받기」 → 「🔔 복권 받게 알림 켜기 ›」 링크(알림이 켜져 있으면 숨김).
  줄은 **미션 복권 줄(단계마다)** + **황금 복권 줄(하루 기본 복권이 있을 때)**. `onOpen(tier, src)` 의 `src` 가 'mission' 이면 미션 복권, **'basic' 이면 황금 복권 — 앱이 보상형 광고(customData `lottery_basic`)를 먼저 보여 준 뒤** `lot.open(tier, 'basic')`. 광고 칩은 황금 줄 버튼에만.
- **당첨 결과는 전체 화면**: `LotteryResult` 가 탭 메뉴 · 상태줄까지 덮는다(`topInset` · `bottomInset` 안전 영역). 위 X · 가운데 「축하해요!」 + 큰 「5P 당첨!」 + 복권 그림(`icon`, 기본 황금 티켓) · 아래 「다음 복권 열기 (N장 남았어요)」 / 「한 번 더! ○ 복권 받기」 + 「확인」 + 알림 링크 + 네이티브 광고. 포인트 표는 원 표시 없음, 원 표는 「○원 복권」 한 줄.
- **포인트 표(서버 `unit:'points'`)**: 단계 · 열기 결과 · 당첨 띠가 P 로 — 「최대 1,000P 복권」 · 「5P 당첨!」 · 「Noe****님이 1,000P 당첨됐어요!」 · 황금 팝업 「최대 1,000P가 바로 들어와요」(`<GoldenLotteryPopup maxWon={g.maxWon} maxPoints={g.maxPoints} unit={g.unit} …/>`). 서버가 `unit` 을 안 주면(원 표) 예전 문구 그대로.
- 새 props: `LotterySheet`/`GoldenLotteryPopup`/`LotteryResult` 의 `presentation` · `topInset` · `bottomInset`, `LotteryResult` 의 `icon` · `open`, `GoldenLotteryPopup` 의 `unit`. `LotterySheet.onOpen` 은 `(tier, src?)`. 새 헬퍼: `lotteryTierAmount` · `lotteryResultHeadline` · `lotteryWinnerParts` · `lotteryMissionButton` · `lotteryMissionHint` · `goldenRow`.

## 0.1.4 — 줄 설명 · iOS 줄바꿈 · 당첨 화면 「확인」 삭제 · 위쪽 압축 (대표님 10-20 16:37~16:42)

- **줄 설명은 늘 「받는 방법」, 한 줄**: `lotteryMissionHint` — 열 수 있든(ready) 이미 열었든(opened) 못 받았든 「미션 N개 하면 받아요」(1 · 5 · 10 · 20 · 30 모두 같은 꼴, 「쇼핑 · 플레이스」는 뺐다), 일부 했으면 「미션 M개 더 하면 받아요」,
  하루 한도에 막힌 줄은 버튼과 같은 말 「내일 다시 받을 수 있어요」. 황금 줄은 `lotteryGoldHint(basicAd)` — 「하루 1번 광고 보고 받아요」(광고 없이 열리면 「하루 1번 받아요」). 「미션 1개로 받았어요」(이미 받은 이유로 읽혔다)는 없어졌다.
  줄 설명 글자는 `numberOfLines 1` + `adjustsFontSizeToFit`(최소 0.85배) — 좁은 폭(SE)에서 넘칠 때만 조금 줄어든다. 단계는 서버 `tiers` 대로 그려진다 — 5단계(1 · 5 · 10 · 20 · 30)도 같은 코드.
- **iOS 한글 줄바꿈**: 이 패키지의 모든 글자가 `lineBreakStrategyIOS="hangul-word"`(띄어쓰기에서만 끊김). 시트 제목은 24px · 줄어듦(`numberOfLines 2` · `adjustsFontSizeToFit`), 줄 제목 · 줄 설명은 한 줄로 줄어든다(「받아가요!」가 「받아가 / 요!」로 갈라지던 것).
- **당첨 전체 화면**: `LotteryResult` 의 새 prop **`confirm`**(기본 `true` = 예전 그대로). `confirm={false}` 면 글자 버튼 「확인」이 없고 닫기는 오른쪽 위 X 뿐(감자밭). 남은 복권 0 이어도 「확인」 없이 X 만 — 큰 제목 · 그림 · 네이티브 광고는 그대로.
- **위쪽 압축 — 네이티브 광고 카드가 스크롤 없이 끝까지**: 위 여백 · 그림(약 60%) · 제목(48→34px) · 간격 · 큰 버튼(56→48) · 알림 줄(설명 줄 없이 한 줄)을 줄였다. 광고 위 높이 합은 `lotteryResultTopHeight({ big, notify, confirm, wonLine })`(위 안전 영역 제외) —
  iPhone SE(375×667, 위 20)에서 큰 버튼 · 알림 줄이 있고 「확인」이 없으면 266pt, 광고 카드(폭 375 기준 약 360pt)가 다 보인다. 「확인」을 남기면(기본) 넘칠 수 있으니 광고를 아래에 두는 앱은 `confirm={false}`.
- 가짜 서버(`createMockLotteryApi`)는 `tiers` 옵션으로 5단계도 준다: `tiers: [1, 5, 10, 20, 30].map(n => ({ missions: n, max: n * 100 }))`.

## 0.1.5 — 줄 묶기 · 퀴즈 문구 · 숫자 박스 삭제 · 알림 상자 가운데 (대표님 10-20 17:06~17:08)

감자밭 앱이 먼저 구현한 4가지를 패키지에 넣었다 — `LotterySheet` 를 쓰는 앱은 자동 반영. 서버는 그대로(1 · 5 · 10 · 20 · 30 문턱).
- **줄 묶기**: 「같은 표(maxWon · maxPoints · unit) + 문턱이 10 의 배수(≥10)」인 이어진 단계(10 · 20 · 30)를 **한 줄**로 — 설명 「쇼핑 · 플레이스 퀴즈 10개마다 받아요」, 버튼 「열기」는 열 수 있는 장 수만큼(「열기 2」 — 단계마다 미션 복권은 하루 한 장이라 `missionState==='ready'` 인 단계 수),
  누르면 안 연 첫 단계(`onOpen(tier, 'mission')`), 못 받은 단계가 남았으면 「받기」(`onEarn(첫 못 받은 단계)`), 한도에 막혔으면 「내일 받아요」, 다 열었으면 「받기 완료」. 5단계가 아니거나(20 · 30 없음) 표가 다르면 묶지 않는다.
  직접 줄을 그리는 앱은 `lotteryGroupTiers(state.tiers)` → `lotteryTierRow(group, quiz?)`(`{ rep, tiers, hint, button, openTier, earnTier }`)를 쓰면 된다.
- **문구 「미션」→「쇼핑 · 플레이스 퀴즈」**: `lotteryMissionHint(t, quiz?)` — 「쇼핑 · 플레이스 퀴즈 N개 하면 받아요」(일부 했으면 「… M개 더 하면 받아요」, 한도면 「내일 다시 받을 수 있어요」, 「받았어요」 없음). 이름은 `DEFAULT_QUIZ`, 앱마다 다르면 `LotterySheet` 의 새 prop **`quiz`**(예: `quiz="미션"`) 로 바꾼다.
- **줄 맨 앞 숫자 박스(1 · 5 · 10 · 황금 ★) 삭제**: 제목 · 설명이 맨 왼쪽부터, 오른쪽에 버튼 — 황금 줄도 같은 정렬.
- **「🔔 복권 받게 알림 켜기」 상자 가운데 정렬**: 상자(가로 전체) · 종 · 제목 · 화살표 줄 · 설명(여러 줄이어도) 모두 가운데 — 시트 · 황금 팝업 · 당첨 화면의 같은 상자.
- 지우고 바뀐 것: `cardColors` · 숫자 카드 스타일 삭제(내부 것), 0.1.4 의 「미션 N개 하면 받아요」는 위 퀴즈 문구로 대체. 목록 **전체 화면**(⑥)은 아직 아니다 — 필요하면 따로.

