# @jcurve/offerwall 0.6.2 — 「포인트 빨리 모으기」 찬스1 · 찬스2 탭마다 따로 + 찬스2 추천 미션 → 스냅플레이 광고 바로 열기

**JS 만 · 새 네이티브 없음 · 0.6.0/0.6.1 빌드(스냅플레이 모듈이 들어 있는 빌드)에 OTA 가능.** 판 · sha256 · integrity 는 `INTEGRITY-0.6.2.txt` (파일에서 계산한 값 — 락은 `npm install` 이 만든 값을 쓰고 손으로 옮기지 말 것). 베이스 0.6.1 tgz 와 비교하면 멤버 77개 중 13개(README · dist 7 · src 4 · package.json)만 다르고 안드로이드 · iOS 네이티브 13개 멤버는 바이트까지 같다.

## 앱 연결 (에그머니 — 앱보조5)
1. `package.json` 의 `@jcurve/offerwall` → `file:vendor/jcurve-offerwall-0.6.2.tgz`, 락(`file:` 주소 · 버전 · integrity), 옛 tgz 삭제(vendorGuard 시험이 있으면 시험의 이름도).
2. 찬스 탭의 `<ComboEntry placement="chance" …>` 에 **한 줄**: `loadSnapPlay={() => <offerwall/combos 를 source=snapplay 로 부르는 함수>}` — 본문 = `GET offerwall/combos?source=snapplay` 의 JSON(애드팝콘 것과 같은 `display · bundles · categories` 모양, 행의 `campaignKey` = 스냅플레이 `adv_id`(숫자)). 이 prop 이 없거나 응답이 비면 **찬스2 에는 칩이 없다**(찬스1 목록은 찬스2 위에 안 보인다 — 0.6.0/0.6.1 에서는 보였다).
3. 서버 설정 `content/config/snapplay` 응답에 **`listPlacement`** 추가(스냅플레이 콘솔에서 "main" 이 아닌 플레이스먼트를 하나 더 만들어 그 이름). 없으면 추천 미션 직접 열기가 꺼지고 찬스2 탭으로 안내만 한다.
4. (선택) `onSnapPlayAds={ads => …}` — 폰이 SDK 에서 읽은 광고 목록(`advId · title · points(=user_pnt) · originalPoints · detail …`)을 서버로 올리고 싶을 때, 그리고 **`points` 가 전환 비율(60%)이 이미 반영된 값인지** 확인할 때(스냅플레이 화면에 보이는 P 와 같은 광고로 비교). 서버가 S2S API 로 직접 받으면 필요 없다.

## 동작 (실기기에서 볼 것)
- 찬스1: 지금과 같다(칩 · 시트 · 추천 팝업 · 「무료체험 확인」).
- 찬스2: 칩 → 시트에 `source=snapplay` 목록. 행을 누르면 → (A) 그 광고가 SDK 목록에 있으면 `openAdItem` 으로 스냅플레이의 해당 광고 화면(상세 있는 광고는 상세, 없는 광고는 참여 요청 뒤 마켓/브라우저). 시트는 그대로 남는다. (B) 목록에 없음 = 마감 → 토스트 「"이름" 는 마감됐어요 · 다른 미션을 골라 주세요」 + 서버에 `open_failed` 힌트(`onDetailSignal`). (C) 직접 열 수 없음(listPlacement 없음 · 목록 읽기 실패 · SDK 오류) → 이름을 복사하고 「"이름" 를 찾아 주세요」, 시트는 닫혀 찬스2 화면이 보인다.
- 탭을 바꾸면 열려 있던 시트 · 팝업이 닫힌다. 완료 표시(수동 체크)는 탭마다 따로 저장된다.
- 진단: `onDiagnostic` 의 `how: 'snapplay_id'` · `openError`(= `gone` · `unsupported` · `list_failed` · `sdk_error` …) · `listCount`. `snapPlayStatus().directOpen` = 이 기기에서 직접 열기 가능 여부.

## 본 것 / 못 본 것 (솔직히)
- 본 것: 시험 382개 통과(19개 추가) — 탭마다 목록 · 칩 숨김(빈 응답 · 실패 · prop 없음) · `openAdItem(id, detail_yn, listPlacement)` 인자 · 마감 판정(캐시 목록에 없으면 한 번 새로 읽고 판단) · 폴백 · 탭 변경 시 시트 닫힘 · 탭별 완료 표시 키 · `ret_cd`/모양 이상 · 500건 제한. 스냅플레이 SDK 문서(Data API)와 플러그인 1.0.38 의 안드로이드 · iOS 소스로 `requestOfferwallData` / `openAdItem` 시그니처를 확인했다.
- **못 본 것**: 실기기에서 `requestOfferwallData` / `openAdItem` 을 불러 본 적이 없다. 특히 (1) `listPlacement` 플레이스먼트가 콘솔에 실제로 만들어져 목록이 오는지, (2) 찬스2 탭의 스냅플레이 화면(임베드 뷰)이 떠 있는 동안 `openAdItem` 의 SDK 화면이 정상으로 올라오는지(iOS 는 앱 루트 뷰컨트롤러 위), (3) `user_pnt` 가 60% 반영값인지, (4) 서버 `source=snapplay` 응답이 실제로 오는지는 앱관리의 A32(안드) · TF(아이폰) 확인이 필요하다. 이 패키지의 시험은 가짜 SDK 로 한 것이다.
