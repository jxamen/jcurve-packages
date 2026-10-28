# @jcurve/offerwall 0.6.7 — 진단 로그 제거 (0.6.6 과 동작 같음, JS만)

A32 vc43(0.6.6) 통과: 찬스1 에서 바로 연 시트 · 찬스2 다녀온 뒤 연 시트 모두 세로 · 느린 끌기 · 분류 가로 스와이프가 움직이고 자리도 그대로 → **시트를 Modal 에 그린 것이 고침**. 이 판은 **로그만 뺀 판**이다.
**0.6.6 대비**: 멤버 83 → 80. **빠진 멤버 3개**(`dist/comboSheetProbe.js` · `.d.ts` · `src/comboSheetProbe.ts`), 새 멤버 없음, **다른 멤버 13개**(README · `dist/comboCategories.js` · `dist/comboEntry.js` · `dist/comboSheetFrame.d.ts` · `dist/comboSheetFrame.js` · `dist/comboTrials.js` · `dist/combos.js` · `src/comboCategories.ts` · `src/comboEntry.ts` · `src/comboSheetFrame.ts` · `src/comboTrials.ts` · `src/combos.ts` · `package.json`). **네이티브 관련 15개 멤버(android · ios · podspec · gradle · app.plugin.js · react-native.config.js)는 바이트 동일.** 판 · sha256 · integrity 는 `INTEGRITY-0.6.7.txt`(파일에서 계산한 값 — 락은 `npm install` 이 만든 값을 쓸 것). 빌드된 `dist`/`src` 에 `combos-sheet` · `TEMP-DIAG` · `comboSheetProbe` · `responderGrant` 문자열이 없는 것을 확인했다.

**지운 것**: `comboSheetProbe` 모듈과 모든 호출 · 세로 목록의 `onTouchStart` · `onTouchMove` · `onResponderGrant` · `onResponderTerminate` · `onScrollBeginDrag` · `onScroll` · `scrollEventThrottle` · 시트 컨테이너의 `onTouchStart` · `mode=` / `embed=` 로그와 그 prop · `TEMP-DIAG` 표시.
**남긴 것(0.6.6 과 같음)**: Modal 시트(앵커 측정 · 원점 보정 · 자동 후퇴 · 800ms 포기 · 열 때 방식 고정) · 서버 스위치 `display.sheet_modal` / `display.sheet_embed_block`(`"off"` 로 끔, 기본 켬) · 찬스2 임베드 터치 차단 + `setChanceSheetOpen` 신호 · JS 구동 슬라이드 + `settled`. `comboListProps` 는 `nestedScrollEnabled: true` + `style: { flex: 1 }` 만(이제 `comboSheetFrame.ts` 안).
**시험**: 423개(진단 시험 3개를 빼고 「아무것도 안 찍는다」 시험 추가; 스위치 · 후퇴 · 차단 · Modal 시험은 0.6.6 그대로 통과).

**알아 둘 것**: ① Modal 은 안드로이드 · iOS 둘 다에 적용된다. A32 로만 확인됐고 **iOS 실기기(TestFlight)는 아직 못 봤다** — 문제가 나면 서버 `display.sheet_modal:"off"` 한 줄로 iOS 도 예전 방식으로 되돌릴 수 있다(앱 재빌드 없이). ② Modal 배경이 창 전체를 덮어 시트가 열린 동안 하단 탭바 · 「찬스1·2」 탭의 첫 탭은 시트만 닫는다. ③ 안드로이드 뒤로 가기는 시트부터 닫는다.
