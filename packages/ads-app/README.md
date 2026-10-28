# @jcurve/ads-app

앱 층 광고 접착의 **공용 부분**. JS 전용 — `ios/` · `android/` · config plugin 이 없다(OTA 로만 올라간다). 네이티브가 필요한 광고 엔진은 `@jcurve/ads`.
설계: `ADS-GLUE-DESIGN.md`(outbox/ads-glue-design). 기준 구현은 머니트리 `12eeee8f`, 코드는 **바꾸지 않고 옮긴** 뒤 앱 사본들과 비교해 상위집합으로 맞췄다.

## 0.1.0 — 순수 모듈 셋 (기기 모듈을 읽지 않는다)
| 모듈 | 내용 | 앱 사본과의 관계(10앱 최신 줄 기준) |
|---|---|---|
| `appOpenRules` | 앱 오프닝 광고를 **보여도 되는지** 가리는 순수 규칙(`decide`) · 가드 창 · 하루 횟수 · `shouldHold` / `coldPrecheck` / `COLD_HOLD_MS`(스플래시 붙잡기) | 머니트리 · 에그머니 · 캐시팡팡 · 감자밭 · 꾹테크 · 영테크 사본은 이 파일과 **주석(저장소 키 이름)만 다르다**(0~4줄). 당근 · 꿀꿀 · 용돈캡슐 사본은 `shouldHold` 묶음이 더해진 판으로 이 파일과 주석만 다르다. 이 패키지는 후자(상위집합)라 앞의 앱들은 안 쓰는 export 가 늘 뿐 판단은 같다. |
| `appOpenGuard` | 앱을 떠나거나 전체화면 광고를 띄우기 **전에** 부르는 가드(`markReturnGuard` · `noAppOpenFor` · `setFullScreenAd` …) + 전체화면 광고 듣기 `watchFullScreenAd`(하나) · `onFullScreenAd`(여럿, 그만 듣는 함수를 돌려줌) | 앱 사본은 세 가지로 갈라져 있다(머니트리 `watchFullScreenAd` · 에그머니 / 당근은 이 파일 안에서 `@jcurve/updates` `setBusy`/`clearBusy`(키 이름 `fullscreen-ad` / `ad`) · 영테크 `onFullScreenAd`). 패키지는 업데이트 모듈을 **읽지 않고**, 듣는 쪽을 앱이 단다. |
| `adMode` | `readUpdateChannel` · `useTestAdUnit`(production 채널만 실광고, 등록된 테스트 기기는 실단위 + 테스트 광고) | 에그머니 · 감자밭 · 영테크 사본은 **바이트 동일**. 캐시팡팡 · 당근 · 꾹테크는 26~37줄 다르다(앱에서 비교 필요). |

## 앱이 바꾸는 것(앱마다 한 번에 한 앱, 앞의 표의 「주석만 다름」 앱부터)
- `src/ads/appOpenRules.ts` · `appOpenGuard.ts` · `adMode.ts` 를 지우고 `@jcurve/ads-app` 에서 가져온다. 앱의 시험은 그대로 둔다(같은 입력 → 같은 결과).
- 가드의 OTA 보류 연결(에그머니 · 당근): 앱 루트에서 `onFullScreenAd((showing) => showing ? setBusy('ad') : clearBusy('ad'))` 로 옮긴다. 키 이름(`ad` / `fullscreen-ad`)은 앱이 쓰던 그대로.
- **네이티브 변경 없음**(OTA 가능). 새 의존성 없음.

## 다음(0.2.0)
보상 흐름 `showAd`(+ 열린 광고 복구 · 대기 청구 · `ads/seen`) 를 요청 / 저장소 / 말하기 어댑터로 — 「기록형」과 「청구 대기형」 두 복구 어댑터와 용도별 재지급 분기. 앱 오프닝 훅 · 원격 스위치 · 탭 배너 유닛 선택은 그다음.

## 0.2.0 — 열린 광고 복구 `recovery` (JS 전용 · OTA 가능 · 앱에 아직 안 넣음)

광고가 열렸는데 결과를 못 받은 채 앱이 꺼져도 다음 실행에서 서버 `ads/seen` 으로 확인하고 그 자리의 청구를 다시 부른다. **10앱이 10가지로 갖고 있던 것**(`pendingAds`/`adPending`/`recoverOpened`/`openedRecovery`/`rememberOpened` …)을 캐시팡팡 `pendingAd.ts` 를 기준으로 하나로 맞췄다. 캐시팡팡의 기존 시험은 그대로 옮겨 통과한다.

### 기존 구현에서 바뀐 세 가지
1. **접두 일치**: 용도 표를 이름 정확 일치로만 찾지 않고 `'steps_stage:*'` 처럼 접두로도 찾는다(걷기 단계 용도는 `steps_stage:<날짜>:<단계>`). 정확한 이름이 먼저, 접두끼리는 더 긴 쪽이 먼저.
2. **조용히 지우지 않는다**: 표에 없는 용도의 기록은 **남겨 두고**(24시간 뒤 정리) `onUndeclared(row)` 로 알린다(실행마다 용도당 한 번). 기록을 지우려면 `{ kind: 'skip', why }` 로 **선언**한다(앱이 로컬로 지급하는 용도 · 복권처럼 다른 곳이 되살리는 용도). 꿀꿀의 `if (!claim) { remove }` 가 이 함정이었다.
3. **확인 경로 없음(null)**: `seen` 이 `null` 이면 청구 경로가 서버 확인을 대신해 바로 청구한다(꿀꿀 방식). `false` 는 아직 안 온 것이라 남긴다.

### 쓰는 법
```ts
const pending = createPendingAds(AsyncStorageLike, 'cp.pendingAds');       // 앱의 기존 저장소 키를 그대로 쓰면 이미 쌓인 기록이 이어진다
const recover = createAdRecovery();                                         // 앱 시작 때(홈 진입) 한 번
await recover({
  pending, memberId, refresh, say,
  seen: (row) => adSeen(row.purpose, Math.floor(row.openedAt / 1000)),      // true / false / null — since 는 초 단위
  purposes: {
    ticket: { kind: 'claim', claim: (key) => receiveWind(key, key, 'ticket') },
    'steps_stage:*': { kind: 'claim', claim: (key, row) => claimStepsByPurpose(row.purpose) },
    lottery_basic: { kind: 'skip', why: '복권 쪽이 되살린다' },
    scratch: { kind: 'skip', why: '앱이 로컬로 지급' },
  },
  onUndeclared: (row) => log('undeclared ad purpose', row.purpose),
});
```
앱의 시험에 `expect(undeclaredPurposes(앱의 용도 이름 목록, purposes)).toEqual([])` 한 줄을 두면 **새 용도를 추가하면서 복구를 빼먹는 일**이 시험에서 걸린다.

### 앱마다 바뀌는 것(코드로 확인한 것만)
캐시팡팡 `pendingAd.ts`(`cp.pendingAds`) · 용돈캡슐 `pendingAd.ts`(`mc.pendingAds`) · 꿀꿀 `pendingAd.ts`(`pc.pendingAds`) 는 거의 같은 모양이라 파일을 지우고 이 패키지로 바꾸면 된다. 당근(`cc.openedAd.v1`) · 감자밭(`potatofarm.ad-pending.v1`) · 머니트리(`mt.openedAds.v1`) · 영테크(`yt.adOpened.v1`) · 꾹테크(`stamptech.openedAds.v1`) · 에그머니(청구 장부) · 꼬꼬(`@kkokko/opened-ad/v1`)는 **기록 모양이 달라**(청구 경로 · 인자를 기록에 같이 저장하는 방식 등) 어댑터가 더 필요하다 — 다음 판(0.3.0, 「기록형」/「청구 대기형」 어댑터). 기록 저장 키를 바꾸면 쌓인 기록이 끊기므로 키는 그대로 둔다.

### 0.2.1 — 교체 전 맞춤 (캐시팡팡 → 용돈캡슐 → 꿀꿀)
- `only?: (purpose) => boolean` — 이 복구가 다룰 용도만; 아닌 기록은 건드리지도 알리지도 않는다(꿀꿀: `purpose !== 'lottery_basic'`, 복권은 복권 화면이 따로 되살림). 표에 `skip` 으로 선언하는 것(지움)과 다르다.
- `parseStepsStagePurpose('steps_stage:<날짜>:<단계>') → { day, stageId } | null` — 표의 `'steps_stage:*'` 청구 함수가 `claimStepsStage(stageId, day)` 를 부를 때 쓴다.
- `SETTLED_CODES` 에 `day_changed` · `bad_day` · `bad_stage` 추가 — 걷기 청구가 더는 받을 수 없는 날 · 단계로 거절하면 기록을 지운다(서버는 오늘 · 어제 KST 만 받는다). 그 밖의 오류는 남겨 다음 실행에 다시 시도.
- **동작 보존 규칙**: 교체하는 앱은 옛 코드가 조용히 지우던 용도(청구 함수 `undefined`)를 표에 `skip` 으로 선언하되, 로컬 지급 · 다른 곳이 되살림이 **코드로 확인된 것만** 한다. 확인 안 된 용도는 선언하지 않고 `onUndeclared` 로 드러낸다.

### 0.2.2 — 캐시팡팡 10-23 줄(30분 · settled) 흡수, 걷기 규칙 도우미
캐시팡팡은 한 줄이 아니었다: 안드 1.0.6 · 1.0.5 는 24시간 · `seen` 이 불리언인 기준 판이고, iOS 1.0.5 · 안드 1.0.4 · 1.0.3 은 10-23 「대기 뿌리 뽑기」 판(보관 30분 + 서버 `settled` 응답 처리)이다. 에그머니 · 감자밭도 `settled` 개념이 있어 패키지가 직접 지원한다.
- `createPendingAds(storage, key, { maxAgeMs })` — 기본 24시간, 30분 줄은 `maxAgeMs: 30 * 60 * 1000`. 복구 루프도 같은 나이로 한 번 더 지운다.
- `seen` 이 `ads/seen` 응답 객체(`{ seen?, settled?, settledPoints?, settledBy? }`)를 그대로 돌려줘도 된다: `settled === true` 면 **청구 없이 기록만 지우고**, `settledPoints > 0` 이면 기존 안내(`say`)만 낸다. 객체는 `seen === true` 일 때만 청구, 아니면 남긴다(10-23 판과 같음).
- `extraSettledCodes: string[]` — 앱이 「이미 처리됨」으로 쓰던 거절 코드를 더한다(꿀꿀 8개). 목록에 없는 오류는 남겨 다음 실행에 다시.
- `stepsStageRule(claimStage)` — `purposes['steps_stage:*']` 에 그대로 넣는 걷기 칸: 용도에서 날짜 · 단계를 풀어 청구하고 **`gained > 0` 일 때만** 안내(`message`)가 나간다. 이미 받은 단계(0P)의 남은 SSV 행은 조용히 지워 **가짜 「보상 받았어요」가 뜨지 않는다**(서버 대조: 꿀꿀 걷기 열림 17건이 전부 이미 지급된 단계의 남은 행).
