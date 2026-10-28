# @jcurve/offerwall 0.6.5 — 「포인트 빨리 모으기」 시트 안 목록이 스와이프로 안 움직이던 것: **후보 수정 + 임시 진단** (JS만)

**원인은 아직 확정하지 못했다.** 이 판은 후보 수정과 임시 진단을 함께 넣어 A32 에서 가려 보려는 용도다. 후보 수정이 맞는지는 실기기 확인 전에는 모른다. **0.6.4 대비**: 멤버 77 → 80. 새 멤버 3개(`dist/comboSheetProbe.js` · `dist/comboSheetProbe.d.ts` · `src/comboSheetProbe.ts`), 다른 멤버 10개(README · `dist/comboCategories.js` · `dist/comboEntry.js` · `dist/comboTrials.js` · `dist/combos.js` · `src/comboCategories.ts` · `src/comboEntry.ts` · `src/comboTrials.ts` · `src/combos.ts` · `package.json`), **네이티브 13개 멤버 바이트 동일**. 판 · sha256 · integrity 는 `INTEGRITY-0.6.5.txt`(파일에서 계산한 값 — 락은 `npm install` 이 만든 값을 쓸 것).

## A) 후보 수정 (동작 · 모양 그대로)
1. `ComboSheet`(`comboEntry.ts`): 슬라이드를 `useNativeDriver:false`(JS 구동)로, **슬라이드가 끝나면(`start` 콜백 `finished`) 상태 `settled` 를 켜서 `transform` 을 시트 스타일에서 아예 뺀다**. `finished:false`(중간에 끊김)면 그대로, 결과 객체 없이 불리는 옛 Animated 는 끝난 것으로 본다. 시트는 닫히면 언마운트되므로 `settled` 는 다음에 열 때 처음부터. position · left/right/bottom/top · zIndex 25 · elevation 25 · overflow · 둥근 모서리 · 배경 · 그림자는 그대로.
2. 세 화면(`ComboCategoryScreen` · `ComboStepsScreen` · `ComboTrialsScreen`)의 **세로 ScrollView 에 `nestedScrollEnabled:true` · `style:{flex:1}`**(`comboListProps()`). 각 화면의 기존 props(`contentContainerStyle` · `keyboardShouldPersistTaps`)는 그대로. 가로 줄(분류 탭) ScrollView 는 건드리지 않았다(이미 nested · `flexGrow:0`).
3. 시트 뒤 backdrop(Pressable)은 그대로.

## B) 임시 진단 (이번 판에만 — 0.6.6 에서 뺀다)
logcat `ReactNativeJS` 에 시트가 열릴 때마다 아래 단계가 **각 한 번만**(열 때 `resetComboSheetProbe` 로 초기화):
- `[combos-sheet] container touchStart` — 시트의 Animated.View `onTouchStart`(시트가 터치를 받음)
- `[combos-sheet] list touchStart` — 세로 ScrollView `onTouchStart`(목록이 터치를 받음)
- `[combos-sheet] list scrollBeginDrag` — 목록이 드래그를 시작
- `[combos-sheet] list scroll y=<n>` — `onScroll`(`scrollEventThrottle:100`)로 처음 0 이 아닌 오프셋 한 번(0 은 안 찍음)
읽는 법: container 도 안 찍히면 터치가 시트까지 안 옴(위쪽 제스처/뷰가 가로챔) → list touchStart 가 안 찍히면 시트까지는 오는데 목록이 못 받음 → touchStart 는 찍히는데 scrollBeginDrag 가 없으면 목록이 드래그를 시작 못 함(부모/제스처가 빼앗음) → scrollBeginDrag 는 있는데 scroll y 가 없으면 시작은 했는데 안 움직임. 회원 정보 없음(단계 이름과 오프셋 숫자뿐). `console.log` 가 던져도 시트는 안 깨진다. 제거 표시: 코드의 `TEMP-DIAG 0.6.5` 주석.

## 시험 · 못 본 것
시험 405개(8개 추가, 기존 397개 그대로 통과): 슬라이드가 JS 구동이고 끝나면 `transform` 이 빠짐(재렌더에도) · 끊긴 슬라이드는 유지 · 세 화면의 세로 목록 props 와 가로 줄 불변 · 진단 줄이 열 때마다 단계별 한 번, 0 오프셋은 안 찍힘, 열 때 초기화, 로그가 던져도 안 깨짐.
**못 본 것(전부 실기기)**: 후보 수정이 스와이프를 고치는지 · 어떤 단계에서 끊기는지는 A32 에서 `adb logcat -s ReactNativeJS | grep combos-sheet` 로 스와이프 전후를 보면 된다. 이 PC 의 시험은 가짜 렌더라 터치 전달은 시험하지 못한다.
