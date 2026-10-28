# @jcurve/offerwall 0.4.4 — 「포인트 빨리 모으기」 시트를 `Modal` 로 그리기 (0.6.6/0.6.7 이식 · 0.4.x 줄 · JS만 · 진단 로그 없음)

**배경**: 이미 나간 0.4.3 7앱 줄에서 시트 안 세로 목록 · 느린 끌기 · 분류 가로 줄이 스와이프로 안 움직인다(2p6, 캐시팡팡 1.0.5 · 머니트리 1.0.9 A32, 오류 줄 없음). 0.6.x 에서 같은 증상이 시트를 `Modal` 안에 그리자 해결된 것(A32 vc43)을 0.4.x 의 `ComboEntry` 에 같은 모양으로 옮겼다.
**0.4.3 대비**: 멤버 68 → 71. **새 JS 멤버 3개**(`dist/comboSheetFrame.js` · `.d.ts` · `src/comboSheetFrame.ts`), **다른 멤버 11개**(README · `dist/comboCategories.js` · `dist/comboEntry.js` · `dist/comboTrials.js` · `dist/combos.d.ts` · `dist/combos.js` · `src/comboCategories.ts` · `src/comboEntry.ts` · `src/comboTrials.ts` · `src/combos.ts` · `package.json`). **네이티브 관련 12개 멤버(android · ios · podspec · gradle · app.plugin.js · react-native.config.js)는 바이트 동일** — `0.4.0` · `0.4.1` · `0.4.2` · `0.4.3`(non-external)과 각각 직접 비교해 모두 차이 0. 그래서 **0.4.0 을 쓰는 줄도 0.4.4 로 바로 얹을 수 있다.** (`*-external` 변형은 podspec 이 달라 별도.) 판 · sha256 · integrity 는 `INTEGRITY-0.4.4.txt`(파일에서 계산한 값 — 락은 `npm install` 이 만든 값을 쓸 것; 다시 빌드해도 같은 sha256 이 나옴을 확인).

## 무엇이 바뀌나
- **Modal 시트(기본 켬)**: `transparent` · `animationType="none"` · `onRequestClose` = 시트 닫기(안드로이드 뒤로 가기도 시트부터). 칩 줄 · 추천 팝업 · 동의 창은 그대로, 시트 위 토스트는 Modal 안에서 한 번만. 같은 자리: 찬스 컨테이너를 덮는 보이지 않는 앵커(`testID: jcurve-combo-anchor`)와 Modal 안 1×1 원점 앵커(`jcurve-combo-modal-anchor`)를 `measureInWindow` 로 재서 **차이**만큼 놓는다(상태 표시줄 · edge-to-edge 상쇄). 시트 top = `sheetTop`, 아래는 컨테이너 아래끝(앱 하단 탭바 위).
- **자동 후퇴(0.4.3 방식 = 트리 안 시트)**: 열 때 컨테이너가 안 재졌음(레이아웃 때 + 열 때 두 번 잼) · 값이 NaN/너무 작음(<100×200)/한 화면 넘게 어긋남 · Modal 원점이 800ms 안에 안 재짐. 방식은 열 때 한 번 정해 고정.
- **서버 스위치**: `GET offerwall/combos` 의 `display.sheet_modal: "off"` 이면 Modal 을 쓰지 않고 0.4.3 방식(측정 앵커도 안 둠). 기본은 켬(키가 없어도 켜짐). iOS 에서 문제가 나면 서버만 바꿔 되돌릴 수 있다.
- **슬라이드**: JS 구동 + 끝나면 `transform` 제거. **세로 목록 세 곳**(`ComboStepsScreen` · `ComboCategoryScreen` · `ComboTrialsScreen`)에 `nestedScrollEnabled: true` + `style: { flex: 1 }`.
- 0.6.x 와 달리 없는 것: 스냅플레이 임베드가 없어 임베드 터치 차단(`sheet_embed_block`)이 없고, 탭 줄이 없어 탭 inset 도 없다(시트 위치는 `sheetTop` 그대로). 진단 로그 없음.

## 알아 둘 동작 변화
Modal 배경이 창 전체를 덮어 시트가 열린 동안 하단 탭바 · 위쪽 메뉴의 **첫 탭은 시트만 닫는다**. 안드로이드 뒤로 가기는 시트부터 닫는다. **Modal 은 iOS 에도 적용되는데 iOS 실기기는 아직 못 봤다**(0.6.x 도 A32 로만 확인) — 이 줄 7앱의 iOS 에서 TestFlight/실기기 확인을 권한다.

## 시험 · 못 본 것
시험 319개(0.4.3 의 301개 + 18개): 자리 계산 · 못 잴 때 후퇴 6종 · Modal 열림/닫힘(배경 탭 · 뒤로) · 원점이 안 재질 때 800ms 후퇴 · `sheet_modal:"off"` · 무료체험 시트도 Modal · 방식 고정 · JS 슬라이드/끊김 · 세 화면 목록 props · 아무것도 안 찍음. (토스트를 찾는 기존 시험 한 줄은 새 앵커와 구분하도록 고쳤다.) 0.6.6 에서 같은 시험들이 규칙을 깨면 실패하는 것을 확인했다.
**못 본 것(전부 실기기)**: 이 PC 의 시험은 가짜 렌더라 **터치 전달 자체는 시험하지 못한다.** 0.6.6 은 A32 에서 통과했지만 이 0.4.4 가 캐시팡팡 1.0.5 · 머니트리 1.0.9 에서 스와이프를 고치는지는 같은 2p6 잡으로 다시 봐야 한다.
