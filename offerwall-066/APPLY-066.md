# @jcurve/offerwall 0.6.6 — 시트를 `Modal` 로 그리기 + 시트가 열린 동안 찬스2 임베드 터치 차단 + 진단 보강 (JS만) — **원인을 가르는 판이고, 고침을 보장하지 않는다**

**0.6.5 대비**: 멤버 80 → 83. **새 JS 멤버 3개**(`dist/comboSheetFrame.js` · `.d.ts` · `src/comboSheetFrame.ts`), **다른 멤버 14개**(README · `dist/OfferwallScreen.js` · `dist/comboEntry.js` · `dist/comboSheetProbe.js` · `dist/combos.d.ts` · `dist/combos.js` · `dist/wallSignal.d.ts` · `dist/wallSignal.js` · `src/OfferwallScreen.ts` · `src/comboEntry.ts` · `src/comboSheetProbe.ts` · `src/combos.ts` · `src/wallSignal.ts` · `package.json`), **네이티브 관련 15개 멤버(android · ios · podspec · gradle · app.plugin.js · react-native.config.js)는 바이트 동일**. 판 · sha256 · integrity 는 `INTEGRITY-0.6.6.txt`(파일에서 계산한 값 — 락은 `npm install` 이 만든 값을 쓸 것).

## 배경 (A32 vc42, 0.6.5)
`container touchStart` · `list touchStart` 까지 찍히고 `list scrollBeginDrag` · `list scroll y=` 는 없다 = 터치는 컨테이너 · 목록(JS)까지 오는데 **드래그 시작만** 안 된다. 후보 수정(JS 구동 슬라이드 · nested)은 효과 없음. 두 번 다 찬스2 를 연 뒤였으므로 시트 밑에 스냅플레이 네이티브 뷰가 살아 있었다. 의심: ① 바깥 RNGH ② 그 네이티브 뷰 ③ 찬스 화면 트리 안 오버레이의 터치 순서. **이 판은 ①②③ 을 서버 스위치로 따로 켜고 끄며 가린다.**

## 서버 스위치 (`GET offerwall/combos` 의 `display`, 둘 다 기본 켬 — 서버 값이 없어도 켜짐, 앱 재빌드 없이 서버만 바꾸면 된다)
| 키 | 값 | 효과 |
|---|---|---|
| `sheet_modal` | `"off"` | 시트를 Modal 이 아니라 0.6.5 처럼 찬스 화면 트리 안에 그림(측정 앵커도 안 둠) |
| `sheet_embed_block` | `"off"` | 시트가 열려 있어도 찬스2 임베드 뷰의 터치를 막지 않음 |
`display` 에 이 키들만 넣어 `chance` 등 다른 키는 그대로 두면 된다. 가르는 법: **(둘 다 켬)** 기본 · **(Modal 만)** `sheet_embed_block:"off"` · **(차단만)** `sheet_modal:"off"` · **(둘 다 끔 = 0.6.5 동작)** 둘 다 `"off"`. 로그의 `mode=` · `embed=` 줄이 실제로 어느 쪽이 적용됐는지 확인해 준다.

## A) Modal
시트(와 「무료체험 확인」 시트)를 RN `Modal`(`transparent` · `animationType="none"` · `onRequestClose` = 시트 닫기 → 안드로이드 뒤로 가기도 시트부터 닫힘) 안에 그린다. 안에는 배경(Pressable, 탭하면 닫힘) + 시트(0.6.5 의 JS 슬라이드 · `settled` 그대로). 칩 줄 · 추천 팝업 · 동의 창은 그대로, 시트 위 토스트는 Modal 안에서 한 번만. **자리**: 찬스 컨테이너를 덮는 보이지 않는 앵커(`testID: jcurve-combo-anchor`, `pointerEvents:"none"`, `collapsable:false`)를 `measureInWindow` 로 재고, Modal 안 원점의 1×1 앵커(`jcurve-combo-modal-anchor`)도 재서 **차이**만큼 놓는다(상태 표시줄 · edge-to-edge 상쇄). 시트 top = `sheetTop + 탭 inset`, 아래는 컨테이너 아래끝(앱 하단 탭바 위). **자동 후퇴(트리 안 시트)**: 열 때 컨테이너가 안 재졌음(레이아웃 때와 열 때 두 번 잼) · 값이 NaN/너무 작음(100×200 미만)/한 화면 넘게 어긋남 · Modal 원점이 800ms 안에 안 재짐 · `display.sheet_modal:"off"`. 방식은 열 때 한 번 정해 고정(열린 채 트리↔Modal 로 바뀌지 않음), Modal 원점은 창 크기별로 한 번 재서 이어 쓴다.
**알아 둘 동작 변화**: Modal 배경이 창 전체를 덮어 시트가 열린 동안은 하단 탭바 · 「찬스1·2」 탭을 눌러도 **첫 탭은 시트만 닫는다**(예전엔 바로 눌렸음). 안드로이드 뒤로 가기는 시트부터 닫는다.

## E) 임베드 터치 차단
`ComboEntry` 가 시트 열림을 `setChanceSheetOpen(boolean)` 으로 알리고(`wallSignal`: `getChanceSheetOpen` · `onChanceSheetOpen`, **구독 직후 현재 값 읽기**), `OfferwallScreen` 이 열려 있는 동안 **찬스2 패널(임베드 컨테이너)** 에 `pointerEvents="none"`. 닫히면 복귀. 찬스1 월에는 적용 안 함. 임베드가 없는 쪽(찬스1)은 효과가 없고 로그는 `embed=none`.

## C) 진단 (logcat `ReactNativeJS`, 시트가 열릴 때마다 각 한 번 — 0.6.7 에서 뺄 예정, `TEMP-DIAG` 표시)
`[combos-sheet] mode=modal|tree` · `embed=blocked|none` · `container touchStart` · `list touchStart` · `list touchMove` · `list responderGrant` · `list scrollBeginDrag` · `list scroll y=<n>` · `list responderTerminate`(= 누가 응답자를 가져갔나). 숫자 · 단계 이름만, 회원 정보 없음.
**요청과 다른 점 하나**: `list responderTerminationRequest` 는 **넣지 못했다** — React Native 의 `ScrollView` 는 `onResponderTerminationRequest` prop 을 읽지 않는다(자기 내부 함수가 답함, RN 0.79 `ScrollView.js` `_handleResponderTerminationRequest` 확인). 그래서 그 prop 으로는 관찰이 안 되고 줄이 안 찍혀도 의미가 없다. `onResponderGrant` · `onTouchMove` 는 ScrollView 가 prop 을 불러 주고, `onResponderTerminate` 는 그대로 전달된다.
읽는 법: `list touchMove` 가 있고 `list responderGrant` 가 없으면 목록이 응답자가 못 됨, `responderGrant` 뒤 `responderTerminate` 가 찍히면 누군가 가져감(드래그 시작 전에), `touchMove` 조차 없으면 이동 이벤트가 목록까지 안 옴.

## 시험 · 못 본 것
시험 425개(20개 추가, 기존 405개 그대로 통과): 자리 계산(상태 표시줄 차이 상쇄) · 못 잴 때 후퇴(안 재짐/throw/NaN/0 크기/어긋남/800ms 초과) · Modal 열림/닫힘(배경 탭 · 뒤로) · `sheet_modal:"off"` · 무료체험 시트도 Modal · 토스트 한 번 · 방식 고정 · 차단 신호(찬스2 위 `embed=blocked`, 스위치로 `none`) · 구독 전에 온 신호 · 임베드 패널 `pointerEvents`. 규칙을 일부러 깨면(방식 고정 등) 해당 시험이 실패하는 것 확인.
**못 본 것(전부 실기기)**: 이 PC 의 시험은 가짜 렌더라 **터치 전달 자체는 시험하지 못한다.** Modal 이 스와이프를 고치는지, 차단이 고치는지, 둘 다 아닌지는 A32 에서 위 네 조합으로 봐야 한다. Modal 자리가 실제 기기에서 같은 곳에 놓이는지(상태 표시줄 · edge-to-edge)도 화면으로 확인이 필요하다.
