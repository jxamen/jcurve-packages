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
