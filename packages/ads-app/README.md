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
