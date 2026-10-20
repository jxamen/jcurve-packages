# @jcurve/steps 0.2.0 앱 연결

로컬 tgz를 설치한다. GitHub release/npm publish 없이 전달한 파일이다.

```sh
npm install /Users/jcurve/dev/appmgr/outbox/vendor-1020/jcurve-steps-0.2.0.tgz
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
  header={<PageHeader title="만보기" onBack={onClose} />}
  adSlot={<HarvestNative unitId={ADMOB.nativeFarmUnitId}
    style={{ marginTop: 16, marginHorizontal: 16, width: undefined, alignSelf: 'stretch' }} />}
/>
```

`api.sync`는 `{ days: [{date, steps, source}] }`를 받는다. `fetchStages`는 `StepsState`, `claimStage(id, day, earned?)`는 `StepsState & {gained, balance}`를 반환한다. 기존 stages API의 데이터 필드를 변경하지 않는다.

`showRewardedAd`는 `{earned, opened?, noAd?, message?}`를 반환한다. earned이면 청구하고, opened이며 noAd가 아닌 미확인 결과와 no_ad/ssv_pending 청구 응답은 onPendingClaim으로 넘긴다. 이 콜백은 선택 사항이다. 앱에서 기존 미결 청구 재시도/정산을 계속 담당한다. 이미 서버 확인된 광고를 재사용하려면 앱 어댑터에서 이를 확인해 `{earned:true}`를 반환한다.

header 생략 시 당근 PageHeader와 같은 기본 머리글을 그린다. adSlot의 여백/크기는 앱이 위 예처럼 제공한다. 바깥 안전영역은 앱이 잡는다.

`theme`은 bg/card/text/sub/line/dim/primary/primarySoft/onPrimary/radius 부분 덮어쓰기다. 기본은 당근 색과 반경이다. `strings`는 한국어 원문을 키로 한 부분 덮어쓰기다. 동적 완성 문구도 같은 방식으로 덮어쓴다.

```tsx
strings={{ '만보기': '오늘의 걸음', '당근캐시 만보기는 1,000걸음마다 광고 보기를 완료하면 포인트를 받아요.': '우리 앱은 1,000걸음마다 광고 보기를 완료하면 포인트를 받아요.' }}
```

compare-carrot-vs-package.png는 좌 당근/우 패키지 각 390×844이다. 두 쪽 모두 3,450걸음·2개 수령·1개 수령 가능 데이터와 동일 광고 대체 슬롯으로 렌더했다. 실제 광고 콘텐츠는 앱 SDK에 달려 있다. 원본 JSX는 점/막대를 렌더하지 않아 패키지도 동일하게 표시하지 않는다.

재현 스크립트: packages/steps/verification/render.mjs. STEPS_TOOLS(React/react-dom/react-native-web/esbuild/playwright 설치 경로), CARROT_SOURCE(원본 StepsScreen.tsx), STEPS_OUT(캡처 출력 디렉터리)를 지정한다. 원본 파일은 origin/work/tf-1019h와 동일함을 cmp로 확인했다.
