# @jcurve/steps 0.2.0 앱 연결

로컬 tgz를 설치한다. GitHub release/npm publish 없이 전달한 파일이다.

```sh
npm install /Users/jcurve/dev/appmgr/outbox/vendor-1020/jcurve-steps-0.2.0-f1.tgz
```

기존 0.1.1의 네이티브 구성(Expo 센서/Health Connect와 권한)은 그대로 사용한다. 새 네이티브 모듈과 광고 SDK 의존성은 없다. 옛 바이너리에서는 0.1.1과 동일한 nativeExists 가드로 unavailable을 표시한다.

센서 저장소는 기존 공개 API로 화면 진입 전에 계정별 구성한다. 앱의 영속 저장소를 그대로 연결하며 로그아웃 때 센서 구독을 해제하고 계정별 데이터를 지운다.

```tsx
import { configureStepsStorage, StepsScreen } from '@jcurve/steps';

configureStepsStorage({
  getItem: key => appStorage.getItem(key),
  setItem: (key, value) => appStorage.setItem(key, value),
}, `myapp:${member.id}`);

// api 객체는 useMemo 또는 모듈 상수로 유지한다.
const stepsApi = {
  fetchStages: fetchStepsStages,
  // SSV 컨텍스트가 필요하면 여기서 withSsv로 감싼다.
  claimStage: (id, day, earned) => withSsv(() => claimStepsStage(id, day, earned)),
  sync: syncSteps,
};

<StepsScreen
  key={String(member.id)}
  memberId={member.id}
  api={stepsApi}
  showRewardedAd={purpose => showAd(purpose, String(member.id))}
  onPendingClaim={({ purpose, key, stage_id, day, earned }) =>
    holdClaim('steps', purpose, key, { stage_id, day }, earned)}
  onBalance={refresh}
  ensureVersion={ensureStepsVersion}
  onClose={onClose}
  header={<ScreenHero char="phone" title="만보기"
    sub="1,000걸음마다 광고 보고 포인트를 받아요" onBack={onClose} />}
  adSlot={<HarvestNative unitId={ADMOB.nativeFarmUnitId}
    style={{ marginTop: 16, marginHorizontal: 16, width: undefined, alignSelf: 'stretch' }} />}
/>
```

`api.sync`는 `{ days: [{date, steps, source}] }`를 받는다. `fetchStages`는 `StepsState`, `claimStage(id, day, earned?)`는 `StepsState & {gained, balance}`를 반환한다. 기존 stages API의 데이터 필드를 변경하지 않는다.

`showRewardedAd`는 `{earned, opened?, noAd?, message?}`를 반환한다. earned이면 청구하고, opened이며 noAd가 아닌 미확인 결과와 no_ad/ssv_pending 청구 응답은 onPendingClaim으로 넘긴다. 이 콜백은 선택 사항이다. 앱에서 기존 미결 청구 재시도/정산을 계속 담당한다. 이미 서버 확인된 광고를 재사용하려면 앱 어댑터에서 이를 확인해 `{earned:true}`를 반환한다.

꿀꿀 원본과 같은 상단을 위해 앱의 ScreenHero를 위와 같이 header로 넘긴다. 기존 SwipeBack도 앱에서 바깥을 감싼다. 패키지는 Skia·캐릭터 자산·제스처 SDK를 가져오지 않는다. header 생략 시 단순 뒤로가기 머리글(52px)을 그리므로 꿀꿀 상단과는 다르다. adSlot의 여백/크기는 앱이 위 예처럼 제공한다. 바깥 안전영역은 앱이 잡는다.

`theme`은 bg/card/text/sub/line/dim/primary/primarySoft/onPrimary/radius 부분 덮어쓰기다. 기본은 꿀꿀 색과 반경이다. 선택 필드 primaryDeep(남은 횟수·비활성 버튼 글자), bgSoft(안내사항 바탕)도 덮어쓸 수 있다. `strings`는 한국어 원문을 키로 한 부분 덮어쓰기다. 동적 완성 문구도 같은 방식으로 덮어쓴다.

```tsx
strings={{ '만보기': '오늘의 걸음', '꿀꿀캐시 만보기는 1,000걸음마다 광고 보기를 완료하면 포인트를 받아요.': '우리 앱은 1,000걸음마다 광고 보기를 완료하면 포인트를 받아요.' }}
```

compare-pig-vs-package.png는 좌 꿀꿀 원본/우 패키지 각 390×844이다. 두 쪽 모두 3,450걸음·2개 수령·1개 수령 가능 데이터와 동일 광고 대체 슬롯으로 렌더했다. 「남은 횟수」는 유지한다. 신발·말풍선 꼬리·단계 점/막대는 꿀꿀 원본 JSX에 없으므로 표시하지 않는다.

검증 범위: 원본 ScreenHero(문구·간격·실제 phone 캐릭터 PNG)를 양쪽에 사용한다. Skia HeroSky 배경만 웹에서 제외했고 SwipeBack은 정지 View로 대체했다. 실제 광고 SDK도 대체 슬롯이다. 본문 RGB 픽셀 차이는 0이다. 캐릭터 그림 경계 107픽셀은 브라우저의 소수점 위치 이미지 보간 차이가 있다(전체 차이 영역 x289–370, y37–119). Skia 배경·실기기 제스처·광고 SDK 콘텐츠의 일치를 증명하는 캡처는 아니다. 앱에서 원래 ScreenHero/SwipeBack/HarvestNative를 주입하면 해당 그림과 동작은 앱이 제공한다.

재현: origin/store/pigcash-1.1.6-1020의 src/screens/StepsScreen.tsx, src/ui, assets/pig30을 별도 디렉터리로 추출한다. packages/steps/verification/render.mjs를 STEPS_TOOLS(React/react-dom/react-native-web/esbuild/playwright 설치 경로), PIG_SOURCE(추출한 StepsScreen.tsx), STEPS_OUT(출력 디렉터리)와 함께 실행한다.


## 0.3.0 — 어제 걸음도 받기 (대표님 10/28 07:53 「어제 걸음도 받게 하기」 + 「어제 이미 보상을 받았는지를 잘 체크해야 해」)

서버(앱보조5, 10/28 08:08 배포): `GET steps/stages?day=YYYY-MM-DD`(KST, **오늘 · 어제만**, 그 앞은 422 `bad_day`) · `POST steps/stages/claim {stage_id, day}`(어제도 오늘과 같은 규칙, 그 앞 날짜 · 내일 · 이상한 값은 409 `day_changed`) ·
`steps/sync` 의 `days[]` 에 어제 날짜를 넣으면 받는다. 광고 용도는 날짜를 따라간다(`steps_stage:<day>:stage_N` — 어제 청구면 어제 날짜로 광고를 본다). 같은 (회원 · 날짜 · 단계) 재청구는 지급 없이 `200 {replayed:true, gained:0}`. 하루 최대(250P)는 날짜마다 따로 센다.

바뀐 것
- **센서 읽기**: iOS 는 어제까지(CoreMotion 날짜별), Android 는 헬스 커넥트가 어제까지(없으면 앱이 켜진 동안 센 만큼만 — 이미 장부에 있던 어제 값). 이전에는 `readDays` 가 읽고도 오늘만 남겼다. `readToday().steps` 는 **오늘** 걸음이고 `days` 에 어제가 같이 들어 있다.
- **서버로 올리기**: `syncToday(days, send)` 가 오늘 + 어제를 보낸다(그 앞 날은 안 보냄).
- **받은 여부는 서버 응답만 믿는다**: `yesterdayView(state)` 가 `steps/stages?day=어제` 응답의 `claimed` · `available` · 하루 최대로 「받을 수 있는 단계」를 센다. 응답이 없거나, 응답의 `day` 가 어제가 아니거나(자정이 지났다 · 서버가 오늘을 줬다), 받을 단계가 0 이면 카드는 **안 보인다**(걸음 0 · 다 받음 · 하루 최대 · 서버가 `available:false`).
- **`<StepsYesterdayCard state onClaim busy theme />`**: 오늘 카드 바로 아래에 두는 「어제 걸음」 카드(어제 걸음 수 · 남은 횟수 · 「광고 보고 N P 받기」 · 「오늘 자정(한국 시간)까지 받을 수 있어요」).
- **`<StepsScreen api={{ …, fetchStagesOn }}>`**: `fetchStagesOn(day)` 를 주면 화면이 어제 상태를 받아 카드를 단다. 안 주면 예전과 같다. 어제 요청이 실패해도 오늘 화면은 그대로(카드만 안 보인다). 어제 받기는 걸음 센서 상태와 무관하다(서버가 이미 아는 걸음).
- 안내 문구 한 줄이 바뀌었다: 「…받지 않은 횟수는 다음 날로 넘어가지 않아요」 → 「…받지 못한 어제 몫은 오늘 자정까지 「어제 걸음」에서 받을 수 있고, 그 뒤에는 사라져요」. `strings` 로 그 줄을 바꿔 쓰는 앱은 새 문장으로 맞춰야 한다.

자기 만보기 화면을 가진 앱(예: 에그머니 `StepsPage`, 당근 `StepsScreen` 0.1.x 방식)에 붙이는 법
1. api: `fetchStepsStages(day?)` → `GET steps/stages` + (day 가 있으면) `?day=`. `claimStepsStage(stage_id, day)` 는 이미 day 를 받는다.
2. 화면이 열릴 때 · 걸음 동기화 뒤: `const y = await fetchStepsStages(yesterdayKst())`(실패는 삼킨다).
3. 오늘 카드 아래: `<StepsYesterdayCard state={y} busy={…} theme={…} onClaim={(stage) => { /* 어제 날짜의 stage.ad_purpose 로 광고 → claim(stage.stage_id, y.day) */ }} />`. 광고에는 응답의 `ad_purpose` 를 그대로 넘긴다(어제 날짜가 들어 있다).
4. `feed_used`(에그머니: 그날 걸음을 먹이로 바꿨으면 포인트 거절) · `daily_max` · `not_enough_steps` · `day_changed` · `bad_stage` · `bad_day` 는 기다리지 않고 알린다.

## 0.3.1 — 큰 글씨(접근성 2.0)에서 버튼 글자가 잘리지 않게 (앱보조6 지적)

`StepsYesterdayCard` 의 받기 버튼과 공용 `StepsScreen` 의 받기 · 안내 버튼이 고정 `height` 48 + 한 줄 제한(`numberOfLines={1}`)이라 큰 글씨에서 글자가 잘렸다. 고정 `height` → `minHeight`(+ 위아래 여백), 글자는 줄바꿈을 허용하고 가운데 정렬로 바꿨다(머리줄도 `minHeight`). 동작 · API 는 0.3.0 과 같다.

## 0.3.2 — 놓친 걷기 단계 광고 보상 되찾기 `healUnclaimedStages` (JS만 · 네이티브 없음 · 앱이 `adSeen` 을 줄 때만 동작)

**원인(서버 7일 숫자 + 꿀꿀 코드, 10/28)**: 걷기 단계 광고(`steps_stage:<날짜>:<단계>`)가 전 앱에서 가장 많이 새는 용도다 — 24시간 기준 열림+건너뜀: 꾹테크 31.8%(7/22, 표본 작음) · 꼬꼬 8.3% · 당근 8.3% · 꿀꿀 6.9%(17/248) · 감자밭 2.7% · 머니트리 0.6%. 꿀꿀의 재시작 복구는 `claims[row.purpose]` 로 **정확히 같은 이름**을 찾고 없으면 기록을 조용히 지우는데(`pendingAd.ts`), 걷기 단계 용도는 접미사가 붙어 표에 이름이 없다.
그리고 꿀꿀 · 꾹테크 · 당근 · 꼬꼬는 이 패키지의 `<StepsScreen>` 을 쓰지 않고 각자 `src/screens/StepsScreen.tsx` 를 갖고 있어(헬퍼만 가져다 씀), 화면 안에 고침을 넣으면 닿지 않는다 → **화면 없는 함수**로 낸다.

- `healUnclaimedStages(api, [오늘 상태, 어제 상태], { memory, canRun?, onClaimed? })` — 받을 수 있는 단계(`canClaimStage`)마다 `api.adSeen(단계의 ad_purpose, 그 날 한국 자정 초)` 를 **한 번** 묻고, `true`(구글 확인이 와 있고 아직 청구 안 됨)이면 `api.claimStage(stage_id, day, true)` 로 받는다. 이미 받은 단계 · 걸음 모자람 · 하루 최대 · 날짜 지난 단계는 묻지도 않고, 모든 실패는 조용히 삼킨다. `adSeen` 이 없으면 아무것도 안 한다(예전 그대로). 답을 받은 단계는 같은 화면에서 다시 묻지 않고(`memory`), 모른다(null · 오류)는 최대 3번.
- **중복 지급 0 (서버 코드 근거 — `StepsStageController::claim`, `TreeController::consumeAd`, `StepsStageSchema`)**: 회원 행을 `lockForUpdate` 한 트랜잭션 안에서 ① 이미 받은 단계면 `replayed` + 0P ② 광고 확인 한 줄을 `claimed_at IS NULL` 비교 갱신(`update … === 1`)으로 **한 번만** 소비 ③ `steps_stage_claims` 유일 키 `(app_id, member_id, day, stage_id)` 와 원장 `ledger_ref`(유일) — 같은 단계를 두 번 받아도 포인트는 한 번이다. `ads/seen` 은 읽기만(지급 없음).
- 패키지 `<StepsScreen>` 은 `api.adSeen` 이 있으면 단계 상태가 바뀔 때마다 자동으로 부른다(받았으면 「지난 광고 보상 5P 받았어요」 한 줄). 앱 자체 걷기 화면은 상태를 불러온 직후 한 줄: `void healUnclaimedStages({ adSeen, claimStage }, [state, yesterday], { memory: healed.current, canRun: () => mounted && !busy, onClaimed: (next) => { setState(next); } })`.
- 앱이 주는 것: `adSeen(purpose, sinceSec): Promise<boolean | null>` = 앱이 이미 가진 `ads/seen` 호출(응답 `seen` 불리언, 길이 없으면 null).
